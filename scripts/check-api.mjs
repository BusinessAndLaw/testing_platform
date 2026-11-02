import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base=process.env.APP_URL??'http://127.0.0.1:3000';
const access=await readFile('.local/admin-access.txt','utf8');const login=/Логин: (.+)/.exec(access)[1].trim();const password=/Пароль: (.+)/.exec(access)[1].trim();
async function call(path,method='GET',body,cookie='',origin=true){const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:base}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,headers:response.headers,body:await response.json()};}
let cookie='';
try{
 assert.equal((await call('/api/state')).status,401);
 assert.equal((await call('/api/session','POST',{login,password:'wrong-password'})).status,401);
 const session=await call('/api/session','POST',{login,password});assert.equal(session.status,200);const setCookie=session.headers.get('set-cookie');assert.ok(/HttpOnly/i.test(setCookie));assert.ok(/SameSite=strict/i.test(setCookie));cookie=setCookie.split(';')[0];
 assert.equal((await call('/api/session','GET',null,cookie)).body.user.role,'admin');
 const before=await call('/api/state','GET',null,cookie);assert.equal(before.status,200);const state=before.body;const law=state.data.tests.find(t=>t.id==='law-administrative-4');assert.equal(law.variants.length,6);assert.equal(law.variants.flatMap(v=>v.questions).length,120);
 assert.equal((await call('/api/state','PUT',state,cookie,false)).status,403);
 const first=await call('/api/state','PUT',state,cookie);assert.equal(first.status,200);assert.equal(first.body.revision,state.revision+1);
 const stale=await call('/api/state','PUT',state,cookie);assert.equal(stale.status,409);
 const current=(await call('/api/state','GET',null,cookie)).body;const pendingTest=current.data.tests.find(t=>t.variants.some(v=>v.questions.some(q=>!q.correctId)));if(pendingTest){const unpublished=structuredClone(current);unpublished.data.tests.find(t=>t.id===pendingTest.id).published=true;const rejected=await call('/api/state','PUT',unpublished,cookie);assert.equal(rejected.status,422);assert.match(rejected.body.error,/правильный ответ/);}
 const broken=structuredClone(current);broken.data.students.push({id:'invalid-student',name:'Ошибка',groupId:'missing'});assert.equal((await call('/api/state','PUT',broken,cookie)).status,422);
 const noAdmin=structuredClone(current);noAdmin.data.users=[];assert.equal((await call('/api/state','PUT',noAdmin,cookie)).status,422);
 assert.equal((await call('/api/state','GET',null,cookie)).body.revision,current.revision);
 assert.equal((await call('/api/session','DELETE',null,cookie)).status,200);
 assert.equal((await call('/api/state','GET',null,cookie)).status,401);
 console.log('HTTP/MySQL verified: login, HttpOnly session, protected reads, transactional save, revision conflict, cross-origin rejection, invalid references rejected, logout.');
}finally{if(cookie)await call('/api/session','DELETE',null,cookie);}
