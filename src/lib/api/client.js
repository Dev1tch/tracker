export const AUTH_CHANGE_EVENT = 'life-tracker:auth-change';

import {
  handleUnauthorized,
  notifyAuthChange,
  readStoredValue,
  resolveApiUrl,
  writeStoredValue,
} from './runtime.js';

function canDispatchBrowserEvents() {
  return typeof window !== 'undefined'
    && typeof window.dispatchEvent === 'function'
    && typeof Event === 'function';
}

export class ApiClient {
  constructor(baseUrl = null) {
    this.baseUrl = baseUrl;
    this.token = null;
    this.hasHydratedToken = false;
  }

  getResolvedBaseUrl() {
    return this.baseUrl;
  }

  hydrateToken(token) {
    this.token = token || null;
    this.hasHydratedToken = true;
  }

  getToken() {
    if (!this.hasHydratedToken) {
      this.token = readStoredValue('token');
      this.hasHydratedToken = true;
    }

    return this.token;
  }

  setToken(token) {
    const nextToken = token || null;
    this.token = nextToken;
    this.hasHydratedToken = true;

    writeStoredValue('token', nextToken);

    if (canDispatchBrowserEvents()) {
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    }

    notifyAuthChange(nextToken);
  }

  async request(path, options = {}) {
    const url = resolveApiUrl(path, this.getResolvedBaseUrl());
    const headers = {
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Default to JSON if content-type is not set
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers,
    };

    if (config.body && headers['Content-Type'] === 'application/json' && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await this.parseResponse(response);

      if (!response.ok) {
        // Handle Unauthorized / Token Expiry globally
        if (response.status === 401) {
          this.setToken(null);
          handleUnauthorized({ response, data });
        }

        const error = new Error(this.getErrorMessage(data, response));
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`API Error [${options.method || 'GET'}] ${url}:`, error);
      throw error;
    }
  }

  async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  getErrorMessage(data, response) {
    const detail = data?.detail;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const message = detail
        .map((item) => {
          if (typeof item === 'string') return item;

          const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null;
          const label = field ? `${field}: ` : '';
          const text = typeof item?.msg === 'string' ? item.msg : null;
          return text ? `${label}${text}` : null;
        })
        .filter(Boolean)
        .join('\n');

      if (message) {
        return message;
      }
    }

    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message;
    }

    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error;
    }

    if (typeof data === 'string' && data.trim()) {
      return data;
    }

    return response.statusText || 'API Request Failed';
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, { ...options, method: 'POST', body });
  }

  put(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PUT', body });
  }

  patch(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PATCH', body });
  }

  delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }

  /**
   * Specifically for OAuth2 login which uses application/x-www-form-urlencoded
   */
  async postForm(path, data, options = {}) {
    const params = new URLSearchParams();
    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        params.append(key, String(data[key]));
      }
    }

    return this.request(path, {
      ...options,
      method: 'POST',
      body: params.toString(),
      headers: {
        ...options.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }
}


export const apiClient = new ApiClient();
