import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { theme } from '../theme';

export default function InlinePickerField({
  valueLabel,
  placeholder,
  onPress,
  style,
}) {
  const displayValue = valueLabel || placeholder;
  const isPlaceholder = !valueLabel;

  return (
    <Pressable onPress={onPress} style={[styles.field, style]}>
      <Text style={[styles.value, isPlaceholder ? styles.placeholder : null]} numberOfLines={1}>
        {displayValue}
      </Text>
      <View style={styles.iconWrap}>
        <ChevronDown size={14} color={theme.colors.tertiary} strokeWidth={1.5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  value: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  placeholder: {
    color: theme.colors.muted,
  },
  iconWrap: {
    flexShrink: 0,
  },
});
