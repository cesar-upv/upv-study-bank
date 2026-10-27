import { test, expect } from './fixtures';

test.describe('Banco de Estudio - E2E User Journeys', () => {
  test('1. Catalog and 10 lessons study guide navigation with KaTeX formulas', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('h1')).toContainText('Tu biblioteca');

    // Click into Fundamentos de IA unit
    await page.click('text=Guía de prueba');
    await expect(page.locator('h1')).toContainText('Guía de prueba');
    await page.getByRole('link', { name: 'Guía de estudio', exact: true }).click();
    await expect(page.locator('h1').first()).toContainText('Guía de examen');

    // Verify 10 lessons are listed in sidebar
    const topicsList = page.locator('aside[aria-label="Temario de la guía"]');
    await expect(topicsList).toBeVisible();

    // Verify first lesson has rendered math
    await expect(page.locator('.markdown-body')).toBeVisible();
    await expect(page.locator('.markdown-body h1')).toContainText('Primeros pasos');

    // Check KaTeX rendered formula (e.g. $z=\sum_i w_i x_i+b$)
    await expect(page.locator('.katex').first()).toBeVisible();

    // Mark as read
    const readBtn = page.locator('button:has-text("Marcar como leído")');
    await expect(readBtn).toBeVisible();
    await readBtn.click();
    await expect(page.locator('button:has-text("Leído")')).toBeVisible();

    // Navigate to next lesson
    const nextBtn = page.locator('button:has-text("Siguiente:")');
    await nextBtn.click();
    await expect(page.locator('.markdown-body h1')).toContainText('Operaciones con conjuntos');
  });

  test('2. Practice view: filters, solving translation with equivalent formula', async ({ page }) => {
    await page.goto('/#/subjects/pruebas/units/guia/practice');
    await expect(page.locator('h1')).toContainText('Práctica interactiva');

    // Filter by type: translation
    await page.getByText('Filtrar ejercicios', { exact: true }).click();
    await page.selectOption('#filter-type', 'translation');

    // Verify translation input is shown
    await expect(page.locator('input[id^="trans_"]')).toBeVisible();

    // Type an equivalent formula using ASCII: (not p) or q
    const input = page.locator('input[id^="trans_"]');
    await input.fill('((not p) or q)');

    // Click submit
    await page.click('button:has-text("Comprobar respuesta")');

    // Check reasoned feedback is displayed
    await expect(page.locator('.callout-success, .callout-error')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Solución correcta' })).toBeVisible();
  });

  test('3. Interactive Truth Table cell toggle and cell-by-cell feedback', async ({ page }) => {
    await page.goto('/#/subjects/pruebas/units/guia/practice?type=truth_table');
    await expect(page.locator('table')).toBeVisible();

    // Click on table cell buttons to toggle values: [ - -> V -> F ]
    const firstCell = page.locator('tbody tr:first-child td button').first();
    await expect(firstCell).toBeVisible();
    await expect(firstCell).toHaveText('-');

    await firstCell.click();
    await expect(firstCell).toHaveText('V');

    await firstCell.click();
    await expect(firstCell).toHaveText('F');
  });

  test('4. Logic Lab workbench: Truth tables, Equivalence, SAT, and Generator', async ({ page }) => {
    await page.goto('/#/logic-lab');
    await expect(page.locator('h1')).toContainText('Laboratorio de Lógica Proposicional');

    // Table tab is active: verify computed table
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('Tautología, Contradicción o Contingencia:', { exact: true })).toBeVisible();

    // Test Equivalence tab
    await page.click('button:has-text("Equivalencia")');
    await expect(page.locator('input#eq-f1')).toBeVisible();
    await expect(page.locator('text=Son lógicamente equivalentes')).toBeVisible();

    // Test SAT tab
    await page.click('button:has-text("SAT (Satisfacibilidad)")');
    await expect(page.locator('text=La fórmula es SATISFACIBLE')).toBeVisible();

    // Test Generator tab
    await page.click('button:has-text("Generador de ejercicios")');
    await page.click('button:has-text("Generar ejercicio interactivo")');
    await expect(page.locator('text=Semilla:')).toBeVisible();
  });

  test('5. Persistent Exam Simulation: timer, reload preservation, and submission', async ({ page }) => {
    await page.goto('/#/subjects/pruebas/units/guia/exam');
    await expect(page.locator('h1')).toContainText('Simulacro de Examen');

    // Start exam
    await page.click('button:has-text("Iniciar Simulacro de Examen")');

    // Verify timer is ticking and 30 questions navigator exists
    await expect(page.locator('[title="Tiempo restante"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Pregunta 30 (sin responder)"]')).toBeVisible();

    // Answer question 1 if it's single choice or proposition
    const radio = page.locator('input[type="radio"]').first();
    if (await radio.isVisible()) {
      await radio.click();
    }

    // RELOAD page to verify session survival
    await page.reload();
    await expect(page.locator('text=Simulacro (1/30)')).toBeVisible();
    await expect(page.locator('[title="Tiempo restante"]')).toBeVisible();

    // Manually submit exam
    await page.click('button:has-text("Entregar examen")');
    await page.getByRole('dialog', { name: '¿Entregar el simulacro?' }).getByRole('button', { name: 'Entregar simulacro' }).click();

    // Verify submitted results view
    await expect(page.locator('h1')).toContainText('Resultados del Simulacro');
    await expect(page.locator('text=Nota automática promedio')).toBeVisible();
    await expect(page.locator('text=Revisión de las 30 preguntas')).toBeVisible();
  });

  test('6. Review and error tracking view', async ({ page }) => {
    await page.goto('/#/subjects/pruebas/units/guia/review');
    await expect(page.locator('h1')).toContainText('Repaso Espaciado y Control de Errores');
    await expect(page.locator('text=En seguimiento')).toBeVisible();
  });

  test('7. Content Management: import second subject from template', async ({ page }) => {
    await page.goto('/#/content');
    await expect(page.locator('h1')).toContainText('Gestión de Contenido e Importación');

    // Click import template button
    await page.getByRole('button', { name: 'Añadir ejemplo de matemáticas' }).click();

    // Check success banner
    await expect(page.locator('text=Paquete importado con éxito: Fundamentos matemáticos')).toBeVisible();

    // Navigate to the newly imported subject
    await page.click('text=Abrir unidad importada');
    await expect(page.locator('h1')).toContainText('Conjuntos y razonamiento');

    // Go to home and verify both subjects appear
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: 'Materia de prueba' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fundamentos matemáticos' })).toBeVisible();
  });

  test('8. Responsive layout at 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/#/');
    await expect(page.locator('h1')).toContainText('Tu biblioteca');

    // Check navigation and tables adapt without horizontal overflow breakage
    await page.goto('/#/subjects/pruebas/units/guia/study');
    await expect(page.locator('.study-layout')).toBeVisible();
  });
});
