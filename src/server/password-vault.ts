import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

type Binding={id:string;passwordHash:string;passwordSalt:string};
function key(){const value=process.env.CREDENTIAL_ENCRYPTION_KEY;if(!value||!/^[a-f0-9]{64}$/i.test(value))throw Error('Не настроен ключ шифрования доступов');return Buffer.from(value,'hex');}
function context(user:Binding){return Buffer.from(JSON.stringify([user.id,user.passwordHash,user.passwordSalt]));}
export function sealPassword(password:string,user:Binding){
 const actual=pbkdf2Sync(password,Buffer.from(user.passwordSalt,'hex'),600000,32,'sha256');
 if(!timingSafeEqual(actual,Buffer.from(user.passwordHash,'hex')))throw Error('Пароль не соответствует учётной записи');
 const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(context(user));const encrypted=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);
 return ['v1',iv.toString('hex'),cipher.getAuthTag().toString('hex'),encrypted.toString('hex')].join(':');
}
export function openPassword(envelope:string,user:Binding){
 const [version,iv,tag,payload,...extra]=envelope.split(':');if(version!=='v1'||extra.length||!/^[a-f0-9]{24}$/.test(iv??'')||!/^[a-f0-9]{32}$/.test(tag??'')||!payload||!/^(?:[a-f0-9]{2})+$/.test(payload))throw Error('Повреждён зашифрованный доступ');
 const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'hex'));cipher.setAAD(context(user));cipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([cipher.update(Buffer.from(payload,'hex')),cipher.final()]).toString('utf8');
}
