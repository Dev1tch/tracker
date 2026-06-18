import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import DateTimePickerSheet from './DateTimePickerSheet';
import { useTheme } from '../theme';
import { formatDateTime, formatFullDate, formatTime } from '../utils/date';

function normaliseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
}

export default function DateTimeField({
  label,
  value,
  onChange,
  placeholder = 'Choose date and time',
  mode = 'datetime',
  disabled = false,
  formatter,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [isVisible, setIsVisible] = useState(false);
  const selectedDate = useMemo(() => normaliseDateValue(value), [value]);
  const displayValue = useMemo(() => {
    if (!selectedDate) return placeholder;
    if (typeof formatter === 'function') {
      return formatter(selectedDate);
    }

    if (mode === 'date') {
      return formatFullDate(selectedDate);
    }

    if (mode === 'time') {
      return formatTime(selectedDate);
    }

    return formatDateTime(selectedDate);
  }, [formatter, mode, placeholder, selectedDate]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setIsVisible(true)}
        style={[styles.button, disabled ? styles.buttonDisabled : null]}
      >
        <Text style={styles.buttonLabel}>
          {displayValue}
        </Text>
      </Pressable>

      <DateTimePickerSheet
        visible={isVisible && !disabled}
        value={selectedDate || new Date()}
        mode={mode}
        title={label}
        onConfirm={(nextValue) => {
          setIsVisible(false);
          if (nextValue) {
            onChange(nextValue.toISOString());
          }
        }}
        onClose={() => setIsVisible(false)}
      />
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  button: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: theme.colors.text,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
