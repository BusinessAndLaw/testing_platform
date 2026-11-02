import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import { currentUser, sameOrigin } from '@/server/auth';
import { database } from '@/server/database';
import { openPassword, sealPassword } from '@/server/password-vault';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, private','Pragma':'no-cache'};
const bodySchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('seal'),id:z.string().min(1).max(64),password:z.string().min(8).max(128),passwordHash:z.string().regex(/^[a-f0-9]{64}$/),passwordSalt:z.string().regex(/^[a-f0-9]{32}$/)}).strict(),
 z.object({action:z.literal('export'),groupId:z.string().min(1).max(64)}).strict()
]);
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса'},{status:403,headers});
 try{
  if((await currentUser())?.role!=='admin')return NextResponse.json({error:'Требуется вход администратора'},{status:401,headers});
  const text=await request.text();if(Buffer.byteLength(text)>4096)return NextResponse.json({error:'Слишком большой запрос'},{status:413,headers});
  let body;try{body=bodySchema.parse(JSON.parse(text));}catch{return NextResponse.json({error:'Проверьте данные запроса'},{status:422,headers});}
  if(body.action==='seal')return NextResponse.json({envelope:sealPassword(body.password,body)},{headers});
  const [rows]=await database().execute<RowDataPacket[]>('SELECT u.id,u.login,s.name,g.name AS group_name,u.password_hash AS passwordHash,u.password_salt AS passwordSalt,p.envelope FROM app_users u JOIN app_students s ON s.id=u.student_id JOIN app_groups g ON g.id=s.group_id LEFT JOIN app_user_passwords p ON p.user_id=u.id AND p.password_hash=u.password_hash AND p.password_salt=u.password_salt WHERE u.role=\'student\' AND g.id=? ORDER BY s.name,u.login',[body.groupId]);
  if(!rows.length)return NextResponse.json({error:'В группе нет пользователей для выгрузки'},{status:422,headers});
  const missing=rows.filter(r=>!r.envelope).map(r=>({name:r.name,login:r.login}));
  if(missing.length)return NextResponse.json({error:'Для части пользователей исходный пароль не сохранён — сначала сбросьте им пароль',missing},{status:409,headers});
  return NextResponse.json({credentials:rows.map(r=>({name:r.name,login:r.login,group:r.group_name,password:openPassword(r.envelope,{id:r.id,passwordHash:r.passwordHash,passwordSalt:r.passwordSalt})}))},{headers});
 }catch{console.error('Unable to process credential request');return NextResponse.json({error:'Не удалось обработать доступы — проверьте подключение к базе и ключ шифрования'},{status:503,headers});}
}
