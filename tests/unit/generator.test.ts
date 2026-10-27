import { describe, it, expect } from 'vitest';
import { generateQuestion } from '@/domain/practice/generator';

describe('Deterministic Generators and Fallback', () => {
  it('generates reproducible truth table question given identical seed', () => {
    const res1 = generateQuestion('truth-table-v1', 'basic', 12345);
    const res2 = generateQuestion('truth-table-v1', 'basic', 12345);

    expect(res1.question.prompt).toBe(res2.question.prompt);
    expect(res1.question.payload).toEqual(res2.question.payload);
    expect(res1.answer.solution).toEqual(res2.answer.solution);
    expect(res1.meta.seed).toBe(12345);
  });

  it('generates different questions for different seeds', () => {
    const res1 = generateQuestion('truth-table-v1', 'intermediate', 1111);
    const res2 = generateQuestion('truth-table-v1', 'intermediate', 9999);

    expect(res1.question.payload.formula).not.toBe(res2.question.payload.formula);
  });

  it('generates equivalence questions with certified truth value', () => {
    const res = generateQuestion('equivalence-v1', 'basic', 42);
    expect(res.question.type).toBe('equivalence');
    expect(typeof res.answer.solution.equivalent).toBe('boolean');
    if (!res.answer.solution.equivalent) {
      expect(res.answer.solution.counterexamples.length).toBeGreaterThan(0);
    }
  });

  it('generates SAT questions certified as satisfiable or unsatisfiable', () => {
    const res = generateQuestion('sat-v1', 'basic', 888);
    expect(res.question.type).toBe('sat');
    expect(typeof res.answer.solution.satisfiable).toBe('boolean');
  });

  it('generates translation questions with reviewed context templates', () => {
    const res = generateQuestion('translation-v1', 'basic', 777);
    expect(res.question.type).toBe('translation');
    expect(res.question.payload.variables).toEqual(['p', 'q']);
    expect(res.answer.solution.formula).toBeDefined();
  });
});
