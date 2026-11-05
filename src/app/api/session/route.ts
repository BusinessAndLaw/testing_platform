import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { RowDataPacket } from 'mysql2/promise';
import { database } from '@/server/database';
import { cookieName,cookieOptions,currentUser,passwordMatches,sameOrigin,sessionToken,tokenHash } from '@/server/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{const user=await currentUser();return NextResponse.json({user},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Не удалось подключиться к MySQL.'},{status:503});}}
const attemptLimit = 5;
function throttled() {
 return NextResponse.json({error:'Сервер не отвечает. Попробуйте позже.'},{status:429,headers:{'Retry-After':'900','Cache-Control':'no-store'}});
}
async function reserveAttempt(id:string) {
 const db=await database().getConnection();
 try {
  await db.beginTransaction();
  await db.execute('INSERT INTO app_auth_throttle(id,count,window_start) VALUES(?,0,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id',[id]);
  const [rows]=await db.execute<RowDataPacket[]>('SELECT count, window_start, window_start <= UTC_TIMESTAMP()-INTERVAL 15 MINUTE AS expired FROM app_auth_throttle WHERE id=? FOR UPDATE',[id]);
  const row=rows[0];
  const count=Number(row.expired)?0:Number(row.count);
  if(count>=attemptLimit){await db.commit();return null;}
  await db.execute('UPDATE app_auth_throttle SET count=?,window_start=IF(?,UTC_TIMESTAMP(),window_start) WHERE id=?',[count+1,row.expired,id]);
  const [updated]=await db.execute<RowDataPacket[]>('SELECT window_start FROM app_auth_throttle WHERE id=?',[id]);
  await db.commit();
  return {count:count+1,windowStart:updated[0].window_start};
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса.'},{status:403});
 let login:string,password:string;try{const text=await request.text();if(text.length>2000)throw Error();const body=JSON.parse(text);login=String(body.login??'').trim();password=String(body.password??'');if(!login||!password||login.length>64||password.length>256)throw Error();}catch{return NextResponse.json({error:'Введите логин и пароль.'},{status:400});}
 try{
 const db=database();
 // Next.js listens on loopback; Nginx overwrites X-Real-IP with the peer address.
 const peer=request.headers.get('x-real-ip')?.trim()??'';
 const sourceKey=tokenHash('source:'+ (isIP(peer)?peer:'local'));
 const loginKey=tokenHash('login:'+login.toLowerCase());
 const source=await reserveAttempt(sourceKey);
 if(!source)return throttled();
 const account=await reserveAttempt(loginKey);
 if(!account)return throttled();
 const [users]=await db.execute<RowDataPacket[]>('SELECT * FROM app_users WHERE login=?',[login]);const user=users[0];const matched=await passwordMatches(password,user?.password_hash??'0'.repeat(64),user?.password_salt??'0'.repeat(32));if(!user||!matched){if(Math.max(source.count,account.count)>=attemptLimit)return throttled();return NextResponse.json({error:'Неверный логин или пароль.'},{status:401});}
 if(user.role==='student'&&!user.student_id)return NextResponse.json({error:'Учётная запись не привязана к студенту. Обратитесь к администратору.'},{status:403});
 const token=sessionToken();await db.execute('DELETE FROM app_sessions WHERE expires_at<=UTC_TIMESTAMP()');await db.execute('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(?,?,UTC_TIMESTAMP()+INTERVAL 12 HOUR)',[tokenHash(token),user.id]);await db.execute('UPDATE app_auth_throttle SET count=GREATEST(count-1,0) WHERE id=? AND window_start=?',[sourceKey,source.windowStart]);
 await db.execute('DELETE FROM app_auth_throttle WHERE id=? AND window_start=?',[loginKey,account.windowStart]);
 const response=NextResponse.json({user:{id:user.id,name:user.name,login:user.login,role:user.role,studentId:user.student_id}});response.cookies.set(cookieName,token,cookieOptions);return response;
 }catch{console.error('Unable to sign in');return NextResponse.json({error:'База данных недоступна. Проверьте запуск MySQL.'},{status:503});}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса.'},{status:403});const token=(await cookies()).get(cookieName)?.value;if(token)await database().execute('DELETE FROM app_sessions WHERE token_hash=?',[tokenHash(token)]);const response=NextResponse.json({ok:true});response.cookies.set(cookieName,'',{...cookieOptions,maxAge:0});return response;}
