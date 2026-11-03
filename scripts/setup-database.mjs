import { migrateGraduationYears } from '../src/server/migrations.ts';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initialStore, passwordRecord, generatePassword } from '../src/lib/model.ts';
import { database, readStore, writeStore } from '../src/server/database.ts';
import { validateStore } from '../src/server/validation.ts';
const db=await database().getConnection();
try{
 await migrateGraduationYears(db);
 const sql=await readFile(resolve('scripts/schema.sql'),'utf8');for(const statement of sql.replace(/^\uFEFF/,'').split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
 const [rows]=await db.query('SELECT id FROM app_settings WHERE id=1');
 if(rows.length){console.log('Database already initialized; no data replaced.');}
 else{
 const password=generatePassword();const record=await passwordRecord(password);const catalog=JSON.parse((await readFile('seed/catalog.json','utf8')).replace(/^\uFEFF/,''));const tests=await Promise.all(catalog.map(async entry=>JSON.parse(await readFile('seed/'+entry.file,'utf8'))));
 const store={...structuredClone(initialStore),nextUserNumber:1,subjects:catalog.map(entry=>entry.subject),tests,users:[{id:crypto.randomUUID(),name:'Администратор',login:'user0000',role:'admin',studentId:'',...record}],scale:{three:60,four:75,five:90}};
 validateStore(store);await mkdir('.local',{recursive:true});await writeFile('.local/admin-access.txt',`Первоначальный доступ администратора\nЛогин: user0000\nПароль: ${password}\n`,{flag:'wx'});
 await db.beginTransaction();await writeStore(db,store,1);await db.commit();console.log(`Database initialized: ${store.specialties.length} specialties, ${store.groups.length} groups, ${store.subjects.length} subjects, ${store.tests.length} tests, ${store.tests.flatMap(t=>t.variants.flatMap(v=>v.questions)).length} questions. Admin credentials saved in .local/admin-access.txt.`);
 }
}finally{db.release();await database().end();}
