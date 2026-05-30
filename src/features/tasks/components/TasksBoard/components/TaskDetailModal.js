import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  AlignJustify,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Check,
  CircleDot,
  ClipboardList,
  ChevronRight,
  Clock3,
  Flag,
  FolderKanban,
  FolderTree,
  GitBranch,
  Loader2,
  MoveRight,
  Pause,
  Play,
  Plus,
  Shapes,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { TASK_STATUS, mediaApi } from '@/lib/api';
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
import TaskFieldLabel from './TaskFieldLabel';

/* Pasted images live in the stored description as `![image](url)` tokens, kept
   at the end. The editor shows the prose only (tokens stripped) and renders the
   images as thumbnails, so the raw markdown is never visible. */
const DESCRIPTION_IMAGE_TOKEN = /\n?!\[[^\]]*\]\([^)]*\)/g;

function parseDescription(full) {
  const text = full || '';
  const urls = Array.from(text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g), (m) => m[1]);
  const prose = text.replace(DESCRIPTION_IMAGE_TOKEN, '');
  return { prose, urls };
}

function buildDescription(prose, urls) {
  if (!urls || urls.length === 0) return prose || '';
  const tokens = urls.map((url) => `![image](${url})`).join('\n');
  const base = (prose || '').replace(/\n+$/, '');
  return base ? `${base}\n${tokens}` : tokens;
}

function getDescriptionPreview(text, maxLength = 110) {
  if (!text) return '';
  // Drop image tokens from the text preview so cards don't show raw markdown.
  const compact = parseDescription(text).prose.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

/* Renders the images embedded in a description as thumbnails with a remove
   button. Builds React <img> elements from parsed URLs only (no
   dangerouslySetInnerHTML), so a shared task's description can't inject HTML. */
function DescriptionImages({ urls, onRemove }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="tasksDescriptionImages">
      {urls.map((url, index) => (
        <div key={`${index}-${url}`} className="tasksDescriptionImageWrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="tasksDescriptionImage" />
          <button
            type="button"
            className="tasksDescriptionImageRemove"
            onClick={() => onRemove(index)}
            title="Remove image"
            aria-label="Remove image"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

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

function formatInputDateTime(value, emptyLabel = '') {
  const normalized = toIsoOrNull(value);
  if (!normalized) return emptyLabel;
  return formatDateTime(normalized);
}

function getNormalizedPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description || null,
    project_id: form.project_id || null,
    assignee_user_id: form.assignee_user_id || null,
    task_type_id: form.task_type_id || null,
    parent_task_id: form.parent_task_id || null,
    priority: form.priority,
    start_date: toIsoOrNull(form.start_date),
    due_date: toIsoOrNull(form.due_date),
  };
}

function getMemberDisplayName(member) {
  const fullName = [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim();
  return fullName || member?.email || 'Member';
}

const PRIORITY_OPTION_COLORS = {
  URGENT: '#f87171',
  HIGH: '#fbbf24',
  NORMAL: '#60a5fa',
  LOW: '#9ca3af',
};

export default function TaskDetailModal({
  task,
  allTasks = [],
  taskTypes = [],
  projects = [],
  membersByProject = {},
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
  isMobile,
  embedded = false,
  showProjectField = true,
  showAssigneeField = false,
}) {
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState(() => getDefaultSubtaskForm());
  const [form, setForm] = useState(() => getTaskFormFromTask(task));
  const normalizedPayload = useMemo(() => getNormalizedPayload(form), [form]);
  const payloadFingerprint = useMemo(() => JSON.stringify(normalizedPayload), [normalizedPayload]);
  const lastSavedFingerprintRef = useRef(payloadFingerprint);
  const autoSaveTimerRef = useRef(null);
  const autoSaveRequestIdRef = useRef(0);
  const [uploadingField, setUploadingField] = useState(null);

  /* Edit just the prose part of a description (keeps the image tokens). */
  const setDescriptionProse = (setField, prose) =>
    setField((prev) => {
      const { urls } = parseDescription(prev.description);
      return { ...prev, description: buildDescription(prose, urls) };
    });

  /* Remove the image at `index` from a description. */
  const removeDescriptionImage = (setField, index) =>
    setField((prev) => {
      const { prose, urls } = parseDescription(prev.description);
      return { ...prev, description: buildDescription(prose, urls.filter((_, i) => i !== index)) };
    });

  /* Paste an image into a description: upload it to storage and append a
     `![image](url)` token (rendered as a thumbnail by DescriptionImages, never
     shown as raw text). Kept as a token rather than inline HTML so the
     description stays plain text and safe to show across shared tasks. */
  const pasteImageIntoDescription = async (event, fieldKey, setField) => {
    const imageItem = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type && item.type.startsWith('image/'));
    if (!imageItem) return; // not an image — let the normal text paste happen
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();

    setUploadingField(fieldKey);
    let url = '';
    try {
      const result = await mediaApi.upload({ file, kind: 'board' });
      url = result?.url || '';
    } catch (err) {
      console.warn('Task description image upload failed', err);
    } finally {
      setUploadingField((current) => (current === fieldKey ? null : current));
    }
    if (!url) return;

    setField((prev) => {
      const { prose, urls } = parseDescription(prev.description);
      return { ...prev, description: buildDescription(prose, [...urls, url]) };
    });
  };

  useEffect(() => {
    lastSavedFingerprintRef.current = payloadFingerprint;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!task) return;
    setForm((prev) => (
      prev.status === task.status
        ? prev
        : { ...prev, status: task.status }
    ));
  }, [task, task?.status]);

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
  const projectOptions = [
    { value: '', label: 'Personal' },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  const projectMembers = form.project_id ? membersByProject?.[form.project_id] || [] : [];
  const assigneeOptions = projectMembers.map((member) => ({
    value: member.user_id,
    label: getMemberDisplayName(member),
  }));
  const parentTaskOptions = [
    { value: '', label: 'None' },
    ...allTasks
      .filter(
        (item) =>
          item.id !== task.id &&
          !item.parent_task_id &&
          (item.project_id || '') === (form.project_id || '')
      )
      .map((item) => ({ value: item.id, label: item.title })),
  ];
  const taskTypeById = new Map(taskTypes.map((type) => [String(type.id), type]));
  const startDateDisplay = formatInputDateTime(form.start_date, 'Auto when task starts');
  const selectListPosition = embedded ? 'local' : 'fixed';

  const handleStatusAction = (status, { closeOnSuccess = false } = {}) => {
    if (task.status === status && form.status === status) {
      if (closeOnSuccess) {
        onClose();
      }
      return;
    }

    setForm((prev) => (
      prev.status === status
        ? prev
        : { ...prev, status }
    ));

    if (closeOnSuccess) {
      onClose();
    }

    Promise.resolve(onUpdateStatus(task.id, status)).catch(() => {
      // Status handler already surfaces errors and rolls back optimistic state.
    });
  };

  const modal = (
      <div className={`tasksModal tasksDetailModal ${embedded ? 'embedded' : ''}`.trim()} onClick={(e) => e.stopPropagation()}>
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
            <h3>{isSubtask ? 'Subtask Details' : 'Task Details'}</h3>
          </div>

          <div className="tasksModalHeaderActions">
            {task.status === TASK_STATUS.COMPLETED && (task.total_spent_time_minutes ?? 0) > 0 ? (
              <span className="taskSpentBadge" title="Total time spent">
                <Clock3 size={14} />
                {formatSpentTime(task.total_spent_time_minutes)}
              </span>
            ) : null}
            {canStart ? (
              <button
                type="button"
                className="tasksIconBtn"
                onClick={() => handleStatusAction(TASK_STATUS.IN_PROGRESS)}
                title="Start task"
              >
                <Play size={14} />
              </button>
            ) : null}
            {canPause ? (
              <button
                type="button"
                className="tasksIconBtn"
                onClick={() => handleStatusAction(TASK_STATUS.PAUSED)}
                title="Pause task"
              >
                <Pause size={14} />
              </button>
            ) : null}
            {canResume ? (
              <button
                type="button"
                className="tasksIconBtn"
                onClick={() => handleStatusAction(TASK_STATUS.IN_PROGRESS)}
                title="Resume task"
              >
                <MoveRight size={14} />
              </button>
            ) : null}
            {canFinish ? (
              <button
                type="button"
                className="tasksIconBtn"
                onClick={() => handleStatusAction(TASK_STATUS.COMPLETED, { closeOnSuccess: true })}
                title="Complete task"
              >
                <Check size={14} />
              </button>
            ) : null}
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
            <div className="tasksFormGrid tasksModalForm">
                <div className="tasksField tasksFieldFull">
                  <label>
                    <TaskFieldLabel icon={ClipboardList}>Title *</TaskFieldLabel>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="tasksField tasksFieldFull">
                  <label>
                    <TaskFieldLabel icon={AlignLeft}>Description</TaskFieldLabel>
                  </label>
                  <textarea
                    value={parseDescription(form.description).prose}
                    onChange={(e) => setDescriptionProse(setForm, e.target.value)}
                    onPaste={(e) => pasteImageIntoDescription(e, 'task', setForm)}
                    rows={8}
                    placeholder="Write a description… paste an image to attach it"
                  />
                  {uploadingField === 'task' ? (
                    <div className="tasksDescriptionUploading">Uploading image…</div>
                  ) : null}
                  <DescriptionImages
                    urls={parseDescription(form.description).urls}
                    onRemove={(index) => removeDescriptionImage(setForm, index)}
                  />
                </div>

                <div className="tasksField">
                  <label>
                    <TaskFieldLabel icon={CircleDot}>Status</TaskFieldLabel>
                  </label>
                  <CustomSelect
                    options={statusOptions}
                    value={form.status}
                    onChange={(value) => handleStatusAction(value)}
                    placeholder="Select status"
                    listPosition={selectListPosition}
                  />
                </div>

                <div className="tasksField">
                  <label>
                    <TaskFieldLabel icon={Flag}>Priority</TaskFieldLabel>
                  </label>
                  <CustomSelect
                    options={priorityOptions}
                    value={form.priority}
                    onChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                    placeholder="Select priority"
                    listPosition={selectListPosition}
                  />
                </div>

                {showProjectField ? (
                  <div className="tasksField">
                    <label>
                      <TaskFieldLabel icon={FolderKanban}>Project</TaskFieldLabel>
                    </label>
                    <CustomSelect
                      options={projectOptions}
                      value={form.project_id}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          project_id: value,
                          assignee_user_id: '',
                          parent_task_id: '',
                        }))
                      }
                      placeholder="Select project"
                      listPosition={selectListPosition}
                    />
                  </div>
                ) : null}

                {showAssigneeField ? (
                  <div className="tasksField">
                    <label>
                      <TaskFieldLabel icon={UserRound}>Assignee *</TaskFieldLabel>
                    </label>
                    <CustomSelect
                      options={assigneeOptions}
                      value={form.assignee_user_id}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, assignee_user_id: value }))
                      }
                      placeholder="Select assignee"
                      listPosition={selectListPosition}
                    />
                  </div>
                ) : null}

                <div className="tasksField">
                  <label>
                    <TaskFieldLabel icon={Shapes}>Task Category</TaskFieldLabel>
                  </label>
                  <div className="tasksInlineField">
                    <CustomSelect
                      options={taskTypeOptions}
                      value={form.task_type_id}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, task_type_id: value }))
                      }
                      placeholder="Select task category"
                      listPosition={selectListPosition}
                    />
                    <button
                      type="button"
                      className="tasksIconBtn"
                      onClick={() => {
                        onClose();
                        onOpenTypeManager();
                      }}
                      title="Manage task categories"
                    >
                      <Tag size={14} />
                    </button>
                  </div>
                </div>

                <div className="tasksField">
                  <label>
                    <TaskFieldLabel icon={GitBranch}>Parent Task</TaskFieldLabel>
                  </label>
                  <CustomSelect
                    options={parentTaskOptions}
                    value={form.parent_task_id}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, parent_task_id: value }))
                    }
                    placeholder="Select parent task"
                    listPosition={selectListPosition}
                  />
                </div>

                <div className="tasksField">
                  <label>
                    <TaskFieldLabel icon={CalendarClock}>Deadline</TaskFieldLabel>
                  </label>
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

                <div className="tasksDetailStartDate tasksFieldFull">
                  <Calendar size={13} />
                  <span>Started: {startDateDisplay}</span>
                </div>
            </div>
          </div>

          {!isSubtask ? (
            <aside className="tasksSubtasksPanel">
              <div className="tasksSubtasksHeader">
                <h4>
                  <FolderTree size={14} />
                  Subtasks ({subtasks.length})
                </h4>
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
                    <label>
                      <TaskFieldLabel icon={ClipboardList}>Title *</TaskFieldLabel>
                    </label>
                    <input
                      type="text"
                      value={subtaskForm.title}
                      onChange={(e) =>
                        setSubtaskForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="tasksField">
                    <label>
                      <TaskFieldLabel icon={AlignLeft}>Description</TaskFieldLabel>
                    </label>
                    <textarea
                      rows={3}
                      value={parseDescription(subtaskForm.description).prose}
                      onChange={(e) => setDescriptionProse(setSubtaskForm, e.target.value)}
                      onPaste={(e) => pasteImageIntoDescription(e, 'subtask', setSubtaskForm)}
                      placeholder="Write a description… paste an image to attach it"
                    />
                    {uploadingField === 'subtask' ? (
                      <div className="tasksDescriptionUploading">Uploading image…</div>
                    ) : null}
                    <DescriptionImages
                      urls={parseDescription(subtaskForm.description).urls}
                      onRemove={(index) => removeDescriptionImage(setSubtaskForm, index)}
                    />
                  </div>
                  <div className="tasksField">
                    <label>
                      <TaskFieldLabel icon={CircleDot}>Status</TaskFieldLabel>
                    </label>
                    <CustomSelect
                      options={statusOptions}
                      value={subtaskForm.status}
                      onChange={(value) =>
                        setSubtaskForm((prev) => ({ ...prev, status: value }))
                      }
                      placeholder="Select status"
                      listPosition={selectListPosition}
                    />
                  </div>
                  <div className="tasksField">
                    <label>
                      <TaskFieldLabel icon={Flag}>Priority</TaskFieldLabel>
                    </label>
                    <CustomSelect
                      options={priorityOptions}
                      value={subtaskForm.priority}
                      onChange={(value) =>
                        setSubtaskForm((prev) => ({ ...prev, priority: value }))
                      }
                      placeholder="Select priority"
                      listPosition={selectListPosition}
                    />
                  </div>
                  <div className="tasksField">
                    <label>
                      <TaskFieldLabel icon={CalendarClock}>Due Date</TaskFieldLabel>
                    </label>
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
                          isMobile ? 'mobileSubtaskRow' : ''
                        } ${
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
                            <div
                              className="tasksDescriptionHint"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const preview = e.currentTarget.querySelector('.tasksDescriptionPreview');
                                if (preview) {
                                  preview.style.top = `${rect.bottom + 8}px`;
                                  preview.style.left = `${rect.left}px`;
                                }
                              }}
                            >
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
                          {cardViewSettings?.total_spent_time_minutes && subtask.status === TASK_STATUS.COMPLETED && subtaskSpentMinutes > 0 ? (
                            <span className="taskSpentBadge">
                              <Clock3 size={11} />
                              {formatSpentTime(subtaskSpentMinutes)}
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
                              listPosition={selectListPosition}
                            />
                          </div>
                        </div>

                        {isMobile ? (
                          <ChevronRight size={12} className="mobileSubtaskChevron" />
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
  );

  if (embedded) return modal;

  return (
    <div className="tasksModalOverlay" onClick={onClose}>
      {modal}
    </div>
  );
}
