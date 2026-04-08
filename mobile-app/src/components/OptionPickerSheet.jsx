import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import ModalSheet from './ModalSheet';
import ActionButton from './ActionButton';
import { theme } from '../theme';

function OptionRow({ option, selected, multiple, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.optionRow, selected ? styles.optionRowSelected : null]}>
      <View style={styles.optionMain}>
        {option.color ? <View style={[styles.optionDot, { backgroundColor: option.color }]} /> : null}
        <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
          {option.label}
        </Text>
      </View>
      {selected ? (
        <Check size={14} color={multiple ? theme.colors.text : theme.colors.secondary} strokeWidth={2} />
      ) : null}
    </Pressable>
  );
}

export default function OptionPickerSheet({
  visible,
  title,
  options,
  selectedValue,
  selectedValues,
  multiple = false,
  onSelect,
  onToggle,
  onClose,
  onClear,
}) {
  return (
    <ModalSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={onClear ? (
        <View style={styles.footer}>
          <ActionButton label="Clear" variant="ghost" onPress={onClear} />
        </View>
      ) : null}
    >
      <View style={styles.list}>
        {options.map((option) => {
          const selected = multiple
            ? selectedValues?.includes(option.value)
            : selectedValue === option.value;

          return (
            <OptionRow
              key={String(option.value)}
              option={option}
              selected={selected}
              multiple={multiple}
              onPress={() => {
                if (multiple) {
                  onToggle?.(option.value);
                } else {
                  onSelect?.(option.value);
                  onClose?.();
                }
              }}
            />
          );
        })}
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  optionRow: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionRowSelected: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  optionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  optionLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  optionLabelSelected: {
    color: theme.colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
