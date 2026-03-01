'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';

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

function getEventPosition(event, dayDate) {
  if (event.allDay && event.eventType !== 'outOfOffice') return null;

  const start = parseEventDate(event.start);
  const end = parseEventDate(event.end);
  if (!start || !end) return null;

  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);

  if (event.allDay) {
    return {
      top: 0,
      height: 24 * HOUR_HEIGHT,
    };
  }

  // If event starts before this day, visually start at midnight
  const effectiveStart = start < dayStart ? dayStart : start;
  // If event ends after this day, visually end at midnight (end of day)
  const effectiveEnd = end > dayEnd ? dayEnd : end;

  const startMinutes = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
  const endMinutes = ((effectiveEnd - dayStart) / (1000 * 60)); // total minutes from start of day

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

function parseEventDate(dateStr) {
  if (!dateStr) return null;
  // If it's just YYYY-MM-DD, parse it as local date to avoid UTC shifts
  if (typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

function isSameDay(d1, d2) {
  const date1 = parseEventDate(d1);
  const date2 = parseEventDate(d2);
  if (!date1 || !date2) return false;
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
}

function isEventOnDay(event, dayDate) {
  const start = parseEventDate(event.start);
  const end = parseEventDate(event.end);
  if (!start || !end) return false;

  const d = new Date(dayDate);
  d.setHours(0, 0, 0, 0);

  if (event.allDay) {
    // Google's all-day 'end' is exclusive
    // example: start "2024-01-01", end "2024-01-02" means ONLY Jan 1st.
    return d >= start && d < end;
  }

  // For timed events, we check if they overlap with the day
  // An event covers a day if it starts before the end of the day 
  // AND ends after the start of the day.
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);

  return start <= dayEnd && end >= dayStart;
}

export default function WeekGrid({ weekStart, events, tasks = [], enabledCalendarIds, onEventClick, onTaskClick, onSlotClick }) {
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const today = new Date();

  // Scroll to ~7AM on mount and setup scroll listener
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
      setScrollTop(scrollRef.current.scrollTop);
      setContainerHeight(scrollRef.current.clientHeight);
    }

    const handleScroll = () => {
      if (scrollRef.current) {
        setScrollTop(scrollRef.current.scrollTop);
      }
    };

    const handleResize = () => {
      if (scrollRef.current) {
        setContainerHeight(scrollRef.current.clientHeight);
      }
    };

    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      if (scrollEl) scrollEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Transform unfinished tasks with due dates into events
  const taskEvents = useMemo(() => {
    return tasks
      .filter(task => 
        task.due_date && 
        !['completed', 'cancelled', 'archived'].includes(task.status?.toLowerCase())
      )
      .map(task => ({
        id: `task-${task.id}`,
        title: task.title,
        start: task.due_date,
        end: new Date(new Date(task.due_date).getTime() + 30 * 60 * 1000).toISOString(), // 30 min duration
        color: '#ef4444', // Red
        eventType: 'task',
        originalTask: task
      }));
  }, [tasks]);

  // Separate all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed = [];

    events.forEach(event => {
      const compositeId = `${event.accountEmail}-${event.calendarId}`;
      if (!enabledCalendarIds.has(compositeId)) return;

      if (event.allDay) {
        allDay.push(event);
        if (event.eventType === 'outOfOffice') {
          timed.push(event);
        }
      } else {
        timed.push(event);
      }
    });

    // Add tasks to all-day row too
    const tasksAsAllDay = taskEvents.map(te => ({ ...te, allDay: true }));
    allDay.push(...tasksAsAllDay);

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events, enabledCalendarIds, taskEvents]);

  // Get events for a specific day
  const getEventsForDay = (date, eventsList) => {
    return eventsList.filter(event => isEventOnDay(event, date));
  };

  // Handle overlapping events in a day column using cluster-based layout
  const layoutEventsForDay = (dayDate, dayEvents) => {
    if (dayEvents.length === 0) return [];
    
    const positioned = dayEvents.map(event => ({
      event,
      pos: getEventPosition(event, dayDate),
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
                    key={event.eventType === 'task' ? event.id : `${event.accountEmail}-${event.calendarId}-${event.id || event.start}`}
                    className={`weekGridAllDayEvent ${event.eventType === 'outOfOffice' ? 'weekGridEventOOO' : ''} ${event.eventType === 'task' ? 'weekGridEventTask' : ''}`}
                    style={{ '--event-bg': getEventColor(event) }}
                    onClick={() => {
                      if (event.eventType === 'task') {
                        onTaskClick(event.originalTask);
                      } else {
                        onEventClick(event);
                      }
                    }}
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
              const dayEvents = [
                ...getEventsForDay(day, timedEvents),
                ...getEventsForDay(day, taskEvents)
              ];
              
              // Separate OOO from standard layout events so they don't squeeze other events
              const dayOOO = dayEvents.filter(e => e.eventType === 'outOfOffice');
              const dayStandard = dayEvents.filter(e => e.eventType !== 'outOfOffice');
              
              const layoutEvents = [
                ...dayOOO.map(event => ({
                  event,
                  pos: getEventPosition(event, day),
                  column: 0,
                  totalColumns: 1,
                })),
                ...layoutEventsForDay(day, dayStandard)
              ];
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
                    const isOOO = event.eventType === 'outOfOffice';
                    const offset = totalColumns > 1 ? 12 : 0;
                    const leftPos = column * offset;
                    const width = isOOO ? '98%' : `${100 - leftPos - 2}%`;
                    const left = isOOO ? '1%' : `${leftPos}%`;
                    const zIndex = isOOO ? 5 : 10 + column;

                    const isSticky = event.eventType === 'task';
                    const originalTop = pos.top;
                    let displayTop = originalTop;
                    let isClamped = false;

                    if (isSticky) {
                      const eventHeight = Math.max(pos.height, 24);
                      const stickyMargin = 8;
                      const minTop = scrollTop + stickyMargin;
                      const maxTop = scrollTop + containerHeight - eventHeight - stickyMargin;
                      
                      // Bias logic: morning tasks (before 12 PM) stick to top,
                      // evening tasks (12 PM or later) stick to bottom.
                      const isMorning = originalTop < (12 * HOUR_HEIGHT);
                      
                      if (isMorning && originalTop < minTop) {
                        displayTop = minTop;
                        isClamped = true;
                      } else if (!isMorning && originalTop > maxTop) {
                        displayTop = maxTop;
                        isClamped = true;
                      }
                    }

                    return (
                      <button
                        key={event.eventType === 'task' ? event.id : `${event.calendarId}-${event.id}`}
                        className={`weekGridEvent ${event.eventType === 'outOfOffice' ? 'weekGridEventOOO' : ''} ${event.eventType === 'task' ? 'weekGridEventTask' : ''} ${isClamped ? 'weekGridEventSticky' : ''}`}
                        style={{
                          top: displayTop,
                          height: event.eventType === 'task' ? 24 : Math.max(pos.height, 18),
                          width,
                          left,
                          zIndex: isClamped ? zIndex + 100 : zIndex,
                          '--event-bg': eventColor,
                          '--calendar-color': calendarColor,
                        }}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (event.eventType === 'task') {
                            onTaskClick(event.originalTask);
                          } else {
                            onEventClick(event); 
                          }
                        }}
                      >
                        <span className="weekGridEventTitle">{event.title}</span>
                        {pos.height >= 35 && event.eventType !== 'task' && (
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
