import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sealPassword,openPassword} from '../src/server/password-vault.ts';
import {passwordRecord} from '../src/lib/model.ts';
test('Зашифрованный пароль связан с пользователем, ключом и текущим хешем',async()=>{
 process.env.CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString('hex');const password='Test8abc';const user={id:'vault-test',...await passwordRecord(password)};
 const a=sealPassword(password,user),b=sealPassword(password,user);assert.notEqual(a,b);assert.ok(!a.includes(password));assert.equal(openPassword(a,user),password);
 assert.throws(()=>openPassword(a,{...user,id:'other'}));assert.throws(()=>openPassword(a,{...user,passwordHash:'0'.repeat(64)}));assert.throws(()=>openPassword(a.slice(0,-2)+'ff',user));assert.throws(()=>sealPassword('wrong-password',user));
 process.env.CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString('hex');assert.throws(()=>openPassword(a,user));delete process.env.CREDENTIAL_ENCRYPTION_KEY;assert.throws(()=>openPassword(a,user));
});
