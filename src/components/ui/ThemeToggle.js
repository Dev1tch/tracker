'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { MoonStar, SunMedium } from 'lucide-react';
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
  const themeLabel = isLight ? 'Light mode' : 'Dark mode';
  const resolvedClassName = ['themeToggle', className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={resolvedClassName}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextThemeLabel} mode`}
      title={`Switch to ${nextThemeLabel} mode`}
    >
      <span className={`themeToggleRail ${isLight ? 'isLight' : 'isDark'}`} aria-hidden="true">
        <span className="themeToggleIconSlot themeToggleIconSlotStart">
          <MoonStar size={11} strokeWidth={1.8} />
        </span>
        <span className="themeToggleThumb" />
        <span className="themeToggleIconSlot themeToggleIconSlotEnd">
          <SunMedium size={11} strokeWidth={1.8} />
        </span>
      </span>
      {labelPosition !== 'hidden' ? (
        <span className={`themeToggleLabel themeToggleLabel${labelPosition === 'stacked' ? 'Stacked' : ''}`}>
          {themeLabel}
        </span>
      ) : null}
    </button>
  );
}
