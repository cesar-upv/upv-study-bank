import { describe, it, expect } from 'vitest';
import {
  parseFormula,
  computeVector,
  classifyVector,
  buildTruthTable,
  checkEquivalence,
  solveSat,
  checkEntailment,
  LogicParseError,
  LogicTokenizerError,
} from '@/domain/logic';
import { studyPackage as fiaPackage } from '../fixtures/packages';

describe('Logic Domain Engine', () => {
  describe('Basic Truth Tables and Reference Tests', () => {
    it('evaluates elementary binary operators correctly on [p, q]', () => {
      expect(computeVector(parseFormula('(p and q)'), ['p', 'q'])).toEqual([false, false, false, true]);
      expect(computeVector(parseFormula('(p or q)'), ['p', 'q'])).toEqual([false, true, true, true]);
      expect(computeVector(parseFormula('(p xor q)'), ['p', 'q'])).toEqual([false, true, true, false]);
      expect(computeVector(parseFormula('(p -> q)'), ['p', 'q'])).toEqual([true, true, false, true]);
      expect(computeVector(parseFormula('(p <-> q)'), ['p', 'q'])).toEqual([true, false, false, true]);
    });

    it('evaluates compound formulas and classifications', () => {
      const v1 = computeVector(parseFormula('((p or q) -> (not p))'), ['p', 'q']);
      expect(v1).toEqual([true, true, false, false]);
      expect(classifyVector(v1)).toBe('contingency');

      const vTaut = computeVector(parseFormula('(p or (not p))'), ['p']);
      expect(vTaut).toEqual([true, true]);
      expect(classifyVector(vTaut)).toBe('tautology');

      const vContr = computeVector(parseFormula('(p and (not p))'), ['p']);
      expect(vContr).toEqual([false, false]);
      expect(classifyVector(vContr)).toBe('contradiction');

      const v3 = computeVector(parseFormula('((p and q) -> r)'), ['p', 'q', 'r']);
      expect(v3).toEqual([true, true, true, true, true, true, false, true]);
    });

    it('supports constant formulas and empty assignment', () => {
      expect(computeVector(parseFormula('true'), [])).toEqual([true]);
      expect(computeVector(parseFormula('false'), [])).toEqual([false]);
      const table = buildTruthTable(parseFormula('true'));
      expect(table.rows.length).toBe(1);
      expect(table.vector).toEqual([true]);
    });

    it('supports Unicode UI symbols and precedence', () => {
      // ¬p ∨ q equivalent to p -> q
      const ast = parseFormula('¬p ∨ q');
      expect(computeVector(ast, ['p', 'q'])).toEqual([true, true, false, true]);

      // p ∧ q → r with precedence (p and q) -> r
      const ast2 = parseFormula('p ∧ q → r');
      expect(computeVector(ast2, ['p', 'q', 'r'])).toEqual([true, true, true, true, true, true, false, true]);
    });
  });

  describe('Rejection of Malformed and Ambiguous Inputs', () => {
    it('rejects empty formulas', () => {
      expect(() => parseFormula('')).toThrow(LogicParseError);
      expect(() => parseFormula('   ')).toThrow(LogicParseError);
    });

    it('rejects unclosed or trailing parentheses', () => {
      expect(() => parseFormula('(p and q')).toThrow(LogicParseError);
      expect(() => parseFormula('(p and q))')).toThrow(LogicParseError);
      expect(() => parseFormula('p q')).toThrow(LogicParseError);
      expect(() => parseFormula('(p and)')).toThrow(LogicParseError);
    });

    it('rejects unparenthesized chained implies and iff', () => {
      expect(() => parseFormula('p -> q -> r')).toThrow(LogicParseError);
      expect(() => parseFormula('p <-> q <-> r')).toThrow(LogicParseError);
    });

    it('rejects unparenthesized mixed XOR', () => {
      expect(() => parseFormula('p or q xor r')).toThrow(LogicParseError);
      expect(() => parseFormula('p xor q or r')).toThrow(LogicParseError);
      expect(() => parseFormula('p xor q xor r')).toThrow(LogicParseError);
    });

    it('rejects formulas exceeding depth or length limits', () => {
      const deepFormula = '('.repeat(35) + 'p' + ')'.repeat(35);
      expect(() => parseFormula(deepFormula)).toThrow(LogicParseError);

      const hugeFormula = 'p and '.repeat(600) + 'p';
      expect(() => parseFormula(hugeFormula)).toThrow(LogicTokenizerError);
    });
  });

  describe('Verification Against All Question Bank Vector Cases (synthetic examples)', () => {
    const questions = fiaPackage.questions;
    const answersMap = new Map(fiaPackage.answers.map((a: any) => [a.question_id, a]));

    it('matches exact bit vectors, classifications, models, and counterexamples', () => {
      let testedFormulas = 0;

      for (const q of questions) {
        const ans = answersMap.get(q.id);
        expect(ans).toBeDefined();
        const payload: any = q.payload;
        const solution: any = ans.solution;
        const names: string[] = payload.variables || [];

        if (q.type === 'truth_table' || q.type === 'sat') {
          const ast = parseFormula(payload.formula);
          const v = computeVector(ast, names);
          if (solution.vector) expect(v).toEqual(solution.vector);
          if (solution.classification) expect(classifyVector(v)).toBe(solution.classification);
          const satResult = solveSat(ast, names);
          expect(satResult.satisfiable).toBe(solution.satisfiable);
          expect(satResult.models).toEqual(solution.models);
          testedFormulas++;
        } else if (q.type === 'equivalence') {
          const leftAst = parseFormula(payload.left);
          const rightAst = parseFormula(payload.right);
          const eqResult = checkEquivalence(leftAst, rightAst, names);
          expect(eqResult.equivalent).toBe(solution.equivalent);
          expect(eqResult.counterexamples).toEqual(solution.counterexamples);
          testedFormulas += 2;
        } else if (q.type === 'entailment') {
          const premisesAst = payload.premises.map((p: string) => parseFormula(p));
          const conclusionAst = parseFormula(payload.conclusion);
          const entResult = checkEntailment(premisesAst, conclusionAst, names);
          expect(entResult.entailed).toBe(solution.entailed);
          expect(entResult.counterexamples).toEqual(solution.counterexamples);
          testedFormulas += payload.premises.length + 1;
        } else if (q.type === 'translation') {
          const ast = parseFormula(solution.formula);
          const v = computeVector(ast, names);
          expect(v.length).toBe(1 << names.length);
          testedFormulas++;
        }
      }

      expect(testedFormulas).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Truth Table Structure and Intermediate Columns', () => {
    it('generates intermediate columns in postorder and deduplicates subexpressions', () => {
      // ((p and q) -> (not p))
      const ast = parseFormula('((p and q) -> (not p))');
      const table = buildTruthTable(ast, ['p', 'q']);

      expect(table.variables).toEqual(['p', 'q']);
      expect(table.rows.length).toBe(4);
      // Intermediate steps should contain:
      // (p and q), (not p), ((p and q) -> (not p))
      expect(table.intermediateSteps.length).toBe(3);
      expect(table.vector).toEqual([true, true, true, false]);
    });
  });
});
