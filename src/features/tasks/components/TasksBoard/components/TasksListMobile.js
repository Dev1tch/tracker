import React, { useState } from 'react';
import {
  Calendar,
  Check,
  ChevronRight,
  Clock3,
  Plus,
} from 'lucide-react';
import { TASK_STATUS } from '@/lib/api';
import {
  PRIORITY_META,
  STATUS_META,
} from '@/features/tasks/constants/task-board.constants';
import {
  formatPriority,
  formatStatus,
} from '@/features/tasks/utils/task-formatters';
import { formatShortDate } from '@/features/tasks/utils/task-date.utils';
import './TasksListMobile.css';

const DEFAULT_STATUS_COLORS = {
  [TASK_STATUS.TO_DO]: '#94a3b8',
  [TASK_STATUS.IN_PROGRESS]: '#60a5fa',
  [TASK_STATUS.PAUSED]: '#9ca3af',
  [TASK_STATUS.IN_REVIEW]: '#fbbf24',
  [TASK_STATUS.COMPLETED]: '#34d399',
  [TASK_STATUS.CANCELLED]: '#f87171',
  [TASK_STATUS.ARCHIVED]: '#6b7280',
};

function formatSpentTime(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export default function TasksListMobile({
  visibleStatuses,
  boardByStatus,
  statusConfig,
  taskTypeById,
  cardViewSettings,
  selectionMode,
  selectedTaskIds,
  onToggleSelect,
  onOpenTask,
  onOpenCreateForStatus,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    const initial = {};
    visibleStatuses.forEach((status) => {
      const items = boardByStatus[status] || [];
      initial[status] =
        items.length === 0 ||
        status === TASK_STATUS.COMPLETED ||
        status === TASK_STATUS.CANCELLED ||
        status === TASK_STATUS.ARCHIVED;
    });
    return initial;
  });

  const toggleGroup = (status) => {
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  return (
    <div className="tasksMobileList">
      {visibleStatuses.map((status) => {
        const statusMeta = STATUS_META[status] || {
          label: formatStatus(status),
          className: 'todo',
        };
        const items = boardByStatus[status] || [];
        const isExpanded = !collapsed[status];
        const accentColor =
          statusConfig[status]?.color ||
          DEFAULT_STATUS_COLORS[status] ||
          '#94a3b8';

        return (
          <div
            key={status}
            className={`tasksMobileGroup ${isExpanded ? 'expanded' : ''}`}
          >
            <button
              type="button"
              className="tasksMobileGroupHeader"
              onClick={() => toggleGroup(status)}
            >
              <span
                className="tasksMobileGroupAccent"
                style={{ background: accentColor }}
              />
              <span className="tasksMobileGroupLabel">
                {statusMeta.label}
              </span>
              <span className="tasksMobileGroupCount">{items.length}</span>
              <ChevronRight size={12} className="tasksMobileGroupChevron" />
            </button>

            <div className="tasksMobileGroupBody">
              <div className="tasksMobileGroupInner">
                {items.length === 0 ? (
                  <div className="tasksMobileEmpty">No tasks</div>
                ) : (
                  items.map((task) => {
                    const due = formatShortDate(task.due_date);
                    const spentMinutes = task.total_spent_time_minutes ?? 0;
                    const taskType =
                      task.task_type_id != null
                        ? taskTypeById.get(String(task.task_type_id)) || null
                        : null;
                    const taskTypeColor = taskType?.color || '#6ea8fe';
                    const priorityMeta = PRIORITY_META[task.priority] || {
                      label: formatPriority(task.priority),
                      className: 'normal',
                    };
                    const dotColor =
                      statusConfig[task.status]?.color ||
                      DEFAULT_STATUS_COLORS[task.status] ||
                      '#94a3b8';
                    const isSelected = selectedTaskIds.has(task.id);

                    return (
                      <div
                        key={task.id}
                        className={`tasksMobileRow ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (selectionMode) {
                            onToggleSelect(task.id);
                          } else {
                            onOpenTask(task.id);
                          }
                        }}
                      >
                        {selectionMode ? (
                          <button
                            type="button"
                            className={`tasksMobileRowCheck ${
                              isSelected ? 'checked' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSelect(task.id);
                            }}
                          >
                            {isSelected ? <Check size={10} /> : null}
                          </button>
                        ) : (
                          <span
                            className="tasksMobileRowDot"
                            style={{ background: dotColor }}
                          />
                        )}

                        <span className="tasksMobileRowTitle">
                          {task.title}
                        </span>

                        <div className="tasksMobileRowMeta">
                          {cardViewSettings.task_type && taskType ? (
                            <span
                              className="taskTypeMeta"
                              style={{ color: taskTypeColor }}
                            >
                              {taskType.name}
                            </span>
                          ) : null}
                          {cardViewSettings.priority ? (
                            <span
                              className={`priorityBadge ${priorityMeta.className}`}
                            >
                              {priorityMeta.label}
                            </span>
                          ) : null}
                          {cardViewSettings.due_date && due ? (
                            <span className="taskDueDate">
                              <Calendar size={8} />
                              {due}
                            </span>
                          ) : null}
                          {cardViewSettings.total_spent_time_minutes &&
                          task.status === TASK_STATUS.COMPLETED &&
                          spentMinutes > 0 ? (
                            <span className="taskSpentBadge">
                              <Clock3 size={8} />
                              {formatSpentTime(spentMinutes)}
                            </span>
                          ) : null}
                        </div>

                        {!selectionMode ? (
                          <ChevronRight
                            size={12}
                            className="tasksMobileRowChevron"
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}

                {!selectionMode ? (
                  <button
                    type="button"
                    className="tasksMobileAddRow"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreateForStatus(status);
                    }}
                  >
                    <Plus size={10} />
                    Add
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
