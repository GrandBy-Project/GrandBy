import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

type AlertState = {
  visible: boolean;
  title: string;
  message: string;
};

type AlertContextValue = {
  show: (title: string, message: string) => void;
  hide: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export const useAlert = (): AlertContextValue => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within GlobalAlertProvider');
  return ctx;
};

export const GlobalAlertProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AlertState>({ visible: false, title: '', message: '' });

  const show = useCallback((title: string, message: string) => {
    setState({ visible: true, title, message });
  }, []);

  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

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
              <TouchableOpacity style={styles.modalButton} onPress={hide} activeOpacity={0.8}>
                <Text style={styles.modalButtonText}>확인</Text>
              </TouchableOpacity>
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
    alignItems: 'flex-end',
  },
  modalButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});


