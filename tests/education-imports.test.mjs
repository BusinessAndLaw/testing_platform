import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { testError, initialStore, cloneVariant } from '../src/lib/model.ts';
import { validateStore } from '../src/server/validation.ts';
const load=file=>JSON.parse(readFileSync(new URL('../seed/'+file,import.meta.url),'utf8').replace(/^\uFEFF/,''));
for(const [stem,groups,missing] of [['primary-pedagogy',['g-primary-0','g-primary-1'],0],['preschool-pedagogy',['g-preschool'],0],['preschool-psychology',['g-preschool'],0]])test(`${stem}: 6 вариантов, 120 вопросов и точные ключи источника`,()=>{
 const t=load(stem+'.json'),report=load(stem+'-report.json');assert.equal(t.variants.length,6);assert.deepEqual(t.groupIds,groups);assert.equal(t.published,false);assert.equal(t.minutes,20);assert.equal(testError(t),'');let absent=0;
 for(const [vi,v] of t.variants.entries()){assert.equal(v.questions.length,20);for(const [qi,q] of v.questions.entries()){assert.equal(q.options.length,4);const entry=report.keys[vi*20+qi];if(!q.correctId){absent++;assert.equal(entry.method,'unconfirmed');assert.equal(entry.key,'');}else assert.equal(entry.optionLabels[q.options.findIndex(o=>o.id===q.correctId)],entry.key);}}
 assert.equal(absent,missing);
});
test('Неподтверждённый ответ сохраняется черновиком, публикация запрещена до выбора ключа',()=>{
 const t=load('preschool-pedagogy.json');t.variants[3].questions[13].correctId='';assert.equal(t.variants[3].questions[13].correctId,'');assert.equal(testError(t),'');t.published=true;assert.match(testError(t),/Вариант 4.*правильный ответ.*14/);t.variants[3].questions[13].correctId=t.variants[3].questions[13].options[0].id;assert.equal(testError(t),'');
 t.variants[3].questions[13].correctId='';const copy=cloneVariant(t.variants[3],'Копия');assert.equal(copy.questions[13].correctId,'');
});
test('Сервер сохраняет весь каталог с подтверждёнными ключами',()=>{
 const catalog=load('catalog.json');const d={...structuredClone(initialStore),subjects:catalog.map(e=>e.subject),tests:catalog.map(e=>load(e.file)),users:[{id:'admin',name:'Администратор',login:'user0000',role:'admin',studentId:'',passwordHash:'a'.repeat(64),passwordSalt:'b'.repeat(32)}]};assert.equal(validateStore(d).tests.length,9);const questions=d.tests.flatMap(t=>t.variants.flatMap(v=>v.questions));assert.equal(questions.length,1080);assert.equal(new Set(questions.map(q=>q.id)).size,1080);assert.equal(questions.filter(q=>!q.correctId).length,0);
});
