import { database } from '../src/server/database.ts';

const [mode, ...extra] = process.argv.slice(2);
if (extra.length || !['--dry-run', '--apply'].includes(mode)) {
  throw new Error('Укажите --dry-run для подсчёта или --apply для удаления.');
}

const pool = database();
const db = await pool.getConnection();
try {
  await db.beginTransaction();
  await db.query('SELECT revision FROM app_settings WHERE id=1 FOR UPDATE');
  const [[{ accounts }]] = await db.query("SELECT COUNT(*) AS accounts FROM app_users WHERE role='student'");
  const [[{ attempts }]] = await db.query(
    "SELECT COUNT(*) AS attempts FROM app_attempts a JOIN app_users u ON u.student_id=a.student_id WHERE u.role='student'"
  );

  if (mode === '--dry-run') {
    await db.rollback();
    console.log({ accounts, attempts, applied: false });
  } else {
    await db.query("DELETE a FROM app_attempts a JOIN app_users u ON u.student_id=a.student_id WHERE u.role='student'");
    await db.query("DELETE h FROM app_auth_throttle h JOIN app_users u ON h.id=SHA2(CONCAT('login:',LOWER(u.login)),256) WHERE u.role='student'");
    await db.query("DELETE FROM app_users WHERE role='student'");
    if (Number(accounts) > 0) await db.query('UPDATE app_settings SET revision=revision+1 WHERE id=1');
    await db.commit();
    console.log({ accounts, attempts, applied: true });
  }
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}
