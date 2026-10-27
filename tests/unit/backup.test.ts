import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { db } from '@/infrastructure/persistence/db';
import { exportBackup, parseBackup, restoreBackup, clearPersonalData } from '@/infrastructure/persistence/backup';
import { contentRepo } from '@/infrastructure/content/repository';
import template from '../../templates/matematicas.unit-package.json';
import { validateUnitPackage } from '@/domain/content/package-validator';
const now = new Date().toISOString();
const progress = { id: 's:u:l', subjectId: 's', unitId: 'u', lessonId: 'l', completed: true, readAt: now };
beforeEach(async () => { await clearPersonalData(); await db.importedPackages.clear(); });
afterEach(() => vi.restoreAllMocks());
it('round-trips progress, imported content and an exam with its answers', async () => {
  const pkg = validateUnitPackage(template).data!;
  await contentRepo.saveImportedPackage(pkg);
  await db.lessonProgress.put(progress);
  const q = pkg.questions[0];
  await db.sessions.put({ id: 'session', subjectId: pkg.subject.id, unitId: pkg.unit.id, mode: 'exam', status: 'in_progress', questionIds: [q.id], questionSnapshot: [q], answerSnapshot: pkg.answers.filter(a => a.question_id === q.id), answers: {}, startedAt: now, deadline: null });
  const backup = await exportBackup();
  await clearPersonalData();
  await db.importedPackages.clear();
  await restoreBackup(JSON.parse(JSON.stringify(backup)));
  expect(await db.lessonProgress.get(progress.id)).toEqual(progress);
  expect((await db.sessions.get('session'))?.questionSnapshot).toEqual([q]);
  expect((await contentRepo.getUnitPackage(pkg.subject.id, pkg.unit.id))?.questions).toEqual(pkg.questions);
});
it('accepts older v1 backups without sessions and preserves unrelated records', async () => {
  const { sessions: _, ...legacy } = await exportBackup();
  await db.lessonProgress.put(progress);
  await restoreBackup(legacy);
  expect(await db.lessonProgress.get(progress.id)).toEqual(progress);
});
it('rolls back the entire restore when a later table write fails', async () => {
  const backup = await exportBackup();
  backup.lessonProgress = [progress];
  vi.spyOn(db.reviewItems, 'bulkPut').mockRejectedValueOnce(new Error('quota'));
  await expect(restoreBackup(backup)).rejects.toThrow('quota');
  expect(await db.lessonProgress.count()).toBe(0);
});
it('rolls back clearing progress if any table cannot be cleared', async () => {
  await db.lessonProgress.put(progress);
  vi.spyOn(db.attempts, 'clear').mockRejectedValueOnce(new Error('quota'));
  await expect(clearPersonalData()).rejects.toThrow('quota');
  expect(await db.lessonProgress.get(progress.id)).toEqual(progress);
});
it('rejects invalid imported packages and duplicate record ids', async () => {
  const backup = await exportBackup();
  expect(() => parseBackup({ ...backup, lessonProgress: [progress, progress] })).toThrow('duplicados');
  expect(() => parseBackup({ ...backup, importedPackages: [{ id: 's:u', subjectId: 's', unitId: 'u', importedAt: now, pkg: {} }] })).toThrow('Paquete inválido');
});
it('refuses to downgrade installed content through backup restore', async () => {
  const pkg = validateUnitPackage(template).data!;
  await contentRepo.saveImportedPackage(pkg);
  const backup = await exportBackup();
  backup.lessonProgress = [progress];
  await contentRepo.saveImportedPackage({ ...pkg, unit: { ...pkg.unit, revision: pkg.unit.revision + 1 } });
  await expect(restoreBackup(backup)).rejects.toThrow('revisión anterior');
  expect(await db.lessonProgress.count()).toBe(0);
});
it('enforces the package byte limit for multibyte JSON', () => {
  const raw = 'ñ'.repeat(3 * 1024 * 1024);
  expect(validateUnitPackage(template, raw).valid).toBe(false);
});

it('serializes concurrent imports so an older revision cannot overwrite a newer one', async () => {
  const pkg = validateUnitPackage(template).data!;
  await contentRepo.saveImportedPackage(pkg);
  const results = await Promise.allSettled([
    contentRepo.saveImportedPackage({ ...pkg, unit: { ...pkg.unit, revision: 3 } }),
    contentRepo.saveImportedPackage({ ...pkg, unit: { ...pkg.unit, revision: 2 } }),
  ]);
  expect(results[0].status).toBe('fulfilled');
  expect(results[1].status).toBe('rejected');
  expect((await contentRepo.getUnit(pkg.subject.id, pkg.unit.id))?.revision).toBe(3);
});

it.each([
  { contentRevision: 'broken' },
  { contentRevision: 0 },
  { autogradedScore: -1 },
  { autogradedCount: 1.5 },
  { deadline: '2000-01-01T00:00:00.000Z' },
])('rejects invalid session metadata without writing progress: %j', async invalid => {
  const backup = await exportBackup();
  await expect(restoreBackup({ ...backup, lessonProgress: [progress], sessions: [{
    id: 'bad-session', subjectId: 's', unitId: 'u', mode: 'exam', status: 'in_progress',
    questionIds: ['q'], answers: {}, startedAt: now, ...invalid,
  }] })).rejects.toThrow('Respaldo inválido');
  expect(await db.lessonProgress.count()).toBe(0);
  expect(await db.sessions.count()).toBe(0);
});
