import { NextResponse } from 'next/server';
import { currentUser, sameOrigin } from '@/server/auth';
import { database, getStore, readStore, writeStore } from '@/server/database';
import { settleExpiredAttempts } from '@/server/student';
import { validateStore } from '@/server/validation';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await currentUser();if(user?.role!=='admin'&&user?.role!=='analyst')return NextResponse.json({error:'Требуется вход администратора.'},{status:401});await settleExpiredAttempts();const state=await getStore(new URL(request.url).searchParams.get('view')==='dashboard');
if(user.role==='analyst'){
const groupCounts=new Map<string,number>();
for(const student of state.data.students)groupCounts.set(student.groupId,(groupCounts.get(student.groupId)??0)+1);
const attempted=new Set(state.data.attempts.map(attempt=>attempt.studentId));
state.data.groups=state.data.groups.map(group=>({...group,studentCount:groupCounts.get(group.id)??0}));
state.data.students=state.data.students.filter(student=>attempted.has(student.id));
state.data.users=[];state.data.tests=state.data.tests.map(t=>({...t,variants:[]}));state.data.attempts=state.data.attempts.map(a=>a.completedAt?a:{...a,questions:[],answers:{}});}
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
