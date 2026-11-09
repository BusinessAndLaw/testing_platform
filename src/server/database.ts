import { normalizeAssignments } from '../lib/model.ts';
import { openPassword } from './password-vault.ts';
import mysql from 'mysql2/promise';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { Store } from '../lib/model.ts';

const shared = globalThis as typeof globalThis & { testingPool?: mysql.Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  if (!shared.testingPool) shared.testingPool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 6, charset: 'utf8mb4', timezone: 'Z', supportBigNumbers: true });
  return shared.testingPool;
}
type Connection = Pick<PoolConnection,'query'|'execute'>;
async function rows(db: Connection, table: string, order = 'id') {
  const [result] = await db.query<RowDataPacket[]>(`SELECT * FROM ${table} ORDER BY ${order}`);return result;
}
function json<T>(value: unknown): T {return (typeof value === 'string' ? JSON.parse(value) : value) as T;}
export async function readStore(db: Connection, compactAttempts = false): Promise<{data: Store; revision: number}> {
  const metadata = (await rows(db,'app_settings'))[0];if(!metadata)throw new Error('Run npm run db:setup first.');
  const specialties=await rows(db,'app_specialties');const groups=await rows(db,'app_groups');const students=await rows(db,'app_students');const subjects=await rows(db,'app_subjects');const users=await rows(db,'app_users');const passwords=await rows(db,'app_user_passwords','user_id');const tests=await rows(db,'app_tests');const variants=await rows(db,'app_variants','test_id, position');const questions=await rows(db,'app_questions','variant_id, position');const options=await rows(db,'app_options','question_id, position');const assignments=await rows(db,'app_assignments','test_id, group_id');const subjectAssignments=await rows(db,'app_subject_assignments','subject_id, group_id');const attempts=compactAttempts
    ? (await db.query<RowDataPacket[]>(`SELECT JSON_REMOVE(payload,'$.questions','$.answers') AS payload, JSON_LENGTH(payload,'$.questions') AS question_count FROM app_attempts ORDER BY id`))[0]
    : await rows(db,'app_attempts');
  const data:Store={version:3,nextUserNumber:metadata.next_user_number,scale:json(metadata.scale),
    specialties:specialties.map(s=>({id:s.id,code:s.code,name:s.name,qualification:s.qualification})),
    groups:groups.map(g=>({id:g.id,name:g.name,admissionYear:g.admission_year,graduationYear:g.graduation_year,specialtyId:g.specialty_id})),
    students:students.map(s=>({id:s.id,name:s.name,groupId:s.group_id})),subjects:subjects.map(s=>({id:s.id,name:s.name,specialtyId:s.specialty_id,groupIds:subjectAssignments.filter(a=>a.subject_id===s.id).map(a=>a.group_id)})),
    users:users.map(u=>({id:u.id,name:u.name,login:u.login,role:u.role,studentId:u.student_id??'',passwordHash:u.password_hash,passwordSalt:u.password_salt,passwordAvailable:passwords.some(p=>p.user_id===u.id&&p.password_hash===u.password_hash&&p.password_salt===u.password_salt)})),
    tests:tests.map(t=>({id:t.id,name:t.name,subjectId:t.subject_id??'',minutes:t.minutes,published:!!t.published,groupIds:assignments.filter(a=>a.test_id===t.id).map(a=>a.group_id),variants:variants.filter(v=>v.test_id===t.id).map(v=>({id:v.id,name:v.name,questions:questions.filter(q=>q.variant_id===v.id).map(q=>({id:q.id,text:q.text,correctId:q.correct_option_id,options:options.filter(o=>o.question_id===q.id).map(o=>({id:o.id,text:o.text}))}))}))})),
    attempts:attempts.map(a=>compactAttempts
      ? {...json<Store['attempts'][number]>(a.payload),questions:[],questionCount:Number(a.question_count)}
      : json(a.payload))};
  return {data:normalizeAssignments(data),revision:Number(metadata.revision)};
}
export async function getStore(compactAttempts = false) {const db=await database().getConnection();try{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await db.beginTransaction();const state=await readStore(db,compactAttempts);await db.commit();return state;}catch(error){await db.rollback();throw error;}finally{db.release();}}
async function upsert(db:Connection,table:string,columns:string[],values:unknown[][]) {
  if(!values.length)return;
  const updates=columns.filter(c=>c!=='id').map(c=>`${c}=VALUES(${c})`).join(',');
  await db.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ? ON DUPLICATE KEY UPDATE ${updates}`,[values]);
}
export async function writeStore(db:Connection,data:Store,revision:number) {
  data=normalizeAssignments(data);
  await upsert(db,'app_specialties',['id','code','name','qualification'],data.specialties.map(s=>[s.id,s.code,s.name,s.qualification]));
  await upsert(db,'app_groups',['id','name','admission_year','graduation_year','specialty_id'],data.groups.map(g=>[g.id,g.name,g.admissionYear,g.graduationYear,g.specialtyId]));
  await upsert(db,'app_students',['id','group_id','name'],data.students.map(s=>[s.id,s.groupId,s.name]));
  await upsert(db,'app_subjects',['id','specialty_id','name'],data.subjects.map(s=>[s.id,s.specialtyId,s.name]));
  const existingUsers=await rows(db,'app_users');for(const user of data.users){const old=existingUsers.find(u=>u.id===user.id);if(old&&(old.password_hash!==user.passwordHash||old.password_salt!==user.passwordSalt||old.role!==user.role))await db.execute('DELETE FROM app_sessions WHERE user_id=?',[user.id]);}
  await upsert(db,'app_users',['id','name','login','role','student_id','password_hash','password_salt'],data.users.map(u=>[u.id,u.name,u.login,u.role,u.studentId||null,u.passwordHash,u.passwordSalt]));
  for(const user of data.users){
    if(user.passwordEnvelope){openPassword(user.passwordEnvelope,user);await db.execute('INSERT INTO app_user_passwords(user_id,envelope,password_hash,password_salt) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE envelope=VALUES(envelope),password_hash=VALUES(password_hash),password_salt=VALUES(password_salt)',[user.id,user.passwordEnvelope,user.passwordHash,user.passwordSalt]);}
    else await db.execute('DELETE FROM app_user_passwords WHERE user_id=? AND (password_hash<>? OR password_salt<>?)',[user.id,user.passwordHash,user.passwordSalt]);
  }
  await upsert(db,'app_tests',['id','name','subject_id','minutes','published'],data.tests.map(t=>[t.id,t.name,t.subjectId||null,t.minutes,t.published]));
  const variants=data.tests.flatMap(t=>t.variants.map((v,i)=>({v,testId:t.id,position:i})));const questions=variants.flatMap(({v})=>v.questions.map((q,i)=>({q,variantId:v.id,position:i})));const options=questions.flatMap(({q})=>q.options.map((o,i)=>({o,questionId:q.id,position:i})));
  await upsert(db,'app_variants',['id','test_id','name','position'],variants.map(x=>[x.v.id,x.testId,x.v.name,x.position]));
  await upsert(db,'app_questions',['id','variant_id','text','correct_option_id','position'],questions.map(x=>[x.q.id,x.variantId,x.q.text,x.q.correctId,x.position]));
  await upsert(db,'app_options',['id','question_id','text','position'],options.map(x=>[x.o.id,x.questionId,x.o.text,x.position]));
  await db.query('DELETE FROM app_subject_assignments');const subjectAssignments=data.subjects.flatMap(s=>(s.groupIds??[]).map(id=>[s.id,id]));if(subjectAssignments.length)await db.query('INSERT INTO app_subject_assignments(subject_id,group_id) VALUES ?',[subjectAssignments]);
  await db.query('DELETE FROM app_assignments');const assignments=data.tests.flatMap(t=>t.groupIds.map(id=>[t.id,id]));if(assignments.length)await db.query('INSERT INTO app_assignments(test_id,group_id) VALUES ?',[assignments]);
  await upsert(db,'app_attempts',['id','student_id','test_id','payload'],data.attempts.map(a=>[a.id,a.studentId,a.testId,JSON.stringify(a)]));
  for(const [table,ids] of [
    ['app_options',options.map(x=>x.o.id)],['app_questions',questions.map(x=>x.q.id)],['app_variants',variants.map(x=>x.v.id)],['app_attempts',data.attempts.map(a=>a.id)],['app_tests',data.tests.map(t=>t.id)],['app_users',data.users.map(u=>u.id)],['app_students',data.students.map(s=>s.id)],['app_groups',data.groups.map(g=>g.id)],['app_subjects',data.subjects.map(s=>s.id)],['app_specialties',data.specialties.map(s=>s.id)],
  ] as [string,string[]][]){if(ids.length)await db.query(`DELETE FROM ${table} WHERE id NOT IN (?)`,[ids]);else await db.query(`DELETE FROM ${table}`);}
  await db.execute('INSERT INTO app_settings(id,revision,next_user_number,scale) VALUES(1,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),next_user_number=VALUES(next_user_number),scale=VALUES(scale)',[revision,data.nextUserNumber,JSON.stringify(data.scale)]);
}
