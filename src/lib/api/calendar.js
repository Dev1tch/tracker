const STORAGE_KEY = 'google_calendar_tokens';
export const SCOPES = {
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  CALENDAR_READONLY: 'https://www.googleapis.com/auth/calendar.readonly'
};

export class CalendarApi {
  normalizeScope(scope) {
    if (Array.isArray(scope)) {
      return [...new Set(scope.filter((value) => typeof value === 'string' && value))];
    }

    if (typeof scope === 'string') {
      return [...new Set(scope.split(' ').filter(Boolean))];
    }

    return [];
  }

  mergeTokens(tokens = {}, existingTokens = {}) {
    const expiryDate = Number(tokens?.expiry_date ?? existingTokens?.expiry_date);

    return {
      access_token:
        (typeof tokens?.access_token === 'string' && tokens.access_token)
        || (typeof existingTokens?.access_token === 'string' && existingTokens.access_token)
        || null,
      refresh_token:
        (typeof tokens?.refresh_token === 'string' && tokens.refresh_token)
        || (typeof existingTokens?.refresh_token === 'string' && existingTokens.refresh_token)
        || null,
      expiry_date: Number.isFinite(expiryDate) && expiryDate > 0 ? expiryDate : null,
    };
  }

  normalizeAccount(account = {}) {
    return {
      email: account.email || '',
      picture: account.picture || null,
      tokens: this.mergeTokens(account.tokens, {}),
      scope: this.normalizeScope(account.scope),
      active: account.active ?? true,
      lastSync: account.lastSync || null,
    };
  }

  saveAccounts(accounts) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(accounts.map((account) => this.normalizeAccount(account)))
    );
  }

  syncAccountReference(targetAccount, nextAccount) {
    if (!targetAccount || !nextAccount) return;
    Object.assign(targetAccount, nextAccount);
  }

  upsertAccount(email, updates = {}, targetAccount = null) {
    if (typeof window === 'undefined' || !email) return null;

    const accounts = this.getAccounts();
    const existingIndex = accounts.findIndex((account) => account.email === email);
    const existingAccount = existingIndex >= 0 ? accounts[existingIndex] : null;
    const nextAccount = {
      email,
      picture: updates.picture ?? existingAccount?.picture ?? null,
      tokens: this.mergeTokens(updates.tokens, existingAccount?.tokens),
      scope:
        updates.scope !== undefined
          ? this.normalizeScope(updates.scope)
          : this.normalizeScope(existingAccount?.scope),
      active: updates.active ?? existingAccount?.active ?? true,
      lastSync: updates.lastSync ?? new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      accounts[existingIndex] = nextAccount;
    } else {
      accounts.push(nextAccount);
    }

    this.saveAccounts(accounts);
    this.syncAccountReference(targetAccount, nextAccount);

    return nextAccount;
  }

  buildAuthParams(account) {
    const params = new URLSearchParams();
    if (account?.tokens?.access_token) params.set('access_token', account.tokens.access_token);
    if (account?.tokens?.refresh_token) params.set('refresh_token', account.tokens.refresh_token);
    if (account?.tokens?.expiry_date) params.set('expiry_date', account.tokens.expiry_date.toString());
    return params;
  }

  async requestJson(url, account, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (data?.auth?.tokens && account?.email) {
      this.upsertAccount(
        account.email,
        {
          tokens: data.auth.tokens,
          scope: data.auth.tokens.scope,
          lastSync: new Date().toISOString(),
        },
        account
      );
    }

    if (!response.ok) {
      const error = new Error(data.error || 'Google Calendar request failed');
      error.code = data.code;
      error.status = response.status;
      error.details = data.details;
      error.email = account?.email;
      throw error;
    }

    return data;
  }

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
    const params = this.buildAuthParams(account);
    if (timeMin) params.set('time_min', timeMin);
    if (timeMax) params.set('time_max', timeMax);

    const data = await this.requestJson(`/api/google/events?${params.toString()}`, account);

    // Tag events and calendars with user email for UI identification
    const events = (data.events || []).map(e => ({ ...e, accountEmail: account.email }));
    const calendars = (data.calendars || []).map(c => ({ ...c, accountEmail: account.email }));

    return { events, calendars };
  }

  /**
   * Fetch a single event with optional recurrence resolution for recurring instances.
   */
  async getEvent(account, eventId, calendarId = 'primary', options = {}) {
    const params = this.buildAuthParams(account);
    params.set('event_id', eventId);
    params.set('calendar_id', calendarId);
    if (options.resolveRecurrence) params.set('resolve_recurrence', '1');

    const data = await this.requestJson(`/api/google/events?${params.toString()}`, account);

    return data.event ? { ...data.event, accountEmail: account.email } : null;
  }

  /**
   * Create a new calendar
   */
  async createCalendar(account, calendarData) {
    const params = this.buildAuthParams(account);
    return await this.requestJson(`/api/google/calendars?${params.toString()}`, account, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calendarData),
    });
  }

  /**
   * Create a new event
   */
  async createEvent(account, eventData, calendarId = 'primary') {
    const params = this.buildAuthParams(account);
    params.set('calendar_id', calendarId);
    return await this.requestJson(`/api/google/events?${params.toString()}`, account, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });
  }

  /**
   * Update an existing event
   */
  async updateEvent(account, eventId, eventData, calendarId = 'primary', options = {}) {
    const recurringEdit = options?.recurringEdit || null;
    const params = this.buildAuthParams(account);
    params.set('event_id', eventId);
    params.set('calendar_id', calendarId);
    if (recurringEdit?.mode) params.set('recurring_edit_mode', recurringEdit.mode);
    if (recurringEdit?.recurringEventId) params.set('recurring_event_id', recurringEdit.recurringEventId);
    if (recurringEdit?.originalStart) params.set('original_start', recurringEdit.originalStart);

    return await this.requestJson(`/api/google/events?${params.toString()}`, account, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });
  }

  /**
   * Delete an event
   */
  async deleteEvent(account, eventId, calendarId = 'primary', options = {}) {
    const params = this.buildAuthParams(account);
    params.set('event_id', eventId);
    params.set('calendar_id', calendarId);
    if (options?.recurringDelete?.mode) {
      params.set('recurring_delete_mode', options.recurringDelete.mode);
    }
    if (options?.recurringDelete?.recurringEventId) {
      params.set('recurring_event_id', options.recurringDelete.recurringEventId);
    }
    if (options?.recurringDelete?.originalStart) {
      params.set('original_start', options.recurringDelete.originalStart);
    }
    return await this.requestJson(`/api/google/events?${params.toString()}`, account, {
      method: 'DELETE',
    });
  }

  /**
   * Save Google OAuth tokens for a specific account to localStorage
   */
  saveAccount(tokens, email, picture, scope) {
    this.upsertAccount(email, {
      picture,
      tokens,
      scope,
      active: true,
      lastSync: new Date().toISOString(),
    });
  }

  /**
   * Check if an account has a specific permission
   */
  hasPermission(account, requiredScope) {
    if (!account || !account.scope) return false;
    // 'calendar' scope is a super-scope that covers others
    if (account.scope.includes(SCOPES.CALENDAR)) return true;
    return account.scope.includes(requiredScope);
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
      return Array.isArray(parsed)
        ? parsed
            .map((account) => this.normalizeAccount(account))
            .filter((account) => account.email)
        : [];
    } catch {
      return [];
    }
  }

  /**
   * Toggle an account's active status
   */
  toggleAccount(email) {
    if (typeof window === 'undefined') return;
    const accounts = this.getAccounts();
    const index = accounts.findIndex(a => a.email === email);
    if (index >= 0) {
      accounts[index].active = !accounts[index].active;
      this.saveAccounts(accounts);
    }
  }

  /**
   * Disconnect a specific account
   */
  removeAccount(email) {
    if (typeof window !== 'undefined') {
      const accounts = this.getAccounts().filter(a => a.email !== email);
      this.saveAccounts(accounts);
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
