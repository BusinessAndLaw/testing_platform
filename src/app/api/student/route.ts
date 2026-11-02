import { studentHome } from '@/server/student';
import { studentRequest } from '@/server/student-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){return studentRequest(request,id=>studentHome(id));}
