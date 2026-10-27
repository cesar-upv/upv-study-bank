import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Element, RootContent } from 'hast';
function renderNode(node: RootContent, index: number): ReactNode {
  if (node.type === 'text') return node.value;
  if (node.type !== 'element') return null;
  const element: Element = node;
  return <span key={index} className={Array.isArray(element.properties.className) ? element.properties.className.join(' ') : undefined}>{element.children.map(renderNode)}</span>;
}
export function CodeBlock({ source, language = 'text' }: { source: string; language?: string }) {
  const [lines, setLines] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [highlight, setHighlight] = useState<{ source: string; language: string; nodes: RootContent[] }>();
  useEffect(() => {
    if (source.length > 50000) return;
    let active = true;
    import('./highlight-code').then(module => {
      const nodes = module.highlightCode(language, source);
      if (active && nodes) setHighlight({ source, language, nodes });
    }).catch(() => { /* Plain code remains readable if the optional grammar chunk fails. */ });
    return () => { active = false; };
  }, [source, language]);
  const highlighted = useMemo(() => highlight?.source === source && highlight.language === language
    ? highlight.nodes.map(renderNode) : source, [highlight, source, language]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(source); setCopyStatus('Código copiado.'); }
    catch { setCopyStatus('No se pudo copiar. Selecciona el código y cópialo manualmente.'); }
  };
  return <div className="code-block">
    <div className="content-toolbar"><span>{language}</span><div><button className="btn-ghost btn-sm" aria-pressed={lines} onClick={() => setLines(!lines)}>Líneas</button><button className="btn-outline btn-sm" onClick={copy}>Copiar código</button></div></div>
    <pre tabIndex={0} aria-label={`Código ${language}`}><code>{lines && <span className="line-numbers" aria-hidden="true">{source.split('\n').map((_, i) => <span key={i}>{i + 1}</span>)}</span>}<span>{highlighted}</span></code></pre>
    {copyStatus && <p role="status" className="content-status">{copyStatus}</p>}
  </div>;
}
