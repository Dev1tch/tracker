import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 2600) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setToasts((current) => [...current, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const value = useMemo(() => addToast, [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.toastViewport}>
        {toasts.map((toast) => (
          <Pressable
            key={toast.id}
            onPress={() => removeToast(toast.id)}
            style={[
              styles.toast,
              toast.type === 'error' ? styles.toastError : null,
              toast.type === 'warning' ? styles.toastWarning : null,
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  toastViewport: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 70,
    gap: 10,
    zIndex: 100,
  },
  toast: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(24, 44, 67, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(79, 213, 163, 0.3)',
  },
  toastError: {
    borderColor: 'rgba(251, 113, 133, 0.4)',
  },
  toastWarning: {
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  toastText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
