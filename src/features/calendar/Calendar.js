import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, RefreshCw, Plus, ChevronDown, Settings2, X, Menu } from 'lucide-react';
import { calendarApi, tasksApi, authApi } from '@/lib/api';
import AccountSwitcher from './components/AccountSwitcher';
import EventModal from './components/EventModal';
import CreateCalendarModal from './components/CreateCalendarModal';
import MiniCalendar from './components/MiniCalendar';
import CalendarToggles from './components/CalendarToggles';
import CalendarMobileView from './components/CalendarMobileView';
import WeekGrid from './components/WeekGrid';
import TaskDetailModal from '@/features/tasks/components/TasksBoard/components/TaskDetailModal';
import CustomSelect from '@/components/ui/CustomSelect';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/ToastProvider';
import useIsMobile from '@/hooks/useIsMobile';
import './Calendar.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getWeekStart(date, weekStartDay = 0) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartDay ? 7 : 0) + day - weekStartDay;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date, weekStartDay = 0) {
  const start = getWeekStart(date, weekStartDay);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = MONTHS[weekStart.getMonth()];
  const endMonth = MONTHS[weekEnd.getMonth()];
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startMonth} – ${endMonth} ${startYear}`;
  }
  return `${startMonth} ${startYear}`;
}

const MOBILE_AGENDA_INITIAL_PAST_DAYS = 7;
const MOBILE_AGENDA_INITIAL_FUTURE_DAYS = 21;
const MOBILE_AGENDA_LOAD_MORE_DAYS = 14;

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function getEventKey(event) {
  return [
    event.accountEmail || '',
    event.calendarId || '',
    event.id || '',
    event.recurringEventId || '',
    event.start || '',
    event.end || '',
  ].join(':');
}

function getCalendarKey(calendar) {
  return `${calendar.accountEmail || ''}:${calendar.id || ''}`;
}

function mergeByKey(existingItems = [], incomingItems = [], getKey) {
  const merged = new Map();

  existingItems.forEach((item) => {
    merged.set(getKey(item), item);
  });

  incomingItems.forEach((item) => {
    merged.set(getKey(item), item);
  });

  return Array.from(merged.values());
}

const SETTINGS_STORAGE_KEY = 'calendar.settings';
const STATUS_CONFIG_STORAGE_PREFIX = 'tasks.statusConfig';
const LEGACY_STATUS_COLORS_STORAGE_PREFIX = 'tasks.statusColors';

const DEFAULT_STATUS_COLORS = {
  'to_do': '#94a3b8',
  'in_progress': '#60a5fa',
  'paused': '#9ca3af',
  'in_review': '#fbbf24',
  'completed': '#34d399',
  'cancelled': '#f87171',
  'archived': '#6b7280',
};

const DEFAULT_SETTINGS = {
  weekStart: 0, // 0 = Sunday, 1 = Monday
  syncTasks: true,
  eventCardStyle: 'frame',
};

function loadStatusConfig() {
  if (typeof window === 'undefined') return DEFAULT_STATUS_COLORS;
  try {
    const accountId = getAccountStorageId();
    const legacyRaw = localStorage.getItem(`tasks.statusColors.${accountId}`);
    const legacyColors = legacyRaw ? JSON.parse(legacyRaw) : {};
    const raw = localStorage.getItem(`tasks.statusConfig.${accountId}`);
    const config = raw ? JSON.parse(raw) : {};
    
    return ['to_do', 'in_progress', 'paused', 'in_review', 'completed', 'cancelled', 'archived'].reduce((acc, status) => {
      const value = config[status];
      const color = (typeof value === 'object' ? value?.color : value) || legacyColors[status] || DEFAULT_STATUS_COLORS[status];
      acc[status] = color;
      return acc;
    }, {});
  } catch {
    return DEFAULT_STATUS_COLORS;
  }
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

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const key = `${SETTINGS_STORAGE_KEY}.${getAccountStorageId()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    const key = `${SETTINGS_STORAGE_KEY}.${getAccountStorageId()}`;
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save calendar settings:', err);
  }
}

export default function Calendar() {
  const toast = useToast();
  const isMobile = useIsMobile(1024);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState(loadSettings);
  const [statusColors, setStatusColors] = useState(loadStatusConfig);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date(), settings.weekStart));
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [enabledCalendarIds, setEnabledCalendarIds] = useState(new Set());
  const [isMyCalendarsOpen, setIsMyCalendarsOpen] = useState(true);
  const [isOtherCalendarsOpen, setIsOtherCalendarsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileAgendaStart, setMobileAgendaStart] = useState(() =>
    startOfDay(addDays(new Date(), -MOBILE_AGENDA_INITIAL_PAST_DAYS))
  );
  const [mobileAgendaEnd, setMobileAgendaEnd] = useState(() =>
    endOfDay(addDays(new Date(), MOBILE_AGENDA_INITIAL_FUTURE_DAYS))
  );
  const [isMobileAgendaLoadingMore, setIsMobileAgendaLoadingMore] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateCalendarModalOpen, setIsCreateCalendarModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [slotStart, setSlotStart] = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [accountToDisconnect, setAccountToDisconnect] = useState(null);
  const settingsRef = useRef(null);
  const previousIsMobileRef = useRef(isMobile);

  // Check for stored tokens on mount & handle OAuth callback params
  useEffect(() => {
    const loadedAccounts = calendarApi.getAccounts();
    setAccounts(loadedAccounts);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('google_access_token');
      const refreshToken = params.get('google_refresh_token');
      const expiryDate = params.get('google_expiry_date');
      const email = params.get('google_email');
      const picture = params.get('google_picture');
      const scope = params.get('google_scope');
      const googleError = params.get('google_error');

      if (googleError) {
        setError(`Google connection failed: ${googleError}`);
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (accessToken && email) {
        const tokens = {
          access_token: accessToken,
          refresh_token: refreshToken || null,
          expiry_date: expiryDate ? parseInt(expiryDate, 10) : null,
        };
        calendarApi.saveAccount(tokens, email, picture, scope);
        setAccounts(calendarApi.getAccounts());
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const initializeEnabledCalendars = useCallback((calendars) => {
    if (enabledCalendarIds.size !== 0 || calendars.length === 0) return;

    const selectedIds = calendars
      .filter((calendar) => calendar.selected)
      .map((calendar) => `${calendar.accountEmail}-${calendar.id}`);

    setEnabledCalendarIds(
      new Set(
        selectedIds.length > 0
          ? selectedIds
          : calendars.map((calendar) => `${calendar.accountEmail}-${calendar.id}`)
      )
    );
  }, [enabledCalendarIds.size]);

  const loadCalendarRange = useCallback(async (startDate, endDate) => {
    const activeAccounts = accounts.filter((account) => account.active);

    if (activeAccounts.length === 0) {
      return { events: [], calendars: [], errors: [] };
    }

    const calendarResults = await Promise.allSettled(
      activeAccounts.map((account) =>
        calendarApi
          .getEvents(account, startDate.toISOString(), endDate.toISOString())
          .then((response) => ({ accountEmail: account.email, ...response }))
      )
    );

    let allEvents = [];
    let allCalendars = [];
    let errors = [];

    calendarResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        allEvents = [...allEvents, ...result.value.events];
        allCalendars = [...allCalendars, ...result.value.calendars];
        return;
      }

      console.error('Failed to fetch calendar data:', result.reason);
      if (result.reason?.email) {
        errors.push(result.reason.email);
      }
    });

    return {
      events: allEvents.sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime()),
      calendars: allCalendars,
      errors,
    };
  }, [accounts]);

  const loadTaskData = useCallback(async () => {
    if (!settings.syncTasks) {
      return { tasks: [], taskTypes: [] };
    }

    const [tasksResult, taskTypesResult] = await Promise.allSettled([
      tasksApi.getTasks(),
      tasksApi.getTaskTypes(),
    ]);

    if (tasksResult.status === 'rejected') {
      console.error('Failed to fetch tasks:', tasksResult.reason);
    }

    if (taskTypesResult.status === 'rejected') {
      console.error('Failed to fetch task types:', taskTypesResult.reason);
    }

    return {
      tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : [],
      taskTypes: taskTypesResult.status === 'fulfilled' ? taskTypesResult.value : [],
    };
  }, [settings.syncTasks]);

  const fetchEvents = useCallback(async () => {
    const rangeStart = isMobile
      ? startOfDay(mobileAgendaStart)
      : addDays(startOfDay(weekStart), -7);
    const rangeEnd = isMobile
      ? endOfDay(mobileAgendaEnd)
      : endOfDay(addDays(getWeekEnd(weekStart, settings.weekStart), 7));

    setLoading(true);
    setError(null);

    try {
      const [calendarData, taskData] = await Promise.all([
        loadCalendarRange(rangeStart, rangeEnd),
        loadTaskData(),
      ]);

      if (calendarData.errors.length > 0) {
        setError(`Failed to sync calendar: ${calendarData.errors.join(', ')}. Try reconnecting these accounts.`);
      }

      setEvents(calendarData.events);
      setAvailableCalendars(calendarData.calendars);
      setTasks(taskData.tasks);
      setTaskTypes(taskData.taskTypes);
      initializeEnabledCalendars(calendarData.calendars);
    } catch (err) {
      console.error('Failed to fetch calendar data:', err);
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    isMobile,
    mobileAgendaEnd,
    mobileAgendaStart,
    weekStart,
    settings.weekStart,
    loadCalendarRange,
    loadTaskData,
    initializeEnabledCalendars,
  ]);

  const loadMoreMobileAgenda = useCallback(async () => {
    if (!isMobile || loading || isMobileAgendaLoadingMore) return;

    const nextRangeStart = startOfDay(addDays(mobileAgendaEnd, 1));
    const nextRangeEnd = endOfDay(addDays(nextRangeStart, MOBILE_AGENDA_LOAD_MORE_DAYS - 1));

    setIsMobileAgendaLoadingMore(true);

    try {
      const calendarData = await loadCalendarRange(nextRangeStart, nextRangeEnd);

      if (calendarData.errors.length > 0) {
        setError(`Failed to sync calendar: ${calendarData.errors.join(', ')}. Try reconnecting these accounts.`);
      }

      setEvents((currentEvents) =>
        mergeByKey(currentEvents, calendarData.events, getEventKey).sort(
          (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime()
        )
      );
      setAvailableCalendars((currentCalendars) =>
        mergeByKey(currentCalendars, calendarData.calendars, getCalendarKey)
      );
      initializeEnabledCalendars(calendarData.calendars);
      setMobileAgendaEnd(nextRangeEnd);
    } catch (err) {
      console.error('Failed to extend mobile agenda:', err);
      setError('Failed to load more events. Please try again.');
    } finally {
      setIsMobileAgendaLoadingMore(false);
    }
  }, [
    isMobile,
    loading,
    isMobileAgendaLoadingMore,
    mobileAgendaEnd,
    loadCalendarRange,
    initializeEnabledCalendars,
  ]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    saveSettings(settings);
    setWeekStart(getWeekStart(selectedDate, settings.weekStart));
  }, [settings, selectedDate]);

  useEffect(() => {
    if (!isSettingsOpen) return undefined;
    function handleClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const resetMobileAgendaWindow = useCallback((anchorDate) => {
    const nextStart = startOfDay(addDays(anchorDate, -MOBILE_AGENDA_INITIAL_PAST_DAYS));
    const nextEnd = endOfDay(addDays(anchorDate, MOBILE_AGENDA_INITIAL_FUTURE_DAYS));
    setMobileAgendaStart(nextStart);
    setMobileAgendaEnd(nextEnd);
  }, []);

  useEffect(() => {
    if (isMobile && !previousIsMobileRef.current) {
      resetMobileAgendaWindow(selectedDate);
    }

    if (!isMobile) {
      setIsMobileSidebarOpen(false);
    }

    previousIsMobileRef.current = isMobile;
  }, [isMobile, resetMobileAgendaWindow, selectedDate]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

  // Event Handlers
  const handleSaveEvent = async (eventData, calendarId, accountEmail, options = {}) => {
    const account = accounts.find(a => a.email === accountEmail);
    if (!account) {
      toast('Account not found', 'error');
      return;
    }

    try {
      // Permission check
      const SCOPES = require('@/lib/api/calendar').SCOPES;
      if (!calendarApi.hasPermission(account, SCOPES.CALENDAR_EVENTS)) {
        toast('Insufficient permissions to manage events. Please reconnect with full access.', 'error');
        return;
      }

      if (editingEvent) {
        await calendarApi.updateEvent(account, editingEvent.id, eventData, calendarId, options);
        if (options?.recurringEdit?.mode === 'future') {
          toast('Updated this and future events');
        } else {
          toast('Event updated successfully');
        }
      } else {
        await calendarApi.createEvent(account, eventData, calendarId);
        toast('Event created successfully');
      }
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save event', 'error');
    }
  };

  const handleDeleteEvent = async (eventId, calendarId, accountEmail, options = {}) => {
    const account = accounts.find(a => a.email === accountEmail);
    if (!account) {
      toast('Account not found', 'error');
      return;
    }

    try {
      // Permission check
      const SCOPES = require('@/lib/api/calendar').SCOPES;
      if (!calendarApi.hasPermission(account, SCOPES.CALENDAR_EVENTS)) {
        toast('Insufficient permissions to delete events. Please reconnect with full access.', 'error');
        return;
      }

      await calendarApi.deleteEvent(account, eventId, calendarId, options);
      if (options?.recurringDelete?.mode === 'future') {
        toast('Deleted this and future events');
      } else {
        toast('Event deleted successfully');
      }
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to delete event', 'error');
    }
  };

  const handleCreateCalendar = async (calendarData) => {
    const activeAccounts = accounts.filter(a => a.active);
    if (activeAccounts.length === 0) {
      toast('No active Google accounts found', 'error');
      return;
    }

    // Default to first active account for now
    const account = activeAccounts[0];

    setLoading(true);
    try {
      // Permission check
      const SCOPES = require('@/lib/api/calendar').SCOPES;
      if (!calendarApi.hasPermission(account, SCOPES.CALENDAR)) {
        toast('Insufficient permissions to create calendars. Please reconnect with full access.', 'error');
        return;
      }

      await calendarApi.createCalendar(account, calendarData);
      toast('Calendar created successfully');
      fetchEvents();
    } catch (err) {
      console.error('Failed to create calendar:', err);
      toast(err.message || 'Failed to create calendar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleCalendar = (id) => {
    const newEnabled = new Set(enabledCalendarIds);
    if (newEnabled.has(id)) {
      newEnabled.delete(id);
    } else {
      newEnabled.add(id);
    }
    setEnabledCalendarIds(newEnabled);
  };

  const openCreateModal = (prefilledDate, options = {}) => {
    setEditingEvent(null);
    setSlotStart(options.slotStart || null);
    if (prefilledDate) setSelectedDate(prefilledDate);
    setIsModalOpen(true);
  };

  const openEditModal = async (event) => {
    setEditingEvent(event);
    setSlotStart(null);
    setIsModalOpen(true);

    if (!event?.accountEmail || !event?.recurringEventId || event?.recurrence?.length) {
      return;
    }

    const account = accounts.find((item) => item.email === event.accountEmail);
    if (!account) return;

    try {
      const detailedEvent = await calendarApi.getEvent(
        account,
        event.id,
        event.calendarId || 'primary',
        { resolveRecurrence: true }
      );

      if (detailedEvent) {
        setEditingEvent(detailedEvent);
      }
    } catch (err) {
      console.error('Failed to load recurring event details:', err);
    }
  };

  // Navigation
  const goToPrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
    setSelectedDate((current) => {
      const nextDate = new Date(current);
      nextDate.setDate(nextDate.getDate() - 7);
      if (isMobile) {
        resetMobileAgendaWindow(nextDate);
      }
      return nextDate;
    });
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
    setSelectedDate((current) => {
      const nextDate = new Date(current);
      nextDate.setDate(nextDate.getDate() + 7);
      if (isMobile) {
        resetMobileAgendaWindow(nextDate);
      }
      return nextDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setWeekStart(getWeekStart(today, settings.weekStart));
    if (isMobile) {
      resetMobileAgendaWindow(today);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setWeekStart(getWeekStart(date, settings.weekStart));
    if (isMobile) {
      resetMobileAgendaWindow(date);
    }
  };

  const handleConnect = () => {
    window.location.href = calendarApi.getAuthUrl();
  };

  const handleToggleAccount = (email) => {
    calendarApi.toggleAccount(email);
    setAccounts(calendarApi.getAccounts());
  };

  const handleDisconnectAccount = (email) => {
    setAccountToDisconnect(email);
  };

  const handleSlotClick = (slotDate) => {
    openCreateModal(slotDate, { slotStart: slotDate });
  };

  return (
    <div className="calContainer">
      {/* Top Header Bar */}
      <header className="calHeader">
        <div className="calHeaderLeft">
          <h1 className="calTitle">
            <CalIcon size={20} className="glow-icon" />
            {formatWeekRange(weekStart)}
          </h1>
        </div>

        <div className="calHeaderRight">
          {isMobile && accounts.length > 0 && (
            <button
              className="calTodayBtn calSidebarToggleBtn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={16} />
            </button>
          )}
          {accounts.length > 0 && (
            <button className="calBookBtn" onClick={() => openCreateModal()}>
              <Plus size={16} />
              <span>Book Event</span>
            </button>
          )}
          <button className="calTodayBtn" onClick={goToToday}>Today</button>
          <div className="calNavButtons">
            <button className="calNavBtn" onClick={goToPrevWeek} title="Previous Week">
              <ChevronLeft size={16} />
            </button>
            <button className="calNavBtn" onClick={goToNextWeek} title="Next Week">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="calSettingsWrap" ref={settingsRef}>
            <button 
              className="calNavBtn" 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="Calendar Settings"
            >
              <Settings2 size={16} />
            </button>
            {isSettingsOpen && (
              <div className="calSettingsPopover glass">
                <div className="calSettingsGroup">
                  <label>Week Start</label>
                  <CustomSelect
                    options={[
                      { value: 0, label: 'Sunday' },
                      { value: 1, label: 'Monday' },
                      { value: 6, label: 'Saturday' }
                    ]}
                    value={settings.weekStart}
                    onChange={(val) => setSettings(s => ({ ...s, weekStart: parseInt(val) }))}
                  />
                </div>
                <div className="calSettingsGroup">
                  <label>Event Cards</label>
                  <CustomSelect
                    options={[
                      { value: 'frame', label: 'Colored Frame' },
                      { value: 'filled', label: 'Full Color' },
                    ]}
                    value={settings.eventCardStyle}
                    onChange={(value) => setSettings((s) => ({ ...s, eventCardStyle: value }))}
                  />
                </div>
                <div className="calSettingsGroup">
                  <label className="calCheckboxLabel">
                    <input
                      type="checkbox"
                      checked={settings.syncTasks}
                      onChange={(e) => setSettings(s => ({ ...s, syncTasks: e.target.checked }))}
                    />
                    Sync Tasks
                  </label>
                </div>
              </div>
            )}
          </div>
          {accounts.length > 0 && (
            <button className="calNavBtn" onClick={fetchEvents} title="Refresh Events" disabled={loading}>
              <RefreshCw size={14} className={loading ? 'infinite-spin' : ''} />
            </button>
          )}
        </div>
      </header>

      <AccountSwitcher 
        accounts={accounts}
        onConnect={handleConnect}
        onToggle={handleToggleAccount}
        onDisconnect={handleDisconnectAccount}
      />

      {error && <div className="calError">{error}</div>}

      {accounts.length === 0 ? (
        <div className="calMainEmptyState">
          <div className="calMainEmptyIcon">
            <CalIcon size={64} strokeWidth={1} />
          </div>
          <h2 className="calMainEmptyTitle">Cloud Calendar Sync</h2>
          <p className="calMainEmptyText">
            Connect your Google Calendar to synchronize your schedule, track meetings, and visualize your time in one place.
          </p>
        </div>
      ) : (
        isMobile ? (
          <div className="calMobileLayout">
            <CalendarMobileView
              agendaStart={mobileAgendaStart}
              agendaEnd={mobileAgendaEnd}
              events={events}
              tasks={settings.syncTasks ? tasks : []}
              enabledCalendarIds={enabledCalendarIds}
              eventCardStyle={settings.eventCardStyle}
              isLoadingMore={isMobileAgendaLoadingMore}
              onLoadMore={loadMoreMobileAgenda}
              onEventClick={openEditModal}
              onTaskClick={(task) => setDetailTaskId(task.id)}
              onCreateForDate={openCreateModal}
            />

            <div
              className={`calMobileSidebarOverlay ${isMobileSidebarOpen ? 'isOpen' : ''}`}
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden={isMobileSidebarOpen ? 'false' : 'true'}
            >
              <aside
                className={`calMobileSidebar glass ${isMobileSidebarOpen ? 'isOpen' : ''}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="calMobileSidebarHeader">
                  <div>
                    <span className="calMobileSidebarLabel">Calendar Panel</span>
                    <h2 className="calMobileSidebarTitle">Schedule sources</h2>
                  </div>
                  <button
                    type="button"
                    className="calMobileSidebarClose"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-label="Close sidebar"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="calMobileSidebarBody">
                  <MiniCalendar
                    key={`${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
                    selectedDate={selectedDate}
                    onDateSelect={(date) => {
                      handleDateSelect(date);
                      setIsMobileSidebarOpen(false);
                    }}
                    events={events}
                    enabledCalendarIds={enabledCalendarIds}
                    weekStartDay={settings.weekStart}
                  />

                  <CalendarToggles
                    availableCalendars={availableCalendars}
                    enabledCalendarIds={enabledCalendarIds}
                    isMyCalendarsOpen={isMyCalendarsOpen}
                    isOtherCalendarsOpen={isOtherCalendarsOpen}
                    onToggleCalendar={toggleCalendar}
                    onToggleMyCalendars={() => setIsMyCalendarsOpen((current) => !current)}
                    onToggleOtherCalendars={() => setIsOtherCalendarsOpen((current) => !current)}
                    onOpenCreateCalendar={() => {
                      setIsCreateCalendarModalOpen(true);
                      setIsMobileSidebarOpen(false);
                    }}
                  />
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="calLayout">
            <aside className="calSidebar">
              <MiniCalendar
                key={`${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                events={events}
                enabledCalendarIds={enabledCalendarIds}
                weekStartDay={settings.weekStart}
              />

              <CalendarToggles
                availableCalendars={availableCalendars}
                enabledCalendarIds={enabledCalendarIds}
                isMyCalendarsOpen={isMyCalendarsOpen}
                isOtherCalendarsOpen={isOtherCalendarsOpen}
                onToggleCalendar={toggleCalendar}
                onToggleMyCalendars={() => setIsMyCalendarsOpen((current) => !current)}
                onToggleOtherCalendars={() => setIsOtherCalendarsOpen((current) => !current)}
                onOpenCreateCalendar={() => setIsCreateCalendarModalOpen(true)}
              />
            </aside>

            <main className="calMain">
              <WeekGrid
                weekStart={weekStart}
                events={events}
                tasks={settings.syncTasks ? tasks : []}
                enabledCalendarIds={enabledCalendarIds}
                eventCardStyle={settings.eventCardStyle}
                onEventClick={openEditModal}
                onSlotClick={handleSlotClick}
                onTaskClick={(task) => setDetailTaskId(task.id)}
              />
            </main>
          </div>
        )
      )}

      {detailTaskId && (
        <TaskDetailModal
          task={tasks.find(t => t.id === detailTaskId)}
          allTasks={tasks}
          taskTypes={taskTypes}
          onClose={() => setDetailTaskId(null)}
          onSave={async (id, data) => {
            await tasksApi.updateTask(id, data);
            fetchEvents();
          }}
          onDelete={(id) => setTaskToDelete({ id, isSubtask: false })}
          onUpdateStatus={async (id, status) => {
            await tasksApi.updateTaskStatus(id, status);
            fetchEvents();
          }}
          onCreateSubtask={async (parentId, data) => {
            await tasksApi.createTask({ ...data, parent_task_id: parentId });
            fetchEvents();
          }}
          onDeleteSubtask={(id) => setTaskToDelete({ id, isSubtask: true })}
          onOpenTask={(id) => setDetailTaskId(id)}
          onOpenTypeManager={() => {}} // Optional
          statusColors={statusColors}
        />
      )}

      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          event={editingEvent}
          selectedDate={selectedDate}
          defaultStart={slotStart}
          availableCalendars={availableCalendars}
          accounts={accounts}
        />
      )}

      {isCreateCalendarModalOpen && (
        <CreateCalendarModal
          isOpen={isCreateCalendarModalOpen}
          onClose={() => setIsCreateCalendarModalOpen(false)}
          onCreate={handleCreateCalendar}
        />
      )}

      <ConfirmModal
        isOpen={!!taskToDelete}
        title={taskToDelete?.isSubtask ? "Delete Subtask?" : "Delete Task?"}
        message={taskToDelete?.isSubtask 
          ? "Are you sure you want to delete this subtask? This action cannot be undone." 
          : "Are you sure you want to delete this task? This action cannot be undone."}
        confirmText="Delete"
        onConfirm={async () => {
          if (!taskToDelete) return;
          try {
            await tasksApi.deleteTasksBulk({ task_ids: [taskToDelete.id] });
            if (!taskToDelete.isSubtask && taskToDelete.id === detailTaskId) {
              setDetailTaskId(null);
            }
            fetchEvents();
            toast(taskToDelete.isSubtask ? 'Subtask deleted' : 'Task deleted', 'success');
          } catch (err) {
            console.error('Failed to delete task', err);
            toast('Failed to delete task', 'error');
          } finally {
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!accountToDisconnect}
        title="Disconnect Account"
        message={`Are you sure you want to disconnect ${accountToDisconnect}? You will no longer see events from this account.`}
        confirmText="Disconnect"
        onConfirm={() => {
          if (accountToDisconnect) {
            calendarApi.removeAccount(accountToDisconnect);
            setAccounts(calendarApi.getAccounts());
            toast(`Account ${accountToDisconnect} disconnected`);
            setAccountToDisconnect(null);
          }
        }}
        onCancel={() => setAccountToDisconnect(null)}
      />
    </div>
  );
}
