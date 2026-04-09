import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '../theme';

export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <LinearGradient colors={theme.gradients.app} style={styles.root}>
      <View style={styles.card}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={styles.label}>{message}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
