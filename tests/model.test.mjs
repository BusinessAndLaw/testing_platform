import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialStore, newQuestion, parseStore, specialtyLabel, testError, nextLogin, generatePassword, passwordRecord } from '../src/lib/model.ts';
test('Справочник содержит все специальности и реальные группы без фиктивных студентов',()=>{
  assert.equal(initialStore.specialties.length,10);assert.equal(initialStore.groups.length,20);assert.equal(new Set(initialStore.groups.map(g=>g.name)).size,20);assert.equal(initialStore.students.length,0);
  const programs=initialStore.specialties.filter(s=>s.code==='09.02.07');assert.equal(programs.length,2);assert.notEqual(specialtyLabel(programs[0]),specialtyLabel(programs[1]));
  for(const g of initialStore.groups){assert.ok(initialStore.specialties.some(s=>s.id===g.specialtyId));assert.equal(Number(g.name.split('/')[1]),g.admissionYear%100);}
});
test('Вопрос получает отдельные идентификаторы и один правильный вариант',()=>{
  const a=newQuestion(),b=newQuestion();assert.notEqual(a.id,b.id);assert.equal(a.options.length,4);assert.equal(new Set(a.options.map(o=>o.id)).size,4);assert.equal(a.correctId,a.options[0].id);
});
test('Публикация требует вопросов, назначений и целого времени',()=>{
  const t=structuredClone(initialStore.tests[0]);assert.equal(testError(t),'');t.published=true;assert.match(testError(t),/вопрос/);t.variants[0].questions=[{id:'q',text:'Вопрос',options:[{id:'a',text:'Первый'},{id:'b',text:'Второй'}],correctId:'a'}];assert.match(testError(t),/групп/);t.groupIds=['g-ip'];assert.equal(testError(t),'');t.minutes=1.5;assert.match(testError(t),/целым/);
});
test('Пустые, повторяющиеся и отсутствующие правильные ответы отклоняются',()=>{
  const t=structuredClone(initialStore.tests[0]);const q=newQuestion();t.variants[0].questions=[q];assert.match(testError(t),/текст/);q.text='Вопрос';assert.match(testError(t),/вариант/);q.options=q.options.slice(0,2).map(o=>({...o,text:'Ответ'}));assert.match(testError(t),/одинаковые/);q.options[1].text='Другой';q.correctId='missing';assert.match(testError(t),/правильный/);
});
test('Справочник восстанавливается; неверный формат отклоняется',()=>{
  assert.deepEqual(parseStore(JSON.stringify(initialStore)),initialStore);assert.throws(()=>parseStore('{broken'));assert.throws(()=>parseStore('{}'));
});

test('Миграция сохраняет вопросы, студентов и назначения, оставляя тесты без выдуманных предметов',()=>{
 const legacy=structuredClone(initialStore);legacy.version=1;delete legacy.subjects;delete legacy.users;delete legacy.nextUserNumber;
 legacy.tests=legacy.tests.map(t=>{const {variants,...test}=t;return {...test,questions:variants[0].questions};});
 legacy.students=[{id:'student',name:'Иванов Иван',groupId:'g-ip'}];legacy.tests[0].published=true;legacy.tests[0].groupIds=['g-ip'];legacy.tests[0].questions=[newQuestion()];delete legacy.tests[0].variants;delete legacy.tests[0].subjectId;
 const migrated=parseStore(JSON.stringify(legacy));assert.equal(migrated.version,3);assert.deepEqual(migrated.students,legacy.students);assert.deepEqual(migrated.tests[0].variants[0].questions,legacy.tests[0].questions);assert.deepEqual(migrated.tests[0].groupIds,['g-ip']);assert.equal(migrated.tests[0].published,false);assert.equal(migrated.tests[0].subjectId,'');assert.deepEqual(migrated.subjects,[]);
});
test('Тест связан с предметом, назначения другой специальности запрещены',()=>{
 const store=structuredClone(initialStore);const test=store.tests[0];assert.match(testError(test,store),/предмет/);store.subjects=[{id:'subject',name:'Алгоритмы',specialtyId:'s-programmer'}];test.subjectId='subject';test.groupIds=['g-ip'];assert.equal(testError(test,store),'');test.groupIds=['g-is'];assert.match(testError(test,store),/специальности/);test.groupIds=['missing'];assert.match(testError(test,store),/специальности/);
});
test('Нумерация доступов не повторяет занятые или ранее выданные номера',()=>{
 const store=structuredClone(initialStore);store.users=[{login:'user0001'}];assert.deepEqual(nextLogin(store),{login:'user0002',nextUserNumber:3});store.nextUserNumber=10001;assert.equal(nextLogin(store).login,'user10001');store.nextUserNumber=3;store.users=[];assert.equal(nextLogin(store).login,'user0003');
});
test('Пароль содержит 8 символов, соль и хеш индивидуальны',async()=>{
 const passwords=Array.from({length:100},generatePassword);assert.equal(new Set(passwords).size,100);for(const p of passwords)assert.match(p,/^[A-Za-z2-9]{8}$/);
 const [a,b]=await Promise.all([passwordRecord(passwords[0]),passwordRecord(passwords[0])]);assert.equal(a.passwordHash.length,64);assert.equal(a.passwordSalt.length,32);assert.notEqual(a.passwordSalt,b.passwordSalt);assert.notEqual(a.passwordHash,b.passwordHash);assert.ok(!JSON.stringify(a).includes(passwords[0]));
});
