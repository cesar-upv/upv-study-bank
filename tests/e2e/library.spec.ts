import { test, expect } from './fixtures';

const examTitle = 'Simulacro de razonamiento';
const examBase = '/#/subjects/pruebas/units/simulacro';
const guideTitle = 'Razonamiento y operaciones';
const guideBase = '/#/subjects/pruebas/units/razonamiento';

test('undo expires while hidden material and progress remain recoverable', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/');
  await page.getByRole('button', { name: `Ocultar ${guideTitle}`, exact: true }).click();
  const undo = page.getByRole('button', { name: 'Deshacer', exact: true });
  await expect(undo).toBeVisible();
  // The exact 8-second boundary is covered by unit tests; allow browser-clock drift here.
  await page.clock.fastForward(9000);
  await expect(undo).toHaveCount(0);
  await page.getByRole('button', { name: 'Ocultas 1', exact: true }).click();
  await expect(page.getByRole('article', { name: guideTitle, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Restaurar ${guideTitle}`, exact: true }).click();
  await undo.focus();
  await page.clock.fastForward(16000);
  await expect(undo).toBeFocused();
  await page.getByRole('searchbox').focus();
  await page.clock.fastForward(9000);
  await expect(undo).toHaveCount(0);
});

test('hidden units retain borders, rounded corners and spacing in every library layout', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: `Ocultar ${guideTitle}`, exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar Práctica complementaria', exact: true }).click();
  for (const mode of ['light', 'dark']) {
    await page.evaluate(value => localStorage.setItem('study_bank_theme', value), mode);
    await page.reload();
    await page.getByRole('button', { name: 'Ocultas 2', exact: true }).click();
    for (const width of [1440, 768, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const layout of ['Lista compacta', 'Cuadrícula']) {
        await page.getByRole('button', { name: layout, exact: true }).click();
        const rows = page.locator('.library-entry.is-hidden');
        await expect(rows).toHaveCount(2);
        for (const row of await rows.all()) {
          await expect(row).toHaveCSS('border-top-width', '1px');
          await expect(row).toHaveCSS('border-radius', '12px');
          await expect(row).toHaveCSS('padding', '20px');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `test-results/screenshots/hidden-${mode}-${width}-${layout === 'Cuadrícula' ? 'grid' : 'list'}.png`, fullPage: true });
      }
    }
  }
});

test('compact and grid views preserve hidden units, deep links and learning progress', async ({ page }) => {
  await page.goto(`${guideBase}/study/tema-1`);
  await page.getByRole('button', { name: 'Marcar como leído', exact: true }).click();
  await page.goto('/#/');
  await expect(page.getByRole('button', { name: 'Lista compacta' })).toHaveAttribute('aria-pressed', 'true');
  const guide = page.getByRole('article', { name: guideTitle, exact: true });
  await expect(guide).toContainText('1 de 8 lecciones leídas');
  const unitCount = await page.getByRole('article').count();
  await page.getByRole('button', { name: `Ocultar ${guideTitle}`, exact: true }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Visibles ${unitCount - 1}`, exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(guide).toBeVisible();
  await page.getByRole('button', { name: `Ocultar ${guideTitle}`, exact: true }).click();
  await page.reload();
  await expect(guide).toHaveCount(0);
  await page.goto(`${guideBase}/study/tema-1`);
  await expect(page.getByRole('button', { name: 'Leído', exact: true })).toBeVisible();
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Ocultas 1', exact: true }).click();
  await expect(guide).toContainText('1 de 8 lecciones leídas');
  await page.getByRole('button', { name: `Restaurar ${guideTitle}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No tienes unidades ocultas' })).toBeVisible();
  await page.getByRole('button', { name: `Visibles ${unitCount}`, exact: true }).click();
  await page.getByRole('button', { name: 'Cuadrícula', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cuadrícula' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Contenido', { exact: true }).selectOption('exam');
  await expect(page.getByRole('article')).toHaveCount(1);
  const exam = page.getByRole('article', { name: examTitle });
  await expect(exam.getByRole('progressbar')).toHaveCount(0);
  await expect(exam.getByRole('link', { name: 'Abrir guía' })).toHaveCount(0);
  await exam.getByRole('link', { name: 'Hacer simulacro' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar Simulacro de Examen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Guía de estudio', exact: true })).toHaveCount(0);
  await page.goto(`${examBase}/study`);
  await expect(page.getByRole('heading', { name: 'Esta unidad está dedicada a simulacros' })).toBeVisible();
  await page.goto(`${examBase}/practice`);
  await expect(page.locator('.question-header')).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver lección/ })).toHaveCount(0);
  await page.goto('/#/subjects/pruebas/units/no-existe');
  await expect(page.getByRole('heading', { name: 'Unidad no disponible' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a la biblioteca' })).toBeVisible();
});

test('library layouts fit narrow, tablet and desktop viewports in light and dark themes', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/#/');
  await expect(page.getByRole('article', { name: guideTitle, exact: true })).toBeVisible();
  const unitCount = await page.getByRole('article').count();
  for (const mode of ['light', 'dark']) {
    await page.evaluate(value => {
      localStorage.setItem('study_bank_theme', value);
      localStorage.setItem('study_bank_palette', value === 'light' ? 'flexoki' : 'zinc');
    }, mode);
    await page.reload();
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const layout of ['Lista compacta', 'Cuadrícula']) {
        await page.getByRole('button', { name: layout, exact: true }).click();
        await expect(page.getByRole('article')).toHaveCount(unitCount);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('.library-hide').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44 && button.getBoundingClientRect().width >= 44))).toBe(true);
        expect(await page.locator('.library-entry .btn-primary').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44 && button.getBoundingClientRect().height <= 80))).toBe(true);
        if ((width === 1440 && mode === 'light' && layout === 'Lista compacta') || (width === 360 && mode === 'light' && layout === 'Lista compacta') || (width === 1440 && mode === 'dark' && layout === 'Cuadrícula') || (width === 360 && mode === 'dark' && layout === 'Cuadrícula')) {
          await page.screenshot({ path: `test-results/screenshots/library-${width}-${mode}-${layout === 'Cuadrícula' ? 'grid' : 'list'}.png`, fullPage: true });
        }
      }
    }
  }
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(examBase);
  await expect(page.getByRole('link', { name: 'Preparar simulacro', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ruta de estudio' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/screenshots/library-exam-only-mobile.png', fullPage: true });
});

test('aligns action columns despite different primary labels, review counts and missing actions', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/#/');
  // Reproduce the user's mix of long CTAs, 7/101 pending reviews and exam-only content.
  await page.evaluate(async () => {
    const repositoryPath = '/src/infrastructure/content/repository.ts';
    const persistencePath = '/src/infrastructure/persistence/db.ts';
    const { contentRepo } = await import(repositoryPath);
    const { db } = await import(persistencePath);
    const now = new Date().toISOString();
    for (const [unitId, pendingCount, readCount] of [['complementaria', 7, 1], ['guia', 101, 4]] as const) {
      const pkg = await contentRepo.getUnitPackage('pruebas', unitId);
      const lessons = await contentRepo.getLessons('pruebas', unitId);
      await db.reviewItems.bulkPut(pkg.questions.slice(0, pendingCount).map((q: { id: string }) => ({
        id: `pruebas:${unitId}:${q.id}`, subjectId: 'pruebas', unitId, questionId: q.id,
        dueDate: new Date(0).toISOString(), intervalDays: 0, consecutiveUnassisted: 0, updatedAt: now,
      })));
      await db.lessonProgress.bulkPut(lessons.slice(0, readCount).map((lesson: { frontmatter: { id: string } }) => ({
        id: `pruebas:${unitId}:${lesson.frontmatter.id}`, subjectId: 'pruebas', unitId,
        lessonId: lesson.frontmatter.id, completed: true, readAt: now,
      })));
    }
  });
  await page.reload();
  await expect(page.getByRole('link', { name: '7 por repasar', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '101 por repasar', exact: true })).toBeVisible();
  for (const width of [1440, 1200, 1024, 768, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Lista compacta', exact: true }).click();
    const columns = await page.locator('.library-list .library-entry').evaluateAll(rows => rows.map(row => {
      const rect = (selector: string) => {
        const element = row.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.x, width: box.width, height: box.height };
      };
      return { primary: rect('.library-action-primary'), practice: rect('.library-action-practice'), exam: rect('.library-action-exam'), review: rect('.library-action-review'), visibility: rect('.library-hide'), metadata: rect('.library-meta-questions') };
    }));
    for (const column of ['primary', 'practice', 'exam', 'review', 'visibility'] as const) {
      const populated = columns.flatMap(row => row[column] ? [row[column]!] : []);
      for (const box of populated) {
        expect(Math.abs(box.x - populated[0].x), `${column} position at ${width}px`).toBeLessThan(1);
        expect(Math.abs(box.width - populated[0].width), `${column} width at ${width}px`).toBeLessThan(1);
        expect(Math.abs(box.height - populated[0].height), `${column} height at ${width}px`).toBeLessThan(1);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    for (const row of columns) {
      expect(Math.abs(row.metadata!.x - columns[0].metadata!.x), `metadata position at ${width}px`).toBeLessThan(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 360) await page.screenshot({ path: `test-results/screenshots/library-aligned-${width}-list.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Cuadrícula', exact: true }).click();
  const cards = await page.locator('.library-grid .library-entry').evaluateAll(rows => rows.map(row => {
    const box = row.getBoundingClientRect();
    const primary = row.querySelector('.library-action-primary')!.getBoundingClientRect();
    const hide = row.querySelector('.library-hide')!.getBoundingClientRect();
    return { row: box.top, primaryY: primary.y, hideY: hide.y, hideWidth: hide.width };
  }));
  for (const card of cards.filter(card => Math.abs(card.row - cards[0].row) < 1)) {
    expect(Math.abs(card.primaryY - cards[0].primaryY)).toBeLessThan(1);
    expect(Math.abs(card.hideY - cards[0].hideY)).toBeLessThan(1);
    expect(Math.abs(card.hideWidth - cards[0].hideWidth)).toBeLessThan(1);
  }
  await page.screenshot({ path: 'test-results/screenshots/library-aligned-1440-grid.png', fullPage: true });
});
