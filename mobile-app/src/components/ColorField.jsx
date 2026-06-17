import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';
import { Pipette } from 'lucide-react-native';

import { useTheme } from '../theme';

function sanitizeHexInput(value) {
  const cleaned = String(value || '')
    .replace(/[^0-9a-fA-F#]/g, '')
    .replace(/#/g, '');

  if (!cleaned) {
    return '#';
  }

  return `#${cleaned.slice(0, 6).toUpperCase()}`;
}

function normalizeHexColor(value, fallback = '#60A5FA') {
  const sanitized = sanitizeHexInput(value);
  return /^#[0-9A-F]{6}$/.test(sanitized) ? sanitized : fallback;
}

export default function ColorField({
  label = 'Color',
  value,
  onChange,
  presetColors = [],
  alwaysOpen = false,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const resolvedColor = useMemo(() => normalizeHexColor(value), [value]);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.presetRow}>
        <View style={styles.presetWrap}>
          {presetColors.map((color) => (
            <Pressable
              key={color}
              onPress={() => onChange(color.toUpperCase())}
              style={[
                styles.presetSwatch,
                { backgroundColor: color },
                resolvedColor === color.toUpperCase() ? styles.presetSwatchActive : null,
              ]}
            />
          ))}
        </View>

        {alwaysOpen ? null : (
          <Pressable
            onPress={() => setPickerVisible((current) => !current)}
            style={[
              styles.customButton,
              pickerVisible ? styles.customButtonActive : null,
            ]}
          >
            <View style={[styles.customButtonSwatch, { backgroundColor: resolvedColor }]} />
            <Pipette
              size={12}
              color={pickerVisible ? theme.colors.text : theme.colors.secondary}
            />
          </Pressable>
        )}
      </View>

      {(alwaysOpen || pickerVisible) ? (
        <View style={styles.pickerWrap}>
          <ColorPicker
            style={styles.picker}
            thumbColor="#ffffff"
            thumbShape="circle"
            thumbSize={18}
            value={resolvedColor}
            onChangeJS={(colors) => onChange(colors.hex.toUpperCase())}
          >
            <Panel1 style={styles.panel} />
            <HueSlider style={styles.slider} />
          </ColorPicker>
        </View>
      ) : null}

      <View style={styles.hexRow}>
        <View style={[styles.hexPreview, { backgroundColor: resolvedColor }]} />
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={(nextValue) => onChange(sanitizeHexInput(nextValue))}
          placeholder="#60A5FA"
          placeholderTextColor={theme.colors.muted}
          selectionColor="#ffffff"
          style={styles.hexInput}
          value={sanitizeHexInput(value)}
        />
      </View>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  label: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  presetWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetSwatch: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetSwatchActive: {
    borderColor: theme.colors.text,
  },
  customButton: {
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    borderColor: theme.colors.borderDim,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customButtonActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  customButtonSwatch: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.surfaceSoft,
    padding: 14,
    gap: 10,
  },
  picker: {
    gap: 12,
  },
  panel: {
    width: '100%',
    height: 170,
    borderRadius: 4,
  },
  slider: {
    width: '100%',
    height: 24,
    borderRadius: 999,
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hexPreview: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  hexInput: {
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
});
