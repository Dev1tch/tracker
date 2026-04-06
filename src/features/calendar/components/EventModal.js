'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Clock, MapPin, AlignLeft, Calendar as CalIcon, Trash2, Users, Repeat, Bell, Palette, ChevronDown, Video } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { useToast } from '@/components/ui/ToastProvider';
import AccountPromptModal from './AccountPromptModal';
import TasksDatePicker from '@/features/tasks/components/TasksBoard/components/TasksDatePicker';

const GOOGLE_EVENT_COLORS = [
  { id: '1', name: 'Lavender', hex: '#7986cb' },
  { id: '2', name: 'Sage', hex: '#33b679' },
  { id: '3', name: 'Grape', hex: '#8e24aa' },
  { id: '4', name: 'Flamingo', hex: '#e67c73' },
  { id: '5', name: 'Banana', hex: '#f6bf26' },
  { id: '6', name: 'Tangerine', hex: '#f4511e' },
  { id: '7', name: 'Peacock', hex: '#039be5' },
  { id: '8', name: 'Graphite', hex: '#616161' },
  { id: '9', name: 'Blueberry', hex: '#3f51b5' },
  { id: '10', name: 'Basil', hex: '#0b8043' },
  { id: '11', name: 'Tomato', hex: '#d50000' },
];

const EVENT_COLOR_PRESETS = [
  '#94a3b8', '#60a5fa', '#9ca3af', '#fbbf24', '#34d399', '#f87171',
  '#6b7280', '#e879f9', '#a78bfa', '#2dd4bf', '#4ade80', '#f97316',
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
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (c) => Math.max(0, Math.min(255, c));
  const toHex = (c) => clamp(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hsvToRgb({ h, s, v }) {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const val = Math.max(0, Math.min(100, v)) / 100;
  const c = val * sat;
  const seg = (h % 360) / 60;
  const x = c * (1 - Math.abs((seg % 2) - 1));
  const m = val - c;
  let r = 0, g = 0, b = 0;
  if (seg >= 0 && seg < 1) { r = c; g = x; }
  else if (seg >= 1 && seg < 2) { r = x; g = c; }
  else if (seg >= 2 && seg < 3) { g = c; b = x; }
  else if (seg >= 3 && seg < 4) { g = x; b = c; }
  else if (seg >= 4 && seg < 5) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function rgbToHsv({ r, g, b }) {
  const red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * (((blue - red) / delta) + 2);
    else h = 60 * (((red - green) / delta) + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

function isGooglePresetId(id) {
  return /^(1[01]?|[2-9])$/.test(id);
}

function formatDateInputValue(value) {
  if (!value) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateInputValue(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function buildGoogleMeetRequestId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `meet-${globalThis.crypto.randomUUID()}`;
  }

  return `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function TimeSelect({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [h, m] = value.split(':');

  return (
    <div className={`calTimeSelect ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      <div className="calTimeSelectHeader" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <span>{value}</span>
        <ChevronDown size={14} className={isOpen ? 'rotate' : ''} />
      </div>
      {isOpen && (
        <div className="calTimeSelectDropdown glass">
          <div className="calTimeSelectColumn">
            {hours.map(hour => (
              <div 
                key={hour} 
                className={`calTimeSelectOption ${h === hour ? 'selected' : ''}`}
                onClick={() => { onChange(`${hour}:${m}`); setIsOpen(false); }}
              >
                {hour}
              </div>
            ))}
          </div>
          <div className="calTimeSelectColumn">
            {minutes.map(minute => (
              <div 
                key={minute} 
                className={`calTimeSelectOption ${m === minute ? 'selected' : ''}`}
                onClick={() => { onChange(`${h}:${minute}`); setIsOpen(false); }}
              >
                {minute}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventModal({ isOpen, onClose, onSave, onDelete, event, selectedDate, availableCalendars = [], accounts = [] }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(formatDateInputValue(selectedDate));
  const [calendarId, setCalendarId] = useState('primary');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState([]);
  const [guestInput, setGuestInput] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [reminders, setReminders] = useState([{ method: 'popup', minutes: 30 }]);
  const [eventType, setEventType] = useState('default');
  const [autoDecline, setAutoDecline] = useState(true);
  const [declineMessage, setDeclineMessage] = useState('Declined as I am currently out of office.');
  const [hasGoogleMeet, setHasGoogleMeet] = useState(false);
  const [refreshGoogleMeet, setRefreshGoogleMeet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [pendingEventData, setPendingEventData] = useState(null);
  const [pendingRecurringSaveData, setPendingRecurringSaveData] = useState(null);
  const [showRecurringSavePrompt, setShowRecurringSavePrompt] = useState(false);
  const [showRecurringDeletePrompt, setShowRecurringDeletePrompt] = useState(false);
  const [colorId, setColorId] = useState('');
  const [initialColorId, setInitialColorId] = useState('');
  const [isEventColorPickerOpen, setIsEventColorPickerOpen] = useState(false);
  const [isEventColorWheelDragging, setIsEventColorWheelDragging] = useState(false);
  const [eventColorInput, setEventColorInput] = useState('');
  const eventColorPickerRef = useRef(null);
  const eventColorWheelRef = useRef(null);
  const [recurrenceOptions, setRecurrenceOptions] = useState([
    { value: '', label: 'Does not repeat' },
    { value: 'RRULE:FREQ=DAILY', label: 'Daily' },
    { value: 'RRULE:FREQ=WEEKLY', label: 'Weekly' },
    { value: 'RRULE:FREQ=MONTHLY', label: 'Monthly' },
    { value: 'RRULE:FREQ=YEARLY', label: 'Yearly' }
  ]);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setEventDate(formatDateInputValue(event.start));
      setLocation(event.location || '');
      setIsAllDay(event.allDay || false);
      setHasGoogleMeet(Boolean(event.googleMeetLink));
      setRefreshGoogleMeet(false);
      
      if (event.start) {
        const start = new Date(event.start);
        setStartTime(start.toTimeString().slice(0, 5));
      }
      if (event.end) {
        const end = new Date(event.end);
        setEndTime(end.toTimeString().slice(0, 5));
      }
      setCalendarId(event.accountEmail ? `${event.accountEmail}:${event.calendarId || 'primary'}` : (event.calendarId || 'primary'));
    } else {
      setTitle('');
      setDescription('');
      setEventDate(formatDateInputValue(selectedDate));
      
      const activeAccounts = accounts.filter(a => a.active);
      if (activeAccounts.length === 1) {
        const primaryCal = availableCalendars.find(c => c.accountEmail === activeAccounts[0].email && c.primary);
        setCalendarId(primaryCal ? `${activeAccounts[0].email}:${primaryCal.id}` : `${activeAccounts[0].email}:primary`);
      } else {
        setCalendarId('primary');
      }
      setLocation('');
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setHasGoogleMeet(false);
      setRefreshGoogleMeet(false);
      setGuests([]);
      setRecurrence('');
      setReminders([{ method: 'popup', minutes: 30 }]);
      setColorId('');
      setInitialColorId('');
    }
    
    if (event) {
      setGuests(event.attendees?.map(a => a.email) || []);
      setEventType(event.eventType || 'default');
      if (event.outOfOfficeProperties) {
        setAutoDecline(event.outOfOfficeProperties.autoDeclineMode !== 'doNotDecline');
        setDeclineMessage(event.outOfOfficeProperties.declineMessage || '');
      }
      
      // Smarter recurrence detection
      const rrule = event.recurrence?.[0] || '';
      const presets = [
        { value: 'RRULE:FREQ=DAILY', match: 'FREQ=DAILY', label: 'Daily' },
        { value: 'RRULE:FREQ=WEEKLY', match: 'FREQ=WEEKLY', label: 'Weekly' },
        { value: 'RRULE:FREQ=MONTHLY', match: 'FREQ=MONTHLY', label: 'Monthly' },
        { value: 'RRULE:FREQ=YEARLY', match: 'FREQ=YEARLY', label: 'Yearly' }
      ];

      const standardOptions = [
        { value: '', label: 'Does not repeat' },
        ...presets.map(p => ({ value: p.value, label: p.label }))
      ];

      // Try to find a matching preset string or substring
      const matchedPreset = presets.find(p => rrule === p.value);

      if (rrule && !matchedPreset && !standardOptions.some(opt => opt.value === rrule)) {
        const freq = rrule.split('FREQ=')[1]?.split(';')[0];
        const label = `Custom (${freq ? freq.charAt(0) + freq.slice(1).toLowerCase() : 'Recurrence'})`;
        setRecurrenceOptions([...standardOptions, { value: rrule, label }]);
        setRecurrence(rrule);
      } else if (matchedPreset) {
        setRecurrenceOptions(standardOptions);
        setRecurrence(matchedPreset.value); // Use the preset value for dropdown selection
      } else {
        setRecurrenceOptions(standardOptions);
        setRecurrence(rrule); // Likely empty string
      }
      
      setReminders(event.reminders?.overrides || [{ method: 'popup', minutes: 30 }]);
      // Extract colorId — could be a number string like '1'-'11', a custom hex, or empty
      const evtColor = event.color || '';
      const customHex = event.customColor || '';
      if (customHex) {
        // Event has a custom color stored in extendedProperties
        setColorId(customHex);
        setInitialColorId(customHex);
      } else {
        const normalizedColorId = evtColor.startsWith('#') ? '' : evtColor;
        setColorId(normalizedColorId);
        setInitialColorId(normalizedColorId);
      }
      setCalendarId(event.accountEmail ? `${event.accountEmail}:${event.calendarId || 'primary'}` : (event.calendarId || 'primary'));
    }
  }, [event, isOpen, accounts, availableCalendars, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    setShowDeleteConfirm(false);
    setShowRecurringSavePrompt(false);
    setShowRecurringDeletePrompt(false);
    setPendingRecurringSaveData(null);
    setPendingEventData(null);
    setIsEventColorPickerOpen(false);
    setIsEventColorWheelDragging(false);
  }, [isOpen, event?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  // Sync color input text with current color selection
  useEffect(() => {
    if (colorId && colorId.startsWith('#')) {
      setEventColorInput(colorId);
    } else {
      const matched = GOOGLE_EVENT_COLORS.find(c => c.id === colorId);
      setEventColorInput(matched ? matched.hex : '');
    }
  }, [colorId]);

  // Close color picker on outside click
  useEffect(() => {
    if (!isEventColorPickerOpen) return undefined;
    function handleOutsideClick(e) {
      if (eventColorPickerRef.current && !eventColorPickerRef.current.contains(e.target)) {
        setIsEventColorPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isEventColorPickerOpen]);

  // Color wheel drag
  useEffect(() => {
    if (!isEventColorWheelDragging) return undefined;
    function handleMove(e) {
      const wheel = eventColorWheelRef.current;
      if (!wheel) return;
      const rect = wheel.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const radius = rect.width / 2;
      const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), radius);
      const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const sat = (dist / radius) * 100;
      const hex = rgbToHex(hsvToRgb({ h: hue, s: sat, v: 100 }));
      setColorId(hex);
      setEventColorInput(hex);
    }
    function handleUp() { setIsEventColorWheelDragging(false); }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isEventColorWheelDragging]);

  const handleEventColorWheelPointerDown = useCallback((e) => {
    const wheel = eventColorWheelRef.current;
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width / 2;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), radius);
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const sat = (dist / radius) * 100;
    const hex = rgbToHex(hsvToRgb({ h: hue, s: sat, v: 100 }));
    setColorId(hex);
    setEventColorInput(hex);
    setIsEventColorWheelDragging(true);
  }, []);

  const currentColorHex = useMemo(() => {
    if (colorId && colorId.startsWith('#')) return normalizeHexColor(colorId) || '#34d399';
    const matched = GOOGLE_EVENT_COLORS.find(c => c.id === colorId);
    return matched ? matched.hex : '#34d399';
  }, [colorId]);

  const colorWheelPointerStyle = useMemo(() => {
    const hsv = rgbToHsv(hexToRgb(currentColorHex));
    const angle = (hsv.h * Math.PI) / 180;
    const radius = (hsv.s / 100) * 50;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return {
      left: `${Math.max(0, Math.min(100, x))}%`,
      top: `${Math.max(0, Math.min(100, y))}%`,
    };
  }, [currentColorHex]);

  const isCustomColor = colorId && colorId.startsWith('#');

  if (!isOpen) return null;

  const browserTimeZone =
    (typeof window !== 'undefined'
      ? window.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone
      : '') || undefined;
  const recurringOriginalStart = event?.originalStart || event?.start || '';
  const recurringSeriesId = event?.recurringEventId || (event?.recurrence?.length ? event?.id : '');
  const canShowRecurringSavePrompt = Boolean(
    event?.id && recurringSeriesId && recurringOriginalStart
  );
  const canShowRecurringDeletePrompt = Boolean(
    event?.id && (event?.recurringEventId || event?.recurrence?.length)
  );
  const eventPageDateLabel = parseDateInputValue(eventDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const eventFormId = 'cal-event-form';

  const buildEventData = () => {
    const baseDate = parseDateInputValue(eventDate);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    const start = new Date(year, month, day);
    const end = new Date(year, month, day);

    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const isOOO = eventType === 'outOfOffice';
    
    // Helper to format date with local timezone offset for Google Calendar
    const toLocalISOString = (date) => {
      const offset = -date.getTimezoneOffset();
      const diff = offset >= 0 ? '+' : '-';
      const pad = (num) => String(Math.floor(Math.abs(num))).padStart(2, '0');
      return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        diff + pad(offset / 60) +
        ':' + pad(offset % 60);
    };

    const [startH, startM] = startTime.split(':');
    const [endH, endM] = endTime.split(':');
    
    start.setHours(parseInt(startH), parseInt(startM), 0, 0);
    end.setHours(parseInt(endH), parseInt(endM), 0, 0);

    const eventData = {
      summary: title,
      eventType: isOOO ? 'outOfOffice' : 'default',
    };

    if (isOOO) {
      // OOO MUST be timed (dateTime), not date (all-day), even if it covers the whole day.
      if (isAllDay) {
        const oooStart = new Date(year, month, day, 0, 0, 0);
        const oooEnd = new Date(year, month, day, 23, 59, 59);
        eventData.start = { dateTime: toLocalISOString(oooStart), timeZone: browserTimeZone };
        eventData.end = { dateTime: toLocalISOString(oooEnd), timeZone: browserTimeZone };
      } else {
        eventData.start = { dateTime: toLocalISOString(start), timeZone: browserTimeZone };
        eventData.end = { dateTime: toLocalISOString(end), timeZone: browserTimeZone };
      }
      
      eventData.outOfOfficeProperties = {
        autoDeclineMode: autoDecline ? 'declineAllConflictingInvitations' : 'declineNone',
        declineMessage: declineMessage
      };
      eventData.transparency = 'opaque';
    } else {
      // Default events can be all-day (date) or timed (dateTime)
      if (isAllDay) {
        eventData.start = { date: formatDate(start) };
        eventData.end = { date: formatDate(new Date(end.getTime() + 86400000)) };
      } else {
        eventData.start = { dateTime: toLocalISOString(start), timeZone: browserTimeZone };
        eventData.end = { dateTime: toLocalISOString(end), timeZone: browserTimeZone };
      }

      eventData.description = description;
      eventData.location = location;

      if (event?.id) {
        if (colorId && isGooglePresetId(colorId)) {
          eventData.colorId = colorId;
          // Clear any previous custom color
          eventData.extendedProperties = { private: { customColor: '' } };
        } else if (colorId && colorId.startsWith('#')) {
          // Custom hex — store in extendedProperties
          eventData.extendedProperties = { private: { customColor: colorId } };
        } else if (initialColorId && !colorId) {
          // User cleared colour → reset to calendar default
          eventData.colorId = null;
          eventData.extendedProperties = { private: { customColor: '' } };
        }
      } else if (colorId && isGooglePresetId(colorId)) {
        eventData.colorId = colorId;
      } else if (colorId && colorId.startsWith('#')) {
        eventData.extendedProperties = { private: { customColor: colorId } };
      }

      eventData.attendees = guests.map(email => ({ email }));
      eventData.recurrence = recurrence ? [recurrence] : undefined;
      eventData.reminders = {
        useDefault: false,
        overrides: reminders
      };

      if (hasGoogleMeet && (!event?.googleMeetLink || refreshGoogleMeet)) {
        eventData.conferenceData = {
          createRequest: {
            requestId: buildGoogleMeetRequestId(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      } else if (!hasGoogleMeet && event?.googleMeetLink) {
        eventData.conferenceData = null;
      }
    }

    return eventData;
  };

  const persistEvent = async (eventData, saveOptions = {}) => {
    let finalCalendarId = calendarId;
    let accEmail = event?.accountEmail;

    if (calendarId.includes(':')) {
      const [email, id] = calendarId.split(':');
      accEmail = email;
      finalCalendarId = id;
    } else if (!accEmail) {
      const activeAccounts = accounts.filter(a => a.active);
      if (activeAccounts.length === 1) {
        accEmail = activeAccounts[0].email;
      } else if (activeAccounts.length > 1) {
        setPendingEventData({ eventData, saveOptions });
        setShowAccountPrompt(true);
        return { deferred: true };
      } else {
        const selectedCal = availableCalendars.find(c => c.id === calendarId);
        accEmail = selectedCal?.accountEmail;
      }
    }

    if (!accEmail) {
      throw new Error('Please select an account');
    }

    await onSave(eventData, finalCalendarId, accEmail, saveOptions);
    return { deferred: false };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const eventData = buildEventData();

    if (canShowRecurringSavePrompt) {
      setPendingRecurringSaveData(eventData);
      setShowDeleteConfirm(false);
      setShowRecurringSavePrompt(true);
      return;
    }

    setLoading(true);
    let result = { deferred: false };

    try {
      result = await persistEvent(eventData);
      if (!result.deferred) onClose();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save event', 'error');
    } finally {
      if (!result.deferred) setLoading(false);
    }
  };

  const handleAccountSelect = async (email) => {
    setShowAccountPrompt(false);
    setLoading(true);
    try {
      await onSave(pendingEventData?.eventData, 'primary', email, pendingEventData?.saveOptions || {});
      onClose();
    } catch (err) {
      console.error(err);
      toast('Failed to save event to selected account', 'error');
    } finally {
      setLoading(false);
      setPendingEventData(null);
    }
  };

  const handleRecurringSaveChoice = async (mode) => {
    if (!pendingRecurringSaveData || !event) return;

    setShowRecurringSavePrompt(false);
    setLoading(true);
    let result = { deferred: false };
    const eventData =
      mode === 'this'
        ? { ...pendingRecurringSaveData, recurrence: undefined }
        : pendingRecurringSaveData;

    try {
      result = await persistEvent(eventData, {
        recurringEdit: {
          mode,
          recurringEventId: recurringSeriesId,
          originalStart: recurringOriginalStart,
        },
      });
      if (!result.deferred) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save event', 'error');
    } finally {
      if (!result.deferred) {
        setLoading(false);
        setPendingRecurringSaveData(null);
      }
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (!event.accountEmail) {
        throw new Error('No account associated with this event');
      }
      
      let finalCalendarId = calendarId;
      if (calendarId.includes(':')) {
        finalCalendarId = calendarId.split(':')[1];
      }
      
      await onDelete(event.id, finalCalendarId, event.accountEmail);
      onClose();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to delete event', 'error');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRecurringDeleteChoice = async (mode) => {
    if (!event?.accountEmail) {
      toast('No account associated with this event', 'error');
      return;
    }

    setShowRecurringDeletePrompt(false);
    setLoading(true);

    try {
      let finalCalendarId = calendarId;
      if (calendarId.includes(':')) {
        finalCalendarId = calendarId.split(':')[1];
      }

      await onDelete(event.id, finalCalendarId, event.accountEmail, {
        recurringDelete: {
          mode,
          recurringEventId: event.recurringEventId,
          originalStart: recurringOriginalStart,
        },
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to delete event', 'error');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddGuest = (email) => {
    if (email && email.includes('@') && !guests.includes(email)) {
      setGuests([...guests, email]);
    }
  };

  const getReminderValue = () => {
    return reminders[0]?.minutes?.toString() || '30';
  };

  const handleReminderChange = (minutes) => {
    setReminders([{ method: 'popup', minutes: parseInt(minutes) }]);
  };

  const googleMeetLink = event?.googleMeetLink || '';

  return (
    <div className="calEventPageOverlay" onClick={onClose}>
      <div className="calEventPage" onClick={(e) => e.stopPropagation()}>
        <header className="calModalHeader calEventPageHeader">
          <div className="calEventPageHeading">
            <h2 className="calEventPageTitle">{event ? 'Edit Event' : 'New Event'}</h2>
            <p className="calEventPageMeta">{eventPageDateLabel}</p>
          </div>

          <div className="calEventPageHeaderActions">
            {hasGoogleMeet && googleMeetLink ? (
              <a
                href={googleMeetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="calEventPageMeetBtn"
                title="Open Google Meet"
                aria-label="Open Google Meet in a new tab"
              >
                <Video size={16} />
              </a>
            ) : null}

            {event && !showDeleteConfirm ? (
              <button
                type="button"
                className="calDeleteBtn calEventPageDeleteBtn"
                onClick={() => {
                  if (canShowRecurringDeletePrompt) {
                    setShowDeleteConfirm(false);
                    setShowRecurringDeletePrompt(true);
                    return;
                  }

                  setShowDeleteConfirm(true);
                }}
                disabled={loading}
                title="Delete event"
              >
                <Trash2 size={16} />
              </button>
            ) : null}

            {event && showDeleteConfirm ? (
              <div className="calEventPageDeleteConfirm">
                <span className="calDeleteConfirmText">Delete this event?</span>
                <div className="calDeleteConfirmActions">
                  <button type="button" className="calDeleteConfirmYes" onClick={handleDelete} disabled={loading}>
                    {loading ? '...' : 'Delete'}
                  </button>
                  <button type="button" className="calDeleteConfirmNo" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="calEventPagePrimaryActions">
                <button type="button" className="btn-secondary calEventPageActionBtn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  form={eventFormId}
                  className="btn-primary calEventPageActionBtn"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : event ? 'Save Event' : 'Create Event'}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="calEventPageBody">
          <form id={eventFormId} onSubmit={handleSubmit} className="calModalForm calEventPageForm">
            <div className="calFormGroup">
              <input
                type="text"
                className="authInput calTitleInput"
                placeholder="Event Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="calFormRow">
              <div className="calFormGroup">
                <label><CalIcon size={16} /> Day</label>
                <TasksDatePicker
                  value={eventDate}
                  onChange={setEventDate}
                  placeholder="Select day"
                  className="calEventDatePicker"
                />
              </div>

              <div className="calFormGroup">
                <label><Clock size={16} /> Time</label>
                <div className="calTimeInputs">
                  <TimeSelect
                    value={startTime}
                    onChange={setStartTime}
                    disabled={isAllDay}
                  />
                  <span className="calTimeSeparator">to</span>
                  <TimeSelect
                    value={endTime}
                    onChange={setEndTime}
                    disabled={isAllDay}
                  />
                </div>
                <label className="calCheckboxLabel">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                  />
                  All Day
                </label>
              </div>
            </div>

            <div className="calFormRow">
              <div className="calFormGroup">
                <label><Palette size={16} /> Type</label>
                <div className="calEventTypeTabs">
                  <button
                    type="button"
                    className={`calTypeTab ${eventType === 'default' ? 'active' : ''}`}
                    onClick={() => setEventType('default')}
                    disabled={event && event.id && event.eventType !== 'default'}
                  >
                    Event
                  </button>
                  <button
                    type="button"
                    className={`calTypeTab ${eventType === 'outOfOffice' ? 'active' : ''}`}
                    onClick={() => {
                      setEventType('outOfOffice');
                      setIsAllDay(true);
                      setHasGoogleMeet(false);
                      setRefreshGoogleMeet(false);
                    }}
                    disabled={event && event.id && event.eventType !== 'outOfOffice'}
                  >
                    Out of Office
                  </button>
                </div>
              </div>
            </div>

            {eventType === 'outOfOffice' && (
              <div className="calOOOSection glass">
                <label className="calCheckboxLabel">
                  <input
                    type="checkbox"
                    checked={autoDecline}
                    onChange={(e) => setAutoDecline(e.target.checked)}
                  />
                  Automatically decline meetings
                </label>
                {autoDecline && (
                  <textarea
                    className="authInput calOOOMessage"
                    placeholder="Decline message"
                    value={declineMessage}
                    onChange={(e) => setDeclineMessage(e.target.value)}
                    rows={2}
                  />
                )}
              </div>
            )}

            {eventType === 'default' && (
              <div className="calFormRow">
                <div className="calFormGroup">
                  <label><Video size={16} /> Google Meet</label>
                  <div className="calMeetControls">
                    <label className="calCheckboxLabel">
                      <input
                        type="checkbox"
                        checked={hasGoogleMeet}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasGoogleMeet(checked);
                          if (!checked) {
                            setRefreshGoogleMeet(false);
                          }
                        }}
                      />
                      Use Google Meet
                    </label>

                    {hasGoogleMeet && googleMeetLink && (
                      <>
                        <label className="calCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={refreshGoogleMeet}
                            onChange={(e) => setRefreshGoogleMeet(e.target.checked)}
                          />
                          Generate a new Meet link on save
                        </label>
                      </>
                    )}

                    {hasGoogleMeet && !googleMeetLink && (
                      <p className="calMeetHint">
                        A Google Meet link will be created when you save this event.
                      </p>
                    )}

                    {!hasGoogleMeet && googleMeetLink && (
                      <p className="calMeetHint">
                        Saving will remove the current Google Meet link from this event.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="calFormRow">
              <div className="calFormGroup" style={{ flex: 1 }}>
                <label><Repeat size={16} /> Repeat</label>
                <CustomSelect
                  options={recurrenceOptions}
                  value={recurrence}
                  onChange={setRecurrence}
                />
              </div>
            </div>

            <div className="calFormRow">
              <div className="calFormGroup">
                <label><CalIcon size={16} /> Calendar</label>
                <CustomSelect
                  options={[
                    { value: 'primary', label: 'Default (Primary)', color: 'rgba(255,255,255,0.2)' },
                    ...availableCalendars.map(cal => ({
                      value: `${cal.accountEmail}:${cal.id}`,
                      label: `${cal.summary}${cal.primary ? ' (Primary)' : ''} (${cal.accountEmail})`,
                      color: cal.backgroundColor
                    }))
                  ]}
                  value={calendarId.includes(':') ? calendarId : availableCalendars.find(c => c.id === calendarId)?.accountEmail ? `${availableCalendars.find(c => c.id === calendarId).accountEmail}:${calendarId}` : calendarId}
                  onChange={setCalendarId}
                  disabled={event && !!event.id}
                />
              </div>

              <div className="calFormGroup">
                <label><Palette size={16} /> Event Color</label>
                <div className="calEventColorPickerWrap" ref={eventColorPickerRef}>
                  <div className="calEventColorPicker">
                    <button
                      type="button"
                      className={`calEventColorSwatch calEventColorDefault ${!colorId ? 'active' : ''}`}
                      onClick={() => { setColorId(''); setIsEventColorPickerOpen(false); }}
                      title="Calendar default"
                    >
                      <span style={{ background: 'linear-gradient(135deg, #34d399, #60a5fa)' }} />
                    </button>
                    {GOOGLE_EVENT_COLORS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className={`calEventColorSwatch ${colorId === c.id ? 'active' : ''}`}
                        onClick={() => { setColorId(c.id); setIsEventColorPickerOpen(false); }}
                        title={c.name}
                      >
                        <span style={{ backgroundColor: c.hex }} />
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`calEventColorSwatch calEventColorCustomTrigger ${isCustomColor ? 'active' : ''}`}
                      onClick={() => setIsEventColorPickerOpen(prev => !prev)}
                      title="Custom color"
                    >
                      <span style={{ backgroundColor: isCustomColor ? colorId : undefined }} />
                    </button>
                  </div>

                  {isEventColorPickerOpen && (
                    <div className="calEventColorPopover">
                      <div
                        ref={eventColorWheelRef}
                        className="tasksStatusColorWheel"
                        onPointerDown={handleEventColorWheelPointerDown}
                        role="presentation"
                      >
                        <span
                          className="tasksStatusColorWheelPointer"
                          style={colorWheelPointerStyle}
                        />
                      </div>

                      <div className="tasksStatusConfigSwatches">
                        {EVENT_COLOR_PRESETS.map(color => (
                          <button
                            key={color}
                            type="button"
                            className={`tasksStatusConfigSwatch ${colorId === color ? 'isActive' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => { setColorId(color); setEventColorInput(color); }}
                            aria-label={`Set color ${color}`}
                          />
                        ))}
                      </div>

                      <div className="tasksStatusConfigHexRow">
                        <label>Hex</label>
                        <input
                          type="text"
                          value={eventColorInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEventColorInput(val);
                            const norm = normalizeHexColor(val);
                            if (norm) setColorId(norm);
                          }}
                          onBlur={() => setEventColorInput(currentColorHex)}
                          placeholder="#ffffff"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="calFormRow">
              <div className="calFormGroup">
                <label><MapPin size={16} /> Location</label>
                <input
                  type="text"
                  className="authInput"
                  placeholder="Add location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="calFormGroup">
                <label><Bell size={16} /> Reminder</label>
                <CustomSelect
                  options={[
                    { value: '10', label: '10 minutes before' },
                    { value: '30', label: '30 minutes before' },
                    { value: '60', label: '1 hour before' },
                    { value: '1440', label: '1 day before' }
                  ]}
                  value={getReminderValue()}
                  onChange={handleReminderChange}
                />
              </div>
            </div>

            <div className="calFormGroup">
              <label><Users size={16} /> Guests</label>
              <div className="calGuestInputWrapper">
                <input
                  type="email"
                  className="authInput"
                  placeholder="Add guest email and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGuest(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              {guests.length > 0 && (
                <div className="calGuestChips">
                  {guests.map((email, i) => (
                    <div key={i} className="calGuestChip">
                      <span>{email}</span>
                      <button type="button" onClick={() => setGuests(guests.filter((_, idx) => idx !== i))}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="calFormGroup">
              <label><AlignLeft size={16} /> Description</label>
              <textarea
                className="authInput calTextarea"
                placeholder="Add description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

          </form>
        </div>
      </div>

      <AccountPromptModal
        isOpen={showAccountPrompt}
        onClose={() => setShowAccountPrompt(false)}
        accounts={accounts}
        onSelect={handleAccountSelect}
      />

      {showRecurringSavePrompt && (
        <div className="calScopeModalOverlay" onClick={() => setShowRecurringSavePrompt(false)}>
          <div className="calScopeModal glass" onClick={(e) => e.stopPropagation()}>
            <div className="calScopeModalHeader">
              <h4>Save Recurring Changes</h4>
              <button
                type="button"
                className="calModalClose"
                onClick={() => setShowRecurringSavePrompt(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="calScopeModalText">
              Choose how these changes should be applied to this recurring event.
            </p>
            <p className="calScopeModalNote">
              Applying changes to future events can reset later exceptions in the series.
            </p>
            <div className="calScopeModalActions">
              <button
                type="button"
                className="calScopeModalPrimary"
                onClick={() => handleRecurringSaveChoice('this')}
                disabled={loading}
              >
                Only this event
              </button>
              <button
                type="button"
                className="calScopeModalPrimary"
                onClick={() => handleRecurringSaveChoice('future')}
                disabled={loading}
              >
                This and all future events
              </button>
              <button
                type="button"
                className="calScopeModalSecondary"
                onClick={() => setShowRecurringSavePrompt(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecurringDeletePrompt && (
        <div className="calScopeModalOverlay" onClick={() => setShowRecurringDeletePrompt(false)}>
          <div className="calScopeModal glass" onClick={(e) => e.stopPropagation()}>
            <div className="calScopeModalHeader">
              <h4>Delete Recurring Event</h4>
              <button
                type="button"
                className="calModalClose"
                onClick={() => setShowRecurringDeletePrompt(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="calScopeModalText">
              Choose how this recurring event should be deleted.
            </p>
            <p className="calScopeModalNote">
              Deleting future events will trim the series starting from this occurrence.
            </p>
            <div className="calScopeModalActions">
              <button
                type="button"
                className="calScopeModalDanger"
                onClick={() => handleRecurringDeleteChoice('this')}
                disabled={loading}
              >
                Only this event
              </button>
              <button
                type="button"
                className="calScopeModalDanger"
                onClick={() => handleRecurringDeleteChoice('future')}
                disabled={loading}
              >
                This and all future events
              </button>
              <button
                type="button"
                className="calScopeModalSecondary"
                onClick={() => setShowRecurringDeletePrompt(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
