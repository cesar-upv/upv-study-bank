import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MarkdownView } from '@/components/MarkdownView';
import { lessonHeadings, normalizeMath } from '@/components/content/markdown';
import { sanitizeDiagram, validateDiagram } from '@/components/content/mermaid-renderer';

vi.mock('@/components/content/mermaid-renderer', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/content/mermaid-renderer')>();
  return { ...actual, renderDiagram: vi.fn().mockRejectedValue(new Error('Parse error')) };
});
afterEach(cleanup);

describe('academic Markdown', () => {
  it('renders GFM, hierarchy, quotes, lists, rules and safe external links', () => {
    const { container } = render(<MarkdownView content={'# Título\n\n## Tema\n\n1. **Uno**\n2. *Dos* y ~~tres~~\n\n> Cita\n\n---\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[Fuente](https://example.com)'} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Tema');
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
    expect(container.querySelector('del')).toHaveTextContent('tres');
    expect(container.querySelector('blockquote')).toHaveTextContent('Cita');
    expect(container.querySelector('hr')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tabla de contenido' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('link', { name: 'Fuente' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each([
    String.raw`Inline $\frac{1}{2}$ y \(\sqrt{x_1^2}\).`,
    String.raw`$$\sum_{i=1}^{n} i + \int_0^1 x\,dx$$`,
    String.raw`\[\begin{pmatrix} a & b \\ c & d \end{pmatrix}\]`,
    String.raw`\[\begin{cases}x+y=1\\x-y=0\end{cases}\quad \alpha \land \beta\]`,
    String.raw`$$\begin{aligned}a&=b+c\\d&=e\end{aligned}$$`,
  ])('renders valid math: %s', content => {
    const { container } = render(<MarkdownView content={content} />);
    expect(container.querySelector('.katex')).toBeTruthy();
    expect(container.querySelector('.math-error')).toBeNull();
    expect(container.querySelector('math')).toBeTruthy();
  });

  it('distinguishes inline/display and preserves JSON escapes', () => {
    const decoded: { markdown: string } = JSON.parse(String.raw`{"markdown":"Inline \u005c(\u005cfrac{1}{2}\u005c)"}`);
    const { container } = render(<MarkdownView content={`${decoded.markdown}\n\n$$x^2$$`} />);
    expect(container.querySelectorAll('.katex')).toHaveLength(2);
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Fórmula matemática' })).toHaveAttribute('tabindex', '0');
  });

  it('keeps currency, escaped delimiters and all code literal', async () => {
    const content = 'Cuesta $5 y $10. Escape: \\$x\\$.\n\n`$x$ \\(y\\)`\n\n```python\nprint("$x$ \\(y\\)")\n```\n\n```math\n$z$\n```\n\n    $$literal$$';
    const { container } = render(<MarkdownView content={content} />);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container).toHaveTextContent('Cuesta $5 y $10.');
    expect(container.querySelector('pre')).toHaveTextContent('print("$x$ \\(y\\)")');
    expect(await screen.findByText('print', { selector: '.hljs-built_in' })).toBeInTheDocument();
  });

  it.each(['> $$\n> x^2\n> $$', '> \\[\n> x^2\n> \\]'])('keeps multiline display math inside its quotation: %s', content => {
    const { container } = render(<MarkdownView content={content} />);
    expect(container.querySelector('blockquote .katex-display')).toBeTruthy();
    expect(container.querySelector('.math-error')).toBeNull();
  });

  it('shows an informative fallback and continues after a malformed formula', () => {
    const { container } = render(<MarkdownView content={String.raw`Antes $\comandoInexistente{x}$ y después $x^2$.`} />);
    expect(screen.getByRole('note', { name: 'Fórmula inválida' })).toHaveTextContent('comandoInexistente');
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
    expect(container).toHaveTextContent('después');
  });

  it('does not execute HTML, unsafe links, images or trusted KaTeX commands', () => {
    const { container } = render(<MarkdownView content={'<script>window.attack=1</script>\n\n<img src=x onerror=alert(1)>\n\n[mal](javascript:alert%281%29)\n\n![remota](https://example.com/track.png)\n\n$\\href{javascript:alert(1)}{peligro}$'} />);
    expect(container.querySelector('script, img, iframe, [onerror], [onclick]')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it('builds unique heading IDs and focuses sections without changing the app route', () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<MarkdownView showToc content={'# Lección\n\n## Repetición\n\nUno\n\n## Repetición\n\nDos'} />);
    fireEvent.click(screen.getByText('En esta lección · 3 secciones'));
    const links = screen.getAllByRole('link', { name: 'Repetición' });
    expect(links[0].getAttribute('href')).not.toBe(links[1].getAttribute('href'));
    fireEvent.click(links[1]);
    expect(screen.getAllByRole('heading', { name: 'Repetición' })[1]).toHaveFocus();
    expect(lessonHeadings(normalizeMath('## Tema $x$'), 'lesson-')[0].title).toBe('Tema x');
  });

  it('copies raw code with indentation and supports unknown languages', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(<MarkdownView content={'```unknown\n  hola <script>alert(1)</script>\n```'} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Código copiado');
    expect(writeText).toHaveBeenCalledWith('  hola <script>alert(1)</script>');
    fireEvent.click(screen.getByRole('button', { name: 'Líneas' }));
    expect(container.querySelector('.line-numbers')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('script')).toBeNull();
  });

  it('preserves links and a long sequence of currency tokens during normalization', () => {
    const linked = String.raw`[Fórmula](https://example.com/$x$) y $x^2$`;
    expect(normalizeMath(linked)).toContain('https://example.com/$x$');
    const currencies = '$5 y '.repeat(2000);
    expect(normalizeMath(currencies)).toBe('\\$5 y '.repeat(2000));
    const unclosed = String.raw`\(x + `.repeat(2000);
    expect(normalizeMath(unclosed)).toBe(unclosed);
  });

  it('keeps the source available when Mermaid fails', async () => {
    render(<MarkdownView content={'```mermaid\ngraph TD\n  invalid (((\n```'} />);
    expect(await screen.findByText(/No se pudo dibujar el diagrama/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver código Mermaid'));
    expect(screen.getByText(/invalid/)).toBeInTheDocument();
  });
});

describe('imported diagram boundaries', () => {
  it.each(['%%{init: {"securityLevel":"loose"}}%%\ngraph TD\nA-->B', '---\nconfig:\n theme: dark\n---\ngraph TD', 'graph TD\nclick A "https://example.com"', 'graph TD\nclassDef x fill:url(https://evil)', 'a'.repeat(20001)])('rejects untrusted diagram configuration: %s', source => {
    expect(() => validateDiagram(source)).toThrow();
  });
  it('accepts ordinary flowcharts, sequences and states', () => {
    for (const source of ['graph TD\n A[Inicio] --> B[Final]', 'sequenceDiagram\n A->>B: Hola', 'stateDiagram-v2\n [*] --> Leyendo']) expect(() => validateDiagram(source)).not.toThrow();
  });
  it('sanitizes SVG scripts, handlers, foreign HTML and external links/images', () => {
    const clean = sanitizeDiagram('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><p>HTML</p></foreignObject><a href="javascript:alert(1)"><text>Link</text></a><image href="https://evil/image"/><path d="M0 0L10 10"/></svg>');
    expect(clean).toContain('<path');
    expect(clean).not.toMatch(/script|foreignObject|onload|javascript:|href=|<image|<a /);
  });
});
