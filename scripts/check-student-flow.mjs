import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { database,readStore,writeStore,getStore } from '../src/server/database.ts';
import { generatePassword,passwordRecord,cloneVariant } from '../src/lib/model.ts';
const base=process.env.APP_URL??'http://127.0.0.1:3000';const tag=crypto.randomUUID().slice(0,8),prefix=`student-check-${tag}`;const pool=database();const fixtures={subject:prefix+'-subject',groupA:prefix+'-ga',groupB:prefix+'-gb',studentA:prefix+'-sa',studentB:prefix+'-sb',userA:prefix+'-ua',userB:prefix+'-ub',analyst:prefix+'-analyst',testA:prefix+'-ta',testB:prefix+'-tb'};let adminCookie='',cookieA='',cookieB='',analystCookie='';
async function request(path,method='GET',body,cookie=''){const response=await fetch(base+path,{method,headers:{Origin:base,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json(),headers:response.headers};}
async function login(login,password){const r=await request('/api/session','POST',{login,password});assert.equal(r.status,200,'Login failed');return r.headers.get('set-cookie').split(';')[0];}
function cleanView(value){const text=JSON.stringify(value);for(const key of ['correctId','passwordHash','passwordSalt','variantId','variantName','scale'])assert.ok(!text.includes(`"${key}"`),'Private field in student response');}
try{
 const access=await readFile('.local/admin-access.txt','utf8');adminCookie=await login(/Логин: (.+)/.exec(access)[1].trim(),/Пароль: (.+)/.exec(access)[1].trim());
 const snapshot=(await request('/api/state','GET',undefined,adminCookie)).body;const data=structuredClone(snapshot.data);const passwordA=generatePassword(),passwordB=generatePassword();
 data.groups.push({id:fixtures.groupA,name:`ПР${tag}А/20`,admissionYear:2020,graduationYear:2024,specialtyId:'s-economy'},{id:fixtures.groupB,name:`ПР${tag}Б/21`,admissionYear:2021,graduationYear:2025,specialtyId:'s-economy'});data.students.push({id:fixtures.studentA,name:'Проверка кабинета А',groupId:fixtures.groupA},{id:fixtures.studentB,name:'Проверка кабинета Б',groupId:fixtures.groupB});
 data.users.push({id:fixtures.userA,name:'Проверка кабинета А',login:`check_${tag}_a`,role:'student',studentId:fixtures.studentA,...await passwordRecord(passwordA)},{id:fixtures.userB,name:'Проверка кабинета Б',login:`check_${tag}_b`,role:'student',studentId:fixtures.studentB,...await passwordRecord(passwordB)});
 const analystPassword=generatePassword();
 data.users.push({id:fixtures.analyst,name:'Проверка аналитика',login:`check_${tag}_analyst`,role:'analyst',studentId:'',...await passwordRecord(analystPassword)});
 const original=data.tests.find(t=>t.id==='economy-audit-3');assert.ok(original);
 data.subjects.push({id:fixtures.subject,name:'Проверка общего предмета '+tag,specialtyId:'s-economy',groupIds:[fixtures.groupA]});
 for(const id of [fixtures.testA,fixtures.testB])data.tests.push({id,name:'Проверка студенческого кабинета',subjectId:fixtures.subject,minutes:20,published:true,groupIds:[fixtures.groupA],variants:[cloneVariant(original.variants[0],'Первый'),cloneVariant(original.variants[1],'Второй')]});
 assert.equal((await request('/api/state','PUT',{data,revision:snapshot.revision},adminCookie)).status,200);
 const staleAdmin=(await request('/api/state','GET',undefined,adminCookie)).body;
 cookieA=await login(`check_${tag}_a`,passwordA);cookieB=await login(`check_${tag}_b`,passwordB);
 assert.equal((await request('/api/student')).status,401);assert.equal((await request('/api/state','GET',undefined,cookieA)).status,401);
 analystCookie=await login(`check_${tag}_analyst`,analystPassword);
 const home=await request('/api/student','GET',undefined,cookieA);assert.equal(home.status,200);assert.equal(home.body.tests.length,2);cleanView(home.body);
 assert.equal((await request('/api/student','GET',undefined,cookieB)).body.tests.length,0);
 assert.equal((await request('/api/student/attempts','POST',{testId:fixtures.testA},cookieB)).status,403);
 const starts=await Promise.all([request('/api/student/attempts','POST',{testId:fixtures.testA},cookieA),request('/api/student/attempts','POST',{testId:fixtures.testA},cookieA)]);for(const r of starts)assert.equal(r.status,200);const a=starts[0].body.attempt;assert.equal(a.id,starts[1].body.attempt.id);assert.deepEqual(a.questions.map(q=>q.id),starts[1].body.attempt.questions.map(q=>q.id));assert.equal(Date.parse(a.deadline)-Date.parse(a.startedAt),1200000);cleanView(starts[0].body);
 const path=`/api/student/attempts/${a.id}`;
 assert.equal((await request(path,'GET',undefined,cookieB)).status,404);
 assert.equal((await request(path,'PATCH',{revision:a.revision,answers:{unknown:'wrong'}},cookieA)).status,400);
 const privateAttempt=(await getStore()).data.attempts.find(x=>x.id===a.id);const answers=Object.fromEntries(privateAttempt.questions.slice(0,17).map(q=>[q.id,q.correctId]));
 const saved=await request(path,'PATCH',{revision:a.revision,answers},cookieA);assert.equal(saved.status,200);assert.equal(Object.keys(saved.body.attempt.answers).length,17);cleanView(saved.body);
 assert.equal((await request(path,'PATCH',{revision:0,answers},cookieA)).status,409);
 const resumed=(await request('/api/student/attempts','POST',{testId:fixtures.testA},cookieA)).body.attempt;assert.equal(resumed.id,a.id);assert.deepEqual(resumed.answers,answers);assert.deepEqual(resumed.questions.map(q=>q.id),a.questions.map(q=>q.id));
 const reviewPath='/api/attempts?id='+encodeURIComponent(a.id);
 const dashboard=await request('/api/state?view=dashboard','GET',undefined,adminCookie);
 assert.equal(dashboard.status,200);
 const summary=dashboard.body.data.attempts.find(attempt=>attempt.id===a.id);
 assert.equal(summary.questionCount,20);
 assert.deepEqual(summary.questions,[]);
 assert.equal(summary.answers,undefined);
 assert.deepEqual((await request(reviewPath,'GET',undefined,adminCookie)).body.attempt.answers,answers);
 assert.equal((await request(reviewPath,'GET',undefined,cookieA)).status,403);
 assert.equal((await request(reviewPath,'GET',undefined,analystCookie)).status,403);
 const analystState=await request('/api/state?view=dashboard','GET',undefined,analystCookie);
 assert.equal(analystState.status,200);
 assert.equal(analystState.body.data.groups.find(g=>g.id===fixtures.groupB).studentCount,1);
 assert.ok(!analystState.body.data.students.some(student=>student.id===fixtures.studentB));
 // Configuration saves from an older admin snapshot must never erase student answers.
 assert.equal((await request('/api/state','PUT',staleAdmin,adminCookie)).status,200);assert.deepEqual((await request(path,'GET',undefined,cookieA)).body.attempt.answers,answers);
 const finished=await request(path+'/finish','POST',{revision:saved.body.attempt.revision},cookieA);assert.equal(finished.status,200);assert.equal(finished.body.attempt.result.score,17);assert.equal(finished.body.attempt.result.grade,4);assert.deepEqual(finished.body.attempt.questions,[]);assert.deepEqual(finished.body.attempt.answers,{});cleanView(finished.body);
 assert.equal((await request(reviewPath,'GET',undefined,analystCookie)).status,200);
 const immutable=await request(path,'PATCH',{revision:finished.body.attempt.revision,answers:{[privateAttempt.questions[17].id]:privateAttempt.questions[17].correctId}},cookieA);assert.equal(immutable.body.attempt.result.score,17);
 const timeout=(await request('/api/student/attempts','POST',{testId:fixtures.testB},cookieA)).body.attempt;
 const db=await pool.getConnection();try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const state=await readStore(db);const expired=state.data.attempts.find(x=>x.id===timeout.id);expired.startedAt=new Date(Date.now()-21*60000).toISOString();expired.deadline=new Date(Date.now()-60000).toISOString();await db.execute('UPDATE app_attempts SET payload=? WHERE id=?',[JSON.stringify(expired),expired.id]);await db.commit();}finally{db.release();}
 const expiredSummary=await request('/api/state?view=dashboard','GET',undefined,adminCookie);
 assert.equal(expiredSummary.body.data.attempts.find(attempt=>attempt.id===timeout.id).completionReason,'timeout');
 const late=await request(`/api/student/attempts/${timeout.id}`,'PATCH',{revision:0,answers:{[timeout.questions[0].id]:timeout.questions[0].options[0].id}},cookieA);assert.equal(late.body.attempt.status,'completed');assert.equal(late.body.attempt.result.reason,'timeout');assert.equal(late.body.attempt.result.score,0);assert.equal(late.body.attempt.result.grade,2);
 const final=(await request('/api/student','GET',undefined,cookieA)).body;assert.ok(final.tests.every(t=>t.status==='completed'));cleanView(final);
 const crossYear=(await request('/api/state','GET',undefined,adminCookie)).body;crossYear.data.subjects.find(s=>s.id===fixtures.subject).groupIds.push(fixtures.groupB);
 assert.equal((await request('/api/state','PUT',crossYear,adminCookie)).status,200);
 assert.equal((await request('/api/student','GET',undefined,cookieB)).body.tests.length,2);
 const bStart=await request('/api/student/attempts','POST',{testId:fixtures.testA},cookieB);assert.equal(bStart.status,200);assert.notEqual(bStart.body.attempt.id,a.id);cleanView(bStart.body);
 const cohortAttempts=(await getStore()).data.attempts.filter(a=>a.testId===fixtures.testA);assert.deepEqual(new Set(cohortAttempts.map(a=>a.graduationYear)),new Set([2024,2025]));
 console.log('Student/MySQL flow passed: role isolation, assigned tests, concurrent start, fixed variant/order, autosave/resume, answer revisions, grade 4 for 17/20, timeout, late-answer rejection, immutable result, no answer-key disclosure, no lost attempts on admin save.');
}finally{
 const db=await pool.getConnection();try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const current=await readStore(db);const data=current.data;data.attempts=data.attempts.filter(a=>a.testId!==fixtures.testA&&a.testId!==fixtures.testB);data.tests=data.tests.filter(t=>t.id!==fixtures.testA&&t.id!==fixtures.testB);data.users=data.users.filter(u=>u.id!==fixtures.userA&&u.id!==fixtures.userB&&u.id!==fixtures.analyst);data.students=data.students.filter(s=>s.id!==fixtures.studentA&&s.id!==fixtures.studentB);data.subjects=data.subjects.filter(s=>s.id!==fixtures.subject);data.groups=data.groups.filter(g=>g.id!==fixtures.groupA&&g.id!==fixtures.groupB);await writeStore(db,data,current.revision+1);await db.commit();console.log('Temporary test records removed; existing tests and users preserved.');}catch(error){await db.rollback();throw error;}finally{db.release();}
 if(adminCookie)await request('/api/session','DELETE',undefined,adminCookie);await pool.end();
}
