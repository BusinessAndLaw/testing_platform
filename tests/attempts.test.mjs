import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialStore, parseStore, cloneVariant, testError } from '../src/lib/model.ts';
import { beginAttempt, drawVariant, studentAttempt, randomIndex } from '../src/lib/attempts.ts';
function fixture(){
 const store=structuredClone(initialStore);store.subjects=[{id:'s',name:'Алгоритмы',specialtyId:'s-programmer'}];store.students=[{id:'student',name:'Иванов',groupId:'g-ip'},{id:'other',name:'Петров',groupId:'g-is'}];
 const questions=Array.from({length:4},(_,i)=>({id:`q${i}`,text:`Вопрос ${i}`,options:[{id:`a${i}`,text:'Да'},{id:`b${i}`,text:'Нет'}],correctId:`a${i}`}));
 store.tests=[{...store.tests[0],subjectId:'s',groupIds:['g-ip'],published:true,variants:[{id:'v1',name:'Вариант 1',questions},{id:'v2',name:'Вариант 2',questions:questions.map(q=>({...structuredClone(q),id:`b-${q.id}`}))}]}];return store;
}
test('Случайная выдача выбирает каждый вариант и переставляет вопросы без потерь',()=>{
 const store=fixture();const before=structuredClone(store.tests[0]);
 const first=drawVariant(store.tests[0],()=>0);assert.equal(first.variantId,'v1');assert.notDeepEqual(first.questions.map(q=>q.id),before.variants[0].questions.map(q=>q.id));assert.deepEqual(new Set(first.questions.map(q=>q.id)),new Set(before.variants[0].questions.map(q=>q.id)));
 const second=drawVariant(store.tests[0],n=>n-1);assert.equal(second.variantId,'v2');assert.deepEqual(store.tests[0],before);for(const q of first.questions)assert.ok(q.options.some(o=>o.id===q.correctId));
});
test('Вариант, порядок, срок и вопросы остаются за попыткой после повторного входа и редактирования теста',()=>{
 const store=fixture();const original=structuredClone(store);const {store:saved,attempt}=beginAttempt(store,'student',store.tests[0].id,new Date('2026-10-27T10:00:00Z'),()=>0);assert.equal(attempt.deadline,'2026-10-27T10:20:00.000Z');assert.deepEqual(store,original);
 const restored=parseStore(JSON.stringify(saved));restored.tests[0].variants=[];restored.tests[0].minutes=1;restored.scale.three=5;
 const next=beginAttempt(restored,'student',store.tests[0].id,new Date('2026-10-28'),()=>{throw Error('Повторный розыгрыш запрещён');});assert.deepEqual(next.attempt,attempt);assert.equal(next.store.attempts.length,1);assert.equal(attempt.scale.three,60);
 const dto=studentAttempt(attempt);assert.ok(dto.questions.every(q=>!('correctId' in q)));assert.ok(!('scale' in dto));dto.questions[0].options[0].text='Изменено';assert.notEqual(attempt.questions[0].options[0].text,'Изменено');
});
test('Без назначения, публикации или студента начать попытку нельзя',()=>{
 const s=fixture();assert.throws(()=>beginAttempt(s,'missing',s.tests[0].id),/не найден/);assert.throws(()=>beginAttempt(s,'other',s.tests[0].id),/недоступно/);s.tests[0].published=false;assert.throws(()=>beginAttempt(s,'student',s.tests[0].id),/недоступно/);
});
test('Публикация проверяет каждый вариант и одинаковое число вопросов',()=>{
 const t=fixture().tests[0];t.variants[1].questions.pop();assert.match(testError(t),/количество/);t.variants[1].questions=[];assert.match(testError(t),/Вариант 2/);t.published=false;assert.equal(testError(t),'');t.variants[1].name='Вариант 1';assert.match(testError(t),/различаться/);
});
test('Копия варианта независима и сохраняет соответствие правильного ответа',()=>{
 const v=fixture().tests[0].variants[0];const copy=cloneVariant(v,'Копия');assert.notEqual(copy.id,v.id);for(let i=0;i<v.questions.length;i++){assert.notEqual(copy.questions[i].id,v.questions[i].id);assert.notEqual(copy.questions[i].options[0].id,v.questions[i].options[0].id);assert.equal(copy.questions[i].correctId,copy.questions[i].options[0].id);}
});
test('Обновление схемы 2 сохраняет предмет, публикацию и вопросы в первом варианте',()=>{
 const s=fixture();s.version=2;delete s.attempts;const questions=s.tests[0].variants[0].questions;s.tests[0].questions=questions;delete s.tests[0].variants;
 const migrated=parseStore(JSON.stringify(s));assert.equal(migrated.version,3);assert.equal(migrated.tests[0].published,true);assert.deepEqual(migrated.tests[0].variants[0].questions,questions);assert.equal(migrated.tests[0].subjectId,'s');
});
test('Границы случайного выбора соблюдаются, одна позиция разрешена',()=>{
 assert.equal(randomIndex(1),0);assert.throws(()=>randomIndex(0));assert.throws(()=>randomIndex(1.5));for(let i=0;i<100;i++){const n=randomIndex(7);assert.ok(Number.isInteger(n)&&n>=0&&n<7);}
});
