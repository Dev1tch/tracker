import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Moon, Palette, Sun } from 'lucide-react-native';

import ModalSheet from './ModalSheet';
import ColorField from './ColorField';
import { useTheme, useThemeControls } from '../theme';

const OPTIONS = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'custom', label: 'Custom', Icon: Palette },
];

const CUSTOM_BG_PRESETS = ['#0F172A', '#1A1F2E', '#111827', '#1C1917', '#FFFFFF', '#F4F4F6'];
const CUSTOM_FG_PRESETS = ['#E8EAF2', '#FFFFFF', '#FBBF24', '#34D399', '#60A5FA', '#0A0A0A'];

export default function ThemeSwitcher({ size = 16, color }) {
  const theme = useTheme();
  const { mode, customColors, setMode, setCustomColors } = useThemeControls();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState(false);

  const active = OPTIONS.find((o) => o.value === mode) || OPTIONS[0];
  const ActiveIcon = active.Icon;
  const iconColor = color || theme.colors.secondary;

  return (
    <>
      <Pressable hitSlop={10} onPress={() => setOpen(true)} style={styles.trigger} accessibilityLabel={`Theme: ${active.label}`}>
        <ActiveIcon size={size} color={iconColor} strokeWidth={1.6} />
      </Pressable>

      <ModalSheet visible={open} title="Theme" onClose={() => setOpen(false)}>
        <View style={styles.optionRow}>
          {OPTIONS.map(({ value, label, Icon }) => {
            const isActive = mode === value;
            return (
              <Pressable
                key={value}
                onPress={() => (value === 'custom' ? setCustomColors(customColors) : setMode(value))}
                style={[styles.option, isActive ? styles.optionActive : null]}
              >
                <Icon size={20} color={theme.colors.text} strokeWidth={1.6} />
                <Text style={styles.optionLabel}>{label}</Text>
                {isActive ? <Check size={15} color={theme.colors.info} strokeWidth={2} /> : <View style={styles.checkPlaceholder} />}
              </Pressable>
            );
          })}
        </View>

        {mode === 'custom' ? (
          <View style={styles.customBody}>
            <ColorField
              label="Background"
              value={customColors.bg}
              presetColors={CUSTOM_BG_PRESETS}
              onChange={(bg) => setCustomColors({ ...customColors, bg })}
            />
            <ColorField
              label="Details & text"
              value={customColors.fg}
              presetColors={CUSTOM_FG_PRESETS}
              onChange={(fg) => setCustomColors({ ...customColors, fg })}
            />
          </View>
        ) : null}
      </ModalSheet>
    </>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  trigger: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  optionRow: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    borderRadius: 10,
  },
  optionActive: { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSoft },
  optionLabel: { flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: '500', letterSpacing: 0.5 },
  checkPlaceholder: { width: 15, height: 15 },
  customBody: { marginTop: 16, gap: 14 },
});
