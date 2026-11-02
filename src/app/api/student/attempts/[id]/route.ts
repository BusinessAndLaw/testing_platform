import { accessStudentAttempt,StudentError } from '@/server/student';
import { smallBody,studentRequest } from '@/server/student-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){return studentRequest(request,async student=>accessStudentAttempt(student,(await context.params).id,'read'));}
export async function PATCH(request:Request,context:Context){return studentRequest(request,async student=>{const body=await smallBody(request);if(!Number.isSafeInteger(body.revision)||body.revision<0||!body.answers||Array.isArray(body.answers)||typeof body.answers!=='object'||Object.entries(body.answers).length>500||Object.entries(body.answers).some(([key,value])=>key.length>64||typeof value!=='string'||value.length>64))throw new StudentError('Проверьте отправленные ответы.');return accessStudentAttempt(student,(await context.params).id,'answer',body.revision,body.answers);});}
