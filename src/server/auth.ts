import { createHash, randomBytes, pbkdf2 as pbkdf2Callback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import type { RowDataPacket } from 'mysql2/promise';
import { database } from './database.ts';
const pbkdf2=promisify(pbkdf2Callback);
export const cookieName='technikum_session';
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function passwordMatches(password:string,hash:string,salt:string){const actual=await pbkdf2(password,Buffer.from(salt,'hex'),600000,32,'sha256');return timingSafeEqual(actual,Buffer.from(hash,'hex'));}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&origin===(process.env.APP_URL??new URL(request.url).origin);}
export async function currentUser(){const token=(await cookies()).get(cookieName)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const [rows]=await database().execute<RowDataPacket[]>('SELECT u.id,u.name,u.role,u.login,u.student_id AS studentId FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP()',[tokenHash(token)]);return rows[0]??null;}
export const sessionToken=()=>randomBytes(32).toString('hex');
export const cookieOptions={httpOnly:true,sameSite:'strict' as const,secure:process.env.APP_URL?.startsWith('https://')??false,path:'/',maxAge:12*60*60};
