'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, AlignLeft, Calendar as CalIcon, Trash2, Users, Repeat, Bell } from 'lucide-react';

export default function EventModal({ isOpen, onClose, onSave, onDelete, event, selectedDate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState([]);
  const [guestInput, setGuestInput] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [reminders, setReminders] = useState([{ method: 'popup', minutes: 30 }]);

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
    } else {
      setTitle('');
      setDescription('');
      setLocation('');
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setGuests([]);
      setRecurrence('');
      setReminders([{ method: 'popup', minutes: 30 }]);
    }
    
    if (event) {
      setGuests(event.attendees?.map(a => a.email) || []);
      setRecurrence(event.recurrence?.[0] || '');
      setReminders(event.reminders?.overrides || [{ method: 'popup', minutes: 30 }]);
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
      reminders: {
        useDefault: false,
        overrides: reminders
      }
    };

    try {
      await onSave(eventData);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      setLoading(true);
      try {
        await onDelete(event.id);
        onClose();
      } catch (err) {
        console.error(err);
        alert('Failed to delete event');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="calModalOverlay">
      <div className="calModal glass">
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
              className="calInput calTitleInput"
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
                <input
                  type="time"
                  className="calInput"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isAllDay}
                />
                <span className="calTimeSeparator">to</span>
                <input
                  type="time"
                  className="calInput"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
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

          <div className="calFormGroup">
            <label><MapPin size={16} /> Location</label>
            <input
              type="text"
              className="calInput"
              placeholder="Add location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="calFormGroup">
            <label><Users size={16} /> Guests</label>
            <div className="calGuestInputWrapper">
              <input
                type="email"
                className="calInput"
                placeholder="Add guest email"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && guestInput.includes('@')) {
                    e.preventDefault();
                    setGuests([...guests, guestInput]);
                    setGuestInput('');
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

          <div className="calFormRow">
            <div className="calFormGroup">
              <label><Repeat size={16} /> Repeat</label>
              <select 
                className="calInput" 
                value={recurrence} 
                onChange={(e) => setRecurrence(e.target.value)}
              >
                <option value="">Once</option>
                <option value="RRULE:FREQ=DAILY">Daily</option>
                <option value="RRULE:FREQ=WEEKLY">Weekly</option>
                <option value="RRULE:FREQ=MONTHLY">Monthly</option>
                <option value="RRULE:FREQ=YEARLY">Yearly</option>
              </select>
            </div>
            
            <div className="calFormGroup">
              <label><Bell size={16} /> Notifications</label>
              <select 
                className="calInput"
                value={reminders[0]?.minutes || 30}
                onChange={(e) => setReminders([{ method: 'popup', minutes: parseInt(e.target.value) }])}
              >
                <option value="15">15 min before</option>
                <option value="30">30 min before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>
          </div>

          <div className="calFormGroup">
            <label><AlignLeft size={16} /> Description</label>
            <textarea
              className="calInput calTextarea"
              placeholder="Add description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <footer className="calModalFooter">
            {event && (
              <button
                type="button"
                className="calDeleteBtn"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 size={16} />
              </button>
            )}
            <div className="calModalActions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
