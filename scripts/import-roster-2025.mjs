import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { database } from '../src/server/database.ts';

const [file, mode, ...extra] = process.argv.slice(2);
assert.ok(file && !extra.length && ['--dry-run', '--apply'].includes(mode),
  'Укажите путь к ведомости и --dry-run или --apply.');

const groups = z.array(z.strictObject({
  name: z.string().trim().min(1).max(64),
  admissionYear: z.number().int().min(2000).max(2024),
  specialtyId: z.string().min(1).max(64),
  students: z.array(z.string().trim().min(1).max(255)).min(1),
})).min(1).parse(JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')));

const nameKey = name => name.normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('ru');
assert.equal(new Set(groups.map(group => nameKey(group.name))).size, groups.length, 'Повторное название группы');
for (const group of groups) {
  assert.ok(group.name.endsWith('/'+String(group.admissionYear).slice(-2)), 'Год набора не совпадает с названием группы');
  assert.equal(new Set(group.students.map(nameKey)).size, group.students.length, 'Повторяющиеся ФИО в группе');
}

const pool = database();
const db = await pool.getConnection();
try {
  await db.beginTransaction();
  const [settings] = await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');
  assert.equal(settings.length, 1, 'База приложения ещё не настроена');
  let changed = false;
  for (const group of groups) {
    const [specialties] = await db.execute('SELECT id FROM app_specialties WHERE id=?', [group.specialtyId]);
    assert.equal(specialties.length, 1, 'Специальность не найдена: '+group.specialtyId);
    const [existing] = await db.execute('SELECT id,specialty_id,admission_year,graduation_year FROM app_groups WHERE name=?', [group.name]);
    const current = existing[0];
    if (current) {
      assert.ok(current.specialty_id === group.specialtyId && current.admission_year === group.admissionYear &&
        current.graduation_year === 2025, 'Группа с таким названием относится к другому набору или специальности: '+group.name);
    }
    const id = current?.id ?? randomUUID();
    if (!current) {
      await db.execute('INSERT INTO app_groups(id,name,specialty_id,admission_year,graduation_year) VALUES(?,?,?,?,2025)',
        [id,group.name,group.specialtyId,group.admissionYear]);
      changed = true;
    }
    const [students] = await db.execute('SELECT name FROM app_students WHERE group_id=?', [id]);
    const known = new Set(students.map(student => nameKey(student.name)));
    const added = group.students.filter(name => !known.has(nameKey(name)));
    if (added.length) {
      await db.query('INSERT INTO app_students(id,group_id,name) VALUES ?',
        [added.map(name => [randomUUID(),id,name])]);
      changed = true;
    }
    console.log({group:group.name, added:added.length, skipped:group.students.length-added.length});
  }
  if (changed) await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');
  if (mode === '--apply') await db.commit();
  else await db.rollback();
  console.log(mode === '--apply' ? 'Импорт завершён' : 'Проверка прошла, транзакция отменена');
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}
