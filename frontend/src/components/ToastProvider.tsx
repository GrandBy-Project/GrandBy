// I will create the toast provider component.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface ToastOptions {
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
  hideToast: () => void;
}

interface ToastState {
  visible: boolean;
  message: string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const duration = options?.duration ?? 2000;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setToast({ visible: true, message });

    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [hideToast]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (toast.visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 16,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [opacity, translateY, toast.visible]);

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrapper,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          {toast.visible ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 72,
  },
  toast: {
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: '90%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
