import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    const { summary, description, color } = await request.json();
    
    if (!summary) {
      return NextResponse.json({ error: 'Calendar summary is required' }, { status: 400 });
    }

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
    
    // 1. Create new calendar
    const createResponse = await calendar.calendars.insert({
      requestBody: {
        summary,
        description
      }
    });

    const newCalendar = createResponse.data;

    // 2. Set the color in calendarList if provided
    if (color && newCalendar.id) {
      try {
        await calendar.calendarList.patch({
          calendarId: newCalendar.id,
          colorRgbFormat: true,
          requestBody: {
            backgroundColor: color,
            foregroundColor: '#ffffff' // Assuming white for contrast, could be calculated
          }
        });
        
        // Return the updated data if possible, though createResponse is fine
        newCalendar.backgroundColor = color;
      } catch (colorErr) {
        console.error('Failed to set calendar color:', colorErr);
        // We don't fail the whole request just for color
      }
    }

    return NextResponse.json(newCalendar);
  } catch (err) {
    console.error('Google Calendar creation error:', err);

    if (err.code === 401 || err.response?.status === 401) {
      return NextResponse.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, { status: 401 });
    }

    return NextResponse.json(
      { error: err.message || 'Failed to create calendar', details: err.errors || null },
      { status: 500 }
    );
  }
}
