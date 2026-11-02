import { accessStudentAttempt,StudentError } from '@/server/student';
import { smallBody,studentRequest } from '@/server/student-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return studentRequest(request,async student=>{const body=await smallBody(request);if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new StudentError('Обновите данные попытки.');return accessStudentAttempt(student,(await context.params).id,'finish',body.revision);});}
