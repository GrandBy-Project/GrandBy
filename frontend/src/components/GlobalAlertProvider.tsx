import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useErrorStore } from '../store/errorStore';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertState = {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
};

type AlertContextValue = {
  show: (title: string, message: string, buttons?: AlertButton[]) => void;
  hide: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export const useAlert = (): AlertContextValue => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within GlobalAlertProvider');
  return ctx;
};

export const GlobalAlertProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AlertState>({ visible: false, title: '', message: '', buttons: [] });
  const { error, clearError } = useErrorStore();

  const show = useCallback((title: string, message: string, buttons?: AlertButton[]) => {
    // 버튼이 제공되지 않으면 기본 "확인" 버튼 사용
    const defaultButtons: AlertButton[] = buttons || [{ text: '확인' }];
    setState({ visible: true, title, message, buttons: defaultButtons });
  }, []);

  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  // ✅ errorStore의 error가 변경되면 자동으로 팝업 표시
  useEffect(() => {
    if (error) {
      show(error.title, error.message);
      clearError();
    }
  }, [error, show, clearError]);

  return (
    <AlertContext.Provider value={value}>
      {children}

      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        onRequestClose={hide}
      >
        <Pressable style={styles.modalBackdrop} onPress={hide}>
          <Pressable style={styles.modalContainer} onPress={() => {}}>
            <Text style={styles.modalTitle}>{state.title}</Text>
            <Text style={styles.modalMessage}>{state.message}</Text>
            <View style={styles.modalActions}>
              {state.buttons.map((button, index) => {
                const handlePress = () => {
                  button.onPress?.();
                  hide();
                };
                
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.modalButton,
                      isDestructive && styles.modalButtonDestructive,
                      isCancel && styles.modalButtonCancel,
                      index > 0 && styles.modalButtonSpacing,
                    ]}
                    onPress={handlePress}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        isDestructive && styles.modalButtonTextDestructive,
                        isCancel && styles.modalButtonTextCancel,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  modalButtonSpacing: {
    marginLeft: 8,
  },
  modalButtonDestructive: {
    backgroundColor: '#EF4444',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButtonTextDestructive: {
    color: '#FFFFFF',
  },
  modalButtonTextCancel: {
    color: '#374151',
  },
});


