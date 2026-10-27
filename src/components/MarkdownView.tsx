import { Children, isValidElement, memo, useId, useMemo, type ReactNode } from 'react';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { rehypeSafeKatex } from './content/rehype-safe-katex';
import { CodeBlock } from './content/CodeBlock';
import { MermaidBlock } from './content/MermaidBlock';
import { lessonHeadings, normalizeMath, remarkHeadingIds } from './content/markdown';

interface MarkdownViewProps {
  content: string;
  className?: string;
  showToc?: boolean;
}
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeSafeKatex];

function nodeText(children: ReactNode): string {
  return Children.toArray(children).map(child => typeof child === 'string' || typeof child === 'number' ? String(child)
    : isValidElement<{ children?: ReactNode }>(child) ? nodeText(child.props.children) : '').join('');
}
export const MarkdownView = memo(function MarkdownView({ content, className = 'markdown-body', showToc = false }: MarkdownViewProps) {
  const id = useId();
  const normalized = useMemo(() => normalizeMath(content), [content]);
  const prefix = `section-${id}-`;
  const headings = useMemo(() => showToc ? lessonHeadings(normalized, prefix) : [], [normalized, prefix, showToc]);
  return <div className={className}>
    {headings.length > 1 && <details className="lesson-toc"><summary>En esta lección · {headings.length} secciones</summary><nav aria-label="Índice de esta lección"><ul>{headings.map(heading => <li key={heading.id} className={`toc-depth-${heading.depth}`}><a href={`#${heading.id}`} onClick={event => {
      event.preventDefault();
      const target = document.getElementById(heading.id);
      target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start' });
    }}>{heading.title}</a></li>)}</ul></nav></details>}
    <ReactMarkdown remarkPlugins={[...remarkPlugins, [remarkHeadingIds, { prefix }]]} rehypePlugins={rehypePlugins}
      components={{
        pre: ({ children }) => {
          const child = Children.toArray(children)[0];
          if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
            const language = /language-([\w+-]+)/.exec(child.props.className || '')?.[1]?.toLowerCase();
            const source = nodeText(child.props.children).replace(/\n$/, '');
            return language === 'mermaid' ? <MermaidBlock source={source} /> : <CodeBlock source={source} language={language} />;
          }
          return <pre>{children}</pre>;
        },
        span: ({ node: _node, className: name, children, ...props }) => name?.includes('katex-error')
          ? <span {...props} style={undefined} className="math-error" role="note" aria-label="Fórmula inválida">Fórmula inválida: <code>{children}</code></span>
          : <span className={name} {...props} {...(name?.includes('katex-display') ? { tabIndex: 0, role: 'region', 'aria-label': 'Fórmula matemática' } : {})}>{children}</span>,
        div: ({ node: _node, className: name, ...props }) => <div className={name} {...props} {...(name?.includes('katex-display') ? { tabIndex: 0, role: 'region', 'aria-label': 'Fórmula matemática' } : {})} />,
        table: ({ node: _node, ...props }) => <div className="table-responsive" role="region" aria-label="Tabla de contenido" tabIndex={0}><table {...props} /></div>,
        a: ({ node: _node, href, children, ...props }) => {
          const external = /^(?:https?:)?\/\//i.test(href || '');
          return <a href={href} onClick={href?.startsWith('#') ? event => {
            event.preventDefault();
            let fragment: string;
            try { fragment = decodeURIComponent(href.slice(1)); } catch { return; }
            const target = document.getElementById(`${prefix}${fragment}`);
            target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start' });
          } : undefined} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...props}>{children}</a>;
        },
        // Packages never cause network requests through embedded images.
        img: ({ alt }) => <span className="content-status">[Imagen: {alt || 'sin descripción'}]</span>,
      }}
    >{normalized}</ReactMarkdown>
  </div>;
});
