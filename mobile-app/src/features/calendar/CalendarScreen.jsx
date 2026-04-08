import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import ActionButton from '../../components/ActionButton';
import DateTimeField from '../../components/DateTimeField';
import ModalSheet from '../../components/ModalSheet';
import ScreenShell from '../../components/ScreenShell';
import SectionCard from '../../components/SectionCard';
import TextField from '../../components/TextField';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import {
  calendarApi,
  SCOPES,
  tasksApi,
} from '../../shared/api';
import { theme } from '../../theme';
import {
  addDays,
  endOfDay,
  formatDateTime,
  formatFullDate,
  formatTimeRange,
  isSameDay,
  startOfDay,
  toLocalDateKey,
  toLocalISOStringWithOffset,
} from '../../utils/date';

WebBrowser.maybeCompleteAuthSession();

const EMPTY_EVENT_FORM = {
  title: '',
  description: '',
  location: '',
  calendarKey: '',
  allDay: false,
  start: new Date(),
  end: addDays(new Date(), 0),
};

const EMPTY_CALENDAR_FORM = {
  summary: '',
  description: '',
  color: '#60a5fa',
};

function CalendarChip({ label, active, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.calendarChip,
        active ? styles.calendarChipActive : null,
      ]}
    >
      {color ? <View style={[styles.calendarChipDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.calendarChipLabel, active && styles.calendarChipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EventEditorModal({
  visible,
  title,
  form,
  loading,
  availableCalendars,
  onChange,
  onClose,
  onSave,
  onDelete,
}) {
  return (
    <ModalSheet
      visible={visible}
      title={title}
      subtitle="Create and update Google Calendar events from the same route layer the web app uses."
      onClose={onClose}
      footer={(
        <View style={styles.modalFooter}>
          {onDelete ? (
            <ActionButton
              label="Delete"
              variant="ghost"
              icon="trash-outline"
              onPress={onDelete}
            />
          ) : <View />}
          <ActionButton
            label={loading ? 'Saving...' : 'Save event'}
            icon="checkmark"
            onPress={onSave}
            disabled={loading || !form.title.trim() || !form.calendarKey}
          />
        </View>
      )}
    >
      <TextField
        label="Title"
        placeholder="Planning session"
        value={form.title}
        onChangeText={(value) => onChange('title', value)}
      />
      <TextField
        label="Description"
        placeholder="Optional event details"
        value={form.description}
        onChangeText={(value) => onChange('description', value)}
        multiline
      />
      <TextField
        label="Location"
        placeholder="Office, Zoom, Cafe"
        value={form.location}
        onChangeText={(value) => onChange('location', value)}
      />

      <View style={styles.formSection}>
        <Text style={styles.formSectionLabel}>Calendar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.inlineWrap}>
            {availableCalendars.map((calendar) => {
              const key = `${calendar.accountEmail}:${calendar.id}`;
              return (
                <CalendarChip
                  key={key}
                  label={`${calendar.summary || 'Calendar'} • ${calendar.accountEmail}`}
                  color={calendar.backgroundColor}
                  active={form.calendarKey === key}
                  onPress={() => onChange('calendarKey', key)}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formSectionLabel}>Event Type</Text>
        <View style={styles.inlineWrap}>
          <CalendarChip
            label="Timed"
            active={!form.allDay}
            onPress={() => onChange('allDay', false)}
          />
          <CalendarChip
            label="All Day"
            active={form.allDay}
            onPress={() => onChange('allDay', true)}
          />
        </View>
      </View>

      <DateTimeField
        label={form.allDay ? 'Start Date' : 'Starts'}
        value={form.start}
        onChange={(value) => onChange('start', value)}
      />
      <DateTimeField
        label={form.allDay ? 'End Date' : 'Ends'}
        value={form.end}
        onChange={(value) => onChange('end', value)}
      />
    </ModalSheet>
  );
}

function CreateCalendarModal({
  visible,
  form,
  loading,
  onChange,
  onClose,
  onSave,
}) {
  return (
    <ModalSheet
      visible={visible}
      title="Create Calendar"
      subtitle="This uses the same Google calendar creation route as the web app."
      onClose={onClose}
      footer={(
        <View style={styles.modalFooter}>
          <ActionButton label="Cancel" variant="ghost" onPress={onClose} />
          <ActionButton
            label={loading ? 'Saving...' : 'Create'}
            icon="add"
            onPress={onSave}
            disabled={loading || !form.summary.trim()}
          />
        </View>
      )}
    >
      <TextField
        label="Calendar Name"
        placeholder="Personal"
        value={form.summary}
        onChangeText={(value) => onChange('summary', value)}
      />
      <TextField
        label="Description"
        placeholder="Optional"
        value={form.description}
        onChangeText={(value) => onChange('description', value)}
        multiline
      />
      <TextField
        label="Color"
        placeholder="#60a5fa"
        autoCapitalize="none"
        value={form.color}
        onChangeText={(value) => onChange('color', value)}
      />
    </ModalSheet>
  );
}

function buildEventForm(event, availableCalendars, selectedDate) {
  if (!event) {
    const selectedCalendar = availableCalendars[0];
    const startDate = startOfDay(selectedDate || new Date());
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(10, 0, 0, 0);

    return {
      ...EMPTY_EVENT_FORM,
      calendarKey: selectedCalendar ? `${selectedCalendar.accountEmail}:${selectedCalendar.id}` : '',
      start: startDate,
      end: endDate,
    };
  }

  return {
    title: event.title || '',
    description: event.description || '',
    location: event.location || '',
    calendarKey: `${event.accountEmail}:${event.calendarId || 'primary'}`,
    allDay: Boolean(event.allDay),
    start: event.start ? new Date(event.start) : new Date(),
    end: event.end ? new Date(event.end) : new Date(),
  };
}

function buildGoogleEventPayload(form) {
  const startDate = new Date(form.start);
  const endDate = new Date(form.end);
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (form.allDay) {
    return {
      summary: form.title.trim(),
      description: form.description || '',
      location: form.location || '',
      start: { date: toLocalDateKey(startDate) },
      end: { date: toLocalDateKey(addDays(endDate, 1)) },
      eventType: 'default',
    };
  }

  if (endDate <= startDate) {
    endDate.setHours(startDate.getHours() + 1);
  }

  return {
    summary: form.title.trim(),
    description: form.description || '',
    location: form.location || '',
    start: {
      dateTime: toLocalISOStringWithOffset(startDate),
      timeZone: browserTimeZone,
    },
    end: {
      dateTime: toLocalISOStringWithOffset(endDate),
      timeZone: browserTimeZone,
    },
    eventType: 'default',
  };
}

export default function CalendarScreen() {
  const { webAppUrl } = useAuth();
  const addToast = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [accounts, setAccounts] = useState([]);
  const [events, setEvents] = useState([]);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [enabledCalendarIds, setEnabledCalendarIds] = useState(new Set());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [createCalendarVisible, setCreateCalendarVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [calendarForm, setCalendarForm] = useState(EMPTY_CALENDAR_FORM);

  const dayStrip = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 3));
  }, [selectedDate]);

  const agendaSections = useMemo(() => {
    const enabled = enabledCalendarIds;

    return dayStrip.map((day) => {
      const dayKey = toLocalDateKey(day);
      const items = events
        .filter((event) => {
          const calendarKey = `${event.accountEmail}:${event.calendarId || 'primary'}`;
          return (!enabled.size || enabled.has(calendarKey)) && isSameDay(event.start, day);
        })
        .sort((left, right) => new Date(left.start || 0) - new Date(right.start || 0))
        .map((event) => ({ ...event, itemType: 'event' }))
        .concat(
          tasks
            .filter((task) => task.due_date && toLocalDateKey(task.due_date) === dayKey)
            .sort((left, right) => new Date(left.due_date || 0) - new Date(right.due_date || 0))
            .map((task) => ({ ...task, itemType: 'task' }))
        );

      return {
        day,
        items,
      };
    });
  }, [dayStrip, enabledCalendarIds, events, tasks]);

  const refreshCalendarData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const storedAccounts = calendarApi.getAccounts();
      setAccounts(storedAccounts);

      const [fetchedTasks, ...calendarResponses] = await Promise.all([
        tasksApi.getTasks(),
        ...storedAccounts
          .filter((account) => account.active)
          .map((account) =>
            calendarApi.getEvents(
              account,
              startOfDay(addDays(selectedDate, -7)).toISOString(),
              endOfDay(addDays(selectedDate, 21)).toISOString()
            )
          ),
      ]);

      const mergedEvents = [];
      const mergedCalendars = [];

      calendarResponses.forEach((response) => {
        mergedEvents.push(...(response.events || []));
        mergedCalendars.push(...(response.calendars || []));
      });

      setTasks(fetchedTasks);
      setEvents(mergedEvents);
      setAvailableCalendars(mergedCalendars);
      setEnabledCalendarIds((current) => {
        if (current.size > 0) return current;
        return new Set(mergedCalendars.map((calendar) => `${calendar.accountEmail}:${calendar.id}`));
      });
    } catch (error) {
      console.error('Failed to load calendar data', error);
      addToast(error?.message || 'Failed to load calendar data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast, selectedDate]);

  useEffect(() => {
    refreshCalendarData();
  }, [refreshCalendarData]);

  const openNewEvent = (date = selectedDate) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setEventForm(buildEventForm(null, availableCalendars, date));
    setEventModalVisible(true);
  };

  const openEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm(buildEventForm(event, availableCalendars, selectedDate));
    setEventModalVisible(true);
  };

  const handleConnectGoogle = async () => {
    if (!webAppUrl) {
      addToast('Set EXPO_PUBLIC_WEB_APP_URL to the deployed or locally reachable web app URL.', 'warning');
      return;
    }

    const redirectUrl = Linking.createURL('oauth/google');
    const authUrl = calendarApi.getAuthUrl({ returnTo: redirectUrl });

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type !== 'success' || !result.url) {
        return;
      }

      const params = Linking.parse(result.url).queryParams || {};
      if (params.google_error) {
        addToast(`Google connection failed: ${params.google_error}`, 'error');
        return;
      }

      if (!params.google_access_token || !params.google_email) {
        addToast('Google connection did not return tokens.', 'error');
        return;
      }

      calendarApi.saveAccount(
        {
          access_token: String(params.google_access_token),
          refresh_token: params.google_refresh_token ? String(params.google_refresh_token) : null,
          expiry_date: params.google_expiry_date ? Number(params.google_expiry_date) : null,
        },
        String(params.google_email),
        params.google_picture ? String(params.google_picture) : null,
        params.google_scope ? String(params.google_scope) : ''
      );

      addToast('Google account connected.');
      refreshCalendarData({ silent: true });
    } catch (error) {
      console.error('Failed to connect Google account', error);
      addToast(error?.message || 'Failed to connect Google account.', 'error');
    }
  };

  const toggleAccount = (email) => {
    calendarApi.toggleAccount(email);
    setAccounts(calendarApi.getAccounts());
    refreshCalendarData({ silent: true });
  };

  const removeAccount = (email) => {
    Alert.alert(
      'Disconnect account?',
      email,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            calendarApi.removeAccount(email);
            addToast('Google account disconnected.');
            refreshCalendarData({ silent: true });
          },
        },
      ]
    );
  };

  const handleSaveEvent = async () => {
    setSavingEvent(true);

    try {
      const [accountEmail, calendarId] = eventForm.calendarKey.split(':');
      const account = accounts.find((item) => item.email === accountEmail);

      if (!account) {
        throw new Error('Please choose a Google account.');
      }

      if (!calendarApi.hasPermission(account, SCOPES.CALENDAR_EVENTS)) {
        throw new Error('Reconnect Google with calendar event permissions to manage events.');
      }

      const payload = buildGoogleEventPayload(eventForm);

      if (editingEvent) {
        await calendarApi.updateEvent(account, editingEvent.id, payload, calendarId || 'primary');
        addToast('Event updated.');
      } else {
        await calendarApi.createEvent(account, payload, calendarId || 'primary');
        addToast('Event created.');
      }

      setEventModalVisible(false);
      refreshCalendarData({ silent: true });
    } catch (error) {
      console.error('Failed to save event', error);
      addToast(error?.message || 'Failed to save event.', 'error');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = () => {
    if (!editingEvent) return;

    Alert.alert(
      'Delete event?',
      editingEvent.title,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const account = accounts.find((item) => item.email === editingEvent.accountEmail);
              if (!account) {
                throw new Error('Account not found.');
              }

              await calendarApi.deleteEvent(
                account,
                editingEvent.id,
                editingEvent.calendarId || 'primary'
              );
              addToast('Event deleted.');
              setEventModalVisible(false);
              refreshCalendarData({ silent: true });
            } catch (error) {
              console.error('Failed to delete event', error);
              addToast(error?.message || 'Failed to delete event.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleCreateCalendar = async () => {
    const activeAccount = accounts.find((account) => account.active);
    if (!activeAccount) {
      addToast('Connect a Google account first.', 'warning');
      return;
    }

    setSavingCalendar(true);

    try {
      if (!calendarApi.hasPermission(activeAccount, SCOPES.CALENDAR)) {
        throw new Error('Reconnect Google with full calendar permissions to create calendars.');
      }

      await calendarApi.createCalendar(activeAccount, {
        summary: calendarForm.summary.trim(),
        description: calendarForm.description || '',
        color: calendarForm.color || '#60a5fa',
      });
      addToast('Calendar created.');
      setCreateCalendarVisible(false);
      setCalendarForm(EMPTY_CALENDAR_FORM);
      refreshCalendarData({ silent: true });
    } catch (error) {
      console.error('Failed to create calendar', error);
      addToast(error?.message || 'Failed to create calendar.', 'error');
    } finally {
      setSavingCalendar(false);
    }
  };

  return (
    <>
      <ScreenShell
        title="Calendar"
        subtitle="Agenda view for Google events and task due dates."
        showPageHeader={false}
        refreshControl={(
          <RefreshControl
            tintColor={theme.colors.text}
            refreshing={refreshing}
            onRefresh={() => refreshCalendarData({ silent: true })}
          />
        )}
      >
        {!webAppUrl ? (
          <SectionCard>
            <Text style={styles.warningTitle}>Calendar setup needed</Text>
            <Text style={styles.warningBody}>
              Set `EXPO_PUBLIC_WEB_APP_URL` to a reachable URL for this Next.js app so Expo can
              start the existing Google OAuth flow and hit `/api/google/*` from mobile.
            </Text>
          </SectionCard>
        ) : null}

        <SectionCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroTitle}>Calendar Agenda</Text>
              <Text style={styles.heroMeta}>Google events and task due dates in one mobile view.</Text>
            </View>
            <ActionButton
              label="New Event"
              variant="ghost"
              onPress={() => openNewEvent(selectedDate)}
              disabled={!accounts.length}
            />
          </View>

          <View style={styles.toolbar}>
            <ActionButton label="Connect Google" icon="link-outline" onPress={handleConnectGoogle} />
            <ActionButton label="New Calendar" variant="ghost" onPress={() => setCreateCalendarVisible(true)} disabled={!accounts.length} />
          </View>

          <View style={styles.weekStrip}>
            {agendaSections.map(({ day, items }) => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              return (
                <Pressable
                  key={toLocalDateKey(day)}
                  onPress={() => setSelectedDate(day)}
                  style={[
                    styles.dayButton,
                    isSelected ? styles.dayButtonSelected : null,
                  ]}
                >
                  <Text style={styles.dayName}>{day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3).toUpperCase()}</Text>
                  <View style={[styles.dayNumber, isToday ? styles.dayNumberToday : null]}>
                    <Text style={[styles.dayNumberLabel, isToday ? styles.dayNumberLabelToday : null]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  <View style={[styles.dayMarker, items.length > 0 ? styles.dayMarkerActive : null]} />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.accountsList}>
            {accounts.length === 0 ? (
              <Text style={styles.emptyText}>No Google accounts connected yet.</Text>
            ) : (
              accounts.map((account) => (
                <View key={account.email} style={styles.accountCard}>
                  <Pressable onPress={() => toggleAccount(account.email)} style={styles.accountMain}>
                    <View style={[styles.accountAvatar, { backgroundColor: account.active ? theme.colors.success : theme.colors.surface }]}>
                      <Text style={styles.accountAvatarLabel}>{account.email.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.accountTextWrap}>
                      <Text style={styles.accountTitle}>{account.email}</Text>
                      <Text style={styles.accountSubtitle}>
                        {account.active ? 'Active for sync' : 'Paused'}
                      </Text>
                    </View>
                  </Pressable>
                  <ActionButton
                    label=""
                    compact
                    variant="ghost"
                    icon="close"
                    onPress={() => removeAccount(account.email)}
                  />
                </View>
              ))
            )}
          </View>
        </SectionCard>

        {availableCalendars.length > 0 ? (
          <SectionCard>
            <Text style={styles.sectionLabel}>Visible Calendars</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineScrollContent}>
              <View style={styles.inlineWrap}>
                {availableCalendars.map((calendar) => {
                  const key = `${calendar.accountEmail}:${calendar.id}`;
                  const isEnabled = enabledCalendarIds.size === 0 || enabledCalendarIds.has(key);

                  return (
                    <CalendarChip
                      key={key}
                      label={`${calendar.summary || 'Calendar'} • ${calendar.accountEmail}`}
                      color={calendar.backgroundColor}
                      active={isEnabled}
                      onPress={() => {
                        setEnabledCalendarIds((current) => {
                          const next = new Set(current);
                          if (next.has(key)) {
                            next.delete(key);
                          } else {
                            next.add(key);
                          }
                          return next;
                        });
                      }}
                    />
                  );
                })}
              </View>
            </ScrollView>
          </SectionCard>
        ) : null}

        {loading ? (
          <SectionCard>
            <Text style={styles.emptyText}>Loading calendar…</Text>
          </SectionCard>
        ) : null}

        {!loading && agendaSections.every((section) => section.items.length === 0) ? (
          <SectionCard>
            <Text style={styles.warningTitle}>Nothing scheduled</Text>
            <Text style={styles.warningBody}>
              This day has no Google events or task due dates yet.
            </Text>
          </SectionCard>
        ) : null}

        {!loading && agendaSections.map(({ day, items }) => {
          if (items.length === 0) return null;
          const isToday = isSameDay(day, new Date());

          return (
            <View key={toLocalDateKey(day)} style={[styles.agendaDaySection, isToday ? styles.agendaDaySectionToday : null]}>
              <View style={styles.agendaDayHeader}>
                <View style={styles.agendaDayHeading}>
                  <Text style={[styles.agendaDayLabel, isToday ? styles.agendaDayLabelToday : null]}>
                    {isToday ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'long' })}
                  </Text>
                  <Text style={styles.agendaDayTitle}>{formatFullDate(day)}</Text>
                </View>
                <ActionButton
                  label=""
                  compact
                  variant="ghost"
                  icon="add"
                  onPress={() => openNewEvent(day)}
                />
              </View>

              <View style={styles.agendaCardList}>
                {items.map((item) => (
                  <View
                    key={`${item.itemType}:${item.id}:${toLocalDateKey(day)}`}
                    style={[
                      styles.mobileAgendaCard,
                      item.itemType === 'task' ? styles.mobileAgendaTaskCard : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.mobileAgendaAccent,
                        { backgroundColor: item.itemType === 'task' ? '#ef4444' : (item.calendarColor || theme.colors.info) },
                      ]}
                    />

                    {item.itemType === 'event' ? (
                      <Pressable onPress={() => openEditEvent(item)} style={styles.mobileAgendaContent}>
                        <View style={styles.agendaHeader}>
                          <View>
                            <Text style={styles.agendaEyebrow}>Google Event</Text>
                            <Text style={styles.agendaTitle}>{item.title}</Text>
                          </View>
                          <View style={styles.agendaBadge}>
                            <Text style={styles.agendaBadgeText}>
                              {item.allDay ? 'All Day' : 'Scheduled'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.agendaMeta}>
                          {item.allDay ? 'All day' : formatTimeRange(item.start, item.end)}
                        </Text>
                        {item.location ? <Text style={styles.agendaBody}>{item.location}</Text> : null}
                        <Text style={styles.agendaDetailText}>
                          {item.calendarName || 'Calendar'}{item.accountEmail ? ` · ${item.accountEmail}` : ''}
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.mobileAgendaContent}>
                        <View style={styles.agendaHeader}>
                          <View>
                            <Text style={styles.agendaEyebrow}>Task Due</Text>
                            <Text style={styles.agendaTitle}>{item.title}</Text>
                          </View>
                          <View style={styles.agendaBadge}>
                            <Text style={styles.agendaBadgeText}>Task Due</Text>
                          </View>
                        </View>
                        <Text style={styles.agendaMeta}>{formatDateTime(item.due_date)}</Text>
                        {item.description ? (
                          <Text style={styles.agendaBody} numberOfLines={3}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScreenShell>

      <EventEditorModal
        visible={eventModalVisible}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
        form={eventForm}
        loading={savingEvent}
        availableCalendars={availableCalendars}
        onChange={(field, value) => setEventForm((current) => ({ ...current, [field]: value }))}
        onClose={() => setEventModalVisible(false)}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : null}
      />

      <CreateCalendarModal
        visible={createCalendarVisible}
        form={calendarForm}
        loading={savingCalendar}
        onChange={(field, value) => setCalendarForm((current) => ({ ...current, [field]: value }))}
        onClose={() => setCreateCalendarVisible(false)}
        onSave={handleCreateCalendar}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 1.1,
  },
  heroMeta: {
    marginTop: 8,
    color: theme.colors.tertiary,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
  },
  dayButton: {
    flex: 1,
    minHeight: 66,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dayButtonSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  dayName: {
    color: theme.colors.secondary,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  dayNumber: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberToday: {
    backgroundColor: theme.colors.text,
  },
  dayNumberLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  dayNumberLabelToday: {
    color: theme.colors.background,
  },
  dayMarker: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  dayMarkerActive: {
    backgroundColor: theme.colors.success,
  },
  warningTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  warningBody: {
    color: theme.colors.tertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  accountsList: {
    gap: 8,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.surfaceSoft,
    padding: 10,
  },
  accountMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountAvatar: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarLabel: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: '600',
  },
  accountTextWrap: {
    gap: 2,
  },
  accountTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  accountSubtitle: {
    color: theme.colors.tertiary,
    fontSize: 10,
  },
  emptyText: {
    color: theme.colors.tertiary,
    fontSize: 12,
  },
  inlineScrollContent: {
    paddingRight: 12,
  },
  inlineWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  calendarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  calendarChipActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  calendarChipDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  calendarChipLabel: {
    color: theme.colors.secondary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  calendarChipLabelActive: {
    color: theme.colors.text,
  },
  sectionLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  agendaDaySection: {
    gap: 12,
  },
  agendaDaySectionToday: {
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
  },
  agendaDayHeader: {
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  agendaDayHeading: {
    gap: 6,
    minWidth: 0,
  },
  agendaDayLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.colors.tertiary,
  },
  agendaDayLabelToday: {
    color: theme.colors.background,
    backgroundColor: theme.colors.text,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  agendaDayTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  agendaCardList: {
    gap: 12,
  },
  mobileAgendaCard: {
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
    overflow: 'hidden',
  },
  mobileAgendaTaskCard: {
    borderColor: 'rgba(239, 68, 68, 0.24)',
  },
  mobileAgendaAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  mobileAgendaContent: {
    padding: 14,
    paddingLeft: 16,
  },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  agendaEyebrow: {
    color: theme.colors.tertiary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  agendaTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  agendaMeta: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  agendaBody: {
    color: theme.colors.tertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  agendaDetailText: {
    marginTop: 10,
    color: theme.colors.secondary,
    fontSize: 11,
  },
  agendaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  agendaBadgeText: {
    color: theme.colors.secondary,
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  formSection: {
    gap: 12,
    marginTop: 4,
  },
  formSectionLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
