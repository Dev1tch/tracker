import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import {
  appendGoogleAuth,
  createGoogleOAuthClient,
  isGoogleAccessError,
  isGoogleAuthError,
  isGoogleForbiddenError,
  parseGoogleCredentials,
} from '@/lib/googleAuth';

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
    reminders: event.reminders || null,
    attendees: event.attendees || [],
    eventType: event.eventType || 'default',
    outOfOfficeProperties: event.outOfOfficeProperties || null,
    googleMeetLink: getGoogleMeetLink(event),
    recurringEventId: event.recurringEventId || null,
    originalStartTime: event.originalStartTime || null,
    originalStart: getOriginalStartValue(event.originalStartTime),
    startTimeZone: event.start?.timeZone || null,
    endTimeZone: event.end?.timeZone || null,
    customColor: event.extendedProperties?.private?.customColor || null,
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

function hasOwnProperty(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function removeConferenceDataIfRequested(requestBody, updatedEventData) {
  if (hasOwnProperty(updatedEventData, 'conferenceData') && updatedEventData.conferenceData === null) {
    delete requestBody.conferenceData;
  }

  return requestBody;
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
    colorId: hasOwnProperty(updatedEventData, 'colorId')
      ? updatedEventData.colorId
      : parentEvent.colorId,
    attendees: updatedEventData.attendees ?? parentEvent.attendees,
    recurrence: updatedEventData.recurrence ?? parentEvent.recurrence,
    reminders: updatedEventData.reminders ?? parentEvent.reminders,
    eventType: updatedEventData.eventType ?? parentEvent.eventType,
    outOfOfficeProperties:
      updatedEventData.outOfOfficeProperties ?? parentEvent.outOfOfficeProperties,
    transparency: updatedEventData.transparency ?? parentEvent.transparency,
    conferenceData: hasOwnProperty(updatedEventData, 'conferenceData')
      ? updatedEventData.conferenceData
      : parentEvent.conferenceData,
    guestsCanInviteOthers: parentEvent.guestsCanInviteOthers,
    guestsCanModify: parentEvent.guestsCanModify,
    guestsCanSeeOtherGuests: parentEvent.guestsCanSeeOtherGuests,
    anyoneCanAddSelf: parentEvent.anyoneCanAddSelf,
    visibility: parentEvent.visibility,
    extendedProperties: hasOwnProperty(updatedEventData, 'extendedProperties')
      ? updatedEventData.extendedProperties
      : parentEvent.extendedProperties,
  });
}

async function resolveRecurringSeriesContext(calendar, calendarId, recurringEventId) {
  const initialResponse = await calendar.events.get({
    calendarId,
    eventId: recurringEventId,
  });
  const initialEvent = initialResponse.data;

  // If the client accidentally passed an instance id here, follow it back to the master series.
  if (initialEvent?.recurringEventId && !(initialEvent?.recurrence || []).length) {
    const masterResponse = await calendar.events.get({
      calendarId,
      eventId: initialEvent.recurringEventId,
    });

    return {
      seriesEventId: initialEvent.recurringEventId,
      seriesEvent: masterResponse.data,
      requestedEvent: initialEvent,
    };
  }

  return {
    seriesEventId: recurringEventId,
    seriesEvent: initialEvent,
    requestedEvent: initialEvent,
  };
}

function buildRecurringInstanceUpdateBody(instanceEvent, updatedEventData, fallbackTimeZone) {
  const start = ensureTimedPayloadTimeZone(
    updatedEventData.start || instanceEvent.start,
    fallbackTimeZone
  );
  const end = ensureTimedPayloadTimeZone(
    updatedEventData.end || instanceEvent.end,
    fallbackTimeZone
  );

  return stripUndefinedEntries({
    summary: updatedEventData.summary ?? instanceEvent.summary ?? '(No title)',
    description: updatedEventData.description ?? instanceEvent.description,
    location: updatedEventData.location ?? instanceEvent.location,
    start,
    end,
    colorId: hasOwnProperty(updatedEventData, 'colorId')
      ? updatedEventData.colorId
      : instanceEvent.colorId,
    attendees: updatedEventData.attendees ?? instanceEvent.attendees,
    reminders: updatedEventData.reminders ?? instanceEvent.reminders,
    eventType: updatedEventData.eventType ?? instanceEvent.eventType,
    outOfOfficeProperties:
      updatedEventData.outOfOfficeProperties ?? instanceEvent.outOfOfficeProperties,
    transparency: updatedEventData.transparency ?? instanceEvent.transparency,
    conferenceData: hasOwnProperty(updatedEventData, 'conferenceData')
      ? updatedEventData.conferenceData
      : instanceEvent.conferenceData,
    guestsCanInviteOthers: instanceEvent.guestsCanInviteOthers,
    guestsCanModify: instanceEvent.guestsCanModify,
    guestsCanSeeOtherGuests: instanceEvent.guestsCanSeeOtherGuests,
    anyoneCanAddSelf: instanceEvent.anyoneCanAddSelf,
    visibility: instanceEvent.visibility,
    source: instanceEvent.source,
    status: instanceEvent.status,
    extendedProperties: hasOwnProperty(updatedEventData, 'extendedProperties')
      ? updatedEventData.extendedProperties
      : instanceEvent.extendedProperties,
  });
}

async function countFutureInstances(calendar, calendarId, recurringEventId, targetOriginalStart) {
  const instances = await listFutureInstances(
    calendar,
    calendarId,
    recurringEventId,
    targetOriginalStart
  );
  return instances.length;
}

function getFutureInstancesTimeMin(targetOriginalStart) {
  const timeMin = isDateOnlyValue(targetOriginalStart)
    ? `${targetOriginalStart}T00:00:00.000Z`
    : new Date(new Date(targetOriginalStart).getTime() - 1000).toISOString();

  return timeMin;
}

async function listFutureInstances(
  calendar,
  calendarId,
  recurringEventId,
  targetOriginalStart,
  options = {}
) {
  const timeMin = getFutureInstancesTimeMin(targetOriginalStart);
  const items = [];
  let pageToken = undefined;

  do {
    const response = await calendar.events.instances({
      calendarId,
      eventId: recurringEventId,
      timeMin,
      maxResults: 2500,
      pageToken,
      showDeleted: options.showDeleted ?? false,
    });

    for (const instance of response.data.items || []) {
      const originalStart = getOriginalStartValue(instance.originalStartTime);
      if (isSameOrAfterOriginalStart(originalStart, targetOriginalStart)) {
        items.push(instance);
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return items;
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function deleteInstances(calendar, calendarId, instances = []) {
  const chunks = chunkItems(instances, 10);

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((instance) =>
        calendar.events.delete({
          calendarId,
          eventId: instance.id,
        })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') continue;

      const status = result.reason?.response?.status ?? result.reason?.code;
      if (status === 404 || status === 410) continue;
      throw result.reason;
    }
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const credentials = parseGoogleCredentials(searchParams);
  const timeMin = searchParams.get('time_min');
  const timeMax = searchParams.get('time_max');
  const eventId = searchParams.get('event_id');
  const calendarId = searchParams.get('calendar_id') || 'primary';
  const resolveRecurrence = searchParams.get('resolve_recurrence') === '1';

  if (!credentials.access_token) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    const oauth2Client = createGoogleOAuthClient(request, credentials);

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

      return NextResponse.json(
        appendGoogleAuth(
          {
            event: normalizeCalendarEvent(currentEvent, { id: calendarId }, recurrenceOverride),
          },
          oauth2Client
        )
      );
    }
    
    // 1. Get the list of all calendars the user has
    let calendars = [];
    try {
      const calendarListResponse = await calendar.calendarList.list({
        minAccessRole: 'reader'
      });
      calendars = calendarListResponse.data.items || [];
    } catch (listErr) {
      if (isGoogleAccessError(listErr)) {
        throw listErr;
      }

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
        if (isGoogleAccessError(err)) {
          throw err;
        }

        console.error(`Error fetching events for calendar ${cal.id}:`, err);
        return [];
      }
    });
    
    const results = await Promise.all(eventPromises);
    
    const allInstances = results.flat();

    const allEvents = allInstances.map((event) => normalizeCalendarEvent(event));
    
    // Sort merged events by start time
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    return NextResponse.json(
      appendGoogleAuth(
        {
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
        },
        oauth2Client
      )
    );
  } catch (err) {
    console.error('Google Calendar events error:', err);

    if (isGoogleAuthError(err)) {
      return NextResponse.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, { status: 401 });
    }

    if (isGoogleForbiddenError(err)) {
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
  const credentials = parseGoogleCredentials(searchParams);
  const calendarId = searchParams.get('calendar_id') || 'primary';

  if (!credentials.access_token) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const oauth2Client = createGoogleOAuthClient(request, credentials);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log('Sending to Google Calendar API:', JSON.stringify(body, null, 2));
    const response = await calendar.events.insert({
      calendarId,
      requestBody: body,
      conferenceDataVersion: 1,
    });

    return NextResponse.json(appendGoogleAuth(response.data, oauth2Client));
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
  const credentials = parseGoogleCredentials(searchParams);
  const eventId = searchParams.get('event_id');
  const calendarId = searchParams.get('calendar_id') || 'primary';
  const recurringEditMode = searchParams.get('recurring_edit_mode') || 'this';
  const recurringEventId = searchParams.get('recurring_event_id');
  const originalStart = searchParams.get('original_start');

  if (!credentials.access_token || !eventId) {
    return NextResponse.json({ error: 'Missing access token or event ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const oauth2Client = createGoogleOAuthClient(request, credentials);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    if (recurringEditMode === 'future') {
      if (!recurringEventId || !originalStart) {
        return NextResponse.json(
          { error: 'Recurring update is missing its series context' },
          { status: 400 }
        );
      }

      const {
        seriesEventId,
        seriesEvent: parentEvent,
      } = await resolveRecurringSeriesContext(calendar, calendarId, recurringEventId);
      const parentStart = parentEvent.start?.dateTime || parentEvent.start?.date || '';
      const fallbackTimeZone =
        body.start?.timeZone ||
        body.end?.timeZone ||
        parentEvent.start?.timeZone ||
        parentEvent.end?.timeZone;
      const nextSeriesBody = removeConferenceDataIfRequested(
        buildFutureRecurringEventBody(parentEvent, body, fallbackTimeZone),
        body
      );

      if (recurrenceHasCount(nextSeriesBody.recurrence)) {
        const remainingCount = await countFutureInstances(
          calendar,
          calendarId,
          seriesEventId,
          originalStart
        );
        nextSeriesBody.recurrence = replaceRecurringRuleCount(
          nextSeriesBody.recurrence,
          Math.max(remainingCount, 1)
        );
      }

      if (sameOriginalStart(parentStart, originalStart)) {
        const response = await calendar.events.update({
          calendarId,
          eventId: seriesEventId,
          requestBody: nextSeriesBody,
          conferenceDataVersion: 1,
        });
        return NextResponse.json(appendGoogleAuth(response.data, oauth2Client));
      }

      const trimmedRecurrence = replaceRecurringRuleEnd(
        parentEvent.recurrence || [],
        formatRecurringUntil(originalStart)
      );
      const trimmedSeriesBody = buildFutureRecurringEventBody(
        parentEvent,
        { recurrence: trimmedRecurrence },
        fallbackTimeZone
      );

      await calendar.events.update({
        calendarId,
        eventId: seriesEventId,
        requestBody: trimmedSeriesBody,
        conferenceDataVersion: 1,
      });

      const remainingOldInstances = await listFutureInstances(
        calendar,
        calendarId,
        seriesEventId,
        originalStart
      );
      if (remainingOldInstances.length > 0) {
        await deleteInstances(calendar, calendarId, remainingOldInstances);
      }

      const response = await calendar.events.insert({
        calendarId,
        requestBody: nextSeriesBody,
        conferenceDataVersion: 1,
      });

      return NextResponse.json(appendGoogleAuth(response.data, oauth2Client));
    }

    if (recurringEventId && originalStart) {
      const currentResponse = await calendar.events.get({
        calendarId,
        eventId,
      });
      const currentEvent = currentResponse.data;
      const fallbackTimeZone =
        body.start?.timeZone ||
        body.end?.timeZone ||
        currentEvent.start?.timeZone ||
        currentEvent.end?.timeZone;
      const requestBody = removeConferenceDataIfRequested(
        buildRecurringInstanceUpdateBody(currentEvent, body, fallbackTimeZone),
        body
      );

      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody,
        conferenceDataVersion: 1,
      });

      return NextResponse.json(appendGoogleAuth(response.data, oauth2Client));
    }

    if (hasOwnProperty(body, 'conferenceData')) {
      const currentResponse = await calendar.events.get({
        calendarId,
        eventId,
      });
      const currentEvent = currentResponse.data;
      const fallbackTimeZone =
        body.start?.timeZone ||
        body.end?.timeZone ||
        currentEvent.start?.timeZone ||
        currentEvent.end?.timeZone;
      const requestBody = removeConferenceDataIfRequested(
        buildFutureRecurringEventBody(currentEvent, body, fallbackTimeZone),
        body
      );

      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody,
        conferenceDataVersion: 1,
      });

      return NextResponse.json(appendGoogleAuth(response.data, oauth2Client));
    }

    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: body,
      conferenceDataVersion: 1,
    });

    return NextResponse.json(appendGoogleAuth(response.data, oauth2Client));
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
  const credentials = parseGoogleCredentials(searchParams);
  const eventId = searchParams.get('event_id');
  const calendarId = searchParams.get('calendar_id') || 'primary';
  const recurringDeleteMode = searchParams.get('recurring_delete_mode') || 'this';
  const recurringEventId = searchParams.get('recurring_event_id');
  const originalStart = searchParams.get('original_start');


  if (!credentials.access_token || !eventId) {
    return NextResponse.json({ error: 'Missing access token or event ID' }, { status: 400 });
  }

  try {
    const oauth2Client = createGoogleOAuthClient(request, credentials);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    if (recurringDeleteMode === 'future') {
      if (!recurringEventId || !originalStart) {
        return NextResponse.json(
          { error: 'Recurring delete is missing its series context' },
          { status: 400 }
        );
      }

      const {
        seriesEventId,
        seriesEvent: parentEvent,
      } = await resolveRecurringSeriesContext(calendar, calendarId, recurringEventId);
      const parentStart = parentEvent.start?.dateTime || parentEvent.start?.date || '';

      if (sameOriginalStart(parentStart, originalStart)) {
        await calendar.events.delete({
          calendarId,
          eventId: seriesEventId,
        });
      } else {
        const trimmedRecurrence = replaceRecurringRuleEnd(
          parentEvent.recurrence || [],
          formatRecurringUntil(originalStart)
        );

        await calendar.events.patch({
          calendarId,
          eventId: seriesEventId,
          requestBody: { recurrence: trimmedRecurrence },
          conferenceDataVersion: 1,
        });

        const remainingOldInstances = await listFutureInstances(
          calendar,
          calendarId,
          seriesEventId,
          originalStart
        );
        if (remainingOldInstances.length > 0) {
          await deleteInstances(calendar, calendarId, remainingOldInstances);
        }
      }
    } else {
      await calendar.events.delete({
        calendarId,
        eventId,
      });
    }

    return NextResponse.json(appendGoogleAuth({ success: true }, oauth2Client));
  } catch (err) {
    console.error('Google Calendar delete event error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete event' },
      { status: err.code || 500 }
    );
  }
}
