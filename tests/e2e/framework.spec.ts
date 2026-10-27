import { test, expect, type Page } from './fixtures';
const base = '/#/subjects/fundamentos-matematicos/units/conceptos-basicos';
async function addExample(page: Page) {
  await page.goto('/#/content');
  await page.getByRole('button', { name: 'Añadir ejemplo de matemáticas' }).click();
  await expect(page.getByText('Paquete importado con éxito: Fundamentos matemáticos')).toBeVisible();
}
test('new question types can be answered and reviewed', async ({ page }) => {
  await addExample(page);
  await page.goto(`${base}/practice?type=matching`);
  await page.getByLabel('Relación para Unión', { exact: true }).selectOption('todos');
  await page.getByLabel('Relación para Intersección', { exact: true }).selectOption('comunes');
  await page.getByLabel('Relación para Diferencia A menos B').selectOption('solo-a');
  await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(page.getByText('¡Respuesta correcta! (Puntuación: 100%)')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solución correcta' })).toBeVisible();
  await page.goto(`${base}/practice?type=multiple_choice`);
  const boxes = page.locator('fieldset input[type=checkbox]');
  await boxes.nth(0).check(); await boxes.nth(2).check();
  await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(page.getByText('¡Respuesta correcta! (Puntuación: 100%)')).toBeVisible();
  await page.goto(`${base}/practice?type=ordering`);
  await page.getByRole('button', { name: 'Bajar elemento 1', exact: true }).click();
  await page.getByRole('button', { name: 'Bajar elemento 2', exact: true }).click();
  await page.getByRole('button', { name: 'Bajar elemento 3', exact: true }).click();
  await page.getByRole('button', { name: 'Subir elemento 3', exact: true }).click();
  await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(page.getByText('¡Respuesta correcta! (Puntuación: 100%)')).toBeVisible();
});
test('small subject exam survives reload and keeps submitted solutions', async ({ page }) => {
  await addExample(page);
  await page.goto(`${base}/exam`);
  await page.getByRole('button', { name: 'Iniciar Simulacro de Examen' }).click();
  await expect(page.getByRole('heading', { name: 'Simulacro (1/4)' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Simulacro (1/4)' })).toBeVisible();
  await page.getByRole('button', { name: 'Entregar examen', exact: true }).click();
  await page.getByRole('dialog', { name: '¿Entregar el simulacro?' }).getByRole('button', { name: 'Entregar simulacro' }).click();
  await expect(page.getByRole('heading', { name: 'Solución correcta', exact: true })).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Tu respuesta', exact: true })).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resultados del Simulacro' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solución correcta', exact: true })).toHaveCount(4);
});
test('light and dark layouts fit mobile and desktop routes', async ({ page }) => {
  await addExample(page);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('study_bank_theme', value), theme);
      await page.reload();
      for (const route of ['/#/', `${base}/practice?type=matching`, '/#/subjects/pruebas/units/guia/study', '/#/content']) {
        await page.goto(route);
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
});
