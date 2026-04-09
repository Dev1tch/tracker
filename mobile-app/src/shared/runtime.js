import * as SecureStore from 'expo-secure-store';

import {
  apiClient,
  calendarApi,
  configureApiRuntime,
  DEFAULT_API_BASE_URL,
} from './api';

function safeParseJson(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function initializeSharedRuntime({ onAuthChange, onUnauthorized } = {}) {
  const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_BASE_URL).trim();
  const webAppUrl = (process.env.EXPO_PUBLIC_WEB_APP_URL || '').trim();

  configureApiRuntime({
    apiBaseUrl,
    webAppUrl,
    storage: {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    onAuthChange,
    onUnauthorized,
  });

  const [token, accountPayload] = await Promise.all([
    SecureStore.getItemAsync('token'),
    SecureStore.getItemAsync('google_calendar_tokens'),
  ]);

  apiClient.hydrateToken(token || null);
  calendarApi.hydrateAccounts(safeParseJson(accountPayload));

  return {
    token: token || null,
    webAppUrl,
    apiBaseUrl,
  };
}
