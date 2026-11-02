import { z } from 'zod';
import type { Store } from '../lib/model.ts';
import { testError } from '../lib/model.ts';
const id=z.string().min(1).max(64);const name=z.string().trim().min(1).max(255);const reference=z.string().max(64);
const option=z.object({id,text:z.string().max(20000)}).strict();
const question=z.object({id,text:z.string().max(20000),correctId:z.union([id,z.literal('')]),options:z.array(option).min(2).max(8)}).strict();
const variant=z.object({id,name:z.string().max(100),questions:z.array(question).max(500)}).strict();
const attempt=z.object({id,studentId:id,testId:id,testName:name,variantId:id,variantName:z.string().max(100),questions:z.array(question).max(500),startedAt:z.iso.datetime(),deadline:z.iso.datetime(),answers:z.record(z.string(),z.string()).optional(),answerRevision:z.number().int().min(0).optional(),completedAt:z.iso.datetime().nullable().optional(),score:z.number().int().min(0).nullable().optional(),grade:z.number().int().min(2).max(5).nullable().optional(),completionReason:z.enum(['timeout','submitted']).optional(),scale:z.object({three:z.number(),four:z.number(),five:z.number()})}).strict();
export const storeSchema=z.object({version:z.literal(3),nextUserNumber:z.number().int().min(1).max(2147483647),
 specialties:z.array(z.object({id,code:z.string().regex(/^\d{2}\.\d{2}\.\d{2}$/),name,qualification:z.string().min(1).max(512)}).strict()).max(1000),
 groups:z.array(z.object({id,name:z.string().min(1).max(64),admissionYear:z.number().int().min(2000).max(2100),specialtyId:id}).strict()).max(5000),
 students:z.array(z.object({id,name,groupId:id}).strict()).max(30000),subjects:z.array(z.object({id,name,specialtyId:id}).strict()).max(5000),
 users:z.array(z.object({id,name,login:z.string().regex(/^[a-zA-Z0-9_-]{3,64}$/),role:z.enum(['student','admin']),studentId:reference,passwordHash:z.string().regex(/^[a-f0-9]{64}$/),passwordSalt:z.string().regex(/^[a-f0-9]{32}$/),passwordEnvelope:z.string().max(1024).optional(),passwordAvailable:z.boolean().optional()}).strict()).max(30000),
 tests:z.array(z.object({id,name,subjectId:reference,minutes:z.number().int().min(1).max(240),published:z.boolean(),groupIds:z.array(id).max(5000),variants:z.array(variant).min(1).max(100)}).strict()).max(1000),
 attempts:z.array(attempt).max(100000),scale:z.object({three:z.number().int().min(0),four:z.number().int(),five:z.number().int().max(100)}).strict(),
}).strict();
export function validateStore(input:unknown):Store {
 const parsed=storeSchema.safeParse(input);if(!parsed.success)throw new Error('Проверьте заполнение полей: '+parsed.error.issues[0].path.join('.'));
 const d=parsed.data as Store;
 const unique=(values:string[],what:string)=>{if(new Set(values).size!==values.length)throw new Error(`Повторяющиеся ${what}.`);};
 for(const key of ['specialties','groups','students','subjects','users','tests','attempts'] as const)unique(d[key].map(x=>x.id),`идентификаторы ${key}`);
 unique(d.users.map(u=>u.login.toLowerCase()),'логины');unique(d.users.filter(u=>u.studentId).map(u=>u.studentId),'учётные записи студентов');unique(d.groups.map(g=>g.name.toLowerCase()),'названия групп');
 const has=(items:{id:string}[],value:string)=>items.some(i=>i.id===value);
 for(const g of d.groups)if(!has(d.specialties,g.specialtyId)||!g.name.endsWith('/'+String(g.admissionYear).slice(-2)))throw new Error('Проверьте специальность и год группы.');
 for(const s of d.students)if(!has(d.groups,s.groupId))throw new Error('Группа студента не найдена.');
 for(const s of d.subjects)if(!has(d.specialties,s.specialtyId))throw new Error('Специальность предмета не найдена.');
 if(!d.users.some(u=>u.role==='admin'))throw new Error('Должен остаться хотя бы один администратор.');
 for(const u of d.users)if(u.role==='student'?!has(d.students,u.studentId):!!u.studentId)throw new Error('Проверьте связь пользователя со студентом.');
 const allVariants=d.tests.flatMap(t=>t.variants);const allQuestions=allVariants.flatMap(v=>v.questions);unique(allVariants.map(v=>v.id),'идентификаторы вариантов');unique(allQuestions.map(q=>q.id),'идентификаторы вопросов');unique(allQuestions.flatMap(q=>q.options.map(o=>o.id)),'идентификаторы ответов');
 for(const t of d.tests){if(t.subjectId&&!has(d.subjects,t.subjectId))throw new Error('Предмет теста не найден.');if(t.groupIds.some(g=>!has(d.groups,g)))throw new Error('Группа назначения не найдена.');unique(t.groupIds,'назначения групп');if(t.published){const error=testError(t,d);if(error)throw new Error(error);}}
 for(const a of d.attempts)if(!has(d.students,a.studentId)||!has(d.tests,a.testId))throw new Error('Нельзя удалять студентов или тесты с попытками.');
 if(!(d.scale.three<d.scale.four&&d.scale.four<d.scale.five))throw new Error('Пороги оценок должны возрастать.');
 const maxIssued=Math.max(0,...d.users.map(u=>Number(/^user(\d+)$/.exec(u.login)?.[1]??0)));if(d.nextUserNumber<=maxIssued)throw new Error('Номер следующего логина уже использован.');
 return d;
}
