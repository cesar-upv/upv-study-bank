import { testQuotas as EXAM_QUOTAS } from '../fixtures/packages';
import { describe, it, expect, beforeEach } from 'vitest';
import { sampleExamQuestions, evaluateExam, hasExamResponse } from '@/domain/exam/exam-service';
import { contentRepo } from '@/infrastructure/content/repository';
import { db } from '@/infrastructure/persistence/db';
import templatePackage from '@/../templates/unit-package.json';

describe('Exam Sampling, Evaluation, and Package Import', () => {
  beforeEach(async () => {
    await db.importedPackages.clear();
    await db.sessions.clear();
  });

  it('samples 30 questions without replacement adhering to topic quotas', async () => {
    const questions = await contentRepo.getQuestions('pruebas', 'guia');
    const sampled = sampleExamQuestions(questions, EXAM_QUOTAS);

    expect(sampled.length).toBe(30);

    // Verify all IDs are unique (without replacement)
    const idSet = new Set(sampled.map((q) => q.id));
    expect(idSet.size).toBe(30);

    // Verify quotas by topic
    const counts: Record<string, number> = {};
    for (const q of sampled) {
      counts[q.topic_id] = (counts[q.topic_id] || 0) + 1;
    }

    for (const [topicId, expectedCount] of Object.entries(EXAM_QUOTAS)) {
      expect(counts[topicId]).toBe(expectedCount);
    }
  });

  it('evaluates exam questions, penalizes omissions with 0, and separates open answers', async () => {
    const questions = await contentRepo.getQuestions('pruebas', 'guia');
    const answers = await contentRepo.getAnswers('pruebas', 'guia');
    const aMap = new Map(answers.map((a) => [a.question_id, a]));

    // Include a known objective question so the scoring assertion cannot depend on a random sample.
    const scQuestion = questions.find((q) => q.type === 'single_choice')!;
    const sampled = [scQuestion, ...sampleExamQuestions(questions.filter(q => q.id !== scQuestion.id), EXAM_QUOTAS).slice(0, 29)];
    const scAnswer = aMap.get(scQuestion.id)!;
    const responses: Record<string, any> = {
      [scQuestion.id]: {
        type: 'single_choice',
        selectedOptionId: scAnswer.solution.correct_option_id,
      },
    };

    const evalResult = evaluateExam(sampled, aMap, responses);

    expect(evalResult.autogradedCount + evalResult.selfAssessedCount).toBe(30);
    expect(evalResult.unansweredCount).toBeGreaterThan(0);
    expect(evalResult.questionGrades[scQuestion.id].score).toBe(1);
  });

  it('imports templates/unit-package.json into catalog and isolates content', async () => {
    await contentRepo.saveImportedPackage(templatePackage as any);

    const subjects = await contentRepo.getSubjects();
    const exampleSubject = subjects.find((s) => s.id === 'materia-ejemplo');
    expect(exampleSubject).toBeDefined();
    expect(exampleSubject?.title).toBe('Materia de ejemplo');

    const lessons = await contentRepo.getLessons('materia-ejemplo', 'unidad-01');
    expect(lessons.length).toBe(1);
    expect(lessons[0].frontmatter.title).toBe('Lectura de una guía');

    const questions = await contentRepo.getQuestions('materia-ejemplo', 'unidad-01');
    expect(questions.length).toBe(1);
    expect(questions[0].id).toBe('ejemplo-u01-single_choice-001');

    // Fundamentals of AI remains unaffected
    const fiaQuestions = await contentRepo.getQuestions('pruebas', 'guia');
    expect(fiaQuestions.length).toBe(120);
  });
});

it('counts cleared answers as omissions while preserving deliberate false answers', async () => {
  const questions = await contentRepo.getQuestions('pruebas', 'guia');
  const answers = await contentRepo.getAnswers('pruebas', 'guia');
  const q = questions.find(q => q.type === 'translation')!;
  const result = evaluateExam([q], new Map(answers.map(a => [a.question_id, a])), {
    [q.id]: { type: 'translation', formula: '   ' },
  });
  expect(result.unansweredCount).toBe(1);
  expect(result.questionGrades[q.id].score).toBe(0);
  expect(hasExamResponse({ type: 'proposition_check', isProposition: false })).toBe(true);
  expect(hasExamResponse({ type: 'multiple_choice', selectedOptionIds: [] })).toBe(false);
  expect(hasExamResponse({ type: 'truth_table', cells: { '0_p': null } })).toBe(false);
  expect(hasExamResponse({ type: 'truth_table', cells: { '0_p': false } })).toBe(true);
});

it('handles imported identifiers that coincide with object prototype properties', async () => {
  const original = (await contentRepo.getQuestions('pruebas', 'guia')).find(q => q.type === 'single_choice')!;
  const answer = (await contentRepo.getAnswers('pruebas', 'guia')).find(a => a.question_id === original.id)!;
  const questions = ['constructor', '__proto__', 'toString'].map(id => ({ ...original, id, topic_id: id }));
  expect(sampleExamQuestions(questions, undefined, 3)).toHaveLength(3);
  const result = evaluateExam(questions, new Map(questions.map(q => [q.id, { ...answer, question_id: q.id }])), {});
  expect(result.unansweredCount).toBe(3);
  expect(Object.keys(result.questionGrades)).toHaveLength(3);
  expect(result.questionGrades.__proto__.score).toBe(0);
});
