import { testError, uid } from './model.ts';
import type { Attempt, Store, Test } from './model.ts';

export function randomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > 0x100000000) throw new Error('Неверный размер выборки.');
  const limit = 0x100000000 - (0x100000000 % length);
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % length;
}

export function drawVariant(test: Test, pick = randomIndex) {
  if (!test.variants.length || test.variants.some(v => !v.questions.length)) throw new Error('Заполните вопросы всех вариантов.');
  const variant = test.variants[pick(test.variants.length)];
  const questions = structuredClone(variant.questions);
  for (let i = questions.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  return { variantId: variant.id, variantName: variant.name, questions };
}

// A transaction and an authenticated student identity are required when used on the server.
export function beginAttempt(store: Store, studentId: string, testId: string, now = new Date(), pick = randomIndex): { store: Store; attempt: Attempt } {
  const student = store.students.find(s => s.id === studentId);
  if (!student) throw new Error('Студент не найден.');
  const existing = store.attempts.find(a => a.studentId === studentId && a.testId === testId);
  if (existing) return { store, attempt: existing };
  const test = store.tests.find(t => t.id === testId);
  if (!test?.published || !test.groupIds.includes(student.groupId)) throw new Error('Тестирование недоступно студенту.');
  const error = testError(test, store);
  if (error) throw new Error(error);
  const drawn = drawVariant(test, pick);
  const attempt: Attempt = { id: uid(), studentId, testId, testName: test.name, ...drawn, startedAt: now.toISOString(), deadline: new Date(now.getTime() + test.minutes * 60000).toISOString(), answers: {}, answerRevision: 0, completedAt: null, score: null, grade: null, scale: { ...store.scale } };
  return { store: { ...store, attempts: [...store.attempts, attempt] }, attempt };
}

export function finishAttempt(attempt: Attempt, now = new Date()): Attempt {
  if (attempt.completedAt) return attempt;
  const score = attempt.questions.filter(q => (attempt.answers ?? {})[q.id] === q.correctId).length;
  const total = attempt.questions.length;
  if (!total) throw new Error('В попытке нет вопросов.');
  const grade = score * 100 >= attempt.scale.five * total ? 5 : score * 100 >= attempt.scale.four * total ? 4 : score * 100 >= attempt.scale.three * total ? 3 : 2;
  const expired = now.getTime() >= Date.parse(attempt.deadline);
  return { ...attempt, score, grade, completedAt: expired ? attempt.deadline : now.toISOString(), completionReason: expired ? 'timeout' : 'submitted', answerRevision: (attempt.answerRevision ?? 0) + 1 };
}

export function expireAttempt(attempt: Attempt, now = new Date()): Attempt {
  return !attempt.completedAt && now.getTime() >= Date.parse(attempt.deadline) ? finishAttempt(attempt, now) : attempt;
}

export function answerAttempt(attempt: Attempt, changes: Record<string, string>, now = new Date()): Attempt {
  if (attempt.completedAt || now.getTime() >= Date.parse(attempt.deadline)) throw new Error('Попытка уже завершена.');
  for (const [questionId, optionId] of Object.entries(changes)) {
    if (!attempt.questions.find(q => q.id === questionId)?.options.some(o => o.id === optionId)) throw new Error('Ответ не принадлежит вопросу этой попытки.');
  }
  if (Object.entries(changes).every(([key, value]) => attempt.answers?.[key] === value)) return attempt;
  return { ...attempt, answers: { ...attempt.answers, ...changes }, answerRevision: (attempt.answerRevision ?? 0) + 1 };
}

export type StudentAttemptView = {
  id: string; testName: string; startedAt: string; deadline: string; revision: number; status: 'active' | 'completed';
  questions: { id: string; text: string; options: { id: string; text: string }[] }[]; answers: Record<string,string>;
  result: { score: number; total: number; grade: number; completedAt: string; reason: 'timeout' | 'submitted' } | null;
};
export function studentAttempt(attempt: Attempt): StudentAttemptView {
  const completed = !!attempt.completedAt;
  return {
    id: attempt.id, testName: attempt.testName, startedAt: attempt.startedAt, deadline: attempt.deadline, revision: attempt.answerRevision ?? 0, status: completed ? 'completed' : 'active',
    questions: completed ? [] : attempt.questions.map(q => ({ id: q.id, text: q.text, options: q.options.map(o => ({ ...o })) })),
    answers: completed ? {} : { ...attempt.answers },
    result: completed ? { score: attempt.score ?? 0, total: attempt.questions.length, grade: attempt.grade ?? 2, completedAt: attempt.completedAt!, reason: attempt.completionReason ?? 'submitted' } : null,
  };
}
