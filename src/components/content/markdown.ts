import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { Root, RootContent, Heading } from 'mdast';

const parser = unified().use(remarkParse).use(remarkGfm);
const mathParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/** Normalize supported math delimiters outside code, HTML, links and images.
 * JSON has already been decoded by the package parser: never unescape its text again.
 */
export function normalizeMath(content: string): string {
  const protectedRanges: [number, number][] = [];
  const protect = (node: Root | RootContent) => {
    if (['code', 'inlineCode', 'html', 'link', 'image', 'definition', 'linkReference', 'imageReference'].includes(node.type)) {
      const start = node.position?.start.offset, end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) protectedRanges.push([start, end]);
    } else if ('children' in node) node.children.forEach(child => protect(child as RootContent));
  };
  protect(parser.parse(content));
  const normalize = (source: string) => {
    const lastParenClose = source.lastIndexOf('\\)');
    const lastBracketClose = source.lastIndexOf('\\]');
    let result = '';
    for (let i = 0; i < source.length;) {
      if (source[i] === '\\') {
        const close = source.startsWith('\\(', i) ? '\\)' : source.startsWith('\\[', i) ? '\\]' : null;
        if (close) {
          const lastClose = close === '\\)' ? lastParenClose : lastBracketClose;
          const end = lastClose > i ? source.indexOf(close, i + 2) : -1;
          if (end !== -1) {
            const value = source.slice(i + 2, end);
            result += close === '\\]' ? (value.includes('\n') ? `$$${value}$$` : `\n\n$$\n${value}\n$$\n\n`) : `$${value}$`;
            i = end + 2;
            continue;
          }
        }
        result += source.slice(i, i + 2); i += 2; continue;
      }
      if (source[i] !== '$') { result += source[i++]; continue; }
      const display = source.startsWith('$$', i);
      const delimiter = display ? '$$' : '$';
      let end = source.indexOf(delimiter, i + delimiter.length);
      while (end !== -1) {
        let slashes = 0;
        for (let j = end - 1; j >= 0 && source[j] === '\\'; j--) slashes++;
        if (slashes % 2 === 0) break;
        end = source.indexOf(delimiter, end + delimiter.length);
      }
      const validClose = display || (end !== -1 && !/\s/.test(source[end - 1]) && !/\d/.test(source[end + 1] || ''));
      const value = end === -1 ? '' : source.slice(i + delimiter.length, end);
      if (end !== -1 && validClose && value.trim() && (display || (!/^\s/.test(value) && !value.includes('\n') && !value.includes('$')))) {
        result += display ? (value.includes('\n') ? `$$${value}$$` : `\n\n$$\n${value.trim()}\n$$\n\n`) : `$${value}$`;
        i = end + delimiter.length;
      } else { result += '\\$'; i++; }
    }
    return result;
  };
  let result = '', cursor = 0;
  for (const [start, end] of protectedRanges.sort((a, b) => a[0] - b[0])) {
    result += normalize(content.slice(cursor, start)) + content.slice(start, end);
    cursor = end;
  }
  return result + normalize(content.slice(cursor));
}

export interface LessonHeading { id: string; title: string; depth: number }
function textOf(node: RootContent): string {
  if ('value' in node) return node.value;
  return 'children' in node ? node.children.map(child => textOf(child as RootContent)).join('') : '';
}
function assignHeadings(tree: Root, prefix: string): LessonHeading[] {
  const counts = new Map<string, number>();
  const headings: LessonHeading[] = [];
  const visit = (node: Root | RootContent) => {
    // Fenced code is literal, including a fence named `math`.
    if (node.type === 'code' && node.lang === 'math') node.lang = 'Math';
    if (node.type === 'heading') {
      const heading = node as Heading;
      const title = textOf(heading);
      const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'seccion';
      const count = (counts.get(slug) || 0) + 1;
      counts.set(slug, count);
      const id = `${prefix}${slug}${count > 1 ? `-${count}` : ''}`;
      heading.data = { ...heading.data, hProperties: { id, tabIndex: -1 } };
      if (heading.depth <= 3) headings.push({ id, title, depth: heading.depth });
    }
    if ('children' in node) node.children.forEach(child => visit(child as RootContent));
  };
  visit(tree);
  return headings;
}
export function lessonHeadings(normalizedContent: string, prefix: string): LessonHeading[] {
  return assignHeadings(mathParser.parse(normalizedContent), prefix);
}
export function remarkHeadingIds(options: { prefix: string }) {
  return (tree: Root) => { assignHeadings(tree, options.prefix); };
}
