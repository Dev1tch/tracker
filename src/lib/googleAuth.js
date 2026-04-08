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

export function encodeGoogleState(value) {
  try {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  } catch {
    return '';
  }
}

export function decodeGoogleState(value) {
  if (!value) return {};

  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getSafeGoogleReturnTarget(request, candidate) {
  const fallback = request?.nextUrl?.origin || new URL(request.url).origin;
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);

    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin === fallback) {
      return candidate;
    }

    if (['exp:', 'exps:', 'tracker-mobile:'].includes(url.protocol)) {
      return candidate;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function appendQueryParamsToUrl(urlString, params = {}) {
  const url = new URL(urlString);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
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
