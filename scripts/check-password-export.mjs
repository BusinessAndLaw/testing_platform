import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {database} from '../src/server/database.ts';
import {passwordRecord} from '../src/lib/model.ts';
const pool=database();const base=process.env.APP_URL;const suffix=crypto.randomUUID();const groupId='vg-'+suffix,studentId='vs-'+suffix,userId='vu-'+suffix;const token=randomBytes(32).toString('hex'),studentToken=randomBytes(32).toString('hex');const hash=t=>createHash('sha256').update(t).digest('hex');
async function call(path,body,cookie=token,origin=base){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:'technikum_session='+cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,body:await r.json()};}
try{
 const [admins]=await pool.query("SELECT id FROM app_users WHERE role='admin' LIMIT 1");
 await pool.execute('INSERT INTO app_groups(id,name,admission_year,specialty_id) VALUES(?,?,2023,?)',[groupId,'V'+suffix.slice(0,8)+'/23','s-law']);
 await pool.execute('INSERT INTO app_students(id,group_id,name) VALUES(?,?,?)',[studentId,groupId,'Проверка выгрузки']);
 const record=await passwordRecord('Test8abc');
 await pool.execute("INSERT INTO app_users(id,name,login,role,student_id,password_hash,password_salt) VALUES(?,?,?,'student',?,?,?)",[userId,'Проверка выгрузки','vault-'+suffix,studentId,record.passwordHash,record.passwordSalt]);
 for(const [t,id] of [[token,admins[0].id],[studentToken,userId]])await pool.execute('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(?,?,UTC_TIMESTAMP()+INTERVAL 5 MINUTE)',[hash(t),id]);
 const payload={action:'export',groupId};
 assert.equal((await call('/api/user-passwords',payload,'')).status,401);assert.equal((await call('/api/user-passwords',payload,studentToken)).status,401);assert.equal((await call('/api/user-passwords',payload,token,'https://wrong.invalid')).status,403);
 const missing=await call('/api/user-passwords',payload);assert.equal(missing.status,409);assert.equal(missing.body.missing[0].login,'vault-'+suffix);
 const sealed=await call('/api/user-passwords',{action:'seal',id:userId,password:'Test8abc',...record});assert.equal(sealed.status,200);assert.ok(!sealed.body.envelope.includes('Test8abc'));
 const state=(await call('/api/state')).body;state.data.users.find(u=>u.id===userId).passwordEnvelope=sealed.body.envelope;
 const saved=await fetch(base+'/api/state',{method:'PUT',headers:{Origin:base,Cookie:'technikum_session='+token,'Content-Type':'application/json'},body:JSON.stringify(state)});assert.equal(saved.status,200);
 const exported=await call('/api/user-passwords',payload);assert.equal(exported.status,200);assert.match(exported.headers.get('cache-control'),/no-store/);assert.equal(exported.body.credentials[0].password,'Test8abc');
 const fresh=(await call('/api/state')).body;const user=fresh.data.users.find(u=>u.id===userId);assert.equal(user.passwordAvailable,true);assert.equal(user.passwordEnvelope,undefined);assert.ok(!JSON.stringify(fresh).includes('Test8abc'));
 const nextRecord=await passwordRecord('Next8abc');const nextSeal=await call('/api/user-passwords',{action:'seal',id:userId,password:'Next8abc',...nextRecord});Object.assign(user,nextRecord,{passwordEnvelope:nextSeal.body.envelope});
 const reset=await fetch(base+'/api/state',{method:'PUT',headers:{Origin:base,Cookie:'technikum_session='+token,'Content-Type':'application/json'},body:JSON.stringify(fresh)});assert.equal(reset.status,200);assert.equal((await call('/api/user-passwords',payload)).body.credentials[0].password,'Next8abc');
 console.log('Verified admin-only export, origin, missing passwords, encrypted persistence, no plaintext in state, password reset and no-store headers');
}finally{
 await pool.execute('DELETE FROM app_sessions WHERE token_hash IN (?,?)',[hash(token),hash(studentToken)]);await pool.execute('DELETE FROM app_users WHERE id=?',[userId]);await pool.execute('DELETE FROM app_students WHERE id=?',[studentId]);await pool.execute('DELETE FROM app_groups WHERE id=?',[groupId]);await pool.end();
}
