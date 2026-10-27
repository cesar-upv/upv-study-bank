import type { Question } from '@/domain/content/types';

export interface AttemptSummary {
  id: string;
  subjectId: string;
  unitId: string;
  questionId: string;
  type: string;
  score: number;
  maxScore: number;
  assisted: boolean;
  submittedAt: string;
}
export function latestAttempts(questions: Question[], attempts: AttemptSummary[]): Map<string, AttemptSummary> {
  const current = new Map(questions.map(question => [question.id, question]));
  const latest = new Map<string, AttemptSummary>();
  for (const attempt of attempts) {
    const question = current.get(attempt.questionId);
    if (!question || question.subject_id !== attempt.subjectId || question.unit_id !== attempt.unitId || question.type !== attempt.type) continue;
    if (!Number.isFinite(attempt.score) || !Number.isFinite(attempt.maxScore) || attempt.maxScore <= 0) continue;
    const previous = latest.get(attempt.questionId);
    if (!previous || attempt.submittedAt > previous.submittedAt || (attempt.submittedAt === previous.submittedAt && attempt.id > previous.id)) latest.set(attempt.questionId, attempt);
  }
  return latest;
}
export function failedQuestionIds(questions: Question[], attempts: AttemptSummary[]): Set<string> {
  return new Set([...latestAttempts(questions, attempts).values()].filter(attempt => attempt.type !== 'short_answer' && attempt.score < attempt.maxScore).map(attempt => attempt.questionId));
}
export function topicPerformance(questions: Question[], attempts: AttemptSummary[], topicIds: string[]) {
  const latest = latestAttempts(questions, attempts);
  return topicIds.map(topicId => {
    const objective = questions.filter(question => question.topic_id === topicId && question.type !== 'short_answer');
    const observed = objective.flatMap(question => { const attempt = latest.get(question.id); return attempt ? [attempt] : []; });
    const average = observed.length ? observed.reduce((sum, attempt) => sum + Math.min(1, Math.max(0, attempt.score / attempt.maxScore)), 0) / observed.length : null;
    return {
      topicId, total: objective.length, attempted: observed.length, average,
      unassistedCorrect: observed.filter(attempt => !attempt.assisted && attempt.score >= attempt.maxScore).length,
      failed: observed.filter(attempt => attempt.score < attempt.maxScore).length,
      selfAssessed: questions.filter(question => question.topic_id === topicId && question.type === 'short_answer' && latest.has(question.id)).length,
    };
  });
}
