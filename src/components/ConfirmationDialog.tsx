import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmationOptions {
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export function ConfirmationDialog({ title, description, detail, confirmLabel, cancelLabel = 'Cancelar', tone = 'default', onConfirm, onCancel }: ConfirmationOptions & {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const backdropPress = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      const target = previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.matches(':disabled')
        ? previousFocus : document.getElementById('main-content');
      target?.focus({ preventScroll: true });
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const outside = (element: HTMLDialogElement, x: number, y: number) => {
    const bounds = element.getBoundingClientRect();
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  };
  return createPortal(<dialog ref={dialogRef} className="confirmation-dialog" role={tone === 'danger' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onCancel(); }} onKeyDown={trapFocus}
    onPointerDown={event => { backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY); }}
    onPointerCancel={() => { backdropPress.current = false; }}
    onClick={event => {
      if (backdropPress.current && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY)) onCancel();
      backdropPress.current = false;
    }}>
    <div className="confirmation-dialog-content"><h2 id={titleId}>{title}</h2><div id={descriptionId} className="confirmation-dialog-description"><p>{description}</p>{detail && <p>{detail}</p>}</div></div>
    <div className="confirmation-dialog-actions"><button ref={cancelRef} type="button" className="btn-secondary" onClick={onCancel}>{cancelLabel}</button><button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>, document.body);
}
