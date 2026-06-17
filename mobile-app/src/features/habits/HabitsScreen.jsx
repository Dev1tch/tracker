import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from 'lucide-react-native';

import ActionButton from '../../components/ActionButton';
import ColorField from '../../components/ColorField';
import InlinePickerField from '../../components/InlinePickerField';
import ModalSheet from '../../components/ModalSheet';
import OptionPickerSheet from '../../components/OptionPickerSheet';
import ScreenShell from '../../components/ScreenShell';
import SectionCard from '../../components/SectionCard';
import TextField from '../../components/TextField';
import { categoriesApi, habitsApi, logsApi } from '../../shared/api';
import { useTheme } from '../../theme';
import { addDays, formatFullDate, formatWeekday, toLocalDateKey } from '../../utils/date';
import { useToast } from '../../providers/ToastProvider';

const PRIORITY_OPTIONS = ['Normal', 'Medium', 'High'];
const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Sort A-Z' },
  { value: 'priority_desc', label: 'Priority: High to Low' },
  { value: 'priority_asc', label: 'Priority: Low to High' },
];
const CATEGORY_COLOR_PRESETS = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#f97316',
];

const EMPTY_HABIT_FORM = {
  name: '',
  description: '',
  priority: 'Normal',
  category_id: '',
};

const EMPTY_CATEGORY_FORM = {
  id: null,
  name: '',
  color: '#60a5fa',
};

function getDisplayDates(anchorDate) {
  const dates = [];
  for (let index = 6; index >= 0; index -= 1) {
    dates.push(addDays(anchorDate, -index));
  }
  return dates;
}

function getHeaderLabel(displayDates) {
  const firstDay = displayDates[0];
  const lastDay = displayDates[displayDates.length - 1];
  const startMonth = firstDay.toLocaleString('default', { month: 'short' });
  const endMonth = lastDay.toLocaleString('default', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${firstDay.getDate()} - ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
  }

  const endYear = firstDay.getFullYear() !== lastDay.getFullYear()
    ? ` ${lastDay.getFullYear()}`
    : '';

  return `${startMonth} ${firstDay.getDate()} - ${endMonth} ${lastDay.getDate()}${endYear}, ${firstDay.getFullYear()}`;
}

function getPriorityRank(priority) {
  if (priority === 'High') return 3;
  if (priority === 'Medium') return 2;
  return 1;
}

function buildLogsIndex(items = []) {
  const index = {};

  items.forEach((habit) => {
    index[habit.id] = {};
    (habit.logs || []).forEach((log) => {
      const dateKey = toLocalDateKey(log.date);
      if (dateKey) {
        index[habit.id][dateKey] = log;
      }
    });
  });

  return index;
}

function HabitStatusPill({ label, active, color, onPress }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentPill,
        active && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text style={[styles.segmentPillLabel, active && styles.segmentPillLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function getCategoryLabel(categoryId, categories) {
  if (!categoryId) return 'No category';

  return categories.find((category) => String(category.id) === String(categoryId))?.name || '';
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

function HabitFormModal({
  visible,
  categories,
  form,
  loading,
  categoryDraft,
  categoryDraftVisible,
  categorySaving,
  title,
  onChange,
  onCategoryDraftChange,
  onClose,
  onCreateCategory,
  onHideCreateCategory,
  onSave,
  onShowCreateCategory,
  onDelete,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activePicker, setActivePicker] = useState('');
  const priorityOptions = useMemo(
    () => PRIORITY_OPTIONS.map((priority) => ({
      value: priority,
      label: priority,
      color: priority === 'High'
        ? theme.colors.danger
        : priority === 'Medium'
          ? theme.colors.warning
          : theme.colors.text,
    })),
    [theme]
  );
  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'No category' },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
        color: category.color,
      })),
    ],
    [categories]
  );

  useEffect(() => {
    if (!visible) {
      setActivePicker('');
    }
  }, [visible]);

  return (
    <ModalSheet
      visible={visible}
      title={title}
      onClose={onClose}
      headerActions={onDelete ? (
        <Pressable hitSlop={10} onPress={onDelete} style={styles.modalHeaderIconButton}>
          <Trash2 size={18} color={theme.colors.danger} strokeWidth={1.7} />
        </Pressable>
      ) : null}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton
            label={loading ? 'Saving...' : 'Save habit'}
            icon="checkmark"
            onPress={onSave}
            disabled={loading || !form.name.trim()}
          />
        </View>
      )}
    >
      <TextField
        label="Habit Name"
        placeholder="Read for 30 minutes"
        value={form.name}
        onChangeText={(value) => onChange('name', value)}
      />
      <TextField
        label="Description"
        placeholder="Optional details or motivation"
        value={form.description}
        onChangeText={(value) => onChange('description', value)}
        multiline
      />

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Priority</Text>
        <InlinePickerField
          placeholder="Select priority"
          valueLabel={form.priority || ''}
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

      <View style={styles.formFieldGroup}>
        <View style={styles.formSectionHeader}>
          <Text style={styles.formSectionLabel}>Category</Text>
          <Pressable
            onPress={() => {
              setActivePicker('');
              onShowCreateCategory();
            }}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>+ New Category</Text>
          </Pressable>
        </View>
        <InlinePickerField
          placeholder="Select category"
          valueLabel={getCategoryLabel(form.category_id, categories)}
          onPress={() => setActivePicker((current) => (current === 'category' ? '' : 'category'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'category'}
          options={categoryOptions}
          selectedValue={form.category_id || ''}
          onSelect={(value) => {
            onChange('category_id', value);
            setActivePicker('');
          }}
        />
        {categoryDraftVisible ? (
          <View style={styles.inlineCategoryComposer}>
            <View style={styles.inlineCategoryHeader}>
              <Text style={styles.inlineCategoryTitle}>Create New Category</Text>
              <Pressable
                onPress={() => {
                  setActivePicker('');
                  onHideCreateCategory();
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkButtonText}>Hide</Text>
              </Pressable>
            </View>
            <TextField
              label="Category Name"
              placeholder="Health"
              value={categoryDraft.name}
              onChangeText={(value) => onCategoryDraftChange('name', value)}
            />
            <ColorField
              label="Category Color"
              value={categoryDraft.color}
              onChange={(value) => onCategoryDraftChange('color', value)}
              presetColors={CATEGORY_COLOR_PRESETS}
            />
            <View style={styles.modalFooterEnd}>
              <ActionButton
                label={categorySaving ? 'Saving...' : 'Save category'}
                icon="checkmark"
                onPress={onCreateCategory}
                disabled={categorySaving || !categoryDraft.name.trim()}
              />
            </View>
          </View>
        ) : null}
      </View>
    </ModalSheet>
  );
}

function CategoryManagerModal({
  visible,
  categories,
  form,
  loading,
  onChange,
  onClose,
  onEdit,
  onSave,
  onDelete,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ModalSheet
      visible={visible}
      title="Habit Categories"
      subtitle="Organize the same category model used on the web app."
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
        placeholder="Health"
        value={form.name}
        onChangeText={(value) => onChange('name', value)}
      />
      <ColorField
        label="Category Color"
        value={form.color}
        onChange={(value) => onChange('color', value)}
        presetColors={CATEGORY_COLOR_PRESETS}
      />

      <View style={styles.categoryList}>
        {categories.map((category) => (
          <View key={category.id} style={styles.categoryRow}>
            <Pressable onPress={() => onEdit(category)} style={styles.categoryRowMain}>
              <View style={[styles.categoryRowDot, { backgroundColor: category.color || '#ffffff' }]} />
              <View style={styles.categoryRowTextWrap}>
                <Text style={styles.categoryRowTitle}>{category.name}</Text>
                <Text style={styles.categoryRowSubtitle}>{category.color || 'No color'}</Text>
              </View>
            </Pressable>
            <ActionButton
              label=""
              icon="trash-outline"
              variant="ghost"
              compact
              onPress={() => onDelete(category)}
            />
          </View>
        ))}
      </View>
    </ModalSheet>
  );
}

function LogModal({
  visible,
  date,
  habit,
  form,
  loading,
  onChange,
  onClose,
  onSave,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ModalSheet
      visible={visible}
      title={habit?.name || 'Daily log'}
      subtitle={date ? formatFullDate(date) : 'Choose how the habit went today.'}
      onClose={onClose}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton
            label={loading ? 'Saving...' : 'Save log'}
            icon="checkmark"
            onPress={onSave}
            disabled={loading || !form.status}
          />
        </View>
      )}
    >
      <View style={styles.formSection}>
        <Text style={styles.formSectionLabel}>Status</Text>
        <View style={styles.inlineWrap}>
          <HabitStatusPill
            label="Successful"
            color={theme.colors.success}
            active={form.status === 'completed'}
            onPress={() => onChange('status', 'completed')}
          />
          <HabitStatusPill
            label="Unsuccessful"
            color={theme.colors.danger}
            active={form.status === 'failed'}
            onPress={() => onChange('status', 'failed')}
          />
        </View>
      </View>
      <TextField
        label="Notes"
        placeholder="Why did it go well or badly?"
        value={form.comment}
        onChangeText={(value) => onChange('comment', value)}
        multiline
      />
    </ModalSheet>
  );
}

export default function HabitsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const addToast = useToast();
  const [habits, setHabits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [logs, setLogs] = useState({});
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingHabit, setSavingHabit] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingInlineCategory, setSavingInlineCategory] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [habitFormVisible, setHabitFormVisible] = useState(false);
  const [categoryManagerVisible, setCategoryManagerVisible] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [habitForm, setHabitForm] = useState(EMPTY_HABIT_FORM);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [inlineCategoryForm, setInlineCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [logForm, setLogForm] = useState({ status: '', comment: '' });
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isInlineCategoryVisible, setIsInlineCategoryVisible] = useState(false);
  const [isDateJumpOpen, setIsDateJumpOpen] = useState(false);

  const displayDates = useMemo(() => getDisplayDates(currentDisplayDate), [currentDisplayDate]);
  const rangeLabel = useMemo(() => getHeaderLabel(displayDates), [displayDates]);
  const isViewingTodayWindow = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    return displayDates.some((date) => toLocalDateKey(date) === todayKey);
  }, [displayDates]);

  const filteredHabits = useMemo(() => {
    return habits
      .filter((habit) => {
        const matchesSearch = habit.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
        const matchesCategory = !filterCategory || habit.category_id === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((left, right) => {
        if (sortBy === 'priority_desc') {
          return getPriorityRank(right.priority) - getPriorityRank(left.priority);
        }
        if (sortBy === 'priority_asc') {
          return getPriorityRank(left.priority) - getPriorityRank(right.priority);
        }
        return left.name.localeCompare(right.name);
      });
  }, [filterCategory, habits, searchQuery, sortBy]);

  const selectedCategoryLabel = useMemo(() => {
    if (!filterCategory) return '';
    return categories.find((category) => category.id === filterCategory)?.name || '';
  }, [categories, filterCategory]);

  const selectedSortLabel = useMemo(
    () => SORT_OPTIONS.find((option) => option.value === sortBy)?.label || '',
    [sortBy]
  );

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const startDateStr = toLocalDateKey(displayDates[0]);
      const endDateStr = toLocalDateKey(displayDates[displayDates.length - 1]);

      const [timeframeData, fetchedCategories] = await Promise.all([
        logsApi.getTimeframeLogs({
          start_date: startDateStr,
          end_date: endDateStr,
        }),
        categoriesApi.getCategories(),
      ]);

      setHabits(timeframeData);
      setCategories(fetchedCategories);
      setLogs(buildLogsIndex(timeframeData));
    } catch (error) {
      console.error('Failed to load habits', error);
      addToast(error?.message || 'Failed to load habits.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast, displayDates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateHabit = () => {
    setEditingHabit(null);
    setHabitForm({
      ...EMPTY_HABIT_FORM,
      category_id: filterCategory || '',
    });
    setInlineCategoryForm(EMPTY_CATEGORY_FORM);
    setIsInlineCategoryVisible(false);
    setHabitFormVisible(true);
  };

  const openEditHabit = (habit) => {
    setEditingHabit(habit);
    setHabitForm({
      name: habit.name || '',
      description: habit.description || '',
      priority: habit.priority || 'Normal',
      category_id: habit.category_id || '',
    });
    setInlineCategoryForm(EMPTY_CATEGORY_FORM);
    setIsInlineCategoryVisible(false);
    setHabitFormVisible(true);
  };

  const openLog = (habit, date) => {
    const dateKey = toLocalDateKey(date);
    const existingLog = logs[habit.id]?.[dateKey];

    setSelectedHabit(habit);
    setSelectedDate(date);
    setLogForm({
      status: existingLog
        ? (existingLog.is_successful ? 'completed' : 'failed')
        : '',
      comment: existingLog?.comment || '',
    });
    setLogVisible(true);
  };

  const handleToggleToday = async (habit) => {
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const existingLog = logs[habit.id]?.[todayKey];
    const nextSuccessful = !(existingLog?.is_successful ?? false);

    setLogs((current) => ({
      ...current,
      [habit.id]: {
        ...(current[habit.id] || {}),
        [todayKey]: {
          ...(existingLog || {}),
          id: existingLog?.id || `temp-${todayKey}`,
          habit_id: habit.id,
          date: todayKey,
          is_successful: nextSuccessful,
          comment: existingLog?.comment || '',
        },
      },
    }));

    try {
      const savedLog = existingLog
        ? await logsApi.updateLog(existingLog.id, { is_successful: nextSuccessful })
        : await logsApi.createLog({
            habit_id: habit.id,
            date: todayKey,
            is_successful: true,
            comment: '',
          });

      setLogs((current) => ({
        ...current,
        [habit.id]: {
          ...(current[habit.id] || {}),
          [todayKey]: savedLog,
        },
      }));
      addToast(nextSuccessful ? 'Marked complete for today.' : 'Marked incomplete.');
    } catch (error) {
      console.error('Failed to toggle habit', error);
      addToast(error?.message || 'Failed to update habit status.', 'error');
      fetchData({ silent: true });
    }
  };

  const handleSaveHabit = async () => {
    setSavingHabit(true);

    try {
      if (editingHabit) {
        await habitsApi.updateHabit(editingHabit.id, {
          ...habitForm,
          category_id: habitForm.category_id || null,
        });
        addToast('Habit updated.');
      } else {
        await habitsApi.createHabit({
          ...habitForm,
          category_id: habitForm.category_id || null,
          is_active: true,
        });
        addToast('Habit created.');
      }

      setHabitFormVisible(false);
      fetchData({ silent: true });
    } catch (error) {
      console.error('Failed to save habit', error);
      addToast(error?.message || 'Failed to save habit.', 'error');
    } finally {
      setSavingHabit(false);
    }
  };

  const confirmDeleteHabit = useCallback((habit) => {
    Alert.alert(
      'Delete habit?',
      `This will remove "${habit.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Soft-archive (matches web): keeps the habit + its history recoverable
              // instead of permanently deleting. getTimeframeLogs only returns active habits.
              await habitsApi.updateHabit(habit.id, { is_active: false });
              addToast('Habit deleted.');
              setHabitFormVisible(false);
              fetchData({ silent: true });
            } catch (error) {
              console.error('Failed to delete habit', error);
              addToast(error?.message || 'Failed to delete habit.', 'error');
            }
          },
        },
      ]
    );
  }, [addToast, fetchData]);

  const handleDeleteHabit = () => {
    if (!editingHabit) return;
    confirmDeleteHabit(editingHabit);
  };

  const handleSaveCategory = async () => {
    setSavingCategory(true);

    try {
      const payload = {
        name: categoryForm.name.trim(),
        color: categoryForm.color.trim() || '#60a5fa',
      };

      if (categoryForm.id) {
        await categoriesApi.updateCategory(categoryForm.id, payload);
        addToast('Category updated.');
      } else {
        await categoriesApi.createCategory({ ...payload, icon: 'circle' });
        addToast('Category created.');
      }

      setCategoryForm(EMPTY_CATEGORY_FORM);
      fetchData({ silent: true });
    } catch (error) {
      console.error('Failed to save category', error);
      addToast(error?.message || 'Failed to save category.', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleInlineCategoryChange = (field, value) => {
    setInlineCategoryForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateInlineCategory = async () => {
    if (!inlineCategoryForm.name.trim()) return;

    setSavingInlineCategory(true);

    try {
      const createdCategory = await categoriesApi.createCategory({
        name: inlineCategoryForm.name.trim(),
        color: inlineCategoryForm.color.trim() || '#60a5fa',
        icon: 'circle',
      });

      setCategories((current) => [...current, createdCategory]);
      setHabitForm((current) => ({ ...current, category_id: createdCategory.id }));
      setInlineCategoryForm(EMPTY_CATEGORY_FORM);
      setIsInlineCategoryVisible(false);
      addToast('Category created.');
    } catch (error) {
      console.error('Failed to create category', error);
      addToast(error?.message || 'Failed to create category.', 'error');
    } finally {
      setSavingInlineCategory(false);
    }
  };

  const openCategoryEditor = useCallback((category) => {
    setCategoryForm({
      id: category.id,
      name: category.name || '',
      color: category.color || '#60a5fa',
    });
    setCategoryManagerVisible(true);
  }, []);

  const openCategoryManager = useCallback(() => {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryManagerVisible(true);
  }, []);

  const handleDeleteCategory = (category) => {
    Alert.alert(
      'Delete category?',
      `This will remove "${category.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await categoriesApi.deleteCategory(category.id);
              if (categoryForm.id === category.id) {
                setCategoryForm(EMPTY_CATEGORY_FORM);
              }
              addToast('Category deleted.');
              fetchData({ silent: true });
            } catch (error) {
              console.error('Failed to delete category', error);
              addToast(error?.message || 'Failed to delete category.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleSaveLog = async () => {
    if (!selectedHabit || !selectedDate) return;

    const dateKey = toLocalDateKey(selectedDate);
    const existingLog = logs[selectedHabit.id]?.[dateKey];

    setSavingLog(true);

    try {
      const savedLog = existingLog
        ? await logsApi.updateLog(existingLog.id, {
            is_successful: logForm.status === 'completed',
            comment: logForm.comment,
          })
        : await logsApi.createLog({
            habit_id: selectedHabit.id,
            date: dateKey,
            is_successful: logForm.status === 'completed',
            comment: logForm.comment,
          });

      setLogs((current) => ({
        ...current,
        [selectedHabit.id]: {
          ...(current[selectedHabit.id] || {}),
          [dateKey]: savedLog,
        },
      }));
      addToast('Log saved.');
      setLogVisible(false);
    } catch (error) {
      console.error('Failed to save log', error);
      addToast(error?.message || 'Failed to save log.', 'error');
    } finally {
      setSavingLog(false);
    }
  };

  return (
    <>
      <ScreenShell
        title="Habits"
        subtitle="Seven-day mobile cards aligned with the web tracker."
        showPageHeader={false}
        refreshControl={(
          <RefreshControl
            tintColor={theme.colors.text}
            refreshing={refreshing}
            onRefresh={() => fetchData({ silent: true })}
          />
        )}
        stickyHeader={(
          <View style={styles.habitStickyHeader}>
            <View style={styles.headerActionRow}>
              <ActionButton
                label="Categories"
                variant="ghost"
                compact
                onPress={openCategoryManager}
                style={styles.newHabitButton}
              />
              <ActionButton
                label="New Habit"
                compact
                onPress={openCreateHabit}
              />
            </View>

            <View style={styles.toolbar}>
              <View style={styles.searchRow}>
                <TextInput
                  placeholder="Search habits..."
                  placeholderTextColor={theme.colors.muted}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <View style={styles.filterRow}>
                <InlinePickerField
                  placeholder="All Categories"
                  valueLabel={selectedCategoryLabel}
                  onPress={() => setIsCategoryFilterOpen(true)}
                  style={styles.filterField}
                />
                <InlinePickerField
                  placeholder="Sort Options"
                  valueLabel={selectedSortLabel}
                  onPress={() => setIsSortOpen(true)}
                  style={styles.filterField}
                />
              </View>
            </View>

            <View style={styles.periodBar}>
              <Pressable style={styles.mobileNavBtn} onPress={() => setCurrentDisplayDate((date) => addDays(date, -7))}>
                <ChevronLeft size={16} color={theme.colors.secondary} strokeWidth={1.5} />
              </Pressable>
              <Pressable style={styles.mobileNavTitleWrap} onPress={() => setIsDateJumpOpen(true)}>
                <CalendarDays size={13} color={theme.colors.tertiary} strokeWidth={1.5} />
                <Text style={styles.mobileNavTitle}>{rangeLabel}</Text>
              </Pressable>
              <Pressable style={styles.mobileNavBtn} onPress={() => setCurrentDisplayDate((date) => addDays(date, 7))}>
                <ChevronRight size={16} color={theme.colors.secondary} strokeWidth={1.5} />
              </Pressable>
            </View>

            {!isViewingTodayWindow ? (
              <View style={styles.todayRow}>
                <Pressable style={styles.todayButton} onPress={() => setCurrentDisplayDate(new Date())}>
                  <Text style={styles.todayButtonLabel}>Jump to today</Text>
                </Pressable>
              </View>
            ) : null}

            {isDateJumpOpen ? (
              <DateTimePicker
                value={currentDisplayDate}
                mode="date"
                display={Platform.select({ ios: 'inline', android: 'default' })}
                accentColor={Platform.OS === 'ios' ? theme.colors.text : undefined}
                textColor={Platform.OS === 'ios' ? theme.colors.text : undefined}
                themeVariant={Platform.OS === 'ios' ? 'dark' : undefined}
                onChange={(_, nextValue) => {
                  setIsDateJumpOpen(false);
                  if (nextValue) {
                    setCurrentDisplayDate(new Date(nextValue));
                  }
                }}
              />
            ) : null}
          </View>
        )}
      >
        {loading ? (
          <SectionCard>
            <Text style={styles.loadingText}>Loading habits…</Text>
          </SectionCard>
        ) : null}

        {!loading && habits.length === 0 ? (
          <SectionCard>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyBody}>
              Create your first habit to start tracking your seven-day streaks.
            </Text>
          </SectionCard>
        ) : null}

        {!loading && habits.length > 0 && filteredHabits.length === 0 ? (
          <SectionCard>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyBody}>
              No habits match your search or filters. Try widening them.
            </Text>
          </SectionCard>
        ) : null}

        {!loading && filteredHabits.map((habit) => {
          const category = categories.find((item) => item.id === habit.category_id);
          const categoryColor = category?.color || theme.colors.tertiary;
          const priorityClass = (habit.priority || 'Normal').toLowerCase();

          return (
            <View key={habit.id} style={[styles.habitCard, { borderLeftColor: categoryColor }]}>
              <View style={styles.habitHeader}>
                <View style={styles.habitTitleWrap}>
                  <Pressable onPress={() => openEditHabit(habit)}>
                    <Text style={styles.habitTitle}>{habit.name}</Text>
                  </Pressable>
                  <View style={styles.habitMetaRow}>
                    {category ? (
                      <Pressable onPress={() => openCategoryEditor(category)}>
                        <Text style={[styles.habitCategory, { color: categoryColor }]}>
                          {category.name}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.habitCategory, { color: theme.colors.tertiary }]}>
                        General
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.priorityBadge,
                        priorityClass === 'high' ? styles.priorityBadgeHigh : null,
                        priorityClass === 'medium' ? styles.priorityBadgeMedium : null,
                        priorityClass === 'normal' ? styles.priorityBadgeNormal : null,
                      ]}
                    >
                      {habit.priority || 'Normal'}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.mobileDeleteBtn} onPress={() => confirmDeleteHabit(habit)}>
                  <Trash2 size={16} color={theme.colors.danger} strokeWidth={1.5} />
                </Pressable>
              </View>

              {habit.description ? (
                <Text style={styles.habitDescription} numberOfLines={2}>
                  {habit.description}
                </Text>
              ) : null}

              <View style={styles.mobileDaysStrip}>
                {displayDates.map((date) => {
                  const key = toLocalDateKey(date);
                  const log = logs[habit.id]?.[key];
                  const state = log
                    ? (log.is_successful ? 'success' : 'failed')
                    : 'empty';
                  const todayKey = toLocalDateKey(new Date());
                  const isToday = key === todayKey;
                  const compareDate = new Date(date);
                  compareDate.setHours(0, 0, 0, 0);
                  const currentDate = new Date();
                  currentDate.setHours(0, 0, 0, 0);
                  const isFuture = compareDate > currentDate;

                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        if (isFuture) return;
                        if (isToday) {
                          handleToggleToday(habit);
                        } else {
                          openLog(habit, date);
                        }
                      }}
                      style={[
                        styles.dayCell,
                        isToday ? styles.dayCellToday : null,
                        isFuture ? styles.dayCellFuture : null,
                      ]}
                    >
                      <View style={styles.dayCellInfo}>
                        <Text style={styles.dayCellWeekday}>{formatWeekday(date).slice(0, 1)}</Text>
                        <Text style={styles.dayCellDate}>{date.getDate()}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusIndicator,
                          state === 'success' ? styles.statusIndicatorSuccess : null,
                          state === 'failed' ? styles.statusIndicatorFailed : null,
                          state === 'empty' ? styles.statusIndicatorEmpty : null,
                          isFuture ? styles.statusIndicatorFuture : null,
                        ]}
                      >
                        {state === 'success' ? (
                          <Check size={10} color="#000000" strokeWidth={3} />
                        ) : null}
                        {state === 'failed' ? (
                          <X size={10} color={theme.colors.danger} strokeWidth={3} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScreenShell>

      <HabitFormModal
        visible={habitFormVisible}
        title={editingHabit ? 'Edit Habit' : 'Create Habit'}
        categories={categories}
        form={habitForm}
        loading={savingHabit}
        categoryDraft={inlineCategoryForm}
        categoryDraftVisible={isInlineCategoryVisible}
        categorySaving={savingInlineCategory}
        onChange={(field, value) => setHabitForm((current) => ({ ...current, [field]: value }))}
        onCategoryDraftChange={handleInlineCategoryChange}
        onClose={() => {
          setHabitFormVisible(false);
          setInlineCategoryForm(EMPTY_CATEGORY_FORM);
          setIsInlineCategoryVisible(false);
        }}
        onCreateCategory={handleCreateInlineCategory}
        onHideCreateCategory={() => {
          setInlineCategoryForm(EMPTY_CATEGORY_FORM);
          setIsInlineCategoryVisible(false);
        }}
        onSave={handleSaveHabit}
        onShowCreateCategory={() => {
          setInlineCategoryForm(EMPTY_CATEGORY_FORM);
          setIsInlineCategoryVisible(true);
        }}
        onDelete={editingHabit ? handleDeleteHabit : null}
      />

      <CategoryManagerModal
        visible={categoryManagerVisible}
        categories={categories}
        form={categoryForm}
        loading={savingCategory}
        onChange={(field, value) => setCategoryForm((current) => ({ ...current, [field]: value }))}
        onClose={() => setCategoryManagerVisible(false)}
        onEdit={(category) => setCategoryForm({
          id: category.id,
          name: category.name || '',
          color: category.color || '#60a5fa',
        })}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />

      <LogModal
        visible={logVisible}
        date={selectedDate}
        habit={selectedHabit}
        form={logForm}
        loading={savingLog}
        onChange={(field, value) => setLogForm((current) => ({ ...current, [field]: value }))}
        onClose={() => setLogVisible(false)}
        onSave={handleSaveLog}
      />

      <OptionPickerSheet
        visible={isCategoryFilterOpen}
        title="Filter by Category"
        options={[
          { value: '', label: 'All Categories' },
          ...categories.map((category) => ({
            value: category.id,
            label: category.name,
            color: category.color,
          })),
        ]}
        selectedValue={filterCategory}
        onSelect={setFilterCategory}
        onClose={() => setIsCategoryFilterOpen(false)}
      />

      <OptionPickerSheet
        visible={isSortOpen}
        title="Sort Options"
        options={SORT_OPTIONS}
        selectedValue={sortBy}
        onSelect={setSortBy}
        onClose={() => setIsSortOpen(false)}
      />
    </>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  habitStickyHeader: {
    marginBottom: 0,
  },
  headerActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginBottom: 10,
  },
  newHabitButton: {
    borderColor: theme.colors.borderDim,
  },
  toolbar: {
    gap: 8,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    paddingVertical: 0,
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterField: {
    flex: 1,
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 0,
  },
  mobileNavBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileNavTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mobileNavTitle: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  todayRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  todayButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  todayButtonLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  loadingText: {
    color: theme.colors.tertiary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  emptyBody: {
    color: theme.colors.tertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  habitCard: {
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 8,
  },
  habitTitleWrap: {
    flex: 1,
    gap: 6,
  },
  habitTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  habitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  habitCategory: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  priorityBadge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeHigh: {
    backgroundColor: 'rgba(255, 77, 77, 0.2)',
    color: theme.colors.danger,
  },
  priorityBadgeMedium: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    color: '#ffa500',
  },
  priorityBadgeNormal: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: theme.colors.secondary,
  },
  mobileDeleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitDescription: {
    color: theme.colors.tertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  mobileDaysStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 6,
  },
  dayCellToday: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  dayCellFuture: {
    opacity: 0.3,
  },
  dayCellInfo: {
    alignItems: 'center',
    gap: 2,
  },
  dayCellWeekday: {
    color: theme.colors.tertiary,
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  dayCellDate: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  statusIndicator: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicatorSuccess: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  statusIndicatorFailed: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
    backgroundColor: 'transparent',
  },
  statusIndicatorEmpty: {
    borderWidth: 2,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
  },
  statusIndicatorFuture: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'transparent',
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
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  categoryChipDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  categoryChipLabel: {
    color: theme.colors.secondary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  categoryChipLabelActive: {
    color: theme.colors.text,
  },
  segmentPill: {
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  segmentPillLabel: {
    color: theme.colors.secondary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  segmentPillLabelActive: {
    color: theme.colors.background,
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
  modalHeaderIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
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
  formFieldGroup: {
    marginTop: 4,
    marginBottom: 4,
    gap: 6,
  },
  formSection: {
    marginTop: 4,
    marginBottom: 4,
    gap: 12,
  },
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  categoryList: {
    marginTop: 8,
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.surfaceSoft,
    padding: 10,
  },
  categoryRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryRowDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  categoryRowTextWrap: {
    gap: 2,
  },
  categoryRowTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  categoryRowSubtitle: {
    color: theme.colors.tertiary,
    fontSize: 10,
  },
});
