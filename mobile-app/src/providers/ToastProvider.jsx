import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  CheckCircle,
  X,
  XCircle,
} from 'lucide-react-native';

const ToastContext = createContext(null);
const CLOSE_ANIMATION_MS = 300;

function ToastItem({ toast, onClose }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(50)).current;
  const collapse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: CLOSE_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: CLOSE_ANIMATION_MS,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: false,
      }),
    ]).start();
  }, [opacity, translateX]);

  useEffect(() => {
    if (!toast.isClosing) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: CLOSE_ANIMATION_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(translateX, {
        toValue: 20,
        duration: CLOSE_ANIMATION_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(collapse, {
        toValue: 0,
        duration: CLOSE_ANIMATION_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [collapse, opacity, toast.isClosing, translateX]);

  const isSuccess = toast.type === 'success';
  const isWarning = toast.type === 'warning';
  const Icon = isSuccess ? CheckCircle : isWarning ? AlertTriangle : XCircle;

  return (
    <Animated.View
      style={[
        styles.toastItem,
        isSuccess ? styles.toastSuccess : null,
        toast.type === 'error' ? styles.toastError : null,
        isWarning ? styles.toastWarning : null,
        {
          opacity,
          transform: [{ translateX }],
          maxHeight: collapse.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 100],
          }),
          paddingTop: collapse.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 12],
          }),
          paddingBottom: collapse.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 12],
          }),
          marginBottom: collapse.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 10],
          }),
          borderWidth: collapse.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
          }),
        },
      ]}
    >
      <BlurView
        intensity={25}
        tint="dark"
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.toastContent}>
        <View style={styles.toastIcon}>
          <Icon
            size={18}
            color={isSuccess ? '#2ecc71' : isWarning ? '#facc15' : '#ff4d4d'}
            strokeWidth={1.8}
          />
        </View>

        <Text
          style={[
            styles.toastMessage,
            isSuccess ? styles.toastMessageSuccess : null,
            toast.type === 'error' ? styles.toastMessageError : null,
            isWarning ? styles.toastMessageWarning : null,
          ]}
        >
          {toast.message}
        </Text>

        <Pressable
          hitSlop={8}
          onPress={() => onClose(toast.id)}
          style={({ pressed }) => [
            styles.toastClose,
            pressed ? styles.toastClosePressed : null,
          ]}
        >
          <X
            size={14}
            color={isSuccess ? '#ffffff' : isWarning ? '#facc15' : '#ff4d4d'}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState([]);
  const dismissTimersRef = useRef(new Map());
  const cleanupTimersRef = useRef(new Map());

  const clearTimer = useCallback((store, id) => {
    const timer = store.current.get(id);
    if (!timer) return;

    clearTimeout(timer);
    store.current.delete(id);
  }, []);

  const purgeToast = useCallback((id) => {
    clearTimer(dismissTimersRef, id);
    clearTimer(cleanupTimersRef, id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, [clearTimer]);

  const removeToast = useCallback((id) => {
    clearTimer(dismissTimersRef, id);

    setToasts((current) => current.map((toast) => (
      toast.id === id ? { ...toast, isClosing: true } : toast
    )));

    if (!cleanupTimersRef.current.has(id)) {
      const timer = setTimeout(() => {
        purgeToast(id);
      }, CLOSE_ANIMATION_MS);

      cleanupTimersRef.current.set(id, timer);
    }
  }, [clearTimer, purgeToast]);

  const addToast = useCallback((message, type = 'success', duration = 2000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setToasts((current) => [...current, {
      id,
      message,
      type,
      isClosing: false,
    }]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);

      dismissTimersRef.current.set(id, timer);
    }
  }, [removeToast]);

  useEffect(() => () => {
    dismissTimersRef.current.forEach((timer) => clearTimeout(timer));
    cleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
    dismissTimersRef.current.clear();
    cleanupTimersRef.current.clear();
  }, []);

  const value = useMemo(() => addToast, [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[
          styles.toastContainer,
          {
            top: insets.top + 20,
            right: 20,
            left: 20,
          },
        ]}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
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
  toastContainer: {
    position: 'absolute',
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  toastItem: {
    paddingHorizontal: 20,
    minWidth: 250,
    width: '100%',
    maxWidth: 350,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderStyle: 'dashed',
    position: 'relative',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toastSuccess: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  toastError: {
    borderColor: '#ff4d4d',
    borderRadius: 5,
  },
  toastWarning: {
    borderColor: '#facc15',
    borderRadius: 5,
  },
  toastIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  toastMessageSuccess: {
    color: '#ffffff',
  },
  toastMessageError: {
    color: '#ff4d4d',
  },
  toastMessageWarning: {
    color: '#facc15',
  },
  toastClose: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  toastClosePressed: {
    opacity: 0.7,
  },
});
