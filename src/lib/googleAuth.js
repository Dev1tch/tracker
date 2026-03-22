import { google } from 'googleapis';

function stripUndefinedEntries(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

function normalizeTokenValue(value) {
  return typeof value === 'string' && value ? value : undefined;
}

function normalizeExpiryDate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function getGoogleRedirectUri(request) {
  const origin = request?.nextUrl?.origin || new URL(request.url).origin;
  return `${origin}/api/google/callback`;
}

export function sanitizeGoogleCredentials(credentials = {}) {
  return stripUndefinedEntries({
    access_token: normalizeTokenValue(credentials.access_token),
    refresh_token: normalizeTokenValue(credentials.refresh_token),
    expiry_date: normalizeExpiryDate(credentials.expiry_date),
    scope: normalizeTokenValue(credentials.scope),
    token_type: normalizeTokenValue(credentials.token_type),
  });
}

export function parseGoogleCredentials(searchParams) {
  return sanitizeGoogleCredentials({
    access_token: searchParams.get('access_token'),
    refresh_token: searchParams.get('refresh_token'),
    expiry_date: searchParams.get('expiry_date'),
  });
}

export function createGoogleOAuthClient(request, credentials = {}) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(request)
  );

  oauth2Client.forceRefreshOnFailure = true;

  const sanitizedCredentials = sanitizeGoogleCredentials(credentials);
  if (Object.keys(sanitizedCredentials).length > 0) {
    oauth2Client.setCredentials(sanitizedCredentials);
  }

  return oauth2Client;
}

export function appendGoogleAuth(payload, oauth2Client) {
  return {
    ...payload,
    auth: {
      tokens: sanitizeGoogleCredentials(oauth2Client?.credentials || {}),
    },
  };
}

export function getGoogleErrorStatus(err) {
  const status = err?.response?.status ?? err?.code ?? err?.status;
  const parsed = Number(status);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isGoogleAuthError(err) {
  return getGoogleErrorStatus(err) === 401;
}

export function isGoogleForbiddenError(err) {
  return getGoogleErrorStatus(err) === 403;
}

export function isGoogleAccessError(err) {
  const status = getGoogleErrorStatus(err);
  return status === 401 || status === 403;
}
