export function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

export function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function endOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

export function toLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMonthLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function formatWeekday(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: options.long ? 'long' : 'short',
  });
}

export function formatShortDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatFullDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTimeRange(start, end) {
  const startLabel = formatTime(start);
  const endLabel = formatTime(end);
  if (!startLabel && !endLabel) return '';
  if (!endLabel) return startLabel;
  return `${startLabel} - ${endLabel}`;
}

export function parseDateInputValue(value) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInputValue(value) {
  if (!value) return '';
  return toLocalDateKey(value);
}

export function combineDateAndTime(dateValue, timeValue) {
  const baseDate = parseDateInputValue(dateValue);
  if (!baseDate) return null;

  const [hours = '00', minutes = '00'] = String(timeValue || '00:00').split(':');
  baseDate.setHours(Number(hours), Number(minutes), 0, 0);
  return baseDate;
}

export function toLocalISOStringWithOffset(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (value) => String(Math.floor(Math.abs(value))).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

export function isSameDay(left, right) {
  return toLocalDateKey(left) === toLocalDateKey(right);
}

export function sortByDateAsc(items, selector) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(selector(left) || 0).getTime();
    const rightDate = new Date(selector(right) || 0).getTime();
    return leftDate - rightDate;
  });
}
