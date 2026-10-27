import { expect, it } from 'vitest';
import { failedQuestionIds, topicPerformance, type AttemptSummary } from '@/domain/progress/performance';
import { validateUnitPackage } from '@/domain/content/package-validator';
import raw from '../../templates/matematicas.unit-package.json';
const pkg = validateUnitPackage(raw).data!;
const question = pkg.questions[0];
const attempt = (id: string, score: number, extras: Partial<AttemptSummary> = {}): AttemptSummary => ({ id, questionId: question.id, type: question.type, subjectId: pkg.subject.id, unitId: pkg.unit.id, maxScore: 1, score, assisted: false, submittedAt: `2026-10-${id}T12:00:00.000Z`, ...extras });
it('uses the latest attempt rather than retaining an old error', () => {
  const attempts = [attempt('21', 0), attempt('22', 1)];
  expect(failedQuestionIds(pkg.questions, attempts).size).toBe(0);
  expect(failedQuestionIds(pkg.questions, attempts.reverse()).size).toBe(0);
});
it('includes partial credit as an error and normalizes scores', () => {
  const attempts = [attempt('22', 1, { maxScore: 2, assisted: true })];
  expect(failedQuestionIds(pkg.questions, attempts).has(question.id)).toBe(true);
  const topic = topicPerformance(pkg.questions, attempts, [question.topic_id])[0];
  expect(topic.average).toBe(.5);
  expect(topic.attempted).toBe(1);
  expect(topic.unassistedCorrect).toBe(0);
});
it('ignores other units, removed questions, invalid scores and self-assessments in objective metrics', () => {
  const attempts = [attempt('20', 0, { unitId: 'other' }), attempt('21', 0, { questionId: 'removed' }), attempt('22', 0, { maxScore: 0 })];
  const shortQuestion = { ...question, id: 'short', type: 'short_answer' as const };
  attempts.push(attempt('23', 0, { questionId: 'short', type: 'short_answer' }));
  expect(failedQuestionIds([...pkg.questions, shortQuestion], attempts).size).toBe(0);
  const topic = topicPerformance([...pkg.questions, shortQuestion], attempts, [question.topic_id])[0];
  expect(topic.average).toBeNull();
  expect(topic.selfAssessed).toBe(1);
  expect(topic.total).toBe(pkg.questions.filter(q => q.topic_id === question.topic_id).length);
});
