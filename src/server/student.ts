import { testGroupIds } from '../lib/model.ts';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { Attempt, Store } from '../lib/model.ts';
import { answerAttempt, beginAttempt, expireAttempt, finishAttempt, studentAttempt } from '../lib/attempts.ts';
import { database, readStore } from './database.ts';

export class StudentError extends Error {
 constructor(message:string,public status=400,public details:unknown=undefined){super(message);}
}
async function dbNow(db:PoolConnection){const [rows]=await db.query<RowDataPacket[]>('SELECT UTC_TIMESTAMP(3) AS now');return new Date(rows[0].now);}
async function persist(db:PoolConnection,attempt:Attempt){await db.execute('INSERT INTO app_attempts(id,student_id,test_id,payload) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)',[attempt.id,attempt.studentId,attempt.testId,JSON.stringify(attempt)]);}
async function transaction<T>(studentId:string,action:(store:Store,now:Date,db:PoolConnection)=>Promise<T>):Promise<T>{
 const db=await database().getConnection();
 try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const {data}=await readStore(db);if(!data.students.some(s=>s.id===studentId))throw new StudentError('Студент не найден.',403);const result=await action(data,await dbNow(db),db);await db.commit();return result;}
 catch(error){await db.rollback();throw error;}finally{db.release();}
}
export async function studentHome(studentId:string){return transaction(studentId,async(data,now,db)=>{
 const student=data.students.find(s=>s.id===studentId)!;const group=data.groups.find(g=>g.id===student.groupId)!;const specialty=data.specialties.find(s=>s.id===group.specialtyId)!;
 const owned:Attempt[]=[];for(const old of data.attempts.filter(a=>a.studentId===studentId)){const current=expireAttempt(old,now);if(current!==old)await persist(db,current);owned.push(current);}
 return {serverNow:now.toISOString(),student:{name:student.name,group:group.name,specialty:specialty.name,qualification:specialty.qualification},tests:data.tests.filter(t=>(t.published&&testGroupIds(data,t).includes(group.id))||owned.some(a=>a.testId===t.id)).map(t=>{
  const attempt=owned.find(a=>a.testId===t.id);return {id:t.id,name:attempt?.testName??t.name,subject:data.subjects.find(s=>s.id===t.subjectId)?.name??'',minutes:attempt?Math.round((Date.parse(attempt.deadline)-Date.parse(attempt.startedAt))/60000):t.minutes,questionCount:attempt?.questions.length??t.variants[0]?.questions.length??0,status:attempt?.completedAt?'completed':attempt?'active':'available',attemptId:attempt?.id??null,result:attempt?studentAttempt(attempt).result:null};
 })};
 });}
export async function startStudentAttempt(studentId:string,testId:string){return transaction(studentId,async(data,now,db)=>{
 let result;try{result=beginAttempt(data,studentId,testId,now);}catch(error){throw new StudentError(error instanceof Error?error.message:'Тест недоступен.',403);}
 const attempt=expireAttempt(result.attempt,now);if(result.store!==data||attempt!==result.attempt)await persist(db,attempt);return {attempt:studentAttempt(attempt),serverNow:now.toISOString()};
 });}
export async function accessStudentAttempt(studentId:string,attemptId:string,operation:'read'|'answer'|'finish',revision?:number,changes:Record<string,string>={}){
 let conflict=false;
 const result=await transaction(studentId,async(data,now,db)=>{
  const old=data.attempts.find(a=>a.id===attemptId&&a.studentId===studentId);if(!old)throw new StudentError('Попытка не найдена.',404);
  let attempt=expireAttempt(old,now);
  if(!attempt.completedAt&&operation!=='read'){
   if(revision!==(attempt.answerRevision??0))conflict=true;
   else if(operation==='finish')attempt=finishAttempt(attempt,now);
   else {try{attempt=answerAttempt(attempt,changes,now);}catch(error){throw new StudentError(error instanceof Error?error.message:'Проверьте ответ.');}}
  }
  if(attempt!==old)await persist(db,attempt);return {attempt:studentAttempt(attempt),serverNow:now.toISOString()};
 });
 if(conflict)throw new StudentError('Ответы изменены в другом окне. Данные обновлены.',409,result);
 return result;
}
export async function settleExpiredAttempts(){
 const db=await database().getConnection();try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const now=await dbNow(db);const [rows]=await db.query<RowDataPacket[]>('SELECT payload FROM app_attempts');for(const row of rows){const old=(typeof row.payload==='string'?JSON.parse(row.payload):row.payload) as Attempt;const current=expireAttempt(old,now);if(current!==old)await persist(db,current);}await db.commit();}catch(error){await db.rollback();throw error;}finally{db.release();}
}

export type StudentHomeData=Awaited<ReturnType<typeof studentHome>>;
