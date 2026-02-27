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
  async getEvents(tokens, timeMin, timeMax) {
    const params = new URLSearchParams();
    params.set('access_token', tokens.access_token);
    if (tokens.refresh_token) params.set('refresh_token', tokens.refresh_token);
    if (timeMin) params.set('time_min', timeMin);
    if (timeMax) params.set('time_max', timeMax);

    const response = await fetch(`/api/google/events?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Failed to fetch events');
      error.code = data.code;
      error.status = response.status;
      error.details = data.details;
      throw error;
    }

    return { 
      events: data.events,
      calendars: data.calendars
    };
  }

  /**
   * Create a new calendar
   */
  async createCalendar(tokens, calendarData) {
    const params = new URLSearchParams();
    params.set('access_token', tokens.access_token);
    if (tokens.refresh_token) params.set('refresh_token', tokens.refresh_token);

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
  async createEvent(tokens, eventData, calendarId = 'primary') {
    const params = new URLSearchParams();
    params.set('access_token', tokens.access_token);
    params.set('calendar_id', calendarId);
    if (tokens.refresh_token) params.set('refresh_token', tokens.refresh_token);

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
  async updateEvent(tokens, eventId, eventData, calendarId = 'primary') {
    const params = new URLSearchParams();
    params.set('access_token', tokens.access_token);
    params.set('event_id', eventId);
    params.set('calendar_id', calendarId);
    if (tokens.refresh_token) params.set('refresh_token', tokens.refresh_token);

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
  async deleteEvent(tokens, eventId, calendarId = 'primary') {
    const params = new URLSearchParams();
    params.set('access_token', tokens.access_token);
    params.set('event_id', eventId);
    params.set('calendar_id', calendarId);
    if (tokens.refresh_token) params.set('refresh_token', tokens.refresh_token);

    const response = await fetch(`/api/google/events?${params.toString()}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete event');
    return data;
  }

  /**
   * Save Google OAuth tokens to localStorage
   */
  saveTokens(tokens) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }
  }

  /**
   * Get stored Google OAuth tokens
   */
  getTokens() {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Clear stored tokens (disconnect)
   */
  clearTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Check if Google Calendar is connected
   */
  isConnected() {
    const tokens = this.getTokens();
    return Boolean(tokens?.access_token);
  }
}

export const calendarApi = new CalendarApi();
