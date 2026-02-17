// Theme management utilities
export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'dataforge-theme';

/**
 * Get the current theme from localStorage
 */
export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Save theme to localStorage
 */
export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Check if system prefers dark mode
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  // Determine actual theme to apply
  let actualTheme: 'light' | 'dark';
  if (theme === 'system') {
    actualTheme = getSystemTheme();
  } else {
    actualTheme = theme;
  }
  
  // Apply or remove dark class
  if (actualTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // Save to localStorage
  setStoredTheme(theme);
}

/**
 * Initialize theme on app load
 */
export function initializeTheme(): void {
  const theme = getStoredTheme();
  applyTheme(theme);
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const currentTheme = getStoredTheme();
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    });
  }
}
