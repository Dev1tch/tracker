'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { Moon, Palette, Sun } from 'lucide-react';
import {
  applyTheme,
  DEFAULT_CUSTOM_COLORS,
  DEFAULT_THEME,
  getStoredCustomColors,
  getThemeSnapshot,
  subscribeToTheme,
  syncThemeFromStorage,
} from '@/lib/theme';
import ColorPicker from '@/components/ui/ColorPicker';
import './ThemeToggle.css';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'custom', label: 'Custom', Icon: Palette },
];

const POPOVER_WIDTH = 168;

export default function ThemeToggle({
  className = '',
  labelPosition = 'hidden',
}) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => DEFAULT_THEME
  );

  const [isOpen, setIsOpen] = useState(false);
  const [customColors, setCustomColors] = useState(DEFAULT_CUSTOM_COLORS);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    syncThemeFromStorage();
    setCustomColors(getStoredCustomColors());
  }, []);

  const activeOption = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[0];
  const ActiveIcon = activeOption.Icon;
  const resolvedClassName = ['themeToggle', className].filter(Boolean).join(' ');

  const handleSelectTheme = useCallback((nextTheme) => {
    if (nextTheme === 'custom') {
      applyTheme('custom', customColors);
    } else {
      applyTheme(nextTheme);
    }
  }, [customColors]);

  const handleBgChange = useCallback((bg) => {
    setCustomColors((prev) => {
      const next = { ...prev, bg };
      applyTheme('custom', next);
      return next;
    });
  }, []);

  const handleFgChange = useCallback((fg) => {
    setCustomColors((prev) => {
      const next = { ...prev, fg };
      applyTheme('custom', next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleOutside(event) {
      const inWrapper = wrapperRef.current?.contains(event.target);
      const inPopover = popoverRef.current?.contains(event.target);
      /* The inner ColorPicker portal-mounts its popover to document.body, so
         it isn't a descendant of popoverRef. Without this check, clicking a
         remembered swatch inside the ColorPicker would close the whole theme
         popover before the swatch click could register — the user only ever
         got to define a new color, never reuse a remembered one. */
      const inColorPicker = typeof event.target?.closest === 'function'
        ? event.target.closest('.salColorPickerPopover')
        : null;
      if (!inWrapper && !inPopover && !inColorPicker) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = wrapperRef.current;
    if (!trigger) return;

    const GAP = 6;
    const PAD = 12;
    const estimatedHeight = theme === 'custom' ? 140 : 48;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - PAD;
    const spaceAbove = rect.top - PAD;
    const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let left = rect.right - POPOVER_WIDTH;
    if (left + POPOVER_WIDTH > window.innerWidth - PAD) {
      left = window.innerWidth - POPOVER_WIDTH - PAD;
    }
    if (left < PAD) left = PAD;

    const style = {
      position: 'fixed',
      left,
      width: POPOVER_WIDTH,
      zIndex: 10000,
    };
    if (openUp) {
      style.bottom = window.innerHeight - rect.top + GAP;
      style.top = 'auto';
    } else {
      style.top = rect.bottom + GAP;
      style.bottom = 'auto';
    }
    setPopoverStyle(style);
  }, [isOpen, theme]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleResize() { setIsOpen(false); }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  return (
    <div className="themeToggleWrap" ref={wrapperRef}>
      <button
        type="button"
        className={resolvedClassName}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Theme: ${activeOption.label}`}
        title={`Theme: ${activeOption.label}`}
      >
        <span className="themeToggleIcon" aria-hidden="true">
          <ActiveIcon size={16} strokeWidth={1.6} />
        </span>
        {labelPosition !== 'hidden' ? (
          <span className={`themeToggleLabel themeToggleLabel${labelPosition === 'stacked' ? 'Stacked' : ''}`}>
            {activeOption.label}
          </span>
        ) : null}
      </button>

      {isOpen && mounted
        ? createPortal(
            <div
              ref={popoverRef}
              className="themeTogglePopover"
              style={popoverStyle || undefined}
              role="dialog"
              aria-label="Theme settings"
            >
              <div className="themeToggleRow" role="radiogroup" aria-label="Theme">
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={theme === value}
                    title={label}
                    aria-label={label}
                    className={`themeToggleSwatch ${theme === value ? 'isActive' : ''}`}
                    onClick={() => handleSelectTheme(value)}
                  >
                    <Icon size={14} strokeWidth={1.6} />
                  </button>
                ))}
              </div>

              {theme === 'custom' ? (
                <div className="themeToggleCustomBody">
                  <div className="themeToggleCustomRow">
                    <span>Background</span>
                    <ColorPicker value={customColors.bg} onChange={handleBgChange} />
                  </div>
                  <div className="themeToggleCustomRow">
                    <span>Details</span>
                    <ColorPicker value={customColors.fg} onChange={handleFgChange} />
                  </div>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
