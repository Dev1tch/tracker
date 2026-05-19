export const DEFAULT_THEME = 'dark';
export const THEME_STORAGE_KEY = 'life_tracker.theme';
export const CUSTOM_COLORS_STORAGE_KEY = 'life_tracker.custom_theme_colors';
export const THEME_CHANGE_EVENT = 'life-tracker:theme-change';

export const DEFAULT_CUSTOM_COLORS = { bg: '#1a1f2e', fg: '#e8eaf2' };

const VALID_THEMES = new Set(['dark', 'light', 'custom']);

const CSS_VAR_NAMES = [
  '--theme-rgb',
  '--shadow-rgb',
  '--bg-color',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-muted',
  '--border-color',
  '--border-color-dim',
  '--glow-color',
  '--panel-solid',
  '--panel-translucent',
  '--panel-translucent-strong',
  '--header-gradient',
  '--nav-gradient',
  '--panel-gradient-right',
  '--panel-gradient-left',
  '--surface-contrast',
  '--surface-contrast-inverse',
];

export function normalizeTheme(theme) {
  return VALID_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

function isHex(value) {
  return typeof value === 'string' && /^#([0-9a-f]{6})$/i.test(value);
}

function normalizeHex(value, fallback) {
  if (!isHex(value)) return fallback;
  return value.toLowerCase();
}

export function normalizeCustomColors(colors) {
  const bg = normalizeHex(colors?.bg, DEFAULT_CUSTOM_COLORS.bg);
  const fg = normalizeHex(colors?.fg, DEFAULT_CUSTOM_COLORS.fg);
  return { bg, fg };
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }) {
  const linear = (channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function buildCustomCssVars({ bg, fg }) {
  const bgRgb = hexToRgb(bg);
  const fgRgb = hexToRgb(fg);
  const fgCsv = `${fgRgb.r}, ${fgRgb.g}, ${fgRgb.b}`;
  const bgCsv = `${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}`;
  const fgRgba = (a) => `rgba(${fgCsv}, ${a})`;
  const bgRgba = (a) => `rgba(${bgCsv}, ${a})`;

  return {
    '--theme-rgb': fgCsv,
    '--shadow-rgb': bgCsv,
    '--bg-color': bg,
    '--text-primary': fg,
    '--text-secondary': fgRgba(0.72),
    '--text-tertiary': fgRgba(0.5),
    '--text-muted': fgRgba(0.34),
    '--border-color': fgRgba(0.45),
    '--border-color-dim': fgRgba(0.22),
    '--glow-color': fgRgba(0.4),
    '--panel-solid': bgRgba(0.94),
    '--panel-translucent': bgRgba(0.78),
    '--panel-translucent-strong': bgRgba(0.96),
    '--header-gradient': `linear-gradient(180deg, ${bgRgba(0.96)} 0%, ${bgRgba(0.62)} 72%, ${bgRgba(0)} 100%)`,
    '--nav-gradient': `linear-gradient(0deg, ${bgRgba(0.98)} 0%, ${bgRgba(0.84)} 100%)`,
    '--panel-gradient-right': `linear-gradient(90deg, transparent 0%, ${bgRgba(0.78)} 28%, ${bgRgba(0.96)} 100%)`,
    '--panel-gradient-left': `linear-gradient(270deg, transparent 0%, ${bgRgba(0.78)} 28%, ${bgRgba(0.96)} 100%)`,
    '--surface-contrast': fg,
    '--surface-contrast-inverse': bg,
  };
}

export function customColorScheme({ bg }) {
  return relativeLuminance(hexToRgb(bg)) < 0.5 ? 'dark' : 'light';
}

function applyCustomVarsToRoot(root, vars) {
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

function clearCustomVarsFromRoot(root) {
  CSS_VAR_NAMES.forEach((key) => {
    root.style.removeProperty(key);
  });
}

export function getStoredCustomColors() {
  if (typeof window === 'undefined') return { ...DEFAULT_CUSTOM_COLORS };
  try {
    const raw = window.localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_COLORS };
    return normalizeCustomColors(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CUSTOM_COLORS };
  }
}

export function setDocumentTheme(theme, customColors) {
  if (typeof document === 'undefined') {
    return normalizeTheme(theme);
  }

  const normalizedTheme = normalizeTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = normalizedTheme;

  if (normalizedTheme === 'custom') {
    const colors = normalizeCustomColors(customColors || getStoredCustomColors());
    applyCustomVarsToRoot(root, buildCustomCssVars(colors));
    root.style.colorScheme = customColorScheme(colors);
  } else {
    clearCustomVarsFromRoot(root);
    root.style.colorScheme = normalizedTheme;
  }

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
  const theme = getStoredTheme();
  const customColors = theme === 'custom' ? getStoredCustomColors() : undefined;
  return setDocumentTheme(theme, customColors);
}

export function subscribeToTheme(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event) => {
    if (event.key && event.key !== THEME_STORAGE_KEY && event.key !== CUSTOM_COLORS_STORAGE_KEY) {
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

export function applyTheme(theme, customColors) {
  const normalizedTheme = setDocumentTheme(theme, customColors);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
      if (normalizedTheme === 'custom' && customColors) {
        window.localStorage.setItem(
          CUSTOM_COLORS_STORAGE_KEY,
          JSON.stringify(normalizeCustomColors(customColors))
        );
      }
    } catch {}

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return normalizedTheme;
}

export function applyCustomColors(colors) {
  const normalized = normalizeCustomColors(colors);
  return applyTheme('custom', normalized);
}

export function toggleTheme() {
  const order = ['dark', 'light', 'custom'];
  const current = getThemeSnapshot();
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  const customColors = next === 'custom' ? getStoredCustomColors() : undefined;
  return applyTheme(next, customColors);
}
