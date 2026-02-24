import { TASK_PRIORITY, TASK_STATUS } from '@/features/tasks/api';

export const STATUS_ORDER = [
  TASK_STATUS.TO_DO,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.PAUSED,
  TASK_STATUS.IN_REVIEW,
  TASK_STATUS.COMPLETED,
  TASK_STATUS.CANCELLED,
  TASK_STATUS.ARCHIVED,
];

export const STATUS_META = {
  [TASK_STATUS.TO_DO]: { label: 'To Do', className: 'todo' },
  [TASK_STATUS.IN_PROGRESS]: { label: 'In Progress', className: 'inprogress' },
  [TASK_STATUS.PAUSED]: { label: 'Paused', className: 'paused' },
  [TASK_STATUS.IN_REVIEW]: { label: 'In Review', className: 'inreview' },
  [TASK_STATUS.COMPLETED]: { label: 'Completed', className: 'completed' },
  [TASK_STATUS.CANCELLED]: { label: 'Cancelled', className: 'cancelled' },
  [TASK_STATUS.ARCHIVED]: { label: 'Archived', className: 'archived' },
};

export const PRIORITY_ORDER = [
  TASK_PRIORITY.URGENT,
  TASK_PRIORITY.HIGH,
  TASK_PRIORITY.NORMAL,
  TASK_PRIORITY.LOW,
];

export const PRIORITY_META = {
  [TASK_PRIORITY.URGENT]: { label: 'Urgent', className: 'urgent' },
  [TASK_PRIORITY.HIGH]: { label: 'High', className: 'high' },
  [TASK_PRIORITY.NORMAL]: { label: 'Normal', className: 'normal' },
  [TASK_PRIORITY.LOW]: { label: 'Low', className: 'low' },
};

export function getDefaultFilters() {
  return {
    search: '',
    status: [],
    priority: [],
    task_type_id: [],
    due_from: '',
    due_to: '',
  };
}

export function getDefaultCreateForm() {
  return {
    title: '',
    description: '',
    task_type_id: '',
    parent_task_id: '',
    status: TASK_STATUS.TO_DO,
    priority: TASK_PRIORITY.NORMAL,
    start_date: '',
    due_date: '',
  };
}

export function getDefaultTypeForm() {
  return {
    name: '',
    description: '',
    color: '#6ea8fe',
    is_active: true,
  };
}

export function getDefaultSubtaskForm() {
  return {
    title: '',
    description: '',
    due_date: '',
    priority: TASK_PRIORITY.NORMAL,
    status: TASK_STATUS.TO_DO,
  };
}

export const DEFAULT_FILTERS = getDefaultFilters();
export const DEFAULT_CREATE_FORM = getDefaultCreateForm();
export const DEFAULT_TYPE_FORM = getDefaultTypeForm();
