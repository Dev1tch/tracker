import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, RefreshCw, Plus, ChevronDown, Settings2 } from 'lucide-react';
import { calendarApi, tasksApi, authApi, TASK_STATUS } from '@/lib/api';
import AccountSwitcher from './components/AccountSwitcher';
import EventModal from './components/EventModal';
import CreateCalendarModal from './components/CreateCalendarModal';
import MiniCalendar from './components/MiniCalendar';
import WeekGrid from './components/WeekGrid';
import TaskDetailModal from '@/features/tasks/components/TasksBoard/components/TaskDetailModal';
import CustomSelect from '@/components/ui/CustomSelect';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/ToastProvider';
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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateCalendarModalOpen, setIsCreateCalendarModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [accountToDisconnect, setAccountToDisconnect] = useState(null);
  const settingsRef = useRef(null);

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

  // Fetch events when connected or week changes
  const fetchEvents = useCallback(async () => {
    const activeAccounts = accounts.filter(a => a.active);
    
    setLoading(true);
    setError(null);

    try {
      const startDate = new Date(weekStart);
      startDate.setDate(startDate.getDate() - 7); 
      const endDate = getWeekEnd(weekStart, settings.weekStart);
      endDate.setDate(endDate.getDate() + 7);

      const promises = [];
      
      // Google Calendar Events
      if (activeAccounts.length > 0) {
        activeAccounts.forEach(account => {
          promises.push(
            calendarApi.getEvents(
              account,
              startDate.toISOString(),
              endDate.toISOString()
            ).then(res => ({ type: 'calendar', accountEmail: account.email, ...res }))
          );
        });
      }

      // Tasks
      const shouldSyncTasks = settings.syncTasks;
      if (shouldSyncTasks) {
        promises.push(tasksApi.getTasks().then(res => ({ type: 'tasks', tasks: res })));
        promises.push(tasksApi.getTaskTypes().then(res => ({ type: 'taskTypes', taskTypes: res })));
      }

      const results = await Promise.allSettled(promises);
      
      let allEvents = [];
      let allCalendars = [];
      let allTasks = [];
      let allTaskTypes = [];
      let errors = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.type === 'calendar') {
            allEvents = [...allEvents, ...data.events];
            allCalendars = [...allCalendars, ...data.calendars];
          } else if (data.type === 'tasks') {
            allTasks = data.tasks;
          } else if (data.type === 'taskTypes') {
            allTaskTypes = data.taskTypes;
          }
        } else {
          console.error('Failed to fetch data:', result.reason);
          if (result.reason.email) {
            errors.push(result.reason.email);
          }
        }
      });

      if (errors.length > 0) {
        setError(`Failed to sync calendar: ${errors.join(', ')}. Try reconnecting these accounts.`);
      }

      setEvents(allEvents);
      setAvailableCalendars(allCalendars);
      setTasks(allTasks);
      setTaskTypes(allTaskTypes);

      // Initialize enabled calendars if not set
      if (enabledCalendarIds.size === 0 && allCalendars.length > 0) {
        const selectedIds = allCalendars.filter(c => c.selected).map(c => `${c.accountEmail}-${c.id}`);
        setEnabledCalendarIds(new Set(selectedIds.length > 0 ? selectedIds : allCalendars.map(c => `${c.accountEmail}-${c.id}`)));
      }
    } catch (err) {
      console.error('Failed to fetch calendar data:', err);
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [weekStart, accounts, enabledCalendarIds.size, settings.syncTasks, settings.weekStart]);

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

  // Event Handlers
  const handleSaveEvent = async (eventData, calendarId, accountEmail) => {
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
        await calendarApi.updateEvent(account, editingEvent.id, eventData, calendarId);
        toast('Event updated successfully');
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

  const handleDeleteEvent = async (eventId, calendarId, accountEmail) => {
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

      await calendarApi.deleteEvent(account, eventId, calendarId);
      toast('Event deleted successfully');
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

  const openCreateModal = (prefilledDate) => {
    setEditingEvent(null);
    if (prefilledDate) setSelectedDate(prefilledDate);
    setIsModalOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  // Navigation
  const goToPrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setWeekStart(getWeekStart(today, settings.weekStart));
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setWeekStart(getWeekStart(date, settings.weekStart));
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
    setSelectedDate(slotDate);
    openCreateModal(slotDate);
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
        <div className="calLayout">
          {/* Left Sidebar */}
          <aside className="calSidebar">
            <MiniCalendar
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              events={events}
              enabledCalendarIds={enabledCalendarIds}
            />

            <div className="calCalendarToggles">
              <div className="calTogglesHeader" onClick={() => setIsMyCalendarsOpen(!isMyCalendarsOpen)}>
                <h4 className="calTogglesTitle">My Calendars</h4>
                <div className="calTogglesActions">
                  <button
                    className="calAddCalendarBtn"
                    onClick={(e) => { e.stopPropagation(); setIsCreateCalendarModalOpen(true); }}
                    title="Add calendar (primary account)"
                  >
                    <Plus size={14} />
                  </button>
                  <ChevronDown size={14} style={{ transform: isMyCalendarsOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                </div>
              </div>

              {isMyCalendarsOpen && availableCalendars
                .filter(cal => cal.accessRole === 'owner' || cal.accessRole === 'writer')
                .map(cal => (
                  <label key={`${cal.accountEmail}-${cal.id}`} className="calToggleItem" style={{ '--toggle-color': cal.backgroundColor }}>
                    <input
                      type="checkbox"
                      checked={enabledCalendarIds.has(`${cal.accountEmail}-${cal.id}`)}
                      onChange={() => toggleCalendar(`${cal.accountEmail}-${cal.id}`)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="calToggleSummary">{cal.summary}</span>
                      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>{cal.accountEmail}</span>
                    </div>
                  </label>
                ))}

              <div className="calTogglesHeader" onClick={() => setIsOtherCalendarsOpen(!isOtherCalendarsOpen)} style={{ marginTop: '15px' }}>
                <h4 className="calTogglesTitle">Other Calendars</h4>
                <ChevronDown size={14} style={{ transform: isOtherCalendarsOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
              </div>

              {isOtherCalendarsOpen && availableCalendars
                .filter(cal => cal.accessRole !== 'owner' && cal.accessRole !== 'writer')
                .map(cal => (
                  <label key={`${cal.accountEmail}-${cal.id}`} className="calToggleItem" style={{ '--toggle-color': cal.backgroundColor }}>
                    <input
                      type="checkbox"
                      checked={enabledCalendarIds.has(`${cal.accountEmail}-${cal.id}`)}
                      onChange={() => toggleCalendar(`${cal.accountEmail}-${cal.id}`)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="calToggleSummary">{cal.summary}</span>
                      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>{cal.accountEmail}</span>
                    </div>
                  </label>
                ))}
            </div>

          </aside>

          {/* Main Week Grid */}
          <main className="calMain">
            <WeekGrid
              weekStart={weekStart}
              events={events}
              tasks={settings.syncTasks ? tasks : []}
              enabledCalendarIds={enabledCalendarIds}
              onEventClick={openEditModal}
              onSlotClick={handleSlotClick}
              onTaskClick={(task) => setDetailTaskId(task.id)}
            />
          </main>
        </div>
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
