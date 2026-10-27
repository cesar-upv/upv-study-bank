import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useConfirmation } from '@/components/use-confirmation';
import { BackupView } from '@/features/backup/BackupView';
import { db } from '@/infrastructure/persistence/db';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(async () => { await Promise.all([db.bookmarks.clear(), db.attempts.clear(), db.sessions.clear(), db.lessonProgress.clear(), db.reviewItems.clear(), db.importedPackages.clear()]); });

const options = { title: '¿Continuar con la acción?', description: 'Esta acción necesita una decisión.', confirmLabel: 'Continuar', cancelLabel: 'Cancelar' };
function Harness({ result }: { result: (confirmed: boolean) => void }) {
  const confirmation = useConfirmation();
  return <><button onClick={async () => result(await confirmation.confirm(options))}>Abrir confirmación</button>{confirmation.dialog}</>;
}

it('labels its dialog, initially focuses cancel, and restores the trigger after cancellation', async () => {
  const result = vi.fn();
  render(<Harness result={result} />);
  const trigger = screen.getByRole('button', { name: 'Abrir confirmación' });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: options.title });
  expect(dialog).toHaveAccessibleDescription(options.description);
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => expect(result).toHaveBeenCalledWith(false));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(trigger).toHaveFocus();
});

it('cancels via the dialog cancel event and traps keyboard movement within the controls', async () => {
  const result = vi.fn();
  render(<Harness result={result} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir confirmación' }));
  const dialog = await screen.findByRole('dialog');
  const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });
  const accept = within(dialog).getByRole('button', { name: 'Continuar' });
  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(accept).toHaveFocus();
  fireEvent.keyDown(accept, { key: 'Tab' });
  expect(cancel).toHaveFocus();
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
  await waitFor(() => expect(result).toHaveBeenCalledWith(false));
});

it('settles a confirmation once and cancels outstanding work on unmount', async () => {
  const result = vi.fn();
  const mounted = render(<Harness result={result} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir confirmación' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continuar' }));
  await waitFor(() => expect(result).toHaveBeenCalledExactlyOnceWith(true));
  fireEvent.click(screen.getByRole('button', { name: 'Abrir confirmación' }));
  await screen.findByRole('dialog');
  mounted.unmount();
  await waitFor(() => expect(result).toHaveBeenLastCalledWith(false));
  expect(result).toHaveBeenCalledTimes(2);
  expect(document.querySelector('dialog')).toBeNull();
});

it('leaves saved data intact when reset is cancelled, then deletes only after confirmation', async () => {
  await db.bookmarks.put({ id: 'keep', subjectId: 's', unitId: 'u', itemType: 'question', itemId: 'q', createdAt: new Date().toISOString() });
  render(<MemoryRouter><BackupView /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Borrar mi progreso' }));
  let dialog = await screen.findByRole('alertdialog', { name: '¿Borrar tu progreso?' });
  expect(await db.bookmarks.count()).toBe(1);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Conservar progreso' }));
  expect(await db.bookmarks.count()).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Borrar mi progreso' }));
  dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar progreso' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('reiniciadas'));
  expect(await db.bookmarks.count()).toBe(0);
});

it('ignores duplicate requests and leaves the original confirmation available', async () => {
  const outcomes: boolean[] = [];
  let ask!: ReturnType<typeof useConfirmation>['confirm'];
  function Owner() { const { confirm, dialog } = useConfirmation(); ask = confirm; return dialog; }
  render(<Owner />);
  await act(async () => {
    void ask(options).then(result => outcomes.push(result));
    void ask({ ...options, title: 'Duplicada' }).then(result => outcomes.push(result));
  });
  expect(outcomes).toEqual([false]);
  expect(screen.getByRole('dialog', { name: options.title })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await waitFor(() => expect(outcomes).toEqual([false, true]));
});
