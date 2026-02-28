const STORAGE_KEY = 'google_calendar_tokens';

export class CalendarApi {
  /**
   * Start the Google OAuth flow — redirects to the auth API route
   */
  getAuthUrl() {
    return '/api/google/auth';
  }

  /**
   * Fetch events and available calendars from Google Calendar via the API route
   */
  async getEvents(account, timeMin, timeMax) {
    const params = new URLSearchParams();
    params.set('access_token', account.tokens.access_token);
    if (account.tokens.refresh_token) params.set('refresh_token', account.tokens.refresh_token);
    if (timeMin) params.set('time_min', timeMin);
    if (timeMax) params.set('time_max', timeMax);

    const response = await fetch(`/api/google/events?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Failed to fetch events');
      error.code = data.code;
      error.status = response.status;
      error.details = data.details;
      error.email = account.email; // Track which account failed
      throw error;
    }

    // Tag events and calendars with user email for UI identification
    const events = (data.events || []).map(e => ({ ...e, accountEmail: account.email }));
    const calendars = (data.calendars || []).map(c => ({ ...c, accountEmail: account.email }));

    return { events, calendars };
  }

  /**
   * Create a new calendar
   */
  async createCalendar(account, calendarData) {
    const params = new URLSearchParams();
    params.set('access_token', account.tokens.access_token);
    if (account.tokens.refresh_token) params.set('refresh_token', account.tokens.refresh_token);

    const response = await fetch(`/api/google/calendars?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calendarData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create calendar');
    return data;
  }

  /**
   * Create a new event
   */
  async createEvent(account, eventData, calendarId = 'primary') {
    const params = new URLSearchParams();
    params.set('access_token', account.tokens.access_token);
    params.set('calendar_id', calendarId);
    if (account.tokens.refresh_token) params.set('refresh_token', account.tokens.refresh_token);

    const response = await fetch(`/api/google/events?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create event');
    return data;
  }

  /**
   * Update an existing event
   */
  async updateEvent(account, eventId, eventData, calendarId = 'primary') {
    const params = new URLSearchParams();
    params.set('access_token', account.tokens.access_token);
    params.set('event_id', eventId);
    params.set('calendar_id', calendarId);
    if (account.tokens.refresh_token) params.set('refresh_token', account.tokens.refresh_token);

    const response = await fetch(`/api/google/events?${params.toString()}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to update event');
    return data;
  }

  /**
   * Delete an event
   */
  async deleteEvent(account, eventId, calendarId = 'primary') {
    const params = new URLSearchParams();
    params.set('access_token', account.tokens.access_token);
    params.set('event_id', eventId);
    params.set('calendar_id', calendarId);
    if (account.tokens.refresh_token) params.set('refresh_token', account.tokens.refresh_token);

    const response = await fetch(`/api/google/events?${params.toString()}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete event');
    return data;
  }

  /**
   * Save Google OAuth tokens for a specific account to localStorage
   */
  saveAccount(tokens, email, picture) {
    if (typeof window !== 'undefined') {
      const accounts = this.getAccounts();
      const existingIndex = accounts.findIndex(a => a.email === email);
      
      const accountData = {
        email,
        picture,
        tokens,
        active: true, // Enabled by default
        lastSync: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        accounts[existingIndex] = accountData;
      } else {
        accounts.push(accountData);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    }
  }

  /**
   * Get all connected Google accounts
   */
  getAccounts() {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      // Handle legacy format (single object) if it exists
      if (!Array.isArray(parsed) && parsed && parsed.access_token) {
        return []; // We'll force a reconnect for simplicity with multi-account format
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Toggle an account's active status
   */
  toggleAccount(email) {
    if (typeof window !== 'undefined') {
      const accounts = this.getAccounts();
      const index = accounts.findIndex(a => a.email === email);
      if (index >= 0) {
        accounts[index].active = !accounts[index].active;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
      }
    }
  }

  /**
   * Disconnect a specific account
   */
  removeAccount(email) {
    if (typeof window !== 'undefined') {
      const accounts = this.getAccounts().filter(a => a.email !== email);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    }
  }

  /**
   * Clear all stored accounts (full disconnect)
   */
  clearAll() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Check if any Google account is connected
   */
  isConnected() {
    return this.getAccounts().length > 0;
  }
}

export const calendarApi = new CalendarApi();
