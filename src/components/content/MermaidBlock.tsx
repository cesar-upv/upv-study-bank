import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/app/theme-context';
import { renderDiagram } from './mermaid-renderer';

export function MermaidBlock({ source }: { source: string }) {
  const { theme, palette } = useTheme();
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const [result, setResult] = useState<{ svg?: string; error?: string }>({});
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!root.current || visible || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setResult({});
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    renderDiagram(source, {
      background: token('--bg-surface'), surface: token('--bg-surface-elevated'), text: token('--text-primary'),
      muted: token('--text-secondary'), border: token('--border-color'), accent: token('--accent-primary'), dark: theme === 'dark',
    }).then(svg => { if (active) setResult({ svg }); }).catch(error => {
      if (active) setResult({ error: error instanceof Error && error.message.startsWith('Usa un diagrama') ? error.message : 'Revisa la sintaxis Mermaid y el límite de 20.000 caracteres / 200 conexiones.' });
    });
    return () => { active = false; };
  }, [source, visible, theme, palette]);
  return <figure ref={root} className="mermaid-block" aria-label="Diagrama Mermaid">
    <figcaption className="content-toolbar"><span>Diagrama · Mermaid</span>{result.svg && <button className="btn-outline btn-sm" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? 'Ajustar diagrama' : 'Ampliar diagrama'}</button>}</figcaption>
    {result.error ? <p role="status" className="diagram-error">No se pudo dibujar el diagrama. {result.error}</p>
      : result.svg ? <div className={`diagram-canvas${zoom ? ' diagram-zoomed' : ''}`} role="region" aria-label="Diagrama renderizado; desplaza para explorar" tabIndex={0} dangerouslySetInnerHTML={{ __html: result.svg }} />
        : <p role="status" className="content-status">{visible ? 'Dibujando diagrama…' : 'El diagrama se cargará al llegar a esta sección.'}</p>}
    <details className="diagram-source"><summary>Ver código Mermaid</summary><pre tabIndex={0}><code>{source}</code></pre></details>
  </figure>;
}
