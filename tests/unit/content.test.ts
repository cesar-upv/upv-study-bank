import { describe, it, expect } from 'vitest';
import { contentRepo } from '@/infrastructure/content/repository';
import { validateUnitPackage } from '@/domain/content/package-validator';
import templatePackage from '@/../templates/unit-package.json';

describe('Content and Package Validation', () => {
  it('loads synthetic package with 10 lessons and 120 questions', async () => {
    const subjects = await contentRepo.getSubjects();
    expect(subjects.length).toBeGreaterThanOrEqual(1);

    const fia = await contentRepo.getSubject('pruebas');
    expect(fia).toBeDefined();
    expect(fia?.title).toBe('Materia de prueba');

    const lessons = await contentRepo.getLessons('pruebas', 'guia');
    expect(lessons.length).toBe(10);

    const questions = await contentRepo.getQuestions('pruebas', 'guia');
    expect(questions.length).toBe(120);

    const answers = await contentRepo.getAnswers('pruebas', 'guia');
    expect(answers.length).toBe(120);

    // Verify all 10 topics are present
    const topics = new Set(lessons.map((l) => l.frontmatter.topic_id));
    expect(topics.size).toBe(10);
    expect(topics.has('tema-1')).toBe(true);
    expect(topics.has('tema-2')).toBe(true);
    expect(topics.has('tema-3')).toBe(true);
    expect(topics.has('tema-4')).toBe(true);
    expect(topics.has('tema-5')).toBe(true);
    expect(topics.has('tema-6')).toBe(true);
    expect(topics.has('tema-7')).toBe(true);
    expect(topics.has('tema-8')).toBe(true);
    expect(topics.has('tema-9')).toBe(true);
    expect(topics.has('tema-10')).toBe(true);
  });

  it('validates templates/unit-package.json as valid unit-package', () => {
    const result = validateUnitPackage(templatePackage);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.subject.id).toBe('materia-ejemplo');
  });

  it('rejects unit package with unsafe paths or mismatched questions', () => {
    const invalidPkg = {
      ...templatePackage,
      lessons: [{ path: '../evil.md', markdown: 'invalid' }],
    };
    const result = validateUnitPackage(invalidPkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Ruta insegura'))).toBe(true);
  });
});

it('rejects two lessons sharing a topic that cannot be addressed separately', () => {
  const pkg = structuredClone(templatePackage);
  const lesson = pkg.lessons[0];
  const duplicatePath = 'lessons/second.md';
  pkg.lessons.push({ path: duplicatePath, markdown: lesson.markdown.replace(/^id:.*$/m, 'id: second-lesson') });
  pkg.unit.lessons.push(duplicatePath);
  const result = validateUnitPackage(pkg);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => e.message.includes('Cada tema puede tener una sola lección'))).toBe(true);
});
