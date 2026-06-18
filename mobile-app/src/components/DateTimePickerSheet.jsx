import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import ModalSheet from './ModalSheet';
import ActionButton from './ActionButton';
import { useTheme } from '../theme';
import { formatMonthLabel } from '../utils/date';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function safeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value);
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function buildMonthDays(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const days = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
    days.push({ day: daysInPrev - index, current: false, date: new Date(year, month - 1, daysInPrev - index) });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ day, current: true, date: new Date(year, month, day) });
  }
  const remaining = 42 - days.length;
  for (let index = 1; index <= remaining; index += 1) {
    days.push({ day: index, current: false, date: new Date(year, month + 1, index) });
  }
  return days;
}

export default function DateTimePickerSheet({
  visible,
  value,
  mode = 'datetime',
  title,
  onConfirm,
  onClose,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [draft, setDraft] = useState(() => safeDate(value));
  const [viewDate, setViewDate] = useState(() => safeDate(value));

  useEffect(() => {
    if (!visible) return;
    const base = safeDate(value);
    setDraft(base);
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [visible, value]);

  const showDate = mode === 'date' || mode === 'datetime';
  const showTime = mode === 'time' || mode === 'datetime';

  const days = useMemo(() => buildMonthDays(viewDate), [viewDate]);
  const today = useMemo(() => new Date(), []);

  const hour24 = draft.getHours();
  const hour12 = ((hour24 + 11) % 12) + 1;
  const minute = draft.getMinutes();
  const isPM = hour24 >= 12;

  const minuteOptions = useMemo(() => {
    if (MINUTE_STEPS.includes(minute)) return MINUTE_STEPS;
    return [...MINUTE_STEPS, minute].sort((a, b) => a - b);
  }, [minute]);

  const selectDay = (date) => {
    setDraft((current) => {
      const next = new Date(current);
      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      return next;
    });
  };

  const setHour12 = (value12) => {
    setDraft((current) => {
      const next = new Date(current);
      const base = value12 % 12;
      next.setHours(next.getHours() >= 12 ? base + 12 : base);
      return next;
    });
  };

  const setMinute = (value) => {
    setDraft((current) => {
      const next = new Date(current);
      next.setMinutes(value);
      return next;
    });
  };

  const setMeridiem = (pm) => {
    setDraft((current) => {
      const next = new Date(current);
      const base = next.getHours() % 12;
      next.setHours(pm ? base + 12 : base);
      return next;
    });
  };

  const shiftMonth = (delta) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <ModalSheet
      visible={visible}
      title={title || (mode === 'time' ? 'Select time' : 'Select date')}
      onClose={onClose}
      footer={(
        <View style={styles.footer}>
          <ActionButton label="Done" variant="solid" onPress={() => onConfirm(draft)} />
        </View>
      )}
    >
      {showDate ? (
        <View style={styles.section}>
          <View style={styles.monthBar}>
            <Pressable hitSlop={10} onPress={() => shiftMonth(-1)} style={styles.monthNav}>
              <ChevronLeft size={18} color={theme.colors.secondary} strokeWidth={1.7} />
            </Pressable>
            <Text style={styles.monthLabel}>{formatMonthLabel(viewDate)}</Text>
            <Pressable hitSlop={10} onPress={() => shiftMonth(1)} style={styles.monthNav}>
              <ChevronRight size={18} color={theme.colors.secondary} strokeWidth={1.7} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((weekday, index) => (
              <Text key={`${weekday}-${index}`} style={styles.weekday}>{weekday}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((cell, index) => {
              const selected = isSameDay(cell.date, draft);
              const isToday = isSameDay(cell.date, today);
              return (
                <Pressable
                  key={`${cell.date.toISOString()}-${index}`}
                  onPress={() => selectDay(cell.date)}
                  style={styles.dayCell}
                >
                  <View
                    style={[
                      styles.dayInner,
                      selected ? styles.daySelected : null,
                      !selected && isToday ? styles.dayToday : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        !cell.current ? styles.dayMuted : null,
                        selected ? styles.dayLabelSelected : null,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showTime ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time</Text>
          <View style={styles.timeRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillScroll}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value12) => {
                const active = value12 === hour12;
                return (
                  <Pressable
                    key={`h-${value12}`}
                    onPress={() => setHour12(value12)}
                    style={[styles.pill, active ? styles.pillActive : null]}
                  >
                    <Text style={[styles.pillLabel, active ? styles.pillLabelActive : null]}>
                      {String(value12).padStart(2, '0')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.timeRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillScroll}
            >
              {minuteOptions.map((value) => {
                const active = value === minute;
                return (
                  <Pressable
                    key={`m-${value}`}
                    onPress={() => setMinute(value)}
                    style={[styles.pill, active ? styles.pillActive : null]}
                  >
                    <Text style={[styles.pillLabel, active ? styles.pillLabelActive : null]}>
                      {String(value).padStart(2, '0')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.meridiemRow}>
            <Pressable
              onPress={() => setMeridiem(false)}
              style={[styles.meridiemBtn, !isPM ? styles.pillActive : null]}
            >
              <Text style={[styles.pillLabel, !isPM ? styles.pillLabelActive : null]}>AM</Text>
            </Pressable>
            <Pressable
              onPress={() => setMeridiem(true)}
              style={[styles.meridiemBtn, isPM ? styles.pillActive : null]}
            >
              <Text style={[styles.pillLabel, isPM ? styles.pillLabelActive : null]}>PM</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ModalSheet>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNav: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  daySelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  dayToday: {
    borderColor: theme.colors.border,
  },
  dayLabel: {
    color: theme.colors.text,
    fontSize: 13,
  },
  dayMuted: {
    color: theme.colors.muted,
  },
  dayLabelSelected: {
    color: theme.colors.background,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
  },
  pillScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    minWidth: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.text,
  },
  pillLabel: {
    color: theme.colors.secondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  pillLabelActive: {
    color: theme.colors.text,
  },
  meridiemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  meridiemBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
