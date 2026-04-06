'use client';

import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';

function handleToggleKeyDown(event, onToggle) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onToggle();
  }
}

function CalendarToggleList({ calendars, enabledCalendarIds, onToggleCalendar }) {
  if (calendars.length === 0) {
    return <div className="calCalendarTogglesEmpty">No calendars in this section yet.</div>;
  }

  return calendars.map((calendar) => (
    <label
      key={`${calendar.accountEmail}-${calendar.id}`}
      className="calToggleItem"
      style={{ '--toggle-color': calendar.backgroundColor }}
    >
      <input
        type="checkbox"
        checked={enabledCalendarIds.has(`${calendar.accountEmail}-${calendar.id}`)}
        onChange={() => onToggleCalendar(`${calendar.accountEmail}-${calendar.id}`)}
      />
      <div className="calToggleMeta">
        <span className="calToggleSummary">{calendar.summary}</span>
        <span className="calToggleEmail">{calendar.accountEmail}</span>
      </div>
    </label>
  ));
}

export default function CalendarToggles({
  availableCalendars,
  enabledCalendarIds,
  isMyCalendarsOpen,
  isOtherCalendarsOpen,
  onToggleCalendar,
  onToggleMyCalendars,
  onToggleOtherCalendars,
  onOpenCreateCalendar,
}) {
  const ownedCalendars = availableCalendars.filter(
    (calendar) => calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
  );
  const sharedCalendars = availableCalendars.filter(
    (calendar) => calendar.accessRole !== 'owner' && calendar.accessRole !== 'writer'
  );

  return (
    <div className="calCalendarToggles">
      <div
        className="calTogglesHeader"
        onClick={onToggleMyCalendars}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => handleToggleKeyDown(event, onToggleMyCalendars)}
      >
        <h4 className="calTogglesTitle">My Calendars</h4>
        <div className="calTogglesActions">
          <button
            type="button"
            className="calAddCalendarBtn"
            onClick={(event) => {
              event.stopPropagation();
              onOpenCreateCalendar();
            }}
            title="Add calendar (primary account)"
          >
            <Plus size={14} />
          </button>
          <ChevronDown
            size={14}
            className={`calChevron ${isMyCalendarsOpen ? '' : 'isCollapsed'}`}
          />
        </div>
      </div>

      {isMyCalendarsOpen && (
        <CalendarToggleList
          calendars={ownedCalendars}
          enabledCalendarIds={enabledCalendarIds}
          onToggleCalendar={onToggleCalendar}
        />
      )}

      <div
        className="calTogglesHeader calTogglesHeaderSecondary"
        onClick={onToggleOtherCalendars}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => handleToggleKeyDown(event, onToggleOtherCalendars)}
      >
        <h4 className="calTogglesTitle">Other Calendars</h4>
        <ChevronDown
          size={14}
          className={`calChevron ${isOtherCalendarsOpen ? '' : 'isCollapsed'}`}
        />
      </div>

      {isOtherCalendarsOpen && (
        <CalendarToggleList
          calendars={sharedCalendars}
          enabledCalendarIds={enabledCalendarIds}
          onToggleCalendar={onToggleCalendar}
        />
      )}
    </div>
  );
}
