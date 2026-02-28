import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = request.nextUrl.origin;
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
    oauth2Client.setCredentials(tokens);

    // Fetch user info to identify the account
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Redirect back to app with tokens and user info as URL params (stored client-side)
    const params = new URLSearchParams();
    if (tokens.access_token) params.set('google_access_token', tokens.access_token);
    if (tokens.refresh_token) params.set('google_refresh_token', tokens.refresh_token);
    if (tokens.expiry_date) params.set('google_expiry_date', tokens.expiry_date.toString());
    
    // Add user identification
    if (userInfo.data.email) params.set('google_email', userInfo.data.email);
    if (userInfo.data.picture) params.set('google_picture', userInfo.data.picture);

    return NextResponse.redirect(`${appUrl}?${params.toString()}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}?google_error=token_exchange_failed`);
  }
}
