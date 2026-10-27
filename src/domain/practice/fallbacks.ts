import type { Answer, Question } from '@/domain/content/types';

/** Small certified examples keep the generator independent of installed courses. */
export function generatorFallback(type: string): { question: Question; answer: Answer } {
  const examples = {
    truth_table: {
      prompt: 'Construye la tabla de verdad de $p \\to q$.',
      payload: { formula: '(p -> q)', variables: ['p', 'q'], row_order: 'false_first_lexicographic' },
      solution: { vector: [true, true, false, true], classification: 'contingency', satisfiable: true, models: [{ p: false, q: false }, { p: false, q: true }, { p: true, q: true }] },
      explanation: 'La implicación solo es falsa cuando p es verdadera y q es falsa.',
    },
    equivalence: {
      prompt: '¿Son equivalentes $p \\to q$ y $\\neg p \\lor q$?',
      payload: { left: '(p -> q)', right: '((not p) or q)', variables: ['p', 'q'] },
      solution: { equivalent: true, counterexamples: [] },
      explanation: 'Ambas expresiones tienen el vector V, V, F, V.',
    },
    sat: {
      prompt: '¿Es satisfacible $p \\land \\neg p$?',
      payload: { formula: '(p and (not p))', variables: ['p'] },
      solution: { satisfiable: false, models: [] },
      explanation: 'Una proposición y su negación nunca son verdaderas a la vez.',
    },
    translation: {
      prompt: 'Traduce: abro la puerta solo si tengo la llave.',
      payload: { bindings: { p: 'abro la puerta', q: 'tengo la llave' }, variables: ['p', 'q'] },
      solution: { formula: '(p -> q)' },
      explanation: 'Tener la llave es una condición necesaria para abrir la puerta.',
    },
  };
  if (!Object.hasOwn(examples, type)) throw new Error(`Unsupported fallback: ${type}`);
  const example = examples[type as keyof typeof examples];
  const id = `fallback-${type}`;
  return {
    question: { schema_version: 1, id, subject_id: 'laboratorio', unit_id: 'generados', topic_id: 'logica', type: type as Question['type'], difficulty: 'basic', exam_scope: 'optional', prompt: example.prompt, payload: example.payload, hints: [], source_ids: [] },
    answer: { question_id: id, solution: example.solution, explanation: example.explanation },
  };
}
