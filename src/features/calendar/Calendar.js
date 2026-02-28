'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, RefreshCw, Plus, ChevronDown } from 'lucide-react';
import { calendarApi } from '@/lib/api';
import AccountSwitcher from './components/AccountSwitcher';
import EventModal from './components/EventModal';
import CreateCalendarModal from './components/CreateCalendarModal';
import MiniCalendar from './components/MiniCalendar';
import WeekGrid from './components/WeekGrid';
import './Calendar.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date) {
  const start = getWeekStart(date);
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

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [events, setEvents] = useState([]);
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
  const [editingEvent, setEditingEvent] = useState(null);

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
        calendarApi.saveAccount(tokens, email, picture);
        setAccounts(calendarApi.getAccounts());
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Fetch events when connected or week changes
  const fetchEvents = useCallback(async () => {
    const activeAccounts = accounts.filter(a => a.active);
    if (activeAccounts.length === 0) {
      setEvents([]);
      setAvailableCalendars([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startDate = new Date(weekStart);
      startDate.setDate(startDate.getDate() - 7); 
      const endDate = getWeekEnd(weekStart);
      endDate.setDate(endDate.getDate() + 7);

      const fetchPromises = activeAccounts.map(account => 
        calendarApi.getEvents(
          account,
          startDate.toISOString(),
          endDate.toISOString()
        )
      );

      const results = await Promise.allSettled(fetchPromises);
      
      let allEvents = [];
      let allCalendars = [];
      let errors = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allEvents = [...allEvents, ...result.value.events];
          allCalendars = [...allCalendars, ...result.value.calendars];
        } else {
          console.error('Failed to fetch events for account:', result.reason);
          errors.push(result.reason.email || 'Unknown account');
        }
      });

      if (errors.length > 0) {
        setError(`Failed to sync: ${errors.join(', ')}. Try reconnecting these accounts.`);
      }

      setEvents(allEvents);
      setAvailableCalendars(allCalendars);

      // Initialize enabled calendars if not set
      if (enabledCalendarIds.size === 0 && allCalendars.length > 0) {
        const selectedIds = allCalendars.filter(c => c.selected).map(c => `${c.accountEmail}-${c.id}`);
        setEnabledCalendarIds(new Set(selectedIds.length > 0 ? selectedIds : allCalendars.map(c => `${c.accountEmail}-${c.id}`)));
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [weekStart, accounts, enabledCalendarIds.size]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Event Handlers
  const handleSaveEvent = async (eventData, calendarId) => {
    const tokens = calendarApi.getTokens();
    if (!tokens) return;

    if (editingEvent) {
      await calendarApi.updateEvent(tokens, editingEvent.id, eventData, calendarId);
    } else {
      await calendarApi.createEvent(tokens, eventData, calendarId);
    }
    fetchEvents();
  };

  const handleDeleteEvent = async (eventId, calendarId, accountEmail) => {
    const account = accounts.find(a => a.email === accountEmail);
    if (!account) return;

    await calendarApi.deleteEvent(account, eventId, calendarId);
    fetchEvents();
  };

  const handleCreateCalendar = async (calendarData) => {
    const tokens = calendarApi.getTokens();
    if (!tokens) return;

    setLoading(true);
    try {
      await calendarApi.createCalendar(tokens, calendarData);
      fetchEvents();
    } catch (err) {
      console.error('Failed to create calendar:', err);
      alert('Failed to create calendar');
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
    setWeekStart(getWeekStart(today));
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setWeekStart(getWeekStart(date));
  };

  const handleConnect = () => {
    window.location.href = calendarApi.getAuthUrl();
  };

  const handleToggleAccount = (email) => {
    calendarApi.toggleAccount(email);
    setAccounts(calendarApi.getAccounts());
  };

  const handleDisconnectAccount = (email) => {
    if (confirm(`Disconnected account ${email}?`)) {
      calendarApi.removeAccount(email);
      setAccounts(calendarApi.getAccounts());
    }
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
          <span className="calViewLabel">Week</span>
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
              enabledCalendarIds={enabledCalendarIds}
              onEventClick={openEditModal}
              onSlotClick={handleSlotClick}
            />
          </main>
        </div>
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
        />
      )}

      {isCreateCalendarModalOpen && (
        <CreateCalendarModal
          isOpen={isCreateCalendarModalOpen}
          onClose={() => setIsCreateCalendarModalOpen(false)}
          onCreate={handleCreateCalendar}
        />
      )}
    </div>
  );
}
