import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialStore, testError } from '../src/lib/model.ts';
const load=name=>JSON.parse(readFileSync(new URL('../seed/'+name,import.meta.url),'utf8').replace(/^\uFEFF/,''));
for(const [file,specialty,groups,optionCounts] of [
 ['audit','s-economy',['g-economy'],{3:120}],['taxation','s-economy',['g-economy'],{3:120}],['criminalistics','s-law',Array.from({length:7},(_,i)=>`g-law-${i}`),{3:65,4:55}],
])test(`${file}: все шесть вариантов, авторские ключи и назначения`,()=>{
 const t=load(file+'.json'),report=load(file+'-report.json');assert.equal(t.variants.length,6);assert.deepEqual(t.groupIds,groups);assert.equal(t.published,false);assert.equal(report.keys.length,120);
 const s=structuredClone(initialStore);s.subjects=[{id:t.subjectId,name:t.name,specialtyId:specialty}];assert.equal(testError(t,s),'');
 const counts={};for(const [vi,v] of t.variants.entries()){assert.equal(v.questions.length,20);for(const [qi,q] of v.questions.entries()){const entry=report.keys[vi*20+qi];assert.equal(entry.variant,vi+1);assert.equal(entry.question,qi+1);assert.equal(entry.optionLabels[q.options.findIndex(o=>o.id===q.correctId)],entry.key);counts[q.options.length]=(counts[q.options.length]??0)+1;}}
 assert.deepEqual(counts,optionCounts);
});
test('Все вопросы и ответы четырёх реальных тестов имеют независимые идентификаторы',()=>{
 const tests=['administrative-law','audit','taxation','criminalistics'].map(f=>load(f+'.json'));const variants=tests.flatMap(t=>t.variants),questions=variants.flatMap(v=>v.questions),options=questions.flatMap(q=>q.options);assert.equal(questions.length,480);
 for(const items of [tests,variants,questions,options])assert.equal(new Set(items.map(i=>i.id)).size,items.length);
});
