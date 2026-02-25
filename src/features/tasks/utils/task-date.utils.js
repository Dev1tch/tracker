function pad2(value) {
  return String(value).padStart(2, '0');
}

export function toDateInputValue(isoString, { includeTime = false } = {}) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  if (!includeTime) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function toIsoOrNull(dateInputValue) {
  if (!dateInputValue) return null;

  const value = String(dateInputValue).trim();
  if (!value) return null;

  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date = new Date(`${value}T00:00:00`);
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    date = new Date(`${value}:00`);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatShortDate(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isDueInRange(taskDueDate, dueFrom, dueTo) {
  if (!dueFrom && !dueTo) return true;
  if (!taskDueDate) return false;

  const due = new Date(taskDueDate);
  if (Number.isNaN(due.getTime())) return false;

  if (dueFrom) {
    const from = new Date(`${dueFrom}T00:00:00`);
    if (due < from) return false;
  }

  if (dueTo) {
    const to = new Date(`${dueTo}T23:59:59`);
    if (due > to) return false;
  }

  return true;
}
