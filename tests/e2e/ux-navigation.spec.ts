import { test, expect } from './fixtures';
const base = '/#/subjects/pruebas/units/guia';
test('reading history, focus and continue use the student progress', async ({ page }) => {
  await page.goto(`${base}/study/tema-1`);
  await expect(page.locator('.study-article')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido principal' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Marcar como leído', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leído', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.topic-link').nth(1).click();
  await expect(page.locator('#active-lesson-heading')).toBeFocused();
  await expect(page.locator('.markdown-body h1')).toContainText('Operaciones con conjuntos');
  await page.goBack();
  await expect(page.locator('.markdown-body h1')).toContainText('Primeros pasos');
  await page.goForward();
  await expect(page.locator('.markdown-body h1')).toContainText('Operaciones con conjuntos');
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Continuar estudiando' }).click();
  await expect(page.locator('.markdown-body h1')).toContainText('Operaciones con conjuntos');
});
test('mobile groups retain unit context through tools and expose the full syllabus', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${base}/study`);
  await page.getByRole('button', { name: /Temario ·/ }).click();
  await expect(page.locator('.topic-link')).toHaveCount(10);
  await page.locator('.topic-link').nth(3).click();
  await expect(page.locator('#active-lesson-heading')).toBeFocused();
  await page.getByRole('button', { name: 'Explorar y herramientas' }).click();
  await page.getByRole('link', { name: 'Laboratorio', exact: true }).click();
  await expect(page.locator('.rail-context-mobile')).toContainText('Guía de prueba');
  await page.getByRole('button', { name: 'Explorar y herramientas' }).click();
  await page.getByRole('link', { name: 'Guía de estudio', exact: true }).click();
  await expect(page.locator('.study-article')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('guide and question headers fit both themes at mobile, tablet and desktop widths', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/#/');
    await page.evaluate(value => localStorage.setItem('study_bank_theme', value), theme);
    await page.reload();
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['study', 'practice?type=truth_table', 'practice?type=single_choice']) {
        await page.goto(`${base}/${route}`);
        await expect(page.locator(route === 'study' ? '.study-article' : '.question-header')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
});
