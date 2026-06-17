import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export default function ModalSheet({
  visible,
  title,
  subtitle,
  children,
  footer,
  headerActions,
  stickyContent,
  onClose,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <View style={styles.headerActions}>
              {headerActions}
              <Pressable hitSlop={10} onPress={onClose} style={styles.closeButton}>
                <X size={18} color={theme.colors.text} strokeWidth={1.7} />
              </Pressable>
            </View>
          </View>

          {stickyContent ? (
            <View style={styles.stickyContent}>{stickyContent}</View>
          ) : null}

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content}>{children}</ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: theme.colors.backgroundAlt,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  scrollArea: {
    flexShrink: 1,
  },
  content: {
    gap: 14,
    paddingBottom: 12,
  },
  stickyContent: {
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
  },
  footer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDim,
  },
});
