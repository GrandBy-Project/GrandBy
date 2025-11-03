/**
 * 비밀번호 변경 화면
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, Button, Input } from '../components';
import { validatePassword } from '../utils/validation';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useFontSizeStore } from '../store/fontSizeStore';
import { useResponsive, getResponsiveFontSize, getResponsivePadding } from '../hooks/useResponsive';
import { Colors } from '../constants/Colors';

export const ChangePasswordScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { fontSizeLevel } = useFontSizeStore();
  const { scale } = useResponsive();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 확인 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: '확인',
  });

  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleChangePassword = async () => {
    try {
      // 입력값 검증
      if (!currentPassword) {
        setConfirmModal({
          visible: true,
          title: '입력 오류',
          message: '현재 비밀번호를 입력해주세요.',
          confirmText: '확인',
          onConfirm: () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
          },
        });
        return;
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        setConfirmModal({
          visible: true,
          title: '입력 오류',
          message: passwordValidation.message,
          confirmText: '확인',
          onConfirm: () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
          },
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        setConfirmModal({
          visible: true,
          title: '입력 오류',
          message: '새 비밀번호가 일치하지 않습니다.',
          confirmText: '확인',
          onConfirm: () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
          },
        });
        return;
      }

      if (currentPassword === newPassword) {
        setConfirmModal({
          visible: true,
          title: '입력 오류',
          message: '현재 비밀번호와 새 비밀번호가 동일합니다.',
          confirmText: '확인',
          onConfirm: () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
          },
        });
        return;
      }

      setIsLoading(true);

      await apiClient.put('/api/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      // 비밀번호 변경 성공 후 로그아웃
      setConfirmModal({
        visible: true,
        title: '비밀번호 변경 완료',
        message: '비밀번호가 성공적으로 변경되었습니다.\n보안을 위해 다시 로그인해주세요.',
        confirmText: '확인',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          // 입력값 초기화
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          
          // 로그아웃 처리
          await logout();
          router.replace('/');
        },
      });
    } catch (error: any) {
      console.error('비밀번호 변경 오류:', error);
      const errorMessage = error.response?.data?.detail || '비밀번호 변경에 실패했습니다.';
      setConfirmModal({
        visible: true,
        title: '오류',
        message: errorMessage,
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 반응형 패딩
  const contentPadding = getResponsivePadding(24, scale);

  return (
    <View style={styles.container}>
      <Header 
        title="비밀번호 변경" 
        showMenuButton={true}
      />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: contentPadding,
            paddingBottom: Math.max(insets.bottom, 40) + 100,
          }}
        >
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#1976D2" />
          <Text style={styles.infoText}>
            계정 보안을 위해 정기적으로 비밀번호를 변경해주세요.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="현재 비밀번호"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="현재 비밀번호"
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
          />

          <View style={styles.divider} />

          <Input
            ref={newPasswordRef}
            label="새 비밀번호"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="6자 이상"
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          />

          <Input
            ref={confirmPasswordRef}
            label="새 비밀번호 확인"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="새 비밀번호 재입력"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleChangePassword}
          />

          <Text style={styles.helperText}>
            • 6자 이상 입력해주세요{'\n'}
            • 현재 비밀번호와 다른 비밀번호를 사용해주세요{'\n'}
            • 안전한 비밀번호를 위해 영문, 숫자, 특수문자를 조합하는 것을 권장합니다{'\n'}
            • 비밀번호 변경 후 보안을 위해 자동으로 로그아웃됩니다
          </Text>

          <Button
            title={isLoading ? '변경 중...' : '비밀번호 변경'}
            onPress={handleChangePassword}
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* 확인 모달 */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable style={styles.commonModalContainer} onPress={() => {}}>
            <Text style={[styles.commonModalTitle, { fontSize: getResponsiveFontSize(18, scale) }]}>
              {confirmModal.title}
            </Text>
            <Text style={[styles.commonModalText, { fontSize: getResponsiveFontSize(15, scale), marginBottom: 16 }]}>
              {confirmModal.message}
            </Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalConfirmButton]}
                onPress={confirmModal.onConfirm || (() => setConfirmModal(prev => ({ ...prev, visible: false })))}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmModalConfirmButtonText}>
                  {confirmModal.confirmText || '확인'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    // padding은 동적으로 적용
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
    marginLeft: 12,
  },
  form: {
    gap: 8,
  },
  divider: {
    height: 24,
  },
  helperText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  // 공통 모달 스타일 (GlobalAlertProvider 디자인 참고)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  commonModalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  commonModalTitle: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    // fontSize는 동적으로 적용
  },
  commonModalText: {
    color: '#374151',
    lineHeight: 22,
    // fontSize는 동적으로 적용
  },
  confirmModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  confirmModalButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  confirmModalConfirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmModalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

