import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { contentRepo } from '@/infrastructure/content/repository';
import { StudyView } from '@/features/study/StudyView';
import { PracticeView } from '@/features/practice/PracticeView';
import { ExamView } from '@/features/exam/ExamView';
import { db } from '@/infrastructure/persistence/db';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
for (const View of [StudyView, PracticeView, ExamView]) {
  it(`${View.name} distinguishes failure from missing content and retries`, async () => {
    const load = vi.spyOn(contentRepo, 'getSubject').mockRejectedValueOnce(new Error('read failure'));
    render(<MemoryRouter initialEntries={["/subjects/pruebas/units/guia"]}><Routes><Route path="/subjects/:subjectId/units/:unitId/:view?/:topicId?" element={<View />} /></Routes></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText(/Guía de examen:|Práctica interactiva|Iniciar Simulacro de Examen/);
    expect(load).toHaveBeenCalledTimes(2);
  });
}
it('does not announce read or favorite success when storage rejects', async () => {
  render(<MemoryRouter initialEntries={["/subjects/pruebas/units/guia"]}><Routes><Route path="/subjects/:subjectId/units/:unitId/:view?/:topicId?" element={<StudyView />} /></Routes></MemoryRouter>);
  const read = await screen.findByRole('button', { name: 'Marcar como leído' });
  vi.spyOn(db.lessonProgress, 'put').mockRejectedValueOnce(new Error('write failure'));
  fireEvent.click(read);
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar');
  expect(read.getAttribute('aria-pressed')).toBe('false');
  vi.spyOn(db.bookmarks, 'put').mockRejectedValueOnce(new Error('write failure'));
  fireEvent.click(screen.getByRole('button', { name: 'Añadir a favoritos' }));
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar');
  expect(screen.getByRole('button', { name: 'Añadir a favoritos' }).getAttribute('aria-pressed')).toBe('false');
});

it('does not report an empty error queue when attempt history cannot be read', async () => {
  vi.spyOn(db.attempts, 'where').mockImplementationOnce(() => { throw new Error('history failure'); });
  render(<MemoryRouter initialEntries={["/subjects/pruebas/units/guia?status=incorrect"]}><Routes><Route path="/subjects/:subjectId/units/:unitId/:view?/:topicId?" element={<PracticeView />} /></Routes></MemoryRouter>);
  expect((await screen.findByRole('alert')).textContent).toContain('No pudimos leer tus errores');
  expect(screen.queryByText(/No hay errores pendientes/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar historial' }));
  await screen.findByText(/No hay errores pendientes/);
});
