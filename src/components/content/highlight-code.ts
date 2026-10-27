import { createLowlight } from 'lowlight';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';

const lowlight = createLowlight({ python, javascript, typescript, json, sql, bash, c, cpp, xml, css });
lowlight.registerAlias({ python: ['py'], javascript: ['js', 'jsx'], typescript: ['ts', 'tsx'], bash: ['sh', 'shell'], cpp: ['c++'], xml: ['html', 'svg'] });
export function highlightCode(language: string, source: string) {
  return lowlight.registered(language) ? lowlight.highlight(language, source).children : undefined;
}
