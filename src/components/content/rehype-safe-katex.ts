import rehypeKatex from 'rehype-katex';
import type { Element, Root, RootContent } from 'hast';
import type { VFile } from 'vfile';

const render = rehypeKatex({ trust: false, strict: 'warn', maxExpand: 1000, maxSize: 20 });
const textOf = (node: RootContent): string => node.type === 'text' ? node.value : 'children' in node ? node.children.map(textOf).join('') : '';

/** Preserve rehype-katex, with an informative, accessible fallback for every error.
 * Its default throwOnError:false fallback can silently render unknown commands red.
 */
export function rehypeSafeKatex() {
  return (tree: Root, file: VFile) => {
    const visit = (parent: Root | Element) => {
      for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (child.type !== 'element') continue;
        const classes = child.properties.className;
        const isMath = Array.isArray(classes) && (classes.includes('math-inline') || classes.includes('math-display'));
        const isDisplay = child.tagName === 'pre' && child.children.some(node => node.type === 'element' && Array.isArray(node.properties.className) && node.properties.className.includes('math-display'));
        if (!isMath && !isDisplay) { visit(child); continue; }
        const source = textOf(child);
        const isolated: Root = { type: 'root', children: [child] };
        const previousErrors = file.messages.length;
        render(isolated, file);
        if (file.messages.length > previousErrors) {
          const fallback: Element = { type: 'element', tagName: 'span', properties: { className: ['katex-error'], title: 'Revisa la sintaxis y las funciones admitidas por KaTeX.' }, children: [{ type: 'text', value: source }] };
          parent.children.splice(i, 1, fallback);
        } else {
          parent.children.splice(i, 1, ...isolated.children);
          i += isolated.children.length - 1;
        }
      }
    };
    visit(tree);
  };
}
