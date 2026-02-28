'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, MapPin, AlignLeft, Calendar as CalIcon, Trash2, Users, Repeat, Bell, Palette, ChevronDown } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

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

export default function EventModal({ isOpen, onClose, onSave, onDelete, event, selectedDate, availableCalendars = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [colorId, setColorId] = useState('');
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
      setLocation(event.location || '');
      setIsAllDay(event.allDay || false);
      
      if (event.start) {
        const start = new Date(event.start);
        setStartTime(start.toTimeString().slice(0, 5));
      }
      if (event.end) {
        const end = new Date(event.end);
        setEndTime(end.toTimeString().slice(0, 5));
      }
      setCalendarId(event.calendarId || 'primary');
    } else {
      setTitle('');
      setDescription('');
      setCalendarId('primary');
      setLocation('');
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setGuests([]);
      setRecurrence('');
      setReminders([{ method: 'popup', minutes: 30 }]);
      setColorId('');
    }
    
    if (event) {
      setGuests(event.attendees?.map(a => a.email) || []);
      
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
      const matchedPreset = presets.find(p => rrule === p.value || rrule.includes(p.match));

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
      setColorId(evtColor.startsWith('#') ? '' : evtColor);
      setCalendarId(event.calendarId || 'primary');
    }
  }, [event, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const baseDate = event ? new Date(event.start) : (selectedDate || new Date());
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    const start = new Date(year, month, day);
    const end = new Date(year, month, day);

    if (!isAllDay) {
      const [sh, sm] = startTime.split(':');
      const [eh, em] = endTime.split(':');
      start.setHours(parseInt(sh), parseInt(sm));
      end.setHours(parseInt(eh), parseInt(em));
    }

    const eventData = {
      summary: title,
      description,
      location,
      start: isAllDay ? { date: start.toISOString().split('T')[0] } : { dateTime: start.toISOString() },
      end: isAllDay ? { date: end.toISOString().split('T')[0] } : { dateTime: end.toISOString() },
      attendees: guests.map(email => ({ email })),
      recurrence: recurrence ? [recurrence] : undefined,
      colorId: colorId || undefined,
      reminders: {
        useDefault: false,
        overrides: reminders
      }
    };

    try {
      const selectedCal = availableCalendars.find(c => c.id === calendarId);
      const accEmail = event?.accountEmail || selectedCal?.accountEmail;
      
      if (!accEmail) {
        throw new Error('No account associated with this calendar');
      }

      await onSave(eventData, calendarId, accEmail);
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (!event.accountEmail) {
        throw new Error('No account associated with this event');
      }
      await onDelete(event.id, calendarId, event.accountEmail);
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete event');
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
            
            <div className="calFormGroup">
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
                options={availableCalendars.map(cal => ({
                  value: cal.id,
                  label: `${cal.summary}${cal.primary ? ' (Primary)' : ''} (${cal.accountEmail})`,
                  color: cal.backgroundColor
                }))}
                value={calendarId}
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
                onClick={() => setShowDeleteConfirm(true)}
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
    </div>
  );
}
