import Dexie from 'dexie';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { db } from '@/infrastructure/persistence/db';
import { contentRepo } from '@/infrastructure/content/repository';
import { QuestionCard } from '@/features/practice/QuestionCard';
import { ReviewView } from '@/features/review/ReviewView';
import { BackupView } from '@/features/backup/BackupView';
import { ExamView } from '@/features/exam/ExamView';
const mount = (view: React.ReactNode) => render(<MemoryRouter initialEntries={["/subjects/pruebas/units/guia"]}><Routes><Route path="/subjects/:subjectId/units/:unitId/:view?/:topicId?" element={view} /></Routes></MemoryRouter>);
beforeEach(async () => { await Promise.all([db.attempts.clear(), db.reviewItems.clear(), db.sessions.clear(), db.lessonProgress.clear(), db.bookmarks.clear(), db.importedPackages.clear()]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('does not grade a yes/no answer until the student chooses', async () => {
  const q = (await contentRepo.getQuestions('pruebas', 'guia')).find(q => q.type === 'proposition_check')!;
  const a = (await contentRepo.getAnswers(q.subject_id, q.unit_id)).find(a => a.question_id === q.id)!;
  mount(<QuestionCard question={q} answer={a} />);
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar respuesta' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Selecciona');
  expect(await db.attempts.count()).toBe(0);
});
it('rolls back the attempt when scheduling review fails', async () => {
  const q = (await contentRepo.getQuestions('pruebas', 'guia'))[0];
  const a = (await contentRepo.getAnswers(q.subject_id, q.unit_id)).find(a => a.question_id === q.id)!;
  mount(<QuestionCard question={q} answer={a} />);
  fireEvent.click(screen.getAllByRole('radio')[0]);
  vi.spyOn(db.reviewItems, 'put').mockRejectedValueOnce(new Error('write failure'));
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar respuesta' }));
  await screen.findByRole('alert');
  expect(await db.attempts.count()).toBe(0);
});
it('loads recent attempts using an existing index', async () => {
  await db.attempts.put({ id: 'review-test', subjectId: 'pruebas', unitId: 'guia', questionId: 'test', type: 'single_choice', contentRevision: 1, submittedResponse: {}, score: 1, maxScore: 1, assisted: false, submittedAt: new Date().toISOString() });
  const spy = vi.spyOn(console, 'error');
  mount(<ReviewView />);
  await screen.findByText('Intentos totales');
  expect(spy).not.toHaveBeenCalled();
  expect(screen.getByText('Intentos totales').parentElement?.textContent).toContain('1');
});
it('rejects malformed backup records before writing anything', async () => {
  mount(<BackupView />);
  const file = new File([''], 'bad.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify({ schema_version: 1, kind: 'study-bank-backup', exportedAt: new Date().toISOString(), bookmarks: [], lessonProgress: [{ id: 'bad' }], attempts: [], reviewItems: [], importedPackages: [] }) });
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
  await waitFor(() => expect(document.body.textContent).toContain('Fallo al importar'));
  expect(await db.lessonProgress.count()).toBe(0);
});
it('surfaces exam creation failure without leaving the lobby', async () => {
  mount(<ExamView />);
  const start = await screen.findByRole('button', { name: 'Iniciar Simulacro de Examen' });
  vi.spyOn(db.sessions, 'put').mockRejectedValueOnce(new Error('write failure'));
  fireEvent.click(start);
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo iniciar');
  expect(await db.sessions.count()).toBe(0);
});
it('propagates content storage errors instead of silently using an older package', async () => {
  vi.spyOn(db.importedPackages, 'get').mockRejectedValueOnce(new Error('read failure'));
  await expect(contentRepo.getUnitPackage('pruebas', 'guia')).rejects.toThrow('read failure');
});
it('keeps exam submission and history atomic, then retries without duplicate attempts', async () => {
  const q = (await contentRepo.getQuestions('pruebas', 'guia'))[0];
  const a = (await contentRepo.getAnswers(q.subject_id, q.unit_id)).find(a => a.question_id === q.id)!;
  await db.sessions.put({ id: 'exam-atomic', subjectId: q.subject_id, unitId: q.unit_id, mode: 'exam', status: 'in_progress', questionIds: [q.id], questionSnapshot: [q], answerSnapshot: [a], answers: { [q.id]: { type: 'single_choice', selectedOptionId: q.payload.options[0].id } }, startedAt: new Date().toISOString(), deadline: null });
  mount(<ExamView />);
  const submit = await screen.findByRole('button', { name: 'Entregar examen' });
  vi.spyOn(db.attempts, 'put').mockRejectedValueOnce(new Error('history failure'));
  fireEvent.click(submit);
  fireEvent.click(within(await screen.findByRole('dialog', { name: '¿Entregar el simulacro?' })).getByRole('button', { name: 'Entregar simulacro' }));
  await screen.findByRole('alert');
  expect((await db.sessions.get('exam-atomic'))?.status).toBe('in_progress');
  expect(await db.attempts.count()).toBe(0);
  fireEvent.click(submit);
  fireEvent.click(within(await screen.findByRole('dialog', { name: '¿Entregar el simulacro?' })).getByRole('button', { name: 'Entregar simulacro' }));
  await screen.findByRole('heading', { name: 'Resultados del Simulacro' });
  expect((await db.sessions.get('exam-atomic'))?.status).toBe('submitted');
  expect(await db.attempts.count()).toBe(1);
});
it('keeps an exam open if abandonment cannot be saved', async () => {
  const q = (await contentRepo.getQuestions('pruebas', 'guia'))[0];
  await db.sessions.put({ id: 'exam-abandon', subjectId: q.subject_id, unitId: q.unit_id, mode: 'exam', status: 'in_progress', questionIds: [q.id], answers: {}, startedAt: new Date().toISOString(), deadline: null });
  mount(<ExamView />);
  const abandon = await screen.findByRole('button', { name: 'Abandonar' });
  vi.spyOn(db.sessions, 'put').mockRejectedValueOnce(new Error('write failure'));
  fireEvent.click(abandon);
  fireEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Abandonar el simulacro?' })).getByRole('button', { name: 'Abandonar simulacro' }));
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo abandonar');
  expect((await db.sessions.get('exam-abandon'))?.status).toBe('in_progress');
});
it('shows the total attempt count even when the recent list is capped', async () => {
  await db.attempts.bulkPut(Array.from({ length: 31 }, (_, i) => ({ id: `attempt-${i}`, subjectId: 'pruebas', unitId: 'guia', questionId: 'test', type: 'single_choice', contentRevision: 1, submittedResponse: {}, score: 1, maxScore: 1, assisted: false, submittedAt: new Date().toISOString() })));
  mount(<ReviewView />);
  const label = await screen.findByText('Intentos totales');
  expect(label.parentElement?.textContent).toContain('31');
});
it('ignores repeated start clicks while session creation is pending', async () => {
  mount(<ExamView />);
  const start = await screen.findByRole('button', { name: 'Iniciar Simulacro de Examen' });
  const put = db.sessions.put.bind(db.sessions);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const spy = vi.spyOn(db.sessions, 'put').mockImplementationOnce(row => Dexie.Promise.resolve(pending).then(() => put(row)));
  fireEvent.click(start);
  fireEvent.click(start);
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  release();
  await screen.findByRole('heading', { name: 'Simulacro (1/30)' });
  expect(await db.sessions.count()).toBe(1);
});
