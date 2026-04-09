import { isIP } from 'node:net';
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

function getHeaderValue(request, headerName) {
  const value = request?.headers?.get?.(headerName);
  if (!value) return '';
  return value.split(',')[0].trim();
}

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return '';

  try {
    const url = new URL(value.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function getConfiguredGoogleAppOrigin() {
  return normalizeOrigin(
    process.env.GOOGLE_OAUTH_APP_URL
    || process.env.GOOGLE_NEXT_PUBLIC_APP_URL
    || ''
  );
}

function isLocalhostHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isRawIpHostname(hostname) {
  return isIP(hostname) !== 0;
}

export function isNativeGoogleReturnTarget(target) {
  try {
    const protocol = new URL(target).protocol;
    return ['exp:', 'exps:', 'tracker-mobile:'].includes(protocol);
  } catch {
    return false;
  }
}

export function isGoogleWebRedirectOriginAllowed(origin) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (url.protocol === 'http:' && isLocalhostHostname(hostname)) {
      return true;
    }

    if (url.protocol !== 'https:') {
      return false;
    }

    return !isRawIpHostname(hostname);
  } catch {
    return false;
  }
}

export function isGoogleNativeRedirectOriginAllowed(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && !isRawIpHostname(url.hostname);
  } catch {
    return false;
  }
}

export function getGoogleRequestOrigin(request) {
  const configuredOrigin = getConfiguredGoogleAppOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedHost = getHeaderValue(request, 'x-forwarded-host');
  const host = forwardedHost || getHeaderValue(request, 'host');
  const forwardedProto = getHeaderValue(request, 'x-forwarded-proto');
  const protocol = forwardedProto
    || request?.nextUrl?.protocol?.replace(/:$/u, '')
    || new URL(request.url).protocol.replace(/:$/u, '');

  if (host) {
    return `${protocol}://${host}`;
  }

  return request?.nextUrl?.origin || new URL(request.url).origin;
}

export function getGoogleRedirectUri(request) {
  const origin = getGoogleRequestOrigin(request);
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
  const fallback = getGoogleRequestOrigin(request);
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

export function buildNativeRedirectHtml(url) {
  const jsonUrl = JSON.stringify(url);
  const attrUrl = url.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${attrUrl}"><title>Redirecting\u2026</title></head><body><script>window.location.replace(${jsonUrl});<\/script><p>Redirecting\u2026</p></body></html>`;
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
