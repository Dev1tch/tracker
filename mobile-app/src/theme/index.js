import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STATUS = { success: '#34d399', danger: '#ff4d4d', warning: '#fbbf24', info: '#60a5fa' };

const DARK = {
  colors: {
    background: '#000000',
    backgroundAlt: '#060606',
    card: 'rgba(10, 10, 10, 0.92)',
    cardSoft: 'rgba(14, 14, 14, 0.96)',
    surface: 'rgba(18, 18, 18, 0.96)',
    surfaceSoft: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.16)',
    borderDim: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.72)',
    tertiary: 'rgba(255, 255, 255, 0.48)',
    muted: 'rgba(255, 255, 255, 0.3)',
    accent: '#ffffff',
    ...STATUS,
  },
  gradients: { app: ['#000000', '#060606', '#000000'], auth: ['#000000', '#060606', '#000000'] },
};

const LIGHT = {
  colors: {
    background: '#ffffff',
    backgroundAlt: '#f4f4f6',
    card: 'rgba(255, 255, 255, 0.95)',
    cardSoft: 'rgba(248, 248, 250, 0.98)',
    surface: 'rgba(244, 244, 246, 0.96)',
    surfaceSoft: 'rgba(0, 0, 0, 0.04)',
    border: 'rgba(0, 0, 0, 0.18)',
    borderDim: 'rgba(0, 0, 0, 0.1)',
    text: '#0a0a0a',
    secondary: 'rgba(0, 0, 0, 0.7)',
    tertiary: 'rgba(0, 0, 0, 0.5)',
    muted: 'rgba(0, 0, 0, 0.34)',
    accent: '#0a0a0a',
    ...STATUS,
  },
  gradients: { app: ['#ffffff', '#f4f4f6', '#ffffff'], auth: ['#ffffff', '#f4f4f6', '#ffffff'] },
};

export const THEMES = { dark: DARK, light: LIGHT };
export const THEME_MODES = ['dark', 'light', 'custom'];
export const DEFAULT_CUSTOM_COLORS = { bg: '#1a1f2e', fg: '#e8eaf2' };

const THEME_KEY = 'life_tracker.theme';
const CUSTOM_KEY = 'life_tracker.custom_theme_colors';

function hexToRgb(hex) {
  const v = String(hex || '').replace('#', '');
  if (v.length !== 6) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}

function isHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeCustomColors(colors) {
  return {
    bg: isHex(colors?.bg) ? colors.bg.toLowerCase() : DEFAULT_CUSTOM_COLORS.bg,
    fg: isHex(colors?.fg) ? colors.fg.toLowerCase() : DEFAULT_CUSTOM_COLORS.fg,
  };
}

// Blend two hex colors; t is the fraction of `to`.
function blend(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const ch = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${ch(a.r, b.r)}${ch(a.g, b.g)}${ch(a.b, b.b)}`;
}

export function buildCustomTheme(colorsInput) {
  const { bg, fg } = normalizeCustomColors(colorsInput);
  const f = hexToRgb(fg);
  const fgRgba = (alpha) => `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha})`;
  return {
    colors: {
      background: bg,
      backgroundAlt: blend(bg, fg, 0.04),
      card: blend(bg, fg, 0.06),
      cardSoft: blend(bg, fg, 0.08),
      surface: blend(bg, fg, 0.08),
      surfaceSoft: fgRgba(0.05),
      border: fgRgba(0.28),
      borderDim: fgRgba(0.14),
      text: fg,
      secondary: fgRgba(0.72),
      tertiary: fgRgba(0.5),
      muted: fgRgba(0.34),
      accent: fg,
      ...STATUS,
    },
    gradients: { app: [bg, blend(bg, fg, 0.04), bg], auth: [bg, blend(bg, fg, 0.04), bg] },
  };
}

export function resolveTheme(mode, customColors) {
  if (mode === 'custom') return buildCustomTheme(customColors);
  return THEMES[mode] || DARK;
}

// True when the theme's background is light (so status-bar icons should be dark).
export function isLightTheme(t) {
  const { r, g, b } = hexToRgb(t?.colors?.background || '#000000');
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

// Fallback for any module that still imports the static theme. Defaults to dark.
export const theme = DARK;

const ThemeContext = createContext({
  theme: DARK,
  mode: 'dark',
  customColors: DEFAULT_CUSTOM_COLORS,
  setMode: () => {},
  setCustomColors: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('dark');
  const [customColors, setCustomColorsState] = useState(DEFAULT_CUSTOM_COLORS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedMode, savedCustom] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(CUSTOM_KEY),
        ]);
        if (cancelled) return;
        if (savedMode && THEME_MODES.includes(savedMode)) setModeState(savedMode);
        if (savedCustom) setCustomColorsState(normalizeCustomColors(JSON.parse(savedCustom)));
      } catch {
        /* keep defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setMode = useCallback((next) => {
    const m = THEME_MODES.includes(next) ? next : 'dark';
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  }, []);

  const setCustomColors = useCallback((colors) => {
    const normalized = normalizeCustomColors(colors);
    setCustomColorsState(normalized);
    setModeState('custom');
    AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(normalized)).catch(() => {});
    AsyncStorage.setItem(THEME_KEY, 'custom').catch(() => {});
  }, []);

  const resolved = useMemo(() => resolveTheme(mode, customColors), [mode, customColors]);
  const value = useMemo(
    () => ({ theme: resolved, mode, customColors, setMode, setCustomColors }),
    [resolved, mode, customColors, setMode, setCustomColors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeControls() {
  return useContext(ThemeContext);
}
