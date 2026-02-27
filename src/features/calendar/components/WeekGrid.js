'use client';

import React, { useRef, useEffect, useMemo } from 'react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function getEventPosition(event) {
  if (event.allDay) return null;

  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const duration = Math.max(endMinutes - startMinutes, 15); // minimum 15min height

  return {
    top: (startMinutes / 60) * 60, // 60px per hour
    height: (duration / 60) * 60,
  };
}

// Google Calendar event colorId to hex mapping
const GOOGLE_EVENT_COLORS = {
  '1': '#a5b4fc', // Lavender (Vibrant)
  '2': '#4ade80', // Sage (Vibrant)
  '3': '#c084fc', // Grape (Vibrant)
  '4': '#fb7185', // Flamingo (Vibrant)
  '5': '#fbbf24', // Banana (Vibrant)
  '6': '#fb923c', // Tangerine (Vibrant)
  '7': '#38bdf8', // Peacock (Vibrant)
  '8': '#94a3b8', // Graphite (Vibrant)
  '9': '#818cf8', // Blueberry (Vibrant)
  '10': '#2dd4bf', // Basil (Vibrant)
  '11': '#f87171', // Tomato (Vibrant)
};

function getEventColor(event) {
  const color = event.color;
  if (!color) return '#34d399'; // Default emerald
  // If it's a hex color (from calendarColor), use directly
  if (color.startsWith('#')) return color;
  // If it's a Google colorId number
  return GOOGLE_EVENT_COLORS[color] || '#34d399';
}

function isSameDay(d1, d2) {
  return d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
}

export default function WeekGrid({ weekStart, events, enabledCalendarIds, onEventClick, onSlotClick }) {
  const scrollRef = useRef(null);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const today = new Date();

  // Scroll to ~7AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * 60; // 7 hours * 60px
    }
  }, []);

  // Separate all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed = [];

    events.forEach(event => {
      if (!enabledCalendarIds.has(event.calendarId)) return;

      if (event.allDay) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events, enabledCalendarIds]);

  // Get events for a specific day
  const getEventsForDay = (date, eventsList) => {
    return eventsList.filter(event => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, date);
    });
  };

  // Handle overlapping events in a day column using cluster-based layout
  const layoutEventsForDay = (dayEvents) => {
    if (dayEvents.length === 0) return [];

    const positioned = dayEvents.map(event => ({
      event,
      pos: getEventPosition(event),
    })).filter(e => e.pos !== null);

    // 1. Sort by start time
    positioned.sort((a, b) => a.pos.top - b.pos.top);

    // 2. Group into clusters (groups of events that overlap either directly or transitively)
    const clusters = [];
    positioned.forEach(item => {
      let addedToExisting = false;
      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        // If event starts before the cluster's latest end time, it belongs to this cluster
        const clusterEnd = Math.max(...cluster.map(c => c.pos.top + c.pos.height));
        if (item.pos.top < clusterEnd) {
          cluster.push(item);
          addedToExisting = true;
          break;
        }
      }
      if (!addedToExisting) {
        clusters.push([item]);
      }
    });

    // 3. Assign columns per cluster
    const result = [];
    clusters.forEach(cluster => {
      const columns = []; // local columns for this cluster
      cluster.sort((a, b) => a.pos.top - b.pos.top); // ensures sorted within cluster

      cluster.forEach(item => {
        let placed = false;
        for (let col = 0; col < columns.length; col++) {
          const lastInCol = columns[col][columns[col].length - 1];
          if (item.pos.top >= lastInCol.pos.top + lastInCol.pos.height) {
            columns[col].push(item);
            item.column = col;
            placed = true;
            break;
          }
        }
        if (!placed) {
          item.column = columns.length;
          columns.push([item]);
        }
      });

      // Assign totalColumns based on cluster's depth
      cluster.forEach(item => {
        item.totalColumns = columns.length;
        result.push(item);
      });
    });

    return result;
  };

  // Current time position
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    return (now.getHours() * 60 + now.getMinutes()) / 60 * 60;
  }, []);

  const handleSlotClick = (date, hour) => {
    const slotDate = new Date(date);
    slotDate.setHours(hour, 0, 0, 0);
    onSlotClick(slotDate);
  };

  return (
    <div className="weekGridContainer">
      {/* Day headers */}
      <div className="weekGridHeaderRow">
        <div className="weekGridTimeGutterHeader" />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          return (
            <div key={i} className={`weekGridDayHeader ${isToday ? 'weekGridDayHeaderToday' : ''}`}>
              <span className="weekGridDayName">{dayNames[day.getDay()]}</span>
              <span className={`weekGridDayNumber ${isToday ? 'weekGridDayNumberToday' : ''}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="weekGridAllDayRow">
          <div className="weekGridTimeGutterAllDay">
            <span>ALL DAY</span>
          </div>
          {weekDays.map((day, i) => {
            const dayAllDay = getEventsForDay(day, allDayEvents);
            return (
              <div key={i} className="weekGridAllDayCell">
                {dayAllDay.map(event => (
                  <button
                    key={`${event.calendarId}-${event.id}`}
                    className="weekGridAllDayEvent"
                    style={{ '--event-bg': getEventColor(event) }}
                    onClick={() => onEventClick(event)}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div className="weekGridScrollable" ref={scrollRef}>
        <div className="weekGridBody" style={{ height: 24 * 60 }}>
          {/* Hour lines */}
          {HOURS.map(h => (
            <div key={h} className="weekGridHourRow" style={{ top: h * 60 }}>
              <div className="weekGridTimeGutter">
                <span>{formatHour(h)}</span>
              </div>
              <div className="weekGridHourLine" />
            </div>
          ))}

          {/* Day columns with events */}
          <div className="weekGridColumns">
            {weekDays.map((day, dayIdx) => {
              const dayEvents = getEventsForDay(day, timedEvents);
              const layoutEvents = layoutEventsForDay(dayEvents);
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={dayIdx}
                  className={`weekGridDayColumn ${isToday ? 'weekGridDayColumnToday' : ''}`}
                >
                  {/* Click slots for each hour */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="weekGridSlot"
                      style={{ top: h * 60, height: 60 }}
                      onClick={() => handleSlotClick(day, h)}
                    />
                  ))}

                  {/* Event blocks */}
                  {layoutEvents.map(({ event, pos, column, totalColumns }) => {
                    const color = getEventColor(event);
                    // Stacking strategy: offset each column to the right and stack with z-index
                    const offset = totalColumns > 1 ? 12 : 0;
                    const leftPos = column * offset;
                    const width = `${100 - leftPos - 2}%`;
                    const left = `${leftPos}%`;
                    const zIndex = 10 + column;

                    return (
                      <button
                        key={`${event.calendarId}-${event.id}`}
                        className="weekGridEvent"
                        style={{
                          top: pos.top,
                          height: Math.max(pos.height, 18),
                          width,
                          left,
                          zIndex,
                          '--event-bg': color,
                        }}
                        onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      >
                        <span className="weekGridEventTitle">{event.title}</span>
                        {pos.height >= 35 && (
                          <span className="weekGridEventTime">
                            {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Current time indicator */}
                  {isToday && (
                    <div className="weekGridNowLine" style={{ top: currentTimePosition }}>
                      <div className="weekGridNowDot" />
                      <div className="weekGridNowRule" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
