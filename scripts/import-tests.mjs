import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { database, readStore, writeStore, getStore } from '../src/server/database.ts';
import { validateStore } from '../src/server/validation.ts';
import { testError } from '../src/lib/model.ts';
const catalog=JSON.parse((await readFile('seed/catalog.json','utf8')).replace(/^\uFEFF/,''));
const entries=await Promise.all(catalog.map(async entry=>({...entry,test:JSON.parse(await readFile('seed/'+entry.file,'utf8'))})));
const db=await database().getConnection();const imported=[];
try{
 await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const current=await readStore(db);const data=structuredClone(current.data);
 for(const entry of entries){
  if(data.tests.some(t=>t.id===entry.test.id))continue;
  assert.ok(data.specialties.some(s=>s.id===entry.subject.specialtyId),'Specialty missing');
  let subject=data.subjects.find(s=>s.id===entry.subject.id);
  if(subject)assert.equal(subject.specialtyId,entry.subject.specialtyId);
  else {subject=data.subjects.find(s=>s.specialtyId===entry.subject.specialtyId&&s.name.trim().toLocaleLowerCase('ru')===entry.subject.name.toLocaleLowerCase('ru'));if(!subject){subject=entry.subject;data.subjects.push(subject);}}
  const test={...entry.test,subjectId:subject.id};
  assert.equal(test.variants.length,6);assert.ok(test.variants.every(v=>v.questions.length===20));assert.equal(testError(test,data),'');data.tests.push(test);imported.push(test);
 }
 if(imported.length){
  validateStore(data);await mkdir('.local/backups',{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');await writeFile(`.local/backups/before-test-import-${stamp}.json`,JSON.stringify(current,null,2),{flag:'wx'});
  await writeStore(db,data,current.revision+1);await db.commit();
 }else{await db.rollback();}
 const saved=await getStore();for(const test of imported)assert.deepEqual(saved.data.tests.find(t=>t.id===test.id),test);
 console.log(JSON.stringify({added:imported.map(t=>({name:t.name,variants:t.variants.length,questions:t.variants.flatMap(v=>v.questions).length})),totalTests:saved.data.tests.length,totalQuestions:saved.data.tests.flatMap(t=>t.variants.flatMap(v=>v.questions)).length,revision:saved.revision}));
}catch(error){await db.rollback();throw error;}finally{db.release();await database().end();}
