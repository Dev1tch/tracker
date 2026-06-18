import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import ActionButton from '../components/ActionButton';
import { useTheme } from '../theme';

const DialogContext = createContext(null);

// The visual dialog card. Rendered either by the root <Modal> (when no themed
// sheet is open) or directly inside the topmost open ModalSheet — because RN
// cannot present a second root-level modal over an already-presented one.
export function DialogBody({ dialog, onConfirm, onCancel }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (!dialog) return null;

  const { kind, title, message, confirmLabel, cancelLabel, destructive } = dialog;

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={styles.card}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.actions}>
          {kind === 'confirm' ? (
            <>
              <ActionButton
                label={cancelLabel}
                variant="ghost"
                onPress={onCancel}
                style={styles.button}
              />
              <ActionButton
                label={confirmLabel}
                variant={destructive ? 'danger' : 'solid'}
                onPress={onConfirm}
                style={styles.button}
              />
            </>
          ) : (
            <ActionButton
              label={confirmLabel}
              variant="solid"
              onPress={onConfirm}
              style={styles.button}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [openSheets, setOpenSheets] = useState(0);
  const resolverRef = useRef(null);

  const settle = useCallback((result) => {
    setDialog(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(result);
  }, []);

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setDialog({
      kind: 'confirm',
      title: options.title || '',
      message: options.message || '',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      destructive: !!options.destructive,
    });
  }), []);

  const alert = useCallback((options = {}) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setDialog({
      kind: 'alert',
      title: options.title || '',
      message: options.message || '',
      confirmLabel: options.confirmLabel || 'OK',
      cancelLabel: 'Cancel',
      destructive: false,
    });
  }), []);

  const registerSheet = useCallback(() => setOpenSheets((count) => count + 1), []);
  const unregisterSheet = useCallback(() => setOpenSheets((count) => Math.max(0, count - 1)), []);

  const api = useMemo(() => ({
    confirm,
    alert,
    dialog,
    settle,
    registerSheet,
    unregisterSheet,
    hasOpenSheet: openSheets > 0,
  }), [confirm, alert, dialog, settle, registerSheet, unregisterSheet, openSheets]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {/* Only present from the root when no themed sheet is on screen. When a
          ModalSheet is open it renders the dialog itself (see ModalSheet). */}
      <Modal
        transparent
        statusBarTranslucent
        visible={!!dialog && openSheets === 0}
        animationType="fade"
        onRequestClose={() => settle(false)}
      >
        <DialogBody
          dialog={dialog}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      </Modal>
    </DialogContext.Provider>
  );
}

// Public hook for screens: themed confirm() / alert().
export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return useMemo(
    () => ({ confirm: context.confirm, alert: context.alert }),
    [context.confirm, context.alert],
  );
}

// Internal hook for ModalSheet to host the dialog above itself.
export function useDialogHost() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogHost must be used within a DialogProvider');
  }
  return context;
}

const makeStyles = (theme) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.backgroundAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  message: {
    color: theme.colors.tertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
  },
});
