'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import {
  MapPin,
  Plus,
  Video,
} from 'lucide-react';
import {
  createTaskCalendarEvents,
  formatCalendarTimeRange,
  getCalendarEventColor,
  isCalendarEventOnDay,
  isSameCalendarDay,
  parseCalendarDate,
} from '../utils/calendar-view.utils';

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function enumerateAgendaDays(startDate, endDate) {
  const days = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const finalDate = new Date(endDate);
  finalDate.setHours(0, 0, 0, 0);

  while (cursor <= finalDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatAgendaDayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

function formatAgendaDayTitle(date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function activateOnEnterOrSpace(event, onActivate) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate();
  }
}

function sortByStartTime(left, right) {
  return parseCalendarDate(left.start).getTime() - parseCalendarDate(right.start).getTime();
}

function getAgendaItemSortWeight(item) {
  if (item.allDay && item.eventType !== 'task') return 0;
  if (item.eventType === 'task') return 2;
  return 1;
}

function sortAgendaItems(left, right) {
  const weightDifference = getAgendaItemSortWeight(left) - getAgendaItemSortWeight(right);
  if (weightDifference !== 0) return weightDifference;
  return sortByStartTime(left, right);
}

function getAgendaItemKey(item, day) {
  return [
    day.toISOString(),
    item.accountEmail || '',
    item.calendarId || '',
    item.id || '',
    item.start || '',
    item.end || '',
  ].join(':');
}

function MobileAgendaCard({ item, eventCardStyle, onOpen }) {
  const isTask = item.eventType === 'task';
  const eventColor = isTask ? '#ef4444' : getCalendarEventColor(item);
  const calendarColor = item.calendarColor || eventColor;
  const showCalendarDot = !isTask;
  const hasExternalActions = !isTask && Boolean(item.googleMeetLink);
  const badgeLabel = isTask ? 'Task due' : item.allDay ? 'All day' : 'Scheduled';
  const sourceLabel = !isTask ? (item.calendarName || 'Calendar') : '';
  const hasMeta = Boolean((!isTask && (item.calendarName || item.accountEmail)) || item.location);
  const timeLabel = isTask
    ? `Due ${formatCalendarTimeRange(item.start, item.end)}`
    : item.allDay
      ? 'All day'
      : formatCalendarTimeRange(item.start, item.end);

  return (
    <div
      className={`calMobileCard ${isTask ? 'isTask' : ''}`}
      style={{
        '--event-bg': eventColor,
        '--calendar-color': calendarColor,
      }}
      data-card-style={eventCardStyle}
    >
      <div
        className={`calMobileCardContent ${hasExternalActions ? 'hasActions' : ''}`}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => activateOnEnterOrSpace(event, onOpen)}
      >
        <div className="calMobileCardTop">
          <div className="calMobileCardPills">
            <span className="calMobileCardTimePill">{timeLabel}</span>
            <span
              className={`calMobileCardBadge ${isTask ? 'isTask' : item.allDay ? 'isAllDay' : 'isTimed'}`}
            >
              {badgeLabel}
            </span>
          </div>
        </div>

        <div className="calMobileCardTitleRow">
          {showCalendarDot ? <span className="calMobileCardDot" aria-hidden="true" /> : null}
          <h3 className="calMobileCardTitle">{item.title}</h3>
        </div>

        {hasMeta ? (
          <div className="calMobileCardMeta">
            {!isTask && (item.calendarName || item.accountEmail) ? (
              <span className="calMobileCardMetaItem">
                <span className="calMobileCardMetaSourceDot" aria-hidden="true" />
                {sourceLabel}
                {item.accountEmail ? ` · ${item.accountEmail}` : ''}
              </span>
            ) : null}

            {item.location ? (
              <span className="calMobileCardMetaItem">
                <MapPin size={12} />
                {item.location}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasExternalActions ? (
        <div className="calMobileCardActions">
          <button
            type="button"
            className="calMobileCardAction"
            onClick={(event) => {
              event.stopPropagation();
              window.open(item.googleMeetLink, '_blank', 'noopener,noreferrer');
            }}
            aria-label="Open Google Meet in a new tab"
            title="Open Google Meet"
          >
            <Video size={13} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MobileAgendaDay({ day, items, eventCardStyle, onEventClick, onTaskClick, onCreateForDate }) {
  const isToday = isSameCalendarDay(day, new Date());
  const dayTitle = formatAgendaDayTitle(day);

  return (
    <section className={`calMobileDaySection ${isToday ? 'isToday' : ''}`}>
      <div className="calMobileDayHeader">
        <div className="calMobileDayHeading">
          <div className="calMobileDayMeta">
            <span className="calMobileDayLabel">{isToday ? 'Today' : formatAgendaDayLabel(day)}</span>
          </div>
          <h2 className="calMobileDayTitle">{dayTitle}</h2>
        </div>

        <button
          type="button"
          className="calMobileDayAction"
          onClick={() => onCreateForDate(day)}
          aria-label={`Add event for ${dayTitle}`}
          title={`Add event for ${dayTitle}`}
        >
          <Plus size={15} />
        </button>
      </div>

      {items.length > 0 ? (
        <div className="calMobileCardList">
          {items.map((item) => (
            <MobileAgendaCard
              key={getAgendaItemKey(item, day)}
              item={item}
              eventCardStyle={eventCardStyle}
              onOpen={() => {
                if (item.eventType === 'task') {
                  onTaskClick(item.originalTask);
                  return;
                }
                onEventClick(item);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function CalendarMobileView({
  agendaStart,
  agendaEnd,
  events,
  tasks,
  enabledCalendarIds,
  eventCardStyle,
  isLoadingMore,
  onLoadMore,
  onEventClick,
  onTaskClick,
  onCreateForDate,
}) {
  const scrollRef = useRef(null);
  const loadMoreRef = useRef(null);

  const agendaDays = useMemo(
    () => enumerateAgendaDays(agendaStart, agendaEnd),
    [agendaEnd, agendaStart]
  );

  const visibleCalendarEvents = useMemo(() => {
    return events.filter((event) =>
      enabledCalendarIds.has(`${event.accountEmail}-${event.calendarId}`)
    );
  }, [enabledCalendarIds, events]);

  const visibleTaskEvents = useMemo(() => createTaskCalendarEvents(tasks), [tasks]);

  const agendaSections = useMemo(() => {
    return agendaDays
      .map((day) => ({
        day,
        items: [
          ...visibleCalendarEvents.filter((event) => isCalendarEventOnDay(event, day)),
          ...visibleTaskEvents.filter((event) => isCalendarEventOnDay(event, day)),
        ].sort(sortAgendaItems),
      }))
      .filter((section) => section.items.length > 0);
  }, [agendaDays, visibleCalendarEvents, visibleTaskEvents]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [agendaStart]);

  useEffect(() => {
    if (!scrollRef.current || !loadMoreRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: scrollRef.current,
        rootMargin: '0px 0px 420px 0px',
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [isLoadingMore, onLoadMore]);

  return (
    <div className="calMobileView calMobileAgenda" ref={scrollRef}>
      {agendaSections.length > 0 ? (
        agendaSections.map(({ day, items }) => (
          <MobileAgendaDay
            key={day.toISOString()}
            day={day}
            items={items}
            eventCardStyle={eventCardStyle}
            onEventClick={onEventClick}
            onTaskClick={onTaskClick}
            onCreateForDate={onCreateForDate}
          />
        ))
      ) : (
        <section className="calMobileEmptyState glass">
          <h2 className="calMobileEmptyTitle">No events in this loaded range</h2>
          <p className="calMobileEmptyText">
            The agenda will keep extending as you scroll, or you can load more days right now.
          </p>
          <button
            type="button"
            className="btn-secondary calMobileEmptyAction"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            <Plus size={14} />
            <span>{isLoadingMore ? 'Loading…' : 'Load more days'}</span>
          </button>
        </section>
      )}

      <div ref={loadMoreRef} className="calMobileLoadMore">
        {isLoadingMore ? 'Loading more days...' : 'Scroll to keep exploring'}
      </div>
    </div>
  );
}
