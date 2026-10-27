import { UnitPackage, UnitPackageSchema, Lesson } from './types';
import { parseFormula, collectVariables } from '@/domain/logic';
import { questionRegistry } from './question-registry';
import { parseLessonMarkdown } from './parser';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  parsedLessons?: Lesson[];
  data?: UnitPackage;
}

/**
 * Validates a unit package structure, limits, and referential integrity.
 */
export function validateUnitPackage(rawData: unknown, rawJsonString?: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (rawJsonString && new TextEncoder().encode(rawJsonString).byteLength > 5 * 1024 * 1024) {
    errors.push({ path: 'package', message: 'El paquete supera el límite de tamaño de 5 MiB' });
    return { valid: false, errors };
  }

  const parseResult = UnitPackageSchema.safeParse(rawData);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
      });
    }
    return { valid: false, errors };
  }

  const pkg = parseResult.data;

  const fail = (path: string, message: string) => errors.push({ path, message });
  if (pkg.unit.subject_id !== pkg.subject.id || !pkg.subject.unit_ids.includes(pkg.unit.id)) fail('unit', 'La unidad debe pertenecer a la materia.');
  for (const [name, values] of [['topics', pkg.unit.topic_ids], ['sources', pkg.sources.map(s => s.id)]] as const) {
    if (new Set(values).size !== values.length) fail(name, 'Los IDs deben ser únicos.');
  }
  if (pkg.unit.lessons.length !== pkg.lessons.length || pkg.unit.lessons.some(path => !pkg.lessons.some(l => l.path === path))) fail('unit.lessons', 'El manifiesto y las lecciones deben coincidir.');
  if (pkg.unit.exam?.quotas && (Object.keys(pkg.unit.exam.quotas).some(t => !pkg.unit.topic_ids.includes(t)) || Object.values(pkg.unit.exam.quotas).reduce((a, b) => a + b, 0) !== pkg.unit.exam.question_count)) fail('unit.exam.quotas', 'Las cuotas deben usar temas existentes y sumar question_count.');

  // Limits check
  if (pkg.questions.length > 1000) {
    errors.push({ path: 'questions', message: 'El paquete supera el límite de 1.000 preguntas' });
  }
  if (pkg.lessons.length > 100) {
    errors.push({ path: 'lessons', message: 'El paquete supera el límite de 100 lecciones' });
  }

  // Path safety checks
  const seenPaths = new Set<string>();
  for (let i = 0; i < pkg.lessons.length; i++) {
    const lesson = pkg.lessons[i];
    const p = lesson.path;
    if (p.startsWith('/') || p.startsWith('\\') || p.includes('..')) {
      errors.push({
        path: `lessons[${i}].path`,
        message: `Ruta insegura rechazada: "${p}"`,
      });
    }
    if (seenPaths.has(p)) {
      errors.push({
        path: `lessons[${i}].path`,
        message: `Ruta duplicada en lecciones: "${p}"`,
      });
    }
    seenPaths.add(p);
  }

  // Sources index
  const sourceIds = new Set(pkg.sources.map((s) => s.id));
  const topicIds = new Set(pkg.unit.topic_ids);

  // Lesson frontmatter checks
  const parsedLessons: Lesson[] = [];
  for (let i = 0; i < pkg.lessons.length; i++) {
    const l = pkg.lessons[i];
    try {
      const parsed = parseLessonMarkdown(l.path, l.markdown);
      if (!topicIds.has(parsed.frontmatter.topic_id)) {
        errors.push({
          path: `lessons[${i}].frontmatter.topic_id`,
          message: `El tema "${parsed.frontmatter.topic_id}" no pertenece a los temas de la unidad`,
        });
      }
      for (const src of parsed.frontmatter.source_ids) {
        if (!sourceIds.has(src)) {
          errors.push({
            path: `lessons[${i}].frontmatter.source_ids`,
            message: `Fuente desconocida "${src}" en lección ${l.path}`,
          });
        }
      }
      if (parsed.frontmatter.subject_id !== pkg.subject.id || parsed.frontmatter.unit_id !== pkg.unit.id) fail(`lessons[${i}]`, 'La lección pertenece a otra materia o unidad.');
      if (parsedLessons.some(l => l.frontmatter.id === parsed.frontmatter.id)) fail(`lessons[${i}]`, 'ID de lección duplicado.');
      if (parsedLessons.some(l => l.frontmatter.topic_id === parsed.frontmatter.topic_id)) fail(`lessons[${i}]`, 'Cada tema puede tener una sola lección; la navegación identifica las lecciones por tema.');
      parsedLessons.push(parsed);
    } catch (err: any) {
      errors.push({
        path: `lessons[${i}]`,
        message: `Error al procesar la lección: ${err.message}`,
      });
    }
  }

  // Referential integrity: questions & answers
  const qIdSet = new Set<string>();
  for (let i = 0; i < pkg.questions.length; i++) {
    const q = pkg.questions[i];
    if (qIdSet.has(q.id)) {
      errors.push({
        path: `questions[${i}].id`,
        message: `ID de pregunta duplicado: "${q.id}"`,
      });
    }
    qIdSet.add(q.id);
    if (q.subject_id !== pkg.subject.id || q.unit_id !== pkg.unit.id) fail(`questions[${i}]`, 'La pregunta pertenece a otra materia o unidad.');
    const contract = questionRegistry[q.type];
    const payload = contract.payload.safeParse(q.payload);
    if (!payload.success) payload.error.issues.forEach(issue => fail(`questions[${i}].payload.${issue.path.join('.')}`, issue.message));

    if (!topicIds.has(q.topic_id)) {
      errors.push({
        path: `questions[${i}].topic_id`,
        message: `El tema "${q.topic_id}" no pertenece a los temas de la unidad`,
      });
    }

    for (const src of q.source_ids) {
      if (!sourceIds.has(src)) {
        errors.push({
          path: `questions[${i}].source_ids`,
          message: `Fuente desconocida "${src}" en pregunta "${q.id}"`,
        });
      }
    }
  }

  const ansIdMap = new Map<string, any>();
  for (let i = 0; i < pkg.answers.length; i++) {
    const a = pkg.answers[i];
    if (ansIdMap.has(a.question_id)) {
      errors.push({
        path: `answers[${i}].question_id`,
        message: `ID de respuesta duplicado: "${a.question_id}"`,
      });
    }
    ansIdMap.set(a.question_id, a);
  }

  // Check matching questions and answers
  for (const q of pkg.questions) {
    if (!ansIdMap.has(q.id)) {
      errors.push({
        path: `questions[${q.id}]`,
        message: `No existe respuesta asociada para la pregunta "${q.id}"`,
      });
    }
  }

  for (const q of pkg.questions) {
    const a = ansIdMap.get(q.id);
    if (!a) continue;
    const contract = questionRegistry[q.type];
    const solution = contract.solution.safeParse(a.solution);
    if (!solution.success) {
      solution.error.issues.forEach(issue => fail(`answers[${q.id}].solution.${issue.path.join('.')}`, issue.message));
      continue;
    }
    if (!contract.payload.safeParse(q.payload).success) continue;
    const p = q.payload, sol = a.solution;
    const formulas = q.type === 'translation' ? [sol.formula] : q.type === 'equivalence' ? [p.left, p.right] : q.type === 'entailment' ? [...p.premises, p.conclusion] : ['truth_table', 'sat'].includes(q.type) ? [p.formula] : [];
    for (const formula of formulas) {
      try {
        const variables = collectVariables(parseFormula(formula));
        if (variables.some(v => !p.variables.includes(v))) fail(q.id, 'La fórmula usa variables no declaradas.');
      } catch (error) { fail(q.id, `Fórmula inválida: ${error instanceof Error ? error.message : error}`); }
    }
    if (p.variables && new Set(p.variables).size !== p.variables.length) fail(q.id, 'Variables duplicadas.');
    if (q.type === 'truth_table' && sol.vector.length !== 2 ** p.variables.length) fail(q.id, 'La longitud del vector no corresponde al número de variables.');
    if (q.type === 'single_choice' && !p.options.some((o: any) => o.id === sol.correct_option_id)) fail(q.id, 'Opción correcta desconocida.');
    if (q.type === 'multiple_choice' && sol.correct_option_ids.some((id: string) => !p.options.some((o: any) => o.id === id))) fail(q.id, 'Opción correcta desconocida.');
    if (q.type === 'ordering' && (sol.ordered_ids.length !== p.items.length || sol.ordered_ids.some((id: string) => !p.items.some((o: any) => o.id === id)))) fail(q.id, 'El orden debe contener cada elemento exactamente una vez.');
    if (q.type === 'matching' && (Object.keys(sol.pairs).length !== p.left.length || p.left.some((o: any) => !p.right.some((r: any) => r.id === sol.pairs[o.id])) || new Set(Object.values(sol.pairs)).size !== p.left.length)) fail(q.id, 'Cada concepto debe tener una relación única con una opción existente.');
  }

  for (const a of pkg.answers) {
    if (!qIdSet.has(a.question_id)) {
      errors.push({
        path: `answers[${a.question_id}]`,
        message: `La respuesta "${a.question_id}" no tiene pregunta correspondiente`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsedLessons: errors.length === 0 ? parsedLessons : undefined,
    data: errors.length === 0 ? pkg : undefined,
  };
}
