import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { database,readStore } from '../src/server/database.ts';
import { defaultTestMinutes } from '../src/lib/model.ts';
const db=await database().getConnection();
try{
 await db.beginTransaction();await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');const before=await readStore(db);const changed=before.data.tests.filter(t=>t.minutes!==defaultTestMinutes);
 if(changed.length){await mkdir('.local/backups',{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');await writeFile(`.local/backups/before-duration-update-${stamp}.json`,JSON.stringify(before,null,2),{flag:'wx'});await db.execute('UPDATE app_tests SET minutes=? WHERE minutes<>?',[defaultTestMinutes,defaultTestMinutes]);await db.execute('UPDATE app_settings SET revision=revision+1 WHERE id=1');}
 const after=await readStore(db);assert.ok(after.data.tests.every(t=>t.minutes===20));assert.deepEqual(after.data.attempts,before.data.attempts);await db.commit();console.log(JSON.stringify({tests:after.data.tests.length,updated:changed.length,minutes:defaultTestMinutes,revision:after.revision}));
}catch(error){await db.rollback();throw error;}finally{db.release();await database().end();}
