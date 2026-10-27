import { z } from 'zod';
import { db } from './db';
import { contentRepo } from '@/infrastructure/content/repository';
import { validateUnitPackage } from '@/domain/content/package-validator';
import { QuestionSchema, AnswerSchema } from '@/domain/content/types';
import { questionRegistry } from '@/domain/content/question-registry';

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const id = z.string().min(1);
const date = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString());
const scope = { id, subjectId: id, unitId: id };
const assignment = z.record(id, z.boolean());
const response = z.discriminatedUnion('type', [
  z.object({ type: z.literal('single_choice'), selectedOptionId: z.string() }),
  z.object({ type: z.literal('multiple_choice'), selectedOptionIds: z.array(id) }),
  z.object({ type: z.literal('matching'), pairs: z.record(id, z.string()) }),
  z.object({ type: z.literal('ordering'), orderedIds: z.array(id) }),
  z.object({ type: z.literal('proposition_check'), isProposition: z.boolean() }),
  z.object({ type: z.literal('translation'), formula: z.string() }),
  z.object({ type: z.literal('truth_table'), cells: z.record(id, z.boolean().nullable()), classification: z.string().optional() }),
  z.object({ type: z.literal('equivalence'), equivalent: z.boolean(), counterexample: assignment.optional() }),
  z.object({ type: z.literal('sat'), satisfiable: z.boolean(), model: assignment.optional() }),
  z.object({ type: z.literal('entailment'), entailed: z.boolean(), counterexample: assignment.optional() }),
  z.object({ type: z.literal('short_answer'), studentText: z.string(), criteriaScores: z.record(z.string(), z.number().nonnegative()).optional() }),
]);
const bookmark = z.object({ ...scope, itemType: z.enum(['lesson', 'question']), itemId: id, createdAt: date }).passthrough()
  .refine(r => r.id === `${r.subjectId}:${r.unitId}:${r.itemType}:${r.itemId}`, 'Clave de favorito incoherente');
const progress = z.object({ ...scope, lessonId: id, completed: z.boolean(), readAt: date }).passthrough()
  .refine(r => r.id === `${r.subjectId}:${r.unitId}:${r.lessonId}`, 'Clave de lectura incoherente');
const attempt = z.object({ ...scope, questionId: id, contentRevision: z.number().int().positive(), type: id, submittedResponse: response, score: z.number().nonnegative(), maxScore: z.number().positive(), assisted: z.boolean(), submittedAt: date }).passthrough()
  .refine(r => r.score <= r.maxScore && r.type === r.submittedResponse.type, 'Intento incoherente');
const review = z.object({ ...scope, questionId: id, dueDate: date, intervalDays: z.number().int().nonnegative(), consecutiveUnassisted: z.number().int().nonnegative(), lastAttemptId: id.optional(), lastScore: z.number().nonnegative().optional(), updatedAt: date }).passthrough()
  .refine(r => r.id === `${r.subjectId}:${r.unitId}:${r.questionId}`, 'Clave de repaso incoherente');
const storedPackage = z.object({ ...scope, importedAt: date, pkg: z.unknown() });
const session = z.object({ ...scope, status: z.enum(['in_progress', 'submitted', 'abandoned']), mode: z.enum(['exam', 'practice']), questionIds: z.array(id).min(1), questionSnapshot: z.array(QuestionSchema).optional(), answerSnapshot: z.array(AnswerSchema).optional(), answers: z.record(id, response), startedAt: date, deadline: date.nullable().optional(), submittedAt: date.optional(),
  contentRevision: z.number().int().positive().optional(),
  autogradedScore: z.number().nonnegative().optional(),
  autogradedCount: z.number().int().nonnegative().optional(),
  selfAssessedScore: z.number().nonnegative().optional(),
  selfAssessedCount: z.number().int().nonnegative().optional(),
  unansweredCount: z.number().int().nonnegative().optional(),
  optionsOrder: z.record(id, z.array(id)).optional(),
}).passthrough().refine(row => !row.deadline || Date.parse(row.deadline) >= Date.parse(row.startedAt), 'La fecha límite no puede ser anterior al inicio');
const schema = z.object({ schema_version: z.literal(1), kind: z.literal('study-bank-backup'), exportedAt: date, bookmarks: z.array(bookmark), lessonProgress: z.array(progress), attempts: z.array(attempt), reviewItems: z.array(review), importedPackages: z.array(storedPackage), sessions: z.array(session).default([]) });

export function parseBackup(raw: unknown) {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Respaldo inválido en ${issue.path.join('.') || 'archivo'}: ${issue.message}`);
  }
  const data = result.data;
  for (const name of ['bookmarks', 'lessonProgress', 'attempts', 'reviewItems', 'importedPackages', 'sessions'] as const) {
    if (new Set(data[name].map(row => row.id)).size !== data[name].length) throw new Error(`IDs duplicados en ${name}.`);
  }
  const importedPackages = data.importedPackages.map(row => {
    const validation = validateUnitPackage(row.pkg, JSON.stringify(row.pkg));
    if (!validation.valid || !validation.data) throw new Error(`Paquete inválido en el respaldo: ${row.id}.`);
    const pkg = validation.data;
    if (row.subjectId !== pkg.subject.id || row.unitId !== pkg.unit.id || row.id !== `${pkg.subject.id}:${pkg.unit.id}`) throw new Error(`Identidad de paquete incoherente: ${row.id}.`);
    return { ...row, pkg };
  });
  for (const row of data.sessions) {
    if (new Set(row.questionIds).size !== row.questionIds.length || Object.keys(row.answers).some(key => !row.questionIds.includes(key))) throw new Error(`Preguntas incoherentes en sesión ${row.id}.`);
    if (Boolean(row.questionSnapshot) !== Boolean(row.answerSnapshot)) throw new Error(`Copia incompleta de sesión ${row.id}.`);
    if (row.questionSnapshot && row.answerSnapshot) {
      const qs = row.questionSnapshot;
      const as = row.answerSnapshot;
      if (qs.length !== row.questionIds.length || new Set(qs.map(q => q.id)).size !== qs.length || qs.some(q => !row.questionIds.includes(q.id)) || as.length !== qs.length || new Set(as.map(a => a.question_id)).size !== as.length) throw new Error(`Copia incoherente de sesión ${row.id}.`);
      for (const q of qs) {
        const a = as.find(a => a.question_id === q.id);
        if (q.subject_id !== row.subjectId || q.unit_id !== row.unitId || !questionRegistry[q.type].payload.safeParse(q.payload).success || !a || !questionRegistry[q.type].solution.safeParse(a.solution).success || (row.answers[q.id] && row.answers[q.id].type !== q.type)) throw new Error(`Ejercicio inválido en sesión ${row.id}.`);
      }
    }
  }
  return { ...data, importedPackages };
}

const personalTables = [db.bookmarks, db.lessonProgress, db.attempts, db.reviewItems, db.sessions];
export async function exportBackup() {
  return db.transaction('r', [...personalTables, db.importedPackages], async () => ({
    schema_version: 1 as const, kind: 'study-bank-backup' as const, exportedAt: new Date().toISOString(),
    bookmarks: await db.bookmarks.toArray(), lessonProgress: await db.lessonProgress.toArray(), attempts: await db.attempts.toArray(), reviewItems: await db.reviewItems.toArray(), sessions: await db.sessions.toArray(), importedPackages: await db.importedPackages.toArray(),
  }));
}
export async function restoreBackup(raw: unknown) {
  const data = parseBackup(raw);
  if (data.importedPackages.length) await contentRepo.prepareBundledContent();
  await db.transaction('rw', [...personalTables, db.importedPackages], async () => {
    for (const row of data.importedPackages) {
      const current = await contentRepo.getUnitPackage(row.subjectId, row.unitId);
      if (current && current.unit.revision > row.pkg.unit.revision) throw new Error(`El respaldo contiene una revisión anterior de ${row.pkg.unit.title}. No se modificó ningún dato.`);
    }
    const mergedSessions = new Map((await db.sessions.toArray()).map(row => [row.id, row]));
    for (const row of data.sessions) mergedSessions.set(row.id, row);
    const active = new Set<string>();
    for (const row of mergedSessions.values()) {
      if (row.status !== 'in_progress' || row.mode !== 'exam') continue;
      const key = `${row.subjectId}:${row.unitId}`;
      if (active.has(key)) throw new Error('Hay dos simulacros activos para la misma unidad. Entrega o abandona el actual antes de restaurar.');
      active.add(key);
    }
    await db.bookmarks.bulkPut(data.bookmarks);
    await db.lessonProgress.bulkPut(data.lessonProgress);
    await db.attempts.bulkPut(data.attempts);
    await db.reviewItems.bulkPut(data.reviewItems);
    await db.sessions.bulkPut(data.sessions);
    await db.importedPackages.bulkPut(data.importedPackages);
  });
}
export async function clearPersonalData() {
  await db.transaction('rw', personalTables, async () => {
    for (const table of personalTables) await table.clear();
  });
}
