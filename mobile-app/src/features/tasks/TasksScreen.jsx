import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Calendar,
  Check,
  ChevronRight,
  Clock3,
  Plus,
  SquareCheck,
  Trash2,
  X,
} from 'lucide-react-native';

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
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
  TASK_PRIORITY,
  TASK_STATUS,
} from '../../constants/tasks';
import { tasksApi } from '../../shared/api';
import { theme } from '../../theme';
import { formatShortDate } from '../../utils/date';
import { useToast } from '../../providers/ToastProvider';

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

function normalizeTaskForm(task) {
  if (!task) return DEFAULT_TASK_FORM;

  return {
    title: task.title || '',
    description: task.description || '',
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

function getPriorityBadgeStyle(priority) {
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

function getPriorityBadgeLabelStyle(priority) {
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

function FramelessIconButton({ icon, color = theme.colors.text, onPress, size = 16 }) {
  const Icon = icon;

  return (
    <Pressable hitSlop={10} onPress={onPress} style={styles.iconButton}>
      <Icon color={color} size={size} strokeWidth={1.7} />
    </Pressable>
  );
}

function InlineSelectMenu({
  visible,
  options,
  selectedValue,
  onSelect,
}) {
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
  onToggleGroup,
  selectionMode,
  selectedTaskIds,
  onToggleSelect,
  onOpenTask,
  onLongPressTask,
  onOpenCreateForStatus,
}) {
  return (
    <View style={styles.tasksMobileList}>
      {STATUS_ORDER.map((status) => {
        const items = boardByStatus[status] || [];
        const isExpanded = !collapsedGroups[status];
        const accentColor = STATUS_META[status]?.color || '#94a3b8';

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
                    const spentMinutes = task.total_spent_time_minutes ?? 0;
                    const isSelected = selectedTaskIds.has(task.id);

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

                        <Text numberOfLines={1} style={styles.tasksMobileRowTitle}>
                          {task.title}
                        </Text>

                        <View style={styles.tasksMobileRowMeta}>
                          {taskType ? (
                            <Text
                              numberOfLines={1}
                              style={[styles.taskTypeMeta, { color: taskType.color || theme.colors.info }]}
                            >
                              {taskType.name}
                            </Text>
                          ) : null}
                          <View style={[styles.priorityBadge, getPriorityBadgeStyle(task.priority)]}>
                            <Text
                              style={[
                                styles.priorityBadgeLabel,
                                getPriorityBadgeLabelStyle(task.priority),
                              ]}
                            >
                              {priorityMeta.label}
                            </Text>
                          </View>
                          {due ? (
                            <View style={styles.taskDueDate}>
                              <Calendar color={theme.colors.muted} size={8} strokeWidth={1.8} />
                              <Text style={styles.metaBadgeLabel}>{due}</Text>
                            </View>
                          ) : null}
                          {task.status === TASK_STATUS.COMPLETED && spentMinutes > 0 ? (
                            <View style={styles.taskSpentBadge}>
                              <Clock3 color={theme.colors.muted} size={8} strokeWidth={1.8} />
                              <Text style={styles.metaBadgeLabel}>{formatSpentTime(spentMinutes)}</Text>
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
  form,
  loading,
  autosaving,
  taskTypes,
  inlineTypeForm,
  inlineTypeVisible,
  inlineTypeLoading,
  onChange,
  onInlineTypeChange,
  onShowInlineType,
  onHideInlineType,
  onCreateInlineType,
  onClose,
  onCreate,
  onDelete,
}) {
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

  return (
    <>
      <ModalSheet
        visible={visible}
        title={isEditing ? 'Edit Task' : 'Create Task'}
        onClose={onClose}
        headerActions={(
          <View style={styles.modalHeaderActions}>
            {autosaving ? (
              <ActivityIndicator color={theme.colors.tertiary} size="small" />
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
        <TextField
          label="Title"
          placeholder="Task title"
          value={form.title}
          onChangeText={(value) => onChange('title', value)}
        />
        <TextField
          label="Description"
          placeholder="Task description"
          value={form.description}
          onChangeText={(value) => onChange('description', value)}
          multiline
        />

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

function DateRangeModal({ visible, dueFrom, dueTo, onChange, onClose, onClear }) {
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

export default function TasksScreen({ routeOpenTaskId = '', routeOpenTaskAt = '' } = {}) {
  const addToast = useToast();
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkTargetStatus, setBulkTargetStatus] = useState(TASK_STATUS.IN_PROGRESS);
  const [collapsedGroups, setCollapsedGroups] = useState({});
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
      const [fetchedTasks, fetchedTypes] = await Promise.all([
        tasksApi.getTasks(),
        tasksApi.getTaskTypes(),
      ]);
      setTasks(fetchedTasks);
      setTaskTypes(fetchedTypes);
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

  const filteredTasks = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();

    return tasks.filter((task) => {
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
  }, [filters, tasks]);

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

  const openCreateTask = useCallback((status = TASK_STATUS.TO_DO) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setEditingTask(null);
    setTaskForm({ ...DEFAULT_TASK_FORM, status });
    setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
    setInlineTypeVisible(false);
    setAutosavingTask(false);
    lastSavedFingerprintRef.current = '';
    setTaskModalVisible(true);
  }, []);

  const openTask = useCallback((task) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    const normalizedForm = normalizeTaskForm(task);
    setEditingTask(task);
    setTaskForm(normalizedForm);
    setInlineTypeForm(DEFAULT_TASK_TYPE_FORM);
    setInlineTypeVisible(false);
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
      const createdTask = await tasksApi.createTask({
        title: taskForm.title.trim(),
        description: taskForm.description || null,
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
  }, [addToast, closeTaskModal, creatingTask, taskForm]);

  const handleDeleteTask = useCallback(() => {
    if (!editingTask) return;

    Alert.alert(
      'Delete task?',
      `This will remove "${editingTask.title}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tasksApi.deleteTasksBulk({ task_ids: [editingTask.id] });
              setTasks((current) => current.filter((task) => task.id !== editingTask.id));
              addToast('Task deleted.');
              closeTaskModal();
            } catch (error) {
              console.error('Failed to delete task', error);
              addToast(error?.message || 'Failed to delete task.', 'error');
            }
          },
        },
      ]
    );
  }, [addToast, closeTaskModal, editingTask]);

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

  const handleDeleteType = useCallback((type) => {
    Alert.alert(
      'Delete task category?',
      `This will remove "${type.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ]
    );
  }, [addToast, taskForm.task_type_id]);

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

  const handleBulkDelete = useCallback(() => {
    if (selectedTaskIds.length === 0) return;

    Alert.alert(
      'Delete selected tasks?',
      `This will remove ${selectedTaskIds.length} tasks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tasksApi.deleteTasksBulk({ task_ids: selectedTaskIds });
              setTasks((current) => current.filter((task) => !selectedTaskIdSet.has(task.id)));
              addToast('Tasks deleted.');
              exitSelectionMode();
            } catch (error) {
              console.error('Failed to delete tasks', error);
              addToast(error?.message || 'Failed to delete tasks.', 'error');
            }
          },
        },
      ]
    );
  }, [addToast, exitSelectionMode, selectedTaskIdSet, selectedTaskIds]);

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

  return (
    <>
      <ScreenShell
        title="Tasks"
        showPageHeader={false}
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
              <ActionButton label="New Task" onPress={() => openCreateTask()} />
              <ActionButton
                label="Categories"
                variant="ghost"
                onPress={openTypeManager}
              />
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
        ) : (
          <TasksMobileList
            boardByStatus={boardByStatus}
            taskTypeById={taskTypeById}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            selectionMode={selectionMode}
            selectedTaskIds={selectedTaskIdSet}
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
        form={taskForm}
        loading={creatingTask}
        autosaving={autosavingTask}
        taskTypes={taskTypes}
        inlineTypeForm={inlineTypeForm}
        inlineTypeVisible={inlineTypeVisible}
        inlineTypeLoading={creatingInlineType}
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
    </>
  );
}

const styles = StyleSheet.create({
  topActions: {
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
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
  tasksMobileRowTitle: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.1,
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
});
