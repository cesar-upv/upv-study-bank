import { describe, expect, it } from 'vitest';
import { gradeResponse } from '@/domain/assessment/graders';
import { validateUnitPackage } from '@/domain/content/package-validator';
import { sampleExamQuestions } from '@/domain/exam/exam-service';
import type { Question, Answer } from '@/domain/content/types';
import template from '../../templates/unit-package.json';
const base = { ...template.questions[0], exam_scope: 'required' as const };
const matching = { ...base, type: 'matching', payload: { left: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], right: [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }] } } as Question;
const answer: Answer = { question_id: base.id, solution: { pairs: { a: 'y', b: 'x' } }, explanation: 'Ejemplo.' };
describe('Extensible question contracts', () => {
  it('grades matching partially and does not count omitted pairs', () => {
    expect(gradeResponse(matching, answer, { type: 'matching', pairs: { a: 'y' } }).score).toBe(.5);
    expect(gradeResponse(matching, answer, { type: 'matching', pairs: { a: 'y', b: 'x' } }).isCorrect).toBe(true);
  });
  it('requires exact sets for multiple choice, independent of order', () => {
    const q = { ...base, type: 'multiple_choice' } as Question;
    const a = { ...answer, solution: { correct_option_ids: ['a', 'c'] } };
    expect(gradeResponse(q, a, { type: 'multiple_choice', selectedOptionIds: ['c', 'a'] }).score).toBe(1);
    expect(gradeResponse(q, a, { type: 'multiple_choice', selectedOptionIds: ['a', 'b', 'c'] }).score).toBe(0);
  });
  it('checks ordering and rejects mixed response types', () => {
    const q = { ...base, type: 'ordering' } as Question;
    const a = { ...answer, solution: { ordered_ids: ['c', 'a', 'b'] } };
    expect(gradeResponse(q, a, { type: 'ordering', orderedIds: ['c', 'a', 'b'] }).score).toBe(1);
    expect(gradeResponse(q, a, { type: 'ordering', orderedIds: ['a', 'b', 'c'] }).score).toBe(0);
    expect(() => gradeResponse(q, a, { type: 'matching', pairs: {} })).toThrow();
  });
  it('validates the entire matching contract and rejects dangling relations', () => {
    const pkg = { ...template, questions: [matching], answers: [answer] };
    expect(validateUnitPackage(pkg).errors).toEqual([]);
    expect(validateUnitPackage({ ...pkg, answers: [{ ...answer, solution: { pairs: { a: 'z', b: 'x' } } }] }).valid).toBe(false);
    expect(validateUnitPackage({ ...pkg, questions: [{ ...matching, payload: {} }] }).valid).toBe(false);
  });
  it('samples other subjects and small banks without duplicates or optional questions', () => {
    const optional = { ...matching, id: 'optional', exam_scope: 'optional' } as Question;
    expect(sampleExamQuestions([matching, optional]).map(q => q.id)).toEqual([matching.id]);
    expect(sampleExamQuestions([])).toEqual([]);
  });
});
