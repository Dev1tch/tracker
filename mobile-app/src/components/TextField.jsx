import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '../theme';

export default function TextField({ label, multiline = false, style, ...props }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.muted}
        multiline={multiline}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          style,
        ]}
        {...props}
      />
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
  input: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    paddingHorizontal: 0,
    paddingVertical: 12,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
});
