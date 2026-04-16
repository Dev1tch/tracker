const HOSTED_API_BASE_URL = 'https://tracker-backend-mocha.vercel.app/api/v1';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/u, '');
}

function readEnvValue(value) {
  return typeof value === 'string' && value.trim() ? trimTrailingSlash(value.trim()) : '';
}

const DEFAULT_API_BASE_URL = readEnvValue(
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || '')
    : ''
) || HOSTED_API_BASE_URL;

function isPromiseLike(value) {
  return Boolean(value) && typeof value.then === 'function';
}

const defaultStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

const runtime = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  webAppUrl: '',
  storage: defaultStorage,
  onAuthChange: null,
  onUnauthorized: null,
};

function logAsyncStorageError(label, error) {
  console.error(`${label} failed:`, error);
}

export function configureApiRuntime(options = {}) {
  if (typeof options.apiBaseUrl === 'string' && options.apiBaseUrl.trim()) {
    runtime.apiBaseUrl = trimTrailingSlash(options.apiBaseUrl.trim());
  }

  if (typeof options.webAppUrl === 'string') {
    runtime.webAppUrl = options.webAppUrl.trim()
      ? trimTrailingSlash(options.webAppUrl.trim())
      : '';
  }

  if (options.storage && typeof options.storage === 'object') {
    runtime.storage = {
      ...runtime.storage,
      ...options.storage,
    };
  }

  if (Object.prototype.hasOwnProperty.call(options, 'onAuthChange')) {
    runtime.onAuthChange = typeof options.onAuthChange === 'function'
      ? options.onAuthChange
      : null;
  }

  if (Object.prototype.hasOwnProperty.call(options, 'onUnauthorized')) {
    runtime.onUnauthorized = typeof options.onUnauthorized === 'function'
      ? options.onUnauthorized
      : null;
  }

  return runtime;
}

export function getApiRuntime() {
  return runtime;
}

export function readStoredValue(key) {
  try {
    const value = runtime.storage?.getItem?.(key);
    if (isPromiseLike(value)) return null;
    return value ?? null;
  } catch (error) {
    console.error(`Failed to read storage key "${key}":`, error);
    return null;
  }
}

export function writeStoredValue(key, value) {
  try {
    const action = value == null
      ? runtime.storage?.removeItem?.(key)
      : runtime.storage?.setItem?.(key, value);

    if (isPromiseLike(action)) {
      action.catch((error) => logAsyncStorageError(`Persisting storage key "${key}"`, error));
    }
  } catch (error) {
    console.error(`Failed to persist storage key "${key}":`, error);
  }
}

export function resolveApiUrl(path, baseUrlOverride = null) {
  if (/^[a-z][a-z\d+\-.]*:/iu.test(path)) {
    return path;
  }

  const baseUrl = trimTrailingSlash(baseUrlOverride || runtime.apiBaseUrl);
  return `${baseUrl}${path}`;
}

export function resolveWebAppUrl(path = '') {
  if (!path) {
    return runtime.webAppUrl;
  }

  if (/^[a-z][a-z\d+\-.]*:/iu.test(path)) {
    return path;
  }

  if (!runtime.webAppUrl) {
    return path;
  }

  return new URL(path, `${runtime.webAppUrl}/`).toString();
}

export function notifyAuthChange(token) {
  if (typeof runtime.onAuthChange === 'function') {
    runtime.onAuthChange(token);
  }
}

export function handleUnauthorized(error) {
  if (typeof runtime.onUnauthorized === 'function') {
    runtime.onUnauthorized(error);
    return;
  }

  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export { DEFAULT_API_BASE_URL, HOSTED_API_BASE_URL };
