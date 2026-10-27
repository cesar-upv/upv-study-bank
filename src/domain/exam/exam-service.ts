import { Question, Answer } from '@/domain/content/types';
import { StudentResponse, GradeResult } from '@/domain/assessment/types';
import { gradeResponse } from '@/domain/assessment/graders';

/**
 * Samples questions without replacement using optional per-topic quotas.
 */
export function sampleExamQuestions(allQuestions: Question[], quotas?: Record<string, number>, count = 30): Question[] {
  allQuestions = allQuestions.filter(q => q.exam_scope === 'required');
  const byTopic: Record<string, Question[]> = Object.create(null);
  for (const q of allQuestions) {
    if (!byTopic[q.topic_id]) byTopic[q.topic_id] = [];
    byTopic[q.topic_id].push(q);
  }

  const selected: Question[] = [];

  if (!quotas) {
    quotas = Object.create(null) as Record<string, number>;
    const topics = Object.keys(byTopic);
    let remaining = Math.min(count, allQuestions.length);
    while (remaining > 0) for (const topic of topics) {
      if (remaining > 0 && (quotas[topic] || 0) < byTopic[topic].length) { quotas[topic] = (quotas[topic] || 0) + 1; remaining--; }
    }
  }
  for (const [topicId, quota] of Object.entries(quotas)) {
    const candidates = [...(byTopic[topicId] || [])];
    // Fisher-Yates shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const picked = candidates.slice(0, quota);
    selected.push(...picked);
  }

  // Shuffle final list of questions
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected;
}

/** Whether a response contains an answer, including a deliberate false choice. */
export function hasExamResponse(response?: StudentResponse): boolean {
  if (!response) return false;
  switch (response.type) {
    case 'single_choice': return Boolean(response.selectedOptionId);
    case 'multiple_choice': return response.selectedOptionIds.length > 0;
    case 'matching': return Object.values(response.pairs).some(Boolean);
    case 'ordering': return response.orderedIds.length > 0;
    case 'translation': return Boolean(response.formula.trim());
    case 'short_answer': return Boolean(response.studentText.trim());
    case 'truth_table': return Boolean(response.classification) || Object.values(response.cells).some(value => value !== null);
    default: return true;
  }
}

export interface ExamScoringResult {
  autogradedTotalScore: number; // sum of scores
  autogradedCount: number; // total autograded questions
  autogradedAverage: number; // 0.0 to 1.0
  unansweredCount: number; // unanswered autogradable questions
  selfAssessedCount: number; // short_answer questions
  questionGrades: Record<string, GradeResult>;
}

export function evaluateExam(
  questions: Question[],
  answersMap: Map<string, Answer>,
  responses: Record<string, StudentResponse>
): ExamScoringResult {
  let autogradedTotal = 0;
  let autogradedCount = 0;
  let unansweredCount = 0;
  let selfAssessedCount = 0;
  const questionGrades: Record<string, GradeResult> = Object.create(null);

  for (const q of questions) {
    const a = answersMap.get(q.id);
    if (!a) continue;

    const resp = Object.hasOwn(responses, q.id) ? responses[q.id] : undefined;

    if (q.type === 'short_answer') {
      selfAssessedCount++;
      if (resp) {
        questionGrades[q.id] = gradeResponse(q, a, resp);
      } else {
        questionGrades[q.id] = gradeResponse(q, a, { type: 'short_answer', studentText: '', criteriaScores: {} });
      }
    } else {
      autogradedCount++;
      if (!resp || !hasExamResponse(resp)) {
        unansweredCount++;
        questionGrades[q.id] = {
          score: 0,
          maxScore: 1,
          isAutograded: true,
          isCorrect: false,
          feedback: 'Pregunta omitida (sin respuesta).',
        };
      } else {
        const grade = gradeResponse(q, a, resp);
        questionGrades[q.id] = grade;
        autogradedTotal += grade.score;
      }
    }
  }

  const autogradedAverage = autogradedCount > 0 ? autogradedTotal / autogradedCount : 0;

  return {
    autogradedTotalScore: autogradedTotal,
    autogradedCount,
    autogradedAverage: Math.round(autogradedAverage * 100) / 100,
    unansweredCount,
    selfAssessedCount,
    questionGrades,
  };
}
