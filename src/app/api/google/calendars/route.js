import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import {
  appendGoogleAuth,
  createGoogleOAuthClient,
  isGoogleAuthError,
  parseGoogleCredentials,
} from '@/lib/googleAuth';

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const credentials = parseGoogleCredentials(searchParams);

  if (!credentials.access_token) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    const { summary, description, color } = await request.json();
    
    if (!summary) {
      return NextResponse.json({ error: 'Calendar summary is required' }, { status: 400 });
    }

    const oauth2Client = createGoogleOAuthClient(request, credentials);

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

    return NextResponse.json(appendGoogleAuth(newCalendar, oauth2Client));
  } catch (err) {
    console.error('Google Calendar creation error:', err);

    if (isGoogleAuthError(err)) {
      return NextResponse.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, { status: 401 });
    }

    return NextResponse.json(
      { error: err.message || 'Failed to create calendar', details: err.errors || null },
      { status: 500 }
    );
  }
}
