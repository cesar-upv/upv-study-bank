import type { UnitPackage, Question, Answer } from '../../src/domain/content/types';
import math from '../../templates/matematicas.unit-package.json' with { type: 'json' };
import { generatorFallback } from '../../src/domain/practice/fallbacks';

// Synthetic application data. Never import a student's course into the test suite.
const questionExamples: { question: Question; answer: Answer }[] = [
  ...math.questions.map((question, index) => ({ question: question as Question, answer: math.answers[index] as Answer })),
  { question: { ...math.questions[0], type: 'proposition_check', prompt: '¿Es «2 es par» una proposición?', payload: { statement: '2 es par' } } as Question, answer: { question_id: '', solution: { is_proposition: true }, explanation: 'Tiene un valor de verdad.' } },
  ...['translation', 'truth_table', 'equivalence', 'sat'].map(generatorFallback),
  { question: { ...math.questions[0], type: 'entailment', prompt: '¿Se deduce q?', payload: { premises: ['p', '(p -> q)'], conclusion: 'q', variables: ['p', 'q'] } } as Question, answer: { question_id: '', solution: { entailed: true, counterexamples: [] }, explanation: 'Por modus ponens.' } },
  { question: { ...math.questions[0], type: 'short_answer', prompt: 'Explica qué es un conjunto.', payload: { evaluation: 'self_assessment' } } as Question, answer: { question_id: '', solution: { model_answer: 'Una colección de elementos.', rubric: [{ criterion: 'Define una colección', points: 1 }] }, explanation: 'Comprueba tu explicación con la rúbrica.' } },
];

function makePackage(id: string, title: string, lessonCount: number, questionCount: number): UnitPackage {
  const topicIds = Array.from({ length: Math.max(lessonCount, 10) }, (_, index) => `tema-${index + 1}`);
  const lessons = Array.from({ length: lessonCount }, (_, index) => ({
    path: `lessons/${index + 1}.md`,
    markdown: `---\nschema_version: 1\nid: ${id}-leccion-${index + 1}\nsubject_id: pruebas\nunit_id: ${id}\ntopic_id: ${topicIds[index]}\ntitle: ${index === 0 ? 'Primeros pasos' : index === 1 ? 'Operaciones con conjuntos' : `Lección ${index + 1}`}\norder: ${index + 1}\nexam_scope: required\nsource_ids: []\n---\n\n# ${index === 0 ? 'Primeros pasos' : index === 1 ? 'Operaciones con conjuntos' : `Lección ${index + 1}`}\n\nMaterial sintético de prueba: $A \\cup B$.\n`,
  }));
  const questions: Question[] = [];
  const answers: Answer[] = [];
  for (let index = 0; index < questionCount; index++) {
    const example = questionExamples[id === 'simulacro' ? 0 : index % questionExamples.length];
    const questionId = `${id}-pregunta-${index + 1}`;
    questions.push({ ...structuredClone(example.question), id: questionId, subject_id: 'pruebas', unit_id: id, topic_id: topicIds[index % topicIds.length], exam_scope: 'required' });
    answers.push({ ...structuredClone(example.answer), question_id: questionId });
  }
  return {
    schema_version: 1, kind: 'unit-package',
    subject: { id: 'pruebas', title: 'Materia de prueba', description: 'Datos sintéticos para pruebas automatizadas.', unit_ids: [id] },
    unit: { schema_version: 1, id, subject_id: 'pruebas', title, revision: 1, topic_ids: topicIds, lessons: lessons.map(lesson => lesson.path), questions: 'questions.json', answers: 'answers.json', exam: { question_count: Math.min(questionCount, 30), duration_minutes: 45 } },
    lessons, questions, answers, sources: [],
  };
}

export const extraPackage = makePackage('complementaria', 'Práctica complementaria', 12, 120);
export const studyPackage = makePackage('guia', 'Guía de prueba', 10, 120);
export const guidePackage = makePackage('razonamiento', 'Razonamiento y operaciones', 8, 48);
export const examPackage = makePackage('simulacro', 'Simulacro de razonamiento', 0, 15);
export const libraryPackages = [extraPackage, studyPackage, examPackage, guidePackage];
export const testQuotas = Object.fromEntries(studyPackage.unit.topic_ids.map((id, index) => [id, index % 2 ? 2 : 4]));
