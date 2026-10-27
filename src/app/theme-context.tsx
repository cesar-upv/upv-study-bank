import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';
export const palettes = {
  flexoki: { name: 'Flexoki', description: 'Papel cálido y tinta. Para lectura prolongada.', light: 'Light', dark: 'Dark' },
  zinc: { name: 'Monochrome / Zinc', description: 'Grises nítidos y acentos discretos.', light: 'Light', dark: 'Dark' },
  catppuccin: { name: 'Catppuccin', description: 'Superficies frías y acentos pastel.', light: 'Latte', dark: 'Mocha' },
  academic: { name: 'Académico', description: 'La identidad verde original de tu biblioteca.', light: 'Claro', dark: 'Oscuro' },
} as const;
export type Palette = keyof typeof palettes;

export function readThemePreferences(): { mode: ThemeMode; palette: Palette } {
  try {
    const savedMode = localStorage.getItem('study_bank_theme');
    const savedPalette = localStorage.getItem('study_bank_palette');
    return {
      mode: savedMode === 'light' || savedMode === 'dark' ? savedMode : 'system',
      palette: savedPalette && Object.hasOwn(palettes, savedPalette) ? savedPalette as Palette
        : savedMode === 'light' || savedMode === 'dark' ? 'academic' : 'flexoki',
    };
  } catch { return { mode: 'system', palette: 'flexoki' }; }
}

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  palette: Palette;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: Palette) => void;
  toggleTheme: () => void;
  storageError: boolean;
}
const ThemeContext = createContext<ThemeContextType>({ theme: 'light', mode: 'system', palette: 'flexoki', setMode: () => {}, setPalette: () => {}, toggleTheme: () => {}, storageError: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readThemePreferences);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [storageError, setStorageError] = useState(false);
  const { mode, palette } = preferences;
  const theme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media?.matches ?? false);
    media?.addEventListener('change', update);
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key === 'study_bank_theme' || event.key === 'study_bank_palette') setPreferences(readThemePreferences());
    };
    window.addEventListener('storage', sync);
    return () => { media?.removeEventListener('change', update); window.removeEventListener('storage', sync); };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = palette;
  }, [theme, palette]);

  const change = (next: typeof preferences) => {
    setPreferences(next);
    try {
      localStorage.setItem('study_bank_theme', next.mode);
      localStorage.setItem('study_bank_palette', next.palette);
      setStorageError(false);
    } catch { setStorageError(true); }
  };
  return <ThemeContext.Provider value={{ theme, mode, palette, storageError,
    setMode: next => change({ ...preferences, mode: next }),
    setPalette: next => change({ ...preferences, palette: next }),
    toggleTheme: () => change({ ...preferences, mode: theme === 'light' ? 'dark' : 'light' }),
  }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
