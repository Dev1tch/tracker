export const DEFAULT_THEME = 'dark';
export const THEME_STORAGE_KEY = 'life_tracker.theme';
export const THEME_CHANGE_EVENT = 'life-tracker:theme-change';

const VALID_THEMES = new Set(['dark', 'light']);

export function normalizeTheme(theme) {
  return VALID_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

export function setDocumentTheme(theme) {
  if (typeof document === 'undefined') {
    return normalizeTheme(theme);
  }

  const normalizedTheme = normalizeTheme(theme);
  document.documentElement.dataset.theme = normalizedTheme;
  document.documentElement.style.colorScheme = normalizedTheme;
  return normalizedTheme;
}

export function getStoredTheme() {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function getThemeSnapshot() {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME;
  }

  return normalizeTheme(document.documentElement.dataset.theme || getStoredTheme());
}

export function syncThemeFromStorage() {
  return setDocumentTheme(getStoredTheme());
}

export function subscribeToTheme(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event) => {
    if (event.key && event.key !== THEME_STORAGE_KEY) {
      return;
    }

    callback();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

export function applyTheme(theme) {
  const normalizedTheme = setDocumentTheme(theme);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    } catch {}

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return normalizedTheme;
}

export function toggleTheme() {
  const nextTheme = getThemeSnapshot() === 'dark' ? 'light' : 'dark';
  return applyTheme(nextTheme);
}
