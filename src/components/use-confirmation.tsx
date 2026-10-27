import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmationDialog, type ConfirmationOptions } from './ConfirmationDialog';

/** Each owner has at most one pending confirmation; unmounting always cancels it. */
export function useConfirmation() {
  const [request, setRequest] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolver.current;
    if (!resolve) return;
    resolver.current = null;
    setRequest(null);
    resolve(confirmed);
  }, []);
  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    if (resolver.current) return Promise.resolve(false);
    return new Promise(resolve => {
      resolver.current = resolve;
      setRequest(options);
    });
  }, []);
  const cancel = useCallback(() => settle(false), [settle]);
  useEffect(() => () => {
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(false);
  }, []);
  return { confirm, cancel, dialog: request ? <ConfirmationDialog {...request} onConfirm={() => settle(true)} onCancel={cancel} /> : null };
}
