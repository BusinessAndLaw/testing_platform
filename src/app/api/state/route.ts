import { attemptGroupId, attemptGraduationYear, testGroupIds } from '@/lib/model';
import { NextResponse } from 'next/server';
import { currentUser, sameOrigin } from '@/server/auth';
import { database, getStore, readStore, writeStore } from '@/server/database';
import { settleExpiredAttempts } from '@/server/student';
import { validateStore } from '@/server/validation';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await currentUser();if(user?.role!=='admin'&&user?.role!=='analyst')return NextResponse.json({error:'Требуется вход администратора.'},{status:401});await settleExpiredAttempts();const state=await getStore(user.role==='analyst'||new URL(request.url).searchParams.get('view')==='dashboard');
if(user.role==='analyst'){
 const {data}=state;
 const completedTests=new Map<string,Set<string>>();
 for(const attempt of data.attempts){
  if(!attempt.completedAt)continue;
  const tests=completedTests.get(attempt.studentId)??new Set<string>();
  tests.add(attempt.testId);
  completedTests.set(attempt.studentId,tests);
 }
 data.groups=data.groups.map(group=>{
  const members=data.students.filter(student=>student.groupId===group.id);
  const required=data.tests.filter(test=>test.published&&testGroupIds(data,test).includes(group.id));
  const completedCount=required.length
    ? members.filter(student=>required.every(test=>completedTests.get(student.id)?.has(test.id))).length
    : 0;
  return {...group,studentCount:members.length,completedCount};
 });
 const anonymousIds=new Map<string,string>();
 data.attempts=data.attempts.filter(attempt=>attempt.completedAt).map((attempt,index)=>{
  const studentId=anonymousIds.get(attempt.studentId)??crypto.randomUUID();
  anonymousIds.set(attempt.studentId,studentId);
  // Chart inputs retain only the fields needed for aggregate calculations.
  return {
   id:String(index),studentId,testId:attempt.testId,groupId:attemptGroupId(data,attempt),
   graduationYear:attemptGraduationYear(data,attempt),grade:attempt.grade,
   completedAt:'1970-01-01T00:00:00.000Z',testName:'',variantId:'',variantName:'',
   questions:[],startedAt:'',deadline:'',scale:data.scale,
  };
 });
 data.students=[];
 data.users=[];
 data.tests=data.tests.map(test=>({...test,variants:[]}));
}
return NextResponse.json(state,{headers:{'Cache-Control':'no-store'}});}catch{console.error('Unable to read testing database');return NextResponse.json({error:'База данных недоступна. Проверьте запуск MySQL.'},{status:503});}}
export async function PUT(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса.'},{status:403});
 try{const user=await currentUser();if(user?.role!=='admin')return NextResponse.json({error:'Требуется вход администратора.'},{status:401});}catch{return NextResponse.json({error:'База данных недоступна.'},{status:503});}
 const text=await request.text();if(Buffer.byteLength(text)>16*1024*1024)return NextResponse.json({error:'Слишком большой объём данных.'},{status:413});
 let data;let revision:number;
 try{const body=JSON.parse(text);data=validateStore(body.data);revision=body.revision;if(!Number.isSafeInteger(revision)||revision<1)throw Error('Неверная версия данных.');}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Проверьте данные.'},{status:422});}
 const db=await database().getConnection();
 try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const current=await readStore(db);
 if(current.revision!==revision){await db.rollback();return NextResponse.json({error:'Данные уже изменены в другом окне. Скачайте свои изменения и загрузите актуальные данные.'},{status:409});}
 if(data.nextUserNumber<current.data.nextUserNumber)throw Error('Нельзя уменьшить счётчик выданных логинов.');
 data=validateStore({...data,attempts:current.data.attempts});
 await writeStore(db,data,revision+1);await db.commit();return NextResponse.json({revision:revision+1});
 }catch(error){await db.rollback();console.error('Unable to save testing database');return NextResponse.json({error:error instanceof Error&&!('code' in error)?error.message:'Не удалось сохранить данные. Проверьте связанные записи.'},{status:422});}finally{db.release();}
}
