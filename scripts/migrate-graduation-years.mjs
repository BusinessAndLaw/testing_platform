import {database} from '../src/server/database.ts';
import {migrateGraduationYears} from '../src/server/migrations.ts';
const db=await database().getConnection();
try{
 const [columns]=await db.query("SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app_users' AND COLUMN_NAME='role'");
 const migrated=await migrateGraduationYears(db);
 const addAnalyst=columns.length&&!columns[0].type.includes("'analyst'");
 if(addAnalyst)await db.query("ALTER TABLE app_users MODIFY COLUMN role ENUM('student','admin','analyst') NOT NULL");
 console.log(migrated||addAnalyst?'Database schema updated; existing data preserved':'Database schema is up to date');}
finally{db.release();await database().end();}
