import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { theme } from '../theme';
import { formatDateTime } from '../utils/date';

function normaliseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
}

export default function DateTimeField({ label, value, onChange }) {
  const [isVisible, setIsVisible] = useState(false);
  const selectedDate = useMemo(() => normaliseDateValue(value), [value]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setIsVisible(true)} style={styles.button}>
        <Text style={styles.buttonLabel}>
          {selectedDate ? formatDateTime(selectedDate) : 'Choose date and time'}
        </Text>
      </Pressable>

      {isVisible ? (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="datetime"
          display={Platform.select({ ios: 'inline', android: 'default' })}
          onChange={(_, nextValue) => {
            if (Platform.OS !== 'ios') {
              setIsVisible(false);
            }
            if (nextValue) {
              onChange(nextValue.toISOString());
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  buttonLabel: {
    color: theme.colors.text,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
