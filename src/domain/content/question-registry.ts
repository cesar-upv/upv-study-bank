import { z } from 'zod';
import * as schemas from './types';
import type { QuestionType } from './types';

const item = z.object({ id: z.string().min(1), text: z.string().min(1) });
const items = z.array(item).min(2).refine(xs => new Set(xs.map(x => x.id)).size === xs.length, 'Los IDs deben ser únicos');
const ids = z.array(z.string().min(1)).min(1).refine(xs => new Set(xs).size === xs.length, 'Los IDs deben ser únicos');
const assignment = z.record(z.string(), z.boolean());
export const questionRegistry = {
  single_choice: { label: 'Opción única', payload: z.object({ options: items }), solution: z.object({ correct_option_id: z.string().min(1) }) },
  multiple_choice: { label: 'Selección múltiple', payload: z.object({ options: items }), solution: z.object({ correct_option_ids: ids }) },
  matching: { label: 'Relacionar conceptos', payload: z.object({ left: items, right: items }), solution: z.object({ pairs: z.record(z.string(), z.string()) }) },
  ordering: { label: 'Ordenar elementos', payload: z.object({ items }), solution: z.object({ ordered_ids: ids }) },
  proposition_check: { label: '¿Es una proposición?', payload: schemas.PropositionCheckPayloadSchema, solution: z.object({ is_proposition: z.boolean() }) },
  translation: { label: 'Traducción lógica', payload: schemas.TranslationPayloadSchema, solution: z.object({ formula: z.string().min(1).max(2048) }) },
  truth_table: { label: 'Tabla de verdad', payload: schemas.TruthTablePayloadSchema, solution: z.object({ vector: z.array(z.boolean()).min(1), classification: z.enum(['tautology', 'contradiction', 'contingency']), satisfiable: z.boolean(), models: z.array(assignment) }) },
  equivalence: { label: 'Equivalencia lógica', payload: schemas.EquivalencePayloadSchema, solution: z.object({ equivalent: z.boolean(), counterexamples: z.array(assignment) }) },
  sat: { label: 'Satisfacibilidad', payload: schemas.SatPayloadSchema, solution: z.object({ satisfiable: z.boolean(), models: z.array(assignment) }) },
  entailment: { label: 'Consecuencia lógica', payload: schemas.EntailmentPayloadSchema, solution: z.object({ entailed: z.boolean(), counterexamples: z.array(assignment) }) },
  short_answer: { label: 'Respuesta abierta', payload: schemas.ShortAnswerPayloadSchema, solution: z.object({ model_answer: z.string().min(1), rubric: z.array(schemas.RubricItemSchema).min(1) }) },
} satisfies Record<QuestionType, { label: string; payload: z.ZodType; solution: z.ZodType }>;
export const difficultyLabels = { basic: 'Básica', intermediate: 'Intermedia', advanced: 'Avanzada' };
