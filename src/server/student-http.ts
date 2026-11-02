import { NextResponse } from 'next/server';
import { currentUser, sameOrigin } from './auth.ts';
import { StudentError } from './student.ts';
export async function studentRequest(request:Request,action:(studentId:string)=>Promise<unknown>){
 if(request.method!=='GET'&&!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса.'},{status:403});
 try{const user=await currentUser();if(user?.role!=='student'||!user.studentId)return NextResponse.json({error:'Войдите под учётной записью студента.'},{status:401});return NextResponse.json(await action(user.studentId),{headers:{'Cache-Control':'no-store'}});}
 catch(error){if(error instanceof StudentError)return NextResponse.json({error:error.message,...(error.details as object??{})},{status:error.status});console.error('Student request failed');return NextResponse.json({error:'Не удалось связаться с сервером. Повторите попытку.'},{status:503});}
}
export async function smallBody(request:Request){try{const text=await request.text();if(text.length>80000)throw Error();return JSON.parse(text);}catch{throw new StudentError('Неверный формат запроса.');}}
