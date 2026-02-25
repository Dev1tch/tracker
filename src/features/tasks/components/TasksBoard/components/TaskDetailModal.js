import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignJustify,
  ArrowLeft,
  Calendar,
  Check,
  Clock3,
  Loader2,
  MoveRight,
  Pause,
  Play,
  Plus,
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
import TasksDatePicker from './TasksDatePicker';

function getDescriptionPreview(text, maxLength = 110) {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

function getNormalizedPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description || null,
    task_type_id: form.task_type_id || null,
    parent_task_id: form.parent_task_id || null,
    status: form.status,
    priority: form.priority,
    start_date: toIsoOrNull(form.start_date),
    due_date: toIsoOrNull(form.due_date),
  };
}

const PRIORITY_OPTION_COLORS = {
  URGENT: '#f87171',
  HIGH: '#fbbf24',
  NORMAL: '#60a5fa',
  LOW: '#9ca3af',
};

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
  statusColors,
  isSaving,
}) {
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState(() => getDefaultSubtaskForm());
  const [form, setForm] = useState(() => getTaskFormFromTask(task));
  const normalizedPayload = useMemo(() => getNormalizedPayload(form), [form]);
  const payloadFingerprint = useMemo(() => JSON.stringify(normalizedPayload), [normalizedPayload]);
  const lastSavedFingerprintRef = useRef(payloadFingerprint);
  const autoSaveTimerRef = useRef(null);
  const autoSaveRequestIdRef = useRef(0);

  useEffect(() => {
    lastSavedFingerprintRef.current = payloadFingerprint;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!task?.id) return undefined;
    if (payloadFingerprint === lastSavedFingerprintRef.current) return undefined;
    if (!normalizedPayload.title) return undefined;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      const requestId = autoSaveRequestIdRef.current + 1;
      autoSaveRequestIdRef.current = requestId;

      try {
        await onSave(task.id, normalizedPayload, { showSuccessToast: false });
        if (autoSaveRequestIdRef.current === requestId) {
          lastSavedFingerprintRef.current = payloadFingerprint;
        }
      } catch {
        // onSave already handles toast feedback
      }
    }, 450);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [normalizedPayload, onSave, payloadFingerprint, task?.id]);

  if (!task) return null;

  const isSubtask = Boolean(task.parent_task_id);
  const subtasks = allTasks.filter((item) => item.parent_task_id === task.id);
  const parentTask = isSubtask
    ? allTasks.find((item) => item.id === task.parent_task_id)
    : null;

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
    color: statusColors?.[status],
  }));
  const priorityOptions = PRIORITY_ORDER.map((priority) => ({
    value: priority,
    label: formatPriority(priority),
    color: PRIORITY_OPTION_COLORS[priority],
  }));
  const taskTypeOptions = [
    { value: '', label: 'None' },
    ...taskTypes.map((type) => ({ value: type.id, label: type.name, color: type.color || undefined })),
  ];
  const parentTaskOptions = [
    { value: '', label: 'None' },
    ...allTasks
      .filter((item) => item.id !== task.id && !item.parent_task_id)
      .map((item) => ({ value: item.id, label: item.title })),
  ];
  const taskTypeById = new Map(taskTypes.map((type) => [String(type.id), type]));
  const startDateDisplay = formatDateTime(task.start_date);
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
          </div>

          <div className="tasksModalHeaderActions">
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
              onClick={() => {
                setForm(getTaskFormFromTask(task));
                lastSavedFingerprintRef.current = JSON.stringify(getNormalizedPayload(getTaskFormFromTask(task)));
              }}
              title="Reset changes"
            >
              <X size={14} />
            </button>
            {isSaving ? (
              <span className="tasksAutoSaveState" title="Autosaving">
                <Loader2 size={14} className="spin" />
              </span>
            ) : null}
            <button
              type="button"
              className="tasksIconBtn danger"
              onClick={() => onDelete(task.id)}
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
            <button type="button" className="tasksIconBtn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={`tasksDetailBody ${isSubtask ? 'subtaskView' : ''}`.trim()}>
          <div className="tasksDetailMain">
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
                      onClick={() => {
                        onClose();
                        onOpenTypeManager();
                      }}
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
                  <div className="tasksReadonlyField">{startDateDisplay}</div>
                </div>

                <div className="tasksField">
                  <label>Due Date</label>
                  <TasksDatePicker
                    value={form.due_date}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, due_date: value }))
                    }
                    placeholder="Select due date"
                    showTime
                    className="tasksDateFieldInput"
                  />
                </div>
            </div>
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
                    <TasksDatePicker
                      value={subtaskForm.due_date}
                      onChange={(value) =>
                        setSubtaskForm((prev) => ({ ...prev, due_date: value }))
                      }
                      placeholder="Select due date"
                      showTime
                      className="tasksDateFieldInput"
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
                    const subtaskType =
                      (subtask.task_type_id !== null && subtask.task_type_id !== undefined
                        ? taskTypeById.get(String(subtask.task_type_id))
                        : null) ||
                      (task.task_type_id !== null && task.task_type_id !== undefined
                        ? taskTypeById.get(String(task.task_type_id))
                        : null) ||
                      null;
                    const subtaskTypeColor = subtaskType?.color || '#6ea8fe';
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
                        className={`tasksSubtaskItem ${
                          cardViewSettings?.task_type && subtaskType ? 'hasTypeAccent' : ''
                        }`}
                        style={
                          cardViewSettings?.task_type && subtaskType
                            ? { '--task-type-color': subtaskTypeColor }
                            : undefined
                        }
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
                          {cardViewSettings?.task_type && subtaskType ? (
                            <span className="taskTypeMeta" style={{ color: subtaskTypeColor }}>
                              {subtaskType.name}
                            </span>
                          ) : null}
                          {cardViewSettings?.priority ? (
                            <span className={`priorityBadge ${subtaskPriorityMeta.className}`}>
                              {subtaskPriorityMeta.label}
                            </span>
                          ) : null}
                          {cardViewSettings?.description && subtask.description ? (
                            <div className="tasksDescriptionHint">
                              <AlignJustify size={12} />
                              <div className="tasksDescriptionPreview">{subtaskDescriptionPreview}</div>
                            </div>
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
