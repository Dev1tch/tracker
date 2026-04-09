import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Settings2,
  Trash2,
  User,
  Video,
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
import {
  calendarApi,
  SCOPES,
  tasksApi,
} from '../../shared/api';
import { theme } from '../../theme';
import {
  toLocalDateKey,
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
  allDay: false,
  start: new Date(),
  end: addDays(new Date(), 0),
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
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

function formatAgendaDayTitle(date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
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

function FramelessIconButton({ icon, color = theme.colors.text, onPress, size = 16 }) {
  const Icon = icon;

  return (
    <Pressable hitSlop={10} onPress={onPress} style={styles.iconButton}>
      <Icon color={color} size={size} strokeWidth={1.7} />
    </Pressable>
  );
}

function InlineSelectMenu({
  visible,
  options,
  selectedValue,
  onSelect,
}) {
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
                    <Check color={theme.colors.text} size={9} strokeWidth={2.2} />
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
  onChange,
  onClose,
}) {
  const [activePicker, setActivePicker] = useState('');

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
  form,
  loading,
  availableCalendars,
  onChange,
  onClose,
  onSave,
  onDelete,
}) {
  const [activePicker, setActivePicker] = useState('');

  const calendarOptions = useMemo(
    () => availableCalendars.map((calendar) => ({
      value: `${calendar.accountEmail}:${calendar.id}`,
      label: `${calendar.summary || 'Calendar'} - ${calendar.accountEmail}`,
      color: calendar.backgroundColor,
    })),
    [availableCalendars]
  );
  const eventTypeOptions = useMemo(
    () => [
      { value: 'timed', label: 'Timed' },
      { value: 'all_day', label: 'All Day' },
    ],
    []
  );

  useEffect(() => {
    if (!visible) {
      setActivePicker('');
    }
  }, [visible]);

  return (
    <ModalSheet
      visible={visible}
      title={title}
      onClose={onClose}
      headerActions={onDelete ? (
        <FramelessIconButton icon={Trash2} color={theme.colors.danger} onPress={onDelete} />
      ) : null}
      footer={(
        <View style={styles.modalFooterEnd}>
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

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Calendar</Text>
        <InlinePickerField
          placeholder="Select calendar"
          valueLabel={calendarOptions.find((option) => option.value === form.calendarKey)?.label || ''}
          onPress={() => setActivePicker((current) => (current === 'calendar' ? '' : 'calendar'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'calendar'}
          options={calendarOptions}
          selectedValue={form.calendarKey}
          onSelect={(value) => {
            onChange('calendarKey', value);
            setActivePicker('');
          }}
        />
      </View>

      <View style={styles.formFieldGroup}>
        <Text style={styles.formSectionLabel}>Event Type</Text>
        <InlinePickerField
          placeholder="Select event type"
          valueLabel={form.allDay ? 'All Day' : 'Timed'}
          onPress={() => setActivePicker((current) => (current === 'eventType' ? '' : 'eventType'))}
        />
        <InlineSelectMenu
          visible={activePicker === 'eventType'}
          options={eventTypeOptions}
          selectedValue={form.allDay ? 'all_day' : 'timed'}
          onSelect={(value) => {
            onChange('allDay', value === 'all_day');
            setActivePicker('');
          }}
        />
      </View>

      <DateTimeField
        label={form.allDay ? 'Start Date' : 'Starts'}
        value={form.start}
        onChange={(value) => onChange('start', value)}
        placeholder="Select start"
      />
      <DateTimeField
        label={form.allDay ? 'End Date' : 'Ends'}
        value={form.end}
        onChange={(value) => onChange('end', value)}
        placeholder="Select end"
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

function MobileAgendaCard({ item, eventCardStyle, onOpen, onOpenMeet }) {
  const isTask = item.eventType === 'task';
  const eventColor = isTask ? '#EF4444' : getCalendarEventColor(item);
  const calendarColor = item.calendarColor || eventColor;
  const badgeLabel = isTask ? 'Task due' : item.allDay ? 'All day' : 'Scheduled';
  const timeLabel = isTask
    ? `Due ${formatCalendarTimeRange(item.start, item.end)}`
    : item.allDay
      ? 'All day'
      : formatCalendarTimeRange(item.start, item.end);
  const hasMeta = Boolean((!isTask && (item.calendarName || item.accountEmail)) || item.location);
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

      <Pressable onPress={onOpen} style={[styles.mobileCardContent, hasExternalActions ? styles.mobileCardContentWithActions : null]}>
        <View style={styles.mobileCardTop}>
          <View style={styles.mobileCardPills}>
            <View style={styles.mobileCardTimePill}>
              <Text style={styles.mobileCardTimePillLabel}>{timeLabel}</Text>
            </View>
            <View
              style={[
                styles.mobileCardBadge,
                isTask ? styles.mobileCardBadgeTask : null,
                !isTask && item.allDay ? styles.mobileCardBadgeAllDay : null,
              ]}
            >
              <Text
                style={[
                  styles.mobileCardBadgeLabel,
                  !isTask && !item.allDay ? styles.mobileCardBadgeLabelTimed : null,
                  !isTask && item.allDay ? styles.mobileCardBadgeLabelAllDay : null,
                  isTask ? styles.mobileCardBadgeLabelTask : null,
                ]}
              >
                {badgeLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.mobileCardTitleRow}>
          {!isTask ? (
            <View
              style={[
                styles.mobileCardDot,
                {
                  backgroundColor: calendarColor,
                  shadowColor: calendarColor,
                },
              ]}
            />
          ) : null}
          <Text style={styles.mobileCardTitle}>{item.title}</Text>
        </View>

        {hasMeta ? (
          <View style={styles.mobileCardMeta}>
            {!isTask && (item.calendarName || item.accountEmail) ? (
              <View style={styles.mobileCardMetaItem}>
                <View style={[styles.mobileCardMetaSourceDot, { backgroundColor: calendarColor }]} />
                <Text numberOfLines={1} style={styles.mobileCardMetaText}>
                  {item.calendarName || 'Calendar'}{item.accountEmail ? ` - ${item.accountEmail}` : ''}
                </Text>
              </View>
            ) : null}

            {item.location ? (
              <View style={styles.mobileCardMetaItem}>
                <MapPin color={theme.colors.secondary} size={12} strokeWidth={1.8} />
                <Text numberOfLines={1} style={styles.mobileCardMetaText}>
                  {item.location}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
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
  const isToday = isSameCalendarDay(day, new Date());
  const dayTitle = formatAgendaDayTitle(day);

  return (
    <View style={[styles.mobileDaySection, isToday ? styles.mobileDaySectionToday : null]}>
      <View style={styles.mobileDayHeader}>
        <View style={styles.mobileDayHeading}>
          <View style={styles.mobileDayMeta}>
            <Text style={[styles.mobileDayLabel, isToday ? styles.mobileDayLabelToday : null]}>
              {isToday ? 'Today' : formatAgendaDayLabel(day)}
            </Text>
          </View>
          <Text style={styles.mobileDayTitle}>{dayTitle}</Text>
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

export default function CalendarScreen() {
  const router = useRouter();
  const { webAppUrl } = useAuth();
  const addToast = useToast();
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mobileAgendaStart, setMobileAgendaStart] = useState(() =>
    startOfDay(addDays(new Date(), -MOBILE_AGENDA_INITIAL_PAST_DAYS))
  );
  const [mobileAgendaEnd, setMobileAgendaEnd] = useState(() =>
    endOfDay(addDays(new Date(), MOBILE_AGENDA_INITIAL_FUTURE_DAYS))
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [createCalendarVisible, setCreateCalendarVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [calendarForm, setCalendarForm] = useState(EMPTY_CALENDAR_FORM);

  const weekStart = useMemo(
    () => getWeekStart(selectedDate, settings.weekStart),
    [selectedDate, settings.weekStart]
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
        loadCalendarRange(storedAccounts, startOfDay(mobileAgendaStart), endOfDay(mobileAgendaEnd)),
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
    mobileAgendaEnd,
    mobileAgendaStart,
  ]);

  const loadMoreAgenda = useCallback(async () => {
    if (loading || isLoadingMore || accounts.length === 0) return;

    const nextRangeStart = startOfDay(addDays(mobileAgendaEnd, 1));
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
  }, [accounts, initializeEnabledCalendars, isLoadingMore, loadCalendarRange, loading, mobileAgendaEnd]);

  useEffect(() => {
    refreshCalendarData();
  }, [refreshCalendarData]);

  useEffect(() => {
    scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [mobileAgendaStart]);

  const resetAgendaWindow = useCallback((anchorDate) => {
    setMobileAgendaStart(startOfDay(addDays(anchorDate, -MOBILE_AGENDA_INITIAL_PAST_DAYS)));
    setMobileAgendaEnd(endOfDay(addDays(anchorDate, MOBILE_AGENDA_INITIAL_FUTURE_DAYS)));
  }, []);

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

  const handleAgendaScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (remaining < 420) {
      loadMoreAgenda();
    }
  }, [loadMoreAgenda]);

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
    setSelectedDate(date);
    resetAgendaWindow(date);
    setIsSidebarOpen(false);
  }, [resetAgendaWindow]);

  const openNewEvent = useCallback((date = selectedDate) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setEventForm(buildEventForm(null, availableCalendars, date));
    setEventModalVisible(true);
  }, [availableCalendars, selectedDate]);

  const openEditEvent = useCallback(async (event) => {
    setEditingEvent(event);
    setEventForm(buildEventForm(event, availableCalendars, selectedDate));
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

  const handleDisconnectAccount = (email) => {
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
            setAccounts(calendarApi.getAccounts());
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
            <Text style={styles.calendarTitle}>{formatWeekRange(weekStart)}</Text>
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
            <FramelessIconButton icon={ChevronLeft} color={theme.colors.tertiary} onPress={goToPrevWeek} />
            <FramelessIconButton icon={ChevronRight} color={theme.colors.tertiary} onPress={goToNextWeek} />
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
        onChange={(field, value) => setSettings((current) => ({ ...current, [field]: value }))}
        onClose={() => setSettingsVisible(false)}
      />

      <EventEditorModal
        visible={eventModalVisible}
        title={editingEvent ? 'Edit Event' : 'New Event'}
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
  headerButton: {
    height: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerButtonPrimary: {
    borderColor: 'rgba(255, 255, 255, 0.72)',
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
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
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
    gap: 12,
    paddingBottom: 18,
  },
  mobileDaySection: {
    gap: 12,
  },
  mobileDaySectionToday: {
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
  },
  mobileDayHeader: {
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mobileDayHeading: {
    minWidth: 0,
    gap: 6,
  },
  mobileDayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  mobileDayLabel: {
    color: theme.colors.tertiary,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  mobileDayLabelToday: {
    backgroundColor: theme.colors.text,
    color: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  mobileDayTitle: {
    color: theme.colors.text,
    fontSize: 17,
    letterSpacing: 0.2,
  },
  mobileDayAction: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileDayActionPressed: {
    opacity: 0.7,
  },
  mobileCardList: {
    gap: 12,
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
    width: 3,
  },
  mobileCardContent: {
    padding: 14,
  },
  mobileCardContentWithActions: {
    paddingRight: 68,
  },
  mobileCardTop: {
    marginBottom: 12,
  },
  mobileCardPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingRight: 10,
  },
  mobileCardTimePill: {
    minHeight: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  mobileCardTimePillLabel: {
    color: theme.colors.text,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mobileCardBadge: {
    minHeight: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  mobileCardBadgeTask: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  mobileCardBadgeAllDay: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  mobileCardBadgeLabel: {
    color: theme.colors.tertiary,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mobileCardBadgeLabelTimed: {
    color: theme.colors.secondary,
  },
  mobileCardBadgeLabelAllDay: {
    color: '#BFDBFE',
  },
  mobileCardBadgeLabelTask: {
    color: '#FECACA',
  },
  mobileCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  mobileCardDot: {
    width: 7,
    height: 7,
    marginTop: 6,
    borderRadius: 999,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  mobileCardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  mobileCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  mobileCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  mobileCardMetaText: {
    color: theme.colors.secondary,
    fontSize: 11,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  mobileCardMetaSourceDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
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
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  calendarToggleSection: {
    gap: 6,
  },
  calendarToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 4,
  },
  calendarToggleTitle: {
    color: theme.colors.tertiary,
    fontSize: 10,
    letterSpacing: 1.2,
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
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 2,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  calendarToggleCheckbox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarToggleMeta: {
    flex: 1,
    minWidth: 0,
  },
  calendarToggleSummary: {
    color: theme.colors.secondary,
    fontSize: 11,
  },
  calendarToggleEmail: {
    color: theme.colors.muted,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  calendarToggleEmpty: {
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 0.4,
    paddingTop: 2,
    paddingBottom: 6,
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
  modalFooterEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
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
