import React from 'react';
import { StyleSheet, Text } from 'react-native';

import ScreenShell from '../../components/ScreenShell';
import SectionCard from '../../components/SectionCard';
import { theme } from '../../theme';

export default function FinanceScreen() {
  return (
    <ScreenShell
      title="Finance"
      subtitle="Placeholder kept in sync with the web app."
    >
      <SectionCard>
        <Text style={styles.title}>Finance tracking is coming soon.</Text>
        <Text style={styles.body}>
          The rest of the mobile application is fully wired to the existing backend and Google
          Calendar flow. This tab stays intentionally lightweight until the web feature ships too.
        </Text>
      </SectionCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  body: {
    color: theme.colors.tertiary,
    fontSize: 12,
    lineHeight: 18,
  },
});
