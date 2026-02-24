export function toDateInputValue(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function toIsoOrNull(dateInputValue) {
  if (!dateInputValue) return null;
  const date = new Date(`${dateInputValue}T00:00:00`);
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
