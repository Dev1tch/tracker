import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';

export default function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  style,
  textStyle,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const isSolid = variant === 'solid';

  const iconColor = isDanger
    ? theme.colors.danger
    : isSolid
      ? theme.colors.background
      : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : null,
        isGhost
          ? styles.buttonGhost
          : isDanger
            ? styles.buttonDanger
            : isSolid
              ? styles.buttonSolid
              : styles.buttonPrimary,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={compact ? 14 : 16}
          color={iconColor}
        />
      ) : null}
      {label ? (
        <Text
          style={[
            styles.label,
            isDanger
              ? styles.labelDanger
              : isSolid
                ? styles.labelSolid
                : styles.labelDefault,
            textStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  button: {
    borderRadius: 0,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.secondary,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.borderDim,
  },
  buttonDanger: {
    backgroundColor: 'rgba(255, 77, 77, 0.04)',
    borderColor: 'rgba(255, 77, 77, 0.5)',
  },
  buttonSolid: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  buttonCompact: {
    minWidth: 30,
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  labelDefault: {
    color: theme.colors.text,
  },
  labelDanger: {
    color: theme.colors.danger,
  },
  labelSolid: {
    color: theme.colors.background,
  },
});
