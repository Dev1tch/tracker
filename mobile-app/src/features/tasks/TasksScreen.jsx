import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Plus, X } from 'lucide-react-native';

import ActionButton from '../../components/ActionButton';
import DateTimeField from '../../components/DateTimeField';
import InlinePickerField from '../../components/InlinePickerField';
import ModalSheet from '../../components/ModalSheet';
import OptionPickerSheet from '../../components/OptionPickerSheet';
import ScreenShell from '../../components/ScreenShell';
import SectionCard from '../../components/SectionCard';
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

function SegmentOption({ label, active, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentOption,
        active ? { backgroundColor: color, borderColor: color } : null,
      ]}
    >
      <Text style={[styles.segmentOptionLabel, active && styles.segmentOptionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TaskTypePill({ type, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.typePill,
        active && styles.typePillActive,
      ]}
    >
      <View style={[styles.typePillDot, { backgroundColor: type?.color || theme.colors.accent }]} />
      <Text style={[styles.typePillLabel, active && styles.typePillLabelActive]}>
        {type?.name || 'None'}
      </Text>
    </Pressable>
  );
}

function TaskFormModal({
  visible,
  title,
  taskTypes,
  form,
  loading,
  onChange,
  onClose,
  onSave,
  onDelete,
  onOpenTypes,
}) {
  return (
    <ModalSheet
      visible={visible}
      title={title}
      subtitle="The mobile version keeps the same task model while simplifying the touch workflow."
      onClose={onClose}
      footer={(
        <View style={styles.modalFooter}>
          <View style={styles.modalFooterLeft}>
            {onDelete ? (
              <ActionButton
                label="Delete"
                variant="ghost"
                icon="trash-outline"
                onPress={onDelete}
              />
            ) : null}
            <ActionButton
              label="Categories"
              variant="ghost"
              icon="pricetags-outline"
              onPress={onOpenTypes}
            />
          </View>
          <ActionButton
            label={loading ? 'Saving...' : 'Save task'}
            icon="checkmark"
            onPress={onSave}
            disabled={loading || !form.title.trim()}
          />
        </View>
      )}
    >
      <TextField
        label="Title"
        placeholder="Ship mobile tracker"
        value={form.title}
        onChangeText={(value) => onChange('title', value)}
      />
      <TextField
        label="Description"
        placeholder="Add more detail if you need it"
        value={form.description}
        onChangeText={(value) => onChange('description', value)}
        multiline
      />

      <View style={styles.formSection}>
        <Text style={styles.formSectionLabel}>Status</Text>
        <View style={styles.inlineWrap}>
          {STATUS_ORDER.map((status) => (
            <SegmentOption
              key={status}
              label={STATUS_META[status].label}
              color={STATUS_META[status].color}
              active={form.status === status}
              onPress={() => onChange('status', status)}
            />
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formSectionLabel}>Priority</Text>
        <View style={styles.inlineWrap}>
          {PRIORITY_ORDER.map((priority) => (
            <SegmentOption
              key={priority}
              label={PRIORITY_META[priority].label}
              color={PRIORITY_META[priority].color}
              active={form.priority === priority}
              onPress={() => onChange('priority', priority)}
            />
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formSectionLabel}>Task Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.inlineWrap}>
            <TaskTypePill
              type={null}
              active={!form.task_type_id}
              onPress={() => onChange('task_type_id', '')}
            />
            {taskTypes.map((type) => (
              <TaskTypePill
                key={type.id}
                type={type}
                active={form.task_type_id === type.id}
                onPress={() => onChange('task_type_id', type.id)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <DateTimeField
        label="Due Date"
        value={form.due_date}
        onChange={(value) => onChange('due_date', value)}
      />
    </ModalSheet>
  );
}

function TaskTypeManagerModal({
  visible,
  taskTypes,
  form,
  loading,
  onChange,
  onClose,
  onEdit,
  onSave,
  onDelete,
}) {
  return (
    <ModalSheet
      visible={visible}
      title="Task Categories"
      subtitle="Reuse the task type backend and keep color-coded grouping on mobile."
      onClose={onClose}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton
            label={loading ? 'Saving...' : (form.id ? 'Update' : 'Create')}
            icon={form.id ? 'checkmark' : 'add'}
            onPress={onSave}
            disabled={loading || !form.name.trim()}
          />
        </View>
      )}
    >
      <TextField
        label={form.id ? 'Edit Category' : 'New Category'}
        placeholder="Design"
        value={form.name}
        onChangeText={(value) => onChange('name', value)}
      />
      <TextField
        label="Description"
        placeholder="Optional"
        value={form.description}
        onChangeText={(value) => onChange('description', value)}
        multiline
      />
      <TextField
        label="Color"
        placeholder="#60a5fa"
        autoCapitalize="none"
        value={form.color}
        onChangeText={(value) => onChange('color', value)}
      />

      <View style={styles.typeList}>
        {taskTypes.map((type) => (
          <View key={type.id} style={styles.typeRow}>
            <Pressable onPress={() => onEdit(type)} style={styles.typeRowMain}>
              <View style={[styles.typeRowDot, { backgroundColor: type.color || theme.colors.accent }]} />
              <View style={styles.typeRowTextWrap}>
                <Text style={styles.typeRowTitle}>{type.name}</Text>
                <Text style={styles.typeRowSubtitle}>{type.description || type.color || 'No description'}</Text>
              </View>
            </Pressable>
            <ActionButton
              label=""
              compact
              variant="ghost"
              icon="trash-outline"
              onPress={() => onDelete(type)}
            />
          </View>
        ))}
      </View>
    </ModalSheet>
  );
}

function DateRangeModal({ visible, dueFrom, dueTo, onChange, onClose, onClear }) {
  return (
    <ModalSheet
      visible={visible}
      title="Due Date Range"
      subtitle="Filter tasks by due date."
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
      />
      <DateTimeField
        label="Due To"
        value={dueTo}
        onChange={(value) => onChange('dueTo', value)}
      />
    </ModalSheet>
  );
}

export default function TasksScreen() {
  const addToast = useToast();
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [statusFilterVisible, setStatusFilterVisible] = useState(false);
  const [priorityFilterVisible, setPriorityFilterVisible] = useState(false);
  const [typeFilterVisible, setTypeFilterVisible] = useState(false);
  const [dateRangeVisible, setDateRangeVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM);
  const [typeForm, setTypeForm] = useState(DEFAULT_TASK_TYPE_FORM);
  const [collapsedGroups, setCollapsedGroups] = useState({});

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

  const boardByStatus = useMemo(() => {
    return STATUS_ORDER.reduce((groups, status) => {
      groups[status] = filteredTasks
        .filter((task) => task.status === status)
        .sort((left, right) => {
          const leftDue = new Date(left.due_date || 0).getTime();
          const rightDue = new Date(right.due_date || 0).getTime();
          return leftDue - rightDue;
        });
      return groups;
    }, {});
  }, [filteredTasks]);

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };
      STATUS_ORDER.forEach((status) => {
        if (typeof next[status] !== 'boolean') {
          next[status] = (
            (boardByStatus[status] || []).length === 0
            || status === TASK_STATUS.COMPLETED
            || status === TASK_STATUS.CANCELLED
            || status === TASK_STATUS.ARCHIVED
          );
        }
      });
      return next;
    });
  }, [boardByStatus]);

  const toggleGroup = useCallback((status) => {
    setCollapsedGroups((current) => ({ ...current, [status]: !current[status] }));
  }, []);

  const openCreateTask = (status = TASK_STATUS.TO_DO) => {
    setEditingTask(null);
    setTaskForm({ ...DEFAULT_TASK_FORM, status });
    setTaskModalVisible(true);
  };

  const openTask = (task) => {
    setEditingTask(task);
    setTaskForm(normalizeTaskForm(task));
    setTaskModalVisible(true);
  };

  const handleSaveTask = async () => {
    setSavingTask(true);

    try {
      if (editingTask) {
        const payload = buildTaskPayload(editingTask, taskForm);
        await tasksApi.updateTask(editingTask.id, payload);
        addToast('Task updated.');
      } else {
        await tasksApi.createTask({
          title: taskForm.title.trim(),
          description: taskForm.description || null,
          task_type_id: taskForm.task_type_id || null,
          parent_task_id: null,
          status: taskForm.status,
          priority: taskForm.priority,
          due_date: taskForm.due_date || null,
          start_date: null,
        });
        addToast('Task created.');
      }

      setTaskModalVisible(false);
      loadData({ silent: true });
    } catch (error) {
      console.error('Failed to save task', error);
      addToast(error?.message || 'Failed to save task.', 'error');
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = () => {
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
              addToast('Task deleted.');
              setTaskModalVisible(false);
              loadData({ silent: true });
            } catch (error) {
              console.error('Failed to delete task', error);
              addToast(error?.message || 'Failed to delete task.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleQuickStatusUpdate = async (task, status) => {
    try {
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, status } : item))
      );
      await tasksApi.updateTasksBulkStatus({ task_ids: [task.id], status });
      addToast(`Moved to ${STATUS_META[status].label}.`);
      loadData({ silent: true });
    } catch (error) {
      console.error('Failed to update task status', error);
      addToast(error?.message || 'Failed to update task status.', 'error');
      loadData({ silent: true });
    }
  };

  const handleSaveType = async () => {
    setSavingType(true);

    try {
      if (typeForm.id) {
        addToast('Task categories can be created or removed here. Editing existing ones stays on the web for now.', 'warning');
      } else {
        await tasksApi.createTaskType({
          name: typeForm.name.trim(),
          description: typeForm.description || null,
          color: typeForm.color || '#60a5fa',
          is_active: true,
        });
        addToast('Task category created.');
      }

      setTypeForm(DEFAULT_TASK_TYPE_FORM);
      loadData({ silent: true });
    } catch (error) {
      console.error('Failed to save task category', error);
      addToast(error?.message || 'Failed to save task category.', 'error');
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = (type) => {
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
              addToast('Task category deleted.');
              setFilters((current) => ({
                ...current,
                taskTypeIds: current.taskTypeIds.filter((value) => value !== String(type.id)),
              }));
              loadData({ silent: true });
            } catch (error) {
              console.error('Failed to delete task category', error);
              addToast(error?.message || 'Failed to delete task category.', 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <ScreenShell
        title="Tasks"
        subtitle="Status-grouped mobile board aligned with the web list view."
        showPageHeader={false}
        refreshControl={(
          <RefreshControl
            tintColor={theme.colors.text}
            refreshing={refreshing}
            onRefresh={() => loadData({ silent: true })}
          />
        )}
      >
        <View style={styles.flowHeader}>
          <View style={styles.flowHeaderText}>
            <Text style={styles.flowTitle}>Tasks Flow</Text>
            <Text style={styles.flowSubtitle}>
              Status-grouped mobile board with the same task backend and task-type model.
            </Text>
          </View>

          <View style={styles.headerActions}>
            <ActionButton label="New Task" onPress={() => openCreateTask()} />
            <ActionButton
              label="Categories"
              variant="ghost"
              onPress={() => setTypeModalVisible(true)}
            />
          </View>
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
              <X size={12} color={theme.colors.tertiary} strokeWidth={1.5} />
              <Text style={styles.clearAllLabel}>
                {activeFiltersCount > 0 ? `Clear All (${activeFiltersCount})` : 'Clear All'}
              </Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <SectionCard>
            <Text style={styles.loadingText}>Loading tasks…</Text>
          </SectionCard>
        ) : null}

        {!loading && STATUS_ORDER.map((status) => {
          const items = boardByStatus[status] || [];
          const isExpanded = !collapsedGroups[status];

          return (
            <SectionCard key={status} style={styles.groupCard}>
              <Pressable onPress={() => toggleGroup(status)} style={styles.groupHeader}>
                <View style={[styles.groupAccent, { backgroundColor: STATUS_META[status].color }]} />
                <Text style={styles.groupTitle}>{STATUS_META[status].label}</Text>
                <Text style={styles.groupCount}>{items.length}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-forward' : 'chevron-forward'}
                  size={12}
                  color={theme.colors.tertiary}
                  style={[styles.groupChevron, isExpanded ? styles.groupChevronExpanded : null]}
                />
              </Pressable>

              {isExpanded ? (
                <View style={styles.groupBody}>
                  {items.length === 0 ? (
                    <Text style={styles.emptyGroup}>No tasks</Text>
                  ) : (
                    <>
                      {items.map((task) => {
                        const taskType = taskTypes.find((type) => type.id === task.task_type_id);
                        const nextStatus = STATUS_ORDER[Math.min(STATUS_ORDER.indexOf(task.status) + 1, STATUS_ORDER.length - 1)];

                        return (
                          <Pressable
                            key={task.id}
                            onPress={() => openTask(task)}
                            onLongPress={() => {
                              if (task.status !== nextStatus) {
                                handleQuickStatusUpdate(task, nextStatus);
                              }
                            }}
                            style={styles.taskRow}
                          >
                            <View style={[styles.taskRowDot, { backgroundColor: STATUS_META[task.status]?.color || theme.colors.tertiary }]} />
                            <View style={styles.taskMain}>
                              <Text style={styles.taskTitle} numberOfLines={1}>
                                {task.title}
                              </Text>
                              <View style={styles.taskMetaRow}>
                                {taskType ? (
                                  <Text style={[styles.metaInline, { color: taskType.color || theme.colors.info }]}>
                                    {taskType.name}
                                  </Text>
                                ) : null}
                                <Text style={styles.metaBadge}>
                                  {PRIORITY_META[task.priority]?.label || task.priority}
                                </Text>
                                {task.due_date ? (
                                  <Text style={styles.metaBadge}>{formatShortDate(task.due_date)}</Text>
                                ) : null}
                                {task.status === TASK_STATUS.COMPLETED && task.total_spent_time_minutes > 0 ? (
                                  <Text style={styles.metaBadge}>
                                    {formatSpentTime(task.total_spent_time_minutes)}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={12}
                              color={theme.colors.tertiary}
                              style={styles.taskChevron}
                            />
                          </Pressable>
                        );
                      })}

                      <Pressable style={styles.addRow} onPress={() => openCreateTask(status)}>
                        <Plus size={10} color={theme.colors.tertiary} strokeWidth={1.5} />
                        <Text style={styles.addRowLabel}>Add</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : null}
            </SectionCard>
          );
        })}
      </ScreenShell>

      <TaskFormModal
        visible={taskModalVisible}
        title={editingTask ? 'Edit Task' : 'Create Task'}
        taskTypes={taskTypes}
        form={taskForm}
        loading={savingTask}
        onChange={(field, value) => setTaskForm((current) => ({ ...current, [field]: value }))}
        onClose={() => setTaskModalVisible(false)}
        onSave={handleSaveTask}
        onDelete={editingTask ? handleDeleteTask : null}
        onOpenTypes={() => setTypeModalVisible(true)}
      />

      <TaskTypeManagerModal
        visible={typeModalVisible}
        taskTypes={taskTypes}
        form={typeForm}
        loading={savingType}
        onChange={(field, value) => setTypeForm((current) => ({ ...current, [field]: value }))}
        onClose={() => setTypeModalVisible(false)}
        onEdit={(type) => setTypeForm({
          id: type.id,
          name: type.name || '',
          description: type.description || '',
          color: type.color || '#60a5fa',
          is_active: type.is_active ?? true,
        })}
        onSave={handleSaveType}
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
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  flowHeaderText: {
    flex: 1,
    minWidth: 220,
  },
  flowTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  flowSubtitle: {
    marginTop: 6,
    color: theme.colors.secondary,
    fontSize: 11,
    lineHeight: 17,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
    marginLeft: 'auto',
  },
  filtersBar: {
    marginBottom: 14,
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
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loadingText: {
    color: theme.colors.tertiary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  groupCard: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  groupAccent: {
    width: 3,
    height: 14,
    borderRadius: 1,
  },
  groupTitle: {
    flex: 1,
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  groupCount: {
    color: theme.colors.tertiary,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  groupChevron: {
    transform: [{ rotate: '0deg' }],
  },
  groupChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  groupBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingLeft: 15,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  taskRowDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  taskMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  taskTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  taskMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  metaInline: {
    fontSize: 7,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metaBadge: {
    color: theme.colors.secondary,
    fontSize: 7,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  taskChevron: {
    opacity: 0.4,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  addRowLabel: {
    color: theme.colors.tertiary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyGroup: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  segmentOption: {
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  segmentOptionLabel: {
    color: theme.colors.secondary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  segmentOptionLabelActive: {
    color: theme.colors.background,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typePillActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  typePillDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  typePillLabel: {
    color: theme.colors.secondary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  typePillLabelActive: {
    color: theme.colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalFooterEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  modalFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formSection: {
    gap: 12,
    marginTop: 4,
  },
  formSectionLabel: {
    color: theme.colors.tertiary,
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
});
