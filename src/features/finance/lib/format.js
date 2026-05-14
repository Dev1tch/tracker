'use client';

import { CURRENCY_OPTIONS } from './defaults';

export function getCurrencyMeta(code) {
  return CURRENCY_OPTIONS.find((c) => c.code === code) || { code, symbol: code, label: code };
}

export function formatMoney(amount, currency, { signed = false, hidden = false } = {}) {
  const meta = getCurrencyMeta(currency);
  if (hidden) {
    return `${meta.symbol} ••••`;
  }
  const value = Number(amount) || 0;
  const formatted = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: meta.code === 'JPY' || meta.code === 'KRW' ? 0 : 2,
    maximumFractionDigits: meta.code === 'JPY' || meta.code === 'KRW' ? 0 : 2,
  });
  const sign = signed && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${meta.symbol}${formatted}`;
}

export function getYYYYMMDD(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDayLabel(dateStr) {
  const today = getYYYYMMDD(new Date());
  const yesterday = getYYYYMMDD(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function formatMonthLabel(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: getYYYYMMDD(start), end: getYYYYMMDD(end) };
}

export function dateInRange(dateStr, start, end) {
  return dateStr >= start && dateStr <= end;
}
