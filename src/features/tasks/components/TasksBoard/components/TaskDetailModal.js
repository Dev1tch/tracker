import React, { useState } from 'react';
import {
  AlignJustify,
  ArrowLeft,
  Calendar,
  Check,
  Clock3,
  Loader2,
  MoveRight,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { TASK_STATUS } from '@/lib/api';
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
  getDefaultSubtaskForm,
} from '@/features/tasks/constants/task-board.constants';
import {
  formatPriority,
  formatStatus,
} from '@/features/tasks/utils/task-formatters';
import {
  getTaskFormFromTask,
} from '@/features/tasks/utils/task-form.utils';
import {
  formatDateTime,
  formatShortDate,
  toIsoOrNull,
} from '@/features/tasks/utils/task-date.utils';

function getDescriptionPreview(text, maxLength = 110) {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

export default function TaskDetailModal({
  task,
  allTasks,
  taskTypes,
  onClose,
  onSave,
  onDelete,
  onUpdateStatus,
  onCreateSubtask,
  onDeleteSubtask,
  onOpenTask,
  onOpenTypeManager,
  cardViewSettings,
  isSaving,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState(() => getDefaultSubtaskForm());
  const [form, setForm] = useState(() => getTaskFormFromTask(task));

  if (!task) return null;

  const isSubtask = Boolean(task.parent_task_id);
  const subtasks = allTasks.filter((item) => item.parent_task_id === task.id);
  const parentTask = isSubtask
    ? allTasks.find((item) => item.id === task.parent_task_id)
    : null;

  const statusMeta = STATUS_META[task.status] || {
    label: formatStatus(task.status),
    className: 'todo',
  };
  const priorityMeta = PRIORITY_META[task.priority] || {
    label: formatPriority(task.priority),
    className: 'normal',
  };

  const canStart = task.status === TASK_STATUS.TO_DO;
  const canPause =
    task.status === TASK_STATUS.IN_PROGRESS || task.status === TASK_STATUS.IN_REVIEW;
  const canResume = task.status === TASK_STATUS.PAUSED;
  const canFinish =
    task.status === TASK_STATUS.IN_PROGRESS ||
    task.status === TASK_STATUS.IN_REVIEW ||
    task.status === TASK_STATUS.PAUSED;
  const statusOptions = STATUS_ORDER.map((status) => ({
    value: status,
    label: formatStatus(status),
  }));
  const priorityOptions = PRIORITY_ORDER.map((priority) => ({
    value: priority,
    label: formatPriority(priority),
  }));
  const taskTypeOptions = [
    { value: '', label: 'None' },
    ...taskTypes.map((type) => ({ value: type.id, label: type.name })),
  ];
  const parentTaskOptions = [
    { value: '', label: 'None' },
    ...allTasks
      .filter((item) => item.id !== task.id && !item.parent_task_id)
      .map((item) => ({ value: item.id, label: item.title })),
  ];

  return (
    <div className="tasksModalOverlay" onClick={onClose}>
      <div className="tasksModal tasksDetailModal" onClick={(e) => e.stopPropagation()}>
        <div className="tasksModalHeader sticky">
          <div className="tasksModalTitleWrap">
            {isSubtask && parentTask ? (
              <button
                type="button"
                className="tasksBackBtn"
                onClick={() => onOpenTask(parentTask.id)}
                title="Back to parent"
              >
                <ArrowLeft size={14} />
                {parentTask.title}
              </button>
            ) : null}
            <h3>{isEditing ? 'Edit Task' : task.title}</h3>
          </div>

          <div className="tasksModalHeaderActions">
            {!isEditing ? (
              <>
                {canStart ? (
                  <button
                    type="button"
                    className="tasksIconBtn"
                    onClick={() => onUpdateStatus(task.id, TASK_STATUS.IN_PROGRESS)}
                    title="Start task"
                  >
                    <Play size={14} />
                  </button>
                ) : null}
                {canPause ? (
                  <button
                    type="button"
                    className="tasksIconBtn"
                    onClick={() => onUpdateStatus(task.id, TASK_STATUS.PAUSED)}
                    title="Pause task"
                  >
                    <Pause size={14} />
                  </button>
                ) : null}
                {canResume ? (
                  <button
                    type="button"
                    className="tasksIconBtn"
                    onClick={() => onUpdateStatus(task.id, TASK_STATUS.IN_PROGRESS)}
                    title="Resume task"
                  >
                    <MoveRight size={14} />
                  </button>
                ) : null}
                {canFinish ? (
                  <button
                    type="button"
                    className="tasksIconBtn"
                    onClick={() => onUpdateStatus(task.id, TASK_STATUS.COMPLETED)}
                    title="Complete task"
                  >
                    <Check size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="tasksIconBtn"
                  onClick={() => setIsEditing(true)}
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="tasksIconBtn danger"
                  onClick={() => onDelete(task.id)}
                  title="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="tasksIconBtn"
                  onClick={() => {
                    setForm(getTaskFormFromTask(task));
                    setIsEditing(false);
                  }}
                  title="Cancel edit"
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  className="tasksIconBtn"
                  onClick={async () => {
                    await onSave(task.id, {
                      title: form.title.trim(),
                      description: form.description || null,
                      task_type_id: form.task_type_id || null,
                      parent_task_id: form.parent_task_id || null,
                      status: form.status,
                      priority: form.priority,
                      start_date: toIsoOrNull(form.start_date),
                      due_date: toIsoOrNull(form.due_date),
                    });
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                  title="Save"
                >
                  {isSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                </button>
              </>
            )}
            <button type="button" className="tasksIconBtn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={`tasksDetailBody ${isSubtask ? 'subtaskView' : ''}`.trim()}>
          <div className="tasksDetailMain">
            {isEditing ? (
              <div className="tasksFormGrid">
                <div className="tasksField tasksFieldFull">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="tasksField tasksFieldFull">
                  <label>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={8}
                  />
                </div>

                <div className="tasksField">
                  <label>Status</label>
                  <CustomSelect
                    options={statusOptions}
                    value={form.status}
                    onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                    placeholder="Select status"
                  />
                </div>

                <div className="tasksField">
                  <label>Priority</label>
                  <CustomSelect
                    options={priorityOptions}
                    value={form.priority}
                    onChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                    placeholder="Select priority"
                  />
                </div>

                <div className="tasksField">
                  <label>Task Type</label>
                  <div className="tasksInlineField">
                    <CustomSelect
                      options={taskTypeOptions}
                      value={form.task_type_id}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, task_type_id: value }))
                      }
                      placeholder="Select task type"
                    />
                    <button
                      type="button"
                      className="tasksIconBtn"
                      onClick={onOpenTypeManager}
                      title="Manage task types"
                    >
                      <Tag size={14} />
                    </button>
                  </div>
                </div>

                <div className="tasksField">
                  <label>Parent Task</label>
                  <CustomSelect
                    options={parentTaskOptions}
                    value={form.parent_task_id}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, parent_task_id: value }))
                    }
                    placeholder="Select parent task"
                  />
                </div>

                <div className="tasksField">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                  />
                </div>

                <div className="tasksField">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, due_date: e.target.value }))
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="tasksMetaStrip">
                  <span className={`statusChip status-${statusMeta.className}`}>{statusMeta.label}</span>
                  <span className={`priorityBadge ${priorityMeta.className}`}>
                    {priorityMeta.label}
                  </span>
                </div>

                <div className="tasksDetailDescription">
                  {task.description || <span className="tasksMutedText">No description</span>}
                </div>

                <div className="tasksDetailInfoGrid">
                  <div>
                    <label>
                      <Calendar size={13} /> Start Date
                    </label>
                    <p>{formatDateTime(task.start_date)}</p>
                  </div>
                  <div>
                    <label>
                      <Calendar size={13} /> Due Date
                    </label>
                    <p>{formatDateTime(task.due_date)}</p>
                  </div>
                  <div>
                    <label>
                      <Tag size={13} /> Task Type
                    </label>
                    <p>
                      {taskTypes.find((item) => item.id === task.task_type_id)?.name ||
                        'Not assigned'}
                    </p>
                  </div>
                  <div>
                    <label>Created At</label>
                    <p>{formatDateTime(task.created_at)}</p>
                  </div>
                  <div>
                    <label>Updated At</label>
                    <p>{formatDateTime(task.updated_at)}</p>
                  </div>
                  <div>
                    <label>Total Pause (minutes)</label>
                    <p>{task.total_pause_time_minutes ?? 0}</p>
                  </div>
                  <div>
                    <label>Total Spent (minutes)</label>
                    <p>{task.total_spent_time_minutes ?? 0}</p>
                  </div>
                  <div>
                    <label>Task ID</label>
                    <p className="mono">{task.id}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {!isSubtask ? (
            <aside className="tasksSubtasksPanel">
              <div className="tasksSubtasksHeader">
                <h4>Subtasks ({subtasks.length})</h4>
                <button
                  type="button"
                  className="tasksIconBtn"
                  onClick={() => setShowSubtaskForm((prev) => !prev)}
                >
                  <Plus size={14} />
                </button>
              </div>

              {showSubtaskForm ? (
                <div className="tasksSubtaskForm">
                  <div className="tasksField">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={subtaskForm.title}
                      onChange={(e) =>
                        setSubtaskForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="tasksField">
                    <label>Description</label>
                    <textarea
                      rows={3}
                      value={subtaskForm.description}
                      onChange={(e) =>
                        setSubtaskForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>
                  <div className="tasksField">
                    <label>Status</label>
                    <CustomSelect
                      options={statusOptions}
                      value={subtaskForm.status}
                      onChange={(value) =>
                        setSubtaskForm((prev) => ({ ...prev, status: value }))
                      }
                      placeholder="Select status"
                    />
                  </div>
                  <div className="tasksField">
                    <label>Priority</label>
                    <CustomSelect
                      options={priorityOptions}
                      value={subtaskForm.priority}
                      onChange={(value) =>
                        setSubtaskForm((prev) => ({ ...prev, priority: value }))
                      }
                      placeholder="Select priority"
                    />
                  </div>
                  <div className="tasksField">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={subtaskForm.due_date}
                      onChange={(e) =>
                        setSubtaskForm((prev) => ({ ...prev, due_date: e.target.value }))
                      }
                    />
                  </div>

                  <div className="tasksSubtaskActions">
                    <button
                      type="button"
                      className="tasksBtn"
                      onClick={() => {
                        setShowSubtaskForm(false);
                        setSubtaskForm(getDefaultSubtaskForm());
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="tasksBtn tasksBtnPrimary"
                      onClick={async () => {
                        await onCreateSubtask(task.id, subtaskForm);
                        setSubtaskForm(getDefaultSubtaskForm());
                        setShowSubtaskForm(false);
                      }}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="tasksSubtaskList">
                {subtasks.length === 0 ? (
                  <p className="tasksMutedText">No subtasks</p>
                ) : (
                  subtasks.map((subtask) => {
                    const subtaskPriorityMeta = PRIORITY_META[subtask.priority] || {
                      label: formatPriority(subtask.priority),
                      className: 'normal',
                    };
                    const subtaskStatusMeta = STATUS_META[subtask.status] || {
                      label: formatStatus(subtask.status),
                      className: 'todo',
                    };
                    const subtaskDue = formatShortDate(subtask.due_date);
                    const subtaskStartDate = formatShortDate(subtask.start_date);
                    const subtaskCreatedDate = formatShortDate(subtask.created_at);
                    const subtaskSpentMinutes = subtask.total_spent_time_minutes ?? 0;
                    const subtaskDescriptionPreview = getDescriptionPreview(subtask.description);

                    return (
                      <div
                        key={subtask.id}
                        className="tasksSubtaskItem"
                        onClick={() => onOpenTask(subtask.id)}
                      >
                        <div className="tasksSubtaskTop">
                          {cardViewSettings?.status ? (
                            <span
                              className={`taskStatusDot ${subtaskStatusMeta.className}`}
                              title={subtaskStatusMeta.label}
                            />
                          ) : null}
                          {cardViewSettings?.title ? (
                            <button
                              type="button"
                              className="tasksSubtaskTitle"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenTask(subtask.id);
                              }}
                            >
                              {subtask.title}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="tasksIconBtn danger tasksSubtaskDeleteBtn"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteSubtask(subtask.id);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="tasksCardMeta">
                          {cardViewSettings?.description && subtask.description ? (
                            <div className="tasksDescriptionHint">
                              <AlignJustify size={12} />
                              <div className="tasksDescriptionPreview">{subtaskDescriptionPreview}</div>
                            </div>
                          ) : null}
                          {cardViewSettings?.priority ? (
                            <span className={`priorityBadge ${subtaskPriorityMeta.className}`}>
                              {subtaskPriorityMeta.label}
                            </span>
                          ) : null}
                          {cardViewSettings?.start_date && subtaskStartDate ? (
                            <span className="taskDateBadge">
                              <Calendar size={11} />
                              {subtaskStartDate}
                            </span>
                          ) : null}
                          {cardViewSettings?.due_date && subtaskDue ? (
                            <span className="taskDueDate">
                              <Calendar size={11} />
                              {subtaskDue}
                            </span>
                          ) : null}
                          {cardViewSettings?.created_at && subtaskCreatedDate ? (
                            <span className="taskDateBadge">
                              <Calendar size={11} />
                              {subtaskCreatedDate}
                            </span>
                          ) : null}
                          {cardViewSettings?.total_spent_time_minutes ? (
                            <span className="taskSpentBadge">
                              <Clock3 size={11} />
                              {subtaskSpentMinutes}m
                            </span>
                          ) : null}
                          <div
                            className="tasksSubtaskStatusInline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <CustomSelect
                              options={statusOptions}
                              value={subtask.status}
                              onChange={(value) => onUpdateStatus(subtask.id, value)}
                              placeholder="Select status"
                            />
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
