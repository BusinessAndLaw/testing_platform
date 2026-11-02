import { NextResponse } from 'next/server';
import { currentUser,sameOrigin } from '@/server/auth';
import { database } from '@/server/database';
export async function DELETE(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник.'},{status:403});
 if((await currentUser())?.role!=='admin')return NextResponse.json({error:'Требуется администратор.'},{status:401});
 let body;try{body=await request.json();if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>100000||body.ids.some((id:unknown)=>typeof id!=='string'||id.length>64))throw Error();}catch{return NextResponse.json({error:'Выберите попытки.'},{status:400});}
 const db=await database().getConnection();try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const [result]=await db.query<import('mysql2').ResultSetHeader>('DELETE FROM app_attempts WHERE id IN (?)',[body.ids]);await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');await db.commit();return NextResponse.json({deleted:result.affectedRows});}catch{await db.rollback();return NextResponse.json({error:'Не удалось удалить попытки.'},{status:503});}finally{db.release();}
}
