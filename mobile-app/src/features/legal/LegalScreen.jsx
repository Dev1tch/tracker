import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import ParticleNetworkBackground from '../../components/ParticleNetworkBackground';
import Wordmark from '../../components/Wordmark';
import { useTheme } from '../../theme';

export default function LegalScreen({ title, updatedAt, switchHref, switchLabel, children }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const [interactionPoint, setInteractionPoint] = useState(null);

  const handleTouch = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    setInteractionPoint({ x: locationX, y: locationY, active: true });
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      onTouchEnd={() => setInteractionPoint(null)}
      onTouchMove={handleTouch}
      onTouchStart={handleTouch}
      style={styles.root}
    >
      <ParticleNetworkBackground interactionPoint={interactionPoint} />
      <View pointerEvents="none" style={styles.panelBackdrop} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Wordmark style={styles.wordmark} />

          <View style={styles.topLinks}>
            <Pressable onPress={() => router.replace('/auth')} style={styles.topLink}>
              <Text style={styles.topLinkLabel}>Back</Text>
            </Pressable>
            {switchHref ? (
              <Pressable onPress={() => router.replace(switchHref)} style={styles.topLink}>
                <Text style={styles.topLinkLabel}>{switchLabel}</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.updated}>Last updated: {updatedAt}</Text>

          <View style={styles.content}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function LegalSection({ title, children }) {
  const theme = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(theme), [theme]);

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.heading}>{title}</Text>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

export function LegalParagraph({ children }) {
  const theme = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(theme), [theme]);

  return <Text style={sectionStyles.paragraph}>{children}</Text>;
}

export function LegalList({ items }) {
  const theme = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(theme), [theme]);

  return (
    <View style={sectionStyles.list}>
      {items.map((item) => (
        <View key={item} style={sectionStyles.listItem}>
          <Text style={sectionStyles.listBullet}>•</Text>
          <Text style={sectionStyles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function LegalHighlight({ children }) {
  const theme = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(theme), [theme]);

  return (
    <View style={sectionStyles.highlight}>
      <Text style={sectionStyles.paragraph}>{children}</Text>
    </View>
  );
}

export function LegalScopeTable({ rows }) {
  const theme = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(theme), [theme]);

  return (
    <View style={sectionStyles.scopeTable}>
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[sectionStyles.scopeRow, index > 0 ? sectionStyles.scopeRowBorder : null]}
        >
          <Text style={sectionStyles.scopeLabel}>{row.label}</Text>
          <Text style={sectionStyles.scopeText}>{row.description}</Text>
        </View>
      ))}
    </View>
  );
}

export function LegalLink({ children, onPress }) {
  const theme = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(theme), [theme]);

  return (
    <Text onPress={onPress} style={sectionStyles.link}>
      {children}
    </Text>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  panelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  container: {
    width: '100%',
  },
  wordmark: {
    marginBottom: 22,
  },
  topLinks: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  topLink: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topLinkLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
  updated: {
    marginTop: 8,
    marginBottom: 20,
    color: theme.colors.tertiary,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  content: {
    paddingBottom: 28,
  },
});

const makeSectionStyles = (theme) => StyleSheet.create({
  section: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDim,
    marginTop: 16,
    paddingTop: 16,
  },
  heading: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.54,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  body: {
    gap: 10,
  },
  paragraph: {
    color: theme.colors.secondary,
    fontSize: 12,
    lineHeight: 19,
  },
  list: {
    marginTop: 0,
    gap: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  listBullet: {
    color: theme.colors.secondary,
    fontSize: 12,
    lineHeight: 19,
  },
  listText: {
    flex: 1,
    color: theme.colors.secondary,
    fontSize: 12,
    lineHeight: 19,
  },
  highlight: {
    marginTop: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.32)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scopeTable: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  scopeRow: {
    gap: 0,
  },
  scopeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDim,
  },
  scopeLabel: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    color: theme.colors.text,
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textTransform: 'uppercase',
  },
  scopeText: {
    color: theme.colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  link: {
    color: theme.colors.text,
    textDecorationLine: 'underline',
  },
});
