import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.GOOGLE_NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/google/callback`;

  if (error) {
    // User denied access — redirect back with error
    return NextResponse.redirect(`${appUrl}?google_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}?google_error=no_code`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Redirect back to app with tokens as URL params (stored client-side)
    const params = new URLSearchParams();
    if (tokens.access_token) params.set('google_access_token', tokens.access_token);
    if (tokens.refresh_token) params.set('google_refresh_token', tokens.refresh_token);
    if (tokens.expiry_date) params.set('google_expiry_date', tokens.expiry_date.toString());

    return NextResponse.redirect(`${appUrl}?${params.toString()}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}?google_error=token_exchange_failed`);
  }
}
