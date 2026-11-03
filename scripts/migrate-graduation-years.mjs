import {database} from '../src/server/database.ts';
import {migrateGraduationYears} from '../src/server/migrations.ts';
const db=await database().getConnection();
try{console.log(await migrateGraduationYears(db)?'Graduation years and subject assignments migrated; existing data preserved':'Migration already applied; no data changed');}
finally{db.release();await database().end();}
