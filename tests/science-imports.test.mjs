import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { testError } from '../src/lib/model.ts';
const read=name=>JSON.parse(readFileSync(new URL('../seed/'+name+'.json',import.meta.url),'utf8'));
for(const name of ['organic-chemistry','teacher-math'])test(`${name}: 6 отдельных вариантов, 120 ключей и время 20 минут`,()=>{const t=read(name),report=read(name+'-report');assert.equal(t.variants.length,6);assert.equal(t.minutes,20);assert.equal(t.published,false);assert.equal(report.keys.length,120);assert.equal(testError(t),'');for(const [vi,v] of t.variants.entries()){assert.equal(v.questions.length,20);for(const [qi,q] of v.questions.entries()){assert.equal(q.options.length,4);const key=report.keys[vi*20+qi];assert.equal(key.variant,vi+1);assert.equal(key.question,qi+1);assert.equal(key.optionLabels[q.options.findIndex(o=>o.id===q.correctId)],key.key);}}});
