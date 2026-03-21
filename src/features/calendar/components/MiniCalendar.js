'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseEventDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

function isEventOnDate(event, date) {
  const start = parseEventDate(event.start);
  const end = parseEventDate(event.end);
  if (!start || !end) return false;

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  if (event.allDay) {
    return dayStart >= start && dayStart < end;
  }

  return start <= dayEnd && end >= dayStart;
}

export default function MiniCalendar({
  selectedDate,
  onDateSelect,
  events = [],
  enabledCalendarIds,
  weekStartDay = 0,
}) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate || new Date()));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const leadingDays = (firstDayOfMonth - weekStartDay + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const orderedDays = useMemo(
    () => [...DAYS.slice(weekStartDay), ...DAYS.slice(0, weekStartDay)],
    [weekStartDay]
  );

  const calendarDays = [];
  for (let i = leadingDays - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, isCurrentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
  }

  const today = new Date();
  const isToday = (date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isSelected = (date) =>
    selectedDate &&
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  const hasEvents = (date) => {
    return events.some(event => {
      const compositeId = `${event.accountEmail}-${event.calendarId}`;
      return enabledCalendarIds?.has(compositeId) && isEventOnDate(event, date);
    });
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="miniCal">
      <div className="miniCalHeader">
        <span className="miniCalTitle">{MONTHS[month]} {year}</span>
        <div className="miniCalNav">
          <button className="miniCalNavBtn" onClick={prevMonth}><ChevronLeft size={14} /></button>
          <button className="miniCalNavBtn" onClick={nextMonth}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="miniCalDays">
        {orderedDays.map((d, i) => <span key={i} className="miniCalDayName">{d}</span>)}
      </div>
      <div className="miniCalGrid">
        {calendarDays.map((cell, i) => (
          <button
            key={i}
            className={`miniCalCell ${!cell.isCurrentMonth ? 'miniCalOther' : ''} ${isToday(cell.date) ? 'miniCalToday' : ''} ${isSelected(cell.date) ? 'miniCalSelected' : ''}`}
            onClick={() => onDateSelect(cell.date)}
          >
            {cell.day}
            {cell.isCurrentMonth && hasEvents(cell.date) && <span className="miniCalDot" />}
          </button>
        ))}
      </div>
    </div>
  );
}
