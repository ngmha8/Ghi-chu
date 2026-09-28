import { AppTheme } from '../types/index.js';

const THEME_STORAGE_KEY = 'architect_os_theme';

/**
 * Get current persisted theme, defaulting to 'dark' (or user choice)
 */
export function getSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {}
  return 'dark';
}

/**
 * Apply theme to document element and body
 */
export function applyTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}

  const root = document.documentElement;
  const body = document.body;

  if (theme === 'light') {
    root.classList.add('theme-light');
    root.classList.remove('dark');
    body.classList.add('theme-light');
    body.classList.remove('dark');
    root.style.colorScheme = 'light';
  } else {
    root.classList.remove('theme-light');
    root.classList.add('dark');
    body.classList.remove('theme-light');
    body.classList.add('dark');
    root.style.colorScheme = 'dark';
  }

  // Dispatch custom event for listeners
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}
