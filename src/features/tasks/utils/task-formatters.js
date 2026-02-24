import { PRIORITY_META, STATUS_META } from '@/features/tasks/constants/task-board.constants';

function toTitleCaseEnum(value, fallback) {
  return value
    ?.toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || fallback;
}

export function formatStatus(status) {
  if (STATUS_META[status]) return STATUS_META[status].label;
  return toTitleCaseEnum(status, 'Unknown');
}

export function formatPriority(priority) {
  if (PRIORITY_META[priority]) return PRIORITY_META[priority].label;
  return toTitleCaseEnum(priority, 'Normal');
}
