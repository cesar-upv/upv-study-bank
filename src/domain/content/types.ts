import { z } from 'zod';

export const SourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['uploaded', 'primary', 'original', 'secondary']).or(z.string()),
  locator: z.string().optional(),
  note: z.string().optional(),
  url: z.string().url().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const SubjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  unit_ids: z.array(z.string().min(1)),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const UnitManifestSchema = z.object({
  schema_version: z.literal(1),
  id: z.string().min(1),
  subject_id: z.string().min(1),
  title: z.string().min(1),
  revision: z.number().int().min(1),
  topic_ids: z.array(z.string().min(1)),
  lessons: z.array(z.string().min(1)),
  questions: z.string().min(1),
  answers: z.string().min(1),
  exam: z.object({ question_count: z.number().int().min(1).max(1000), duration_minutes: z.number().int().min(1).max(480), quotas: z.record(z.string(), z.number().int().nonnegative()).optional() }).optional(),
});
export type UnitManifest = z.infer<typeof UnitManifestSchema>;

export const LessonFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  id: z.string().min(1),
  subject_id: z.string().min(1),
  unit_id: z.string().min(1),
  topic_id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().min(1),
  exam_scope: z.enum(['required', 'optional']),
  source_ids: z.array(z.string().min(1)),
});
export type LessonFrontmatter = z.infer<typeof LessonFrontmatterSchema>;

export interface Lesson {
  path: string;
  markdown: string;
  frontmatter: LessonFrontmatter;
  content: string; // Markdown content without frontmatter
}

export const QuestionTypeSchema = z.enum([
  'single_choice',
  'multiple_choice',
  'matching',
  'ordering',
  'proposition_check',
  'translation',
  'truth_table',
  'equivalence',
  'sat',
  'entailment',
  'short_answer',
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const DifficultySchema = z.enum(['basic', 'intermediate', 'advanced']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ExamScopeSchema = z.enum(['required', 'optional']);
export type ExamScope = z.infer<typeof ExamScopeSchema>;

// Question payloads
export const SingleChoicePayloadSchema = z.object({
  options: z.array(
    z.object({
      id: z.string().min(1),
      text: z.string().min(1),
    })
  ).min(2),
});

export const PropositionCheckPayloadSchema = z.object({
  statement: z.string().min(1),
});

export const TranslationPayloadSchema = z.object({
  bindings: z.record(z.string(), z.string().min(1)),
  variables: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(6),
});

export const TruthTablePayloadSchema = z.object({
  formula: z.string().min(1).max(2048),
  variables: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(6),
  row_order: z.literal('false_first_lexicographic'),
});

export const EquivalencePayloadSchema = z.object({
  left: z.string().min(1).max(2048),
  right: z.string().min(1).max(2048),
  variables: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(6),
});

export const SatPayloadSchema = z.object({
  formula: z.string().min(1).max(2048),
  variables: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(6),
});

export const EntailmentPayloadSchema = z.object({
  premises: z.array(z.string().min(1).max(2048)).min(1),
  conclusion: z.string().min(1).max(2048),
  variables: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(6),
});

export const ShortAnswerPayloadSchema = z.object({
  evaluation: z.literal('self_assessment'),
});

export const QuestionSchema = z.object({
  schema_version: z.literal(1),
  id: z.string().min(1),
  subject_id: z.string().min(1),
  unit_id: z.string().min(1),
  topic_id: z.string().min(1),
  type: QuestionTypeSchema,
  difficulty: DifficultySchema,
  exam_scope: ExamScopeSchema,
  prompt: z.string().min(1),
  payload: z.record(z.string(), z.any()),
  hints: z.array(z.string().min(1)),
  source_ids: z.array(z.string().min(1)),
});
export type Question = z.infer<typeof QuestionSchema>;

// Answer solutions
export const RubricItemSchema = z.object({
  criterion: z.string().min(1),
  points: z.number().positive(),
});

export const AnswerSolutionSchema = z.union([
  z.object({ correct_option_id: z.string().min(1) }),
  z.object({ is_proposition: z.boolean() }),
  z.object({ formula: z.string().min(1).max(2048) }),
  z.object({
    vector: z.array(z.boolean()).min(1),
    classification: z.enum(['tautology', 'contradiction', 'contingency']),
    satisfiable: z.boolean(),
    models: z.array(z.record(z.string(), z.boolean())),
  }),
  z.object({
    equivalent: z.boolean(),
    counterexamples: z.array(z.record(z.string(), z.boolean())),
  }),
  z.object({
    entailed: z.boolean(),
    counterexamples: z.array(z.record(z.string(), z.boolean())),
  }),
  z.object({
    model_answer: z.string().min(1),
    rubric: z.array(RubricItemSchema).min(1),
  }),
]);

export const AnswerSchema = z.object({
  question_id: z.string().min(1),
  solution: z.record(z.string(), z.any()),
  explanation: z.string().min(1),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const LessonPackageItemSchema = z.object({
  path: z.string().min(1),
  markdown: z.string().min(1),
});

export const UnitPackageSchema = z.object({
  schema_version: z.literal(1),
  kind: z.literal('unit-package'),
  subject: SubjectSchema,
  unit: UnitManifestSchema,
  lessons: z.array(LessonPackageItemSchema),
  questions: z.array(QuestionSchema),
  answers: z.array(AnswerSchema),
  sources: z.array(SourceSchema),
});
export type UnitPackage = z.infer<typeof UnitPackageSchema>;
