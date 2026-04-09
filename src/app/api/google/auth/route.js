import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import {
  appendQueryParamsToUrl,
  encodeGoogleState,
  isGoogleNativeRedirectOriginAllowed,
  getGoogleRedirectUri,
  getGoogleRequestOrigin,
  getSafeGoogleReturnTarget,
  isNativeGoogleReturnTarget,
  isGoogleWebRedirectOriginAllowed,
} from '@/lib/googleAuth';

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // Use the current request origin for the redirect URI
  const appUrl = getGoogleRequestOrigin(request);
  const redirectUri = getGoogleRedirectUri(request);
  const returnTo = getSafeGoogleReturnTarget(
    request,
    request.nextUrl.searchParams.get('return_to')
  );
  const isNativeReturnTarget = isNativeGoogleReturnTarget(returnTo);

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google OAuth credentials not configured' },
      { status: 500 }
    );
  }

  if (isNativeReturnTarget && !isGoogleNativeRedirectOriginAllowed(appUrl)) {
    return NextResponse.redirect(
      appendQueryParamsToUrl(returnTo, {
        google_error: 'public_redirect_url_required',
      })
    );
  }

  if (!isNativeReturnTarget && !isGoogleWebRedirectOriginAllowed(appUrl)) {
    return NextResponse.redirect(
      appendQueryParamsToUrl(returnTo, {
        google_error: 'public_redirect_url_required',
      })
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state: encodeGoogleState({
      returnTo: returnTo !== appUrl ? returnTo : null,
    }),
  });

  return NextResponse.redirect(authUrl);
}
