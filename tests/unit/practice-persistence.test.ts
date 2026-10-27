import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/infrastructure/persistence/db';
import { graders } from '@/domain/assessment/graders';
import { Question, Answer } from '@/domain/content/types';

describe('Practice Attempts and Review Persistence', () => {
  beforeEach(async () => {
    await db.attempts.clear();
    await db.reviewItems.clear();
  });

  const dummyQuestion: Question = {
    schema_version: 1,
    id: 'fia-test-001',
    subject_id: 'pruebas',
    unit_id: 'guia',
    topic_id: 'historia',
    type: 'single_choice',
    difficulty: 'basic',
    exam_scope: 'required',
    prompt: '¿En qué año propuso Turing el juego de imitación?',
    payload: {
      options: [
        { id: 'a', text: '1943' },
        { id: 'b', text: '1950' },
        { id: 'c', text: '1956' },
        { id: 'd', text: '1958' },
      ],
    },
    hints: ['Publicado en la revista Mind'],
    source_ids: ['turing1950'],
  };

  const dummyAnswer: Answer = {
    question_id: 'fia-test-001',
    solution: { correct_option_id: 'b' },
    explanation: 'Alan Turing publicó Computing Machinery and Intelligence en 1950.',
  };

  it('records attempt and applies spaced repetition rule for error (0 days / today)', async () => {
    const wrongResponse = { type: 'single_choice' as const, selectedOptionId: 'a' };
    const grade = graders.single_choice(dummyQuestion, dummyAnswer, wrongResponse);

    expect(grade.isCorrect).toBe(false);

    // Save attempt
    const attemptId = 'att-1';
    await db.attempts.add({
      id: attemptId,
      subjectId: dummyQuestion.subject_id,
      unitId: dummyQuestion.unit_id,
      questionId: dummyQuestion.id,
      contentRevision: 1,
      type: dummyQuestion.type,
      submittedResponse: wrongResponse,
      score: grade.score,
      maxScore: grade.maxScore,
      assisted: false,
      submittedAt: new Date().toISOString(),
      feedback: grade.feedback,
    });

    // Review item rule: error -> 0 days
    const reviewKey = `${dummyQuestion.subject_id}:${dummyQuestion.unit_id}:${dummyQuestion.id}`;
    const due = new Date();
    await db.reviewItems.put({
      id: reviewKey,
      subjectId: dummyQuestion.subject_id,
      unitId: dummyQuestion.unit_id,
      questionId: dummyQuestion.id,
      dueDate: due.toISOString(),
      intervalDays: 0,
      consecutiveUnassisted: 0,
      lastAttemptId: attemptId,
      lastScore: grade.score,
      updatedAt: new Date().toISOString(),
    });

    const storedAttempts = await db.attempts.toArray();
    expect(storedAttempts.length).toBe(1);
    expect(storedAttempts[0].score).toBe(0);
    expect(storedAttempts[0].assisted).toBe(false);

    const storedReview = await db.reviewItems.get(reviewKey);
    expect(storedReview).toBeDefined();
    expect(storedReview?.intervalDays).toBe(0);
    expect(storedReview?.consecutiveUnassisted).toBe(0);
  });

  it('records assisted correct attempt (1 day / tomorrow)', async () => {
    const correctResponse = { type: 'single_choice' as const, selectedOptionId: 'b' };
    const grade = graders.single_choice(dummyQuestion, dummyAnswer, correctResponse);

    expect(grade.isCorrect).toBe(true);

    const attemptId = 'att-assisted';
    await db.attempts.add({
      id: attemptId,
      subjectId: dummyQuestion.subject_id,
      unitId: dummyQuestion.unit_id,
      questionId: dummyQuestion.id,
      contentRevision: 1,
      type: dummyQuestion.type,
      submittedResponse: correctResponse,
      score: grade.score,
      maxScore: grade.maxScore,
      assisted: true,
      submittedAt: new Date().toISOString(),
      feedback: grade.feedback,
    });

    // Assisted correct -> interval 1 day, consecutive unassisted = 0
    const reviewKey = `${dummyQuestion.subject_id}:${dummyQuestion.unit_id}:${dummyQuestion.id}`;
    const due = new Date();
    due.setDate(due.getDate() + 1);
    await db.reviewItems.put({
      id: reviewKey,
      subjectId: dummyQuestion.subject_id,
      unitId: dummyQuestion.unit_id,
      questionId: dummyQuestion.id,
      dueDate: due.toISOString(),
      intervalDays: 1,
      consecutiveUnassisted: 0,
      lastAttemptId: attemptId,
      lastScore: grade.score,
      updatedAt: new Date().toISOString(),
    });

    const storedReview = await db.reviewItems.get(reviewKey);
    expect(storedReview?.intervalDays).toBe(1);
    expect(storedReview?.consecutiveUnassisted).toBe(0);
  });

  it('advances unassisted streak: 3 days -> 7 days -> 14 days', async () => {
    const reviewKey = `${dummyQuestion.subject_id}:${dummyQuestion.unit_id}:${dummyQuestion.id}`;

    // 1st unassisted correct -> 3 days
    let consecutive = 1;
    let intervalDays = 3;
    await db.reviewItems.put({
      id: reviewKey,
      subjectId: dummyQuestion.subject_id,
      unitId: dummyQuestion.unit_id,
      questionId: dummyQuestion.id,
      dueDate: new Date().toISOString(),
      intervalDays,
      consecutiveUnassisted: consecutive,
      updatedAt: new Date().toISOString(),
    });

    let item = await db.reviewItems.get(reviewKey);
    expect(item?.intervalDays).toBe(3);
    expect(item?.consecutiveUnassisted).toBe(1);

    // 2nd unassisted correct -> 7 days
    consecutive = 2;
    intervalDays = 7;
    await db.reviewItems.put({
      id: reviewKey,
      subjectId: dummyQuestion.subject_id,
      unitId: dummyQuestion.unit_id,
      questionId: dummyQuestion.id,
      dueDate: new Date().toISOString(),
      intervalDays,
      consecutiveUnassisted: consecutive,
      updatedAt: new Date().toISOString(),
    });

    item = await db.reviewItems.get(reviewKey);
    expect(item?.intervalDays).toBe(7);
    expect(item?.consecutiveUnassisted).toBe(2);

    // 3rd unassisted correct -> 14 days
    consecutive = 3;
    intervalDays = 14;
    await db.reviewItems.put({
      id: reviewKey,
      subjectId: dummyQuestion.subject_id,
      unitId: dummyQuestion.unit_id,
      questionId: dummyQuestion.id,
      dueDate: new Date().toISOString(),
      intervalDays,
      consecutiveUnassisted: consecutive,
      updatedAt: new Date().toISOString(),
    });

    item = await db.reviewItems.get(reviewKey);
    expect(item?.intervalDays).toBe(14);
    expect(item?.consecutiveUnassisted).toBe(3);
  });
});
