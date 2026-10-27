import { test, expect, type Page } from './fixtures';
import template from '../../templates/matematicas.unit-package.json' with { type: 'json' };

const base = '/#/subjects/pruebas/units/guia';
const mathBase = '/#/subjects/fundamentos-matematicos/units/conceptos-basicos';
const academicContent = String.raw`# Contenido de prueba

## Matemáticas

Inline $\frac{1}{2}$, \(\sqrt{x_1^2}\). Cuesta $5 y $10.

\[\begin{pmatrix}a & b\\c & d\end{pmatrix}\]

$$\begin{aligned}\sum_{i=1}^n i&=\frac{n(n+1)}{2}\\\int_0^1 x\,dx&=\frac12\end{aligned}$$

Fórmula inválida: $\comandoInexistente{x}$.

## Código y tabla

~~~python
for i in range(3):
    print("$x$ y \\(y\\)")
~~~

| Concepto | Expresión |
| --- | --- |
| Raíz | $\sqrt{2}$ |

[Inseguro](javascript:alert%281%29)

<img src=x onerror="window.attacked=1">

![Imagen remota](https://invalid.example/track.png)

## Diagramas

~~~mermaid
graph TD
 A[Inicio] --> B[Evaluación]
 B --> C[Resultado]
~~~

~~~mermaid
sequenceDiagram
 Estudiante->>Banco: Practicar
 Banco-->>Estudiante: Explicación
~~~

~~~mermaid
stateDiagram-v2
 [*] --> Lectura
 Lectura --> Practica
~~~

~~~mermaid
this is not valid Mermaid (((
~~~

~~~mermaid
%%{init: {"securityLevel":"loose"}}%%
graph TD
 A-->B
~~~
`;
async function addTechnicalExample(page: Page) {
  const pkg = structuredClone(template);
  const lesson = pkg.lessons[0];
  const close = lesson.markdown.indexOf('---', 3) + 3;
  lesson.markdown = `${lesson.markdown.slice(0, close)}\n\n${academicContent}`;
  await page.goto('/#/content');
  await page.locator('input[type=file]').setInputFiles({ name: 'technical.unit-package.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await expect(page.getByText('Paquete importado con éxito: Fundamentos matemáticos')).toBeVisible();
  await page.goto(`${mathBase}/study`);
  await expect(page.locator('.study-article')).toBeVisible();
}

test('themes persist, follow system live and preserve reading, bookmarks, attempts and an active exam', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`${base}/study/tema-1`);
  await page.getByRole('button', { name: 'Marcar como leído', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir a favoritos' }).click();
  await page.goto(`${base}/practice?type=single_choice`);
  await page.locator('input[type=radio]').first().check();
  await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(page.getByRole('heading', { name: 'Solución correcta' })).toBeVisible();
  await page.goto(`${base}/exam`);
  await page.getByRole('button', { name: 'Iniciar Simulacro de Examen' }).click();
  await expect(page.getByRole('heading', { name: 'Simulacro (1/30)' })).toBeVisible();
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: /Monochrome/ }).check();
  await page.getByLabel('Modo de color').selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'zinc');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: /Monochrome/ })).toBeChecked();
  await page.goto(`${base}/study/tema-1`);
  await expect(page.getByRole('button', { name: 'Leído', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto(`${base}/exam`);
  await expect(page.getByRole('heading', { name: 'Simulacro (1/30)' })).toBeVisible();
  await page.goto(base);
  await expect(page.locator('.performance-list')).toContainText('1 de');
});

test('applies a persisted theme before React can load', async ({ page }) => {
  await page.goto('about:blank');
  await page.addInitScript(() => {
    localStorage.setItem('study_bank_theme', 'dark');
    localStorage.setItem('study_bank_palette', 'catppuccin');
  });
  await page.route('**/src/main.tsx*', route => route.abort());
  await page.goto('/#/settings');
  await expect(page.locator('#root')).toBeEmpty();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'catppuccin');
});

test('all palette text/control states meet measured AA contrast pairs', async ({ page }) => {
  await page.goto('/#/settings');
  for (const palette of [/^Flexoki/, /Monochrome/, /^Catppuccin/, /^Académico/]) {
    await page.getByRole('radio', { name: palette }).check();
    for (const mode of ['light', 'dark']) {
      await page.getByLabel('Modo de color').selectOption(mode);
      const pairs = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const get = (name: string) => css.getPropertyValue(name).trim();
        const rgb = (color: string) => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        };
        const luminance = (color: string) => { const c = rgb(color); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
        const definitions = [
          ['--text-primary', '--bg-primary'], ['--text-secondary', '--bg-surface'], ['--text-muted', '--bg-surface-elevated'],
          ['--accent-text', '--accent-primary'], ['--accent-text', '--accent-primary-hover'], ['--accent-primary', '--bg-surface'],
          ['--rail-text', '--rail-bg'], ['--rail-muted', '--rail-bg'],
          ...['success', 'error', 'warning', 'info'].map(state => [`--${state}-text`, `--${state}-bg`]),
          ...['keyword', 'string', 'number', 'title', 'meta', 'comment'].map(token => [`--syntax-${token}`, '--code-bg']),
        ];
        return definitions.map(([fg, bg]) => {
          const a = luminance(get(fg)), b = luminance(get(bg));
          return { fg, bg, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        });
      });
      for (const pair of pairs) expect(pair.ratio, `${palette}/${mode}: ${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('technical content: math, literal code, safe Mermaid, copy and in-page keyboard navigation', async ({ page, context }) => {
  const remoteImages: string[] = [];
  page.on('request', request => { if (request.url().includes('invalid.example')) remoteImages.push(request.url()); });
  await addTechnicalExample(page);
  await expect(page.locator('.study-article .katex')).toHaveCount(5);
  await expect(page.locator('.math-error')).toContainText('Fórmula inválida');
  await expect(page.locator('.study-article')).toContainText('Cuesta $5 y $10.');
  await expect(page.locator('.code-block .hljs-keyword')).toHaveCount(2);
  await expect(page.locator('.code-block .katex')).toHaveCount(0);
  expect(await page.locator('.study-article').evaluate(node => node.querySelectorAll('script, img, iframe, [onerror], a[href^="javascript:"]').length)).toBe(0);
  expect(remoteImages).toEqual([]);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copiar código' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('    print(');
  await page.getByText('En esta lección · 4 secciones').click();
  const route = page.url();
  await page.getByRole('navigation', { name: 'Índice de esta lección' }).getByRole('link', { name: 'Diagramas' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Diagramas', exact: true })).toBeFocused();
  expect(page.url()).toBe(route);
  // Scrolling each block into view exercises the deferred renderer.
  const blocks = page.locator('.mermaid-block');
  for (let i = 0; i < 5; i++) {
    await blocks.nth(i).scrollIntoViewIfNeeded();
    if (i < 3) await expect(blocks.nth(i).locator('svg')).toHaveCount(1);
    else await expect(blocks.nth(i).getByRole('status')).toContainText('No se pudo dibujar');
  }
  const first = blocks.first();
  await first.scrollIntoViewIfNeeded();
  await first.getByRole('button', { name: 'Ampliar diagrama' }).click();
  await expect(first.locator('.diagram-canvas')).toHaveClass(/diagram-zoomed/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('technical content remains readable at mobile, tablet and desktop in every new family', async ({ page }) => {
  await addTechnicalExample(page);
  for (const palette of ['flexoki', 'zinc', 'catppuccin']) {
    for (const mode of ['light', 'dark']) {
      await page.goto('/#/settings');
      await page.getByRole('radio', { name: palette === 'zinc' ? /Monochrome/ : new RegExp(palette, 'i') }).check();
      await page.getByLabel('Modo de color').selectOption(mode);
      for (const width of [360, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${mathBase}/study`);
        await expect(page.locator('.study-article')).toBeVisible();
        await page.locator('.mermaid-block').first().scrollIntoViewIfNeeded();
        await expect(page.locator('.mermaid-block').first().locator('svg')).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
});

test('mistake practice retains explanations until refresh and then removes corrected errors', async ({ page }) => {
  await page.goto('/#/content');
  await page.getByRole('button', { name: 'Añadir ejemplo de matemáticas' }).click();
  await expect(page.getByText('Paquete importado con éxito: Fundamentos matemáticos')).toBeVisible();
  await page.goto(`${mathBase}/practice?type=multiple_choice`);
  const boxes = page.locator('fieldset input[type=checkbox]');
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(page.getByRole('heading', { name: 'Solución correcta' })).toBeVisible();
  await page.goto(`${mathBase}/practice?status=incorrect`);
  await expect(page.locator('.question-header')).toBeVisible();
  await page.locator('fieldset input[type=checkbox]').nth(0).check();
  await page.locator('fieldset input[type=checkbox]').nth(2).check();
  await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(page.getByRole('heading', { name: 'Solución correcta' })).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar pendientes' }).click();
  await expect(page.getByText(/No hay errores pendientes/)).toBeVisible();
  await page.goto(mathBase);
  await expect(page.locator('.performance-measure strong')).toHaveText('100%');
  await expect(page.locator('.performance-list')).toContainText('1 correctos sin ayuda');
});
