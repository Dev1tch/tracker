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
    const appUrl = process.env.GOOGLE_NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/google/callback`;

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

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || undefined,
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || '(No title)',
      description: event.description || '',
      location: event.location || '',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      allDay: !event.start?.dateTime,
      color: event.colorId || null,
      htmlLink: event.htmlLink || '',
      status: event.status,
    }));

    return NextResponse.json({ events });
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
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: body,
    });

    return NextResponse.json(response.data);
  } catch (err) {
    console.error('Google Calendar create event error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create event' },
      { status: err.code || 500 }
    );
  }
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const eventId = searchParams.get('event_id');

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
      calendarId: 'primary',
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
      calendarId: 'primary',
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
