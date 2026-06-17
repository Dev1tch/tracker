import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';

export default function SectionCard({ children, style }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <View style={[styles.card, style]}>{children}</View>;
}

const makeStyles = (theme) => StyleSheet.create({
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    backgroundColor: theme.colors.card,
    padding: 14,
    gap: 12,
  },
});
