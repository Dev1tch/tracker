'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, MapPin, AlignLeft, Calendar as CalIcon, Trash2, Users, Repeat, Bell, Palette, ChevronDown, ExternalLink, Video } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { useToast } from '@/components/ui/ToastProvider';
import AccountPromptModal from './AccountPromptModal';

const GOOGLE_EVENT_COLORS = [
  { id: '1', name: 'Lavender', hex: '#7986cb' },
  { id: '2', name: 'Sage', hex: '#33b679' },
  { id: '3', name: 'Grape', hex: '#8e24aa' },
  { id: '4', name: 'Flamingo', hex: '#e67c73' },
  { id: '5', name: 'Banana', hex: '#f6bf26' },
  { id: '6', name: 'Tangerine', hex: '#f4511e' },
  { id: '7', name: 'Peacock', hex: '#039be5' },
  { id: '8', name: 'Graphite', hex: '#616161' },
  { id: '9', name: 'Blueberry', hex: '#3f51b5' },
  { id: '10', name: 'Basil', hex: '#0b8043' },
  { id: '11', name: 'Tomato', hex: '#d50000' },
];

function formatDateInputValue(value) {
  if (!value) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateInputValue(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function buildGoogleMeetRequestId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `meet-${globalThis.crypto.randomUUID()}`;
  }

  return `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function TimeSelect({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [h, m] = value.split(':');

  return (
    <div className={`calTimeSelect ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      <div className="calTimeSelectHeader" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <span>{value}</span>
        <ChevronDown size={14} className={isOpen ? 'rotate' : ''} />
      </div>
      {isOpen && (
        <div className="calTimeSelectDropdown glass">
          <div className="calTimeSelectColumn">
            {hours.map(hour => (
              <div 
                key={hour} 
                className={`calTimeSelectOption ${h === hour ? 'selected' : ''}`}
                onClick={() => { onChange(`${hour}:${m}`); setIsOpen(false); }}
              >
                {hour}
              </div>
            ))}
          </div>
          <div className="calTimeSelectColumn">
            {minutes.map(minute => (
              <div 
                key={minute} 
                className={`calTimeSelectOption ${m === minute ? 'selected' : ''}`}
                onClick={() => { onChange(`${h}:${minute}`); setIsOpen(false); }}
              >
                {minute}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventModal({ isOpen, onClose, onSave, onDelete, event, selectedDate, availableCalendars = [], accounts = [] }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(formatDateInputValue(selectedDate));
  const [calendarId, setCalendarId] = useState('primary');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState([]);
  const [guestInput, setGuestInput] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [reminders, setReminders] = useState([{ method: 'popup', minutes: 30 }]);
  const [eventType, setEventType] = useState('default');
  const [autoDecline, setAutoDecline] = useState(true);
  const [declineMessage, setDeclineMessage] = useState('Declined as I am currently out of office.');
  const [hasGoogleMeet, setHasGoogleMeet] = useState(false);
  const [refreshGoogleMeet, setRefreshGoogleMeet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [pendingEventData, setPendingEventData] = useState(null);
  const [pendingRecurringSaveData, setPendingRecurringSaveData] = useState(null);
  const [showRecurringSavePrompt, setShowRecurringSavePrompt] = useState(false);
  const [showRecurringDeletePrompt, setShowRecurringDeletePrompt] = useState(false);
  const [colorId, setColorId] = useState('');
  const [initialColorId, setInitialColorId] = useState('');
  const [recurrenceOptions, setRecurrenceOptions] = useState([
    { value: '', label: 'Does not repeat' },
    { value: 'RRULE:FREQ=DAILY', label: 'Daily' },
    { value: 'RRULE:FREQ=WEEKLY', label: 'Weekly' },
    { value: 'RRULE:FREQ=MONTHLY', label: 'Monthly' },
    { value: 'RRULE:FREQ=YEARLY', label: 'Yearly' }
  ]);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setEventDate(formatDateInputValue(event.start));
      setLocation(event.location || '');
      setIsAllDay(event.allDay || false);
      setHasGoogleMeet(Boolean(event.googleMeetLink));
      setRefreshGoogleMeet(false);
      
      if (event.start) {
        const start = new Date(event.start);
        setStartTime(start.toTimeString().slice(0, 5));
      }
      if (event.end) {
        const end = new Date(event.end);
        setEndTime(end.toTimeString().slice(0, 5));
      }
      setCalendarId(event.accountEmail ? `${event.accountEmail}:${event.calendarId || 'primary'}` : (event.calendarId || 'primary'));
    } else {
      setTitle('');
      setDescription('');
      setEventDate(formatDateInputValue(selectedDate));
      
      const activeAccounts = accounts.filter(a => a.active);
      if (activeAccounts.length === 1) {
        const primaryCal = availableCalendars.find(c => c.accountEmail === activeAccounts[0].email && c.primary);
        setCalendarId(primaryCal ? `${activeAccounts[0].email}:${primaryCal.id}` : `${activeAccounts[0].email}:primary`);
      } else {
        setCalendarId('primary');
      }
      setLocation('');
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setHasGoogleMeet(false);
      setRefreshGoogleMeet(false);
      setGuests([]);
      setRecurrence('');
      setReminders([{ method: 'popup', minutes: 30 }]);
      setColorId('');
      setInitialColorId('');
    }
    
    if (event) {
      setGuests(event.attendees?.map(a => a.email) || []);
      setEventType(event.eventType || 'default');
      if (event.outOfOfficeProperties) {
        setAutoDecline(event.outOfOfficeProperties.autoDeclineMode !== 'doNotDecline');
        setDeclineMessage(event.outOfOfficeProperties.declineMessage || '');
      }
      
      // Smarter recurrence detection
      const rrule = event.recurrence?.[0] || '';
      const presets = [
        { value: 'RRULE:FREQ=DAILY', match: 'FREQ=DAILY', label: 'Daily' },
        { value: 'RRULE:FREQ=WEEKLY', match: 'FREQ=WEEKLY', label: 'Weekly' },
        { value: 'RRULE:FREQ=MONTHLY', match: 'FREQ=MONTHLY', label: 'Monthly' },
        { value: 'RRULE:FREQ=YEARLY', match: 'FREQ=YEARLY', label: 'Yearly' }
      ];

      const standardOptions = [
        { value: '', label: 'Does not repeat' },
        ...presets.map(p => ({ value: p.value, label: p.label }))
      ];

      // Try to find a matching preset string or substring
      const matchedPreset = presets.find(p => rrule === p.value);

      if (rrule && !matchedPreset && !standardOptions.some(opt => opt.value === rrule)) {
        const freq = rrule.split('FREQ=')[1]?.split(';')[0];
        const label = `Custom (${freq ? freq.charAt(0) + freq.slice(1).toLowerCase() : 'Recurrence'})`;
        setRecurrenceOptions([...standardOptions, { value: rrule, label }]);
        setRecurrence(rrule);
      } else if (matchedPreset) {
        setRecurrenceOptions(standardOptions);
        setRecurrence(matchedPreset.value); // Use the preset value for dropdown selection
      } else {
        setRecurrenceOptions(standardOptions);
        setRecurrence(rrule); // Likely empty string
      }
      
      setReminders(event.reminders?.overrides || [{ method: 'popup', minutes: 30 }]);
      // Extract colorId — could be a number string like '1'-'11' or empty
      const evtColor = event.color || '';
      const normalizedColorId = evtColor.startsWith('#') ? '' : evtColor;
      setColorId(normalizedColorId);
      setInitialColorId(normalizedColorId);
      setCalendarId(event.accountEmail ? `${event.accountEmail}:${event.calendarId || 'primary'}` : (event.calendarId || 'primary'));
    }
  }, [event, isOpen, accounts, availableCalendars, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    setShowDeleteConfirm(false);
    setShowRecurringSavePrompt(false);
    setShowRecurringDeletePrompt(false);
    setPendingRecurringSaveData(null);
    setPendingEventData(null);
  }, [isOpen, event?.id]);

  if (!isOpen) return null;

  const browserTimeZone =
    (typeof window !== 'undefined'
      ? window.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone
      : '') || undefined;
  const recurringOriginalStart = event?.originalStart || event?.start || '';
  const recurringSeriesId = event?.recurringEventId || (event?.recurrence?.length ? event?.id : '');
  const canShowRecurringSavePrompt = Boolean(
    event?.id && recurringSeriesId && recurringOriginalStart
  );
  const canShowRecurringDeletePrompt = Boolean(
    event?.id && (event?.recurringEventId || event?.recurrence?.length)
  );

  const buildEventData = () => {
    const baseDate = parseDateInputValue(eventDate);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    const start = new Date(year, month, day);
    const end = new Date(year, month, day);

    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const isOOO = eventType === 'outOfOffice';
    
    // Helper to format date with local timezone offset for Google Calendar
    const toLocalISOString = (date) => {
      const offset = -date.getTimezoneOffset();
      const diff = offset >= 0 ? '+' : '-';
      const pad = (num) => String(Math.floor(Math.abs(num))).padStart(2, '0');
      return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        diff + pad(offset / 60) +
        ':' + pad(offset % 60);
    };

    const [startH, startM] = startTime.split(':');
    const [endH, endM] = endTime.split(':');
    
    start.setHours(parseInt(startH), parseInt(startM), 0, 0);
    end.setHours(parseInt(endH), parseInt(endM), 0, 0);

    const eventData = {
      summary: title,
      eventType: isOOO ? 'outOfOffice' : 'default',
    };

    if (isOOO) {
      // OOO MUST be timed (dateTime), not date (all-day), even if it covers the whole day.
      if (isAllDay) {
        const oooStart = new Date(year, month, day, 0, 0, 0);
        const oooEnd = new Date(year, month, day, 23, 59, 59);
        eventData.start = { dateTime: toLocalISOString(oooStart), timeZone: browserTimeZone };
        eventData.end = { dateTime: toLocalISOString(oooEnd), timeZone: browserTimeZone };
      } else {
        eventData.start = { dateTime: toLocalISOString(start), timeZone: browserTimeZone };
        eventData.end = { dateTime: toLocalISOString(end), timeZone: browserTimeZone };
      }
      
      eventData.outOfOfficeProperties = {
        autoDeclineMode: autoDecline ? 'declineAllConflictingInvitations' : 'declineNone',
        declineMessage: declineMessage
      };
      eventData.transparency = 'opaque';
    } else {
      // Default events can be all-day (date) or timed (dateTime)
      if (isAllDay) {
        eventData.start = { date: formatDate(start) };
        eventData.end = { date: formatDate(new Date(end.getTime() + 86400000)) };
      } else {
        eventData.start = { dateTime: toLocalISOString(start), timeZone: browserTimeZone };
        eventData.end = { dateTime: toLocalISOString(end), timeZone: browserTimeZone };
      }

      eventData.description = description;
      eventData.location = location;

      if (event?.id) {
        if (colorId) {
          eventData.colorId = colorId;
        } else if (initialColorId) {
          eventData.colorId = null;
        }
      } else if (colorId) {
        eventData.colorId = colorId;
      }

      eventData.attendees = guests.map(email => ({ email }));
      eventData.recurrence = recurrence ? [recurrence] : undefined;
      eventData.reminders = {
        useDefault: false,
        overrides: reminders
      };

      if (hasGoogleMeet && (!event?.googleMeetLink || refreshGoogleMeet)) {
        eventData.conferenceData = {
          createRequest: {
            requestId: buildGoogleMeetRequestId(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      } else if (!hasGoogleMeet && event?.googleMeetLink) {
        eventData.conferenceData = null;
      }
    }

    return eventData;
  };

  const persistEvent = async (eventData, saveOptions = {}) => {
    let finalCalendarId = calendarId;
    let accEmail = event?.accountEmail;

    if (calendarId.includes(':')) {
      const [email, id] = calendarId.split(':');
      accEmail = email;
      finalCalendarId = id;
    } else if (!accEmail) {
      const activeAccounts = accounts.filter(a => a.active);
      if (activeAccounts.length === 1) {
        accEmail = activeAccounts[0].email;
      } else if (activeAccounts.length > 1) {
        setPendingEventData({ eventData, saveOptions });
        setShowAccountPrompt(true);
        return { deferred: true };
      } else {
        const selectedCal = availableCalendars.find(c => c.id === calendarId);
        accEmail = selectedCal?.accountEmail;
      }
    }

    if (!accEmail) {
      throw new Error('Please select an account');
    }

    await onSave(eventData, finalCalendarId, accEmail, saveOptions);
    return { deferred: false };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const eventData = buildEventData();

    if (canShowRecurringSavePrompt) {
      setPendingRecurringSaveData(eventData);
      setShowDeleteConfirm(false);
      setShowRecurringSavePrompt(true);
      return;
    }

    setLoading(true);
    let result = { deferred: false };

    try {
      result = await persistEvent(eventData);
      if (!result.deferred) onClose();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save event', 'error');
    } finally {
      if (!result.deferred) setLoading(false);
    }
  };

  const handleAccountSelect = async (email) => {
    setShowAccountPrompt(false);
    setLoading(true);
    try {
      await onSave(pendingEventData?.eventData, 'primary', email, pendingEventData?.saveOptions || {});
      onClose();
    } catch (err) {
      console.error(err);
      toast('Failed to save event to selected account', 'error');
    } finally {
      setLoading(false);
      setPendingEventData(null);
    }
  };

  const handleRecurringSaveChoice = async (mode) => {
    if (!pendingRecurringSaveData || !event) return;

    setShowRecurringSavePrompt(false);
    setLoading(true);
    let result = { deferred: false };
    const eventData =
      mode === 'this'
        ? { ...pendingRecurringSaveData, recurrence: undefined }
        : pendingRecurringSaveData;

    try {
      result = await persistEvent(eventData, {
        recurringEdit: {
          mode,
          recurringEventId: recurringSeriesId,
          originalStart: recurringOriginalStart,
        },
      });
      if (!result.deferred) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save event', 'error');
    } finally {
      if (!result.deferred) {
        setLoading(false);
        setPendingRecurringSaveData(null);
      }
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (!event.accountEmail) {
        throw new Error('No account associated with this event');
      }
      
      let finalCalendarId = calendarId;
      if (calendarId.includes(':')) {
        finalCalendarId = calendarId.split(':')[1];
      }
      
      await onDelete(event.id, finalCalendarId, event.accountEmail);
      onClose();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to delete event', 'error');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRecurringDeleteChoice = async (mode) => {
    if (!event?.accountEmail) {
      toast('No account associated with this event', 'error');
      return;
    }

    setShowRecurringDeletePrompt(false);
    setLoading(true);

    try {
      let finalCalendarId = calendarId;
      if (calendarId.includes(':')) {
        finalCalendarId = calendarId.split(':')[1];
      }

      await onDelete(event.id, finalCalendarId, event.accountEmail, {
        recurringDelete: {
          mode,
          recurringEventId: event.recurringEventId,
          originalStart: recurringOriginalStart,
        },
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to delete event', 'error');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddGuest = (email) => {
    if (email && email.includes('@') && !guests.includes(email)) {
      setGuests([...guests, email]);
    }
  };

  const getReminderValue = () => {
    return reminders[0]?.minutes?.toString() || '30';
  };

  const handleReminderChange = (minutes) => {
    setReminders([{ method: 'popup', minutes: parseInt(minutes) }]);
  };

  const googleMeetLink = event?.googleMeetLink || '';

  return (
    <div className="calModalOverlay" onClick={onClose}>
      <div className="calModal glass" onClick={(e) => e.stopPropagation()}>
        <header className="calModalHeader">
          <h3>{event ? 'Edit Event' : 'New Event'}</h3>
          <button className="calModalClose" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="calModalForm">
          <div className="calFormGroup">
            <input
              type="text"
              className="authInput calTitleInput"
              placeholder="Event Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="calFormRow">
            <div className="calFormGroup">
              <label><CalIcon size={16} /> Day</label>
              <input
                type="date"
                className="authInput"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div className="calFormGroup">
              <label><Clock size={16} /> Time</label>
              <div className="calTimeInputs">
                <TimeSelect
                  value={startTime}
                  onChange={setStartTime}
                  disabled={isAllDay}
                />
                <span className="calTimeSeparator">to</span>
                <TimeSelect
                  value={endTime}
                  onChange={setEndTime}
                  disabled={isAllDay}
                />
              </div>
              <label className="calCheckboxLabel">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                />
                All Day
              </label>
            </div>
          </div>

          <div className="calFormRow">
            <div className="calFormGroup">
              <label><Palette size={16} /> Type</label>
              <div className="calEventTypeTabs">
                <button 
                  type="button" 
                  className={`calTypeTab ${eventType === 'default' ? 'active' : ''}`}
                  onClick={() => setEventType('default')}
                  disabled={event && event.id && event.eventType !== 'default'}
                >
                  Event
                </button>
                <button 
                  type="button" 
                  className={`calTypeTab ${eventType === 'outOfOffice' ? 'active' : ''}`}
                  onClick={() => {
                    setEventType('outOfOffice');
                    setIsAllDay(true); // OOO is usually all day
                    setHasGoogleMeet(false);
                    setRefreshGoogleMeet(false);
                  }}
                  disabled={event && event.id && event.eventType !== 'outOfOffice'}
                >
                  Out of Office
                </button>
              </div>
            </div>
          </div>

          {eventType === 'outOfOffice' && (
            <div className="calOOOSection glass">
              <label className="calCheckboxLabel">
                <input
                  type="checkbox"
                  checked={autoDecline}
                  onChange={(e) => setAutoDecline(e.target.checked)}
                />
                Automatically decline meetings
              </label>
              {autoDecline && (
                <textarea
                  className="authInput calOOOMessage"
                  placeholder="Decline message"
                  value={declineMessage}
                  onChange={(e) => setDeclineMessage(e.target.value)}
                  rows={2}
                />
              )}
            </div>
          )}

          {eventType === 'default' && (
            <div className="calFormRow">
              <div className="calFormGroup">
                <label><Video size={16} /> Google Meet</label>
                <div className="calMeetControls">
                  <label className="calCheckboxLabel">
                    <input
                      type="checkbox"
                      checked={hasGoogleMeet}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasGoogleMeet(checked);
                        if (!checked) {
                          setRefreshGoogleMeet(false);
                        }
                      }}
                    />
                    Use Google Meet
                  </label>

                  {hasGoogleMeet && googleMeetLink && (
                    <>
                      <div className="calMeetRow">
                        <a
                          href={googleMeetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="calMeetLink"
                          title="Open current Google Meet link"
                        >
                          <Video size={14} />
                          <span>Google Meet Link</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <label className="calCheckboxLabel">
                        <input
                          type="checkbox"
                          checked={refreshGoogleMeet}
                          onChange={(e) => setRefreshGoogleMeet(e.target.checked)}
                        />
                        Generate a new Meet link on save
                      </label>
                    </>
                  )}

                  {hasGoogleMeet && !googleMeetLink && (
                    <p className="calMeetHint">
                      A Google Meet link will be created when you save this event.
                    </p>
                  )}

                  {!hasGoogleMeet && googleMeetLink && (
                    <p className="calMeetHint">
                      Saving will remove the current Google Meet link from this event.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="calFormRow">
            <div className="calFormGroup" style={{ flex: 1 }}>
              <label><Repeat size={16} /> Repeat</label>
              <CustomSelect
                options={recurrenceOptions}
                value={recurrence}
                onChange={setRecurrence}
              />
            </div>
          </div>

          <div className="calFormRow">
            <div className="calFormGroup">
              <label><CalIcon size={16} /> Calendar</label>
              <CustomSelect
                options={[
                  { value: 'primary', label: 'Default (Primary)', color: 'rgba(255,255,255,0.2)' },
                  ...availableCalendars.map(cal => ({
                    value: `${cal.accountEmail}:${cal.id}`,
                    label: `${cal.summary}${cal.primary ? ' (Primary)' : ''} (${cal.accountEmail})`,
                    color: cal.backgroundColor
                  }))
                ]}
                value={calendarId.includes(':') ? calendarId : availableCalendars.find(c => c.id === calendarId)?.accountEmail ? `${availableCalendars.find(c => c.id === calendarId).accountEmail}:${calendarId}` : calendarId}
                onChange={setCalendarId}
                disabled={event && !!event.id}
              />
            </div>

            <div className="calFormGroup">
              <label><Palette size={16} /> Event Color</label>
              <div className="calEventColorPicker">
                <button
                  type="button"
                  className={`calEventColorSwatch calEventColorDefault ${!colorId ? 'active' : ''}`}
                  onClick={() => setColorId('')}
                  title="Calendar default"
                >
                  <span style={{ background: 'linear-gradient(135deg, #34d399, #60a5fa)' }} />
                </button>
                {GOOGLE_EVENT_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={`calEventColorSwatch ${colorId === c.id ? 'active' : ''}`}
                    onClick={() => setColorId(c.id)}
                    title={c.name}
                  >
                    <span style={{ backgroundColor: c.hex }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="calFormRow">
            <div className="calFormGroup">
              <label><MapPin size={16} /> Location</label>
              <input
                type="text"
                className="authInput"
                placeholder="Add location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="calFormGroup">
              <label><Bell size={16} /> Reminder</label>
              <CustomSelect
                options={[
                  { value: '10', label: '10 minutes before' },
                  { value: '30', label: '30 minutes before' },
                  { value: '60', label: '1 hour before' },
                  { value: '1440', label: '1 day before' }
                ]}
                value={getReminderValue()}
                onChange={handleReminderChange}
              />
            </div>
          </div>

          <div className="calFormGroup">
            <label><Users size={16} /> Guests</label>
            <div className="calGuestInputWrapper">
              <input
                type="email"
                className="authInput"
                placeholder="Add guest email and press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGuest(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            {guests.length > 0 && (
              <div className="calGuestChips">
                {guests.map((email, i) => (
                  <div key={i} className="calGuestChip">
                    <span>{email}</span>
                    <button type="button" onClick={() => setGuests(guests.filter((_, idx) => idx !== i))}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="calFormGroup">
            <label><AlignLeft size={16} /> Description</label>
            <textarea
              className="authInput calTextarea"
              placeholder="Add description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <footer className="calModalFooter">
            {event && !showDeleteConfirm && (
              <button
                type="button"
                className="calDeleteBtn"
                onClick={() => {
                  if (canShowRecurringDeletePrompt) {
                    setShowDeleteConfirm(false);
                    setShowRecurringDeletePrompt(true);
                    return;
                  }

                  setShowDeleteConfirm(true);
                }}
                disabled={loading}
              >
                <Trash2 size={16} />
              </button>
            )}
            {event && showDeleteConfirm && (
              <div className="calDeleteConfirm">
                <span className="calDeleteConfirmText">Delete this event?</span>
                <div className="calDeleteConfirmActions">
                  <button type="button" className="calDeleteConfirmYes" onClick={handleDelete} disabled={loading}>
                    {loading ? '...' : 'Delete'}
                  </button>
                  <button type="button" className="calDeleteConfirmNo" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!showDeleteConfirm && (
              <div className="calModalActions">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            )}
          </footer>
        </form>
      </div>

      <AccountPromptModal
        isOpen={showAccountPrompt}
        onClose={() => setShowAccountPrompt(false)}
        accounts={accounts}
        onSelect={handleAccountSelect}
      />

      {showRecurringSavePrompt && (
        <div className="calScopeModalOverlay" onClick={() => setShowRecurringSavePrompt(false)}>
          <div className="calScopeModal glass" onClick={(e) => e.stopPropagation()}>
            <div className="calScopeModalHeader">
              <h4>Save Recurring Changes</h4>
              <button
                type="button"
                className="calModalClose"
                onClick={() => setShowRecurringSavePrompt(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="calScopeModalText">
              Choose how these changes should be applied to this recurring event.
            </p>
            <p className="calScopeModalNote">
              Applying changes to future events can reset later exceptions in the series.
            </p>
            <div className="calScopeModalActions">
              <button
                type="button"
                className="calScopeModalPrimary"
                onClick={() => handleRecurringSaveChoice('this')}
                disabled={loading}
              >
                Only this event
              </button>
              <button
                type="button"
                className="calScopeModalPrimary"
                onClick={() => handleRecurringSaveChoice('future')}
                disabled={loading}
              >
                This and all future events
              </button>
              <button
                type="button"
                className="calScopeModalSecondary"
                onClick={() => setShowRecurringSavePrompt(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecurringDeletePrompt && (
        <div className="calScopeModalOverlay" onClick={() => setShowRecurringDeletePrompt(false)}>
          <div className="calScopeModal glass" onClick={(e) => e.stopPropagation()}>
            <div className="calScopeModalHeader">
              <h4>Delete Recurring Event</h4>
              <button
                type="button"
                className="calModalClose"
                onClick={() => setShowRecurringDeletePrompt(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="calScopeModalText">
              Choose how this recurring event should be deleted.
            </p>
            <p className="calScopeModalNote">
              Deleting future events will trim the series starting from this occurrence.
            </p>
            <div className="calScopeModalActions">
              <button
                type="button"
                className="calScopeModalDanger"
                onClick={() => handleRecurringDeleteChoice('this')}
                disabled={loading}
              >
                Only this event
              </button>
              <button
                type="button"
                className="calScopeModalDanger"
                onClick={() => handleRecurringDeleteChoice('future')}
                disabled={loading}
              >
                This and all future events
              </button>
              <button
                type="button"
                className="calScopeModalSecondary"
                onClick={() => setShowRecurringDeletePrompt(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
