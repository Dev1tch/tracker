import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseDateValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const isRangeMode = typeof onRangeChange === 'function';

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const selectedRangeStart = useMemo(() => parseDateValue(rangeStart), [rangeStart]);
  const selectedRangeEnd = useMemo(() => parseDateValue(rangeEnd), [rangeEnd]);
  const minDate = useMemo(() => parseDateValue(min), [min]);
  const maxDate = useMemo(() => parseDateValue(max), [max]);

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = selectedRangeEnd || selectedRangeStart || selectedDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
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

  const today = useMemo(() => normalize(new Date()), []);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatForDisplay = (date) =>
    date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
    onChange(toDateValue(date));
    setIsOpen(false);
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
          }
          setIsOpen((prev) => !prev);
        }}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar size={14} />
      </button>

      {isOpen ? (
        <div className="tasksDatePopover">
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
