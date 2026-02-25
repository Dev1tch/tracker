import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateValue(value) {
  if (!value) return null;
  const normalizedValue = String(value).trim();
  if (!normalizedValue) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    const [year, month, day] = normalizedValue.split('-').map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalizedValue)) {
    const [datePart, timePart] = normalizedValue.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDateValue(date, { includeTime = false } = {}) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  if (!includeTime) return `${year}-${month}-${day}`;

  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalize(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default function TasksDatePicker({
  value,
  onChange,
  rangeStart,
  rangeEnd,
  onRangeChange,
  placeholder,
  min,
  max,
  showTime = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef(null);
  const isRangeMode = typeof onRangeChange === 'function';
  const isTimeMode = showTime && !isRangeMode;

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const selectedRangeStart = useMemo(() => parseDateValue(rangeStart), [rangeStart]);
  const selectedRangeEnd = useMemo(() => parseDateValue(rangeEnd), [rangeEnd]);
  const minDate = useMemo(() => parseDateValue(min), [min]);
  const maxDate = useMemo(() => parseDateValue(max), [max]);

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = selectedRangeEnd || selectedRangeStart || selectedDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedTime, setSelectedTime] = useState(() => {
    const base = selectedDate || new Date();
    return {
      hour: base.getHours(),
      minute: base.getMinutes(),
    };
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return undefined;

    const estimatePopoverHeight = isTimeMode ? 360 : 310;

    function handleViewportChange() {
      const nextRect = containerRef.current?.getBoundingClientRect();
      if (!nextRect) return;
      const nextBelow = window.innerHeight - nextRect.bottom;
      const nextAbove = nextRect.top;
      setOpenUp(nextBelow < estimatePopoverHeight && nextAbove > nextBelow);
    }

    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, isTimeMode]);

  const today = useMemo(() => normalize(new Date()), []);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatForDisplay = (date) => {
    if (isTimeMode) {
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  const displayValue = isRangeMode
    ? (
      selectedRangeStart && selectedRangeEnd
        ? `${formatForDisplay(selectedRangeStart)} - ${formatForDisplay(selectedRangeEnd)}`
        : selectedRangeStart
          ? `${formatForDisplay(selectedRangeStart)} - ...`
          : ''
    )
    : (
      selectedDate ? formatForDisplay(selectedDate) : ''
    );

  const isDayDisabled = (date) => {
    const current = normalize(date);
    if (minDate && current < normalize(minDate)) return true;
    if (maxDate && current > normalize(maxDate)) return true;
    return false;
  };

  const handleSingleDateChange = (date) => {
    const next = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      isTimeMode ? selectedTime.hour : 0,
      isTimeMode ? selectedTime.minute : 0,
      0,
      0
    );
    onChange(toDateValue(next, { includeTime: isTimeMode }));
    if (!isTimeMode) {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (nextValue) => {
    const [nextHourRaw, nextMinuteRaw] = nextValue.split(':');
    const nextHour = Number(nextHourRaw);
    const nextMinute = Number(nextMinuteRaw);

    if (
      Number.isNaN(nextHour) ||
      Number.isNaN(nextMinute) ||
      nextHour < 0 ||
      nextHour > 23 ||
      nextMinute < 0 ||
      nextMinute > 59
    ) {
      return;
    }

    const nextTime = { hour: nextHour, minute: nextMinute };
    setSelectedTime(nextTime);

    if (!selectedDate) return;

    const nextDate = new Date(selectedDate);
    nextDate.setHours(nextTime.hour, nextTime.minute, 0, 0);
    onChange(toDateValue(nextDate, { includeTime: true }));
  };

  const handleRangeDateChange = (date) => {
    if (!selectedRangeStart || selectedRangeEnd) {
      onRangeChange(toDateValue(date), '');
      return;
    }

    const start = normalize(selectedRangeStart);
    const target = normalize(date);

    if (target < start) {
      onRangeChange(toDateValue(target), toDateValue(start));
    } else {
      onRangeChange(toDateValue(start), toDateValue(target));
    }

    setIsOpen(false);
  };

  return (
    <div className={`tasksDatePicker ${className}`.trim()} ref={containerRef}>
      <button
        type="button"
        className={`tasksDateTrigger ${isOpen ? 'open' : ''} ${
          (isRangeMode ? selectedRangeStart || selectedRangeEnd : selectedDate) ? 'hasValue' : ''
        }`}
        onClick={() => {
          if (!isOpen) {
            const base = selectedRangeEnd || selectedRangeStart || selectedDate || new Date();
            setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1));
            if (isTimeMode) {
              setSelectedTime({
                hour: base.getHours(),
                minute: base.getMinutes(),
              });
            }
          }
          setIsOpen((prev) => !prev);
        }}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar size={14} />
      </button>

      {isOpen ? (
        <div className={`tasksDatePopover ${openUp ? 'openUp' : ''}`}>
          <div className="tasksDateHeader">
            <button
              type="button"
              className="tasksIconBtn"
              onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
              title="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              className="tasksIconBtn"
              onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
              title="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="tasksDateWeekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="tasksDateGrid">
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <span key={`empty-${idx}`} className="tasksDateCell isPlaceholder" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const date = new Date(year, month, day);
              const disabled = isDayDisabled(date);
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              const isRangeStart = selectedRangeStart ? isSameDay(date, selectedRangeStart) : false;
              const isRangeEnd = selectedRangeEnd ? isSameDay(date, selectedRangeEnd) : false;
              const isInRange = selectedRangeStart && selectedRangeEnd
                ? (
                  normalize(date) > normalize(selectedRangeStart) &&
                  normalize(date) < normalize(selectedRangeEnd)
                )
                : false;
              const isToday = isSameDay(date, today);

              return (
                <button
                  key={toDateValue(date)}
                  type="button"
                  className={`tasksDateCell ${
                    isSelected || isRangeStart || isRangeEnd ? 'isSelected' : ''
                  } ${isInRange ? 'isInRange' : ''} ${isToday ? 'isToday' : ''}`}
                  disabled={disabled}
                  onClick={() => (isRangeMode ? handleRangeDateChange(date) : handleSingleDateChange(date))}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {isTimeMode ? (
            <div className="tasksDateTimeRow">
              <span>Time</span>
              <input
                type="time"
                step={60}
                value={`${pad2(selectedTime.hour)}:${pad2(selectedTime.minute)}`}
                onChange={(event) => handleTimeChange(event.target.value)}
              />
              <button
                type="button"
                className="tasksDateDoneBtn"
                onClick={() => setIsOpen(false)}
              >
                Done
              </button>
            </div>
          ) : null}

          {(isRangeMode ? selectedRangeStart || selectedRangeEnd : selectedDate) ? (
            <button
              type="button"
              className="tasksDateResetBtn"
              onClick={() => {
                if (isRangeMode) onRangeChange('', '');
                else onChange('');
              }}
            >
              {isRangeMode ? 'Clear range' : 'Clear date'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
