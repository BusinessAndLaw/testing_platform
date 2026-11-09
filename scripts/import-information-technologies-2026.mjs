import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { database } from '../src/server/database.ts';
import { testError } from '../src/lib/model.ts';

const source = JSON.parse(await readFile(new URL('../seed/information-technologies-2026.json', import.meta.url), 'utf8'));
const flags = process.argv.slice(2);
assert.ok(flags.every(flag => flag.startsWith('--group=') || ['--dry-run', '--publish'].includes(flag)), 'Неизвестный параметр');
const names = [...new Set(flags.filter(flag => flag.startsWith('--group=')).map(flag => flag.slice(8).trim()))];
assert.ok(names.length && names.every(Boolean), 'Укажите точные названия групп через --group=Название');
const dryRun = flags.includes('--dry-run');
const pool = database();
const db = await pool.getConnection();
const imported = [];
try {
  await db.beginTransaction();
  const [settings] = await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');
  assert.equal(settings.length, 1, 'База приложения ещё не настроена');
  const [rows] = await db.query('SELECT id,name,specialty_id AS specialty FROM app_groups WHERE name IN (?)', [names]);
  assert.deepEqual(rows.map(row => row.name).sort(), [...names].sort(), 'Не найдены все указанные группы. Проверьте названия');
  const groupsBySpecialty = Map.groupBy(rows, row => row.specialty);
  for (const [specialty, groups] of groupsBySpecialty) {
      const groupIds = groups.map(group => group.id);
      const groupNames = groups.map(group => group.name).join(', ');
      const id = 'info-tech-26-'+specialty;
      const [existing] = await db.execute('SELECT id FROM app_tests WHERE id=?', [id]);
      if (existing.length) {
        console.log('Уже импортирован: '+groupNames+' · '+source.name);
        continue;
      }
      const [subjects] = await db.execute('SELECT id FROM app_subjects WHERE specialty_id=? AND name=?', [specialty, source.name]);
      assert.ok(subjects.length <= 1, 'Найдено несколько одноимённых предметов: '+source.name);
      const subjectId = subjects[0]?.id ?? 'sub-'+id;
      if (subjects.length) {
        const [otherGroups] = await db.query('SELECT group_id FROM app_subject_assignments WHERE subject_id=? AND group_id NOT IN (?)', [subjectId, groupIds]);
        const [otherTests] = await db.execute('SELECT id FROM app_tests WHERE subject_id=? AND published=1', [subjectId]);
        assert.ok(!otherGroups.length && !otherTests.length, 'Нужна проверка существующих назначений предмета: '+source.name);
      }
      assert.equal(source.variants.length, 6);
      const variants = source.variants.map((questions, v) => {
        assert.equal(questions.length, 20);
        const variantId = id+'-v'+(v+1);
        return { id: variantId, name: 'Вариант '+(v+1), questions: questions.map((question, q) => {
          const questionId = variantId+'-q'+(q+1);
          const correct = question.options[question.correct];
          assert.ok(correct, 'В таблице отсутствует ключ: '+questionId);
          const options = [...new Set(question.options)].map((value, i) => ({ id: questionId+'-o'+(i+1), text: value }));
          return { id: questionId, text: question.text, correctId: options.find(option => option.text === correct).id, options };
        }) };
      });
      const test = { id, name: source.name, subjectId, minutes: source.minutes, published: flags.includes('--publish'), groupIds, variants };
      assert.equal(testError(test), '', source.name);
      if (!subjects.length) await db.execute('INSERT INTO app_subjects(id,specialty_id,name) VALUES(?,?,?)', [subjectId, specialty, source.name]);
      await db.execute('INSERT INTO app_tests(id,name,subject_id,minutes,published) VALUES(?,?,?,?,?)', [test.id, test.name, test.subjectId, test.minutes, test.published]);
      await db.query('INSERT INTO app_variants(id,test_id,name,position) VALUES ?', [variants.map((variant, i) => [variant.id, id, variant.name, i])]);
      await db.query('INSERT INTO app_questions(id,variant_id,text,correct_option_id,position) VALUES ?', [variants.flatMap(variant => variant.questions.map((question, i) => [question.id, variant.id, question.text, question.correctId, i]))]);
      await db.query('INSERT INTO app_options(id,question_id,text,position) VALUES ?', [variants.flatMap(variant => variant.questions.flatMap(question => question.options.map((option, i) => [option.id, question.id, option.text, i])))]);
      for (const groupId of groupIds) {
        await db.execute('INSERT INTO app_subject_assignments(subject_id,group_id) VALUES(?,?) ON DUPLICATE KEY UPDATE group_id=app_subject_assignments.group_id', [subjectId, groupId]);
        await db.execute('INSERT INTO app_assignments(test_id,group_id) VALUES(?,?)', [id, groupId]);
      }
      imported.push(groupNames+' · '+source.name);
    }
  if (imported.length) await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');
  if (dryRun) await db.rollback();
  else await db.commit();
  console.log(dryRun ? 'Проверка прошла, транзакция отменена' : 'Импорт завершён');
  for (const line of imported) console.log(line+' · 6 вариантов по 20 вопросов');
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}
