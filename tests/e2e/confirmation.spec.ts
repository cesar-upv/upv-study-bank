import { test, expect } from './fixtures';

const exam = '/#/subjects/pruebas/units/simulacro/exam';
const guide = '/#/subjects/pruebas/units/razonamiento/study/tema-1';

test('submission uses an accessible modal, supports cancel and backdrop, and never opens native dialogs', async ({ page }) => {
  let nativeDialogs = 0;
  page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
  await page.goto(exam);
  await page.getByRole('checkbox', { name: /Activar temporizador/ }).uncheck();
  await page.getByRole('button', { name: 'Iniciar Simulacro de Examen' }).click();
  const trigger = page.getByRole('button', { name: 'Entregar examen', exact: true });
  await trigger.click();
  const modal = page.getByRole('dialog', { name: '¿Entregar el simulacro?' });
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute('aria-modal', 'true');
  await expect(modal).toContainText('15 preguntas sin responder');
  const cancel = modal.getByRole('button', { name: 'Seguir respondiendo' });
  const accept = modal.getByRole('button', { name: 'Entregar simulacro' });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(accept).toBeFocused();
  await page.keyboard.press('Tab'); await expect(cancel).toBeFocused();
  await page.screenshot({ path: 'test-results/screenshots/modal-submit-desktop.png' });
  await page.mouse.click(2, 2);
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole('radio').first().check();
  await trigger.click();
  await expect(modal).toContainText('14 preguntas sin responder');
  await accept.click();
  await expect(page.getByRole('heading', { name: 'Resultados del Simulacro' })).toBeVisible();
  await expect(page.locator('.answer-review')).toHaveCount(15);
  expect(nativeDialogs).toBe(0);
});

test('abandonment requires the danger modal, with safe Enter and Escape behavior', async ({ page }) => {
  await page.goto(exam);
  await page.getByRole('button', { name: 'Iniciar Simulacro de Examen' }).click();
  const trigger = page.getByRole('button', { name: 'Abandonar', exact: true });
  await trigger.click();
  const modal = page.getByRole('alertdialog', { name: '¿Abandonar el simulacro?' });
  await expect(modal.getByRole('button', { name: 'Seguir respondiendo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await trigger.click();
  await modal.getByRole('button', { name: 'Abandonar simulacro' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar Simulacro de Examen' })).toBeVisible();
});

test('reset cancellation preserves progress and explicit confirmation keeps the material', async ({ page }) => {
  await page.goto(guide);
  await page.getByRole('button', { name: 'Marcar como leído', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leído', exact: true })).toBeVisible();
  await page.goto('/#/backup');
  await page.getByRole('button', { name: 'Borrar mi progreso' }).click();
  const modal = page.getByRole('alertdialog', { name: '¿Borrar tu progreso?' });
  await expect(modal).toContainText('Las materias se conservarán');
  await modal.getByRole('button', { name: 'Conservar progreso' }).click();
  await page.goto(guide);
  await expect(page.getByRole('button', { name: 'Leído', exact: true })).toBeVisible();
  await page.goto('/#/backup');
  await page.getByRole('button', { name: 'Borrar mi progreso' }).click();
  await modal.getByRole('button', { name: 'Borrar progreso', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('reiniciadas');
  await page.goto(guide);
  await expect(page.getByRole('button', { name: 'Marcar como leído', exact: true })).toBeVisible();
});

test('expiry closes a pending destructive confirmation and submits the exam once', async ({ page }) => {
  await page.clock.install();
  await page.goto(exam);
  await page.getByRole('button', { name: 'Iniciar Simulacro de Examen' }).click();
  await page.getByRole('button', { name: 'Abandonar', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.clock.fastForward(46 * 60 * 1000);
  await expect(page.getByRole('heading', { name: 'Resultados del Simulacro' })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  const states = await page.evaluate(async () => {
    const path = '/src/infrastructure/persistence/db.ts';
    const { db } = await import(path);
    return (await db.sessions.toArray()).map((session: { status: string }) => session.status);
  });
  expect(states).toEqual(['submitted']);
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
});

test('confirmation panels follow every palette and fit desktop and mobile with readable contrast', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/#/backup');
  for (const palette of ['flexoki', 'zinc', 'catppuccin', 'academic']) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate(({ palette, theme }) => {
        localStorage.setItem('study_bank_palette', palette);
        localStorage.setItem('study_bank_theme', theme);
      }, { palette, theme });
      await page.reload();
      await page.getByRole('button', { name: 'Borrar mi progreso' }).click();
      const modal = page.getByRole('alertdialog', { name: '¿Borrar tu progreso?' });
      for (const width of [1440, 360]) {
        await page.setViewportSize({ width, height: 844 });
        const box = await modal.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(15);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15);
        expect(box!.y).toBeGreaterThanOrEqual(15);
        expect(box!.y + box!.height).toBeLessThanOrEqual(844 - 15);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await modal.locator('button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBe(true);
      }
      const ratios = await modal.evaluate(dialog => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        const rgba = (color: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
        const luminance = (color: string) => rgba(color).slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        const ratio = (text: string, background: string) => { const a = luminance(text), b = luminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
        const danger = getComputedStyle(dialog.querySelector('.btn-danger')!);
        const description = getComputedStyle(dialog.querySelector('.confirmation-dialog-description')!);
        return { danger: ratio(danger.color, danger.backgroundColor), body: ratio(description.color, getComputedStyle(dialog).backgroundColor), backdropAlpha: rgba(getComputedStyle(dialog, '::backdrop').backgroundColor)[3] / 255 };
      });
      expect(ratios.danger, `${palette} ${theme} danger`).toBeGreaterThanOrEqual(4.5);
      expect(ratios.body, `${palette} ${theme} body`).toBeGreaterThanOrEqual(4.5);
      expect(ratios.backdropAlpha).toBeGreaterThanOrEqual(.45);
      if (palette === 'zinc' && theme === 'dark') await page.screenshot({ path: 'test-results/screenshots/modal-reset-mobile-dark.png' });
      if (palette === 'flexoki' && theme === 'light') {
        await page.setViewportSize({ width: 1440, height: 844 });
        await page.screenshot({ path: 'test-results/screenshots/modal-reset-desktop-light.png' });
      }
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
    }
  }
});
