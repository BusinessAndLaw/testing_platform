import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {migrateGraduationYears} from '../src/server/migrations.ts';
const url=new URL(process.env.DATABASE_URL);const name='attest_migration_'+crypto.randomUUID().replaceAll('-','');assert.match(name,/^attest_migration_[a-f0-9]{32}$/);
const root=await mysql.createConnection({host:url.hostname,port:Number(url.port||3306),user:'root',password:process.env.MYSQL_ROOT_PASSWORD});let db;
try{
 await root.query(`CREATE DATABASE ${name} CHARACTER SET utf8mb4`);await root.query(`USE ${name}`);db=root;
 const sql=(await readFile('scripts/schema.sql','utf8')).replace('graduation_year SMALLINT NOT NULL DEFAULT 2026, ','');
 for(const statement of sql.split(';').map(s=>s.trim()).filter(s=>s&&!s.includes('CREATE TABLE IF NOT EXISTS app_subject_assignments')&&!s.includes('CREATE TABLE IF NOT EXISTS app_migrations')))await db.query(statement);
 await db.query("INSERT INTO app_specialties VALUES ('s','09.02.07','Программа','Программист')");await db.query("INSERT INTO app_groups VALUES ('g1','ИС-4/20',2020,'s'),('g2','ИС-4/21',2021,'s')");await db.query("INSERT INTO app_subjects VALUES ('subject','s','Алгоритмы')");await db.query("INSERT INTO app_tests VALUES ('t1','Тест 1','subject',20,1),('t2','Тест 2','subject',20,0)");await db.query("INSERT INTO app_assignments VALUES ('t1','g1'),('t2','g2')");await db.query("INSERT INTO app_settings VALUES (1,5,1,?)",[JSON.stringify({three:60,four:75,five:90})]);
 assert.equal(await migrateGraduationYears(db),true);const [groups]=await db.query('SELECT * FROM app_groups ORDER BY id');assert.equal(groups.length,2);assert.ok(groups.every(g=>g.graduation_year===2026));assert.deepEqual(groups.map(g=>g.admission_year),[2020,2021]);const [subjects]=await db.query('SELECT * FROM app_subject_assignments ORDER BY group_id');assert.deepEqual(subjects.map(s=>s.group_id),['g1','g2']);
 await db.query("UPDATE app_groups SET graduation_year=2024 WHERE id='g1'");await db.query("DELETE FROM app_subject_assignments WHERE group_id='g2'");assert.equal(await migrateGraduationYears(db),false);const [after]=await db.query("SELECT graduation_year FROM app_groups WHERE id='g1'");assert.equal(after[0].graduation_year,2024);const [assignments]=await db.query('SELECT * FROM app_subject_assignments');assert.equal(assignments.length,1);
 const [metadata]=await db.query('SELECT revision FROM app_settings');assert.equal(Number(metadata[0].revision),6);console.log('Legacy migration verified: group names and admission years preserved, subject assignments backfilled, rerun preserves subsequent edits');
}finally{await root.query('USE information_schema');await root.query(`DROP DATABASE IF EXISTS ${name}`);await root.end();}
