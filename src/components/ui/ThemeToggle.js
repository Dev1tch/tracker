'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  DEFAULT_THEME,
  getThemeSnapshot,
  subscribeToTheme,
  syncThemeFromStorage,
  toggleTheme,
} from '@/lib/theme';
import './ThemeToggle.css';

export default function ThemeToggle({
  className = '',
  labelPosition = 'hidden',
}) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => DEFAULT_THEME
  );

  useEffect(() => {
    syncThemeFromStorage();
  }, []);

  const isLight = theme === 'light';
  const nextThemeLabel = isLight ? 'dark' : 'light';
  const resolvedClassName = ['themeToggle', className].filter(Boolean).join(' ');
  const Icon = isLight ? Sun : Moon;

  return (
    <button
      type="button"
      className={resolvedClassName}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextThemeLabel} mode`}
      title={`Switch to ${nextThemeLabel} mode`}
    >
      <span className={`themeToggleIcon ${isLight ? 'isLight' : 'isDark'}`} aria-hidden="true">
        <Icon size={16} strokeWidth={1.6} />
      </span>
      {labelPosition !== 'hidden' ? (
        <span className={`themeToggleLabel themeToggleLabel${labelPosition === 'stacked' ? 'Stacked' : ''}`}>
          {isLight ? 'Light mode' : 'Dark mode'}
        </span>
      ) : null}
    </button>
  );
}
