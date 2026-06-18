import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Clock3,
  FolderKanban,
  FolderTree,
  MoveRight,
  Pause,
  Play,
  Plus,
  Settings2,
  SquareCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ActionButton from '../../components/ActionButton';
import ColorField from '../../components/ColorField';
import DateTimeField from '../../components/DateTimeField';
import InlinePickerField from '../../components/InlinePickerField';
import ModalSheet from '../../components/ModalSheet';
import OptionPickerSheet from '../../components/OptionPickerSheet';
import ScreenShell from '../../components/ScreenShell';
import TextField from '../../components/TextField';
import {
  DEFAULT_TASK_FORM,
  DEFAULT_TASK_TYPE_FORM,
  getTaskFormFromFilters,
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
  TASK_PRIORITY,
  TASK_STATUS,
} from '../../constants/tasks';
import { mediaApi, projectsApi, tasksApi } from '../../shared/api';
import { useTheme } from '../../theme';
import { formatShortDate } from '../../utils/date';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import { useDialog } from '../../providers/DialogProvider';

const DEFAULT_FILTERS = {
  search: '',
  status: [],
  priority: [],
  taskTypeIds: [],
  dueFrom: '',
  dueTo: '',
};

const TYPE_COLOR_PRESETS = [
  '#94A3B8',
  '#60A5FA',
  '#9CA3AF',
  '#FBBF24',
  '#34D399',
  '#F87171',
  '#6B7280',
  '#E879F9',
  '#A78BFA',
  '#2DD4BF',
  '#4ADE80',
  '#F97316',
];

const COLLAPSED_BY_DEFAULT = new Set([
  TASK_STATUS.COMPLETED,
  TASK_STATUS.CANCELLED,
  TASK_STATUS.ARCHIVED,
]);

const DEFAULT_CARD_VIEW = {
  description: false,
  task_type: true,
  priority: true,
  due_date: true,
  start_date: false,
  created_at: false,
  assignee: true,
  total_spent_time: true,
};

const CARD_FIELD_OPTIONS = [
  { key: 'description', label: 'Description' },
  { key: 'task_type', label: 'Category' },
  { key: 'priority', label: 'Priority' },
  { key: 'due_date', label: 'Due date' },
  { key: 'start_date', label: 'Start date' },
  { key: 'created_at', label: 'Created date' },
  { key: 'assignee', label: 'Assignee', projectsOnly: true },
  { key: 'total_spent_time', label: 'Spent time' },
];

const CARD_VIEW_KEY = 'tasks.cardViewSettings';
const STATUS_CONFIG_KEY = 'tasks.statusConfig';

const STATUS_COLOR_PRESETS = [
  '#94A3B8',
  '#60A5FA',
  '#A78BFA',
  '#FBBF24',
  '#34D399',
  '#F87171',
  '#2DD4BF',
  '#F97316',
];

const DEFAULT_SUBTASK_FORM = {
  title: '',
  description: '',
  status: TASK_STATUS.TO_DO,
  priority: TASK_PRIORITY.NORMAL,
  due_date: '',
};

const DEFAULT_PROJECT_FORM = {
  name: '',
  color: '#6ea8fe',
};

const PROJECT_COLOR_PRESETS = [
  '#6ea8fe',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#f97316',
  '#4ade80',
  '#e879f9',
  '#94a3b8',
];

const PROJECT_OWNER_ROLE = 'OWNER';

// Mirror of the web's getAccountStorageId: read the user id straight from the JWT
// so owner-only project actions can be gated the same way the web app gates them.
function decodeJwtUserId(token) {
  if (!token || typeof token !== 'string') return '';
  const parts = token.split('.');
  if (parts.length < 2) return '';
  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const json = typeof atob === 'function' ? atob(base64) : '';
    if (!json) return '';
    const payload = JSON.parse(json);
    return payload?.sub || payload?.user_id || payload?.id || payload?.email || '';
  } catch {
    return '';
  }
}

function getMemberDisplayName(member) {
  if (!member) return '';
  const full = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (member.email) return member.email;
  const id = member.user_id || '';
  return id ? `${String(id).slice(0, 8)}…` : 'Member';
}

// Image attachments live in the stored description as `![image](url)` tokens
// (same format the web app uses), kept at the end. The editor shows prose only and
// renders the images as thumbnails so the raw markdown is never visible.
const DESCRIPTION_IMAGE_TOKEN = /\n?!\[[^\]]*\]\([^)]*\)/g;

function parseDescription(full) {
  const text = full || '';
  const urls = Array.from(text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g), (match) => match[1]);
  const prose = text.replace(DESCRIPTION_IMAGE_TOKEN, '');
  return { prose, urls };
}

function buildDescription(prose, urls) {
  if (!urls || urls.length === 0) return prose || '';
  const tokens = urls.map((url) => `![image](${url})`).join('\n');
  const base = (prose || '').replace(/\n+$/, '');
  return base ? `${base}\n${tokens}` : tokens;
}

function normalizeTaskForm(task) {
  if (!task) return DEFAULT_TASK_FORM;

  return {
    title: task.title || '',
    description: task.description || '',
    project_id: task.project_id || '',
    assignee_user_id: task.assignee_user_id || '',
    task_type_id: task.task_type_id || '',
    parent_task_id: task.parent_task_id || '',
    status: task.status || TASK_STATUS.TO_DO,
    priority: task.priority || TASK_PRIORITY.NORMAL,
    due_date: task.due_date || '',
  };
}

function buildTaskPayload(task, overrides) {
  const next = { ...(task || {}), ...(overrides || {}) };

  return {
    title: next.title?.trim() || '',
    description: next.description || null,
    project_id: next.project_id || null,
    assignee_user_id: next.assignee_user_id || null,
    task_type_id: next.task_type_id || null,
    parent_task_id: next.parent_task_id || null,
    status: next.status || TASK_STATUS.TO_DO,
    priority: next.priority || TASK_PRIORITY.NORMAL,
    start_date: next.start_date || null,
    due_date: next.due_date || null,
    completed_at: next.completed_at || null,
    pause_start_date: next.pause_start_date || null,
    total_pause_time_minutes: next.total_pause_time_minutes || 0,
    total_spent_time_minutes: next.total_spent_time_minutes || 0,
    is_parent: Boolean(next.is_parent),
  };
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

function formatFilterLabel(values, options) {
  if (!values?.length) return '';

  const labels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  if (labels.length <= 2) {
    return labels.join(', ');
  }

  return `${labels.length} selected`;
}

function formatDueRangeLabel(dueFrom, dueTo) {
  if (!dueFrom && !dueTo) return '';
  if (dueFrom && dueTo) return `${formatShortDate(dueFrom)} - ${formatShortDate(dueTo)}`;
  if (dueFrom) return `From ${formatShortDate(dueFrom)}`;
  return `Until ${formatShortDate(dueTo)}`;
}

function getTaskTypeLabel(taskTypeId, taskTypes) {
  if (!taskTypeId) return '';

  return taskTypes.find((type) => String(type.id) === String(taskTypeId))?.name || '';
}

function getPriorityBadgeStyle(priority, styles) {
  switch (priority) {
    case TASK_PRIORITY.URGENT:
      return styles.priorityBadgeUrgent;
    case TASK_PRIORITY.HIGH:
      return styles.priorityBadgeHigh;
    case TASK_PRIORITY.LOW:
      return styles.priorityBadgeLow;
    default:
      return styles.priorityBadgeNormal;
  }
}

function getPriorityBadgeLabelStyle(priority, styles) {
  switch (priority) {
    case TASK_PRIORITY.URGENT:
      return styles.priorityBadgeLabelUrgent;
    case TASK_PRIORITY.HIGH:
      return styles.priorityBadgeLabelHigh;
    case TASK_PRIORITY.LOW:
      return styles.priorityBadgeLabelLow;
    default:
      return styles.priorityBadgeLabelNormal;
  }
}

function FramelessIconButton({ icon, color, onPress, size = 16 }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const Icon = icon;
  const iconColor = color ?? theme.colors.text;

  return (
    <Pressable hitSlop={10} onPress={onPress} style={styles.iconButton}>
      <Icon color={iconColor} size={size} strokeWidth={1.7} />
    </Pressable>
  );
}

function InlineSelectMenu({
  visible,
  options,
  selectedValue,
  onSelect,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (!visible) return null;

  return (
    <View style={styles.inlineSelectMenu}>
      {options.map((option, index) => {
        const selected = selectedValue === option.value;

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onSelect(option.value)}
            style={[
              styles.inlineSelectRow,
              index === options.length - 1 ? styles.inlineSelectRowLast : null,
              selected ? styles.inlineSelectRowSelected : null,
            ]}
          >
            <View style={styles.inlineSelectMain}>
              {option.color ? (
                <View style={[styles.inlineSelectDot, { backgroundColor: option.color }]} />
              ) : null}
              <Text
                style={[
                  styles.inlineSelectLabel,
                  selected ? styles.inlineSelectLabelSelected : null,
                ]}
              >
                {option.label}
              </Text>
            </View>
            {selected ? (
              <Check color={theme.colors.text} size={12} strokeWidth={2} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function TasksMobileList({
  boardByStatus,
  taskTypeById,
  collapsedGroups,
  showAssignee,
  membersByProject,
  cardView,
  statusConfig,
  onToggleGroup,
  selectionMode,
  selectedTaskIds,
  onToggleSelect,
  onOpenTask,
  onLongPressTask,
  onOpenCreateForStatus,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.tasksMobileList}>
      {STATUS_ORDER.map((status) => {
        if (statusConfig[status]?.visible === false) return null;

        const items = boardByStatus[status] || [];
        const isExpanded = !collapsedGroups[status];
        const accentColor = statusConfig[status]?.color || STATUS_META[status]?.color || '#94a3b8';

        return (
          <View key={status} style={styles.tasksMobileGroup}>
            <Pressable onPress={() => onToggleGroup(status)} style={styles.tasksMobileGroupHeader}>
              <View style={[styles.tasksMobileGroupAccent, { backgroundColor: accentColor }]} />
              <Text style={styles.tasksMobileGroupLabel}>{STATUS_META[status]?.label || status}</Text>
              <Text style={styles.tasksMobileGroupCount}>{items.length}</Text>
              <ChevronRight
                color={theme.colors.tertiary}
                size={12}
                strokeWidth={1.7}
                style={isExpanded ? styles.tasksMobileGroupChevronExpanded : null}
              />
            </Pressable>

            {isExpanded ? (
              <View style={styles.tasksMobileGroupBody}>
                {items.length === 0 ? (
                  <Text style={styles.tasksMobileEmpty}>No tasks</Text>
                ) : (
                  items.map((task) => {
                    const taskType = task.task_type_id != null
                      ? taskTypeById.get(String(task.task_type_id)) || null
                      : null;
                    const priorityMeta = PRIORITY_META[task.priority] || { label: task.priority };
                    const due = formatShortDate(task.due_date);
                    const startDate = formatShortDate(task.start_date);
                    const createdDate = formatShortDate(task.created_at);
                    const spentMinutes = task.total_spent_time_minutes ?? 0;
                    const isSelected = selectedTaskIds.has(task.id);
                    const descriptionProse = cardView.description
                      ? parseDescription(task.description).prose.trim()
                      : '';
                    const assignee = showAssignee && task.assignee_user_id
                      ? (membersByProject?.[task.project_id] || []).find(
                          (member) => member.user_id === task.assignee_user_id
                        ) || null
                      : null;

                    return (
                      <Pressable
                        key={task.id}
                        delayLongPress={220}
                        onLongPress={() => onLongPressTask(task)}
                        onPress={() => {
                          if (selectionMode) {
                            onToggleSelect(task.id);
                          } else {
                            onOpenTask(task);
                          }
                        }}
                        style={[
                          styles.tasksMobileRow,
                          isSelected ? styles.tasksMobileRowSelected : null,
                        ]}
                      >
                        {selectionMode ? (
                          <Pressable
                            hitSlop={8}
                            onPress={() => onToggleSelect(task.id)}
                            style={[
                              styles.tasksMobileRowCheck,
                              isSelected ? styles.tasksMobileRowCheckChecked : null,
                            ]}
                          >
                            {isSelected ? (
                              <Check color={theme.colors.text} size={10} strokeWidth={2.2} />
                            ) : null}
                          </Pressable>
                        ) : (
                          <View
                            style={[
                              styles.tasksMobileRowDot,
                              { backgroundColor: accentColor },
                            ]}
                          />
                        )}

                        <View style={styles.tasksMobileRowText}>
                          <Text numberOfLines={1} style={styles.tasksMobileRowTitle}>
                            {task.title}
                          </Text>
                          {descriptionProse ? (
                            <Text numberOfLines={1} style={styles.tasksMobileRowDescription}>
                              {descriptionProse}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.tasksMobileRowMeta}>
                          {cardView.task_type && taskType ? (
                            <Text
                              numberOfLines={1}
                              style={[styles.taskTypeMeta, { color: taskType.color || theme.colors.info }]}
                            >
                              {taskType.name}
                            </Text>
                          ) : null}
                          {cardView.priority ? (
                            <View style={[styles.priorityBadge, getPriorityBadgeStyle(task.priority, styles)]}>
                              <Text
                                style={[
                                  styles.priorityBadgeLabel,
                                  getPriorityBadgeLabelStyle(task.priority, styles),
                                ]}
                              >
                                {priorityMeta.label}
                              </Text>
                            </View>
                          ) : null}
                          {cardView.due_date && due ? (
                            <View style={styles.taskDueDate}>
                              <Calendar color={theme.colors.muted} size={8} strokeWidth={1.8} />
                              <Text style={styles.metaBadgeLabel}>{due}</Text>
                            </View>
                          ) : null}
                          {cardView.start_date && startDate ? (
                            <View style={styles.taskDueDate}>
                              <Calendar color={theme.colors.muted} size={8} strokeWidth={1.8} />
                              <Text style={styles.metaBadgeLabel}>{startDate}</Text>
                            </View>
                          ) : null}
                          {cardView.created_at && createdDate ? (
                            <View style={styles.taskDueDate}>
                              <Calendar color={theme.colors.muted} size={8} strokeWidth={1.8} />
                              <Text style={styles.metaBadgeLabel}>{createdDate}</Text>
                            </View>
                          ) : null}
                          {cardView.total_spent_time && task.status === TASK_STATUS.COMPLETED && spentMinutes > 0 ? (
                            <View style={styles.taskSpentBadge}>
                              <Clock3 color={theme.colors.muted} size={8} strokeWidth={1.8} />
                              <Text style={styles.metaBadgeLabel}>{formatSpentTime(spentMinutes)}</Text>
                            </View>
                          ) : null}
                          {cardView.assignee && assignee ? (
                            <View style={styles.taskAssigneeBadge}>
                              <UserRound color={theme.colors.muted} size={8} strokeWidth={1.8} />
                              <Text style={styles.metaBadgeLabel} numberOfLines={1}>
                                {getMemberDisplayName(assignee)}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {!selectionMode ? (
                          <ChevronRight
                            color={theme.colors.tertiary}
                            size={12}
                            strokeWidth={1.7}
                            style={styles.tasksMobileRowChevron}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })
                )}

                {!selectionMode ? (
                  <Pressable
                    onPress={() => onOpenCreateForStatus(status)}
                    style={styles.tasksMobileAddRow}
                  >
                    <Plus color={theme.colors.tertiary} size={10} strokeWidth={1.8} />
                    <Text style={styles.tasksMobileAddRowLabel}>Add</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function TaskModal({
  visible,
  isEditing,
  isSubtask,
  parentTask,
  form,
  loading,
  autosaving,
  taskTypes,
  taskTypeById,
  inlineTypeForm,
  inlineTypeVisible,
  inlineTypeLoading,
  showAssigneeField,
  assigneeOptions,
  projectName,
  subtasks,
  subtaskForm,
  subtaskFormVisible,
  subtaskCreating,
  attachingImage,
  onAttachImage,
  onChange,
  onInlineTypeChange,
  onShowInlineType,
  onHideInlineType,
  onCreateInlineType,
  onClose,
  onCreate,
  onDelete,
  onStatusAction,
  onOpenParent,
  onSubtaskFormChange,
  onToggleSubtaskForm,
  onCreateSubtask,
  onOpenSubtask,
  onDeleteSubtask,
  onUpdateSubtaskStatus,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activePicker, setActivePicker] = useState('');

  const statusOptions = useMemo(
    () => STATUS_ORDER.map((status) => ({
      value: status,
      label: STATUS_META[status].label,
      color: STATUS_META[status].color,
    })),
    []
  );
  const priorityOptions = useMemo(
    () => PRIORITY_ORDER.map((priority) => ({
      value: priority,
      label: PRIORITY_META[priority].label,
      color: PRIORITY_META[priority].color,
    })),
    []
  );
  const taskTypeOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...taskTypes.map((type) => ({
        value: type.id,
        label: type.name,
        color: type.color,
      })),
    ],
    [taskTypes]
  );

  useEffect(() => {
    if (!visible) {
      setActivePicker('');
    }
  }, [visible]);

  const { prose: descriptionProse, urls: descriptionImages } = parseDescription(form.description);

  const canStart = form.status === TASK_STATUS.TO_DO;
  const canPause = form.status === TASK_STATUS.IN_PROGRESS || form.status === TASK_STATUS.IN_REVIEW;
  const canResume = form.status === TASK_STATUS.PAUSED;
  const canFinish = (
    form.status === TASK_STATUS.IN_PROGRESS
    || form.status === TASK_STATUS.IN_REVIEW
    || form.status === TASK_STATUS.PAUSED
  );
  const modalTitle = isEditing
    ? (isSubtask ? 'Subtask Details' : 'Task Details')
    : 'Create Task';

  return (
    <>
      <ModalSheet
        visible={visible}
        title={modalTitle}
        onClose={onClose}
        headerActions={(
          <View style={styles.modalHeaderActions}>
            {autosaving ? (
              <ActivityIndicator color={theme.colors.tertiary} size="small" />
            ) : null}
            {isEditing && canStart ? (
              <FramelessIconButton
                icon={Play}
                color={theme.colors.text}
                size={15}
                onPress={() => onStatusAction(TASK_STATUS.IN_PROGRESS)}
              />
            ) : null}
            {isEditing && canPause ? (
              <FramelessIconButton
                icon={Pause}
                color={theme.colors.text}
                size={15}
                onPress={() => onStatusAction(TASK_STATUS.PAUSED)}
              />
            ) : null}
            {isEditing && canResume ? (
              <FramelessIconButton
                icon={MoveRight}
                color={theme.colors.text}
                size={15}
                onPress={() => onStatusAction(TASK_STATUS.IN_PROGRESS)}
              />
            ) : null}
            {isEditing && canFinish ? (
              <FramelessIconButton
                icon={Check}
                color={theme.colors.success}
                size={15}
                onPress={() => onStatusAction(TASK_STATUS.COMPLETED, { close: true })}
              />
            ) : null}
            {isEditing && onDelete ? (
              <FramelessIconButton
                icon={Trash2}
                color={theme.colors.danger}
                onPress={onDelete}
              />
            ) : null}
          </View>
        )}
        footer={!isEditing ? (
          <View style={styles.modalFooterEnd}>
            <ActionButton
              label={loading ? 'Creating...' : 'Create Task'}
              icon="add"
              onPress={onCreate}
              disabled={loading || !form.title.trim()}
            />
          </View>
        ) : null}
      >
        {isSubtask && parentTask ? (
          <Pressable onPress={onOpenParent} style={styles.subtaskBackButton}>
            <ArrowLeft size={13} color={theme.colors.tertiary} strokeWidth={1.7} />
            <Text style={styles.subtaskBackLabel} numberOfLines={1}>
              {parentTask.title}
            </Text>
          </Pressable>
        ) : null}

        <TextField
          label="Title"
          placeholder="Task title"
          value={form.title}
          onChangeText={(value) => onChange('title', value)}
        />
        <View style={styles.fieldGroup}>
          <View style={styles.formSectionHeader}>
            <Text style={styles.formSectionLabel}>Description</Text>
            <Pressable onPress={onAttachImage} disabled={attachingImage} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>{attachingImage ? 'Uploading…' : '+ Image'}</Text>
            </Pressable>
          </View>
          <TextField
            placeholder="Task description"
            value={descriptionProse}
            onChangeText={(value) => onChange('description', buildDescription(value, descriptionImages))}
            multiline
          />
          {descriptionImages.length > 0 ? (
            <View style={styles.descImageRow}>
              {descriptionImages.map((url, index) => (
                <View key={`${index}-${url}`} style={styles.descImageWrap}>
                  <Image source={{ uri: url }} style={styles.descImage} contentFit="cover" />
                  <Pressable
                    style={styles.descImageRemove}
                    onPress={() => onChange(
                      'description',
                      buildDescription(descriptionProse, descriptionImages.filter((_, i) => i !== index))
                    )}
                  >
                    <X size={11} color={theme.colors.text} strokeWidth={2} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.formSectionLabel}>Status</Text>
          <InlinePickerField
            placeholder="Select status"
            valueLabel={STATUS_META[form.status]?.label || ''}
            onPress={() => setActivePicker((current) => (current === 'status' ? '' : 'status'))}
          />
          <InlineSelectMenu
            visible={activePicker === 'status'}
            options={statusOptions}
            selectedValue={form.status}
            onSelect={(value) => {
              onChange('status', value);
              setActivePicker('');
            }}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.formSectionLabel}>Priority</Text>
          <InlinePickerField
            placeholder="Select priority"
            valueLabel={PRIORITY_META[form.priority]?.label || ''}
            onPress={() => setActivePicker((current) => (current === 'priority' ? '' : 'priority'))}
          />
          <InlineSelectMenu
            visible={activePicker === 'priority'}
            options={priorityOptions}
            selectedValue={form.priority}
            onSelect={(value) => {
              onChange('priority', value);
              setActivePicker('');
            }}
          />
        </View>

        {showAssigneeField ? (
          <>
            {projectName ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.formSectionLabel}>Project</Text>
                <View style={styles.readonlyField}>
                  <FolderKanban size={13} color={theme.colors.tertiary} strokeWidth={1.7} />
                  <Text style={styles.readonlyFieldValue} numberOfLines={1}>{projectName}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.fieldGroup}>
              <Text style={styles.formSectionLabel}>Assignee</Text>
              <InlinePickerField
                placeholder="Select assignee"
                valueLabel={assigneeOptions.find((option) => option.value === form.assignee_user_id)?.label || ''}
                onPress={() => setActivePicker((current) => (current === 'assignee' ? '' : 'assignee'))}
              />
              <InlineSelectMenu
                visible={activePicker === 'assignee'}
                options={assigneeOptions}
                selectedValue={form.assignee_user_id || ''}
                onSelect={(value) => {
                  onChange('assignee_user_id', value);
                  setActivePicker('');
                }}
              />
            </View>
          </>
        ) : null}

        <View style={styles.fieldGroup}>
          <View style={styles.formSectionHeader}>
            <Text style={styles.formSectionLabel}>Task Category</Text>
            <Pressable onPress={onShowInlineType} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>+ New Category</Text>
            </Pressable>
          </View>
          <InlinePickerField
            placeholder="Select task category"
            valueLabel={getTaskTypeLabel(form.task_type_id, taskTypes)}
            onPress={() => setActivePicker((current) => (current === 'type' ? '' : 'type'))}
          />
          <InlineSelectMenu
            visible={activePicker === 'type'}
            options={taskTypeOptions}
            selectedValue={form.task_type_id || ''}
            onSelect={(value) => {
              onChange('task_type_id', value);
              setActivePicker('');
            }}
          />

          {inlineTypeVisible ? (
            <View style={styles.inlineCategoryComposer}>
              <View style={styles.inlineCategoryHeader}>
                <Text style={styles.inlineCategoryTitle}>Create New Category</Text>
                <Pressable onPress={onHideInlineType} style={styles.linkButton}>
                  <Text style={styles.linkButtonText}>Hide</Text>
                </Pressable>
              </View>
              <TextField
                label="Category Name"
                placeholder="Design"
                value={inlineTypeForm.name}
                onChangeText={(value) => onInlineTypeChange('name', value)}
              />
              <ColorField
                label="Category Color"
                value={inlineTypeForm.color}
                onChange={(value) => onInlineTypeChange('color', value)}
                presetColors={TYPE_COLOR_PRESETS}
              />
              <View style={styles.modalFooterEnd}>
                <ActionButton
                  label={inlineTypeLoading ? 'Saving...' : 'Save Category'}
                  icon="checkmark"
                  onPress={onCreateInlineType}
                  disabled={inlineTypeLoading || !inlineTypeForm.name.trim()}
                />
              </View>
            </View>
          ) : null}
        </View>

        <DateTimeField
          label="Due Date"
          value={form.due_date}
          onChange={(value) => onChange('due_date', value)}
          placeholder="Select due date"
        />

        {isEditing && !isSubtask ? (
          <View style={styles.subtasksPanel}>
            <View style={styles.subtasksHeader}>
              <View style={styles.subtasksHeaderTitle}>
                <FolderTree size={13} color={theme.colors.secondary} strokeWidth={1.7} />
                <Text style={styles.subtasksHeaderLabel}>Subtasks ({subtasks.length})</Text>
              </View>
              <Pressable onPress={onToggleSubtaskForm} style={styles.linkButton}>
                <Text style={styles.linkButtonText}>
                  {subtaskFormVisible ? 'Hide' : '+ Add Subtask'}
                </Text>
              </Pressable>
            </View>

            {subtaskFormVisible ? (
              <View style={styles.subtaskComposer}>
                <TextField
                  label="Title"
                  placeholder="Subtask title"
                  value={subtaskForm.title}
                  onChangeText={(value) => onSubtaskFormChange('title', value)}
                />
                <TextField
                  label="Description"
                  placeholder="Optional"
                  value={subtaskForm.description}
                  onChangeText={(value) => onSubtaskFormChange('description', value)}
                  multiline
                />
                <View style={styles.fieldGroup}>
                  <Text style={styles.formSectionLabel}>Status</Text>
                  <InlinePickerField
                    placeholder="Select status"
                    valueLabel={STATUS_META[subtaskForm.status]?.label || ''}
                    onPress={() => setActivePicker((current) => (current === 'subtask-status' ? '' : 'subtask-status'))}
                  />
                  <InlineSelectMenu
                    visible={activePicker === 'subtask-status'}
                    options={statusOptions}
                    selectedValue={subtaskForm.status}
                    onSelect={(value) => {
                      onSubtaskFormChange('status', value);
                      setActivePicker('');
                    }}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.formSectionLabel}>Priority</Text>
                  <InlinePickerField
                    placeholder="Select priority"
                    valueLabel={PRIORITY_META[subtaskForm.priority]?.label || ''}
                    onPress={() => setActivePicker((current) => (current === 'subtask-priority' ? '' : 'subtask-priority'))}
                  />
                  <InlineSelectMenu
                    visible={activePicker === 'subtask-priority'}
                    options={priorityOptions}
                    selectedValue={subtaskForm.priority}
                    onSelect={(value) => {
                      onSubtaskFormChange('priority', value);
                      setActivePicker('');
                    }}
                  />
                </View>
                <DateTimeField
                  label="Due Date"
                  value={subtaskForm.due_date}
                  onChange={(value) => onSubtaskFormChange('due_date', value)}
                  placeholder="Select due date"
                />
                <View style={styles.modalFooterEnd}>
                  <ActionButton
                    label={subtaskCreating ? 'Adding...' : 'Add Subtask'}
                    icon="add"
                    onPress={onCreateSubtask}
                    disabled={subtaskCreating || !subtaskForm.title.trim()}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.subtaskList}>
              {subtasks.length === 0 ? (
                <Text style={styles.subtaskEmpty}>No subtasks</Text>
              ) : (
                subtasks.map((subtask) => {
                  const subtaskType = subtask.task_type_id != null
                    ? taskTypeById.get(String(subtask.task_type_id)) || null
                    : null;
                  const subtaskPriorityMeta = PRIORITY_META[subtask.priority] || { label: subtask.priority };
                  const subtaskDue = formatShortDate(subtask.due_date);
                  const subtaskStatusColor = STATUS_META[subtask.status]?.color || '#94a3b8';
                  const pickerKey = `subtask:${subtask.id}`;

                  return (
                    <View key={subtask.id} style={styles.subtaskItem}>
                      <View style={styles.subtaskItemTop}>
                        <Pressable
                          style={styles.subtaskItemMain}
                          onPress={() => onOpenSubtask(subtask)}
                        >
                          <View style={[styles.subtaskStatusDot, { backgroundColor: subtaskStatusColor }]} />
                          <Text numberOfLines={1} style={styles.subtaskItemTitle}>{subtask.title}</Text>
                        </Pressable>
                        <FramelessIconButton
                          icon={Trash2}
                          color={theme.colors.danger}
                          size={13}
                          onPress={() => onDeleteSubtask(subtask)}
                        />
                      </View>

                      <View style={styles.subtaskItemMeta}>
                        {subtaskType ? (
                          <Text
                            numberOfLines={1}
                            style={[styles.taskTypeMeta, { color: subtaskType.color || theme.colors.info }]}
                          >
                            {subtaskType.name}
                          </Text>
                        ) : null}
                        <View style={[styles.priorityBadge, getPriorityBadgeStyle(subtask.priority, styles)]}>
                          <Text style={[styles.priorityBadgeLabel, getPriorityBadgeLabelStyle(subtask.priority, styles)]}>
                            {subtaskPriorityMeta.label}
                          </Text>
                        </View>
                        {subtaskDue ? (
                          <View style={styles.taskDueDate}>
                            <Calendar color={theme.colors.muted} size={8} strokeWidth={1.8} />
                            <Text style={styles.metaBadgeLabel}>{subtaskDue}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.subtaskStatusRow}>
                        <InlinePickerField
                          placeholder="Status"
                          valueLabel={STATUS_META[subtask.status]?.label || ''}
                          onPress={() => setActivePicker((current) => (current === pickerKey ? '' : pickerKey))}
                        />
                        <InlineSelectMenu
                          visible={activePicker === pickerKey}
                          options={statusOptions}
                          selectedValue={subtask.status}
                          onSelect={(value) => {
                            onUpdateSubtaskStatus(subtask, value);
                            setActivePicker('');
                          }}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : null}
      </ModalSheet>
    </>
  );
}

function TaskTypeManagerModal({
  visible,
  taskTypes,
  form,
  loading,
  onChange,
  onClose,
  onCreate,
  onDelete,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ModalSheet
      visible={visible}
      title="Task Categories"
      onClose={onClose}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton
            label={loading ? 'Creating...' : 'Create Category'}
            icon="add"
            onPress={onCreate}
            disabled={loading || !form.name.trim()}
          />
        </View>
      )}
    >
      <TextField
        label="New Category"
        placeholder="Design"
        value={form.name}
        onChangeText={(value) => onChange('name', value)}
      />
      <ColorField
        label="Category Color"
        value={form.color}
        onChange={(value) => onChange('color', value)}
        presetColors={TYPE_COLOR_PRESETS}
      />

      <View style={styles.typeList}>
        {taskTypes.length === 0 ? (
          <Text style={styles.emptyTypes}>No categories yet.</Text>
        ) : (
          taskTypes.map((type) => (
            <View key={type.id} style={styles.typeRow}>
              <View style={styles.typeRowMain}>
                <View
                  style={[
                    styles.typeRowDot,
                    { backgroundColor: type.color || theme.colors.accent },
                  ]}
                />
                <View style={styles.typeRowTextWrap}>
                  <Text style={styles.typeRowTitle}>{type.name}</Text>
                  <Text style={styles.typeRowSubtitle}>{type.color || '#60A5FA'}</Text>
                </View>
              </View>
              <FramelessIconButton
                icon={Trash2}
                color={theme.colors.danger}
                onPress={() => onDelete(type)}
                size={15}
              />
            </View>
          ))
        )}
      </View>
    </ModalSheet>
  );
}

function SettingsToggleRow({ label, checked, onToggle }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable onPress={onToggle} style={styles.settingsToggleRow}>
      <Text style={styles.settingsToggleLabel}>{label}</Text>
      <View style={[styles.settingsCheckbox, checked ? styles.settingsCheckboxChecked : null]}>
        {checked ? <Check color={theme.colors.text} size={11} strokeWidth={2.2} /> : null}
      </View>
    </Pressable>
  );
}

function SettingsModal({
  visible,
  mode,
  cardView,
  statusConfig,
  onToggleCardField,
  onToggleStatusVisible,
  onChangeStatusColor,
  onClose,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const cardFields = CARD_FIELD_OPTIONS.filter(
    (option) => !option.projectsOnly || mode === 'projects'
  );

  return (
    <ModalSheet visible={visible} title="Task view settings" onClose={onClose}>
      <View style={styles.settingsSection}>
        <Text style={styles.formSectionLabel}>Card fields</Text>
        <View style={styles.settingsToggleList}>
          {cardFields.map((option) => (
            <SettingsToggleRow
              key={option.key}
              label={option.label}
              checked={Boolean(cardView[option.key])}
              onToggle={() => onToggleCardField(option.key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.formSectionLabel}>Statuses</Text>
        <View style={styles.settingsStatusList}>
          {STATUS_ORDER.map((status) => {
            const visible_ = statusConfig[status]?.visible !== false;
            const color = statusConfig[status]?.color || STATUS_META[status]?.color || '#94A3B8';

            return (
              <View key={status} style={styles.settingsStatusItem}>
                <SettingsToggleRow
                  label={STATUS_META[status]?.label || status}
                  checked={visible_}
                  onToggle={() => onToggleStatusVisible(status)}
                />
                <ColorField
                  label="Color"
                  value={color}
                  onChange={(value) => onChangeStatusColor(status, value)}
                  presetColors={STATUS_COLOR_PRESETS}
                />
              </View>
            );
          })}
        </View>
      </View>
    </ModalSheet>
  );
}

function DateRangeModal({ visible, dueFrom, dueTo, onChange, onClose, onClear }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ModalSheet
      visible={visible}
      title="Due Date Range"
      onClose={onClose}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton label="Clear" variant="ghost" onPress={onClear} />
        </View>
      )}
    >
      <DateTimeField
        label="Due From"
        value={dueFrom}
        onChange={(value) => onChange('dueFrom', value)}
        placeholder="Select start date"
      />
      <DateTimeField
        label="Due To"
        value={dueTo}
        onChange={(value) => onChange('dueTo', value)}
        placeholder="Select end date"
      />
    </ModalSheet>
  );
}

function ProjectsManagerModal({
  visible,
  projects,
  activeProjectId,
  membersByProject,
  currentUserId,
  projectForm,
  creatingProject,
  inviteEmail,
  inviting,
  onClose,
  onProjectFormChange,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onInviteEmailChange,
  onInviteMember,
  onRemoveMember,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const activeProject = projects.find((project) => project.id === activeProjectId) || null;
  const activeMembers = activeProject ? (membersByProject[activeProject.id] || []) : [];
  const isOwner = Boolean(activeProject && currentUserId && activeProject.owner_id === currentUserId);

  return (
    <ModalSheet
      visible={visible}
      title="Projects"
      onClose={onClose}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton
            label={creatingProject ? 'Creating...' : 'Create Project'}
            icon="add"
            onPress={onCreateProject}
            disabled={creatingProject || !projectForm.name.trim()}
          />
        </View>
      )}
    >
      <TextField
        label="New Project"
        placeholder="Marketing site"
        value={projectForm.name}
        onChangeText={(value) => onProjectFormChange('name', value)}
      />
      <ColorField
        label="Project Color"
        value={projectForm.color}
        onChange={(value) => onProjectFormChange('color', value)}
        presetColors={PROJECT_COLOR_PRESETS}
      />

      <View style={styles.projectList}>
        {projects.length === 0 ? (
          <Text style={styles.emptyTypes}>No projects yet.</Text>
        ) : (
          projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const owner = Boolean(currentUserId && project.owner_id === currentUserId);
            const memberCount = (membersByProject[project.id] || []).length;

            return (
              <Pressable
                key={project.id}
                onPress={() => onSelectProject(project.id)}
                style={[styles.projectRow, isActive ? styles.projectRowActive : null]}
              >
                <View style={styles.projectRowMain}>
                  <View style={[styles.projectRowDot, { backgroundColor: project.color || theme.colors.info }]} />
                  <View style={styles.projectRowTextWrap}>
                    <Text style={styles.projectRowTitle} numberOfLines={1}>{project.name}</Text>
                    <Text style={styles.projectRowSubtitle}>
                      {memberCount} member{memberCount === 1 ? '' : 's'}{owner ? ' · Owner' : ''}
                    </Text>
                  </View>
                </View>
                {isActive ? <Check color={theme.colors.text} size={13} strokeWidth={2} /> : null}
                {owner ? (
                  <FramelessIconButton
                    icon={Trash2}
                    color={theme.colors.danger}
                    size={14}
                    onPress={() => onDeleteProject(project)}
                  />
                ) : null}
              </Pressable>
            );
          })
        )}
      </View>

      {activeProject ? (
        <View style={styles.membersSection}>
          <Text style={styles.formSectionLabel}>
            {activeProject.name} · Members ({activeMembers.length})
          </Text>
          <View style={styles.memberList}>
            {activeMembers.length === 0 ? (
              <Text style={styles.emptyTypes}>No members yet.</Text>
            ) : (
              activeMembers.map((member) => {
                const memberIsOwner = member.role === PROJECT_OWNER_ROLE;
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <UserRound size={13} color={theme.colors.tertiary} strokeWidth={1.7} />
                    <View style={styles.memberTextWrap}>
                      <Text style={styles.memberName} numberOfLines={1}>{getMemberDisplayName(member)}</Text>
                      <Text style={styles.memberRole}>{memberIsOwner ? 'Owner' : 'Member'}</Text>
                    </View>
                    {isOwner && !memberIsOwner ? (
                      <FramelessIconButton
                        icon={X}
                        color={theme.colors.danger}
                        size={13}
                        onPress={() => onRemoveMember(member)}
                      />
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {isOwner ? (
            <View style={styles.inviteRow}>
              <TextInput
                placeholder="Invite by email"
                placeholderTextColor={theme.colors.muted}
                style={styles.inviteInput}
                autoCapitalize="none"
                keyboardType="email-address"
                value={inviteEmail}
                onChangeText={onInviteEmailChange}
              />
              <ActionButton
                label={inviting ? 'Inviting...' : 'Invite'}
                variant="ghost"
                compact
                onPress={onInviteMember}
                disabled={inviting || !inviteEmail.trim()}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </ModalSheet>
  );
}

export default function TasksScreen({ routeOpenTaskId = '', routeOpenTaskAt = '' } = {}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const addToast = useToast();
  const { confirm } = useDialog();
  const { token } = useAuth();
  const currentUserId = useMemo(() => decodeJwtUserId(token), [token]);
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [mode, setMode] = useState('personal');
  const [projects, setProjects] = useState([]);
  const [membersByProject, setMembersByProject] = useState({});
  const [activeProjectId, setActiveProjectId] = useState('');
  const [projectForm, setProjectForm] = useState(DEFAULT_PROJECT_FORM);
  const [projectsModalVisible, setProjectsModalVisible] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitingMember, setInvitingMember] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [autosavingTask, setAutosavingTask] = useState(false);
  const [creatingType, setCreatingType] = useState(false);
  const [creatingInlineType, setCreatingInlineType] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [statusFilterVisible, setStatusFilterVisible] = useState(false);
  const [priorityFilterVisible, setPriorityFilterVisible] = useState(false);
  const [typeFilterVisible, setTypeFilterVisible] = useState(false);
  const [bulkStatusVisible, setBulkStatusVisible] = useState(false);
  const [dateRangeVisible, setDateRangeVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM);
  const [typeForm, setTypeForm] = useState(DEFAULT_TASK_TYPE_FORM);
  const [inlineTypeForm, setInlineTypeForm] = useState(DEFAULT_TASK_TYPE_FORM);
  const [inlineTypeVisible, setInlineTypeVisible] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState(DEFAULT_SUBTASK_FORM);
  const [subtaskFormVisible, setSubtaskFormVisible] = useState(false);
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [attachingImage, setAttachingImage] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkTargetStatus, setBulkTargetStatus] = useState(TASK_STATUS.IN_PROGRESS);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [cardView, setCardView] = useState(DEFAULT_CARD_VIEW);
  const [statusConfig, setStatusConfig] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsLoadedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const lastSavedFingerprintRef = useRef('');
  const handledRouteOpenRef = useRef('');

  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const taskTypeById = useMemo(
    () => new Map(taskTypes.map((type) => [String(type.id), type])),
    [taskTypes]
  );

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [fetchedTasks, fetchedTypes, fetchedProjects] = await Promise.all([
        tasksApi.getTasks(),
        tasksApi.getTaskTypes(),
        projectsApi.getProjects(),
      ]);
      setTasks(fetchedTasks);
      setTaskTypes(fetchedTypes);
      setProjects(fetchedProjects);

      if (fetchedProjects.length > 0) {
        const memberLists = await Promise.all(
          fetchedProjects.map((project) => (
            projectsApi.getProjectMembers(project.id).catch(() => [])
          ))
        );
        const memberMap = {};
        fetchedProjects.forEach((project, index) => {
          memberMap[project.id] = memberLists[index] || [];
        });
        setMembersByProject(memberMap);
      } else {
        setMembersByProject({});
      }
    } catch (error) {
      console.error('Failed to load tasks', error);
      addToast(error?.message || 'Failed to load tasks.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [storedCardView, storedStatusConfig] = await Promise.all([
          AsyncStorage.getItem(CARD_VIEW_KEY),
          AsyncStorage.getItem(STATUS_CONFIG_KEY),
        ]);
        if (cancelled) return;
        if (storedCardView) {
          setCardView({ ...DEFAULT_CARD_VIEW, ...JSON.parse(storedCardView) });
        }
        if (storedStatusConfig) {
          setStatusConfig(JSON.parse(storedStatusConfig) || {});
        }
      } catch (error) {
        console.error('Failed to load task view settings', error);
      } finally {
        if (!cancelled) settingsLoadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(CARD_VIEW_KEY, JSON.stringify(cardView)).catch((error) => {
      console.error('Failed to save card view settings', error);
    });
  }, [cardView]);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(STATUS_CONFIG_KEY, JSON.stringify(statusConfig)).catch((error) => {
      console.error('Failed to save status config', error);
    });
  }, [statusConfig]);

  useEffect(() => {
    setActiveProjectId((current) => {
      if (current && projects.some((project) => project.id === current)) return current;
      return projects[0]?.id || '';
    });
  }, [projects]);

  const filteredTasks = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();

    return tasks.filter((task) => {
      // Parity with web: subtasks live inside the detail modal and soft-deleted rows
      // are hidden in both modes.
      if (task.parent_task_id) return false;
      if (task.is_deleted) return false;

      if (mode === 'projects') {
        // Projects mode shows only the active project's tasks.
        if (!activeProjectId) return false;
        if (task.project_id !== activeProjectId) return false;
      } else if (task.project_id) {
        // Personal mode hides any task that belongs to a project.
        return false;
      }

      const matchesSearch = !needle
        || task.title.toLowerCase().includes(needle)
        || (task.description || '').toLowerCase().includes(needle);
      const matchesStatus = filters.status.length === 0 || filters.status.includes(task.status);
      const matchesPriority = filters.priority.length === 0 || filters.priority.includes(task.priority);
      const matchesType = (
        filters.taskTypeIds.length === 0
        || filters.taskTypeIds.includes(String(task.task_type_id || ''))
      );

      const dueTime = task.due_date ? new Date(task.due_date).getTime() : null;
      const fromTime = filters.dueFrom ? new Date(filters.dueFrom).getTime() : null;
      const toTime = filters.dueTo ? new Date(filters.dueTo).getTime() : null;
      const matchesDueFrom = !fromTime || (dueTime != null && dueTime >= fromTime);
      const matchesDueTo = !toTime || (dueTime != null && dueTime <= toTime);

      return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesDueFrom && matchesDueTo;
    });
  }, [activeProjectId, filters, mode, tasks]);

  const boardByStatus = useMemo(() => (
    STATUS_ORDER.reduce((groups, status) => {
      groups[status] = filteredTasks
        .filter((task) => task.status === status)
        .sort((left, right) => {
          const leftDue = new Date(left.due_date || 0).getTime();
          const rightDue = new Date(right.due_date || 0).getTime();
          return leftDue - rightDue;
        });
      return groups;
    }, {})
  ), [filteredTasks]);

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };

      STATUS_ORDER.forEach((status) => {
        const items = boardByStatus[status] || [];

        if (!COLLAPSED_BY_DEFAULT.has(status) && items.length > 0) {
          next[status] = false;
          return;
        }

        if (typeof next[status] !== 'boolean') {
          next[status] = items.length === 0 || COLLAPSED_BY_DEFAULT.has(status);
        }
      });

      return next;
    });
  }, [boardByStatus]);

  useEffect(() => {
    setSelectedTaskIds((current) => current.filter((id) => tasks.some((task) => task.id === id)));
  }, [tasks]);

  useEffect(() => {
    if (selectionMode && selectedTaskIds.length === 0) {
      setSelectionMode(false);
    }
  }, [selectedTaskIds, selectionMode]);

  const statusOptions = useMemo(
    () => STATUS_ORDER.map((status) => ({
      value: status,
      label: STATUS_META[status].label,
      color: STATUS_META[status].color,
    })),
    []
  );

  const priorityOptions = useMemo(
    () => PRIORITY_ORDER.map((priority) => ({
      value: priority,
      label: PRIORITY_META[priority].label,
      color: PRIORITY_META[priority].color,
    })),
    []
  );

  const taskTypeOptions = useMemo(
    () => taskTypes.map((type) => ({
      value: String(type.id),
      label: type.name,
      color: type.color,
    })),
    [taskTypes]
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count += 1;
    if (filters.status.length) count += 1;
    if (filters.priority.length) count += 1;
    if (filters.taskTypeIds.length) count += 1;
    if (filters.dueFrom || filters.dueTo) count += 1;
    return count;
  }, [filters]);

  const handleTaskFormChange = useCallback((field, value) => {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleInlineTypeChange = useCallback((field, value) => {
    setInlineTypeForm((current) => ({ ...current, [field]: value }));
  }, []);

  const openCreateTask = useCallback((status) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setEditingTask(null);
    const overrides = status ? { status } : {};
    if (mode === 'projects' && activeProjectId) {
      const members = membersByProject[activeProjectId] || [];
      overrides.project_id = activeProjectId;
      overrides.assignee_user_id = (
        members.find((member) => member.user_id === currentUserId)?.user_id
        || members[0]?.user_id
        || ''
      );
    }
    setTaskForm(getTaskFormFromFilters(filters, overrides));
    setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
    setInlineTypeVisible(false);
    setSubtaskForm(DEFAULT_SUBTASK_FORM);
    setSubtaskFormVisible(false);
    setAutosavingTask(false);
    lastSavedFingerprintRef.current = '';
    setTaskModalVisible(true);
  }, [activeProjectId, currentUserId, filters, membersByProject, mode]);

  const openTask = useCallback((task) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    const normalizedForm = normalizeTaskForm(task);
    setEditingTask(task);
    setTaskForm(normalizedForm);
    setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
    setInlineTypeVisible(false);
    setSubtaskForm(DEFAULT_SUBTASK_FORM);
    setSubtaskFormVisible(false);
    setAutosavingTask(false);
    lastSavedFingerprintRef.current = JSON.stringify(buildTaskPayload(task, normalizedForm));
    setTaskModalVisible(true);
  }, []);

  useEffect(() => {
    if (!routeOpenTaskId || !routeOpenTaskAt) return;

    const routeKey = `${routeOpenTaskId}:${routeOpenTaskAt}`;
    if (handledRouteOpenRef.current === routeKey) return;

    const task = tasks.find((item) => String(item.id) === String(routeOpenTaskId));
    if (!task) return;

    handledRouteOpenRef.current = routeKey;
    openTask(task);
  }, [openTask, routeOpenTaskAt, routeOpenTaskId, tasks]);

  const closeTaskModal = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setTaskModalVisible(false);
    setEditingTask(null);
    setInlineTypeVisible(false);
    setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
    setSubtaskForm(DEFAULT_SUBTASK_FORM);
    setSubtaskFormVisible(false);
    setAutosavingTask(false);
    lastSavedFingerprintRef.current = '';
  }, []);

  const updateTaskInState = useCallback((updatedTask) => {
    setTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
    setEditingTask(updatedTask);
  }, []);

  const editPayload = useMemo(
    () => (editingTask ? buildTaskPayload(editingTask, taskForm) : null),
    [editingTask, taskForm]
  );
  const editPayloadFingerprint = useMemo(
    () => (editPayload ? JSON.stringify(editPayload) : ''),
    [editPayload]
  );

  useEffect(() => {
    if (!editingTask || !taskModalVisible) return undefined;
    if (!editPayload || !editPayload.title) return undefined;
    if (editPayloadFingerprint === lastSavedFingerprintRef.current) return undefined;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      setAutosavingTask(true);

      try {
        const updatedTask = await tasksApi.updateTask(editingTask.id, editPayload);
        updateTaskInState(updatedTask);
        lastSavedFingerprintRef.current = editPayloadFingerprint;
      } catch (error) {
        console.error('Failed to autosave task', error);
        addToast(error?.message || 'Failed to update task.', 'error');
      } finally {
        setAutosavingTask(false);
      }
    }, 450);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    addToast,
    editPayload,
    editPayloadFingerprint,
    editingTask,
    taskModalVisible,
    updateTaskInState,
  ]);

  const handleCreateTask = useCallback(async () => {
    if (creatingTask) return;

    setCreatingTask(true);

    try {
      const isProjectsMode = mode === 'projects';
      const createdTask = await tasksApi.createTask({
        title: taskForm.title.trim(),
        description: taskForm.description || null,
        project_id: isProjectsMode ? (activeProjectId || null) : null,
        assignee_user_id: isProjectsMode ? (taskForm.assignee_user_id || null) : null,
        task_type_id: taskForm.task_type_id || null,
        parent_task_id: null,
        status: taskForm.status,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
        start_date: null,
      });

      setTasks((current) => [createdTask, ...current]);
      addToast('Task created.');
      closeTaskModal();
    } catch (error) {
      console.error('Failed to create task', error);
      addToast(error?.message || 'Failed to create task.', 'error');
    } finally {
      setCreatingTask(false);
    }
  }, [activeProjectId, addToast, closeTaskModal, creatingTask, mode, taskForm]);

  const handleDeleteTask = useCallback(async () => {
    if (!editingTask) return;

    const ok = await confirm({
      title: 'Delete task?',
      message: `This will remove "${editingTask.title}".`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await tasksApi.deleteTasksBulk({ task_ids: [editingTask.id] });
      setTasks((current) => current.filter((task) => task.id !== editingTask.id));
      addToast('Task deleted.');
      closeTaskModal();
    } catch (error) {
      console.error('Failed to delete task', error);
      addToast(error?.message || 'Failed to delete task.', 'error');
    }
  }, [addToast, closeTaskModal, confirm, editingTask]);

  const collectCascadeDeleteIds = useCallback((taskIds) => {
    const ids = new Set(taskIds);
    let expanded = true;
    while (expanded) {
      expanded = false;
      tasks.forEach((task) => {
        if (task.parent_task_id && ids.has(task.parent_task_id) && !ids.has(task.id)) {
          ids.add(task.id);
          expanded = true;
        }
      });
    }
    return Array.from(ids);
  }, [tasks]);

  const checkAndCompleteParents = useCallback(async (updatedTaskIds, newStatus) => {
    if (newStatus !== TASK_STATUS.COMPLETED) return;

    const parentIds = Array.from(new Set(
      updatedTaskIds
        .map((id) => tasks.find((task) => task.id === id)?.parent_task_id)
        .filter(Boolean)
    ));
    if (parentIds.length === 0) return;

    const completedParents = [];
    parentIds.forEach((parentId) => {
      const siblings = tasks.filter((task) => task.parent_task_id === parentId);
      if (siblings.length === 0) return;
      const allCompleted = siblings.every(
        (sub) => sub.status === TASK_STATUS.COMPLETED || updatedTaskIds.includes(sub.id)
      );
      if (allCompleted) completedParents.push(parentId);
    });

    if (completedParents.length === 0) return;

    await tasksApi.updateTasksBulkStatus({
      task_ids: completedParents,
      status: TASK_STATUS.COMPLETED,
    });
    setTasks((current) => current.map((task) => (
      completedParents.includes(task.id)
        ? { ...task, status: TASK_STATUS.COMPLETED, completed_at: task.completed_at || new Date().toISOString() }
        : task
    )));
  }, [tasks]);

  const applyStatusUpdate = useCallback(async (taskId, status) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const optimistic = {
      ...target,
      status,
      completed_at: status === TASK_STATUS.COMPLETED
        ? (target.completed_at || nowIso)
        : target.completed_at,
      pause_start_date: status === TASK_STATUS.PAUSED
        ? (target.pause_start_date || nowIso)
        : target.pause_start_date,
    };

    setTasks((current) => current.map((task) => (task.id === taskId ? optimistic : task)));

    if (editingTask?.id === taskId) {
      setEditingTask(optimistic);
      setTaskForm((current) => ({ ...current, status }));
      // Keep the autosave fingerprint in sync so the bulk-status call (which the
      // server uses to compute spent time) is not duplicated by a redundant PATCH.
      lastSavedFingerprintRef.current = JSON.stringify(
        buildTaskPayload(optimistic, { ...taskForm, status })
      );
    }

    try {
      await tasksApi.updateTasksBulkStatus({ task_ids: [taskId], status });
      await checkAndCompleteParents([taskId], status);
      loadData({ silent: true });
    } catch (error) {
      console.error('Failed to update status', error);
      addToast(error?.message || 'Failed to update status.', 'error');
      loadData({ silent: true });
    }
  }, [addToast, checkAndCompleteParents, editingTask, loadData, taskForm, tasks]);

  const handleStatusAction = useCallback((status, { close = false } = {}) => {
    if (!editingTask) return;
    applyStatusUpdate(editingTask.id, status);
    if (close) {
      // Close after the optimistic update so closeTaskModal's cleanup (timer +
      // editingTask reset) is the final state, cancelling any redundant autosave.
      closeTaskModal();
    }
  }, [applyStatusUpdate, closeTaskModal, editingTask]);

  const handleSubtaskFormChange = useCallback((field, value) => {
    setSubtaskForm((current) => ({ ...current, [field]: value }));
  }, []);

  const toggleSubtaskForm = useCallback(() => {
    setSubtaskForm(DEFAULT_SUBTASK_FORM);
    setSubtaskFormVisible((current) => !current);
  }, []);

  const handleCreateSubtask = useCallback(async () => {
    if (creatingSubtask || !editingTask) return;
    const title = subtaskForm.title.trim();
    if (!title) return;

    setCreatingSubtask(true);
    try {
      const created = await tasksApi.createTask({
        title,
        description: subtaskForm.description || null,
        project_id: editingTask.project_id || null,
        assignee_user_id: editingTask.assignee_user_id || null,
        parent_task_id: editingTask.id,
        task_type_id: editingTask.task_type_id || null,
        status: subtaskForm.status,
        priority: subtaskForm.priority,
        due_date: subtaskForm.due_date || null,
      });
      setTasks((current) => [created, ...current]);
      setSubtaskForm(DEFAULT_SUBTASK_FORM);
      setSubtaskFormVisible(false);
      addToast('Subtask created.');
    } catch (error) {
      console.error('Failed to create subtask', error);
      addToast(error?.message || 'Failed to create subtask.', 'error');
    } finally {
      setCreatingSubtask(false);
    }
  }, [addToast, creatingSubtask, editingTask, subtaskForm]);

  const handleDeleteSubtask = useCallback(async (subtask) => {
    const ok = await confirm({
      title: 'Delete subtask?',
      message: `This will remove "${subtask.title}".`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const ids = collectCascadeDeleteIds([subtask.id]);
    try {
      await tasksApi.deleteTasksBulk({ task_ids: ids });
      setTasks((current) => current.filter((task) => !ids.includes(task.id)));
      addToast('Subtask deleted.');
    } catch (error) {
      console.error('Failed to delete subtask', error);
      addToast(error?.message || 'Failed to delete subtask.', 'error');
    }
  }, [addToast, collectCascadeDeleteIds, confirm]);

  const handleUpdateSubtaskStatus = useCallback((subtask, status) => {
    applyStatusUpdate(subtask.id, status);
  }, [applyStatusUpdate]);

  const handleAttachImage = useCallback(async () => {
    if (attachingImage) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        addToast('Photo permission is required to attach images.', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;

      setAttachingImage(true);
      const asset = result.assets[0];
      const name = asset.fileName || asset.uri.split('/').pop() || 'upload.jpg';
      const type = asset.mimeType || 'image/jpeg';
      const uploaded = await mediaApi.upload({
        file: { uri: asset.uri, name, type },
        kind: 'board',
      });
      const url = uploaded?.url || '';
      if (!url) {
        addToast('Image upload failed.', 'error');
        return;
      }

      setTaskForm((current) => {
        const { prose, urls } = parseDescription(current.description);
        return { ...current, description: buildDescription(prose, [...urls, url]) };
      });
    } catch (error) {
      console.error('Failed to attach image', error);
      addToast(error?.message || 'Failed to attach image.', 'error');
    } finally {
      setAttachingImage(false);
    }
  }, [addToast, attachingImage]);

  const openParentTask = useCallback(() => {
    if (!editingTask?.parent_task_id) return;
    const parent = tasks.find((task) => task.id === editingTask.parent_task_id);
    if (parent) openTask(parent);
  }, [editingTask, openTask, tasks]);

  const editingIsSubtask = Boolean(editingTask?.parent_task_id);
  const subtasksOfEditing = useMemo(
    () => (editingTask ? tasks.filter((task) => task.parent_task_id === editingTask.id && !task.is_deleted) : []),
    [editingTask, tasks]
  );
  const editingParentTask = useMemo(
    () => (editingTask?.parent_task_id
      ? tasks.find((task) => task.id === editingTask.parent_task_id) || null
      : null),
    [editingTask, tasks]
  );

  const openTypeManager = useCallback(() => {
    setTypeForm(DEFAULT_TASK_TYPE_FORM);
    setTypeModalVisible(true);
  }, []);

  const closeTypeManager = useCallback(() => {
    setTypeModalVisible(false);
    setTypeForm(DEFAULT_TASK_TYPE_FORM);
  }, []);

  const handleCreateType = useCallback(async () => {
    if (creatingType) return;

    const name = typeForm.name.trim();
    if (!name) {
      addToast('Task category name is required.', 'error');
      return;
    }

    setCreatingType(true);

    try {
      const createdType = await tasksApi.createTaskType({
        name,
        description: null,
        color: typeForm.color || null,
        is_active: true,
      });

      setTaskTypes((current) => [createdType, ...current]);
      setTypeForm(DEFAULT_TASK_TYPE_FORM);
      addToast('Task category created.');
    } catch (error) {
      console.error('Failed to create task category', error);
      addToast(error?.message || 'Failed to create task category.', 'error');
    } finally {
      setCreatingType(false);
    }
  }, [addToast, creatingType, typeForm]);

  const handleDeleteType = useCallback(async (type) => {
    const ok = await confirm({
      title: 'Delete task category?',
      message: `This will remove "${type.name}".`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await tasksApi.deleteTaskType(type.id);
      setTaskTypes((current) => current.filter((item) => item.id !== type.id));
      setTasks((current) =>
        current.map((task) => (
          task.task_type_id === type.id ? { ...task, task_type_id: null } : task
        ))
      );
      setFilters((current) => ({
        ...current,
        taskTypeIds: current.taskTypeIds.filter((value) => value !== String(type.id)),
      }));
      if (taskForm.task_type_id === type.id) {
        setTaskForm((current) => ({ ...current, task_type_id: '' }));
      }
      addToast('Task category deleted.');
    } catch (error) {
      console.error('Failed to delete task category', error);
      addToast(error?.message || 'Failed to delete task category.', 'error');
    }
  }, [addToast, confirm, taskForm.task_type_id]);

  const handleCreateInlineType = useCallback(async () => {
    if (creatingInlineType) return;

    const name = inlineTypeForm.name.trim();
    if (!name) return;

    setCreatingInlineType(true);

    try {
      const createdType = await tasksApi.createTaskType({
        name,
        description: null,
        color: inlineTypeForm.color || null,
        is_active: true,
      });

      setTaskTypes((current) => [createdType, ...current]);
      setTaskForm((current) => ({ ...current, task_type_id: createdType.id }));
      setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
      setInlineTypeVisible(false);
      addToast('Task category created.');
    } catch (error) {
      console.error('Failed to create task category', error);
      addToast(error?.message || 'Failed to create task category.', 'error');
    } finally {
      setCreatingInlineType(false);
    }
  }, [addToast, creatingInlineType, inlineTypeForm]);

  const toggleGroup = useCallback((status) => {
    if (!COLLAPSED_BY_DEFAULT.has(status) && (boardByStatus[status] || []).length > 0) {
      return;
    }

    setCollapsedGroups((current) => ({ ...current, [status]: !current[status] }));
  }, [boardByStatus]);

  const toggleCardField = useCallback((key) => {
    setCardView((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const toggleStatusVisible = useCallback((status) => {
    setStatusConfig((current) => {
      const entry = current[status] || {};
      const nextVisible = entry.visible === false;
      return { ...current, [status]: { ...entry, visible: nextVisible } };
    });
  }, []);

  const changeStatusColor = useCallback((status, color) => {
    setStatusConfig((current) => ({
      ...current,
      [status]: { ...(current[status] || {}), color },
    }));
  }, []);

  const toggleSelectTask = useCallback((taskId) => {
    setSelectedTaskIds((current) => (
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    ));
  }, []);

  const handleLongPressTask = useCallback((task) => {
    setSelectionMode(true);
    setSelectedTaskIds((current) => (
      current.includes(task.id) ? current : [...current, task.id]
    ));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedTaskIds([]);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTaskIds.length === 0) return;

    const ok = await confirm({
      title: 'Delete selected tasks?',
      message: `This will remove ${selectedTaskIds.length} tasks.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await tasksApi.deleteTasksBulk({ task_ids: selectedTaskIds });
      setTasks((current) => current.filter((task) => !selectedTaskIdSet.has(task.id)));
      addToast('Tasks deleted.');
      exitSelectionMode();
    } catch (error) {
      console.error('Failed to delete tasks', error);
      addToast(error?.message || 'Failed to delete tasks.', 'error');
    }
  }, [addToast, confirm, exitSelectionMode, selectedTaskIdSet, selectedTaskIds]);

  const handleBulkUpdateStatus = useCallback(async () => {
    if (selectedTaskIds.length === 0) return;

    try {
      setTasks((current) =>
        current.map((task) => (
          selectedTaskIdSet.has(task.id) ? { ...task, status: bulkTargetStatus } : task
        ))
      );
      await tasksApi.updateTasksBulkStatus({
        task_ids: selectedTaskIds,
        status: bulkTargetStatus,
      });
      addToast(`Moved to ${STATUS_META[bulkTargetStatus].label}.`);
      exitSelectionMode();
      loadData({ silent: true });
    } catch (error) {
      console.error('Failed to update tasks', error);
      addToast(error?.message || 'Failed to update tasks.', 'error');
      loadData({ silent: true });
    }
  }, [
    addToast,
    bulkTargetStatus,
    exitSelectionMode,
    loadData,
    selectedTaskIdSet,
    selectedTaskIds,
  ]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const openProjectsManager = useCallback(() => {
    setProjectForm(DEFAULT_PROJECT_FORM);
    setInviteEmail('');
    setProjectsModalVisible(true);
  }, []);

  const handleProjectFormChange = useCallback((field, value) => {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (creatingProject) return;
    const name = projectForm.name.trim();
    if (!name) return;

    setCreatingProject(true);
    try {
      const created = await projectsApi.createProject({ name, color: projectForm.color });
      setProjects((current) => [created, ...current]);
      setActiveProjectId(created.id);
      const members = await projectsApi.getProjectMembers(created.id).catch(() => []);
      setMembersByProject((current) => ({ ...current, [created.id]: members }));
      setProjectForm(DEFAULT_PROJECT_FORM);
      addToast('Project created.');
    } catch (error) {
      console.error('Failed to create project', error);
      addToast(error?.message || 'Failed to create project.', 'error');
    } finally {
      setCreatingProject(false);
    }
  }, [addToast, creatingProject, projectForm]);

  const handleDeleteProject = useCallback(async (project) => {
    const ok = await confirm({
      title: 'Delete project?',
      message: `This deletes "${project.name}" and every task in it.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await projectsApi.deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setTasks((current) => current.filter((task) => task.project_id !== project.id));
      setMembersByProject((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      addToast('Project deleted.');
    } catch (error) {
      console.error('Failed to delete project', error);
      addToast(error?.message || 'Failed to delete project.', 'error');
    }
  }, [addToast, confirm]);

  const handleSelectProject = useCallback((projectId) => {
    setActiveProjectId(projectId);
  }, []);

  const handleInviteMember = useCallback(async () => {
    if (invitingMember || !activeProjectId) return;
    const email = inviteEmail.trim();
    if (!email) return;

    setInvitingMember(true);
    try {
      const response = await projectsApi.inviteProjectMember(activeProjectId, email);
      if (response?.member) {
        setMembersByProject((current) => ({
          ...current,
          [activeProjectId]: [...(current[activeProjectId] || []), response.member],
        }));
        addToast('Member added.');
      } else {
        addToast('Invitation sent.');
      }
      setInviteEmail('');
    } catch (error) {
      console.error('Failed to invite member', error);
      addToast(error?.message || 'Failed to invite member.', 'error');
    } finally {
      setInvitingMember(false);
    }
  }, [activeProjectId, addToast, inviteEmail, invitingMember]);

  const handleRemoveMember = useCallback(async (member) => {
    if (!activeProjectId) return;
    const ok = await confirm({
      title: 'Remove member?',
      message: `Remove ${getMemberDisplayName(member)} from this project?`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await projectsApi.removeProjectMember(activeProjectId, member.id);
      setMembersByProject((current) => ({
        ...current,
        [activeProjectId]: (current[activeProjectId] || []).filter((item) => item.id !== member.id),
      }));
      addToast('Member removed.');
    } catch (error) {
      console.error('Failed to remove member', error);
      addToast(error?.message || 'Failed to remove member.', 'error');
    }
  }, [activeProjectId, addToast, confirm]);


  const modalProjectId = taskForm.project_id || '';
  const modalAssigneeOptions = useMemo(() => {
    const members = modalProjectId ? (membersByProject[modalProjectId] || []) : [];
    return [
      { value: '', label: 'Unassigned' },
      ...members.map((member) => ({ value: member.user_id, label: getMemberDisplayName(member) })),
    ];
  }, [modalProjectId, membersByProject]);
  const modalProjectName = useMemo(
    () => projects.find((project) => project.id === modalProjectId)?.name || '',
    [modalProjectId, projects]
  );

  return (
    <>
      <ScreenShell
        title="Tasks"
        showPageHeader={false}
        sectionNav={(
          <View style={styles.headerNav}>
            <Pressable hitSlop={8} onPress={() => setMode('personal')}>
              <Text style={[styles.headerNavLink, mode === 'personal' ? styles.headerNavLinkActive : null]}>
                tasks
              </Text>
            </Pressable>
            <Text style={styles.headerNavSlash}>/</Text>
            <Pressable hitSlop={8} onPress={() => setMode('projects')}>
              <Text style={[styles.headerNavLink, mode === 'projects' ? styles.headerNavLinkActive : null]}>
                projects
              </Text>
            </Pressable>
          </View>
        )}
        refreshControl={(
          <RefreshControl
            tintColor={theme.colors.text}
            refreshing={refreshing}
            onRefresh={() => loadData({ silent: true })}
          />
        )}
      >
        <View style={styles.topActions}>
          {selectionMode ? (
            <View style={styles.selectionBar}>
              <View style={styles.selectionInfo}>
                <SquareCheck color={theme.colors.secondary} size={14} strokeWidth={1.7} />
                <Text style={styles.selectionInfoLabel}>{selectedTaskIds.length} selected</Text>
              </View>
              <InlinePickerField
                placeholder="Move To"
                valueLabel={STATUS_META[bulkTargetStatus].label}
                onPress={() => setBulkStatusVisible(true)}
                style={styles.bulkStatusField}
              />
              <ActionButton
                label="Move"
                variant="ghost"
                onPress={handleBulkUpdateStatus}
                disabled={selectedTaskIds.length === 0}
              />
              <FramelessIconButton
                icon={Trash2}
                color={theme.colors.danger}
                onPress={handleBulkDelete}
              />
              <FramelessIconButton
                icon={X}
                color={theme.colors.text}
                onPress={exitSelectionMode}
              />
            </View>
          ) : (
            <View style={styles.headerActions}>
              {mode === 'projects' && activeProject ? (
                <View style={styles.projectHeading}>
                  <View style={[styles.projectHeadingDot, { backgroundColor: activeProject.color || theme.colors.info }]} />
                  <Text style={styles.projectHeadingName} numberOfLines={1}>{activeProject.name}</Text>
                  <Text style={styles.projectHeadingMeta}>
                    {(membersByProject[activeProject.id] || []).length} member{(membersByProject[activeProject.id] || []).length === 1 ? '' : 's'}
                  </Text>
                </View>
              ) : (
                <View style={styles.headerSpacer} />
              )}
              <View style={styles.headerButtons}>
                <FramelessIconButton
                  icon={Settings2}
                  color={theme.colors.tertiary}
                  onPress={() => setIsSettingsOpen(true)}
                />
                {mode === 'projects' ? (
                  <FramelessIconButton icon={Users} color={theme.colors.tertiary} onPress={openProjectsManager} />
                ) : null}
                {mode === 'personal' ? (
                  <ActionButton
                    label="Categories"
                    variant="ghost"
                    onPress={openTypeManager}
                  />
                ) : null}
                <ActionButton
                  label="New Task"
                  onPress={() => openCreateTask()}
                  disabled={mode === 'projects' && !activeProjectId}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.filtersBar}>
          <View style={styles.filterToolbar}>
            <TextInput
              placeholder="Search by title or description"
              placeholderTextColor={theme.colors.muted}
              style={styles.tasksFilterInput}
              value={filters.search}
              onChangeText={(value) => setFilters((current) => ({ ...current, search: value }))}
            />
            <InlinePickerField
              placeholder="All Statuses"
              valueLabel={formatFilterLabel(filters.status, statusOptions)}
              onPress={() => setStatusFilterVisible(true)}
              style={styles.filterField}
            />
            <InlinePickerField
              placeholder="All Priorities"
              valueLabel={formatFilterLabel(filters.priority, priorityOptions)}
              onPress={() => setPriorityFilterVisible(true)}
              style={styles.filterField}
            />
            <InlinePickerField
              placeholder="All Task Categories"
              valueLabel={formatFilterLabel(filters.taskTypeIds, taskTypeOptions)}
              onPress={() => setTypeFilterVisible(true)}
              style={styles.filterField}
            />
            <InlinePickerField
              placeholder="Due date range"
              valueLabel={formatDueRangeLabel(filters.dueFrom, filters.dueTo)}
              onPress={() => setDateRangeVisible(true)}
              style={styles.filterField}
            />
            <Pressable
              onPress={() => setFilters(DEFAULT_FILTERS)}
              disabled={activeFiltersCount === 0}
              style={({ pressed }) => [
                styles.clearAllButton,
                activeFiltersCount === 0 ? styles.clearAllButtonDisabled : null,
                pressed && activeFiltersCount > 0 ? styles.clearAllButtonPressed : null,
              ]}
            >
              <X color={theme.colors.tertiary} size={12} strokeWidth={1.5} />
              <Text style={styles.clearAllLabel}>
                {activeFiltersCount > 0 ? `Clear All (${activeFiltersCount})` : 'Clear All'}
              </Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Loading tasks…</Text>
          </View>
        ) : (mode === 'projects' && projects.length === 0) ? (
          <View style={styles.projectsEmpty}>
            <Text style={styles.projectsEmptyTitle}>No projects yet</Text>
            <Text style={styles.projectsEmptyBody}>
              Create a project to assign tasks and collaborate with members.
            </Text>
            <View style={styles.projectsEmptyAction}>
              <ActionButton label="Create Project" icon="add" onPress={openProjectsManager} />
            </View>
          </View>
        ) : (
          <TasksMobileList
            boardByStatus={boardByStatus}
            taskTypeById={taskTypeById}
            collapsedGroups={collapsedGroups}
            selectionMode={selectionMode}
            selectedTaskIds={selectedTaskIdSet}
            showAssignee={mode === 'projects'}
            membersByProject={membersByProject}
            cardView={cardView}
            statusConfig={statusConfig}
            onToggleGroup={toggleGroup}
            onToggleSelect={toggleSelectTask}
            onOpenTask={openTask}
            onLongPressTask={handleLongPressTask}
            onOpenCreateForStatus={openCreateTask}
          />
        )}
      </ScreenShell>

      <TaskModal
        visible={taskModalVisible}
        isEditing={Boolean(editingTask)}
        isSubtask={editingIsSubtask}
        parentTask={editingParentTask}
        form={taskForm}
        loading={creatingTask}
        autosaving={autosavingTask}
        taskTypes={taskTypes}
        taskTypeById={taskTypeById}
        inlineTypeForm={inlineTypeForm}
        inlineTypeVisible={inlineTypeVisible}
        inlineTypeLoading={creatingInlineType}
        showAssigneeField={Boolean(modalProjectId)}
        assigneeOptions={modalAssigneeOptions}
        projectName={modalProjectName}
        subtasks={subtasksOfEditing}
        subtaskForm={subtaskForm}
        subtaskFormVisible={subtaskFormVisible}
        subtaskCreating={creatingSubtask}
        attachingImage={attachingImage}
        onAttachImage={handleAttachImage}
        onChange={handleTaskFormChange}
        onInlineTypeChange={handleInlineTypeChange}
        onShowInlineType={() => {
          setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
          setInlineTypeVisible(true);
        }}
        onHideInlineType={() => {
          setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
          setInlineTypeVisible(false);
        }}
        onCreateInlineType={handleCreateInlineType}
        onClose={closeTaskModal}
        onCreate={handleCreateTask}
        onDelete={editingTask ? handleDeleteTask : null}
        onStatusAction={handleStatusAction}
        onOpenParent={openParentTask}
        onSubtaskFormChange={handleSubtaskFormChange}
        onToggleSubtaskForm={toggleSubtaskForm}
        onCreateSubtask={handleCreateSubtask}
        onOpenSubtask={openTask}
        onDeleteSubtask={handleDeleteSubtask}
        onUpdateSubtaskStatus={handleUpdateSubtaskStatus}
      />

      <TaskTypeManagerModal
        visible={typeModalVisible}
        taskTypes={taskTypes}
        form={typeForm}
        loading={creatingType}
        onChange={(field, value) => setTypeForm((current) => ({ ...current, [field]: value }))}
        onClose={closeTypeManager}
        onCreate={handleCreateType}
        onDelete={handleDeleteType}
      />

      <SettingsModal
        visible={isSettingsOpen}
        mode={mode}
        cardView={cardView}
        statusConfig={statusConfig}
        onToggleCardField={toggleCardField}
        onToggleStatusVisible={toggleStatusVisible}
        onChangeStatusColor={changeStatusColor}
        onClose={() => setIsSettingsOpen(false)}
      />

      <OptionPickerSheet
        visible={statusFilterVisible}
        title="All Statuses"
        options={statusOptions}
        multiple
        selectedValues={filters.status}
        onToggle={(value) => {
          setFilters((current) => ({
            ...current,
            status: current.status.includes(value)
              ? current.status.filter((item) => item !== value)
              : [...current.status, value],
          }));
        }}
        onClose={() => setStatusFilterVisible(false)}
        onClear={() => setFilters((current) => ({ ...current, status: [] }))}
      />

      <OptionPickerSheet
        visible={priorityFilterVisible}
        title="All Priorities"
        options={priorityOptions}
        multiple
        selectedValues={filters.priority}
        onToggle={(value) => {
          setFilters((current) => ({
            ...current,
            priority: current.priority.includes(value)
              ? current.priority.filter((item) => item !== value)
              : [...current.priority, value],
          }));
        }}
        onClose={() => setPriorityFilterVisible(false)}
        onClear={() => setFilters((current) => ({ ...current, priority: [] }))}
      />

      <OptionPickerSheet
        visible={typeFilterVisible}
        title="All Task Categories"
        options={taskTypeOptions}
        multiple
        selectedValues={filters.taskTypeIds}
        onToggle={(value) => {
          setFilters((current) => ({
            ...current,
            taskTypeIds: current.taskTypeIds.includes(value)
              ? current.taskTypeIds.filter((item) => item !== value)
              : [...current.taskTypeIds, value],
          }));
        }}
        onClose={() => setTypeFilterVisible(false)}
        onClear={() => setFilters((current) => ({ ...current, taskTypeIds: [] }))}
      />

      <OptionPickerSheet
        visible={bulkStatusVisible}
        title="Move To"
        options={statusOptions}
        selectedValue={bulkTargetStatus}
        onSelect={setBulkTargetStatus}
        onClose={() => setBulkStatusVisible(false)}
      />

      <DateRangeModal
        visible={dateRangeVisible}
        dueFrom={filters.dueFrom}
        dueTo={filters.dueTo}
        onChange={(field, value) => setFilters((current) => ({ ...current, [field]: value }))}
        onClose={() => setDateRangeVisible(false)}
        onClear={() => setFilters((current) => ({ ...current, dueFrom: '', dueTo: '' }))}
      />

      <ProjectsManagerModal
        visible={projectsModalVisible}
        projects={projects}
        activeProjectId={activeProjectId}
        membersByProject={membersByProject}
        currentUserId={currentUserId}
        projectForm={projectForm}
        creatingProject={creatingProject}
        inviteEmail={inviteEmail}
        inviting={invitingMember}
        onClose={() => setProjectsModalVisible(false)}
        onProjectFormChange={handleProjectFormChange}
        onCreateProject={handleCreateProject}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        onInviteEmailChange={setInviteEmail}
        onInviteMember={handleInviteMember}
        onRemoveMember={handleRemoveMember}
      />
    </>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  topActions: {
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  headerSpacer: {
    flex: 1,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionInfoLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bulkStatusField: {
    minWidth: 110,
    flexGrow: 1,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  inlineSelectMenu: {
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.surfaceSoft,
    marginTop: 2,
  },
  inlineSelectRow: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  inlineSelectRowLast: {
    borderBottomWidth: 0,
  },
  inlineSelectRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  inlineSelectMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineSelectDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    flexShrink: 0,
  },
  inlineSelectLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  inlineSelectLabelSelected: {
    color: theme.colors.text,
  },
  filtersBar: {
    marginBottom: 10,
  },
  filterToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  tasksFilterInput: {
    flex: 1,
    minWidth: '100%',
    maxWidth: '100%',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    color: theme.colors.text,
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  filterField: {
    flex: 1,
    minWidth: '48%',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    marginLeft: 'auto',
  },
  clearAllButtonDisabled: {
    opacity: 0.45,
  },
  clearAllButtonPressed: {
    opacity: 0.7,
  },
  clearAllLabel: {
    color: theme.colors.secondary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loadingWrap: {
    paddingVertical: 12,
  },
  loadingText: {
    color: theme.colors.tertiary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tasksMobileList: {
    paddingBottom: 12,
  },
  tasksMobileGroup: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tasksMobileGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 11,
  },
  tasksMobileGroupAccent: {
    width: 3,
    height: 14,
    borderRadius: 1,
  },
  tasksMobileGroupLabel: {
    flex: 1,
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tasksMobileGroupCount: {
    color: theme.colors.tertiary,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  tasksMobileGroupChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  tasksMobileGroupBody: {
    overflow: 'hidden',
  },
  tasksMobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 15,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  tasksMobileRowSelected: {
    backgroundColor: 'rgba(147, 197, 253, 0.06)',
  },
  tasksMobileRowDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  tasksMobileRowCheck: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    opacity: 0.4,
  },
  tasksMobileRowCheckChecked: {
    opacity: 1,
  },
  tasksMobileRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tasksMobileRowTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  tasksMobileRowDescription: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  tasksMobileRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
  },
  priorityBadgeUrgent: {
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  priorityBadgeHigh: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  priorityBadgeNormal: {
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  priorityBadgeLow: {
    borderColor: 'rgba(156, 163, 175, 0.45)',
  },
  priorityBadgeLabel: {
    fontSize: 7,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  priorityBadgeLabelUrgent: {
    color: '#FECACA',
  },
  priorityBadgeLabelHigh: {
    color: '#FDE68A',
  },
  priorityBadgeLabelNormal: {
    color: '#BFDBFE',
  },
  priorityBadgeLabelLow: {
    color: '#D1D5DB',
  },
  taskTypeMeta: {
    fontSize: 7,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    maxWidth: 64,
  },
  taskDueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderRadius: 999,
  },
  taskSpentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderRadius: 999,
  },
  taskAssigneeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 110,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderRadius: 999,
  },
  metaBadgeLabel: {
    color: theme.colors.muted,
    fontSize: 7,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tasksMobileRowChevron: {
    opacity: 0.35,
    flexShrink: 0,
  },
  tasksMobileAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 4,
    opacity: 0.5,
  },
  tasksMobileAddRowLabel: {
    color: theme.colors.tertiary,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tasksMobileEmpty: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalFooterEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  formSectionLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  linkButton: {
    paddingVertical: 4,
  },
  linkButtonText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  inlineCategoryComposer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDim,
    gap: 12,
  },
  inlineCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  inlineCategoryTitle: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  descImageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  descImageWrap: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    overflow: 'hidden',
  },
  descImage: {
    width: '100%',
    height: '100%',
  },
  descImageRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 9,
  },
  subtaskBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  subtaskBackLabel: {
    color: theme.colors.tertiary,
    fontSize: 11,
    letterSpacing: 0.3,
    maxWidth: 220,
  },
  subtasksPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDim,
    gap: 12,
  },
  subtasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  subtasksHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtasksHeaderLabel: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtaskComposer: {
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    gap: 12,
  },
  subtaskList: {
    gap: 10,
  },
  subtaskEmpty: {
    color: theme.colors.muted,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  subtaskItem: {
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    padding: 10,
    gap: 8,
  },
  subtaskItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtaskItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtaskStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subtaskItemTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  subtaskItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtaskStatusRow: {
    gap: 6,
  },
  typeList: {
    marginTop: 10,
    gap: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.surfaceSoft,
    padding: 10,
  },
  typeRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeRowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  typeRowTextWrap: {
    flex: 1,
    gap: 2,
  },
  typeRowTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  typeRowSubtitle: {
    color: theme.colors.tertiary,
    fontSize: 10,
  },
  emptyTypes: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  settingsSection: {
    gap: 10,
  },
  settingsToggleList: {
    gap: 4,
  },
  settingsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  settingsToggleLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  settingsCheckbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderRadius: 4,
  },
  settingsCheckboxChecked: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  settingsStatusList: {
    gap: 14,
  },
  settingsStatusItem: {
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerNavLink: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
  headerNavLinkActive: {
    color: theme.colors.text,
  },
  headerNavSlash: {
    color: theme.colors.muted,
    fontSize: 10,
  },
  projectHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  projectHeadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  projectHeadingName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  projectHeadingMeta: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  readonlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    paddingVertical: 12,
  },
  readonlyFieldValue: {
    flex: 1,
    color: theme.colors.secondary,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  projectsEmpty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  projectsEmptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  projectsEmptyBody: {
    color: theme.colors.tertiary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  projectsEmptyAction: {
    marginTop: 8,
  },
  projectList: {
    marginTop: 6,
    gap: 8,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  projectRowActive: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
  },
  projectRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  projectRowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  projectRowTextWrap: {
    flex: 1,
    gap: 2,
  },
  projectRowTitle: {
    color: theme.colors.text,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  projectRowSubtitle: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  membersSection: {
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDim,
    gap: 10,
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberTextWrap: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: theme.colors.text,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  memberRole: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  inviteInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    paddingVertical: 4,
    letterSpacing: 0.3,
  },
});
