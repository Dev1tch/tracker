'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignJustify,
  Calendar,
  Check,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  MoveRight,
  Plus,
  RefreshCw,
  Settings2,
  SquareCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  authApi,
  TASK_PRIORITY,
  TASK_STATUS,
  tasksApi,
} from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CustomSelect from '@/components/ui/CustomSelect';
import {
  DEFAULT_CREATE_FORM,
  DEFAULT_TYPE_FORM,
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
  getDefaultFilters,
} from '@/features/tasks/constants/task-board.constants';
import {
  formatPriority,
  formatStatus,
} from '@/features/tasks/utils/task-formatters';
import {
  formatShortDate,
  isDueInRange,
  toIsoOrNull,
} from '@/features/tasks/utils/task-date.utils';
import { buildUpdatePayload } from '@/features/tasks/utils/task-form.utils';
import CreateTaskModal from './components/CreateTaskModal';
import TasksDatePicker from './components/TasksDatePicker';
import TaskDetailModal from './components/TaskDetailModal';
import TypeManagerModal from './components/TypeManagerModal';
import './TasksBoard.css';

const CARD_VIEW_SETTINGS_STORAGE_PREFIX = 'tasks.cardViewSettings';
const STATUS_CONFIG_STORAGE_PREFIX = 'tasks.statusConfig';
const STATUS_COLUMN_ORDER_STORAGE_PREFIX = 'tasks.statusColumnOrder';
const LEGACY_STATUS_COLORS_STORAGE_PREFIX = 'tasks.statusColors';
const DEFAULT_CARD_VIEW_SETTINGS = {
  title: true,
  description: true,
  status: true,
  task_type: true,
  priority: true,
  start_date: false,
  due_date: true,
  created_at: false,
  total_spent_time_minutes: false,
};
const CARD_VIEW_SETTING_OPTIONS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'task_type', label: 'Task Type' },
  { key: 'priority', label: 'Priority' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'created_at', label: 'Created Date' },
  { key: 'total_spent_time_minutes', label: 'Total Spent time' },
];
const DEFAULT_STATUS_COLORS = {
  [TASK_STATUS.TO_DO]: '#94a3b8',
  [TASK_STATUS.IN_PROGRESS]: '#60a5fa',
  [TASK_STATUS.PAUSED]: '#9ca3af',
  [TASK_STATUS.IN_REVIEW]: '#fbbf24',
  [TASK_STATUS.COMPLETED]: '#34d399',
  [TASK_STATUS.CANCELLED]: '#f87171',
  [TASK_STATUS.ARCHIVED]: '#6b7280',
};
const DEFAULT_STATUS_CONFIG = STATUS_ORDER.reduce((acc, status) => {
  acc[status] = {
    color: DEFAULT_STATUS_COLORS[status],
    is_visible: true,
  };
  return acc;
}, {});
const STATUS_COLOR_PRESETS = [
  '#94a3b8',
  '#60a5fa',
  '#9ca3af',
  '#fbbf24',
  '#34d399',
  '#f87171',
  '#6b7280',
  '#e879f9',
  '#a78bfa',
  '#2dd4bf',
  '#4ade80',
  '#f97316',
];
const PRIORITY_OPTION_COLORS = {
  [TASK_PRIORITY.URGENT]: '#f87171',
  [TASK_PRIORITY.HIGH]: '#fbbf24',
  [TASK_PRIORITY.NORMAL]: '#60a5fa',
  [TASK_PRIORITY.LOW]: '#9ca3af',
};

function hexToRgba(hex, alpha) {
  const raw = hex.replace('#', '');
  const parsed = Number.parseInt(raw, 16);
  if (Number.isNaN(parsed)) return `rgba(255, 255, 255, ${alpha})`;
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function isValidHexColor(value) {
  return /^#([0-9a-f]{6})$/i.test(value);
}

function normalizeHexColor(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!isValidHexColor(candidate)) return null;
  return candidate.toLowerCase();
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return { r: 255, g: 255, b: 255 };
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (channel) => Math.max(0, Math.min(255, channel));
  const toHex = (channel) => clamp(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hsvToRgb({ h, s, v }) {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const value = Math.max(0, Math.min(100, v)) / 100;
  const chroma = value * saturation;
  const segment = (h % 360) / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const m = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma; green = x; blue = 0;
  } else if (segment >= 1 && segment < 2) {
    red = x; green = chroma; blue = 0;
  } else if (segment >= 2 && segment < 3) {
    red = 0; green = chroma; blue = x;
  } else if (segment >= 3 && segment < 4) {
    red = 0; green = x; blue = chroma;
  } else if (segment >= 4 && segment < 5) {
    red = x; green = 0; blue = chroma;
  } else {
    red = chroma; green = 0; blue = x;
  }

  return {
    r: Math.round((red + m) * 255),
    g: Math.round((green + m) * 255),
    b: Math.round((blue + m) * 255),
  };
}

function rgbToHsv({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
    else hue = 60 * (((red - green) / delta) + 4);
  }

  if (hue < 0) hue += 360;

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  const value = max * 100;

  return { h: hue, s: saturation, v: value };
}

function normalizeStatusConfig(config, legacyColors = {}) {
  return STATUS_ORDER.reduce((acc, status) => {
    const value = config?.[status];
    const colorCandidate = typeof value === 'object' ? value?.color : value;
    const legacyColor = legacyColors?.[status];
    const color = isValidHexColor(colorCandidate)
      ? colorCandidate
      : (isValidHexColor(legacyColor) ? legacyColor : DEFAULT_STATUS_COLORS[status]);
    const isVisible = typeof value?.is_visible === 'boolean'
      ? value.is_visible
      : DEFAULT_STATUS_CONFIG[status].is_visible;

    acc[status] = {
      color,
      is_visible: isVisible,
    };
    return acc;
  }, {});
}

function getDescriptionPreview(text, maxLength = 110) {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

function getAccountStorageId() {
  if (typeof window === 'undefined') return 'guest';

  const token = authApi.getCurrentToken();
  if (!token) return 'guest';

  try {
    const payloadSegment = token.split('.')[1] || '';
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(window.atob(`${normalized}${padding}`));
    return payload?.sub || payload?.user_id || payload?.id || payload?.email || 'guest';
  } catch {
    return 'guest';
  }
}

function getAccountStorageKey(prefix) {
  return `${prefix}.${getAccountStorageId()}`;
}

function loadCardViewSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_CARD_VIEW_SETTINGS };

  try {
    const raw = localStorage.getItem(getAccountStorageKey(CARD_VIEW_SETTINGS_STORAGE_PREFIX));
    if (!raw) return { ...DEFAULT_CARD_VIEW_SETTINGS };

    const parsed = JSON.parse(raw);
    return Object.keys(DEFAULT_CARD_VIEW_SETTINGS).reduce((acc, key) => {
      acc[key] = typeof parsed?.[key] === 'boolean' ? parsed[key] : DEFAULT_CARD_VIEW_SETTINGS[key];
      return acc;
    }, {});
  } catch {
    return { ...DEFAULT_CARD_VIEW_SETTINGS };
  }
}

function saveCardViewSettings(settings) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      getAccountStorageKey(CARD_VIEW_SETTINGS_STORAGE_PREFIX),
      JSON.stringify(settings)
    );
  } catch (error) {
    console.error('Failed to persist task card view settings:', error);
  }
}

function loadStatusConfig() {
  if (typeof window === 'undefined') return normalizeStatusConfig();

  try {
    const legacyRaw = localStorage.getItem(
      getAccountStorageKey(LEGACY_STATUS_COLORS_STORAGE_PREFIX)
    );
    const legacyColors = legacyRaw ? JSON.parse(legacyRaw) : {};
    const raw = localStorage.getItem(getAccountStorageKey(STATUS_CONFIG_STORAGE_PREFIX));
    if (!raw) return normalizeStatusConfig(undefined, legacyColors);

    const parsed = JSON.parse(raw);
    return normalizeStatusConfig(parsed, legacyColors);
  } catch {
    return normalizeStatusConfig();
  }
}

function saveStatusConfig(statusConfig) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      getAccountStorageKey(STATUS_CONFIG_STORAGE_PREFIX),
      JSON.stringify(statusConfig)
    );
  } catch (error) {
    console.error('Failed to persist task status config:', error);
  }
}

function loadStatusColumnOrder() {
  if (typeof window === 'undefined') return [...STATUS_ORDER];

  try {
    const raw = localStorage.getItem(getAccountStorageKey(STATUS_COLUMN_ORDER_STORAGE_PREFIX));
    if (!raw) return [...STATUS_ORDER];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...STATUS_ORDER];

    return parsed.filter((status) => typeof status === 'string');
  } catch {
    return [...STATUS_ORDER];
  }
}

function saveStatusColumnOrder(statusColumnOrder) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      getAccountStorageKey(STATUS_COLUMN_ORDER_STORAGE_PREFIX),
      JSON.stringify(statusColumnOrder)
    );
  } catch (error) {
    console.error('Failed to persist task status column order:', error);
  }
}

export default function TasksBoard() {
  const addToast = useToast();

  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isCreatingType, setIsCreatingType] = useState(false);

  const [filters, setFilters] = useState(getDefaultFilters);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [bulkTargetStatus, setBulkTargetStatus] = useState(TASK_STATUS.IN_PROGRESS);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);

  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false);
  const [typeForm, setTypeForm] = useState(DEFAULT_TYPE_FORM);
  const [isCardViewSettingsOpen, setIsCardViewSettingsOpen] = useState(false);
  const [cardViewSettings, setCardViewSettings] = useState(loadCardViewSettings);
  const [statusConfig, setStatusConfig] = useState(loadStatusConfig);
  const [statusColumnOrder, setStatusColumnOrder] = useState(loadStatusColumnOrder);
  const [statusConfigTarget, setStatusConfigTarget] = useState(TASK_STATUS.TO_DO);
  const [isStatusColorPickerOpen, setIsStatusColorPickerOpen] = useState(false);
  const [isStatusColorWheelDragging, setIsStatusColorWheelDragging] = useState(false);
  const [statusColorInput, setStatusColorInput] = useState(DEFAULT_STATUS_COLORS[TASK_STATUS.TO_DO]);
  const cardViewSettingsRef = useRef(null);
  const statusColorPickerRef = useRef(null);
  const statusColorWheelRef = useRef(null);

  const [detailTaskId, setDetailTaskId] = useState(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState(null);

  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState('');
  const [dragColumnStatus, setDragColumnStatus] = useState(null);
  const [dragOverColumnStatus, setDragOverColumnStatus] = useState('');

  const detailTask = useMemo(
    () => tasks.find((task) => task.id === detailTaskId) || null,
    [tasks, detailTaskId]
  );

  const allStatuses = useMemo(() => {
    const extra = Array.from(new Set(tasks.map((task) => task.status))).filter(
      (status) => !STATUS_ORDER.includes(status)
    );
    return [...STATUS_ORDER, ...extra];
  }, [tasks]);
  const orderedAllStatuses = useMemo(() => {
    const available = new Set(allStatuses);
    const seen = new Set();
    const ordered = [];

    statusColumnOrder.forEach((status) => {
      if (!available.has(status) || seen.has(status)) return;
      ordered.push(status);
      seen.add(status);
    });

    allStatuses.forEach((status) => {
      if (seen.has(status)) return;
      ordered.push(status);
      seen.add(status);
    });

    return ordered;
  }, [allStatuses, statusColumnOrder]);
  const visibleStatuses = useMemo(
    () =>
      orderedAllStatuses.filter((status) => {
        if (!STATUS_ORDER.includes(status)) return true;
        return statusConfig[status]?.is_visible ?? true;
      }),
    [orderedAllStatuses, statusConfig]
  );

  const parentTasks = useMemo(
    () => tasks.filter((task) => !task.parent_task_id && !task.is_deleted),
    [tasks]
  );
  const statusColorVars = useMemo(() => {
    return STATUS_ORDER.reduce((acc, status) => {
      const className = STATUS_META[status]?.className;
      if (!className) return acc;

      const color = statusConfig[status]?.color || DEFAULT_STATUS_COLORS[status];
      acc[`--tasks-status-color-${className}`] = color;
      acc[`--tasks-status-color-${className}-soft`] = hexToRgba(color, 0.45);
      return acc;
    }, {});
  }, [statusConfig]);
  const statusConfigOptions = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        value: status,
        label: formatStatus(status),
        color:
          statusConfig[status]?.color ||
          DEFAULT_STATUS_COLORS[status] ||
          DEFAULT_STATUS_COLORS[TASK_STATUS.TO_DO],
      })),
    [statusConfig]
  );
  const currentStatusConfig = useMemo(
    () => statusConfig[statusConfigTarget] || DEFAULT_STATUS_CONFIG[statusConfigTarget],
    [statusConfig, statusConfigTarget]
  );
  const currentStatusColor = currentStatusConfig?.color || DEFAULT_STATUS_COLORS[statusConfigTarget];
  const currentStatusHsv = useMemo(
    () => rgbToHsv(hexToRgb(currentStatusColor)),
    [currentStatusColor]
  );
  const statusColorPointerStyle = useMemo(() => {
    const angle = (currentStatusHsv.h * Math.PI) / 180;
    const radius = (currentStatusHsv.s / 100) * 50;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return {
      left: `${Math.max(0, Math.min(100, x))}%`,
      top: `${Math.max(0, Math.min(100, y))}%`,
    };
  }, [currentStatusHsv]);

  const filteredParentTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return parentTasks.filter((task) => {
      if (search) {
        const hay = `${task.title || ''} ${task.description || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }

      if (filters.status.length > 0 && !filters.status.includes(task.status)) return false;
      if (filters.priority.length > 0 && !filters.priority.includes(task.priority)) return false;
      if (
        filters.task_type_id.length > 0 &&
        !filters.task_type_id.includes(task.task_type_id)
      ) return false;

      if (!isDueInRange(task.due_date, filters.due_from, filters.due_to)) return false;

      return true;
    });
  }, [filters, parentTasks]);

  const boardByStatus = useMemo(() => {
    return allStatuses.reduce((acc, status) => {
      acc[status] = filteredParentTasks.filter((task) => task.status === status);
      return acc;
    }, {});
  }, [allStatuses, filteredParentTasks]);
  const bulkStatusOptions = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        value: status,
        label: formatStatus(status),
        color:
          statusConfig[status]?.color ||
          DEFAULT_STATUS_COLORS[status] ||
          DEFAULT_STATUS_COLORS[TASK_STATUS.TO_DO],
      })),
    [statusConfig]
  );
  const filterStatusOptions = useMemo(
    () =>
      allStatuses.map((status) => ({
        value: status,
        label: formatStatus(status),
        color:
          statusConfig[status]?.color ||
          DEFAULT_STATUS_COLORS[status] ||
          DEFAULT_STATUS_COLORS[TASK_STATUS.TO_DO],
      })),
    [allStatuses, statusConfig]
  );
  const filterPriorityOptions = useMemo(
    () =>
      PRIORITY_ORDER.map((priority) => ({
        value: priority,
        label: formatPriority(priority),
        color: PRIORITY_OPTION_COLORS[priority],
      })),
    []
  );
  const filterTaskTypeOptions = useMemo(
    () =>
      taskTypes.map((type) => ({
        value: type.id,
        label: type.name,
        color: type.color || undefined,
      })),
    [taskTypes]
  );
  const statusOptionColors = useMemo(
    () =>
      allStatuses.reduce((acc, status) => {
        acc[status] =
          statusConfig[status]?.color ||
          DEFAULT_STATUS_COLORS[status] ||
          DEFAULT_STATUS_COLORS[TASK_STATUS.TO_DO];
        return acc;
      }, {}),
    [allStatuses, statusConfig]
  );
  const taskTypeById = useMemo(
    () => new Map(taskTypes.map((type) => [String(type.id), type])),
    [taskTypes]
  );
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count += 1;
    if (filters.status.length > 0) count += 1;
    if (filters.priority.length > 0) count += 1;
    if (filters.task_type_id.length > 0) count += 1;
    if (filters.due_from) count += 1;
    if (filters.due_to) count += 1;
    return count;
  }, [filters]);
  const applyStatusColor = useCallback((nextColor) => {
    const normalizedColor = normalizeHexColor(nextColor);
    if (!normalizedColor) return;

    setStatusConfig((prev) => ({
      ...prev,
      [statusConfigTarget]: {
        color: normalizedColor,
        is_visible: prev[statusConfigTarget]?.is_visible ?? true,
      },
    }));
  }, [statusConfigTarget]);
  const handleStatusWheelPointerDown = useCallback((event) => {
    const wheel = statusColorWheelRef.current;
    if (!wheel) return;

    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const radius = rect.width / 2;
    const distance = Math.min(Math.sqrt((dx ** 2) + (dy ** 2)), radius);
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const saturation = (distance / radius) * 100;
    const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));

    applyStatusColor(nextColor);
    setStatusColorInput(nextColor);
    setIsStatusColorWheelDragging(true);
  }, [applyStatusColor]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [tasksResponse, taskTypesResponse] = await Promise.all([
        tasksApi.getTasks(),
        tasksApi.getTaskTypes(),
      ]);

      setTasks(Array.isArray(tasksResponse) ? tasksResponse : []);
      setTaskTypes(Array.isArray(taskTypesResponse) ? taskTypesResponse : []);
    } catch (error) {
      console.error('Failed to load tasks flow data:', error);
      addToast(error?.message || 'Failed to load tasks data', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    saveCardViewSettings(cardViewSettings);
  }, [cardViewSettings]);

  useEffect(() => {
    saveStatusConfig(statusConfig);
  }, [statusConfig]);

  useEffect(() => {
    saveStatusColumnOrder(statusColumnOrder);
  }, [statusColumnOrder]);

  useEffect(() => {
    setStatusColorInput(currentStatusColor);
  }, [currentStatusColor, statusConfigTarget]);

  useEffect(() => {
    if (!isCardViewSettingsOpen) {
      setIsStatusColorPickerOpen(false);
      setIsStatusColorWheelDragging(false);
    }
  }, [isCardViewSettingsOpen]);

  useEffect(() => {
    if (!isCardViewSettingsOpen) return undefined;

    function handleOutsideClick(event) {
      if (
        cardViewSettingsRef.current &&
        !cardViewSettingsRef.current.contains(event.target)
      ) {
        setIsCardViewSettingsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCardViewSettingsOpen]);

  useEffect(() => {
    if (!isStatusColorPickerOpen) return undefined;

    function handleColorPickerOutside(event) {
      if (
        statusColorPickerRef.current &&
        !statusColorPickerRef.current.contains(event.target)
      ) {
        setIsStatusColorPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleColorPickerOutside);
    return () => document.removeEventListener('mousedown', handleColorPickerOutside);
  }, [isStatusColorPickerOpen]);

  useEffect(() => {
    if (!isStatusColorWheelDragging) return undefined;

    function handleWheelPointerMove(event) {
      const wheel = statusColorWheelRef.current;
      if (!wheel) return;

      const rect = wheel.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const radius = rect.width / 2;
      const distance = Math.min(Math.sqrt((dx ** 2) + (dy ** 2)), radius);
      const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const saturation = (distance / radius) * 100;
      const nextColor = rgbToHex(hsvToRgb({ h: hue, s: saturation, v: 100 }));

      applyStatusColor(nextColor);
      setStatusColorInput(nextColor);
    }

    function handleWheelPointerUp() {
      setIsStatusColorWheelDragging(false);
    }

    window.addEventListener('pointermove', handleWheelPointerMove);
    window.addEventListener('pointerup', handleWheelPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWheelPointerMove);
      window.removeEventListener('pointerup', handleWheelPointerUp);
    };
  }, [applyStatusColor, isStatusColorWheelDragging]);

  useEffect(() => {
    const isAnyModalOpen =
      isCreateOpen ||
      isTypeManagerOpen ||
      Boolean(detailTaskId) ||
      Boolean(pendingDeleteTaskId);

    if (isAnyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => document.body.classList.remove('modal-open');
  }, [
    detailTaskId,
    isCreateOpen,
    isTypeManagerOpen,
    pendingDeleteTaskId,
  ]);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTaskIds(new Set());
  };

  const toggleSelectTask = (taskId) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const removeTasksLocally = (taskIds) => {
    const ids = new Set(taskIds);
    setTasks((prev) => prev.filter((task) => !ids.has(task.id)));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

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

    const parentIds = Array.from(
      new Set(
        updatedTaskIds
          .map((id) => tasks.find((task) => task.id === id)?.parent_task_id)
          .filter(Boolean)
      )
    );

    if (parentIds.length === 0) return;

    const completedParents = [];

    for (const parentId of parentIds) {
      const siblingSubtasks = tasks.filter((task) => task.parent_task_id === parentId);
      if (siblingSubtasks.length === 0) continue;

      const allCompleted = siblingSubtasks.every(
        (subtask) =>
          subtask.status === TASK_STATUS.COMPLETED || updatedTaskIds.includes(subtask.id)
      );

      if (allCompleted) completedParents.push(parentId);
    }

    if (completedParents.length > 0) {
      await tasksApi.updateTasksBulkStatus({
        task_ids: completedParents,
        status: TASK_STATUS.COMPLETED,
      });

      setTasks((prev) =>
        prev.map((task) =>
          completedParents.includes(task.id)
            ? { ...task, status: TASK_STATUS.COMPLETED, completed_at: new Date().toISOString() }
            : task
        )
      );
    }
  }, [tasks]);

  const handleDeleteTasks = useCallback(async (taskIds, { notify = true } = {}) => {
    if (!taskIds || taskIds.length === 0) return;

    const allIds = collectCascadeDeleteIds(taskIds);

    try {
      await tasksApi.deleteTasksBulk({ task_ids: allIds });
      removeTasksLocally(allIds);

      if (notify) {
        addToast(`Deleted ${allIds.length} task${allIds.length > 1 ? 's' : ''}`, 'success');
      }

      if (detailTaskId && allIds.includes(detailTaskId)) {
        setDetailTaskId(null);
      }
    } catch (error) {
      console.error('Delete tasks failed:', error);
      addToast(error?.message || 'Failed to delete tasks', 'error');
    }
  }, [addToast, collectCascadeDeleteIds, detailTaskId]);

  const handleUpdateTask = useCallback(async (taskId, patch, options = {}) => {
    const { showSuccessToast = true } = options;
    const current = tasks.find((task) => task.id === taskId);
    if (!current) return;

    setIsSavingTask(true);

    try {
      const payload = buildUpdatePayload(current, patch);
      const updated = await tasksApi.updateTask(taskId, payload);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      if (showSuccessToast) {
        addToast('Task updated', 'success');
      }
    } catch (error) {
      console.error('Update task failed:', error);
      addToast(error?.message || 'Failed to update task', 'error');
      throw error;
    } finally {
      setIsSavingTask(false);
    }
  }, [addToast, tasks]);

  const handleUpdateStatus = useCallback(async (taskIds, newStatus) => {
    const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
    if (ids.length === 0) return;

    const previous = tasks;

    setTasks((prev) =>
      prev.map((task) =>
        ids.includes(task.id)
          ? {
              ...task,
              status: newStatus,
              completed_at:
                newStatus === TASK_STATUS.COMPLETED
                  ? task.completed_at || new Date().toISOString()
                  : task.completed_at,
              pause_start_date:
                newStatus === TASK_STATUS.PAUSED
                  ? task.pause_start_date || new Date().toISOString()
                  : task.pause_start_date,
            }
          : task
      )
    );

    try {
      await tasksApi.updateTasksBulkStatus({ task_ids: ids, status: newStatus });
      await checkAndCompleteParents(ids, newStatus);
      addToast(
        `Updated ${ids.length} task${ids.length > 1 ? 's' : ''} to ${formatStatus(newStatus)}`,
        'success'
      );
    } catch (error) {
      setTasks(previous);
      console.error('Update status failed:', error);
      addToast(error?.message || 'Failed to update status', 'error');
      throw error;
    }
  }, [addToast, checkAndCompleteParents, tasks]);

  const handleCreateTask = async () => {
    const title = createForm.title.trim();
    if (!title) {
      addToast('Task title is required', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await tasksApi.createTask({
        title,
        description: createForm.description || null,
        task_type_id: createForm.task_type_id || null,
        parent_task_id: createForm.parent_task_id || null,
        status: createForm.status,
        priority: createForm.priority,
        start_date: toIsoOrNull(createForm.start_date),
        due_date: toIsoOrNull(createForm.due_date),
      });

      setTasks((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setCreateForm(DEFAULT_CREATE_FORM);
      addToast('Task created', 'success');
    } catch (error) {
      console.error('Create task failed:', error);
      addToast(error?.message || 'Failed to create task', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubtask = async (parentTaskId, form) => {
    const title = form.title.trim();
    if (!title) {
      addToast('Subtask title is required', 'error');
      return;
    }

    try {
      const parent = tasks.find((task) => task.id === parentTaskId);
      const created = await tasksApi.createTask({
        title,
        description: form.description || null,
        parent_task_id: parentTaskId,
        task_type_id: parent?.task_type_id || null,
        status: form.status || TASK_STATUS.TO_DO,
        priority: form.priority || TASK_PRIORITY.NORMAL,
        due_date: toIsoOrNull(form.due_date),
      });

      setTasks((prev) => [created, ...prev]);
      addToast('Subtask created', 'success');
    } catch (error) {
      console.error('Create subtask failed:', error);
      addToast(error?.message || 'Failed to create subtask', 'error');
    }
  };

  const handleCreateTaskType = async () => {
    const name = typeForm.name.trim();
    if (!name) {
      addToast('Task type name is required', 'error');
      return;
    }

    setIsCreatingType(true);

    try {
      const created = await tasksApi.createTaskType({
        name,
        description: typeForm.description || null,
        color: typeForm.color || null,
        is_active: Boolean(typeForm.is_active),
      });

      setTaskTypes((prev) => [created, ...prev]);
      setTypeForm(DEFAULT_TYPE_FORM);
      addToast('Task type created', 'success');
    } catch (error) {
      console.error('Create task type failed:', error);
      addToast(error?.message || 'Failed to create task type', 'error');
    } finally {
      setIsCreatingType(false);
    }
  };

  const handleDeleteTaskType = async (taskTypeId) => {
    try {
      await tasksApi.deleteTaskType(taskTypeId);
      setTaskTypes((prev) => prev.filter((type) => type.id !== taskTypeId));
      setTasks((prev) =>
        prev.map((task) =>
          task.task_type_id === taskTypeId ? { ...task, task_type_id: null } : task
        )
      );
      addToast('Task type deleted', 'success');
    } catch (error) {
      console.error('Delete task type failed:', error);
      addToast(error?.message || 'Failed to delete task type', 'error');
    }
  };

  const handleDragStart = (event, taskId) => {
    event.dataTransfer.effectAllowed = 'move';
    setDragColumnStatus(null);
    setDragOverColumnStatus('');
    setDragTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDragTaskId(null);
    setDragOverStatus('');
  };

  const handleDrop = async (status) => {
    if (!dragTaskId) return;
    const draggedTask = tasks.find((task) => task.id === dragTaskId);
    if (!draggedTask) return;
    if (draggedTask.status === status) return;

    await handleUpdateStatus(dragTaskId, status);
    setDragTaskId(null);
    setDragOverStatus('');
  };
  const handleOpenCreateForStatus = (status) => {
    setCreateForm({
      ...DEFAULT_CREATE_FORM,
      status,
    });
    setIsCreateOpen(true);
  };
  const handleColumnDragEnd = () => {
    setDragColumnStatus(null);
    setDragOverColumnStatus('');
  };
  const handleColumnDrop = (targetStatus) => {
    if (!dragColumnStatus || dragColumnStatus === targetStatus) return;

    setStatusColumnOrder((prev) => {
      const base = Array.from(new Set([...prev, ...orderedAllStatuses]));
      const fromIndex = base.indexOf(dragColumnStatus);
      const toIndex = base.indexOf(targetStatus);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;

      const next = [...base];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  return (
    <section className="tasksFlowContainer" style={statusColorVars}>
      <header className="tasksFlowHeader">

        <div className="tasksHeaderActions">
          {selectionMode ? (
            <>
              <span className="tasksSelectionInfo">
                <SquareCheck size={14} />
                {selectedTaskIds.size} selected
              </span>
              <div className="tasksCompactSelect">
                <CustomSelect
                  options={bulkStatusOptions}
                  value={bulkTargetStatus}
                  onChange={setBulkTargetStatus}
                  placeholder="Select status"
                />
              </div>
              <button
                type="button"
                className="tasksBtn"
                disabled={selectedTaskIds.size === 0}
                onClick={() => handleUpdateStatus(Array.from(selectedTaskIds), bulkTargetStatus)}
              >
                <MoveRight size={14} />
                Move
              </button>
              <button
                type="button"
                className="tasksBtn tasksBtnDanger"
                disabled={selectedTaskIds.size === 0}
                onClick={() => handleDeleteTasks(Array.from(selectedTaskIds))}
              >
                <Trash2 size={14} />
                Delete
              </button>
              <button type="button" className="tasksBtn" onClick={exitSelectionMode}>
                <X size={14} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="tasksBtn"
                onClick={() => loadData({ silent: true })}
                disabled={isRefreshing}
              >
                <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                className="tasksBtn"
                onClick={() => setSelectionMode(true)}
              >
                <SquareCheck size={14} />
                Select
              </button>
              <button
                type="button"
                className="tasksBtn"
                onClick={() => setIsTypeManagerOpen(true)}
              >
                <Tag size={14} />
                Types
              </button>
              <button
                type="button"
                className="tasksBtn tasksBtnPrimary"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus size={14} />
                Add Task
              </button>
              <div className="tasksCardSettingsWrap" ref={cardViewSettingsRef}>
                <button
                  type="button"
                  className="tasksBtn tasksCardSettingsTrigger"
                  onClick={() => setIsCardViewSettingsOpen((prev) => !prev)}
                  title="Configure task card fields"
                  aria-label="Configure task card fields"
                >
                  <Settings2 size={14} />
                </button>

                {isCardViewSettingsOpen ? (
                  <div className="tasksCardSettingsPopover">
                    <div className="tasksCardSettingsHead">
                      <h4>Card Details</h4>
                    </div>

                    <div className="tasksCardSettingsBody">
                      {CARD_VIEW_SETTING_OPTIONS.map((option) => (
                        <label key={option.key} className="tasksCardSettingItem">
                          <input
                            type="checkbox"
                            checked={Boolean(cardViewSettings[option.key])}
                            onChange={() =>
                              setCardViewSettings((prev) => ({
                                ...prev,
                                [option.key]: !prev[option.key],
                              }))
                            }
                          />
                          <span className="tasksCardSettingCheck" aria-hidden="true" />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="tasksCardSettingsHead tasksCardSettingsSubhead">
                      <h4>Status Config</h4>
                    </div>

                    <div className="tasksStatusConfigRow">
                      <div className="tasksStatusConfigSelect">
                        <CustomSelect
                          options={statusConfigOptions}
                          value={statusConfigTarget}
                          onChange={(value) => {
                            setStatusConfigTarget(value);
                            setIsStatusColorPickerOpen(false);
                          }}
                          placeholder="Select status"
                        />
                      </div>
                      <div className="tasksStatusConfigColorWrap" ref={statusColorPickerRef}>
                        <button
                          type="button"
                          className="tasksStatusConfigColorBtn"
                          style={{ backgroundColor: currentStatusColor }}
                          onClick={() => setIsStatusColorPickerOpen((prev) => !prev)}
                          title="Choose status color"
                          aria-label={`${formatStatus(statusConfigTarget)} color`}
                        />

                        {isStatusColorPickerOpen ? (
                          <div className="tasksStatusConfigColorPopover">
                            <div
                              ref={statusColorWheelRef}
                              className="tasksStatusColorWheel"
                              onPointerDown={handleStatusWheelPointerDown}
                              role="presentation"
                            >
                              <span
                                className="tasksStatusColorWheelPointer"
                                style={statusColorPointerStyle}
                              />
                            </div>

                            <div className="tasksStatusConfigSwatches">
                              {STATUS_COLOR_PRESETS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={`tasksStatusConfigSwatch ${
                                    currentStatusColor === color ? 'isActive' : ''
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => {
                                    applyStatusColor(color);
                                    setStatusColorInput(color);
                                  }}
                                  aria-label={`Set color ${color}`}
                                />
                              ))}
                            </div>

                            <div className="tasksStatusConfigHexRow">
                              <label>Hex</label>
                              <input
                                type="text"
                                value={statusColorInput}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setStatusColorInput(value);

                                  const normalizedColor = normalizeHexColor(value);
                                  if (normalizedColor) {
                                    applyStatusColor(normalizedColor);
                                  }
                                }}
                                onBlur={() => setStatusColorInput(currentStatusColor)}
                                placeholder="#ffffff"
                                maxLength={7}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`tasksIconBtn tasksStatusConfigEye ${
                          currentStatusConfig?.is_visible ? '' : 'isHidden'
                        }`}
                        onClick={() =>
                          setStatusConfig((prev) => ({
                            ...prev,
                            [statusConfigTarget]: {
                              color:
                                prev[statusConfigTarget]?.color ||
                                DEFAULT_STATUS_COLORS[statusConfigTarget],
                              is_visible: !(prev[statusConfigTarget]?.is_visible ?? true),
                            },
                          }))
                        }
                        title={
                          currentStatusConfig?.is_visible
                            ? 'Hide this status column'
                            : 'Show this status column'
                        }
                        aria-label={
                          currentStatusConfig?.is_visible
                            ? 'Hide this status column'
                            : 'Show this status column'
                        }
                      >
                        {currentStatusConfig?.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>

                    <div className="tasksCardSettingsActions">
                      <button
                        type="button"
                        className="tasksBtn"
                        onClick={() => setCardViewSettings({ ...DEFAULT_CARD_VIEW_SETTINGS })}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="tasksBtn"
                        onClick={() => setStatusConfig(normalizeStatusConfig())}
                      >
                        Reset Status
                      </button>
                      <button
                        type="button"
                        className="tasksBtn tasksBtnPrimary"
                        onClick={() => setIsCardViewSettingsOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="tasksFiltersBar">
        <div className="tasksFilterToolbar">
          <input
            type="text"
            className="authInput tasksFilterInput"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search by title or description"
          />
          <div className="tasksFilterSelectWrapper">
            <CustomSelect
              options={filterStatusOptions}
              value={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              placeholder="All Statuses"
              multiple
            />
          </div>
          <div className="tasksFilterSelectWrapper">
            <CustomSelect
              options={filterPriorityOptions}
              value={filters.priority}
              onChange={(value) => setFilters((prev) => ({ ...prev, priority: value }))}
              placeholder="All Priorities"
              multiple
            />
          </div>
          <div className="tasksFilterSelectWrapper">
            <CustomSelect
              options={filterTaskTypeOptions}
              value={filters.task_type_id}
              onChange={(value) => setFilters((prev) => ({ ...prev, task_type_id: value }))}
              placeholder="All Task Types"
              multiple
            />
          </div>
          <TasksDatePicker
            rangeStart={filters.due_from}
            rangeEnd={filters.due_to}
            onRangeChange={(start, end) =>
              setFilters((prev) => ({ ...prev, due_from: start, due_to: end }))
            }
            placeholder="Due date range"
            className="tasksDateInput tasksDateRangeInput"
          />
          <button
            type="button"
            className="tasksFilterClearAllBtn"
            onClick={() => setFilters(getDefaultFilters())}
            disabled={activeFiltersCount === 0}
            title="Clear filters"
          >
            <X size={12} />
            {activeFiltersCount > 0
              ? `Clear All (${activeFiltersCount})`
              : 'Clear All'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="tasksBoardLoading">
          <Loader2 size={20} className="spin" />
          Loading tasks...
        </div>
      ) : (
        <div className="tasksBoardScroller">
          <div className="tasksBoardGrid">
            {visibleStatuses.map((status) => {
              const statusMeta = STATUS_META[status] || {
                label: formatStatus(status),
                className: 'todo',
              };
              const items = boardByStatus[status] || [];
              const isDropTarget = dragOverStatus === status;
              const isColumnDropTarget = dragOverColumnStatus === status;

              return (
                <article
                  key={status}
                  className={`tasksColumn status-${statusMeta.className} ${isDropTarget ? 'isDropTarget' : ''} ${
                    isColumnDropTarget ? 'isColumnDropTarget' : ''
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragColumnStatus) {
                      setDragOverColumnStatus(status);
                    } else if (dragTaskId) {
                      setDragOverStatus(status);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverStatus === status) setDragOverStatus('');
                    if (dragOverColumnStatus === status) setDragOverColumnStatus('');
                  }}
                  onDrop={async (event) => {
                    event.preventDefault();
                    if (dragColumnStatus) {
                      handleColumnDrop(status);
                      handleColumnDragEnd();
                      return;
                    }
                    await handleDrop(status);
                  }}
                >
                  <header
                    className="tasksColumnHeader"
                    draggable={!selectionMode}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.effectAllowed = 'move';
                      setDragColumnStatus(status);
                      setDragTaskId(null);
                      setDragOverStatus('');
                    }}
                    onDragEnd={handleColumnDragEnd}
                    title="Drag to reorder column"
                  >
                    <span>{statusMeta.label}</span>
                    <span>{items.length}</span>
                  </header>

                  <div className="tasksColumnBody">
                    {items.map((task) => {
                      const due = formatShortDate(task.due_date);
                      const startDate = formatShortDate(task.start_date);
                      const createdDate = formatShortDate(task.created_at);
                      const spentMinutes = task.total_spent_time_minutes ?? 0;
                      const descriptionPreview = getDescriptionPreview(task.description);
                      const taskType =
                        task.task_type_id !== null && task.task_type_id !== undefined
                          ? (taskTypeById.get(String(task.task_type_id)) || null)
                          : null;
                      const taskTypeColor = taskType?.color || '#6ea8fe';
                      const priorityMeta = PRIORITY_META[task.priority] || {
                        label: formatPriority(task.priority),
                        className: 'normal',
                      };
                      const taskStatusMeta = STATUS_META[task.status] || {
                        label: formatStatus(task.status),
                        className: 'todo',
                      };

                      return (
                        <div
                          key={task.id}
                          className={`tasksCard ${
                            cardViewSettings.task_type && taskType ? 'hasTypeAccent' : ''
                          } ${selectedTaskIds.has(task.id) ? 'selected' : ''}`}
                          style={
                            cardViewSettings.task_type && taskType
                              ? { '--task-type-color': taskTypeColor }
                              : undefined
                          }
                          draggable={!selectionMode}
                          onDragStart={(event) => handleDragStart(event, task.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            if (selectionMode) {
                              toggleSelectTask(task.id);
                            } else {
                              setDetailTaskId(task.id);
                            }
                          }}
                        >
                          <div className="tasksCardTop">
                            {selectionMode ? (
                              <button
                                type="button"
                                className={`tasksCheck ${selectedTaskIds.has(task.id) ? 'checked' : ''}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleSelectTask(task.id);
                                }}
                              >
                                {selectedTaskIds.has(task.id) ? <Check size={12} /> : null}
                              </button>
                            ) : null}
                            {cardViewSettings.status ? (
                              <span
                                className={`taskStatusDot ${taskStatusMeta.className}`}
                                title={taskStatusMeta.label}
                              />
                            ) : null}
                            {cardViewSettings.title ? <h4>{task.title}</h4> : null}
                            {!selectionMode ? (
                              <button
                                type="button"
                                className="tasksIconBtn danger tasksCardDeleteBtn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPendingDeleteTaskId(task.id);
                                }}
                                title="Delete task"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : null}
                          </div>

                          <div className="tasksCardMeta">
                            {cardViewSettings.task_type && taskType ? (
                              <span className="taskTypeMeta" style={{ color: taskTypeColor }}>
                                {taskType.name}
                              </span>
                            ) : null}
                            {cardViewSettings.priority ? (
                              <span className={`priorityBadge ${priorityMeta.className}`}>
                                {priorityMeta.label}
                              </span>
                            ) : null}
                            {cardViewSettings.description && task.description ? (
                              <div className="tasksDescriptionHint">
                                <AlignJustify size={12} />
                                <div className="tasksDescriptionPreview">{descriptionPreview}</div>
                              </div>
                            ) : null}
                            {cardViewSettings.start_date && startDate ? (
                              <span className="taskDateBadge">
                                <Calendar size={11} />
                                {startDate}
                              </span>
                            ) : null}
                            {cardViewSettings.due_date && due ? (
                              <span className="taskDueDate">
                                <Calendar size={11} />
                                {due}
                              </span>
                            ) : null}
                            {cardViewSettings.created_at && createdDate ? (
                              <span className="taskDateBadge">
                                <Calendar size={11} />
                                {createdDate}
                              </span>
                            ) : null}
                            {cardViewSettings.total_spent_time_minutes ? (
                              <span className="taskSpentBadge">
                                <Clock3 size={11} />
                                {spentMinutes}m
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {!selectionMode ? (
                      <button
                        type="button"
                        className="tasksColumnAddBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenCreateForStatus(status);
                        }}
                        title={`Add task in ${statusMeta.label}`}
                      >
                        <Plus size={14} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreateTask}
        isSubmitting={isSubmitting}
        taskTypes={taskTypes}
        statusColors={statusOptionColors}
        parentTasks={parentTasks}
        onOpenTypeManager={() => setIsTypeManagerOpen(true)}
      />

      <TypeManagerModal
        isOpen={isTypeManagerOpen}
        onClose={() => setIsTypeManagerOpen(false)}
        taskTypes={taskTypes}
        typeForm={typeForm}
        setTypeForm={setTypeForm}
        onCreate={handleCreateTaskType}
        onDelete={handleDeleteTaskType}
        isCreating={isCreatingType}
      />

      <TaskDetailModal
        key={detailTask?.id || 'task-detail-modal'}
        task={detailTask}
        allTasks={tasks}
        taskTypes={taskTypes}
        onClose={() => setDetailTaskId(null)}
        onSave={handleUpdateTask}
        onDelete={(taskId) => setPendingDeleteTaskId(taskId)}
        onUpdateStatus={(taskId, status) => handleUpdateStatus(taskId, status)}
        onCreateSubtask={handleCreateSubtask}
        onDeleteSubtask={(taskId) => handleDeleteTasks([taskId], { notify: false })}
        onOpenTask={setDetailTaskId}
        onOpenTypeManager={() => setIsTypeManagerOpen(true)}
        cardViewSettings={cardViewSettings}
        statusColors={statusOptionColors}
        isSaving={isSavingTask}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteTaskId)}
        title="Delete Task"
        message="This action will remove the task and any nested subtasks. Continue?"
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setPendingDeleteTaskId(null)}
        onConfirm={async () => {
          if (!pendingDeleteTaskId) return;
          await handleDeleteTasks([pendingDeleteTaskId]);
          setPendingDeleteTaskId(null);
        }}
      />
    </section>
  );
}
