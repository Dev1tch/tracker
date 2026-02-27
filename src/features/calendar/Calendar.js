'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Info, RefreshCw, Plus, ChevronDown } from 'lucide-react';
import { calendarApi } from '@/lib/api';
import GoogleConnectButton from './components/GoogleConnectButton';
import EventCard from './components/EventCard';
import EventModal from './components/EventModal';
import CreateCalendarModal from './components/CreateCalendarModal';
import './Calendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [enabledCalendarIds, setEnabledCalendarIds] = useState(new Set());
  const [isMyCalendarsOpen, setIsMyCalendarsOpen] = useState(true);
  const [isOtherCalendarsOpen, setIsOtherCalendarsOpen] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateCalendarModalOpen, setIsCreateCalendarModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Check for stored tokens on mount & handle OAuth callback params
  useEffect(() => {
    setConnected(calendarApi.isConnected());

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('google_access_token');
      const refreshToken = params.get('google_refresh_token');
      const expiryDate = params.get('google_expiry_date');
      const googleError = params.get('google_error');

      if (googleError) {
        setError(`Google connection failed: ${googleError}`);
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (accessToken) {
        const tokens = {
          access_token: accessToken,
          refresh_token: refreshToken || null,
          expiry_date: expiryDate ? parseInt(expiryDate, 10) : null,
        };
        calendarApi.saveTokens(tokens);
        setConnected(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Fetch events when connected or month changes
  const fetchEvents = useCallback(async () => {
    if (!calendarApi.isConnected()) return;

    setLoading(true);
    setError(null);

    try {
      const tokens = calendarApi.getTokens();

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - firstDay.getDay());
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
      endDate.setHours(23, 59, 59, 999);

       const { events: fetchedEvents, calendars: fetchedCalendars } = await calendarApi.getEvents(
        tokens,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      setEvents(fetchedEvents);
      setAvailableCalendars(fetchedCalendars);
      
      // Initialize enabled calendars if not set
      if (enabledCalendarIds.size === 0 && fetchedCalendars.length > 0) {
        const selectedIds = fetchedCalendars.filter(c => c.selected).map(c => c.id);
        setEnabledCalendarIds(new Set(selectedIds.length > 0 ? selectedIds : fetchedCalendars.map(c => c.id)));
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
      if (err.code === 'TOKEN_EXPIRED' || err.status === 401 || err.code === 'FORBIDDEN' || err.status === 403) {
        setError('Connection lost. Please reconnect Google Calendar.');
        calendarApi.clearTokens();
        setConnected(false);
      } else {
        setError('Failed to load events. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

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

  const handleDeleteEvent = async (eventId, calendarId) => {
    const tokens = calendarApi.getTokens();
    if (!tokens) return;

    await calendarApi.deleteEvent(tokens, eventId, calendarId);
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

  const openCreateModal = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  // Navigation
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleConnect = () => {
    window.location.href = calendarApi.getAuthUrl();
  };
  const handleDisconnect = () => {
    calendarApi.clearTokens();
    setConnected(false);
    setEvents([]);
    setSelectedDate(new Date());
    setAvailableCalendars([]);
    setEnabledCalendarIds(new Set());
  };

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, daysInPrevMonth - i),
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      date: new Date(year, month, d),
    });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

   const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((event) => {
      const eventDate = event.start.substring(0, 10);
      return eventDate === dateStr && enabledCalendarIds.has(event.calendarId);
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const selectedEvents = getEventsForDate(selectedDate);

  return (
    <div className="calContainer">
      <header className="calHeader">
        <div className="calHeaderTop">
          <h1 className="calTitle">
            <CalIcon size={20} className="glow-icon" />
            {MONTHS[month]} {year}
          </h1>
          
          <div className="calHeaderActions">
            <button className="calTodayBtn" onClick={goToToday}>Today</button>
            <div className="calNavButtons">
              <button className="calNavBtn" onClick={goToPrevMonth} title="Previous Month">
                <ChevronLeft size={16} />
              </button>
              <button className="calNavBtn" onClick={goToNextMonth} title="Next Month">
                <ChevronRight size={16} />
              </button>
            </div>
            {connected && (
              <button className="calNavBtn" onClick={fetchEvents} title="Refresh Events" disabled={loading}>
                <RefreshCw size={14} className={loading ? 'infinite-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        <GoogleConnectButton
          isConnected={connected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </header>

      {error && <div className="calError">{error}</div>}

      {!connected ? (
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
        <div className="calMainView">
          <div className="calGridWrapper glass">
            <div className="calGridHeader">
              {DAYS.map(day => <div key={day} className="calDayName">{day}</div>)}
            </div>
            <div className="calGridItems">
              {calendarDays.map((cell, i) => {
                const dayEvents = getEventsForDate(cell.date);
                const hasEvents = dayEvents.length > 0;
                
                return (
                  <button
                    key={i}
                    className={`calCell ${!cell.isCurrentMonth ? 'calCellOther' : ''} ${isToday(cell.date) ? 'calCellToday' : ''} ${isSelected(cell.date) ? 'calCellSelected' : ''} ${hasEvents ? 'calCellHasEvents' : ''}`}
                    onClick={() => setSelectedDate(cell.date)}
                  >
                    <span className="calCellDay">{cell.day}</span>
                    {hasEvents && (
                      <div className="calCellDots">
                        {dayEvents.slice(0, 4).map((_, j) => (
                          <span key={j} className="calCellEventDot" />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calSidePanel glass">
            <div className="calSidePanelHeader">
              <h3 className="calSidePanelTitle">
                {selectedDate.toLocaleDateString(undefined, { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </h3>
            </div>
            
            <div className="calSidePanelContent">
              <div className="calCalendarToggles">
                <div className="calTogglesHeader" onClick={() => setIsMyCalendarsOpen(!isMyCalendarsOpen)}>
                  <h4 className="calTogglesTitle">My Calendars</h4>
                  <div className="calTogglesActions">
                    <button 
                      className="calAddCalendarBtn" 
                      onClick={(e) => { e.stopPropagation(); setIsCreateCalendarModalOpen(true); }}
                      title="Add calendar"
                    >
                      <Plus size={14} />
                    </button>
                    <ChevronDown size={14} style={{ transform: isMyCalendarsOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                  </div>
                </div>
                
                {isMyCalendarsOpen && availableCalendars
                  .filter(cal => cal.accessRole === 'owner' || cal.accessRole === 'writer')
                  .map(cal => (
                    <label key={cal.id} className="calToggleItem">
                      <input
                        type="checkbox"
                        checked={enabledCalendarIds.has(cal.id)}
                        onChange={() => toggleCalendar(cal.id)}
                      />
                      <span className="calToggleColor" style={{ backgroundColor: cal.backgroundColor }} />
                      <span className="calToggleSummary">{cal.summary}</span>
                    </label>
                  ))}

                <div className="calTogglesHeader" onClick={() => setIsOtherCalendarsOpen(!isOtherCalendarsOpen)} style={{ marginTop: '15px' }}>
                  <h4 className="calTogglesTitle">Other Calendars</h4>
                  <ChevronDown size={14} style={{ transform: isOtherCalendarsOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                </div>
                
                {isOtherCalendarsOpen && availableCalendars
                  .filter(cal => cal.accessRole !== 'owner' && cal.accessRole !== 'writer')
                  .map(cal => (
                    <label key={cal.id} className="calToggleItem">
                      <input
                        type="checkbox"
                        checked={enabledCalendarIds.has(cal.id)}
                        onChange={() => toggleCalendar(cal.id)}
                      />
                      <span className="calToggleColor" style={{ backgroundColor: cal.backgroundColor }} />
                      <span className="calToggleSummary">{cal.summary}</span>
                    </label>
                  ))}
              </div>

              <div className="calEventsList">
                <h4 className="calTogglesTitle">Schedule</h4>
              {selectedEvents.length > 0 ? (
                <>
                  {selectedEvents.map(event => (
                    <div key={event.id} onClick={() => openEditModal(event)} className="calEventCardWrapper">
                      <EventCard event={event} />
                    </div>
                  ))}
                  <button className="calQuickAddBtn" onClick={openCreateModal} title="Book Event">
                    <Plus size={14} />
                  </button>
                </>
              ) : (
                <div className="calEventsEmpty">
                  <div className="calEmptyIcon">
                    <Info size={24} strokeWidth={1.5} />
                  </div>
                  <p className="calEmptyText">No events scheduled for this day.</p>
                  <button className="calQuickAddBtn" onClick={openCreateModal} title="Book Event">
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
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
