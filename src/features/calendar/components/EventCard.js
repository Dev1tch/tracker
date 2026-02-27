'use client';

import React from 'react';
import { Clock, MapPin, ExternalLink } from 'lucide-react';

const EVENT_COLORS = [
  '#94a3b8', // todo (slate)
  '#60a5fa', // inprogress (blue)
  '#9ca3af', // paused (gray)
  '#fbbf24', // inreview (amber)
  '#34d399', // completed (emerald)
  '#f87171', // cancelled (red)
  '#6b7280', // archived (gray-dark)
];

function getEventColor(colorId) {
  if (!colorId) return '#34d399'; // Default to emerald
  const idx = parseInt(colorId, 10);
  return EVENT_COLORS[idx % EVENT_COLORS.length];
}

function formatEventTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function EventCard({ event }) {
  const color = getEventColor(event.color);

  return (
    <div className="calEventCard" style={{ '--event-color': color }}>
      <div className="calEventHeader">
        <h4 className="calEventTitle">{event.title}</h4>
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="calEventLink"
            title="Open in Google Calendar"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
          </a>
        )}
      </div>
      
      <div className="calEventMeta">
        {(!event.allDay && event.start) ? (
          <span className="calEventTime">
            <Clock size={12} strokeWidth={1.5} />
            {formatEventTime(event.start)}
            {event.end && ` – ${formatEventTime(event.end)}`}
          </span>
        ) : (
          <span className="calEventTime">
            <Clock size={12} strokeWidth={1.5} />
            All day
          </span>
        )}
        
        {event.location && (
          <span className="calEventLocation">
            <MapPin size={12} strokeWidth={1.5} />
            {event.location}
          </span>
        ) }
      </div>
    </div>
  );
}
