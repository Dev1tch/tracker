import { TASK_PRIORITY, TASK_STATUS } from '../shared/api';

export { TASK_PRIORITY, TASK_STATUS };

export const STATUS_ORDER = [
  TASK_STATUS.TO_DO,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.PAUSED,
  TASK_STATUS.IN_REVIEW,
  TASK_STATUS.COMPLETED,
  TASK_STATUS.CANCELLED,
  TASK_STATUS.ARCHIVED,
];

export const PRIORITY_ORDER = [
  TASK_PRIORITY.URGENT,
  TASK_PRIORITY.HIGH,
  TASK_PRIORITY.NORMAL,
  TASK_PRIORITY.LOW,
];

export const STATUS_META = {
  [TASK_STATUS.TO_DO]: { label: 'To Do', color: '#94a3b8' },
  [TASK_STATUS.IN_PROGRESS]: { label: 'In Progress', color: '#60a5fa' },
  [TASK_STATUS.PAUSED]: { label: 'Paused', color: '#9ca3af' },
  [TASK_STATUS.IN_REVIEW]: { label: 'In Review', color: '#fbbf24' },
  [TASK_STATUS.COMPLETED]: { label: 'Completed', color: '#34d399' },
  [TASK_STATUS.CANCELLED]: { label: 'Cancelled', color: '#f87171' },
  [TASK_STATUS.ARCHIVED]: { label: 'Archived', color: '#6b7280' },
};

export const PRIORITY_META = {
  [TASK_PRIORITY.URGENT]: { label: 'Urgent', color: '#f87171' },
  [TASK_PRIORITY.HIGH]: { label: 'High', color: '#fbbf24' },
  [TASK_PRIORITY.NORMAL]: { label: 'Normal', color: '#60a5fa' },
  [TASK_PRIORITY.LOW]: { label: 'Low', color: '#9ca3af' },
};

export const DEFAULT_TASK_FORM = {
  title: '',
  description: '',
  project_id: '',
  assignee_user_id: '',
  task_type_id: '',
  parent_task_id: '',
  status: TASK_STATUS.TO_DO,
  priority: TASK_PRIORITY.NORMAL,
  due_date: '',
};

function getSingleSelectedValue(values) {
  return Array.isArray(values) && values.length === 1 ? values[0] : undefined;
}

export function getTaskFormFromFilters(filters = {}, overrides = {}) {
  const next = {
    ...DEFAULT_TASK_FORM,
  };
  const filteredStatus = getSingleSelectedValue(filters.status);
  const filteredPriority = getSingleSelectedValue(filters.priority);
  const filteredTaskTypeId = getSingleSelectedValue(filters.taskTypeIds);

  if (filteredStatus !== undefined) {
    next.status = filteredStatus;
  }
  if (filteredPriority !== undefined) {
    next.priority = filteredPriority;
  }
  if (filteredTaskTypeId !== undefined) {
    next.task_type_id = filteredTaskTypeId;
  }

  return {
    ...next,
    ...overrides,
  };
}

export const DEFAULT_TASK_TYPE_FORM = {
  name: '',
  description: '',
  color: '#60a5fa',
  is_active: true,
};
