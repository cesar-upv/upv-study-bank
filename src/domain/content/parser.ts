import { Lesson, LessonFrontmatter, LessonFrontmatterSchema } from './types';

/**
 * Parses frontmatter YAML block and markdown body from lesson file text.
 */
export function parseLessonMarkdown(path: string, rawMarkdown: string): Lesson {
  const trimmed = rawMarkdown.trimStart();
  if (!trimmed.startsWith('---')) {
    throw new Error(`Lesson at ${path} is missing YAML frontmatter header ('---')`);
  }

  const endIndex = trimmed.indexOf('\n---', 3);
  if (endIndex === -1) {
    throw new Error(`Lesson at ${path} has unclosed YAML frontmatter`);
  }

  const frontmatterStr = trimmed.slice(3, endIndex).trim();
  const content = trimmed.slice(endIndex + 4).trimStart();

  const rawFields: Record<string, any> = {};
  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let val = line.slice(colonIndex + 1).trim();

    // Check for array syntax [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      const items = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      rawFields[key] = items;
    } else {
      // Clean quotes
      val = val.replace(/^['"]|['"]$/g, '');
      if (/^\d+$/.test(val)) {
        rawFields[key] = parseInt(val, 10);
      } else {
        rawFields[key] = val;
      }
    }
  }

  const frontmatter: LessonFrontmatter = LessonFrontmatterSchema.parse(rawFields);

  return {
    path,
    markdown: rawMarkdown,
    frontmatter,
    content,
  };
}
