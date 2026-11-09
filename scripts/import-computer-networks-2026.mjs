import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { database } from '../src/server/database.ts';
import { defaultTestMinutes, testError } from '../src/lib/model.ts';

const sources = JSON.parse(await readFile(new URL('../seed/computer-networks-2026.json', import.meta.url), 'utf8'));
assert.deepEqual(sources.map(source => source.slug), ['networks']);
const availableGroups = [
  { id: 'g-is', name: 'ИС4/23', specialty: 's-web' },
  { id: 'g-ip', name: 'ИП4/23', specialty: 's-programmer' },
];
const flags = process.argv.slice(2);
assert.ok(flags.every(flag => ['--is', '--ip', '--dry-run', '--publish'].includes(flag)), 'Неизвестный параметр');
const targets = availableGroups.filter(group => flags.includes(group.id === 'g-is' ? '--is' : '--ip'));
assert.ok(targets.length, 'Укажите --is для ИС4/23 и/или --ip для ИП4/23');
const dryRun = flags.includes('--dry-run');
const pool = database();
const db = await pool.getConnection();
const imported = [];
try {
  await db.beginTransaction();
  const [settings] = await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');
  assert.equal(settings.length, 1, 'База приложения ещё не настроена');
  for (const group of targets) {
    const [groups] = await db.execute('SELECT id FROM app_groups WHERE id=? AND name=? AND specialty_id=? AND graduation_year=2026', [group.id, group.name, group.specialty]);
    assert.equal(groups.length, 1, 'Не найдена точная группа выпуска 2026: '+group.name);
    for (const source of sources) {
      const id = 'net26-'+group.id;
      const [existing] = await db.execute('SELECT id FROM app_tests WHERE id=?', [id]);
      if (existing.length) {
        console.log('Уже импортирован: '+group.name+' · '+source.name);
        continue;
      }
      const [subjects] = await db.execute('SELECT id FROM app_subjects WHERE specialty_id=? AND name=?', [group.specialty, source.name]);
      assert.ok(subjects.length <= 1, 'Найдено несколько одноимённых предметов: '+source.name);
      const subjectId = subjects[0]?.id ?? 'sub-'+id;
      if (subjects.length) {
        const [otherGroups] = await db.execute('SELECT group_id FROM app_subject_assignments WHERE subject_id=? AND group_id<>?', [subjectId, group.id]);
        const [otherTests] = await db.execute('SELECT id FROM app_tests WHERE subject_id=? AND published=1', [subjectId]);
        assert.ok(!otherGroups.length && !otherTests.length, 'Нужна проверка существующих назначений предмета: '+source.name);
      }
      assert.equal(source.variants.length, 3);
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
      const test = { id, name: source.name, subjectId, minutes: defaultTestMinutes, published: flags.includes('--publish'), groupIds: [group.id], variants };
      assert.equal(testError(test), '', source.name);
      if (!subjects.length) await db.execute('INSERT INTO app_subjects(id,specialty_id,name) VALUES(?,?,?)', [subjectId, group.specialty, source.name]);
      await db.execute('INSERT INTO app_tests(id,name,subject_id,minutes,published) VALUES(?,?,?,?,?)', [test.id, test.name, test.subjectId, test.minutes, test.published]);
      await db.query('INSERT INTO app_variants(id,test_id,name,position) VALUES ?', [variants.map((variant, i) => [variant.id, id, variant.name, i])]);
      await db.query('INSERT INTO app_questions(id,variant_id,text,correct_option_id,position) VALUES ?', [variants.flatMap(variant => variant.questions.map((question, i) => [question.id, variant.id, question.text, question.correctId, i]))]);
      await db.query('INSERT INTO app_options(id,question_id,text,position) VALUES ?', [variants.flatMap(variant => variant.questions.flatMap(question => question.options.map((option, i) => [option.id, question.id, option.text, i])))]);
      await db.execute('INSERT INTO app_subject_assignments(subject_id,group_id) VALUES(?,?) ON DUPLICATE KEY UPDATE group_id=app_subject_assignments.group_id', [subjectId, group.id]);
      await db.execute('INSERT INTO app_assignments(test_id,group_id) VALUES(?,?)', [id, group.id]);
      imported.push(group.name+' · '+source.name);
    }
  }
  if (imported.length) await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');
  if (dryRun) await db.rollback();
  else await db.commit();
  console.log(dryRun ? 'Проверка прошла, транзакция отменена' : 'Импорт завершён');
  for (const line of imported) console.log(line+' · 3 варианта по 20 вопросов');
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}
