import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export async function migrateGraduationYears(db:PoolConnection){
 const [locks]=await db.query<RowDataPacket[]>("SELECT GET_LOCK('attest_graduation_years_migration',15) AS acquired");
 if(Number(locks[0].acquired)!==1)throw Error('Другой процесс обновляет структуру базы');
 try{
  const [tables]=await db.query<RowDataPacket[]>('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  if(tables.some(t=>t.name==='app_migrations')){const [applied]=await db.query<RowDataPacket[]>('SELECT id FROM app_migrations WHERE id=?',['2026-11-subject-groups']);if(applied.length)return false;}
  const backup:Record<string,unknown>={};
  for(const table of tables){if(/^app_[a-z_]+$/.test(table.name)){const [rows]=await db.query(`SELECT * FROM ${table.name}`);backup[table.name]=rows;}}
  if(tables.length){await mkdir('.local/backups',{recursive:true});await writeFile(`.local/backups/before-graduation-years-${Date.now()}.json`,JSON.stringify(backup),{flag:'wx',mode:0o600});}
  const schema=await readFile('scripts/schema.sql','utf8');for(const sql of schema.replace(/^\uFEFF/,'').split(';').map(s=>s.trim()).filter(Boolean))await db.query(sql);
  const [columns]=await db.query<RowDataPacket[]>("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app_groups' AND COLUMN_NAME='graduation_year'");
  if(!columns.length)await db.query('ALTER TABLE app_groups ADD COLUMN graduation_year SMALLINT NOT NULL DEFAULT 2026 AFTER admission_year');
  await db.beginTransaction();
  try{
   await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');
   await db.query('INSERT IGNORE INTO app_subject_assignments(subject_id,group_id) SELECT DISTINCT t.subject_id,a.group_id FROM app_assignments a JOIN app_tests t ON t.id=a.test_id JOIN app_subjects s ON s.id=t.subject_id JOIN app_groups g ON g.id=a.group_id WHERE s.specialty_id=g.specialty_id');
   // Keep legacy assignment rows compatible while subjects become the source of assignments
   await db.query('INSERT IGNORE INTO app_assignments(test_id,group_id) SELECT t.id,a.group_id FROM app_tests t JOIN app_subject_assignments a ON a.subject_id=t.subject_id');
   await db.execute('INSERT INTO app_migrations(id) VALUES(?)',['2026-11-subject-groups']);
   await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');await db.commit();
  }catch(error){await db.rollback();throw error;}
  return true;
 }finally{await db.query("SELECT RELEASE_LOCK('attest_graduation_years_migration')");}
}
