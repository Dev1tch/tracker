export class ApiClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
    this.token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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
        if (response.status === 401 && typeof window !== 'undefined') {
          this.setToken(null);
          window.location.reload();
        }

        const error = new Error(data.detail || response.statusText || 'API Request Failed');
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
      params.append(key, data[key]);
    }

    return this.request(path, {
      ...options,
      method: 'POST',
      body: params,
      headers: {
        ...options.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }
}

// export const apiClient = new ApiClient('https://tracker-backend-mocha.vercel.app/api/v1');
export const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1');
