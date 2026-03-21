import { google } from 'googleapis';
import { NextResponse } from 'next/server';

function getGoogleMeetLink(event) {
  const hangoutLink = typeof event?.hangoutLink === 'string' ? event.hangoutLink : '';
  if (hangoutLink) return hangoutLink;

  const conferenceType = event?.conferenceData?.conferenceSolution?.key?.type || '';
  const conferenceName = event?.conferenceData?.conferenceSolution?.name || '';
  const videoEntry = event?.conferenceData?.entryPoints?.find(
    (entryPoint) => entryPoint.entryPointType === 'video' && typeof entryPoint.uri === 'string'
  );
  const candidate = videoEntry?.uri || '';
  const isGoogleMeet = conferenceType === 'hangoutsMeet'
    || /google meet/i.test(conferenceName)
    || /meet\.google\.com/i.test(candidate);

  return isGoogleMeet ? candidate : '';
}

function normalizeCalendarEvent(event, calendarMetadata = {}, recurrenceOverride = null) {
  let start = event.start?.dateTime || event.start?.date || '';
  let end = event.end?.dateTime || event.end?.date || '';
  let allDay = !event.start?.dateTime;

  if (event.start?.dateTime && event.end?.dateTime) {
    const startDT = event.start.dateTime;
    const endDT = event.end.dateTime;

    if (startDT.includes('T00:00:00')) {
      const startDate = new Date(startDT);
      const endDate = new Date(endDT);
      const diffMs = endDate - startDate;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours >= 23.9) {
        allDay = true;
        start = startDT.split('T')[0];

        if (endDT.includes('T00:00:00') && diffHours >= 23.9) {
          end = endDT.split('T')[0];
        } else {
          const nextDay = new Date(startDate);
          nextDay.setDate(nextDay.getDate() + 1);
          end = nextDay.toISOString().split('T')[0];
        }
      }
    }
  }

  return {
    id: event.id,
    calendarId: event.calendarId || calendarMetadata.id,
    title: event.summary || '(No title)',
    description: event.description || '',
    location: event.location || '',
    start,
    end,
    allDay,
    color: event.colorId || null,
    calendarColor: event.calendarColor || calendarMetadata.backgroundColor || null,
    htmlLink: event.htmlLink || '',
    status: event.status,
    calendarName: event.calendarSummary || calendarMetadata.summary,
    recurrence: recurrenceOverride ?? event.recurrence ?? [],
    attendees: event.attendees || [],
    eventType: event.eventType || 'default',
    outOfOfficeProperties: event.outOfOfficeProperties || null,
    googleMeetLink: getGoogleMeetLink(event),
    recurringEventId: event.recurringEventId || null,
    originalStartTime: event.originalStartTime || null,
    originalStart: getOriginalStartValue(event.originalStartTime),
    startTimeZone: event.start?.timeZone || null,
    endTimeZone: event.end?.timeZone || null,
  };
}

function getOriginalStartValue(originalStartTime) {
  return originalStartTime?.dateTime || originalStartTime?.date || '';
}

function isDateOnlyValue(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateOnlyUtc(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatRecurringUntil(originalStart) {
  if (!originalStart) return '';

  if (isDateOnlyValue(originalStart)) {
    const cutoff = parseDateOnlyUtc(originalStart);
    cutoff.setUTCDate(cutoff.getUTCDate() - 1);
    return cutoff.toISOString().slice(0, 10).replace(/-/g, '');
  }

  const cutoff = new Date(new Date(originalStart).getTime() - 1000);
  return cutoff.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/u, 'Z');
}

function replaceRecurringRuleEnd(recurrence = [], untilValue) {
  if (!Array.isArray(recurrence) || !untilValue) return recurrence;

  return recurrence.map((line) => {
    if (!line.startsWith('RRULE:')) return line;

    const parts = line
      .slice('RRULE:'.length)
      .split(';')
      .filter(Boolean)
      .filter((part) => !part.startsWith('UNTIL=') && !part.startsWith('COUNT='));

    parts.push(`UNTIL=${untilValue}`);
    return `RRULE:${parts.join(';')}`;
  });
}

function replaceRecurringRuleCount(recurrence = [], nextCount) {
  if (!Array.isArray(recurrence) || !Number.isFinite(nextCount) || nextCount < 1) {
    return recurrence;
  }

  return recurrence.map((line) => {
    if (!line.startsWith('RRULE:')) return line;

    const parts = line
      .slice('RRULE:'.length)
      .split(';')
      .filter(Boolean)
      .filter((part) => !part.startsWith('COUNT=') && !part.startsWith('UNTIL='));

    parts.push(`COUNT=${nextCount}`);
    return `RRULE:${parts.join(';')}`;
  });
}

function recurrenceHasCount(recurrence = []) {
  return recurrence.some((line) => line.startsWith('RRULE:') && line.includes('COUNT='));
}

function sameOriginalStart(a, b) {
  if (!a || !b) return false;
  if (isDateOnlyValue(a) || isDateOnlyValue(b)) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

function isSameOrAfterOriginalStart(value, target) {
  if (!value || !target) return false;
  if (isDateOnlyValue(value) && isDateOnlyValue(target)) return value >= target;
  return new Date(value).getTime() >= new Date(target).getTime();
}

function ensureTimedPayloadTimeZone(value, fallbackTimeZone) {
  if (!value?.dateTime || !fallbackTimeZone) return value;
  return {
    ...value,
    timeZone: value.timeZone || fallbackTimeZone,
  };
}

function stripUndefinedEntries(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

function buildFutureRecurringEventBody(parentEvent, updatedEventData, fallbackTimeZone) {
  const start = ensureTimedPayloadTimeZone(
    updatedEventData.start || parentEvent.start,
    fallbackTimeZone
  );
  const end = ensureTimedPayloadTimeZone(
    updatedEventData.end || parentEvent.end,
    fallbackTimeZone
  );

  return stripUndefinedEntries({
    summary: updatedEventData.summary ?? parentEvent.summary ?? '(No title)',
    description: updatedEventData.description ?? parentEvent.description,
    location: updatedEventData.location ?? parentEvent.location,
    start,
    end,
    colorId: updatedEventData.colorId ?? parentEvent.colorId,
    attendees: updatedEventData.attendees ?? parentEvent.attendees,
    recurrence: updatedEventData.recurrence ?? parentEvent.recurrence,
    reminders: updatedEventData.reminders ?? parentEvent.reminders,
    eventType: updatedEventData.eventType ?? parentEvent.eventType,
    outOfOfficeProperties:
      updatedEventData.outOfOfficeProperties ?? parentEvent.outOfOfficeProperties,
    transparency: updatedEventData.transparency ?? parentEvent.transparency,
    conferenceData: updatedEventData.conferenceData ?? parentEvent.conferenceData,
    guestsCanInviteOthers: parentEvent.guestsCanInviteOthers,
    guestsCanModify: parentEvent.guestsCanModify,
    guestsCanSeeOtherGuests: parentEvent.guestsCanSeeOtherGuests,
    anyoneCanAddSelf: parentEvent.anyoneCanAddSelf,
    visibility: parentEvent.visibility,
  });
}

async function countFutureInstances(calendar, calendarId, recurringEventId, targetOriginalStart) {
  const timeMin = isDateOnlyValue(targetOriginalStart)
    ? `${targetOriginalStart}T00:00:00.000Z`
    : new Date(new Date(targetOriginalStart).getTime() - 1000).toISOString();

  let total = 0;
  let pageToken = undefined;

  do {
    const response = await calendar.events.instances({
      calendarId,
      eventId: recurringEventId,
      timeMin,
      maxResults: 2500,
      pageToken,
      showDeleted: false,
    });

    for (const instance of response.data.items || []) {
      const originalStart = getOriginalStartValue(instance.originalStartTime);
      if (isSameOrAfterOriginalStart(originalStart, targetOriginalStart)) {
        total += 1;
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return total;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const timeMin = searchParams.get('time_min');
  const timeMax = searchParams.get('time_max');
  const eventId = searchParams.get('event_id');
  const calendarId = searchParams.get('calendar_id') || 'primary';
  const resolveRecurrence = searchParams.get('resolve_recurrence') === '1';

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    if (eventId) {
      const eventResponse = await calendar.events.get({
        calendarId,
        eventId,
      });

      const currentEvent = eventResponse.data;
      let recurrenceOverride = currentEvent.recurrence || [];

      if (
        resolveRecurrence &&
        !recurrenceOverride.length &&
        currentEvent.recurringEventId
      ) {
        const masterResponse = await calendar.events.get({
          calendarId,
          eventId: currentEvent.recurringEventId,
        });
        recurrenceOverride = masterResponse.data.recurrence || [];
      }

      return NextResponse.json({
        event: normalizeCalendarEvent(currentEvent, { id: calendarId }, recurrenceOverride),
      });
    }
    
    // 1. Get the list of all calendars the user has
    let calendars = [];
    try {
      const calendarListResponse = await calendar.calendarList.list({
        minAccessRole: 'reader'
      });
      calendars = calendarListResponse.data.items || [];
    } catch (listErr) {
      console.error('Error fetching calendar list, falling back to primary:', listErr);
      // Fallback: if we can't list calendars, just use 'primary'
      calendars = [{ id: 'primary', summary: 'Primary Calendar', backgroundColor: '#4285f4', accessRole: 'owner' }];
    }
    
    // 2. Fetch events from each calendar in parallel
    const eventPromises = calendars.map(async (cal) => {
      try {
        const response = await calendar.events.list({
          calendarId: cal.id,
          timeMin: timeMin || new Date().toISOString(),
          timeMax: timeMax || undefined,
          maxResults: 100, 
          singleEvents: true,
          orderBy: 'startTime',
          eventTypes: ['default', 'outOfOffice'],
        });
        
        return (response.data.items || []).map(event => ({
          ...event,
          calendarId: cal.id,
          calendarSummary: cal.summary,
          calendarColor: cal.backgroundColor
        }));
      } catch (err) {
        console.error(`Error fetching events for calendar ${cal.id}:`, err);
        return [];
      }
    });
    
    const results = await Promise.all(eventPromises);
    
    const allInstances = results.flat();

    const allEvents = allInstances.map((event) => normalizeCalendarEvent(event));
    
    // Sort merged events by start time
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    return NextResponse.json({ 
      events: allEvents,
      calendars: calendars.map(c => ({
        id: c.id,
        summary: c.summary,
        backgroundColor: c.backgroundColor,
        foregroundColor: c.foregroundColor,
        primary: c.primary || false,
        selected: c.selected || false,
        accessRole: c.accessRole
      }))
    });
  } catch (err) {
    console.error('Google Calendar events error:', err);

    if (err.code === 401 || err.response?.status === 401) {
      return NextResponse.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, { status: 401 });
    }

    if (err.code === 403 || err.response?.status === 403) {
      return NextResponse.json(
        { error: 'Google Calendar access is not available. Please try reconnecting.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: err.message || 'Failed to fetch events', details: err.errors || null },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const calendarId = searchParams.get('calendar_id') || 'primary';

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log('Sending to Google Calendar API:', JSON.stringify(body, null, 2));
    const response = await calendar.events.insert({
      calendarId,
      requestBody: body,
      conferenceDataVersion: 1,
    });

    return NextResponse.json(response.data);
  } catch (err) {
    console.error('Google Calendar create event error:', err);
    if (err.response) {
      console.error('Detailed Google API Error:', JSON.stringify(err.response.data, null, 2));
    }
    return NextResponse.json(
      { 
        error: err.message || 'Failed to create event',
        details: err.response?.data?.error || err.errors || null
      },
      { status: err.code || 500 }
    );
  }
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const eventId = searchParams.get('event_id');
  const calendarId = searchParams.get('calendar_id') || 'primary';
  const recurringEditMode = searchParams.get('recurring_edit_mode') || 'this';
  const recurringEventId = searchParams.get('recurring_event_id');
  const originalStart = searchParams.get('original_start');

  if (!accessToken || !eventId) {
    return NextResponse.json({ error: 'Missing access token or event ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    if (recurringEditMode === 'future') {
      if (!recurringEventId || !originalStart) {
        return NextResponse.json(
          { error: 'Recurring update is missing its series context' },
          { status: 400 }
        );
      }

      const parentResponse = await calendar.events.get({
        calendarId,
        eventId: recurringEventId,
      });
      const parentEvent = parentResponse.data;
      const parentStart = parentEvent.start?.dateTime || parentEvent.start?.date || '';
      const fallbackTimeZone =
        body.start?.timeZone ||
        body.end?.timeZone ||
        parentEvent.start?.timeZone ||
        parentEvent.end?.timeZone;
      const nextSeriesBody = buildFutureRecurringEventBody(parentEvent, body, fallbackTimeZone);

      if (recurrenceHasCount(nextSeriesBody.recurrence)) {
        const remainingCount = await countFutureInstances(
          calendar,
          calendarId,
          recurringEventId,
          originalStart
        );
        nextSeriesBody.recurrence = replaceRecurringRuleCount(
          nextSeriesBody.recurrence,
          Math.max(remainingCount, 1)
        );
      }

      if (sameOriginalStart(parentStart, originalStart)) {
        const response = await calendar.events.patch({
          calendarId,
          eventId: recurringEventId,
          requestBody: nextSeriesBody,
          conferenceDataVersion: 1,
        });
        return NextResponse.json(response.data);
      }

      const trimmedRecurrence = replaceRecurringRuleEnd(
        parentEvent.recurrence || [],
        formatRecurringUntil(originalStart)
      );

      await calendar.events.patch({
        calendarId,
        eventId: recurringEventId,
        requestBody: { recurrence: trimmedRecurrence },
        conferenceDataVersion: 1,
      });

      const response = await calendar.events.insert({
        calendarId,
        requestBody: nextSeriesBody,
        conferenceDataVersion: 1,
      });

      return NextResponse.json(response.data);
    }

    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: body,
      conferenceDataVersion: 1,
    });

    return NextResponse.json(response.data);
  } catch (err) {
    console.error('Google Calendar update event error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update event' },
      { status: err.code || 500 }
    );
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const eventId = searchParams.get('event_id');
  const calendarId = searchParams.get('calendar_id') || 'primary';


  if (!accessToken || !eventId) {
    return NextResponse.json({ error: 'Missing access token or event ID' }, { status: 400 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Google Calendar delete event error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete event' },
      { status: err.code || 500 }
    );
  }
}
