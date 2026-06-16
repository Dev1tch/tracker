'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Video } from 'lucide-react';
import {
  createTaskCalendarEvents,
  getCalendarEventColor,
  getWeekDays,
  isCalendarEventOnDay,
  isSameCalendarDay,
  parseCalendarDate,
} from '../utils/calendar-view.utils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const HOUR_HEIGHT = 44; // Reduced from 60 for more density

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function getEventPosition(event, dayDate) {
  if (event.allDay && event.eventType !== 'outOfOffice') return null;

  const start = parseCalendarDate(event.start);
  const end = parseCalendarDate(event.end);
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

function getMeetActionSize(height) {
  const safeHeight = Math.max(height || 0, 18);
  return `${Math.min(Math.max(Math.round(safeHeight * 0.44), 12), 16)}px`;
}

function openCalendarItem(event, onEventClick, onTaskClick) {
  if (event.eventType === 'task') {
    onTaskClick(event.originalTask);
    return;
  }
  onEventClick(event);
}

export default function WeekGrid({
  weekStart,
  events,
  tasks = [],
  enabledCalendarIds,
  eventCardStyle = 'frame',
  onEventClick,
  onTaskClick,
  onSlotClick,
}) {
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const updateScrollMetrics = useCallback(() => {
    if (!scrollRef.current) return;

    setScrollTop(scrollRef.current.scrollTop);
    setContainerHeight(scrollRef.current.clientHeight);
    setScrollbarWidth(scrollRef.current.offsetWidth - scrollRef.current.clientWidth);
  }, []);

  const weekDays = useMemo(() => {
    return getWeekDays(weekStart);
  }, [weekStart]);

  const today = new Date();

  // Scroll to ~7AM on mount and setup scroll listener
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    scrollEl.scrollTop = 7 * HOUR_HEIGHT;
    updateScrollMetrics();

    const handleScroll = () => {
      setScrollTop(scrollEl.scrollTop);
    };

    const handleResize = () => {
      updateScrollMetrics();
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          updateScrollMetrics();
        })
      : null;

    scrollEl.addEventListener('scroll', handleScroll);
    resizeObserver?.observe(scrollEl);
    window.addEventListener('resize', handleResize);

    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [updateScrollMetrics]);

  // Transform unfinished tasks with due dates into events
  const taskEvents = useMemo(() => {
    return createTaskCalendarEvents(tasks);
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
    return eventsList.filter(event => isCalendarEventOnDay(event, date));
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

  const handleSlotClick = (date, hour, event) => {
    // Derive the minute within the hour from where the user clicked, snapped
    // to 15-minute increments (matching the time picker), like Google Calendar.
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const rawMinutes = (offsetY / rect.height) * 60;
    const minutes = Math.min(Math.max(Math.floor(rawMinutes / 15) * 15, 0), 45);

    const slotDate = new Date(date);
    slotDate.setHours(hour, minutes, 0, 0);
    onSlotClick(slotDate);
  };

  const handleMeetClick = (meetLink, nativeEvent) => {
    nativeEvent.stopPropagation();
    if (typeof window !== 'undefined') {
      window.open(meetLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="weekGridContainer">
      {/* Day headers */}
      <div className="weekGridHeaderRow">
        <div className="weekGridTimeGutterHeader" />
        {weekDays.map((day, i) => {
          const isToday = isSameCalendarDay(day, today);
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
        <div className="weekGridScrollGutter" style={{ width: scrollbarWidth }} aria-hidden="true" />
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
                {dayAllDay.map(event => {
                  const showCalendarDot = eventCardStyle === 'frame' && event.eventType !== 'task';
                  const eventColor = getCalendarEventColor(event);
                  const calendarColor = event.calendarColor || eventColor;

                  return (
                    <div
                      key={event.eventType === 'task' ? event.id : `${event.accountEmail}-${event.calendarId}-${event.id || event.start}`}
                      className="weekGridAllDayEventWrap"
                      style={
                        event.googleMeetLink && event.eventType !== 'task'
                          ? { '--meet-action-size': getMeetActionSize(28) }
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className={`weekGridAllDayEvent ${event.eventType === 'outOfOffice' ? 'weekGridEventOOO' : ''} ${event.eventType === 'task' ? 'weekGridEventTask' : ''} ${event.googleMeetLink ? 'hasMeetLink' : ''} ${showCalendarDot ? 'hasCalendarDot' : ''}`}
                        style={{
                          '--event-bg': eventColor,
                          '--calendar-color': calendarColor,
                        }}
                        data-card-style={eventCardStyle}
                        onClick={() => openCalendarItem(event, onEventClick, onTaskClick)}
                      >
                        {showCalendarDot && (
                          <span className="weekGridEventCalendarDot" aria-hidden="true" />
                        )}
                        <span className="weekGridAllDayEventTitle">{event.title}</span>
                      </button>
                      {event.googleMeetLink && event.eventType !== 'task' && (
                        <button
                          type="button"
                          className="weekGridMeetAction weekGridMeetActionAllDay"
                          title="Open Google Meet in a new tab"
                          aria-label="Open Google Meet in a new tab"
                          onClick={(nativeEvent) => handleMeetClick(event.googleMeetLink, nativeEvent)}
                        >
                          <Video className="weekGridMeetActionIcon" size={10} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="weekGridScrollGutter" style={{ width: scrollbarWidth }} aria-hidden="true" />
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
              const isToday = isSameCalendarDay(day, today);

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
                      onClick={(event) => handleSlotClick(day, h, event)}
                    />
                  ))}

                  {/* Event blocks */}
                  {layoutEvents.map(({ event, pos, column, totalColumns }) => {
                    const eventColor = getCalendarEventColor(event);
                    const calendarColor = event.calendarColor || eventColor;
                    const showCalendarDot = eventCardStyle === 'frame' && event.eventType !== 'task';
                    
                    // Stacking strategy: offset each column to the right and stack with z-index
                    const isOOO = event.eventType === 'outOfOffice';
                    const offset = totalColumns > 1 ? 12 : 0;
                    const leftPos = column * offset;
                    const width = isOOO ? '98%' : `${100 - leftPos - 2}%`;
                    const left = isOOO ? '1%' : `${leftPos}%`;
                    const zIndex = isOOO ? 5 : 10 + column;
                    const eventHeight = event.eventType === 'task' ? 24 : Math.max(pos.height, 18);

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
                      <div
                        key={event.eventType === 'task' ? event.id : `${event.calendarId}-${event.id}`}
                        className="weekGridEventWrap"
                        style={{
                          top: displayTop,
                          height: eventHeight,
                          width,
                          left,
                          zIndex: isClamped ? zIndex + 100 : zIndex,
                          '--event-bg': eventColor,
                          '--calendar-color': calendarColor,
                          ...(event.googleMeetLink && event.eventType !== 'task'
                            ? { '--meet-action-size': getMeetActionSize(eventHeight) }
                            : {}),
                        }}
                      >
                        <button
                          type="button"
                          className={`weekGridEvent ${event.eventType === 'outOfOffice' ? 'weekGridEventOOO' : ''} ${event.eventType === 'task' ? 'weekGridEventTask' : ''} ${isClamped ? 'weekGridEventSticky' : ''} ${event.googleMeetLink ? 'hasMeetLink' : ''} ${showCalendarDot ? 'hasCalendarDot' : ''}`}
                          data-card-style={eventCardStyle}
                          onClick={(nativeEvent) => { 
                            nativeEvent.stopPropagation();
                            openCalendarItem(event, onEventClick, onTaskClick);
                          }}
                        >
                          {showCalendarDot && (
                            <span className="weekGridEventCalendarDot" aria-hidden="true" />
                          )}
                          <span className="weekGridEventTitle">{event.title}</span>
                          {pos.height >= 35 && event.eventType !== 'task' && (
                            <span className="weekGridEventTime">
                              {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </button>
                        {event.googleMeetLink && event.eventType !== 'task' && (
                          <button
                            type="button"
                            className="weekGridMeetAction"
                            title="Open Google Meet in a new tab"
                            aria-label="Open Google Meet in a new tab"
                            onClick={(nativeEvent) => handleMeetClick(event.googleMeetLink, nativeEvent)}
                          >
                            <Video className="weekGridMeetActionIcon" size={10} strokeWidth={2} />
                          </button>
                        )}
                      </div>
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
