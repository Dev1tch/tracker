'use client';

import React, { useRef, useEffect, useMemo } from 'react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const GOOGLE_EVENT_COLORS = {
  '1': '#7986cb', // Lavender
  '2': '#33b679', // Sage
  '3': '#8e24aa', // Grape
  '4': '#e67c73', // Flamingo
  '5': '#f6bf26', // Banana
  '6': '#f4511e', // Tangerine
  '7': '#039be5', // Peacock
  '8': '#616161', // Graphite
  '9': '#3f51b5', // Blueberry
  '10': '#0b8043', // Basil
  '11': '#d50000', // Tomato
};

const HOUR_HEIGHT = 44; // Reduced from 60 for more density

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
    top: (startMinutes / 60) * HOUR_HEIGHT,
    height: (duration / 60) * HOUR_HEIGHT,
  };
}

function getEventColor(event) {
  const color = event.color;
  if (!color) return event.calendarColor || '#34d399';
  return GOOGLE_EVENT_COLORS[color] || color;
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
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  // Separate all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed = [];

    events.forEach(event => {
      const compositeId = `${event.accountEmail}-${event.calendarId}`;
      if (!enabledCalendarIds.has(compositeId)) return;

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
    return (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
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
                    key={`${event.accountEmail}-${event.calendarId}-${event.id}`}
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
        <div className="weekGridBody" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Hour lines */}
          {HOURS.map(h => (
            <div key={h} className="weekGridHourRow" style={{ top: h * HOUR_HEIGHT }}>
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
                      style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      onClick={() => handleSlotClick(day, h)}
                    />
                  ))}

                  {/* Event blocks */}
                  {layoutEvents.map(({ event, pos, column, totalColumns }) => {
                    const eventColor = getEventColor(event);
                    const calendarColor = event.calendarColor || eventColor;
                    
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
                          '--event-bg': eventColor,
                          '--calendar-color': calendarColor,
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
