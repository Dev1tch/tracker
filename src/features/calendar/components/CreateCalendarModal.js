'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Calendar as CalIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

const CALENDAR_COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6', '#0ea5e9'
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
  if (!normalized) return { r: 255, g: 255, b: 255 };
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
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
  let red = 0, green = 0, blue = 0;
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
  const red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
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

export default function CreateCalendarModal({ isOpen, onClose, onCreate }) {
  const toast = useToast();
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(false);
  
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isColorWheelDragging, setIsColorWheelDragging] = useState(false);
  const [colorInput, setColorInput] = useState(color);
  const [rgb, setRgb] = useState(hexToRgb(color));
  
  const colorPickerRef = useRef(null);
  const colorWheelRef = useRef(null);

  // Sync RGB and Hex inputs when color changes
  useEffect(() => {
    setColorInput(color);
    setRgb(hexToRgb(color));
  }, [color]);

  const handleRgbChange = (channel, value) => {
    const newVal = Math.max(0, Math.min(255, parseInt(value || 0)));
    const nextRgb = { ...rgb, [channel]: newVal };
    setRgb(nextRgb);
    setColor(rgbToHex(nextRgb));
  };

  const currentColorHsv = useMemo(() => rgbToHsv(hexToRgb(color)), [color]);
  
  const colorPointerStyle = useMemo(() => {
    const angle = (currentColorHsv.h * Math.PI) / 180;
    const radius = (currentColorHsv.s / 100) * 50;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return {
      left: `${Math.max(0, Math.min(100, x))}%`,
      top: `${Math.max(0, Math.min(100, y))}%`,
    };
  }, [currentColorHsv]);

  const handleWheelPointerDown = useCallback((event) => {
    const wheel = colorWheelRef.current;
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const radius = rect.width / 2;
    const distance = Math.min(Math.sqrt(dx ** 2 + dy ** 2), radius);
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const saturation = (distance / radius) * 100;
    const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));
    setColor(nextColor);
    setColorInput(nextColor);
    setIsColorWheelDragging(true);
  }, []);

  useEffect(() => {
    if (!isColorWheelDragging) return undefined;
    const handleMove = (event) => {
      const wheel = colorWheelRef.current;
      if (!wheel) return;
      const rect = wheel.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const radius = rect.width / 2;
      const distance = Math.min(Math.sqrt(dx ** 2 + dy ** 2), radius);
      const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const saturation = (distance / radius) * 100;
      const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));
      setColor(nextColor);
      setColorInput(nextColor);
    };
    const handleUp = () => setIsColorWheelDragging(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isColorWheelDragging]);

  useEffect(() => {
    if (!isColorPickerOpen) return undefined;
    const handleClick = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isColorPickerOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary) return;
    setLoading(true);
    try {
      await onCreate({ summary, description, color });
      onClose();
      // Reset form
      setSummary('');
      setDescription('');
      setColor('#3b82f6');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to create calendar', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="calModalOverlay" onClick={onClose}>
      <div className="calModal glass" onClick={(e) => e.stopPropagation()}>
        <header className="calModalHeader">
          <h3>New Calendar</h3>
          <button className="calModalClose" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="calModalForm">
          <div className="calFormGroup">
            <label><CalIcon size={16} /> Calendar Name</label>
            <input
              type="text"
              className="authInput"
              placeholder="e.g. Work, Personal, Side Projects"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="calFormGroup">
            <label>Color</label>
            <div className="calColorPickerWrap" ref={colorPickerRef}>
              <button
                type="button"
                className="calColorBtn"
                style={{ backgroundColor: color }}
                onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              />
              {isColorPickerOpen && (
                <div className="calColorPopover glass">
                  <div
                    ref={colorWheelRef}
                    className="calColorWheel"
                    onPointerDown={handleWheelPointerDown}
                  >
                    <span className="calColorPointer" style={colorPointerStyle} />
                  </div>
                  <div className="calColorSwatches">
                    {CALENDAR_COLOR_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`calColorSwatch ${color === p ? 'active' : ''}`}
                        style={{ backgroundColor: p }}
                        onClick={() => {
                          setColor(p);
                          setColorInput(p);
                        }}
                      />
                    ))}
                  </div>
                  <div className="calColorCustomRow">
                    <div className="calColorHexColumn">
                      <label>Hex</label>
                      <input
                        type="text"
                        className="authInput calColorInput"
                        value={colorInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColorInput(val);
                          const norm = normalizeHexColor(val);
                          if (norm) setColor(norm);
                        }}
                        onBlur={() => setColorInput(color)}
                        maxLength={7}
                      />
                    </div>
                    <div className="calColorRgbColumn">
                      <label>RGB</label>
                      <div className="calColorRgbInputs">
                        <input
                          type="number"
                          className="authInput calColorInput"
                          value={rgb.r}
                          onChange={(e) => handleRgbChange('r', e.target.value)}
                          placeholder="R"
                          min="0"
                          max="255"
                        />
                        <input
                          type="number"
                          className="authInput calColorInput"
                          value={rgb.g}
                          onChange={(e) => handleRgbChange('g', e.target.value)}
                          placeholder="G"
                          min="0"
                          max="255"
                        />
                        <input
                          type="number"
                          className="authInput calColorInput"
                          value={rgb.b}
                          onChange={(e) => handleRgbChange('b', e.target.value)}
                          placeholder="B"
                          min="0"
                          max="255"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="calFormGroup">
            <label>Description (Optional)</label>
            <textarea
              className="authInput calTextarea"
              placeholder="Describe what this calendar is for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <footer className="calModalFooter">
            <div className="calModalActions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading || !summary}>
                {loading ? <Loader2 size={16} className="spin" /> : 'Create Calendar'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
