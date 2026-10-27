import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readThemePreferences, ThemeProvider, useTheme } from '@/app/theme-context';
import { readFileSync } from 'node:fs';

let dark = false;
let mediaChange: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  dark = false;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return dark; }, addEventListener: (_: string, cb: () => void) => { mediaChange = cb; }, removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Controls() {
  const { theme, mode, palette, setMode, setPalette, storageError } = useTheme();
  return <><output>{`${palette}/${mode}/${theme}`}</output><button onClick={() => setMode('system')}>Sistema</button><button onClick={() => setMode('dark')}>Oscuro</button><button onClick={() => setPalette('zinc')}>Zinc</button>{storageError && <p role="alert">Sin almacenamiento</p>}</>;
}
it('preserves the legacy mode and academic identity without a migration', () => {
  localStorage.setItem('study_bank_theme', 'dark');
  expect(readThemePreferences()).toEqual({ mode: 'dark', palette: 'academic' });
});
it('follows system changes live until an explicit mode is chosen; persists both preferences', () => {
  render(<ThemeProvider><Controls /></ThemeProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('flexoki/system/light');
  act(() => { dark = true; mediaChange?.(); });
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  fireEvent.click(screen.getByText('Zinc'));
  fireEvent.click(screen.getByText('Oscuro'));
  act(() => { dark = false; mediaChange?.(); });
  expect(screen.getByRole('status')).toHaveTextContent('zinc/dark/dark');
  expect(localStorage.getItem('study_bank_palette')).toBe('zinc');
  expect(localStorage.getItem('study_bank_theme')).toBe('dark');
  fireEvent.click(screen.getByText('Sistema'));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});
it('handles invalid preferences and blocked storage without crashing', () => {
  localStorage.setItem('study_bank_theme', 'invalid');
  localStorage.setItem('study_bank_palette', '__proto__');
  expect(readThemePreferences()).toEqual({ mode: 'system', palette: 'flexoki' });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  render(<ThemeProvider><Controls /></ThemeProvider>);
  fireEvent.click(screen.getByText('Zinc'));
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-palette', 'zinc');
});
it('applies the same valid preferences synchronously in the startup script', () => {
  const script = readFileSync('public/theme-init.js', 'utf8');
  localStorage.setItem('study_bank_theme', 'dark');
  localStorage.setItem('study_bank_palette', 'catppuccin');
  // Test the shipped classic script without mounting React.
  const tag = document.createElement('script');
  tag.textContent = script;
  document.head.append(tag);
  // jsdom does not execute appended scripts by default: exercise it in its VM.
  window.eval(script);
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(document.documentElement).toHaveAttribute('data-palette', 'catppuccin');
  tag.remove();
});
