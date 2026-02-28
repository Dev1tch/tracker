import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const timeMin = searchParams.get('time_min');
  const timeMax = searchParams.get('time_max');

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

    // 4. Identify unique recurringEventIds to fetch their master event definitions
    const uniqueRecurringKeys = new Set();
    const recurringIds = [];
    
    allInstances.forEach(e => {
      if (e.recurringEventId && !e.recurrence) {
        const key = `${e.calendarId}-${e.recurringEventId}`;
        if (!uniqueRecurringKeys.has(key)) {
          uniqueRecurringKeys.add(key);
          recurringIds.push({ id: e.recurringEventId, calendarId: e.calendarId });
        }
      }
    });

    const masterEventMap = new Map();
    if (recurringIds.length > 0) {
      await Promise.all(recurringIds.map(async ({ id, calendarId }) => {
        try {
          const master = await calendar.events.get({ calendarId, eventId: id });
          masterEventMap.set(`${calendarId}-${id}`, master.data.recurrence || []);
        } catch (err) {
          console.error(`Error fetching master event ${id}:`, err);
        }
      }));
    }

    // 5. Build final event objects and merge recurrence from master events if needed
    const allEvents = allInstances.map((event) => {
      const masterRecurrence = event.recurringEventId ? masterEventMap.get(`${event.calendarId}-${event.recurringEventId}`) : null;
      
      return {
        id: event.id,
        calendarId: event.calendarId,
        title: event.summary || '(No title)',
        description: event.description || '',
        location: event.location || '',
        start: event.start?.dateTime || event.start?.date || '',
        end: event.end?.dateTime || event.end?.date || '',
        allDay: !event.start?.dateTime,
        color: event.colorId || null,
        calendarColor: event.calendarColor || null,
        htmlLink: event.htmlLink || '',
        status: event.status,
        calendarName: event.calendarSummary,
        recurrence: event.recurrence || masterRecurrence || [],
        attendees: event.attendees || [],
        eventType: event.eventType || 'default',
        outOfOfficeProperties: event.outOfOfficeProperties || null,
      };
    });
    
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
    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: body,
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
