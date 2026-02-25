import { TASK_PRIORITY, TASK_STATUS } from '@/features/tasks/api';
import { toDateInputValue } from '@/features/tasks/utils/task-date.utils';

export function getTaskFormFromTask(task) {
  return {
    title: task?.title || '',
    description: task?.description || '',
    task_type_id: task?.task_type_id || '',
    parent_task_id: task?.parent_task_id || '',
    status: task?.status || TASK_STATUS.TO_DO,
    priority: task?.priority || TASK_PRIORITY.NORMAL,
    start_date: toDateInputValue(task?.start_date, { includeTime: true }),
    due_date: toDateInputValue(task?.due_date, { includeTime: true }),
  };
}

export function buildUpdatePayload(task, overrides = {}) {
  return {
    title: overrides.title ?? task.title ?? '',
    description:
      overrides.description !== undefined ? overrides.description : (task.description ?? null),
    task_type_id:
      overrides.task_type_id !== undefined
        ? overrides.task_type_id
        : (task.task_type_id ?? null),
    parent_task_id:
      overrides.parent_task_id !== undefined
        ? overrides.parent_task_id
        : (task.parent_task_id ?? null),
    status: overrides.status ?? task.status ?? TASK_STATUS.TO_DO,
    priority: overrides.priority ?? task.priority ?? TASK_PRIORITY.NORMAL,
    start_date:
      overrides.start_date !== undefined ? overrides.start_date : (task.start_date ?? null),
    due_date: overrides.due_date !== undefined ? overrides.due_date : (task.due_date ?? null),
    completed_at:
      overrides.completed_at !== undefined ? overrides.completed_at : (task.completed_at ?? null),
    pause_start_date:
      overrides.pause_start_date !== undefined
        ? overrides.pause_start_date
        : (task.pause_start_date ?? null),
    total_pause_time_minutes:
      overrides.total_pause_time_minutes !== undefined
        ? overrides.total_pause_time_minutes
        : (task.total_pause_time_minutes ?? 0),
    total_spent_time_minutes:
      overrides.total_spent_time_minutes !== undefined
        ? overrides.total_spent_time_minutes
        : (task.total_spent_time_minutes ?? 0),
    is_parent: overrides.is_parent !== undefined ? overrides.is_parent : (task.is_parent ?? false),
  };
}
