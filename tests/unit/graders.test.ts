import { describe, it, expect } from 'vitest';
import { graders } from '@/domain/assessment/graders';
import { Question, Answer } from '@/domain/content/types';

describe('Assessment Graders', () => {
  it('grades single_choice questions correctly', () => {
    const q: Question = {
      schema_version: 1,
      id: 'q1',
      subject_id: 'sub',
      unit_id: 'u1',
      topic_id: 't1',
      type: 'single_choice',
      difficulty: 'basic',
      exam_scope: 'required',
      prompt: 'Pregunta?',
      payload: { options: [{ id: 'a', text: 'Op A' }, { id: 'b', text: 'Op B' }] },
      hints: [],
      source_ids: [],
    };
    const a: Answer = {
      question_id: 'q1',
      solution: { correct_option_id: 'a' },
      explanation: 'Explicación A',
    };

    const resCorrect = graders.single_choice(q, a, { type: 'single_choice', selectedOptionId: 'a' });
    expect(resCorrect.score).toBe(1);
    expect(resCorrect.isCorrect).toBe(true);

    const resWrong = graders.single_choice(q, a, { type: 'single_choice', selectedOptionId: 'b' });
    expect(resWrong.score).toBe(0);
    expect(resWrong.isCorrect).toBe(false);
  });

  it('grades translation accepting equivalent formulas and rejecting undeclared variables', () => {
    const q: Question = {
      schema_version: 1,
      id: 'q_tr',
      subject_id: 'sub',
      unit_id: 'u1',
      topic_id: 't1',
      type: 'translation',
      difficulty: 'basic',
      exam_scope: 'required',
      prompt: 'Traducción de p solo si q',
      payload: { bindings: { p: 'p', q: 'q' }, variables: ['p', 'q'] },
      hints: [],
      source_ids: [],
    };
    const a: Answer = {
      question_id: 'q_tr',
      solution: { formula: '(p -> q)' },
      explanation: 'p -> q',
    };

    // 1. Exact formula
    expect(graders.translation(q, a, { type: 'translation', formula: '(p -> q)' }).score).toBe(1);

    // 2. Semantically equivalent formula: (not p) or q
    expect(graders.translation(q, a, { type: 'translation', formula: '((not p) or q)' }).score).toBe(1);

    // 3. Converse formula: q -> p (should fail)
    expect(graders.translation(q, a, { type: 'translation', formula: '(q -> p)' }).score).toBe(0);

    // 4. Undeclared variable 'r' (should fail even if part of a tautology)
    const resUndeclared = graders.translation(q, a, {
      type: 'translation',
      formula: '((p -> q) and (r or (not r)))',
    });
    expect(resUndeclared.score).toBe(0);
    expect(resUndeclared.feedback).toContain('Variable no declarada');
  });

  it('grades truth_table with cell-by-cell score and classification', () => {
    const q: Question = {
      schema_version: 1,
      id: 'q_tt',
      subject_id: 'sub',
      unit_id: 'u1',
      topic_id: 'tablas',
      type: 'truth_table',
      difficulty: 'basic',
      exam_scope: 'required',
      prompt: 'Tabla de p or q',
      payload: { formula: '(p or q)', variables: ['p', 'q'], row_order: 'false_first_lexicographic' },
      hints: [],
      source_ids: [],
    };
    const a: Answer = {
      question_id: 'q_tt',
      solution: {
        vector: [false, true, true, true],
        classification: 'contingency',
        satisfiable: true,
        models: [{ p: false, q: true }],
      },
      explanation: 'p or q',
    };

    // All cells correct + correct classification
    const fullCorrect = graders.truth_table(q, a, {
      type: 'truth_table',
      cells: {
        '0_step_0': false,
        '1_step_0': true,
        '2_step_0': true,
        '3_step_0': true,
      },
      classification: 'contingency',
    });
    expect(fullCorrect.score).toBe(1);
    expect(fullCorrect.isCorrect).toBe(true);

    // Empty cell is not counted as false
    const partialCells = graders.truth_table(q, a, {
      type: 'truth_table',
      cells: {
        '0_step_0': false, // correct
        '1_step_0': null,  // empty!
        '2_step_0': null,  // empty!
        '3_step_0': null,  // empty!
      },
      classification: 'contingency',
    });
    // 1 cell out of 4 correct = 0.25 * 0.5 + 0.5 (classification) = 0.63
    expect(partialCells.score).toBeCloseTo(0.63, 1);
  });

  it('grades equivalence with decision and counterexamples', () => {
    const q: Question = {
      schema_version: 1,
      id: 'q_eq',
      subject_id: 'sub',
      unit_id: 'u1',
      topic_id: 'eq',
      type: 'equivalence',
      difficulty: 'basic',
      exam_scope: 'required',
      prompt: '¿Son equivalentes p -> q y q -> p?',
      payload: { left: '(p -> q)', right: '(q -> p)', variables: ['p', 'q'] },
      hints: [],
      source_ids: [],
    };
    const a: Answer = {
      question_id: 'q_eq',
      solution: {
        equivalent: false,
        counterexamples: [{ p: true, q: false }, { p: false, q: true }],
      },
      explanation: 'No son equivalentes',
    };

    // Decision only: 0.5
    const resDecisionOnly = graders.equivalence(q, a, {
      type: 'equivalence',
      equivalent: false,
    });
    expect(resDecisionOnly.score).toBe(0.5);

    // Decision + valid counterexample: 1.0
    const resWithCE = graders.equivalence(q, a, {
      type: 'equivalence',
      equivalent: false,
      counterexample: { p: true, q: false },
    });
    expect(resWithCE.score).toBe(1.0);
    expect(resWithCE.isCorrect).toBe(true);

    // Decision + invalid assignment (p=false, q=false makes both true): 0.5
    const resWithInvalidCE = graders.equivalence(q, a, {
      type: 'equivalence',
      equivalent: false,
      counterexample: { p: false, q: false },
    });
    expect(resWithInvalidCE.score).toBe(0.5);
  });

  it('grades sat accepting any valid witness model', () => {
    const q: Question = {
      schema_version: 1,
      id: 'q_sat',
      subject_id: 'sub',
      unit_id: 'u1',
      topic_id: 'sat',
      type: 'sat',
      difficulty: 'basic',
      exam_scope: 'required',
      prompt: '¿Es satisfacible p or q?',
      payload: { formula: '(p or q)', variables: ['p', 'q'] },
      hints: [],
      source_ids: [],
    };
    const a: Answer = {
      question_id: 'q_sat',
      solution: {
        satisfiable: true,
        vector: [false, true, true, true],
        classification: 'contingency',
        models: [{ p: false, q: true }],
      },
      explanation: 'Sí',
    };

    // Model p=true, q=true is alternative valid model (different from reference solution model {p: false, q: true})
    const resModel = graders.sat(q, a, {
      type: 'sat',
      satisfiable: true,
      model: { p: true, q: true },
    });
    expect(resModel.score).toBe(1.0);
    expect(resModel.isCorrect).toBe(true);

    // Invalid model: p=false, q=false (formula is false)
    const resBadModel = graders.sat(q, a, {
      type: 'sat',
      satisfiable: true,
      model: { p: false, q: false },
    });
    expect(resBadModel.score).toBe(0.5);
  });

  it('grades entailment with decision and counterexample', () => {
    const q: Question = {
      schema_version: 1,
      id: 'q_ent',
      subject_id: 'sub',
      unit_id: 'u1',
      topic_id: 'kb',
      type: 'entailment',
      difficulty: 'basic',
      exam_scope: 'required',
      prompt: 'KB: {q, p -> q} |= p ?',
      payload: { premises: ['q', '(p -> q)'], conclusion: 'p', variables: ['p', 'q'] },
      hints: [],
      source_ids: [],
    };
    const a: Answer = {
      question_id: 'q_ent',
      solution: {
        entailed: false,
        counterexamples: [{ p: false, q: true }],
      },
      explanation: 'Falacia de afirmación del consecuente',
    };

    const resValid = graders.entailment(q, a, {
      type: 'entailment',
      entailed: false,
      counterexample: { p: false, q: true },
    });
    expect(resValid.score).toBe(1.0);
    expect(resValid.isCorrect).toBe(true);
  });
});
