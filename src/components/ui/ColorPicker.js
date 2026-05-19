'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import './ColorPicker.css';

const DEFAULT_PRESETS = [
  '#0f3a4a', '#14b8a6', '#f4c95d', '#f59e6b', '#ef7a6d', '#dc2626',
  '#1e3a8a', '#1d4ed8', '#0ea5e9', '#22d3ee', '#67e8f9', '#a78bfa',
];
const RECENT_COLORS_STORAGE_KEY = 'sal.recentColors';
const RECENT_COLOR_LIMIT = 12;

function isValidHexColor(value) {
  return /^#([0-9a-f]{6})$/i.test(value);
}

function normalizeHexColor(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const candidate = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!isValidHexColor(candidate)) return null;
  return candidate.toLowerCase();
}

function readRecentColors() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_COLORS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeHexColor).filter(Boolean);
  } catch {
    return [];
  }
}

function writeRecentColors(colors) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignore storage failures; the picker still works without history.
  }
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return { r: 255, g: 255, b: 255 };
  }
  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (channel) => Math.max(0, Math.min(255, Math.round(channel)));
  const toHex = (channel) => clamp(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hsvToRgb({ h, s, v }) {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const value = Math.max(0, Math.min(100, v)) / 100;
  const chroma = value * saturation;
  const segment = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const m = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) { red = chroma; green = x; blue = 0; }
  else if (segment >= 1 && segment < 2) { red = x; green = chroma; blue = 0; }
  else if (segment >= 2 && segment < 3) { red = 0; green = chroma; blue = x; }
  else if (segment >= 3 && segment < 4) { red = 0; green = x; blue = chroma; }
  else if (segment >= 4 && segment < 5) { red = x; green = 0; blue = chroma; }
  else { red = chroma; green = 0; blue = x; }

  return {
    r: Math.round((red + m) * 255),
    g: Math.round((green + m) * 255),
    b: Math.round((blue + m) * 255),
  };
}

function rgbToHsv({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }
  if (hue < 0) hue += 360;

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  const value = max * 100;

  return { h: hue, s: saturation, v: value };
}

const POPOVER_WIDTH = 220;
const POPOVER_HEIGHT = 320;

export default function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  placeholder = '#ffffff',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragTarget, setDragTarget] = useState(null); // 'sv' | 'hue' | null
  const [hexInput, setHexInput] = useState(value || '');
  const [popoverStyle, setPopoverStyle] = useState(null);
  const [recentColors, setRecentColors] = useState([]);
  // Track HSV locally so the SV/Hue thumbs don't jump when the user moves
  // into the achromatic edges (S=0 or V=0) where the hex round-trips lose hue.
  const [hsvState, setHsvState] = useState(null);
  const wrapperRef = useRef(null);
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const popoverRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRecentColors(readRecentColors());
  }, []);

  const currentColor = normalizeHexColor(value) || '#ffffff';

  const currentHsv = useMemo(() => {
    if (hsvState) return hsvState;
    return rgbToHsv(hexToRgb(currentColor));
  }, [currentColor, hsvState]);

  const swatchColors = useMemo(() => {
    const fallback = presets.map(normalizeHexColor).filter(Boolean);
    return [...new Set([...recentColors, ...fallback])].slice(0, RECENT_COLOR_LIMIT);
  }, [presets, recentColors]);

  const hueColor = useMemo(
    () => rgbToHex(hsvToRgb({ h: currentHsv.h, s: 100, v: 100 })),
    [currentHsv.h]
  );

  useEffect(() => {
    setHexInput(currentColor);
  }, [currentColor]);

  // Reset cached HSV when the value is changed externally (e.g. swatch click).
  useEffect(() => {
    setHsvState(null);
  }, [currentColor]);

  const applyColor = useCallback(
    (nextColor) => {
      const normalized = normalizeHexColor(nextColor);
      if (!normalized) return;
      onChange(normalized);
    },
    [onChange]
  );

  const rememberColor = useCallback((nextColor) => {
    const normalized = normalizeHexColor(nextColor);
    if (!normalized) return;
    setRecentColors((prev) => {
      const next = [normalized, ...prev.filter((color) => color !== normalized)].slice(0, RECENT_COLOR_LIMIT);
      writeRecentColors(next);
      return next;
    });
  }, []);

  const updateFromSv = useCallback((event) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const s = Math.max(0, Math.min(1, px)) * 100;
    const v = (1 - Math.max(0, Math.min(1, py))) * 100;
    const hue = currentHsv.h;
    const nextHsv = { h: hue, s, v };
    setHsvState(nextHsv);
    const nextColor = rgbToHex(hsvToRgb(nextHsv));
    applyColor(nextColor);
    setHexInput(nextColor);
  }, [applyColor, currentHsv.h]);

  const updateFromHue = useCallback((event) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const h = Math.max(0, Math.min(1, px)) * 360;
    const s = currentHsv.s || 100;
    const v = currentHsv.v || 100;
    const nextHsv = { h, s, v };
    setHsvState(nextHsv);
    const nextColor = rgbToHex(hsvToRgb(nextHsv));
    applyColor(nextColor);
    setHexInput(nextColor);
  }, [applyColor, currentHsv.s, currentHsv.v]);

  const handleSvPointerDown = useCallback((event) => {
    event.preventDefault();
    updateFromSv(event);
    setDragTarget('sv');
  }, [updateFromSv]);

  const handleHuePointerDown = useCallback((event) => {
    event.preventDefault();
    updateFromHue(event);
    setDragTarget('hue');
  }, [updateFromHue]);

  useEffect(() => {
    if (!dragTarget) return undefined;

    function handleMove(event) {
      if (dragTarget === 'sv') updateFromSv(event);
      else if (dragTarget === 'hue') updateFromHue(event);
    }

    function handleUp() {
      rememberColor(hexInput);
      setDragTarget(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragTarget, hexInput, rememberColor, updateFromSv, updateFromHue]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleOutside(event) {
      const inWrapper = wrapperRef.current?.contains(event.target);
      const inPopover = popoverRef.current?.contains(event.target);
      if (!inWrapper && !inPopover) {
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

    const GAP = 8;
    const PAD = 12;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - PAD;
    const spaceAbove = rect.top - PAD;
    const openUp = spaceBelow < POPOVER_HEIGHT && spaceAbove > spaceBelow;

    let left = rect.left;
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleScroll(event) {
      if (wrapperRef.current && wrapperRef.current.contains(event.target)) return;
      setIsOpen(false);
    }
    function handleResize() {
      setIsOpen(false);
    }
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const svThumbStyle = {
    left: `${currentHsv.s}%`,
    top: `${100 - currentHsv.v}%`,
  };
  const hueThumbStyle = {
    left: `${(currentHsv.h / 360) * 100}%`,
  };
  const svBackground = {
    backgroundColor: hueColor,
  };

  return (
    <div className="salColorPickerWrap" ref={wrapperRef}>
      <button
        type="button"
        className="salColorPickerBtn"
        style={{ backgroundColor: currentColor }}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Choose color"
        aria-label="Choose color"
      />

      {isOpen && mounted
        ? createPortal(
            <div
              ref={popoverRef}
              className="salColorPickerPopover"
              style={popoverStyle || undefined}
            >
              <div
                ref={svRef}
                className="salColorPickerSv"
                style={svBackground}
                onPointerDown={handleSvPointerDown}
                role="presentation"
              >
                <span className="salColorPickerSvOverlayWhite" />
                <span className="salColorPickerSvOverlayBlack" />
                <span className="salColorPickerSvThumb" style={svThumbStyle} />
              </div>

              <div
                ref={hueRef}
                className="salColorPickerHue"
                onPointerDown={handleHuePointerDown}
                role="presentation"
              >
                <span className="salColorPickerHueThumb" style={hueThumbStyle} />
              </div>

              <div className="salColorPickerHexRow">
                <span
                  className="salColorPickerPreview"
                  style={{ backgroundColor: currentColor }}
                />
                <input
                  type="text"
                  value={hexInput}
                  onChange={(event) => {
                    const v = event.target.value;
                    setHexInput(v);
                    const normalized = normalizeHexColor(v);
                    if (normalized) {
                      setHsvState(null);
                      applyColor(normalized);
                      rememberColor(normalized);
                    }
                  }}
                  onBlur={() => setHexInput(currentColor)}
                  placeholder={placeholder}
                  maxLength={7}
                  spellCheck={false}
                />
              </div>

              <div className="salColorPickerSwatches">
                {swatchColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`salColorPickerSwatch ${currentColor === color ? 'isActive' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setHsvState(null);
                      applyColor(color);
                      setHexInput(color);
                      rememberColor(color);
                    }}
                    aria-label={`Set color ${color}`}
                  />
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
