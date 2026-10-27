import { afterEach, expect, it, vi } from 'vitest';
import { ContentRepository } from '@/infrastructure/content/repository';
import { db } from '@/infrastructure/persistence/db';
import * as parser from '@/domain/content/parser';
import { validateUnitPackage } from '@/domain/content/package-validator';
import { libraryPackages, studyPackage } from '../fixtures/packages';

afterEach(async () => { vi.restoreAllMocks(); await db.importedPackages.clear(); });

it('validates all synthetic packages independently of private material', () => {
  for (const pkg of libraryPackages) expect(validateUnitPackage(pkg).errors).toEqual([]);
});

it('parses lessons only when reading and reuses them on subsequent visits', async () => {
  const repo = new ContentRepository();
  const parse = vi.spyOn(parser, 'parseLessonMarkdown');
  await repo.getAllPackages();
  await repo.getUnitPackage('pruebas', 'guia');
  expect(parse).not.toHaveBeenCalled();
  const first = await repo.getLessons('pruebas', 'guia');
  expect(parse).toHaveBeenCalledTimes(studyPackage.lessons.length);
  expect(await repo.getLessons('pruebas', 'guia')).toBe(first);
  expect(parse).toHaveBeenCalledTimes(studyPackage.lessons.length);
});

it('refreshes cached lessons after an update from another tab, including at the same revision', async () => {
  const repo = new ContentRepository();
  const first = await repo.getLessons('pruebas', 'guia');
  const pkg = structuredClone(studyPackage);
  pkg.lessons[0].markdown += '\nActualización de prueba.';
  await db.importedPackages.put({ id: 'pruebas:guia', subjectId: 'pruebas', unitId: 'guia', pkg, importedAt: new Date().toISOString() });
  const next = await repo.getLessons('pruebas', 'guia');
  expect(next).not.toBe(first);
  expect(next[0].content).toContain('Actualización de prueba.');
  expect(await repo.getLessons('pruebas', 'guia')).toBe(next);
  await repo.deleteImportedPackage('pruebas', 'guia');
  expect((await repo.getLessons('pruebas', 'guia'))[0].content).not.toContain('Actualización de prueba.');
});
