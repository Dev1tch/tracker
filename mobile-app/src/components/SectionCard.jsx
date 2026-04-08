import React from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';

export default function SectionCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.card,
    padding: 14,
    gap: 12,
  },
});
