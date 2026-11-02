import { startStudentAttempt,StudentError } from '@/server/student';
import { smallBody,studentRequest } from '@/server/student-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){return studentRequest(request,async id=>{const body=await smallBody(request);if(typeof body.testId!=='string'||!body.testId||body.testId.length>64)throw new StudentError('Укажите тестирование.');return startStudentAttempt(id,body.testId);});}
