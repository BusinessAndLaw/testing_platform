import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credentialsDocument } from '../src/lib/credentials-pdf.ts';
const record=(id,group)=>({name:`Студент ${id}`,login:`user${id}`,password:'Abcd1234',group});
test('PDF содержит две тройки столбцов, нечётный остаток и отдельные группы',()=>{
 const records=[record(1,'ИП4/23'),record(2,'ИП4/23'),record(3,'ИП4/23'),record(4,'Ф3А/24')];
 const doc=credentialsDocument(records);assert.equal(doc.pageOrientation,'landscape');assert.equal(doc.pageSize,'A4');assert.equal(doc.content.length,2);
 const first=doc.content[0];assert.equal(first.table.headerRows,2);assert.equal(first.table.dontBreakRows,true);assert.equal(first.table.body[0][0].text,'Группа ИП4/23');assert.deepEqual(first.table.body[1].map(c=>c.text),['ФИО','Логин','Пароль','ФИО','Логин','Пароль']);
 assert.deepEqual(first.table.body[2].map(c=>c.text),['Студент 1','user1','Abcd1234','Студент 2','user2','Abcd1234']);assert.deepEqual(first.table.body[3].map(c=>c.text),['Студент 3','user3','Abcd1234','','','']);assert.equal(doc.content[1].pageBreak,'before');assert.equal(records.length,4);
});
test('Администраторы не получают выдуманную группу, пустая выгрузка отклоняется',()=>{
 assert.equal(credentialsDocument([record(1,'')]).content[0].table.body[0][0].text,'Администраторы');assert.throws(()=>credentialsDocument([]),/Нет доступов/);
});
