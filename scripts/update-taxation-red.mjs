import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {database,readStore} from '../src/server/database.ts';
const patch=JSON.parse(await readFile('seed/taxation-red-update-report.json','utf8'));assert.equal(patch.changes.length,5);const db=await database().getConnection();
try{await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const before=await readStore(db);await mkdir('.local/backups',{recursive:true});await writeFile('.local/backups/before-taxation-red-'+Date.now()+'.json',JSON.stringify(before));
let updated=0;
for(const c of patch.changes){const [rows]=await db.execute('SELECT text,correct_option_id FROM app_questions WHERE id=?',[c.new.id]);assert.equal(rows.length,1);assert.ok(rows[0].text===c.old.text||rows[0].text===c.new.text,'Question changed manually; inspect before overwriting');
for(const o of c.new.options){const old=c.old.options.find(x=>x.id===o.id);const [options]=await db.execute('SELECT text FROM app_options WHERE id=? AND question_id=?',[o.id,c.new.id]);assert.equal(options.length,1);assert.ok(options[0].text===old.text||options[0].text===o.text);}
await db.execute('UPDATE app_questions SET text=?,correct_option_id=? WHERE id=?',[c.new.text,c.new.correctId,c.new.id]);for(const o of c.new.options)await db.execute('UPDATE app_options SET text=? WHERE id=?',[o.text,o.id]);updated++;}
await db.execute('UPDATE app_settings SET revision=revision+1 WHERE id=1');const after=await readStore(db);assert.deepEqual(after.data.attempts,before.data.attempts);for(const c of patch.changes)assert.deepEqual(after.data.tests.find(t=>t.id==='economy-taxation-3').variants[c.variant-1].questions[c.question-1],c.new);await db.commit();console.log('Updated '+updated+' questions; existing attempt snapshots unchanged');
}catch(e){await db.rollback();throw e;}finally{db.release();await database().end();}
