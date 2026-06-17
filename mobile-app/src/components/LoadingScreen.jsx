import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme';

export default function LoadingScreen({ message = 'Loading…' }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <LinearGradient colors={theme.gradients.app} style={styles.root}>
      <View style={styles.card}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={styles.label}>{message}</Text>
      </View>
    </LinearGradient>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 18,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
