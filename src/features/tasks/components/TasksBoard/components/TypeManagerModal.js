import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';

const TYPE_COLOR_PRESETS = [
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

  if (segment >= 0 && segment < 1) {
    red = chroma; green = x; blue = 0;
  } else if (segment >= 1 && segment < 2) {
    red = x; green = chroma; blue = 0;
  } else if (segment >= 2 && segment < 3) {
    red = 0; green = chroma; blue = x;
  } else if (segment >= 3 && segment < 4) {
    red = 0; green = x; blue = chroma;
  } else if (segment >= 4 && segment < 5) {
    red = x; green = 0; blue = chroma;
  } else {
    red = chroma; green = 0; blue = x;
  }

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

export default function TypeManagerModal({
  isOpen,
  onClose,
  taskTypes,
  typeForm,
  setTypeForm,
  onCreate,
  onDelete,
  isCreating,
}) {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isColorWheelDragging, setIsColorWheelDragging] = useState(false);
  const [colorInput, setColorInput] = useState(typeForm.color || '#6ea8fe');
  const colorPickerRef = useRef(null);
  const colorWheelRef = useRef(null);

  const currentColor = normalizeHexColor(typeForm.color) || '#6ea8fe';
  const currentColorHsv = useMemo(
    () => rgbToHsv(hexToRgb(currentColor)),
    [currentColor]
  );
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

  const applyTypeColor = useCallback((nextColor) => {
    const normalizedColor = normalizeHexColor(nextColor);
    if (!normalizedColor) return;

    setTypeForm((prev) => ({ ...prev, color: normalizedColor }));
  }, [setTypeForm]);

  const handleWheelPointerDown = useCallback((event) => {
    const wheel = colorWheelRef.current;
    if (!wheel) return;

    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const radius = rect.width / 2;
    const distance = Math.min(Math.sqrt((dx ** 2) + (dy ** 2)), radius);
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const saturation = (distance / radius) * 100;
    const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));

    applyTypeColor(nextColor);
    setColorInput(nextColor);
    setIsColorWheelDragging(true);
  }, [applyTypeColor]);

  useEffect(() => {
    setColorInput(currentColor);
  }, [currentColor]);

  useEffect(() => {
    if (!isOpen) {
      setIsColorPickerOpen(false);
      setIsColorWheelDragging(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isColorPickerOpen) return undefined;

    function handleOutsideClick(event) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setIsColorPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isColorPickerOpen]);

  useEffect(() => {
    if (!isColorWheelDragging) return undefined;

    function handleWheelPointerMove(event) {
      const wheel = colorWheelRef.current;
      if (!wheel) return;

      const rect = wheel.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const radius = rect.width / 2;
      const distance = Math.min(Math.sqrt((dx ** 2) + (dy ** 2)), radius);
      const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const saturation = (distance / radius) * 100;
      const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));

      applyTypeColor(nextColor);
      setColorInput(nextColor);
    }

    function handleWheelPointerUp() {
      setIsColorWheelDragging(false);
    }

    window.addEventListener('pointermove', handleWheelPointerMove);
    window.addEventListener('pointerup', handleWheelPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWheelPointerMove);
      window.removeEventListener('pointerup', handleWheelPointerUp);
    };
  }, [applyTypeColor, isColorWheelDragging]);

  if (!isOpen) return null;

  return (
    <div className="tasksModalOverlay" onClick={onClose}>
      <div className="tasksModal tasksTypeModal" onClick={(e) => e.stopPropagation()}>
        <div className="tasksModalHeader">
          <h3>Task Types</h3>
          <button type="button" className="tasksIconBtn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tasksTypeCreateGrid">
          <div className="tasksField">
            <label>Name</label>
            <input
              type="text"
              value={typeForm.name}
              onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Type name"
            />
          </div>
          <div className="tasksField">
            <label>Color</label>
            <div className="tasksStatusConfigColorWrap tasksTypeColorField" ref={colorPickerRef}>
              <button
                type="button"
                className="tasksStatusConfigColorBtn"
                style={{ backgroundColor: currentColor }}
                onClick={() => setIsColorPickerOpen((prev) => !prev)}
                title="Choose task type color"
                aria-label="Choose task type color"
              />

              {isColorPickerOpen ? (
                <div className="tasksStatusConfigColorPopover">
                  <div
                    ref={colorWheelRef}
                    className="tasksStatusColorWheel"
                    onPointerDown={handleWheelPointerDown}
                    role="presentation"
                  >
                    <span
                      className="tasksStatusColorWheelPointer"
                      style={colorPointerStyle}
                    />
                  </div>

                  <div className="tasksStatusConfigSwatches">
                    {TYPE_COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`tasksStatusConfigSwatch ${currentColor === color ? 'isActive' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          applyTypeColor(color);
                          setColorInput(color);
                        }}
                        aria-label={`Set color ${color}`}
                      />
                    ))}
                  </div>

                  <div className="tasksStatusConfigHexRow">
                    <label>Hex</label>
                    <input
                      type="text"
                      value={colorInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setColorInput(value);

                        const normalizedColor = normalizeHexColor(value);
                        if (normalizedColor) {
                          applyTypeColor(normalizedColor);
                        }
                      }}
                      onBlur={() => setColorInput(currentColor)}
                      placeholder="#ffffff"
                      maxLength={7}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="tasksField tasksFieldFull">
            <label>Description</label>
            <input
              type="text"
              value={typeForm.description}
              onChange={(e) =>
                setTypeForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional description"
            />
          </div>
          <div className="tasksField tasksFieldInline">
            <button
              type="button"
              className="tasksBtn tasksBtnPrimary"
              onClick={onCreate}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
        </div>

        <div className="tasksTypeList">
          {taskTypes.length === 0 ? (
            <p className="tasksMutedText">No task types yet.</p>
          ) : (
            taskTypes.map((type) => (
              <div key={type.id} className="tasksTypeItem">
                <div className="tasksTypeInfo">
                  <span
                    className="tasksTypeColor"
                    style={{ backgroundColor: type.color || '#6ea8fe' }}
                  />
                  <div>
                    <strong>{type.name}</strong>
                    <p>{type.description || 'No description'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="tasksIconBtn danger tasksTypeDeleteBtn"
                  onClick={() => onDelete(type.id)}
                  title="Delete task type"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
