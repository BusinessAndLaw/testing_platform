import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { database } from '../src/server/database.ts';
import { defaultTestMinutes, testError } from '../src/lib/model.ts';

const source = JSON.parse(await readFile(new URL('../seed/bzh-f3-2026.json', import.meta.url), 'utf8'));
const id = 'bzh-f3-2026';
const names = Array.from('АБВГДЕЖ', letter => 'Ф3'+letter+'/24');
const dryRun = process.argv.includes('--dry-run');

assert.equal(source.variants.length, 6);
const variants = source.variants.map((questions, v) => {
  assert.equal(questions.length, 20);
  const variantId = id+'-v'+(v+1);
  return { id: variantId, name: 'Вариант '+(v+1), questions: questions.map((question, q) => {
    const questionId = variantId+'-q'+(q+1);
    const options = question.options.map((text, i) => ({ id: questionId+'-o'+(i+1), text }));
    if (question.correct === null) assert.deepEqual([v+1,q+1], [3,6]);
    else assert.ok(options[question.correct], 'Некорректный ключ: '+questionId);
    return { id: questionId, text: question.text, correctId: question.correct === null ? '' : options[question.correct].id, options };
  }) };
});
const pool = database();
const db = await pool.getConnection();
try {
  await db.beginTransaction();
  const [settings] = await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');
  assert.equal(settings.length, 1, 'База приложения ещё не настроена');
  const [existing] = await db.execute('SELECT id FROM app_tests WHERE id=?', [id]);
  if (existing.length) {
    await db.rollback();
    console.log('БЖ Ф3 уже импортирован');
  } else {
    const [groups] = await db.query("SELECT id,name FROM app_groups WHERE name IN (?) AND specialty_id='s-pharmacy' AND graduation_year=2026", [names]);
    assert.deepEqual(groups.map(group => group.name).sort(), [...names].sort(), 'Не найдены все группы Ф3/24 выпуска 2026');
    const groupIds = groups.map(group => group.id);
    const [subjects] = await db.execute("SELECT id FROM app_subjects WHERE specialty_id='s-pharmacy' AND name=?", [source.name]);
    assert.ok(subjects.length <= 1, 'Найдено несколько одноимённых предметов БЖ');
    const subjectId = subjects[0]?.id ?? 'sub-'+id;
    const test = { id, name: source.name, subjectId, minutes: defaultTestMinutes, published: false, groupIds, variants };
    assert.equal(testError(test), '');
    if (subjects.length) {
      const [otherTests] = await db.execute('SELECT id FROM app_tests WHERE subject_id=? AND published=1', [subjectId]);
      const [otherGroups] = await db.query('SELECT group_id FROM app_subject_assignments WHERE subject_id=? AND group_id NOT IN (?)', [subjectId,groupIds]);
      assert.ok(!otherTests.length && !otherGroups.length, 'Нужна проверка существующих назначений БЖ');
    } else {
      await db.execute("INSERT INTO app_subjects(id,specialty_id,name) VALUES(?,'s-pharmacy',?)", [subjectId, source.name]);
    }
    await db.execute('INSERT INTO app_tests(id,name,subject_id,minutes,published) VALUES(?,?,?,?,?)', [id, test.name, subjectId, test.minutes, test.published]);
    await db.query('INSERT INTO app_variants(id,test_id,name,position) VALUES ?', [variants.map((variant, i) => [variant.id, id, variant.name, i])]);
    await db.query('INSERT INTO app_questions(id,variant_id,text,correct_option_id,position) VALUES ?', [variants.flatMap(variant => variant.questions.map((question, i) => [question.id, variant.id, question.text, question.correctId, i]))]);
    await db.query('INSERT INTO app_options(id,question_id,text,position) VALUES ?', [variants.flatMap(variant => variant.questions.flatMap(question => question.options.map((option, i) => [option.id, question.id, option.text, i])))]);
    for (const groupId of groupIds) {
      await db.execute('INSERT INTO app_subject_assignments(subject_id,group_id) VALUES(?,?) ON DUPLICATE KEY UPDATE group_id=app_subject_assignments.group_id', [subjectId, groupId]);
      await db.execute('INSERT INTO app_assignments(test_id,group_id) VALUES(?,?)', [id, groupId]);
    }
    await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');
    if (dryRun) await db.rollback();
    else await db.commit();
    console.log(dryRun ? 'Проверка прошла, транзакция отменена' : 'Импорт завершён');
    console.log('БЖ · '+names.join(', ')+' · 6 вариантов по 20 вопросов · черновик');
    console.log('Перед публикацией проверьте ответ на вопрос 6 варианта 3');
  }
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}
