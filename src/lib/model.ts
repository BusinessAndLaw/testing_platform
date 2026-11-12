export type Specialty = { id: string; code: string; name: string; qualification: string };
export type Subject = { id: string; specialtyId: string; name: string; groupIds?: string[] };
export type User = { id: string; name: string; login: string; role: "student" | "admin" | "analyst"; studentId: string; passwordHash: string; passwordSalt: string; passwordEnvelope?: string; passwordAvailable?: boolean };
export type Group = { id: string; name: string; admissionYear: number; graduationYear?: number; specialtyId: string; studentCount?: number; completedCount?: number };
export type Student = { id: string; groupId: string; name: string };
export type Question = { id: string; text: string; options: { id: string; text: string }[]; correctId: string };
export type TestVariant = { id: string; name: string; questions: Question[] };
export type Attempt = { id: string; groupId?: string; groupName?: string; graduationYear?: number; studentId: string; testId: string; testName: string; variantId: string; variantName: string; questions: Question[]; questionCount?: number; startedAt: string; deadline: string; answers?: Record<string,string>; answerRevision?: number; completedAt?: string | null; score?: number | null; grade?: number | null; completionReason?: "timeout" | "submitted"; scale: Store["scale"] };
export type Test = { id: string; name: string; subjectId: string; minutes: number; published: boolean; groupIds: string[]; variants: TestVariant[] };
export type Store = { version: 3; attempts: Attempt[]; subjects: Subject[]; users: User[]; nextUserNumber: number; specialties: Specialty[]; groups: Group[]; students: Student[]; tests: Test[]; scale: { three: number; four: number; five: number } };
export const defaultGraduationYear = 2026;
export function graduationYear(group: Group) { return group.graduationYear ?? defaultGraduationYear; }
export function groupsForYear(store: Store, year: string) { return store.groups.filter(g=>year==='all'||graduationYear(g)===Number(year)); }
export function studentsForYear(store: Store, year: string) { const ids=new Set(groupsForYear(store,year).map(g=>g.id));return store.students.filter(s=>ids.has(s.groupId)); }
export function usersForYear(store: Store, year: string) { const ids=new Set(studentsForYear(store,year).map(s=>s.id));return store.users.filter(u=>u.role!=='student'||ids.has(u.studentId)); }
export function attemptGroupId(store: Store, attempt: Attempt) { return attempt.groupId??store.students.find(s=>s.id===attempt.studentId)?.groupId; }
export function attemptGraduationYear(store: Store, attempt: Attempt) { const group=store.groups.find(g=>g.id===attemptGroupId(store,attempt));return attempt.graduationYear??(group?graduationYear(group):undefined); }
export function attemptsForYear(store: Store, year: string) { return store.attempts.filter(a=>year==='all'||attemptGraduationYear(store,a)===Number(year)); }
export function subjectGroupIds(store: Store, subjectId: string): string[] {
  const subject = store.subjects.find(s=>s.id===subjectId);
  return subject?.groupIds ?? [...new Set(store.tests.filter(t=>t.subjectId===subjectId).flatMap(t=>t.groupIds))];
}
export function testGroupIds(store: Store, test: Test): string[] {
  return store.subjects.find(s=>s.id===test.subjectId)?.groupIds ?? test.groupIds;
}
export function normalizeAssignments(store: Store): Store {
  const subjects=store.subjects.map(s=>({...s,groupIds:subjectGroupIds(store,s.id)}));
  return {...store,groups:store.groups.map(g=>({...g,graduationYear:graduationYear(g)})),subjects,tests:store.tests.map(t=>({...t,groupIds:subjects.find(s=>s.id===t.subjectId)?.groupIds??t.groupIds}))};
}
export const defaultTestMinutes = 20;
export const storageKey = 'technikum-testing-data-v1';
export const uid = () => crypto.randomUUID();
export const specialtyLabel = (s: Specialty) => `${s.code} · ${s.name} · ${s.qualification}`;
export function newQuestion(): Question {
  const options = Array.from({ length: 4 }, () => ({ id: uid(), text: '' }));
  return { id: uid(), text: '', options, correctId: options[0].id };
}
export function newVariant(name = 'Вариант 1'): TestVariant { return { id: uid(), name, questions: [] }; }
export function cloneVariant(source: TestVariant, name: string): TestVariant {
  return { id: uid(), name, questions: source.questions.map(q => { const options = q.options.map(o => ({ ...o, id: uid() })); return { ...q, id: uid(), options, correctId: options[q.options.findIndex(o => o.id === q.correctId)]?.id ?? '' }; }) };
}
export function testError(test: Test, store?: Store) {
  if (!test.name.trim()) return 'Укажите название теста.';
  if (!Number.isInteger(test.minutes) || test.minutes < 1 || test.minutes > 240) return 'Продолжительность должна быть целым числом от 1 до 240 минут.';
  if (!test.variants.length) return 'Добавьте хотя бы один вариант тестирования.';
  if (test.variants.some(v => !v.name.trim())) return 'Укажите название каждого варианта.';
  if (new Set(test.variants.map(v => v.name.trim().toLocaleLowerCase('ru'))).size !== test.variants.length) return 'Названия вариантов должны различаться.';
  for (const variant of test.variants) {
  if (test.published && !variant.questions.length) return `Добавьте хотя бы один вопрос в «${variant.name}» перед публикацией.`;
  for (const [i, q] of variant.questions.entries()) {
    if (!q.text.trim()) return `«${variant.name}»: укажите текст вопроса ${i + 1}.`;
    if (q.options.length < 2 || q.options.some(o => !o.text.trim())) return `«${variant.name}»: заполните минимум два варианта в вопросе ${i + 1}.`;
    if (new Set(q.options.map(o => o.text.trim().toLocaleLowerCase('ru'))).size !== q.options.length) return `«${variant.name}»: в вопросе ${i + 1} есть одинаковые варианты.`;
    if ((test.published || q.correctId !== '') && !q.options.some(o => o.id === q.correctId)) return `«${variant.name}»: выберите правильный ответ в вопросе ${i + 1}.`;
  }
  }
  if (test.published && new Set(test.variants.map(v => v.questions.length)).size !== 1) return 'Перед публикацией количество вопросов во всех вариантах должно совпадать.';
  if (test.published && !store && !test.groupIds.length) return 'Назначьте хотя бы одну группу перед публикацией.';
  if (store) {
    const subject = store.subjects.find(s => s.id === test.subjectId);
    if (!subject) return 'Выберите предмет теста.';
    if (testGroupIds(store,test).some(id => !store.groups.some(g => g.id === id && g.specialtyId === subject.specialtyId))) return 'Назначать можно только группы специальности выбранного предмета.';
  }
  return '';
}
export const initialStore: Store = {
  version: 3, attempts: [], subjects: [], users: [], nextUserNumber: 1,
  specialties: [
    {id:'s-programmer',code:'09.02.07',name:'Информационные системы и программирование',qualification:'Программист'},
    {id:'s-web',code:'09.02.07',name:'Информационные системы и программирование',qualification:'Разработчик веб и мультимедийных приложений'},
    {id:'s-software',code:'09.02.11',name:'Разработка и управление программным обеспечением',qualification:'Программист'},
    {id:'s-support',code:'09.02.12',name:'Техническая эксплуатация и сопровождение информационных систем',qualification:'Специалист по технической эксплуатации и сопровождению информационных систем'},
    {id:'s-primary',code:'44.02.02',name:'Преподавание в начальных классах',qualification:'Учитель начальных классов'},
    {id:'s-preschool',code:'44.02.01',name:'Дошкольное образование',qualification:'Воспитатель детей дошкольного возраста'},
    {id:'s-economy',code:'38.02.01',name:'Экономика и бухгалтерский учет (по отраслям)',qualification:'Бухгалтер'},
    {id:'s-logistics',code:'38.02.03',name:'Операционная деятельность в логистике',qualification:'Операционный логист'},
    {id:'s-law',code:'40.02.02',name:'Правоохранительная деятельность',qualification:'Юрист'},
    {id:'s-pharmacy',code:'33.02.01',name:'Фармация',qualification:'Фармацевт'},
  ],
  groups: [
    {id:'g-ip',name:'ИП4/23',admissionYear:2023,graduationYear:2026,specialtyId:'s-programmer'},
    ...['А','Б','В','Г','Д','Е','Ж'].map((letter,i)=>({id:`g-pharmacy-${i}`,name:`Ф3${letter}/24`,admissionYear:2024,graduationYear:2026,specialtyId:'s-pharmacy'})),
    {id:'g-economy',name:'Э3/24',admissionYear:2024,graduationYear:2026,specialtyId:'s-economy'},
    {id:'g-is',name:'ИС4/23',admissionYear:2023,graduationYear:2026,specialtyId:'s-web'},
    ...['А','Б','В','Г','Д','Е','Ж'].map((letter,i)=>({id:`g-law-${i}`,name:`ПД4${letter}/23`,admissionYear:2023,graduationYear:2026,specialtyId:'s-law'})),
    {id:'g-preschool',name:'Д4/23',admissionYear:2023,graduationYear:2026,specialtyId:'s-preschool'},
    ...['А','Б'].map((letter,i)=>({id:`g-primary-${i}`,name:`Н4${letter}/23`,admissionYear:2023,graduationYear:2026,specialtyId:'s-primary'})),
  ],
  students: [],
  tests: Array.from({length:6},(_,i)=>({id:`test-${i+1}`,name:`Тестирование ${i+1}`,subjectId:'',minutes:defaultTestMinutes,published:false,groupIds:[],variants:[{id:`test-${i+1}-variant-1`,name:'Вариант 1',questions:[]}]})),
  scale: {three:60,four:75,five:90},
};
export function parseStore(value: string): Store {
  let data = JSON.parse(value);
  if (!data || ![1, 2, 3].includes(data.version) || !Array.isArray(data.specialties) || !Array.isArray(data.groups) || !Array.isArray(data.students) || !Array.isArray(data.tests) || !data.scale) throw new Error('Неверный формат сохранённых данных.');
  if (data.version === 1) data = { ...data, version: 2, subjects: [], users: [], nextUserNumber: 1, tests: data.tests.map((t: { id: string }) => ({ ...t, subjectId: '', published: false })) };
  if (!Array.isArray(data.subjects) || !Array.isArray(data.users) || !Number.isSafeInteger(data.nextUserNumber) || data.nextUserNumber < 1) throw new Error('Неверный формат сохранённых данных.');
  if (data.version === 2) data = { ...data, version: 3, attempts: [], tests: data.tests.map((t: Omit<Test, 'variants'> & { questions: Question[] }) => {
    if (!Array.isArray(t.questions)) throw new Error('Неверный формат вопросов.');
    const { questions, ...test } = t;
    return { ...test, variants: [{ id: `${t.id}-variant-1`, name: 'Вариант 1', questions }] };
  }) };
  if (!Array.isArray(data.attempts) || data.tests.some((t: Test) => !Array.isArray(t.variants) || t.variants.some(v => !Array.isArray(v.questions)))) throw new Error('Неверный формат вариантов.');
  return normalizeAssignments(data as Store);
}
export function nextLogin(store: Store): { login: string; nextUserNumber: number } {
  let number = store.nextUserNumber;
  while (store.users.some(u => u.login === `user${String(number).padStart(4, '0')}`)) number++;
  return { login: `user${String(number).padStart(4, '0')}`, nextUserNumber: number + 1 };
}
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const result: string[] = [];
  const limit = 256 - (256 % alphabet.length);
  while (result.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) if (byte < limit && result.length < 8) result.push(alphabet[byte % alphabet.length]);
  }
  return result.join('');
}
export async function passwordRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},key,256);
  const hex = (bytes: Uint8Array) => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return { passwordHash: hex(new Uint8Array(hash)), passwordSalt: hex(salt) };
}
