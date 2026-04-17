'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ColorPicker.css';

const DEFAULT_PRESETS = [
  '#94a3b8',
  '#60a5fa',
  '#9ca3af',
  '#fbbf24',
  '#34d399',
  '#f87171',
  '#6b7280',
  '#e879f9',
  '#a78bfa',
  '#2dd4bf',
  '#4ade80',
  '#f97316',
];

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
  const clamp = (channel) => Math.max(0, Math.min(255, channel));
  const toHex = (channel) => clamp(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hsvToRgb({ h, s, v }) {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const value = Math.max(0, Math.min(100, v)) / 100;
  const chroma = value * saturation;
  const segment = (h % 360) / 60;
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

export default function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  placeholder = '#ffffff',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWheelDragging, setIsWheelDragging] = useState(false);
  const [hexInput, setHexInput] = useState(value || '');
  const wrapperRef = useRef(null);
  const wheelRef = useRef(null);

  const currentColor = normalizeHexColor(value) || '#ffffff';

  const currentHsv = useMemo(
    () => rgbToHsv(hexToRgb(currentColor)),
    [currentColor]
  );

  const pointerStyle = useMemo(() => {
    const angle = (currentHsv.h * Math.PI) / 180;
    const radius = (currentHsv.s / 100) * 50;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return {
      left: `${Math.max(0, Math.min(100, x))}%`,
      top: `${Math.max(0, Math.min(100, y))}%`,
    };
  }, [currentHsv]);

  useEffect(() => {
    setHexInput(currentColor);
  }, [currentColor]);

  const applyColor = useCallback(
    (nextColor) => {
      const normalized = normalizeHexColor(nextColor);
      if (!normalized) return;
      onChange(normalized);
    },
    [onChange]
  );

  const handleWheelPointerDown = useCallback(
    (event) => {
      const wheel = wheelRef.current;
      if (!wheel) return;

      const rect = wheel.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const radius = rect.width / 2;
      const distance = Math.min(Math.sqrt(dx ** 2 + dy ** 2), radius);
      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const saturation = (distance / radius) * 100;
      const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));

      applyColor(nextColor);
      setHexInput(nextColor);
      setIsWheelDragging(true);
    },
    [applyColor]
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isWheelDragging) return undefined;

    function handleMove(event) {
      const wheel = wheelRef.current;
      if (!wheel) return;

      const rect = wheel.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const radius = rect.width / 2;
      const distance = Math.min(Math.sqrt(dx ** 2 + dy ** 2), radius);
      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const saturation = (distance / radius) * 100;
      const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));

      applyColor(nextColor);
      setHexInput(nextColor);
    }

    function handleUp() {
      setIsWheelDragging(false);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [applyColor, isWheelDragging]);

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

      {isOpen ? (
        <div className="salColorPickerPopover">
          <div
            ref={wheelRef}
            className="salColorPickerWheel"
            onPointerDown={handleWheelPointerDown}
            role="presentation"
          >
            <span
              className="salColorPickerWheelPointer"
              style={pointerStyle}
            />
          </div>

          <div className="salColorPickerSwatches">
            {presets.map((color) => (
              <button
                key={color}
                type="button"
                className={`salColorPickerSwatch ${currentColor === color ? 'isActive' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  applyColor(color);
                  setHexInput(color);
                }}
                aria-label={`Set color ${color}`}
              />
            ))}
          </div>

          <div className="salColorPickerHexRow">
            <label>Hex</label>
            <input
              type="text"
              value={hexInput}
              onChange={(event) => {
                const v = event.target.value;
                setHexInput(v);
                const normalized = normalizeHexColor(v);
                if (normalized) applyColor(normalized);
              }}
              onBlur={() => setHexInput(currentColor)}
              placeholder={placeholder}
              maxLength={7}
              spellCheck={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
