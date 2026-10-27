import { useEffect, useRef, useState } from 'react';

export const LIBRARY_STORAGE_KEY = 'study_bank_library';
export type LibraryLayout = 'list' | 'grid';
export interface LibraryPreferences { version: 1; layout: LibraryLayout; hidden: string[] }
const defaults = (): LibraryPreferences => ({ version: 1, layout: 'list', hidden: [] });

export function readLibraryPreferences(): LibraryPreferences {
  const saved = localStorage.getItem(LIBRARY_STORAGE_KEY);
  if (!saved) return defaults();
  const value: unknown = JSON.parse(saved);
  if (!value || typeof value !== 'object') throw new Error('Invalid library preferences');
  const data = value as Partial<LibraryPreferences>;
  if (data.version !== 1 || !['list', 'grid'].includes(data.layout ?? '') || !Array.isArray(data.hidden) || data.hidden.some(key => typeof key !== 'string')) throw new Error('Invalid library preferences');
  return { version: 1, layout: data.layout!, hidden: [...new Set(data.hidden)] };
}

function loadPreferences() {
  try { return { preferences: readLibraryPreferences(), storageError: false }; }
  catch { return { preferences: defaults(), storageError: true }; }
}

export function useLibraryPreferences() {
  const [state, setState] = useState(loadPreferences);
  const current = useRef(state.preferences);
  const dirty = useRef(false);
  const change = (update: (previous: LibraryPreferences) => LibraryPreferences) => {
    // Merge the latest saved preferences, including changes made in another tab.
    let previous = current.current;
    if (!dirty.current) {
      try { previous = readLibraryPreferences(); } catch { /* Keep this visit's preferences. */ }
    }
    const preferences = update(previous);
    current.current = preferences;
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(preferences));
      dirty.current = false;
      setState({ preferences, storageError: false });
    } catch {
      dirty.current = true;
      setState({ preferences, storageError: true });
    }
  };
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== null && event.key !== LIBRARY_STORAGE_KEY) return;
      const next = loadPreferences();
      if (next.storageError || dirty.current) {
        setState(previous => ({ ...previous, storageError: true }));
        return;
      }
      current.current = next.preferences;
      setState(next);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return {
    ...state,
    setLayout: (layout: LibraryLayout) => change(previous => ({ ...previous, layout })),
    setHidden: (key: string, hidden: boolean) => change(previous => ({ ...previous, hidden: hidden ? [...new Set([...previous.hidden, key])] : previous.hidden.filter(item => item !== key) })),
    restoreAll: () => change(previous => ({ ...previous, hidden: [] })),
    retrySave: () => change(() => current.current),
  };
}
