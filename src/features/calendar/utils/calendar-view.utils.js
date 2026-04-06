const GOOGLE_EVENT_COLORS = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6bf26',
  '6': '#f4511e',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#d50000',
};

const TASK_EVENT_DURATION_MINUTES = 30;

export function parseCalendarDate(value) {
  if (!value) return null;

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function isSameCalendarDay(firstDate, secondDate) {
  const dateOne = parseCalendarDate(firstDate);
  const dateTwo = parseCalendarDate(secondDate);

  if (!dateOne || !dateTwo) return false;

  return (
    dateOne.getDate() === dateTwo.getDate() &&
    dateOne.getMonth() === dateTwo.getMonth() &&
    dateOne.getFullYear() === dateTwo.getFullYear()
  );
}

export function isCalendarEventOnDay(event, dayDate) {
  const start = parseCalendarDate(event.start);
  const end = parseCalendarDate(event.end);

  if (!start || !end) return false;

  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);

  if (event.allDay) {
    return dayStart >= start && dayStart < end;
  }

  return start <= dayEnd && end >= dayStart;
}

export function getCalendarEventColor(event) {
  if (event.customColor) return event.customColor;

  if (!event.color) {
    return event.calendarColor || '#34d399';
  }

  return GOOGLE_EVENT_COLORS[event.color] || event.color;
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
}

export function createTaskCalendarEvents(tasks = []) {
  return tasks
    .filter(
      (task) =>
        task.due_date &&
        !['completed', 'cancelled', 'archived'].includes(task.status?.toLowerCase())
    )
    .map((task) => {
      const start = parseCalendarDate(task.due_date);
      const end = start
        ? new Date(start.getTime() + TASK_EVENT_DURATION_MINUTES * 60 * 1000)
        : null;

      return {
        id: `task-${task.id}`,
        title: task.title,
        start: task.due_date,
        end: end ? end.toISOString() : task.due_date,
        color: '#ef4444',
        calendarColor: '#ef4444',
        eventType: 'task',
        originalTask: task,
      };
    })
    .filter((taskEvent) => taskEvent.end);
}

export function formatCalendarTimeRange(startValue, endValue) {
  const start = parseCalendarDate(startValue);
  const end = parseCalendarDate(endValue);

  if (!start) return '';

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!end) return formatter.format(start);

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}
