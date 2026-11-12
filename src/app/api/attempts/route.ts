import { NextResponse } from 'next/server';
import { currentUser,sameOrigin } from '@/server/auth';
import { database } from '@/server/database';
import type { RowDataPacket } from 'mysql2/promise';
import type { Attempt } from '@/lib/model';

export async function GET(request: Request) {
 const headers={'Cache-Control':'no-store'};
 try {
  const user=await currentUser();
  if(user?.role!=='admin')return NextResponse.json({error:'Доступ запрещён.'},{status:403,headers});
  const id=new URL(request.url).searchParams.get('id');
  if(!id||id.length>64)return NextResponse.json({error:'Укажите попытку.'},{status:400,headers});
  const [rows]=await database().execute<RowDataPacket[]>('SELECT payload FROM app_attempts WHERE id=?',[id]);
  if(!rows.length)return NextResponse.json({error:'Попытка не найдена.'},{status:404,headers});
  const payload=rows[0].payload;
  const attempt=(typeof payload==='string'?JSON.parse(payload):payload) as Attempt;
  return NextResponse.json({attempt},{headers});
 }catch{
  return NextResponse.json({error:'Не удалось загрузить ответы.'},{status:503,headers});
 }
}

export async function DELETE(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник.'},{status:403});
 if((await currentUser())?.role!=='admin')return NextResponse.json({error:'Требуется администратор.'},{status:401});
 let body;try{body=await request.json();if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>100000||body.ids.some((id:unknown)=>typeof id!=='string'||id.length>64))throw Error();}catch{return NextResponse.json({error:'Выберите попытки.'},{status:400});}
 const db=await database().getConnection();try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const [result]=await db.query<import('mysql2').ResultSetHeader>('DELETE FROM app_attempts WHERE id IN (?)',[body.ids]);await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');await db.commit();return NextResponse.json({deleted:result.affectedRows});}catch{await db.rollback();return NextResponse.json({error:'Не удалось удалить попытки.'},{status:503});}finally{db.release();}
}
