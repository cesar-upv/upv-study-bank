import { Question, Answer } from '@/domain/content/types';

export interface GradeResult {
  score: number; // 0.0 to 1.0 (or rubric points for short_answer)
  maxScore: number;
  isAutograded: boolean;
  isCorrect: boolean; // score === maxScore (or 1.0)
  feedback: string;
  details?: Record<string, any>;
}

export type StudentResponse =
  | { type: 'multiple_choice'; selectedOptionIds: string[] }
  | { type: 'matching'; pairs: Record<string, string> }
  | { type: 'ordering'; orderedIds: string[] }
  | { type: 'single_choice'; selectedOptionId: string }
  | { type: 'proposition_check'; isProposition: boolean }
  | { type: 'translation'; formula: string }
  | {
      type: 'truth_table';
      // cellKey: `${rowIdx}_${colId}` -> boolean | null
      cells: Record<string, boolean | null>;
      classification?: string;
    }
  | {
      type: 'equivalence';
      equivalent: boolean;
      counterexample?: Record<string, boolean>;
    }
  | {
      type: 'sat';
      satisfiable: boolean;
      model?: Record<string, boolean>;
    }
  | {
      type: 'entailment';
      entailed: boolean;
      counterexample?: Record<string, boolean>;
    }
  | {
      type: 'short_answer';
      studentText: string;
      criteriaScores?: Record<number, number>; // criterionIdx -> points
    };

export interface QuestionGrader<T extends StudentResponse = StudentResponse> {
  grade(question: Question, answer: Answer, response: T): GradeResult;
}
