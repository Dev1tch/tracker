import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut } from 'lucide-react-native';

import BrandMark from './BrandMark';
import { useAuth } from '../providers/AuthProvider';
import { theme } from '../theme';

export default function ScreenShell({
  title,
  subtitle,
  children,
  refreshControl,
  showPageHeader = true,
  onScroll,
  scrollEventThrottle,
  scrollViewRef,
  contentContainerStyle,
}) {
  const { logout } = useAuth();
  const activeLabel = title ? title.toLowerCase() : '';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <BrandMark size={14} />
            <Text style={styles.brand}>Life tracker</Text>
            {activeLabel ? (
              <>
                <Text style={styles.brandSlash}>/</Text>
                <Text style={styles.brandActive}>{activeLabel}</Text>
              </>
            ) : null}
          </View>
          <PressableLogout onPress={logout} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          refreshControl={refreshControl}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {title && showPageHeader ? (
            <View style={styles.pageHeader}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}

          <View style={styles.body}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PressableLogout({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.logoutButton,
        pressed ? styles.logoutButtonPressed : null,
      ]}
    >
      <LogOut size={16} color={theme.colors.secondary} strokeWidth={1.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    backgroundColor: theme.colors.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  brand: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  brandSlash: {
    color: theme.colors.muted,
    fontSize: 10,
    marginHorizontal: 2,
  },
  brandActive: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
  logoutButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 14,
  },
  pageHeader: {
    gap: 6,
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: theme.colors.tertiary,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 360,
  },
  body: {
    gap: 12,
  },
});
