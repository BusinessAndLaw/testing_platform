import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { RowDataPacket } from 'mysql2/promise';
import { database } from '@/server/database';
import { cookieName,cookieOptions,currentUser,passwordMatches,sameOrigin,sessionToken,tokenHash } from '@/server/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{const user=await currentUser();return NextResponse.json({user},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Не удалось подключиться к MySQL.'},{status:503});}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса.'},{status:403});
 let login:string,password:string;try{const text=await request.text();if(text.length>2000)throw Error();const body=JSON.parse(text);login=String(body.login??'').trim();password=String(body.password??'');if(!login||!password||login.length>64||password.length>256)throw Error();}catch{return NextResponse.json({error:'Введите логин и пароль.'},{status:400});}
 try{const db=database();const throttle=tokenHash(login.toLowerCase());
 await db.execute('INSERT INTO app_auth_throttle(id,count,window_start) VALUES(?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE count=IF(window_start<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,1,count+1),window_start=IF(window_start<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,UTC_TIMESTAMP(),window_start)',[throttle]);
 const [limits]=await db.execute<RowDataPacket[]>('SELECT count FROM app_auth_throttle WHERE id=?',[throttle]);if(limits[0].count>8)return NextResponse.json({error:'Слишком много попыток. Повторите вход через 15 минут.'},{status:429});
 const [users]=await db.execute<RowDataPacket[]>('SELECT * FROM app_users WHERE login=?',[login]);const user=users[0];const matched=await passwordMatches(password,user?.password_hash??'0'.repeat(64),user?.password_salt??'0'.repeat(32));if(!user||!matched)return NextResponse.json({error:'Неверный логин или пароль.'},{status:401});
 if(user.role==='student'&&!user.student_id)return NextResponse.json({error:'Учётная запись не привязана к студенту. Обратитесь к администратору.'},{status:403});
 const token=sessionToken();await db.execute('DELETE FROM app_sessions WHERE expires_at<=UTC_TIMESTAMP()');await db.execute('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(?,?,UTC_TIMESTAMP()+INTERVAL 12 HOUR)',[tokenHash(token),user.id]);await db.execute('DELETE FROM app_auth_throttle WHERE id=?',[throttle]);
 const response=NextResponse.json({user:{id:user.id,name:user.name,login:user.login,role:user.role,studentId:user.student_id}});response.cookies.set(cookieName,token,cookieOptions);return response;
 }catch{console.error('Unable to sign in');return NextResponse.json({error:'База данных недоступна. Проверьте запуск MySQL.'},{status:503});}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса.'},{status:403});const token=(await cookies()).get(cookieName)?.value;if(token)await database().execute('DELETE FROM app_sessions WHERE token_hash=?',[tokenHash(token)]);const response=NextResponse.json({ok:true});response.cookies.set(cookieName,'',{...cookieOptions,maxAge:0});return response;}
