'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  isCalendarEventOnDay,
  isSameCalendarDay,
} from '../utils/calendar-view.utils';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  const isToday = (date) => isSameCalendarDay(date, today);

  const isSelected = (date) => selectedDate && isSameCalendarDay(date, selectedDate);

  const hasEvents = (date) => {
    return events.some(event => {
      const compositeId = `${event.accountEmail}-${event.calendarId}`;
      return enabledCalendarIds?.has(compositeId) && isCalendarEventOnDay(event, date);
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
