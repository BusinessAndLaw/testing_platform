import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStore } from '../src/server/validation.ts';
import { initialStore, testError } from '../src/lib/model.ts';
const imported=JSON.parse(readFileSync(new URL('../seed/administrative-law.json',import.meta.url),'utf8'));
const report=JSON.parse(readFileSync(new URL('../seed/import-report.json',import.meta.url),'utf8'));
function fixture(){return {...structuredClone(initialStore),subjects:[{id:'subject-law-administrative',name:'Административное право',specialtyId:'s-law'}],tests:[structuredClone(imported)],users:[{id:'admin',name:'Администратор',login:'user0000',role:'admin',studentId:'',passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32)}]};}
test('Импортирован реальный тест: 6 вариантов по 20 вопросов, все 120 ключей ссылаются на ответы',()=>{
 const s=fixture();assert.equal(imported.variants.length,6);for(const v of imported.variants){assert.equal(v.questions.length,20);for(const q of v.questions){assert.equal(q.options.length,4);assert.equal(q.options.filter(o=>o.id===q.correctId).length,1);}}
 assert.equal(testError(imported,s),'');assert.equal(imported.groupIds.length,7);assert.deepEqual(s.scale,report.scale);assert.equal(validateStore(s).tests[0].id,imported.id);
});
test('Сервер отклоняет дубли, битые ссылки, удаление последнего администратора и некорректную шкалу',()=>{
 const s=fixture();s.users=[];assert.throws(()=>validateStore(s),/администратор/);s.users=fixture().users;s.subjects[0].specialtyId='missing';assert.throws(()=>validateStore(s),/Специальность/);s.subjects=fixture().subjects;s.scale.three=95;assert.throws(()=>validateStore(s),/возрастать/);s.scale=fixture().scale;s.users.push({...s.users[0],id:'admin2'});assert.throws(()=>validateStore(s),/логины/);
});
test('Для 20 вопросов критерии точно соответствуют предоставленной таблице',()=>{
 const {three,four,five}=report.scale;const grade=n=>n*100>=five*20?5:n*100>=four*20?4:n*100>=three*20?3:2;
 assert.deepEqual(Array.from({length:21},(_,i)=>grade(i)),[2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,4,4,4,5,5,5]);
});
