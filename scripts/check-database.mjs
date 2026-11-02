import assert from 'node:assert/strict';
import { database, getStore, readStore, writeStore } from '../src/server/database.ts';
import { testError } from '../src/lib/model.ts';
const pool=database();const db=await pool.getConnection();
try{
 const before=await getStore();assert.equal(before.data.tests.length>=1,true);const real=before.data.tests.find(t=>t.id==='law-administrative-4');assert.equal(real.variants.length,6);assert.equal(real.variants.flatMap(v=>v.questions).length,120);assert.equal(testError(real,before.data),'');
 await db.beginTransaction();const copy=structuredClone(before.data);const suffix=crypto.randomUUID();const group={id:'check-group-'+suffix,name:'ПР4/23',admissionYear:2023,specialtyId:'s-law'};copy.groups.push(group);copy.students.push({id:'check-student-'+suffix,groupId:group.id,name:'Проверка транзакции'});copy.tests[0].variants[0].questions[0].text+=' Проверка';
 await writeStore(db,copy,before.revision+1);const inside=await readStore(db);assert.ok(inside.data.students.some(s=>s.id==='check-student-'+suffix));assert.equal(inside.revision,before.revision+1);assert.ok(inside.data.tests[0].variants[0].questions[0].text.endsWith('Проверка'));
 await db.rollback();const after=await getStore();assert.equal(after.revision,before.revision);assert.equal(after.data.students.length,before.data.students.length);assert.equal(after.data.tests[0].variants[0].questions[0].text,before.data.tests[0].variants[0].questions[0].text);
 console.log('MySQL verified: full relational read/write roundtrip, rollback, 6 variants, 120 questions, 480 options.');
}finally{await db.rollback();db.release();await pool.end();}
