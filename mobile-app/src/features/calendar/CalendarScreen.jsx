import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  User,
  Video,
  X,
} from 'lucide-react-native';

import ActionButton from '../../components/ActionButton';
import ColorField from '../../components/ColorField';
import DateTimeField from '../../components/DateTimeField';
import InlinePickerField from '../../components/InlinePickerField';
import ModalSheet from '../../components/ModalSheet';
import ScreenShell from '../../components/ScreenShell';
import TextField from '../../components/TextField';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import { useDialog } from '../../providers/DialogProvider';
import {
  calendarApi,
  SCOPES,
  tasksApi,
} from '../../shared/api';
import { useTheme } from '../../theme';
import {
  toLocalDateKey,
  combineDateAndTime,
  formatFullDate,
  formatTime,
  parseDateInputValue,
  toLocalISOStringWithOffset,
} from '../../utils/date';
import {
  createTaskCalendarEvents,
  formatCalendarTimeRange,
  getCalendarEventColor,
  isCalendarEventOnDay,
  isSameCalendarDay,
  parseCalendarDate,
} from '../../../../src/features/calendar/utils/calendar-view.utils.js';

WebBrowser.maybeCompleteAuthSession();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat'];
const MOBILE_AGENDA_INITIAL_PAST_DAYS = 7;
const MOBILE_AGENDA_INITIAL_FUTURE_DAYS = 21;
const MOBILE_AGENDA_LOAD_MORE_DAYS = 14;
const CALENDAR_SETTINGS_STORAGE_KEY = 'calendar.settings.mobile';
const CALENDAR_COLOR_PRESETS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#D946EF',
  '#F43F5E',
  '#14B8A6',
  '#0EA5E9',
];
const GOOGLE_EVENT_COLORS = [
  { id: '1', name: 'Lavender', hex: '#7986CB' },
  { id: '2', name: 'Sage', hex: '#33B679' },
  { id: '3', name: 'Grape', hex: '#8E24AA' },
  { id: '4', name: 'Flamingo', hex: '#E67C73' },
  { id: '5', name: 'Banana', hex: '#F6BF26' },
  { id: '6', name: 'Tangerine', hex: '#F4511E' },
  { id: '7', name: 'Peacock', hex: '#039BE5' },
  { id: '8', name: 'Graphite', hex: '#616161' },
  { id: '9', name: 'Blueberry', hex: '#3F51B5' },
  { id: '10', name: 'Basil', hex: '#0B8043' },
  { id: '11', name: 'Tomato', hex: '#D50000' },
];
const EVENT_COLOR_PRESETS = [
  '#94A3B8',
  '#60A5FA',
  '#9CA3AF',
  '#FBBF24',
  '#34D399',
  '#F87171',
  '#6B7280',
  '#E879F9',
  '#A78BFA',
  '#2DD4BF',
  '#4ADE80',
  '#F97316',
];
const DEFAULT_DECLINE_MESSAGE = 'Declined as I am currently out of office.';
const REMINDER_OPTIONS = [
  { value: '10', label: '10 Minutes Before' },
  { value: '30', label: '30 Minutes Before' },
  { value: '60', label: '1 Hour Before' },
  { value: '1440', label: '1 Day Before' },
];
const RECURRENCE_BASE_OPTIONS = [
  { value: '', label: 'Does Not Repeat' },
  { value: 'RRULE:FREQ=DAILY', label: 'Daily' },
  { value: 'RRULE:FREQ=WEEKLY', label: 'Weekly' },
  { value: 'RRULE:FREQ=MONTHLY', label: 'Monthly' },
  { value: 'RRULE:FREQ=YEARLY', label: 'Yearly' },
];
const DEFAULT_SETTINGS = {
  weekStart: 0,
  eventCardStyle: 'frame',
  syncTasks: true,
};
const EMPTY_EVENT_FORM = {
  title: '',
  description: '',
  location: '',
  calendarKey: '',
  eventDate: toLocalDateKey(new Date()),
  startTime: '09:00',
  endTime: '10:00',
  allDay: false,
  eventType: 'default',
  autoDecline: true,
  declineMessage: DEFAULT_DECLINE_MESSAGE,
  hasGoogleMeet: false,
  refreshGoogleMeet: false,
  guests: [],
  guestInput: '',
  recurrence: '',
  recurrenceOptions: RECURRENCE_BASE_OPTIONS,
  reminderMinutes: '30',
  colorId: '',
  initialColorId: '',
};
const EMPTY_CALENDAR_FORM = {
  summary: '',
  description: '',
  color: '#3B82F6',
};

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function getWeekStart(date, weekStartDay = 0) {
  const nextDate = new Date(date);
  const day = nextDate.getDay();
  const diff = (day < weekStartDay ? 7 : 0) + day - weekStartDay;
  nextDate.setDate(nextDate.getDate() - diff);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function formatWeekRange(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = MONTHS[weekStart.getMonth()];
  const endMonth = MONTHS[weekEnd.getMonth()];
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startMonth} - ${endMonth} ${startYear}`;
  }
  return `${startMonth} ${startYear}`;
}

function enumerateAgendaDays(startDate, endDate) {
  const days = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const finalDate = new Date(endDate);
  finalDate.setHours(0, 0, 0, 0);

  while (cursor <= finalDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatAgendaDayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

function formatAgendaDayTitle(date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getEnabledCalendarId(accountEmail, calendarId = 'primary') {
  return `${accountEmail || ''}-${calendarId || 'primary'}`;
}

function getEventKey(event) {
  return [
    event.accountEmail || '',
    event.calendarId || '',
    event.id || '',
    event.recurringEventId || '',
    event.start || '',
    event.end || '',
  ].join(':');
}

function getCalendarKey(calendar) {
  return `${calendar.accountEmail || ''}:${calendar.id || ''}`;
}

function mergeByKey(existingItems = [], incomingItems = [], getKey) {
  const merged = new Map();

  existingItems.forEach((item) => {
    merged.set(getKey(item), item);
  });

  incomingItems.forEach((item) => {
    merged.set(getKey(item), item);
  });

  return Array.from(merged.values());
}

function withOpacity(color, alpha, fallback = '#34D399') {
  const value = (color || fallback || '').trim();
  const normalized = /^#([0-9a-f]{6})$/iu.test(value)
    ? value
    : fallback;

  const hex = normalized.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getAgendaItemSortWeight(item) {
  if (item.allDay && item.eventType !== 'task') return 0;
  if (item.eventType === 'task') return 2;
  return 1;
}

function sortAgendaItems(left, right) {
  const weightDifference = getAgendaItemSortWeight(left) - getAgendaItemSortWeight(right);
  if (weightDifference !== 0) return weightDifference;
  return parseCalendarDate(left.start).getTime() - parseCalendarDate(right.start).getTime();
}

function getAgendaItemKey(item, day) {
  return [
    day.toISOString(),
    item.accountEmail || '',
    item.calendarId || '',
    item.id || '',
    item.start || '',
    item.end || '',
  ].join(':');
}

function getGoogleErrorMessage(code) {
  if (code === 'public_redirect_url_required') {
    return 'Google Calendar on iPhone needs a public HTTPS callback URL. Use a public web URL for the Next app, not localhost or a 192.168.* address.';
  }

  if (code === 'token_exchange_failed') {
    return 'Google connected, but token exchange failed.';
  }

  if (code === 'no_code') {
    return 'Google did not return an authorization code.';
  }

  return `Google connection failed: ${code}`;
}

function buildGoogleMeetRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `meet-${globalThis.crypto.randomUUID()}`;
  }

  return `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHexColor(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const candidate = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#([0-9a-f]{6})$/iu.test(candidate) ? candidate.toUpperCase() : '';
}

function isGooglePresetId(value) {
  return GOOGLE_EVENT_COLORS.some((color) => color.id === String(value));
}

function getCurrentEventColorHex(colorId) {
  if (!colorId) return '#34D399';
  if (String(colorId).startsWith('#')) return normalizeHexColor(colorId) || '#34D399';

  const matched = GOOGLE_EVENT_COLORS.find((color) => color.id === String(colorId));
  return matched?.hex || '#34D399';
}

function getReminderMinutes(reminders) {
  const firstReminder = reminders?.[0]?.minutes;
  return Number.isFinite(firstReminder) ? String(firstReminder) : '30';
}

function buildRecurrenceOptions(recurrenceValue = '') {
  if (!recurrenceValue || RECURRENCE_BASE_OPTIONS.some((option) => option.value === recurrenceValue)) {
    return RECURRENCE_BASE_OPTIONS;
  }

  const frequency = recurrenceValue.split('FREQ=')[1]?.split(';')[0];
  const label = frequency
    ? `Custom (${frequency.charAt(0)}${frequency.slice(1).toLowerCase()})`
    : 'Custom';

  return [
    ...RECURRENCE_BASE_OPTIONS,
    { value: recurrenceValue, label },
  ];
}

function buildEventDateLabel(value) {
  const parsed = parseDateInputValue(value);
  return parsed ? formatFullDate(parsed) : '';
}

function getRecurringSeriesId(event) {
  return event?.recurringEventId || ((event?.recurrence || []).length ? event?.id : '');
}

function FramelessIconButton({ icon, color, onPress, size = 16 }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const Icon = icon;

  return (
    <Pressable hitSlop={10} onPress={onPress} style={styles.iconButton}>
      <Icon color={color ?? theme.colors.text} size={size} strokeWidth={1.7} />
    </Pressable>
  );
}

function InlineSelectMenu({
  visible,
  options,
  selectedValue,
  onSelect,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (!visible) return null;

  return (
    <View style={styles.inlineSelectMenu}>
      {options.map((option, index) => {
        const selected = selectedValue === option.value;

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onSelect(option.value)}
            style={[
              styles.inlineSelectRow,
              index === options.length - 1 ? styles.inlineSelectRowLast : null,
              selected ? styles.inlineSelectRowSelected : null,
            ]}
          >
            <View style={styles.inlineSelectMain}>
              {option.color ? (
                <View style={[styles.inlineSelectDot, { backgroundColor: option.color }]} />
              ) : null}
              <Text
                numberOfLines={1}
                style={[
                  styles.inlineSelectLabel,
                  selected ? styles.inlineSelectLabelSelected : null,
                ]}
              >
                {option.label}
              </Text>
            </View>
            {selected ? (
              <Check color={theme.colors.text} size={12} strokeWidth={2} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function CalendarHeaderButton({ label, icon, onPress, disabled = false, primary = false }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const Icon = icon;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerButton,
        primary ? styles.headerButtonPrimary : null,
        disabled ? styles.headerButtonDisabled : null,
        pressed && !disabled ? styles.headerButtonPressed : null,
      ]}
    >
      {Icon ? <Icon color={theme.colors.text} size={15} strokeWidth={1.7} /> : null}
      <Text style={styles.headerButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function AccountAvatar({ account, size = 22 }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (account?.picture) {
    return (
      <Image
        source={{ uri: account.picture }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.accountAvatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <User color={theme.colors.secondary} size={size <= 22 ? 12 : 14} strokeWidth={1.7} />
    </View>
  );
}

function AccountSwitcherPanel({
  accounts,
  open,
  onToggleOpen,
  onConnect,
  onToggleAccount,
  onDisconnect,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (accounts.length === 0) {
    return (
      <Pressable onPress={onConnect} style={({ pressed }) => [
        styles.connectButton,
        pressed ? styles.connectButtonPressed : null,
      ]}>
        <Globe color={theme.colors.text} size={16} strokeWidth={1.5} />
        <Text style={styles.connectButtonLabel}>Connect Google Calendar</Text>
      </Pressable>
    );
  }

  const activeAccounts = accounts.filter((account) => account.active);
  const primaryAccount = activeAccounts[0] || accounts[0];

  return (
    <View style={styles.accountDropdownContainer}>
      <View style={styles.connectedBar}>
        <View style={styles.connectedStatus}>
          <View
            style={[
              styles.connectedDot,
              activeAccounts.length > 0 ? null : styles.connectedDotPaused,
            ]}
          />
          <Text style={styles.connectedStatusLabel}>
            {accounts.length} account{accounts.length > 1 ? 's' : ''} connected
          </Text>
        </View>

        <Pressable onPress={onToggleOpen} style={({ pressed }) => [
          styles.accountTrigger,
          pressed ? styles.accountTriggerPressed : null,
        ]}>
          <AccountAvatar account={primaryAccount} size={22} />
          <ChevronDown
            color={theme.colors.secondary}
            size={14}
            strokeWidth={1.7}
            style={open ? styles.accountTriggerChevronOpen : null}
          />
        </Pressable>
      </View>

      {open ? (
        <View style={styles.accountDropdownMenu}>
          <View style={styles.accountDropdownHeader}>
            <Text style={styles.accountDropdownTitle}>Accounts</Text>
            <FramelessIconButton icon={Plus} onPress={onConnect} size={14} />
          </View>

          <View style={styles.accountDropdownList}>
            {accounts.map((account) => (
              <View
                key={account.email}
                style={[
                  styles.accountDropdownItem,
                  !account.active ? styles.accountDropdownItemInactive : null,
                ]}
              >
                <View style={styles.accountDropdownInfo}>
                  <AccountAvatar account={account} size={26} />
                  <View style={styles.accountDropdownDetails}>
                    <Text numberOfLines={2} style={styles.accountDropdownEmail}>
                      {account.email}
                    </Text>
                  </View>
                </View>

                <View style={styles.accountDropdownActions}>
                  <Pressable
                    onPress={() => onToggleAccount(account.email)}
                    style={[
                      styles.accountDropdownAction,
                      account.active ? styles.accountDropdownActionActive : null,
                    ]}
                  >
                    {account.active ? (
                      <Check color={theme.colors.text} size={12} strokeWidth={2.2} />
                    ) : (
                      <X color={theme.colors.muted} size={12} strokeWidth={2.2} />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => onDisconnect(account.email)}
                    style={styles.accountDropdownAction}
                  >
                    <LogOut color={theme.colors.muted} size={12} strokeWidth={1.9} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MiniCalendarPanel({
  selectedDate,
  onDateSelect,
  events = [],
  enabledCalendarIds,
  weekStartDay = 0,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [viewDate, setViewDate] = useState(new Date(selectedDate || new Date()));

  useEffect(() => {
    setViewDate(new Date(selectedDate || new Date()));
  }, [selectedDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const leadingDays = (firstDayOfMonth - weekStartDay + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const orderedDays = useMemo(
    () => [...DAYS.slice(weekStartDay), ...DAYS.slice(0, weekStartDay)],
    [weekStartDay]
  );

  const calendarDays = useMemo(() => {
    const days = [];

    for (let index = leadingDays - 1; index >= 0; index -= 1) {
      days.push({
        day: daysInPrevMonth - index,
        isCurrentMonth: false,
        date: new Date(year, month - 1, daysInPrevMonth - index),
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push({
        day,
        isCurrentMonth: true,
        date: new Date(year, month, day),
      });
    }

    const remaining = 42 - days.length;
    for (let index = 1; index <= remaining; index += 1) {
      days.push({
        day: index,
        isCurrentMonth: false,
        date: new Date(year, month + 1, index),
      });
    }

    return days;
  }, [daysInMonth, daysInPrevMonth, leadingDays, month, year]);

  const hasEvents = useCallback((date) => {
    return events.some((event) => {
      const compositeId = getEnabledCalendarId(event.accountEmail, event.calendarId);
      return enabledCalendarIds.has(compositeId) && isCalendarEventOnDay(event, date);
    });
  }, [enabledCalendarIds, events]);

  return (
    <View style={styles.miniCalendar}>
      <View style={styles.miniCalendarHeader}>
        <Text style={styles.miniCalendarTitle}>
          {MONTHS[month]} {year}
        </Text>
        <View style={styles.miniCalendarNav}>
          <FramelessIconButton
            icon={ChevronLeft}
            color={theme.colors.tertiary}
            onPress={() => setViewDate(new Date(year, month - 1, 1))}
            size={14}
          />
          <FramelessIconButton
            icon={ChevronRight}
            color={theme.colors.tertiary}
            onPress={() => setViewDate(new Date(year, month + 1, 1))}
            size={14}
          />
        </View>
      </View>

      <View style={styles.miniCalendarDays}>
        {orderedDays.map((day) => (
          <Text key={day} style={styles.miniCalendarDayName}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.miniCalendarGrid}>
        {calendarDays.map((cell) => {
          const isToday = isSameCalendarDay(cell.date, new Date());
          const isSelected = selectedDate && isSameCalendarDay(cell.date, selectedDate);
          const showDot = cell.isCurrentMonth && hasEvents(cell.date);

          return (
            <Pressable
              key={cell.date.toISOString()}
              onPress={() => onDateSelect(cell.date)}
              style={[
                styles.miniCalendarCell,
                !cell.isCurrentMonth ? styles.miniCalendarCellOther : null,
              ]}
            >
              <View
                style={[
                  styles.miniCalendarCellIndicator,
                  isToday ? styles.miniCalendarCellToday : null,
                  isSelected ? styles.miniCalendarCellSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.miniCalendarCellLabel,
                    isToday ? styles.miniCalendarCellLabelToday : null,
                    isSelected ? styles.miniCalendarCellLabelSelected : null,
                  ]}
                >
                  {cell.day}
                </Text>
              </View>
              <View style={styles.miniCalendarDot}>
                {showDot ? <View style={styles.miniCalendarDotInner} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CalendarToggleSection({
  title,
  calendars,
  enabledCalendarIds,
  open,
  onToggleOpen,
  onToggleCalendar,
  showAddButton = false,
  onOpenCreateCalendar,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.calendarToggleSection}>
      <Pressable onPress={onToggleOpen} style={styles.calendarToggleHeader}>
        <Text style={styles.calendarToggleTitle}>{title}</Text>
        <View style={styles.calendarToggleHeaderActions}>
          {showAddButton ? (
            <FramelessIconButton icon={Plus} onPress={onOpenCreateCalendar} size={14} />
          ) : null}
          <ChevronDown
            color={theme.colors.tertiary}
            size={14}
            strokeWidth={1.7}
            style={!open ? styles.calendarToggleChevronCollapsed : null}
          />
        </View>
      </Pressable>

      {open ? (
        calendars.length > 0 ? (
          calendars.map((calendar) => {
            const compositeId = getEnabledCalendarId(calendar.accountEmail, calendar.id);
            const enabled = enabledCalendarIds.has(compositeId);

            return (
              <Pressable
                key={`${calendar.accountEmail}-${calendar.id}`}
                onPress={() => onToggleCalendar(compositeId)}
                style={[
                  styles.calendarToggleItem,
                  { borderLeftColor: calendar.backgroundColor || theme.colors.borderDim },
                ]}
              >
                <View
                  style={[
                    styles.calendarToggleCheckbox,
                    enabled ? {
                      backgroundColor: calendar.backgroundColor || theme.colors.text,
                      borderColor: calendar.backgroundColor || theme.colors.text,
                    } : null,
                  ]}
                >
                  {enabled ? (
                    <Check color={theme.colors.text} size={10} strokeWidth={2.5} />
                  ) : null}
                </View>
                <View style={styles.calendarToggleMeta}>
                  <Text numberOfLines={1} style={styles.calendarToggleSummary}>
                    {calendar.summary}
                  </Text>
                  <Text numberOfLines={1} style={styles.calendarToggleEmail}>
                    {calendar.accountEmail}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.calendarToggleEmpty}>No calendars in this section yet.</Text>
        )
      ) : null}
    </View>
  );
}

function CalendarTogglesPanel({
  availableCalendars,
  enabledCalendarIds,
  isMyCalendarsOpen,
  isOtherCalendarsOpen,
  onToggleCalendar,
  onToggleMyCalendars,
  onToggleOtherCalendars,
  onOpenCreateCalendar,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ownedCalendars = availableCalendars.filter(
    (calendar) => calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
  );
  const sharedCalendars = availableCalendars.filter(
    (calendar) => calendar.accessRole !== 'owner' && calendar.accessRole !== 'writer'
  );

  return (
    <View style={styles.calendarTogglesPanel}>
      <CalendarToggleSection
        title="My Calendars"
        calendars={ownedCalendars}
        enabledCalendarIds={enabledCalendarIds}
        open={isMyCalendarsOpen}
        onToggleOpen={onToggleMyCalendars}
        onToggleCalendar={onToggleCalendar}
        showAddButton
        onOpenCreateCalendar={onOpenCreateCalendar}
      />

      <CalendarToggleSection
        title="Other Calendars"
        calendars={sharedCalendars}
        enabledCalendarIds={enabledCalendarIds}
        open={isOtherCalendarsOpen}
        onToggleOpen={onToggleOtherCalendars}
        onToggleCalendar={onToggleCalendar}
      />
    </View>
  );
}

function SidebarModal({
  visible,
  selectedDate,
  onDateSelect,
  events,
  enabledCalendarIds,
  weekStartDay,
  availableCalendars,
  isMyCalendarsOpen,
  isOtherCalendarsOpen,
  onToggleCalendar,
  onToggleMyCalendars,
  onToggleOtherCalendars,
  onOpenCreateCalendar,
  onClose,
}) {
  return (
    <ModalSheet visible={visible} title="Calendar" onClose={onClose}>
      <MiniCalendarPanel
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        events={events}
        enabledCalendarIds={enabledCalendarIds}
        weekStartDay={weekStartDay}
      />
      <CalendarTogglesPanel
        availableCalendars={availableCalendars}
        enabledCalendarIds={enabledCalendarIds}
        isMyCalendarsOpen={isMyCalendarsOpen}
        isOtherCalendarsOpen={isOtherCalendarsOpen}
        onToggleCalendar={onToggleCalendar}
        onToggleMyCalendars={onToggleMyCalendars}
        onToggleOtherCalendars={onToggleOtherCalendars}
        onOpenCreateCalendar={onOpenCreateCalendar}
      />
    </ModalSheet>
  );
}

function CalendarSettingsModal({
  visible,
  settings,
  calendarView,
  onChangeView,
  onChange,
  onClose,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activePicker, setActivePicker] = useState('');

  const viewOptions = useMemo(() => [
    { value: 'agenda', label: 'Agenda' },
    { value: 'day', label: 'Day' },
  ], []);
  const weekStartOptions = useMemo(() => [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 6, label: 'Saturday' },
  ], []);
  const eventCardOptions = useMemo(() => [
    { value: 'frame', label: 'Colored Frame' },
    { value: 'filled', label: 'Full Color' },
  ], []);

  useEffect(() => {
    if (!visible) {
      setActivePicker('');
    }
  }, [visible]);

  return (
    <ModalSheet visible={visible} title="Calendar Settings" onClose={onClose}>
      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>View</Text>
        <InlinePickerField
          placeholder="Select view"
          valueLabel={viewOptions.find((option) => option.value === calendarView)?.label || ''}
          onPress={() => setActivePicker((current) => (current === 'view' ? '' : 'view'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'view'}
          options={viewOptions}
          selectedValue={calendarView}
          onSelect={(value) => {
            onChangeView(value);
            setActivePicker('');
          }}
        />
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Week Start</Text>
        <InlinePickerField
          placeholder="Select week start"
          valueLabel={weekStartOptions.find((option) => option.value === settings.weekStart)?.label || ''}
          onPress={() => setActivePicker((current) => (current === 'weekStart' ? '' : 'weekStart'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'weekStart'}
          options={weekStartOptions}
          selectedValue={settings.weekStart}
          onSelect={(value) => {
            onChange('weekStart', value);
            setActivePicker('');
          }}
        />
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Event Cards</Text>
        <InlinePickerField
          placeholder="Select card style"
          valueLabel={eventCardOptions.find((option) => option.value === settings.eventCardStyle)?.label || ''}
          onPress={() => setActivePicker((current) => (current === 'eventCardStyle' ? '' : 'eventCardStyle'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'eventCardStyle'}
          options={eventCardOptions}
          selectedValue={settings.eventCardStyle}
          onSelect={(value) => {
            onChange('eventCardStyle', value);
            setActivePicker('');
          }}
        />
      </View>

      <Pressable
        onPress={() => onChange('syncTasks', !settings.syncTasks)}
        style={[
          styles.settingsToggleRow,
          settings.syncTasks ? styles.settingsToggleRowActive : null,
        ]}
      >
        <View style={styles.settingsToggleTextWrap}>
          <Text style={styles.settingsToggleLabel}>Sync Tasks</Text>
          <Text style={styles.settingsToggleHelp}>
            Show task due dates inside the calendar agenda.
          </Text>
        </View>
        <View
          style={[
            styles.settingsToggleCheck,
            settings.syncTasks ? styles.settingsToggleCheckActive : null,
          ]}
        >
          {settings.syncTasks ? (
            <Check color={theme.colors.text} size={12} strokeWidth={2.2} />
          ) : null}
        </View>
      </Pressable>
    </ModalSheet>
  );
}

function EventEditorModal({
  visible,
  title,
  subtitle,
  form,
  event,
  loading,
  availableCalendars,
  onChange,
  onClose,
  onSave,
  onDelete,
  onOpenMeet,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activePicker, setActivePicker] = useState('');

  const calendarOptions = useMemo(
    () => availableCalendars.map((calendar) => ({
      value: `${calendar.accountEmail}:${calendar.id}`,
      label: `${calendar.summary || 'Calendar'} - ${calendar.accountEmail}`,
      color: calendar.backgroundColor,
    })),
    [availableCalendars]
  );
  const recurrenceOptions = useMemo(
    () => form.recurrenceOptions || RECURRENCE_BASE_OPTIONS,
    [form.recurrenceOptions]
  );
  const reminderOptions = useMemo(() => REMINDER_OPTIONS, []);
  const currentColorHex = useMemo(() => getCurrentEventColorHex(form.colorId), [form.colorId]);
  const googleMeetLink = event?.googleMeetLink || '';
  const isEditing = Boolean(event?.id);

  useEffect(() => {
    if (!visible) {
      setActivePicker('');
    }
  }, [visible]);

  const handleTimeChange = useCallback((field, value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;

    const nextTime = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
    onChange(field, nextTime);
  }, [onChange]);

  const handleAddGuest = useCallback(() => {
    const nextEmail = String(form.guestInput || '').trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes('@')) return;
    if (form.guests.includes(nextEmail)) {
      onChange('guestInput', '');
      return;
    }

    onChange('guests', [...form.guests, nextEmail]);
    onChange('guestInput', '');
  }, [form.guestInput, form.guests, onChange]);

  const handleRemoveGuest = useCallback((email) => {
    onChange('guests', form.guests.filter((guest) => guest !== email));
  }, [form.guests, onChange]);

  return (
    <ModalSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      headerActions={(
        <>
          {googleMeetLink ? (
            <FramelessIconButton icon={Video} color={theme.colors.secondary} onPress={onOpenMeet} />
          ) : null}
          {onDelete ? (
            <FramelessIconButton icon={Trash2} color={theme.colors.danger} onPress={onDelete} />
          ) : null}
        </>
      )}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton
            label={loading ? 'Saving...' : 'Save event'}
            icon="checkmark"
            onPress={onSave}
            disabled={loading}
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

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Day</Text>
        <DateTimeField
          label=""
          mode="date"
          value={parseDateInputValue(form.eventDate) || new Date()}
          onChange={(value) => {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
              onChange('eventDate', toLocalDateKey(parsed));
            }
          }}
          placeholder="Select day"
          formatter={(value) => formatFullDate(value)}
        />
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Time</Text>
        <View style={styles.timeFieldRow}>
          <View style={styles.timeFieldColumn}>
            <DateTimeField
              label=""
              disabled={form.allDay}
              mode="time"
              value={combineDateAndTime(form.eventDate, form.startTime) || new Date()}
              onChange={(value) => handleTimeChange('startTime', value)}
              placeholder="Starts"
              formatter={(value) => formatTime(value)}
            />
          </View>
          <Text style={styles.timeRangeSeparator}>to</Text>
          <View style={styles.timeFieldColumn}>
            <DateTimeField
              label=""
              disabled={form.allDay}
              mode="time"
              value={combineDateAndTime(form.eventDate, form.endTime) || new Date()}
              onChange={(value) => handleTimeChange('endTime', value)}
              placeholder="Ends"
              formatter={(value) => formatTime(value)}
            />
          </View>
        </View>
        <Pressable
          onPress={() => onChange('allDay', !form.allDay)}
          style={[styles.settingsToggleRow, form.allDay ? styles.settingsToggleRowActive : null]}
        >
          <View style={styles.settingsToggleTextWrap}>
            <Text style={styles.settingsToggleLabel}>All Day</Text>
          </View>
          <View style={[styles.settingsToggleCheck, form.allDay ? styles.settingsToggleCheckActive : null]}>
            {form.allDay ? <Check color={theme.colors.text} size={12} strokeWidth={2.2} /> : null}
          </View>
        </Pressable>
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Type</Text>
        <View style={styles.segmentedRow}>
          <Pressable
            disabled={isEditing}
            onPress={() => onChange('eventType', 'default')}
            style={[
              styles.segmentedButton,
              form.eventType === 'default' ? styles.segmentedButtonActive : null,
              isEditing ? styles.segmentedButtonDisabled : null,
            ]}
          >
            <Text style={[
              styles.segmentedLabel,
              form.eventType === 'default' ? styles.segmentedLabelActive : null,
            ]}>
              Event
            </Text>
          </Pressable>
          <Pressable
            disabled={isEditing}
            onPress={() => {
              onChange('eventType', 'outOfOffice');
              onChange('allDay', true);
              onChange('hasGoogleMeet', false);
              onChange('refreshGoogleMeet', false);
            }}
            style={[
              styles.segmentedButton,
              form.eventType === 'outOfOffice' ? styles.segmentedButtonActive : null,
              isEditing ? styles.segmentedButtonDisabled : null,
            ]}
          >
            <Text style={[
              styles.segmentedLabel,
              form.eventType === 'outOfOffice' ? styles.segmentedLabelActive : null,
            ]}>
              Out Of Office
            </Text>
          </Pressable>
        </View>
      </View>

      {form.eventType === 'outOfOffice' ? (
        <View style={styles.formFieldGroup}>
          <Pressable
            onPress={() => onChange('autoDecline', !form.autoDecline)}
            style={[styles.settingsToggleRow, form.autoDecline ? styles.settingsToggleRowActive : null]}
          >
            <View style={styles.settingsToggleTextWrap}>
              <Text style={styles.settingsToggleLabel}>Automatically Decline Meetings</Text>
            </View>
            <View style={[styles.settingsToggleCheck, form.autoDecline ? styles.settingsToggleCheckActive : null]}>
              {form.autoDecline ? <Check color={theme.colors.text} size={12} strokeWidth={2.2} /> : null}
            </View>
          </Pressable>
          {form.autoDecline ? (
            <TextField
              label="Decline Message"
              placeholder="Decline message"
              value={form.declineMessage}
              onChangeText={(value) => onChange('declineMessage', value)}
              multiline
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.formFieldGroup}>
          <Pressable
            onPress={() => {
              const nextValue = !form.hasGoogleMeet;
              onChange('hasGoogleMeet', nextValue);
              if (!nextValue) {
                onChange('refreshGoogleMeet', false);
              }
            }}
            style={[styles.settingsToggleRow, form.hasGoogleMeet ? styles.settingsToggleRowActive : null]}
          >
            <View style={styles.settingsToggleTextWrap}>
              <Text style={styles.settingsToggleLabel}>Use Google Meet</Text>
              {form.hasGoogleMeet && !googleMeetLink ? (
                <Text style={styles.settingsToggleHelp}>
                  A Google Meet link will be created when you save this event.
                </Text>
              ) : null}
              {!form.hasGoogleMeet && googleMeetLink ? (
                <Text style={styles.settingsToggleHelp}>
                  Saving will remove the current Google Meet link from this event.
                </Text>
              ) : null}
            </View>
            <View style={[styles.settingsToggleCheck, form.hasGoogleMeet ? styles.settingsToggleCheckActive : null]}>
              {form.hasGoogleMeet ? <Check color={theme.colors.text} size={12} strokeWidth={2.2} /> : null}
            </View>
          </Pressable>
          {form.hasGoogleMeet && googleMeetLink ? (
            <Pressable
              onPress={() => onChange('refreshGoogleMeet', !form.refreshGoogleMeet)}
              style={[styles.settingsToggleRow, form.refreshGoogleMeet ? styles.settingsToggleRowActive : null]}
            >
              <View style={styles.settingsToggleTextWrap}>
                <Text style={styles.settingsToggleLabel}>Generate A New Meet Link On Save</Text>
              </View>
              <View style={[styles.settingsToggleCheck, form.refreshGoogleMeet ? styles.settingsToggleCheckActive : null]}>
                {form.refreshGoogleMeet ? <Check color={theme.colors.text} size={12} strokeWidth={2.2} /> : null}
              </View>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Repeat</Text>
        <InlinePickerField
          placeholder="Select recurrence"
          valueLabel={recurrenceOptions.find((option) => option.value === form.recurrence)?.label || ''}
          onPress={() => setActivePicker((current) => (current === 'recurrence' ? '' : 'recurrence'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'recurrence'}
          options={recurrenceOptions}
          selectedValue={form.recurrence}
          onSelect={(value) => {
            onChange('recurrence', value);
            onChange('recurrenceOptions', buildRecurrenceOptions(value));
            setActivePicker('');
          }}
        />
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Calendar</Text>
        <InlinePickerField
          disabled={isEditing}
          placeholder="Select calendar"
          valueLabel={calendarOptions.find((option) => option.value === form.calendarKey)?.label || ''}
          onPress={() => setActivePicker((current) => (current === 'calendar' ? '' : 'calendar'))}
        />
        <InlineSelectMenu
          visible={!isEditing && activePicker === 'calendar'}
          options={calendarOptions}
          selectedValue={form.calendarKey}
          onSelect={(value) => {
            onChange('calendarKey', value);
            setActivePicker('');
          }}
        />
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Event Color</Text>
        <ColorField
          label=""
          presetColors={EVENT_COLOR_PRESETS}
          value={String(form.colorId || '').startsWith('#') ? form.colorId : currentColorHex}
          onChange={(value) => onChange('colorId', value)}
        />
      </View>

      <TextField
        label="Location"
        placeholder="Office, Zoom, Cafe"
        value={form.location}
        onChangeText={(value) => onChange('location', value)}
      />

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Reminder</Text>
        <InlinePickerField
          placeholder="Select reminder"
          valueLabel={reminderOptions.find((option) => option.value === form.reminderMinutes)?.label || ''}
          onPress={() => setActivePicker((current) => (current === 'reminder' ? '' : 'reminder'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'reminder'}
          options={reminderOptions}
          selectedValue={form.reminderMinutes}
          onSelect={(value) => {
            onChange('reminderMinutes', value);
            setActivePicker('');
          }}
        />
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Guests</Text>
        <View style={styles.guestInputRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={(value) => onChange('guestInput', value)}
            onSubmitEditing={handleAddGuest}
            placeholder="Add guest email"
            placeholderTextColor={theme.colors.muted}
            selectionColor="#ffffff"
            style={styles.guestInput}
            value={form.guestInput}
          />
          <ActionButton
            compact
            icon="add"
            label=""
            onPress={handleAddGuest}
            style={styles.guestAddButton}
          />
        </View>
        {form.guests.length ? (
          <View style={styles.guestChipWrap}>
            {form.guests.map((guest) => (
              <View key={guest} style={styles.guestChip}>
                <Text numberOfLines={1} style={styles.guestChipLabel}>
                  {guest}
                </Text>
                <Pressable hitSlop={8} onPress={() => handleRemoveGuest(guest)}>
                  <Text style={styles.guestChipRemove}>x</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <TextField
        label="Description"
        placeholder="Optional event details"
        value={form.description}
        onChangeText={(value) => onChange('description', value)}
        multiline
      />
    </ModalSheet>
  );
}

function ChoiceModal({
  visible,
  title,
  message,
  note,
  onClose,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  loading = false,
  primaryVariant = 'solid',
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ModalSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={(
        <View style={styles.choiceModalFooter}>
          <ActionButton
            label={secondaryLabel}
            onPress={onSecondary}
            variant="ghost"
            style={styles.choiceModalButton}
          />
          <ActionButton
            label={loading ? 'Working...' : primaryLabel}
            onPress={onPrimary}
            variant={primaryVariant}
            style={styles.choiceModalButton}
          />
        </View>
      )}
    >
      <View style={styles.choiceModalBody}>
        <Text style={styles.choiceModalText}>{message}</Text>
        {note ? <Text style={styles.choiceModalNote}>{note}</Text> : null}
      </View>
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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ModalSheet
      visible={visible}
      title="Create Calendar"
      onClose={onClose}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton
            label={loading ? 'Saving...' : 'Create Calendar'}
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
      <ColorField
        label="Color"
        value={form.color}
        onChange={(value) => onChange('color', value)}
        presetColors={CALENDAR_COLOR_PRESETS}
      />
    </ModalSheet>
  );
}

function buildEventForm(event, availableCalendars, selectedDate) {
  if (!event) {
    const selectedCalendar = availableCalendars[0];
    const eventDate = toLocalDateKey(selectedDate || new Date());

    return {
      ...EMPTY_EVENT_FORM,
      calendarKey: selectedCalendar ? `${selectedCalendar.accountEmail}:${selectedCalendar.id}` : '',
      eventDate,
      recurrenceOptions: RECURRENCE_BASE_OPTIONS,
    };
  }

  const startDate = parseCalendarDate(event.start) || new Date();
  const endDate = parseCalendarDate(event.end) || new Date(startDate.getTime() + 60 * 60 * 1000);
  const recurrence = event.recurrence?.[0] || '';
  const customColor = normalizeHexColor(event.customColor || '');
  const colorId = customColor || (event.color ? String(event.color) : '');
  const attendees = (event.attendees || [])
    .map((attendee) => attendee?.email)
    .filter(Boolean);

  return {
    ...EMPTY_EVENT_FORM,
    title: event.title || '',
    description: event.description || '',
    location: event.location || '',
    calendarKey: `${event.accountEmail}:${event.calendarId || 'primary'}`,
    eventDate: toLocalDateKey(startDate),
    startTime: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
    endTime: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
    allDay: Boolean(event.allDay),
    eventType: event.eventType || 'default',
    autoDecline: event.outOfOfficeProperties?.autoDeclineMode !== 'doNotDecline',
    declineMessage: event.outOfOfficeProperties?.declineMessage || DEFAULT_DECLINE_MESSAGE,
    hasGoogleMeet: Boolean(event.googleMeetLink),
    refreshGoogleMeet: false,
    guests: attendees,
    guestInput: '',
    recurrence,
    recurrenceOptions: buildRecurrenceOptions(recurrence),
    reminderMinutes: getReminderMinutes(event.reminders?.overrides),
    colorId,
    initialColorId: colorId,
  };
}

function buildGoogleEventPayload(form, event = null) {
  const baseDate = parseDateInputValue(form.eventDate) || new Date();
  const startDate = combineDateAndTime(form.eventDate, form.startTime) || new Date(baseDate);
  const endDate = combineDateAndTime(form.eventDate, form.endTime) || new Date(startDate.getTime() + 60 * 60 * 1000);
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isOutOfOffice = form.eventType === 'outOfOffice';

  if (endDate <= startDate) {
    endDate.setHours(startDate.getHours() + 1);
  }

  const payload = {
    summary: form.title.trim(),
    eventType: isOutOfOffice ? 'outOfOffice' : 'default',
  };

  if (isOutOfOffice) {
    if (form.allDay) {
      const oooStart = new Date(baseDate);
      const oooEnd = new Date(baseDate);
      oooStart.setHours(0, 0, 0, 0);
      oooEnd.setHours(23, 59, 59, 0);

      payload.start = {
        dateTime: toLocalISOStringWithOffset(oooStart),
        timeZone: browserTimeZone,
      };
      payload.end = {
        dateTime: toLocalISOStringWithOffset(oooEnd),
        timeZone: browserTimeZone,
      };
    } else {
      payload.start = {
        dateTime: toLocalISOStringWithOffset(startDate),
        timeZone: browserTimeZone,
      };
      payload.end = {
        dateTime: toLocalISOStringWithOffset(endDate),
        timeZone: browserTimeZone,
      };
    }

    payload.outOfOfficeProperties = {
      autoDeclineMode: form.autoDecline ? 'declineAllConflictingInvitations' : 'declineNone',
      declineMessage: form.declineMessage || DEFAULT_DECLINE_MESSAGE,
    };
    payload.transparency = 'opaque';

    return payload;
  }

  payload.description = form.description || '';
  payload.location = form.location || '';

  if (form.allDay) {
    payload.start = { date: toLocalDateKey(baseDate) };
    payload.end = { date: toLocalDateKey(addDays(baseDate, 1)) };
  } else {
    payload.start = {
      dateTime: toLocalISOStringWithOffset(startDate),
      timeZone: browserTimeZone,
    };
    payload.end = {
      dateTime: toLocalISOStringWithOffset(endDate),
      timeZone: browserTimeZone,
    };
  }

  if (event?.id) {
    if (isGooglePresetId(form.colorId)) {
      payload.colorId = form.colorId;
      payload.extendedProperties = { private: { customColor: '' } };
    } else if (String(form.colorId || '').startsWith('#')) {
      payload.extendedProperties = { private: { customColor: normalizeHexColor(form.colorId) } };
    } else if (form.initialColorId && !form.colorId) {
      payload.colorId = null;
      payload.extendedProperties = { private: { customColor: '' } };
    }
  } else if (isGooglePresetId(form.colorId)) {
    payload.colorId = form.colorId;
  } else if (String(form.colorId || '').startsWith('#')) {
    payload.extendedProperties = { private: { customColor: normalizeHexColor(form.colorId) } };
  }

  payload.attendees = (form.guests || []).map((email) => ({ email }));
  payload.recurrence = form.recurrence ? [form.recurrence] : undefined;
  payload.reminders = {
    useDefault: false,
    overrides: [{ method: 'popup', minutes: Number(form.reminderMinutes || 30) }],
  };

  if (form.hasGoogleMeet && (!event?.googleMeetLink || form.refreshGoogleMeet)) {
    payload.conferenceData = {
      createRequest: {
        requestId: buildGoogleMeetRequestId(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  } else if (!form.hasGoogleMeet && event?.googleMeetLink) {
    payload.conferenceData = null;
  }

  return payload;
}

function MobileAgendaCard({ item, eventCardStyle, onOpen, onOpenMeet }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isTask = item.eventType === 'task';
  const eventColor = isTask ? '#EF4444' : getCalendarEventColor(item);
  const calendarColor = item.calendarColor || eventColor;
  const timeLabel = isTask
    ? `Due ${formatCalendarTimeRange(item.start, item.end)}`
    : item.allDay
      ? 'All day'
      : formatCalendarTimeRange(item.start, item.end);
  const hasExternalActions = !isTask && Boolean(item.googleMeetLink);

  const cardStyle = useMemo(() => {
    if (isTask) {
      return {
        borderColor: 'rgba(239, 68, 68, 0.24)',
        backgroundColor: 'rgba(22, 10, 12, 0.96)',
      };
    }

    if (eventCardStyle === 'filled') {
      return {
        borderColor: withOpacity(eventColor, 0.22),
        backgroundColor: withOpacity(eventColor, 0.16, '#34D399'),
      };
    }

    return {
      borderColor: withOpacity(eventColor, 0.88),
      backgroundColor: 'rgba(18, 18, 18, 0.98)',
    };
  }, [eventCardStyle, eventColor, isTask]);

  return (
    <View style={[styles.mobileCard, cardStyle]}>
      <View style={[styles.mobileCardAccent, { backgroundColor: calendarColor }]} />

      <Pressable
        onPress={onOpen}
        style={[
          styles.mobileCardContent,
          hasExternalActions ? styles.mobileCardContentWithActions : null,
        ]}
      >
        <Text numberOfLines={2} style={styles.mobileCardTitle}>{item.title}</Text>

        <View style={styles.mobileCardSub}>
          <Text style={[styles.mobileCardTime, isTask ? styles.mobileCardTimeTask : null]}>
            {timeLabel}
          </Text>
          {!isTask && item.calendarName ? (
            <>
              <View style={styles.mobileCardSubDot} />
              <View style={[styles.mobileCardCalDot, { backgroundColor: calendarColor }]} />
              <Text numberOfLines={1} style={styles.mobileCardSubText}>
                {item.calendarName}
              </Text>
            </>
          ) : null}
          {item.location ? (
            <>
              <View style={styles.mobileCardSubDot} />
              <MapPin color={theme.colors.muted} size={10} strokeWidth={1.8} />
              <Text numberOfLines={1} style={styles.mobileCardSubText}>{item.location}</Text>
            </>
          ) : null}
        </View>
      </Pressable>

      {hasExternalActions ? (
        <View style={styles.mobileCardActions}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              onOpenMeet();
            }}
            style={styles.mobileCardAction}
          >
            <Video color={theme.colors.secondary} size={13} strokeWidth={1.8} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MobileAgendaDay({
  day,
  items,
  eventCardStyle,
  onEventClick,
  onTaskClick,
  onCreateForDate,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isToday = isSameCalendarDay(day, new Date());
  const dayTitle = formatAgendaDayTitle(day);

  return (
    <View style={[styles.mobileDaySection, isToday ? styles.mobileDaySectionToday : null]}>
      <View style={styles.mobileDayHeader}>
        <View style={styles.mobileDayHeading}>
          <Text style={[styles.mobileDayLabel, isToday ? styles.mobileDayLabelToday : null]}>
            {isToday ? 'Today' : formatAgendaDayLabel(day)}
          </Text>
          <Text style={[styles.mobileDayTitle, isToday ? styles.mobileDayTitleToday : null]}>
            {dayTitle}
          </Text>
        </View>

        <Pressable
          onPress={() => onCreateForDate(day)}
          style={({ pressed }) => [
            styles.mobileDayAction,
            pressed ? styles.mobileDayActionPressed : null,
          ]}
        >
          <Plus color={theme.colors.secondary} size={15} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={styles.mobileCardList}>
        {items.map((item) => (
          <MobileAgendaCard
            key={getAgendaItemKey(item, day)}
            item={item}
            eventCardStyle={eventCardStyle}
            onOpen={() => {
              if (item.eventType === 'task') {
                onTaskClick(item.originalTask);
                return;
              }

              onEventClick(item);
            }}
            onOpenMeet={() => Linking.openURL(item.googleMeetLink)}
          />
        ))}
      </View>
    </View>
  );
}

const HOUR_HEIGHT = 48;
const DAY_GRID_GUTTER = 50;
const DAY_GRID_HOURS = Array.from({ length: 24 }, (_, index) => index);

function formatGridHour(hour) {
  if (hour === 0) return '12A';
  if (hour < 12) return `${hour}A`;
  if (hour === 12) return '12P';
  return `${hour - 12}P`;
}

// Ported from web WeekGrid.getEventPosition — vertical placement for one day.
function getEventDayPosition(event, dayDate) {
  if (event.allDay && event.eventType !== 'outOfOffice') return null;

  const start = parseCalendarDate(event.start);
  const end = parseCalendarDate(event.end);
  if (!start || !end) return null;

  const dayStart = startOfDay(dayDate);
  const dayEnd = endOfDay(dayDate);

  if (event.allDay) {
    return { top: 0, height: 24 * HOUR_HEIGHT };
  }

  const effectiveStart = start < dayStart ? dayStart : start;
  const effectiveEnd = end > dayEnd ? dayEnd : end;
  const startMinutes = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
  const endMinutes = (effectiveEnd - dayStart) / (1000 * 60);
  const duration = Math.max(endMinutes - startMinutes, 15);

  return {
    top: (startMinutes / 60) * HOUR_HEIGHT,
    height: (duration / 60) * HOUR_HEIGHT,
  };
}

// Ported from web WeekGrid.layoutEventsForDay — cluster overlapping events into columns.
function layoutDayEvents(dayDate, dayEvents) {
  if (dayEvents.length === 0) return [];

  const positioned = dayEvents
    .map((event) => ({ event, pos: getEventDayPosition(event, dayDate) }))
    .filter((entry) => entry.pos !== null);

  positioned.sort((a, b) => a.pos.top - b.pos.top);

  const clusters = [];
  positioned.forEach((item) => {
    let added = false;
    for (let i = 0; i < clusters.length; i += 1) {
      const cluster = clusters[i];
      const clusterEnd = Math.max(...cluster.map((entry) => entry.pos.top + entry.pos.height));
      if (item.pos.top < clusterEnd) {
        cluster.push(item);
        added = true;
        break;
      }
    }
    if (!added) clusters.push([item]);
  });

  const result = [];
  clusters.forEach((cluster) => {
    const columns = [];
    cluster.sort((a, b) => a.pos.top - b.pos.top);
    cluster.forEach((item) => {
      let placed = false;
      for (let col = 0; col < columns.length; col += 1) {
        const lastInCol = columns[col][columns[col].length - 1];
        if (item.pos.top >= lastInCol.pos.top + lastInCol.pos.height) {
          columns[col].push(item);
          item.column = col;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.column = columns.length;
        columns.push([item]);
      }
    });
    cluster.forEach((item) => {
      item.totalColumns = columns.length;
      result.push(item);
    });
  });

  return result;
}

function DayGridEventBlock({ entry, eventCardStyle, onEventPress, onTaskPress }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { event, pos, column = 0, totalColumns = 1 } = entry;
  const isTask = event.eventType === 'task';
  const isOOO = event.eventType === 'outOfOffice';
  const eventColor = isTask ? '#EF4444' : getCalendarEventColor(event);

  const offsetPct = totalColumns > 1 ? 12 : 0;
  const leftPct = column * offsetPct;
  const widthPct = isOOO ? 98 : 100 - leftPct - 2;
  const blockHeight = isTask ? 24 : Math.max(pos.height, 18);
  const showTime = !isTask && pos.height >= 38;

  const blockStyle = isTask
    ? { borderColor: 'rgba(239, 68, 68, 0.5)', backgroundColor: 'rgba(22, 10, 12, 0.96)' }
    : isOOO
      ? { borderColor: withOpacity(eventColor, 0.6), backgroundColor: withOpacity(eventColor, 0.12), borderStyle: 'dashed' }
      : eventCardStyle === 'filled'
        ? { borderColor: withOpacity(eventColor, 0.3), backgroundColor: withOpacity(eventColor, 0.22) }
        : { borderColor: withOpacity(eventColor, 0.85), backgroundColor: 'rgba(18, 18, 18, 0.96)' };

  return (
    <View
      style={[
        styles.dayEventBlock,
        blockStyle,
        {
          top: pos.top,
          height: blockHeight,
          left: isOOO ? '1%' : `${leftPct}%`,
          width: `${widthPct}%`,
          zIndex: isOOO ? 5 : 10 + column,
        },
      ]}
    >
      <Pressable
        style={styles.dayEventPress}
        onPress={() => (isTask ? onTaskPress(event.originalTask) : onEventPress(event))}
      >
        <View style={styles.dayEventRow}>
          {!isTask && !isOOO ? (
            <View style={[styles.dayEventDot, { backgroundColor: event.calendarColor || eventColor }]} />
          ) : null}
          <Text numberOfLines={1} style={styles.dayEventTitle}>
            {isOOO ? `🚫 ${event.title}` : event.title}
          </Text>
        </View>
        {showTime ? (
          <Text numberOfLines={1} style={styles.dayEventTime}>
            {formatCalendarTimeRange(event.start, event.end)}
          </Text>
        ) : null}
      </Pressable>
      {!isTask && event.googleMeetLink ? (
        <Pressable style={styles.dayEventMeet} onPress={() => Linking.openURL(event.googleMeetLink)}>
          <Video color={theme.colors.secondary} size={12} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

function DayTimeGrid({
  date,
  timedEvents,
  taskEvents,
  allDayEvents,
  eventCardStyle,
  nowMinutes,
  onLayoutTop,
  onEventPress,
  onTaskPress,
  onSlotPress,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const dayTimed = timedEvents.filter((event) => isCalendarEventOnDay(event, date));
  const dayTasks = taskEvents.filter((event) => isCalendarEventOnDay(event, date));
  const dayAllDay = allDayEvents.filter((event) => isCalendarEventOnDay(event, date));

  const standard = dayTimed.filter((event) => event.eventType !== 'outOfOffice');
  const ooo = dayTimed.filter((event) => event.eventType === 'outOfOffice');

  const layout = [
    ...ooo.map((event) => ({ event, pos: getEventDayPosition(event, date), column: 0, totalColumns: 1 })),
    ...layoutDayEvents(date, standard),
    ...dayTasks.map((event) => ({ event, pos: getEventDayPosition(event, date), column: 0, totalColumns: 1 })),
  ].filter((entry) => entry.pos !== null);

  const nowTop = nowMinutes != null ? (nowMinutes / 60) * HOUR_HEIGHT : null;

  return (
    <View
      style={styles.dayGridWrap}
      onLayout={(layoutEvent) => onLayoutTop?.(layoutEvent.nativeEvent.layout.y)}
    >
      {dayAllDay.length > 0 ? (
        <View style={styles.dayAllDayRow}>
          <Text style={styles.dayAllDayLabel}>ALL DAY</Text>
          <View style={styles.dayAllDayItems}>
            {dayAllDay.map((event) => {
              const color = getCalendarEventColor(event);
              return (
                <Pressable
                  key={getEventKey(event)}
                  onPress={() => onEventPress(event)}
                  style={[styles.dayAllDayPill, { borderColor: withOpacity(color, 0.7) }]}
                >
                  <View style={[styles.dayEventDot, { backgroundColor: event.calendarColor || color }]} />
                  <Text numberOfLines={1} style={styles.dayAllDayPillText}>{event.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={[styles.dayGridBody, { height: 24 * HOUR_HEIGHT }]}>
        {DAY_GRID_HOURS.map((hour) => (
          <View key={`line-${hour}`} pointerEvents="none" style={[styles.dayHourRow, { top: hour * HOUR_HEIGHT }]}>
            <Text style={styles.dayHourLabel}>{formatGridHour(hour)}</Text>
            <View style={styles.dayHourLine} />
          </View>
        ))}

        <View style={styles.dayColumn}>
          {DAY_GRID_HOURS.map((hour) => (
            <Pressable
              key={`slot-${hour}`}
              style={[styles.daySlot, { top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }]}
              onPress={(pressEvent) => {
                const offsetY = pressEvent.nativeEvent.locationY;
                const minute = Math.min(Math.max(Math.floor((offsetY / HOUR_HEIGHT) * 60 / 15) * 15, 0), 45);
                onSlotPress(date, hour * 60 + minute);
              }}
            />
          ))}

          {layout.map((entry) => (
            <DayGridEventBlock
              key={entry.event.eventType === 'task' ? `task-${entry.event.id}` : getEventKey(entry.event)}
              entry={entry}
              eventCardStyle={eventCardStyle}
              onEventPress={onEventPress}
              onTaskPress={onTaskPress}
            />
          ))}

          {nowTop != null ? (
            <View pointerEvents="none" style={[styles.dayNowLine, { top: nowTop }]}>
              <View style={styles.dayNowDot} />
              <View style={styles.dayNowRule} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CalendarScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { webAppUrl } = useAuth();
  const addToast = useToast();
  const { confirm } = useDialog();
  const scrollViewRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [enabledCalendarIds, setEnabledCalendarIds] = useState(new Set());
  const [isMyCalendarsOpen, setIsMyCalendarsOpen] = useState(true);
  const [isOtherCalendarsOpen, setIsOtherCalendarsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [calendarView, setCalendarView] = useState('agenda');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mobileAgendaStart, setMobileAgendaStart] = useState(() =>
    startOfDay(addDays(new Date(), -MOBILE_AGENDA_INITIAL_PAST_DAYS))
  );
  const [mobileAgendaEnd, setMobileAgendaEnd] = useState(() =>
    endOfDay(addDays(new Date(), MOBILE_AGENDA_INITIAL_FUTURE_DAYS))
  );
  // Refs so callbacks can read the current range without causing effect re-triggers
  const mobileAgendaStartRef = useRef(mobileAgendaStart);
  const mobileAgendaEndRef = useRef(mobileAgendaEnd);
  mobileAgendaStartRef.current = mobileAgendaStart;
  mobileAgendaEndRef.current = mobileAgendaEnd;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [createCalendarVisible, setCreateCalendarVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [calendarForm, setCalendarForm] = useState(EMPTY_CALENDAR_FORM);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [recurringSaveVisible, setRecurringSaveVisible] = useState(false);
  const [recurringDeleteVisible, setRecurringDeleteVisible] = useState(false);
  const [pendingEventPayload, setPendingEventPayload] = useState(null);

  const weekStart = useMemo(
    () => getWeekStart(selectedDate, settings.weekStart),
    [selectedDate, settings.weekStart]
  );
  const recurringOriginalStart = editingEvent?.originalStart || editingEvent?.start || '';
  const recurringSeriesId = getRecurringSeriesId(editingEvent);
  const canShowRecurringSavePrompt = Boolean(
    editingEvent?.id && recurringSeriesId && recurringOriginalStart
  );
  const canShowRecurringDeletePrompt = Boolean(
    editingEvent?.id && recurringSeriesId
  );

  useEffect(() => {
    let isMounted = true;

    SecureStore.getItemAsync(CALENDAR_SETTINGS_STORAGE_KEY)
      .then((value) => {
        if (!isMounted || !value) return;

        try {
          const parsed = JSON.parse(value);
          setSettings((current) => ({
            ...current,
            ...parsed,
          }));
        } catch (error) {
          console.error('Failed to parse calendar settings:', error);
        }
      })
      .finally(() => {
        if (isMounted) {
          setSettingsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    SecureStore.setItemAsync(CALENDAR_SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch((error) => {
      console.error('Failed to persist calendar settings:', error);
    });
  }, [settings, settingsLoaded]);

  const initializeEnabledCalendars = useCallback((calendars) => {
    setEnabledCalendarIds((current) => {
      if (current.size > 0 || calendars.length === 0) return current;

      const selectedIds = calendars
        .filter((calendar) => calendar.selected)
        .map((calendar) => getEnabledCalendarId(calendar.accountEmail, calendar.id));

      return new Set(
        selectedIds.length > 0
          ? selectedIds
          : calendars.map((calendar) => getEnabledCalendarId(calendar.accountEmail, calendar.id))
      );
    });
  }, []);

  const loadCalendarRange = useCallback(async (accountList, startDate, endDate) => {
    const activeAccounts = accountList.filter((account) => account.active);

    if (activeAccounts.length === 0) {
      return { events: [], calendars: [], errors: [] };
    }

    const results = await Promise.allSettled(
      activeAccounts.map((account) =>
        calendarApi
          .getEvents(account, startDate.toISOString(), endDate.toISOString())
          .then((response) => ({ email: account.email, ...response }))
      )
    );

    let mergedEvents = [];
    let mergedCalendars = [];
    const errors = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        mergedEvents = [...mergedEvents, ...(result.value.events || [])];
        mergedCalendars = [...mergedCalendars, ...(result.value.calendars || [])];
        return;
      }

      console.error('Failed to fetch calendar data:', result.reason);
      if (result.reason?.email) {
        errors.push(result.reason.email);
      }
    });

    return {
      events: mergedEvents.sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime()),
      calendars: mergedCalendars,
      errors,
    };
  }, []);

  const loadTaskData = useCallback(async () => {
    if (!settings.syncTasks) {
      return [];
    }

    try {
      return await tasksApi.getTasks();
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }, [settings.syncTasks]);

  const refreshCalendarData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const storedAccounts = calendarApi.getAccounts();
    setAccounts(storedAccounts);

    if (storedAccounts.length === 0) {
      setEvents([]);
      setTasks([]);
      setAvailableCalendars([]);
      setEnabledCalendarIds(new Set());
      setError('');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [calendarData, taskData] = await Promise.all([
        loadCalendarRange(storedAccounts, startOfDay(mobileAgendaStartRef.current), endOfDay(mobileAgendaEndRef.current)),
        loadTaskData(),
      ]);

      setEvents(calendarData.events);
      setAvailableCalendars(calendarData.calendars);
      setTasks(taskData);
      initializeEnabledCalendars(calendarData.calendars);

      if (calendarData.errors.length > 0) {
        setError(`Failed to sync calendar: ${calendarData.errors.join(', ')}. Try reconnecting these accounts.`);
      } else {
        setError('');
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    initializeEnabledCalendars,
    loadCalendarRange,
    loadTaskData,
  ]);

  const loadMoreAgenda = useCallback(async () => {
    if (loading || isLoadingMore || accounts.length === 0) return;

    const nextRangeStart = startOfDay(addDays(mobileAgendaEndRef.current, 1));
    const nextRangeEnd = endOfDay(addDays(nextRangeStart, MOBILE_AGENDA_LOAD_MORE_DAYS - 1));

    setIsLoadingMore(true);

    try {
      const calendarData = await loadCalendarRange(accounts, nextRangeStart, nextRangeEnd);

      setEvents((current) =>
        mergeByKey(current, calendarData.events, getEventKey).sort(
          (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime()
        )
      );
      setAvailableCalendars((current) => mergeByKey(current, calendarData.calendars, getCalendarKey));
      initializeEnabledCalendars(calendarData.calendars);
      mobileAgendaEndRef.current = nextRangeEnd;
      setMobileAgendaEnd(nextRangeEnd);

      if (calendarData.errors.length > 0) {
        setError(`Failed to sync calendar: ${calendarData.errors.join(', ')}. Try reconnecting these accounts.`);
      }
    } catch (error) {
      console.error('Failed to extend mobile agenda:', error);
      setError('Failed to load more events. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [accounts, initializeEnabledCalendars, isLoadingMore, loadCalendarRange, loading]);

  // Run once on mount — refreshCalendarData is now stable so no re-trigger risk
  useEffect(() => {
    refreshCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [mobileAgendaStart]);

  const resetAgendaWindow = useCallback((anchorDate) => {
    const newStart = startOfDay(addDays(anchorDate, -MOBILE_AGENDA_INITIAL_PAST_DAYS));
    const newEnd = endOfDay(addDays(anchorDate, MOBILE_AGENDA_INITIAL_FUTURE_DAYS));
    mobileAgendaStartRef.current = newStart;
    mobileAgendaEndRef.current = newEnd;
    setMobileAgendaStart(newStart);
    setMobileAgendaEnd(newEnd);
    refreshCalendarData();
  }, [refreshCalendarData]);

  const visibleCalendarEvents = useMemo(() => {
    return events.filter((event) => enabledCalendarIds.has(getEnabledCalendarId(event.accountEmail, event.calendarId)));
  }, [enabledCalendarIds, events]);

  const visibleTaskEvents = useMemo(() => {
    return settings.syncTasks ? createTaskCalendarEvents(tasks) : [];
  }, [settings.syncTasks, tasks]);

  const agendaDays = useMemo(
    () => enumerateAgendaDays(mobileAgendaStart, mobileAgendaEnd),
    [mobileAgendaEnd, mobileAgendaStart]
  );

  const agendaSections = useMemo(() => {
    return agendaDays
      .map((day) => ({
        day,
        items: [
          ...visibleCalendarEvents.filter((event) => isCalendarEventOnDay(event, day)),
          ...visibleTaskEvents.filter((event) => isCalendarEventOnDay(event, day)),
        ].sort(sortAgendaItems),
      }))
      .filter((section) => section.items.length > 0);
  }, [agendaDays, visibleCalendarEvents, visibleTaskEvents]);

  const dayTimedEvents = useMemo(
    () => visibleCalendarEvents.filter((event) => !event.allDay || event.eventType === 'outOfOffice'),
    [visibleCalendarEvents]
  );
  const dayAllDayEvents = useMemo(
    () => visibleCalendarEvents.filter((event) => event.allDay && event.eventType !== 'outOfOffice'),
    [visibleCalendarEvents]
  );
  const dayNowMinutes = useMemo(() => {
    const now = new Date();
    return isSameCalendarDay(selectedDate, now) ? now.getHours() * 60 + now.getMinutes() : null;
  }, [selectedDate]);

  const dayGridTopRef = useRef(0);
  const handleDayGridLayout = useCallback((y) => {
    dayGridTopRef.current = y;
  }, []);

  useEffect(() => {
    if (calendarView !== 'day') return undefined;
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(dayGridTopRef.current + 7 * HOUR_HEIGHT - 8, 0),
        animated: false,
      });
    }, 90);
    return () => clearTimeout(timeout);
  }, [calendarView, selectedDate]);

  const handleAgendaScroll = useCallback((event) => {
    if (calendarView !== 'agenda') return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (remaining < 420) {
      loadMoreAgenda();
    }
  }, [calendarView, loadMoreAgenda]);

  const goToPrevDay = useCallback(() => {
    const nextDate = addDays(selectedDate, -1);
    setSelectedDate(nextDate);
    if (nextDate < mobileAgendaStart || nextDate > mobileAgendaEnd) {
      resetAgendaWindow(nextDate);
    }
  }, [mobileAgendaEnd, mobileAgendaStart, resetAgendaWindow, selectedDate]);

  const goToNextDay = useCallback(() => {
    const nextDate = addDays(selectedDate, 1);
    setSelectedDate(nextDate);
    if (nextDate < mobileAgendaStart || nextDate > mobileAgendaEnd) {
      resetAgendaWindow(nextDate);
    }
  }, [mobileAgendaEnd, mobileAgendaStart, resetAgendaWindow, selectedDate]);

  const goToPrevWeek = useCallback(() => {
    setSelectedDate((current) => {
      const nextDate = addDays(current, -7);
      resetAgendaWindow(nextDate);
      return nextDate;
    });
  }, [resetAgendaWindow]);

  const goToNextWeek = useCallback(() => {
    setSelectedDate((current) => {
      const nextDate = addDays(current, 7);
      resetAgendaWindow(nextDate);
      return nextDate;
    });
  }, [resetAgendaWindow]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    resetAgendaWindow(today);
  }, [resetAgendaWindow]);

  const handleDateSelect = useCallback((date) => {
    // Anchor start AT the selected date so scroll-to-top shows the selected date
    const newStart = startOfDay(date);
    const newEnd = endOfDay(addDays(date, MOBILE_AGENDA_INITIAL_FUTURE_DAYS));
    mobileAgendaStartRef.current = newStart;
    mobileAgendaEndRef.current = newEnd;
    setSelectedDate(date);
    setMobileAgendaStart(newStart);
    setMobileAgendaEnd(newEnd);
    refreshCalendarData();
    setIsSidebarOpen(false);
  }, [refreshCalendarData]);

  const handleCloseEventModal = useCallback(() => {
    setEventModalVisible(false);
    setEditingEvent(null);
    setEventForm(EMPTY_EVENT_FORM);
    setDeleteConfirmVisible(false);
    setRecurringSaveVisible(false);
    setRecurringDeleteVisible(false);
    setPendingEventPayload(null);
    setSavingEvent(false);
  }, []);

  const openNewEvent = useCallback((date = selectedDate) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setEventForm(buildEventForm(null, availableCalendars, date));
    setDeleteConfirmVisible(false);
    setRecurringSaveVisible(false);
    setRecurringDeleteVisible(false);
    setPendingEventPayload(null);
    setEventModalVisible(true);
  }, [availableCalendars, selectedDate]);

  // Tap-to-create at a precise time (day grid): snap to 15 min, default 1-hour duration.
  const openNewEventAt = useCallback((date, startMinutes) => {
    const snapped = Math.min(Math.max(Math.floor(startMinutes / 15) * 15, 0), 24 * 60 - 15);
    const endTotal = Math.min(snapped + 60, 24 * 60 - 1);
    const pad = (value) => String(value).padStart(2, '0');
    const toLabel = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

    setEditingEvent(null);
    setSelectedDate(date);
    setEventForm({
      ...buildEventForm(null, availableCalendars, date),
      startTime: toLabel(snapped),
      endTime: toLabel(endTotal),
    });
    setDeleteConfirmVisible(false);
    setRecurringSaveVisible(false);
    setRecurringDeleteVisible(false);
    setPendingEventPayload(null);
    setEventModalVisible(true);
  }, [availableCalendars]);

  const openEditEvent = useCallback(async (event) => {
    setEditingEvent(event);
    setEventForm(buildEventForm(event, availableCalendars, selectedDate));
    setDeleteConfirmVisible(false);
    setRecurringSaveVisible(false);
    setRecurringDeleteVisible(false);
    setPendingEventPayload(null);
    setEventModalVisible(true);

    if (!event?.accountEmail || !event?.recurringEventId || event?.recurrence?.length) {
      return;
    }

    const account = accounts.find((item) => item.email === event.accountEmail);
    if (!account) return;

    try {
      const detailedEvent = await calendarApi.getEvent(
        account,
        event.id,
        event.calendarId || 'primary',
        { resolveRecurrence: true }
      );

      if (detailedEvent) {
        setEditingEvent(detailedEvent);
        setEventForm(buildEventForm(detailedEvent, availableCalendars, selectedDate));
      }
    } catch (error) {
      console.error('Failed to load recurring event details:', error);
    }
  }, [accounts, availableCalendars, selectedDate]);

  const handleTaskPress = useCallback((task) => {
    router.push({
      pathname: '/(tabs)/tasks',
      params: {
        openTaskId: String(task.id),
        openTaskAt: String(Date.now()),
      },
    });
  }, [router]);

  const handleOpenMeet = useCallback(async () => {
    if (!editingEvent?.googleMeetLink) return;

    try {
      await WebBrowser.openBrowserAsync(editingEvent.googleMeetLink);
    } catch (error) {
      console.error('Failed to open Google Meet link', error);
      addToast('Failed to open Google Meet link.', 'error');
    }
  }, [addToast, editingEvent?.googleMeetLink]);

  const handleConnectGoogle = async () => {
    if (!webAppUrl) {
      addToast('Set EXPO_PUBLIC_WEB_APP_URL to a reachable web app URL first.', 'warning');
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
        addToast(getGoogleErrorMessage(String(params.google_error)), 'error');
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

      setAccounts(calendarApi.getAccounts());
      setAccountMenuOpen(false);
      addToast('Google account connected.');
      refreshCalendarData({ silent: true });
    } catch (error) {
      console.error('Failed to connect Google account', error);
      addToast(error?.message || 'Failed to connect Google account.', 'error');
    }
  };

  const handleToggleAccount = (email) => {
    calendarApi.toggleAccount(email);
    setAccounts(calendarApi.getAccounts());
    refreshCalendarData({ silent: true });
  };

  const handleDisconnectAccount = async (email) => {
    const ok = await confirm({
      title: 'Disconnect account?',
      message: email,
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    calendarApi.removeAccount(email);
    setAccounts(calendarApi.getAccounts());
    addToast('Google account disconnected.');
    refreshCalendarData({ silent: true });
  };

  const persistEvent = useCallback(async (payload, options = {}) => {
    const [accountEmail, calendarId] = eventForm.calendarKey.split(':');
    const account = accounts.find((item) => item.email === accountEmail);

    if (!account) {
      throw new Error('Please choose a Google account.');
    }

    if (!calendarApi.hasPermission(account, SCOPES.CALENDAR_EVENTS)) {
      throw new Error('Reconnect Google with calendar event permissions to manage events.');
    }

    if (editingEvent) {
      await calendarApi.updateEvent(
        account,
        editingEvent.id,
        payload,
        calendarId || 'primary',
        options
      );
      addToast(
        options?.recurringEdit?.mode === 'future'
          ? 'Updated this and future events.'
          : 'Event updated.'
      );
    } else {
      await calendarApi.createEvent(account, payload, calendarId || 'primary');
      addToast('Event created.');
    }

    handleCloseEventModal();
    refreshCalendarData({ silent: true });
  }, [accounts, addToast, editingEvent, eventForm.calendarKey, handleCloseEventModal, refreshCalendarData]);

  const handleSaveEvent = useCallback(async () => {
    if (!eventForm.title.trim()) {
      addToast('Add a title for the event.', 'error');
      return;
    }
    if (!eventForm.calendarKey) {
      addToast('Pick a calendar to save the event to.', 'error');
      return;
    }
    const payload = buildGoogleEventPayload(eventForm, editingEvent);

    if (canShowRecurringSavePrompt) {
      setPendingEventPayload(payload);
      setRecurringSaveVisible(true);
      return;
    }

    setSavingEvent(true);
    try {
      await persistEvent(payload);
    } catch (error) {
      console.error('Failed to save event', error);
      addToast(error?.message || 'Failed to save event.', 'error');
    } finally {
      setSavingEvent(false);
    }
  }, [addToast, canShowRecurringSavePrompt, editingEvent, eventForm, persistEvent]);

  const handleRecurringSaveChoice = useCallback(async (mode) => {
    if (!pendingEventPayload || !editingEvent) return;

    setSavingEvent(true);

    try {
      const payload = mode === 'this'
        ? { ...pendingEventPayload, recurrence: undefined }
        : pendingEventPayload;

      await persistEvent(payload, {
        recurringEdit: {
          mode,
          recurringEventId: recurringSeriesId,
          originalStart: recurringOriginalStart,
        },
      });
    } catch (error) {
      console.error('Failed to save recurring event', error);
      addToast(error?.message || 'Failed to save event.', 'error');
    } finally {
      setSavingEvent(false);
      setRecurringSaveVisible(false);
      setPendingEventPayload(null);
    }
  }, [addToast, editingEvent, pendingEventPayload, persistEvent, recurringOriginalStart, recurringSeriesId]);

  const deleteEvent = useCallback(async (options = {}) => {
    if (!editingEvent) return;

    const account = accounts.find((item) => item.email === editingEvent.accountEmail);
    if (!account) {
      throw new Error('Account not found.');
    }

    await calendarApi.deleteEvent(
      account,
      editingEvent.id,
      editingEvent.calendarId || 'primary',
      options
    );

    addToast(
      options?.recurringDelete?.mode === 'future'
        ? 'Deleted this and future events.'
        : 'Event deleted.'
    );
    handleCloseEventModal();
    refreshCalendarData({ silent: true });
  }, [accounts, addToast, editingEvent, handleCloseEventModal, refreshCalendarData]);

  const handleDeleteEvent = useCallback(() => {
    if (!editingEvent) return;

    if (canShowRecurringDeletePrompt) {
      setRecurringDeleteVisible(true);
      return;
    }

    setDeleteConfirmVisible(true);
  }, [canShowRecurringDeletePrompt, editingEvent]);

  const handleConfirmDelete = useCallback(async () => {
    setSavingEvent(true);

    try {
      await deleteEvent();
    } catch (error) {
      console.error('Failed to delete event', error);
      addToast(error?.message || 'Failed to delete event.', 'error');
    } finally {
      setSavingEvent(false);
      setDeleteConfirmVisible(false);
    }
  }, [addToast, deleteEvent]);

  const handleRecurringDeleteChoice = useCallback(async (mode) => {
    if (!editingEvent) return;

    setSavingEvent(true);

    try {
      await deleteEvent({
        recurringDelete: {
          mode,
          recurringEventId: recurringSeriesId,
          originalStart: recurringOriginalStart,
        },
      });
    } catch (error) {
      console.error('Failed to delete recurring event', error);
      addToast(error?.message || 'Failed to delete event.', 'error');
    } finally {
      setSavingEvent(false);
      setRecurringDeleteVisible(false);
    }
  }, [addToast, deleteEvent, editingEvent, recurringOriginalStart, recurringSeriesId]);

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
        color: calendarForm.color || '#3B82F6',
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
        showPageHeader={false}
        refreshControl={(
          <RefreshControl
            tintColor={theme.colors.text}
            refreshing={refreshing}
            onRefresh={() => refreshCalendarData({ silent: true })}
          />
        )}
        onScroll={handleAgendaScroll}
        scrollEventThrottle={16}
        scrollViewRef={scrollViewRef}
      >
        <View style={styles.calendarHeader}>
          <View style={styles.calendarHeaderLeft}>
            <Text style={styles.calendarTitle}>
              {calendarView === 'day'
                ? selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                : formatWeekRange(weekStart)}
            </Text>
          </View>

          <View style={styles.calendarHeaderRight}>
            {accounts.length > 0 ? (
              <FramelessIconButton icon={Menu} color={theme.colors.secondary} onPress={() => setIsSidebarOpen(true)} />
            ) : null}
            {accounts.length > 0 ? (
              <CalendarHeaderButton
                label="Book Event"
                icon={Plus}
                onPress={() => openNewEvent(selectedDate)}
                primary
              />
            ) : null}
            <CalendarHeaderButton label="Today" onPress={goToToday} />
            {accounts.length > 0 ? (
              <FramelessIconButton
                icon={RefreshCw}
                color={theme.colors.tertiary}
                onPress={() => refreshCalendarData({ silent: true })}
              />
            ) : null}
            <FramelessIconButton
              icon={ChevronLeft}
              color={theme.colors.tertiary}
              onPress={calendarView === 'day' ? goToPrevDay : goToPrevWeek}
            />
            <FramelessIconButton
              icon={ChevronRight}
              color={theme.colors.tertiary}
              onPress={calendarView === 'day' ? goToNextDay : goToNextWeek}
            />
            <FramelessIconButton icon={Settings2} color={theme.colors.tertiary} onPress={() => setSettingsVisible(true)} />
          </View>
        </View>

        <AccountSwitcherPanel
          accounts={accounts}
          open={accountMenuOpen}
          onToggleOpen={() => setAccountMenuOpen((current) => !current)}
          onConnect={handleConnectGoogle}
          onToggleAccount={handleToggleAccount}
          onDisconnect={handleDisconnectAccount}
        />

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {accounts.length === 0 ? (
          <View style={styles.mainEmptyState}>
            <CalendarDays color={theme.colors.muted} size={64} strokeWidth={1} />
            <Text style={styles.mainEmptyTitle}>Cloud Calendar Sync</Text>
            <Text style={styles.mainEmptyText}>
              Connect your Google Calendar to synchronize your schedule, track meetings, and visualize your time in one place.
            </Text>
          </View>
        ) : calendarView === 'day' ? (
          loading ? (
            <Text style={styles.loadMoreLabel}>Loading calendar...</Text>
          ) : (
            <DayTimeGrid
              date={selectedDate}
              timedEvents={dayTimedEvents}
              taskEvents={visibleTaskEvents}
              allDayEvents={dayAllDayEvents}
              eventCardStyle={settings.eventCardStyle}
              nowMinutes={dayNowMinutes}
              onLayoutTop={handleDayGridLayout}
              onEventPress={openEditEvent}
              onTaskPress={handleTaskPress}
              onSlotPress={openNewEventAt}
            />
          )
        ) : (
          <View style={styles.mobileAgenda}>
            {loading ? (
              <Text style={styles.loadMoreLabel}>Loading calendar...</Text>
            ) : agendaSections.length > 0 ? (
              agendaSections.map(({ day, items }) => (
                <MobileAgendaDay
                  key={day.toISOString()}
                  day={day}
                  items={items}
                  eventCardStyle={settings.eventCardStyle}
                  onEventClick={openEditEvent}
                  onTaskClick={handleTaskPress}
                  onCreateForDate={openNewEvent}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <CalendarDays color={theme.colors.muted} size={30} strokeWidth={1.3} />
                <Text style={styles.emptyStateTitle}>No events in this loaded range</Text>
                <Text style={styles.emptyStateText}>
                  The agenda will keep extending as you scroll, or you can load more days right now.
                </Text>
                <CalendarHeaderButton
                  label={isLoadingMore ? 'Loading...' : 'Load More Days'}
                  icon={Plus}
                  onPress={loadMoreAgenda}
                  disabled={isLoadingMore}
                />
              </View>
            )}

            {accounts.length > 0 ? (
              <Text style={styles.loadMoreLabel}>
                {isLoadingMore ? 'Loading more days...' : 'Scroll to keep exploring'}
              </Text>
            ) : null}
          </View>
        )}
      </ScreenShell>

      <SidebarModal
        visible={isSidebarOpen}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        events={events}
        enabledCalendarIds={enabledCalendarIds}
        weekStartDay={settings.weekStart}
        availableCalendars={availableCalendars}
        isMyCalendarsOpen={isMyCalendarsOpen}
        isOtherCalendarsOpen={isOtherCalendarsOpen}
        onToggleCalendar={(id) => {
          setEnabledCalendarIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
            return next;
          });
        }}
        onToggleMyCalendars={() => setIsMyCalendarsOpen((current) => !current)}
        onToggleOtherCalendars={() => setIsOtherCalendarsOpen((current) => !current)}
        onOpenCreateCalendar={() => {
          setCreateCalendarVisible(true);
          setIsSidebarOpen(false);
        }}
        onClose={() => setIsSidebarOpen(false)}
      />

      <CalendarSettingsModal
        visible={settingsVisible}
        settings={settings}
        calendarView={calendarView}
        onChangeView={setCalendarView}
        onChange={(field, value) => setSettings((current) => ({ ...current, [field]: value }))}
        onClose={() => setSettingsVisible(false)}
      />

      <EventEditorModal
        visible={eventModalVisible}
        title={editingEvent ? 'Edit Event' : 'New Event'}
        subtitle={buildEventDateLabel(eventForm.eventDate)}
        form={eventForm}
        event={editingEvent}
        loading={savingEvent}
        availableCalendars={availableCalendars}
        onChange={(field, value) => setEventForm((current) => ({ ...current, [field]: value }))}
        onClose={handleCloseEventModal}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : null}
        onOpenMeet={handleOpenMeet}
      />

      <ChoiceModal
        visible={deleteConfirmVisible}
        title="Delete Event"
        message={`Delete "${editingEvent?.title || 'this event'}"?`}
        note="This action cannot be undone."
        onClose={() => setDeleteConfirmVisible(false)}
        primaryLabel="Delete Event"
        secondaryLabel="Keep Event"
        onPrimary={handleConfirmDelete}
        onSecondary={() => setDeleteConfirmVisible(false)}
        loading={savingEvent}
        primaryVariant="danger"
      />

      <ChoiceModal
        visible={recurringSaveVisible}
        title="Save Recurring Changes"
        message="Choose how these changes should be applied to this recurring event."
        note="Applying changes to future events can reset later exceptions in the series."
        onClose={() => {
          setRecurringSaveVisible(false);
          setPendingEventPayload(null);
        }}
        primaryLabel="This And Future"
        secondaryLabel="Only This Event"
        onPrimary={() => handleRecurringSaveChoice('future')}
        onSecondary={() => handleRecurringSaveChoice('this')}
        loading={savingEvent}
      />

      <ChoiceModal
        visible={recurringDeleteVisible}
        title="Delete Recurring Event"
        message="Choose whether to delete only this occurrence or this and all future occurrences."
        note="Deleting future events can remove later exceptions in the series."
        onClose={() => setRecurringDeleteVisible(false)}
        primaryLabel="This And Future"
        secondaryLabel="Only This Event"
        onPrimary={() => handleRecurringDeleteChoice('future')}
        onSecondary={() => handleRecurringDeleteChoice('this')}
        loading={savingEvent}
        primaryVariant="danger"
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

const makeStyles = (theme) => StyleSheet.create({
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 12,
    zIndex: 30,
  },
  calendarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
    flexWrap: 'wrap',
  },
  calendarTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  calendarViewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  calendarViewTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarViewTabActive: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  calendarViewTabLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  calendarViewTabLabelActive: {
    color: theme.colors.text,
  },
  dayGridWrap: {
    gap: 10,
  },
  dayAllDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
  },
  dayAllDayLabel: {
    width: DAY_GRID_GUTTER - 8,
    color: theme.colors.muted,
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  dayAllDayItems: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayAllDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
  },
  dayAllDayPillText: {
    color: theme.colors.text,
    fontSize: 11,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  dayGridBody: {
    position: 'relative',
  },
  dayHourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayHourLabel: {
    width: DAY_GRID_GUTTER - 8,
    textAlign: 'right',
    color: theme.colors.muted,
    fontSize: 9,
    letterSpacing: 0.4,
    marginTop: -6,
  },
  dayHourLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderDim,
  },
  dayColumn: {
    position: 'absolute',
    left: DAY_GRID_GUTTER,
    right: 0,
    top: 0,
    bottom: 0,
  },
  daySlot: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  dayEventBlock: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 5,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dayEventPress: {
    flex: 1,
  },
  dayEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dayEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dayEventTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  dayEventTime: {
    color: theme.colors.tertiary,
    fontSize: 9,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  dayEventMeet: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  dayNowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    marginLeft: -4,
  },
  dayNowRule: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.danger,
  },
  headerButton: {
    height: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerButtonPrimary: {
    borderColor: theme.colors.secondary,
  },
  headerButtonPressed: {
    opacity: 0.82,
  },
  headerButtonDisabled: {
    opacity: 0.45,
  },
  headerButtonLabel: {
    color: theme.colors.text,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.secondary,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  connectButtonPressed: {
    opacity: 0.85,
  },
  connectButtonLabel: {
    color: theme.colors.text,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  accountDropdownContainer: {
    position: 'relative',
    zIndex: 25,
    marginBottom: 12,
  },
  connectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  connectedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  connectedDotPaused: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  connectedStatusLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  accountTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: -4,
  },
  accountTriggerPressed: {
    opacity: 0.72,
  },
  accountTriggerChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  accountAvatarFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accountDropdownMenu: {
    marginTop: 8,
    alignSelf: 'flex-end',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(12, 12, 12, 0.98)',
  },
  accountDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
  },
  accountDropdownTitle: {
    color: theme.colors.secondary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  accountDropdownList: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
  },
  accountDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  accountDropdownItemInactive: {
    opacity: 0.5,
  },
  accountDropdownInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountDropdownDetails: {
    flex: 1,
    minWidth: 0,
  },
  accountDropdownEmail: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  accountDropdownActions: {
    flexDirection: 'row',
    gap: 6,
  },
  accountDropdownAction: {
    width: 26,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountDropdownActionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  errorBar: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  mainEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 14,
  },
  mainEmptyTitle: {
    color: theme.colors.secondary,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  mainEmptyText: {
    maxWidth: 300,
    color: theme.colors.tertiary,
    fontSize: 11,
    lineHeight: 20,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  mobileAgenda: {
    paddingBottom: 24,
  },
  mobileDaySection: {
    marginBottom: 28,
  },
  mobileDaySectionToday: {},
  mobileDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 5,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
  },
  mobileDayHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  mobileDayLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  mobileDayLabelToday: {
    color: theme.colors.background,
    backgroundColor: theme.colors.text,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  mobileDayTitle: {
    color: theme.colors.secondary,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  mobileDayTitleToday: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  mobileDayAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileDayActionPressed: {
    opacity: 0.7,
  },
  mobileCardList: {
    gap: 8,
  },
  mobileCard: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
  },
  mobileCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  mobileCardContent: {
    paddingLeft: 18,
    paddingRight: 14,
    paddingVertical: 12,
    gap: 6,
  },
  mobileCardContentWithActions: {
    paddingRight: 54,
  },
  mobileCardTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  mobileCardSub: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  mobileCardTime: {
    color: theme.colors.tertiary,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  mobileCardTimeTask: {
    color: '#FCA5A5',
  },
  mobileCardSubDot: {
    width: 2,
    height: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.muted,
  },
  mobileCardCalDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  mobileCardSubText: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  mobileCardActions: {
    position: 'absolute',
    top: 12,
    right: 10,
    gap: 6,
  },
  mobileCardAction: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.card,
  },
  emptyStateTitle: {
    color: theme.colors.secondary,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  emptyStateText: {
    maxWidth: 320,
    color: theme.colors.tertiary,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
  loadMoreLabel: {
    paddingTop: 6,
    paddingBottom: 14,
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  miniCalendar: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
  },
  miniCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  miniCalendarTitle: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  miniCalendarNav: {
    flexDirection: 'row',
    gap: 2,
  },
  miniCalendarDays: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  miniCalendarDayName: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.muted,
    fontSize: 9,
    letterSpacing: 0.8,
    paddingVertical: 2,
  },
  miniCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniCalendarCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 2,
  },
  miniCalendarCellOther: {
    opacity: 0.25,
  },
  miniCalendarCellIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCalendarCellToday: {
    backgroundColor: theme.colors.text,
  },
  miniCalendarCellSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  miniCalendarCellLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
  },
  miniCalendarCellLabelToday: {
    color: theme.colors.background,
    fontWeight: '600',
  },
  miniCalendarCellLabelSelected: {
    color: theme.colors.text,
  },
  miniCalendarDot: {
    height: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  miniCalendarDotInner: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#34D399',
  },
  calendarTogglesPanel: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 20,
  },
  calendarToggleSection: {
    gap: 2,
  },
  calendarToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    marginBottom: 6,
  },
  calendarToggleTitle: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  calendarToggleHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarToggleChevronCollapsed: {
    transform: [{ rotate: '-90deg' }],
  },
  calendarToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
  },
  calendarToggleCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarToggleMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  calendarToggleSummary: {
    color: theme.colors.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  calendarToggleEmail: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  calendarToggleEmpty: {
    color: theme.colors.muted,
    fontSize: 11,
    letterSpacing: 0.3,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  inlineSelectMenu: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.surfaceSoft,
  },
  inlineSelectRow: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  inlineSelectRowLast: {
    borderBottomWidth: 0,
  },
  inlineSelectRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  inlineSelectMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineSelectDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    flexShrink: 0,
  },
  inlineSelectLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  inlineSelectLabelSelected: {
    color: theme.colors.text,
  },
  timeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeFieldColumn: {
    flex: 1,
  },
  timeRangeSeparator: {
    color: theme.colors.tertiary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingTop: 14,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentedButton: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentedButtonActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  segmentedButtonDisabled: {
    opacity: 0.55,
  },
  segmentedLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  segmentedLabelActive: {
    color: theme.colors.text,
  },
  colorSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatchButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchButtonActive: {
    borderColor: theme.colors.text,
  },
  colorSwatchDefault: {
    borderColor: theme.colors.borderDim,
  },
  colorSwatchFill: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  colorSwatchDefaultFill: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  colorSwatchCustom: {
    borderColor: theme.colors.borderDim,
  },
  guestInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  guestInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    paddingHorizontal: 0,
    paddingVertical: 12,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  guestAddButton: {
    minWidth: 34,
  },
  guestChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guestChip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  guestChipLabel: {
    maxWidth: 220,
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  guestChipRemove: {
    color: theme.colors.tertiary,
    fontSize: 12,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  modalFooterEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  choiceModalBody: {
    gap: 10,
  },
  choiceModalText: {
    color: theme.colors.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
  choiceModalNote: {
    color: theme.colors.tertiary,
    fontSize: 11,
    lineHeight: 17,
  },
  choiceModalFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceModalButton: {
    flex: 1,
  },
  formFieldGroup: {
    gap: 6,
  },
  formSectionLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  settingsToggleRow: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsToggleRowActive: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  settingsToggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  settingsToggleLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  settingsToggleHelp: {
    color: theme.colors.tertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  settingsToggleCheck: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsToggleCheckActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
});
