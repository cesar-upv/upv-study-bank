import type { Question, UnitManifest } from './types';

/** Describes what a unit can actually offer, including underfilled exam quotas. */
export function getUnitCapabilities(unit: UnitManifest, lessonCount: number, questions: Question[]) {
  const quotas = unit.exam?.quotas;
  let eligibleCount = 0;
  const countByTopic = new Map<string, number>();
  for (const question of questions) {
    if (question.exam_scope !== 'required') continue;
    eligibleCount++;
    if (quotas) countByTopic.set(question.topic_id, (countByTopic.get(question.topic_id) ?? 0) + 1);
  }
  const examQuestionCount = quotas
    ? Object.entries(quotas).reduce((total, [topic, count]) => total + Math.min(count, countByTopic.get(topic) ?? 0), 0)
    : Math.min(unit.exam?.question_count ?? 30, eligibleCount);
  const hasLessons = lessonCount > 0;
  const hasQuestions = questions.length > 0;
  const canExam = examQuestionCount > 0;
  const isExamOnly = !hasLessons && canExam && Boolean(unit.exam);
  const kind = hasLessons ? (hasQuestions ? 'study' : 'guide') : isExamOnly ? 'exam' : hasQuestions ? 'practice' : 'empty';
  return { hasLessons, hasQuestions, canExam, isExamOnly, examQuestionCount, kind } as const;
}
export type UnitCapabilities = ReturnType<typeof getUnitCapabilities>;
export const unitKindLabels: Record<UnitCapabilities['kind'], string> = {
  study: 'Guía y ejercicios', guide: 'Guía de estudio', exam: 'Simulacro', practice: 'Banco de ejercicios', empty: 'Sin contenido',
};

export function unitBasePath(unit: Pick<UnitManifest, 'subject_id' | 'id'>) {
  return `/subjects/${encodeURIComponent(unit.subject_id)}/units/${encodeURIComponent(unit.id)}`;
}

/** Tuple encoding keeps subject/unit IDs distinct even when they contain separators. */
export function unitPreferenceKey(subjectId: string, unitId: string) {
  return JSON.stringify([subjectId, unitId]);
}

export function topicTitle(topicId: string, topicIds: string[], titles: Record<string, string> = {}) {
  const index = topicIds.indexOf(topicId);
  return titles[topicId] || (index >= 0 ? `Tema ${index + 1}` : 'Tema de estudio');
}
