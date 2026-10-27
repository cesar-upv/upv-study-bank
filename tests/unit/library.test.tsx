import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUnitCapabilities, unitPreferenceKey } from '@/domain/content/unit-capabilities';
import { validateUnitPackage } from '@/domain/content/package-validator';
import { contentRepo } from '@/infrastructure/content/repository';
import { db } from '@/infrastructure/persistence/db';
import { HomeView } from '@/features/catalog/HomeView';
import { UnitView } from '@/features/catalog/UnitView';
import { StudyView } from '@/features/study/StudyView';
import { PracticeView } from '@/features/practice/PracticeView';
import { ExamView } from '@/features/exam/ExamView';
import { Navbar } from '@/components/Navbar';
import { LIBRARY_STORAGE_KEY } from '@/features/catalog/use-library-preferences';
import { examPackage as raw, guidePackage as guideRaw } from '../fixtures/packages';
import { parseLessonMarkdown } from '@/domain/content/parser';

const exam = validateUnitPackage(raw).data!;
const title = exam.unit.title;
const base = `/subjects/${exam.subject.id}/units/${exam.unit.id}`;
const mountHome = () => render(<MemoryRouter><HomeView /></MemoryRouter>);
const mountUnit = (view: React.ReactNode, suffix = '') => render(<MemoryRouter initialEntries={[`${base}${suffix}`]}><Routes><Route path={suffix.startsWith('/study/') ? '/subjects/:subjectId/units/:unitId/study/:topicId' : '/subjects/:subjectId/units/:unitId/*'} element={view} /></Routes></MemoryRouter>);
beforeEach(async () => {
  localStorage.clear();
  await Promise.all([db.importedPackages.clear(), db.lessonProgress.clear(), db.reviewItems.clear(), db.sessions.clear(), db.attempts.clear(), db.bookmarks.clear()]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('unit availability', () => {
  it('separates guides, exam banks, optional practice, empty units and actual quota capacity', () => {
    expect(getUnitCapabilities(exam.unit, 0, exam.questions)).toMatchObject({ kind: 'exam', canExam: true, examQuestionCount: 15 });
    expect(getUnitCapabilities(exam.unit, 1, exam.questions)).toMatchObject({ kind: 'study', hasLessons: true });
    expect(getUnitCapabilities(exam.unit, 1, [])).toMatchObject({ kind: 'guide', canExam: false });
    expect(getUnitCapabilities(exam.unit, 0, [])).toMatchObject({ kind: 'empty', canExam: false });
    const optional = exam.questions.map(q => ({ ...q, exam_scope: 'optional' as const }));
    expect(getUnitCapabilities(exam.unit, 0, optional)).toMatchObject({ kind: 'practice', canExam: false, hasQuestions: true });
    const unit = { ...exam.unit, exam: { question_count: 10, duration_minutes: 30, quotas: { [exam.questions[0].topic_id]: 10 } } };
    expect(getUnitCapabilities(unit, 0, exam.questions).examQuestionCount).toBe(2);
    expect(getUnitCapabilities({ ...unit, exam: { ...unit.exam, quotas: { missing: 10 } } }, 0, exam.questions).canExam).toBe(false);
    expect(unitPreferenceKey('a:b', 'c')).not.toBe(unitPreferenceKey('a', 'b:c'));
  });

  it('gives an exam-only unit an exam action without a fictitious reading path', async () => {
    mountUnit(<UnitView />);
    await screen.findByRole('heading', { name: title });
    expect(screen.getByRole('link', { name: 'Preparar simulacro' })).toHaveAttribute('href', `${base}/exam`);
    expect(screen.queryByRole('heading', { name: 'Ruta de estudio' })).toBeNull();
    expect(screen.queryByText(/0 de 0/)).toBeNull();
    expect(screen.getByText('Tiempo propuesto')).toBeVisible();
  });

  it('recovers direct study links for exam-only units without showing a blank guide', async () => {
    mountUnit(<StudyView />, '/study');
    await screen.findByRole('heading', { name: 'Esta unidad está dedicada a simulacros' });
    expect(screen.getByRole('link', { name: 'Hacer simulacro' })).toHaveAttribute('href', `${base}/exam`);
    expect(screen.queryByText(/0 de 0/)).toBeNull();
  });

  it('omits unsupported guide navigation and lesson links in exam-only practice', async () => {
    const mounted = mountUnit(<Navbar />, '/practice');
    await screen.findByRole('link', { name: 'Práctica' });
    expect(screen.queryByRole('link', { name: 'Guía de estudio' })).toBeNull();
    mounted.unmount();
    mountUnit(<PracticeView />, '/practice');
    await screen.findByText('Práctica interactiva');
    await waitFor(() => expect(document.querySelector('.question-header')).not.toBeNull());
    expect(screen.queryByRole('link', { name: /Ver lección/ })).toBeNull();
  });

  it('distinguishes an optional-only bank from an empty or startable exam', async () => {
    vi.spyOn(contentRepo, 'getQuestions').mockResolvedValue(exam.questions.map(q => ({ ...q, exam_scope: 'optional' })));
    mountUnit(<ExamView />, '/exam');
    await screen.findByRole('heading', { name: 'No hay preguntas disponibles para un simulacro' });
    expect(screen.getByRole('link', { name: 'Practicar ejercicios' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Iniciar Simulacro de Examen' })).toBeNull();
  });

  it('offers material recovery for a package with neither lessons nor exercises', async () => {
    const empty = structuredClone(exam);
    empty.questions = []; empty.answers = [];
    vi.spyOn(contentRepo, 'getUnitPackage').mockResolvedValue(empty);
    mountUnit(<UnitView />);
    await screen.findByRole('heading', { name: 'Esta unidad todavía no tiene contenido' });
    expect(screen.getByRole('link', { name: 'Gestionar materias' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Preparar simulacro' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tu rendimiento por tema' })).toBeNull();
  });

  it('makes a lesson-only unit readable without advertising unavailable exercise actions', async () => {
    const guide = structuredClone(validateUnitPackage(guideRaw).data!);
    const previousId = guide.unit.id;
    guide.unit.id = exam.unit.id; guide.subject.unit_ids = [exam.unit.id];
    guide.questions = []; guide.answers = []; delete guide.unit.exam;
    guide.lessons = guide.lessons.map(lesson => ({ ...lesson, markdown: lesson.markdown.replaceAll(previousId, exam.unit.id) }));
    vi.spyOn(contentRepo, 'getUnitPackage').mockResolvedValue(guide);
    const mounted = mountUnit(<UnitView />);
    await screen.findByRole('heading', { name: guide.unit.title });
    expect(screen.getByRole('link', { name: 'Abrir guía' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Preparar simulacro' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Practicar ejercicios' })).toBeNull();
    mounted.unmount();
    mountUnit(<PracticeView />, '/practice');
    await screen.findByRole('heading', { name: 'Esta guía no incluye ejercicios' });
    expect(screen.getByRole('link', { name: 'Abrir guía' })).toBeVisible();
  });

  it('reports a missing topic rather than silently presenting a different lesson', async () => {
    const lesson = guideRaw.lessons[0];
    vi.spyOn(contentRepo, 'getLessons').mockResolvedValue([parseLessonMarkdown(lesson.path, lesson.markdown)]);
    mountUnit(<StudyView />, '/study/no-existe');
    await screen.findByRole('heading', { name: 'Ese tema no está en esta guía' });
    expect(screen.getByRole('link', { name: 'Abrir guía' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Marcar como leído' })).toBeNull();
  });
});

describe('personal library', () => {
  it('expires undo, renews it for the latest action and clears the timer on unmount', async () => {
    const mounted = mountHome();
    await screen.findByRole('article', { name: title });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: `Ocultar ${title}` }));
    act(() => vi.advanceTimersByTime(5000));
    const next = screen.getAllByRole('button', { name: /^Ocultar / })[0];
    fireEvent.click(next);
    act(() => vi.advanceTimersByTime(7999));
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^Ocultar / })[0]);
    mounted.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps undo available while using it with the keyboard or pointer', async () => {
    mountHome();
    await screen.findByRole('article', { name: title });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: `Ocultar ${title}` }));
    const undo = screen.getByRole('button', { name: 'Deshacer' });
    act(() => undo.focus());
    act(() => vi.advanceTimersByTime(16000));
    expect(undo).toBeVisible();
    act(() => screen.getByRole('searchbox').focus());
    fireEvent.mouseEnter(undo.closest('.library-feedback')!);
    act(() => vi.advanceTimersByTime(16000));
    expect(undo).toBeVisible();
    fireEvent.mouseLeave(undo.closest('.library-feedback')!);
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('starts compact, supports accented search, and remembers the grid', async () => {
    const mounted = mountHome();
    await screen.findByRole('article', { name: title });
    expect(screen.getByRole('button', { name: 'Lista compacta' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  RAZONAMIENTO  ' } });
    expect(screen.getAllByRole('article')).toHaveLength(2);
    const row = screen.getByRole('article', { name: title });
    expect(within(row).queryByRole('progressbar')).toBeNull();
    expect(within(row).queryByRole('link', { name: 'Abrir guía' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cuadrícula' }));
    mounted.unmount(); mountHome();
    await screen.findByRole('article', { name: title });
    expect(screen.getByRole('button', { name: 'Cuadrícula' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides, undoes, reloads and restores a unit while preserving material and progress', async () => {
    await db.bookmarks.put({ id: 'keep', subjectId: exam.subject.id, unitId: exam.unit.id, itemType: 'question', itemId: exam.questions[0].id, createdAt: new Date().toISOString() });
    const mounted = mountHome();
    fireEvent.click(await screen.findByRole('button', { name: `Ocultar ${title}` }));
    expect(screen.queryByRole('article', { name: title })).toBeNull();
    expect(screen.getByRole('button', { name: /Visibles/ })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByRole('article', { name: title })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: `Ocultar ${title}` }));
    mounted.unmount(); mountHome();
    await screen.findByRole('button', { name: /Ocultas 1/ });
    fireEvent.click(screen.getByRole('button', { name: /Ocultas 1/ }));
    expect(screen.getByRole('article', { name: title })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: `Restaurar ${title}` }));
    expect(screen.getByRole('heading', { name: 'No tienes unidades ocultas' })).toBeVisible();
    expect((await contentRepo.getUnitPackage(exam.subject.id, exam.unit.id))?.questions).toHaveLength(15);
    expect(await db.bookmarks.get('keep')).toBeDefined();
  });

  it('distinguishes all-hidden, no matches, and an actually empty library', async () => {
    const packages = await contentRepo.getAllPackages();
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ version: 1, layout: 'list', hidden: packages.map(pkg => unitPreferenceKey(pkg.subject.id, pkg.unit.id)) }));
    const mounted = mountHome();
    await screen.findByRole('heading', { name: 'Tu material está en Ocultas' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver unidades ocultas' }));
    expect(screen.getAllByRole('article')).toHaveLength(packages.length);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistente' } });
    expect(screen.getByRole('heading', { name: 'No hay coincidencias con estos filtros' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar todas' }));
    expect(screen.getAllByRole('article')).toHaveLength(packages.length);
    mounted.unmount();
    vi.spyOn(contentRepo, 'getAllPackages').mockResolvedValue([]);
    mountHome();
    await screen.findByRole('heading', { name: 'Tu próxima materia empieza aquí' });
  });

  it('keeps the library usable when preferences are corrupt or a write is blocked, then retries', async () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, '{bad json');
    mountHome();
    await screen.findByRole('article', { name: title });
    expect(screen.getByRole('alert')).toHaveTextContent('preferencias');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
    fireEvent.click(screen.getByRole('button', { name: `Ocultar ${title}` }));
    expect(screen.queryByRole('article', { name: title })).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('preferencias');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a guardar preferencias' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)!).hidden).toHaveLength(1);
  });

  it('merges changes from another tab without dropping its hidden units', async () => {
    mountHome();
    await screen.findByRole('article', { name: title });
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ version: 1, layout: 'list', hidden: [unitPreferenceKey(exam.subject.id, exam.unit.id)] }));
    fireEvent.click(screen.getByRole('button', { name: 'Cuadrícula' }));
    expect(screen.queryByRole('article', { name: title })).toBeNull();
    expect(JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)!).hidden).toHaveLength(1);
  });

  it('keeps content accessible when history fails and retries content loading errors', async () => {
    const readingUnitCount = (await contentRepo.getAllPackages()).filter(pkg => pkg.lessons.length > 0).length;
    vi.spyOn(db.lessonProgress, 'toArray').mockRejectedValueOnce(new Error('history'));
    const mounted = mountHome();
    await screen.findByRole('article', { name: title });
    expect(screen.getByRole('alert')).toHaveTextContent('progreso');
    expect(screen.getAllByText('Progreso no disponible')).toHaveLength(readingUnitCount);
    mounted.unmount();
    vi.spyOn(contentRepo, 'getAllPackages').mockRejectedValueOnce(new Error('content'));
    mountHome();
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: 'Tu próxima materia empieza aquí' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('article', { name: title });
  });
});
