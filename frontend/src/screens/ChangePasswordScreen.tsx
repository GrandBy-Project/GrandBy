/**
 * 비밀번호 변경 화면
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Header, Button, Input } from '../components';
import { validatePassword } from '../utils/validation';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useFontSizeStore } from '../store/fontSizeStore';

export const ChangePasswordScreen = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { fontSizeLevel } = useFontSizeStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleChangePassword = async () => {
    try {
      // 소셜 로그인 사용자 체크
      if (user?.auth_provider !== 'email') {
        Alert.alert(
          '비밀번호 변경 불가',
          '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.'
        );
        return;
      }

      // 입력값 검증
      if (!currentPassword) {
        Alert.alert('입력 오류', '현재 비밀번호를 입력해주세요.');
        return;
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        Alert.alert('입력 오류', passwordValidation.message);
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert('입력 오류', '새 비밀번호가 일치하지 않습니다.');
        return;
      }

      if (currentPassword === newPassword) {
        Alert.alert('입력 오류', '현재 비밀번호와 새 비밀번호가 동일합니다.');
        return;
      }

      setIsLoading(true);

      await apiClient.put('/api/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      Alert.alert(
        '비밀번호 변경 완료',
        '비밀번호가 성공적으로 변경되었습니다.',
        [
          {
            text: '확인',
            onPress: () => router.back(),
          },
        ]
      );

      // 입력값 초기화
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('비밀번호 변경 오류:', error);
      const errorMessage = error.response?.data?.detail || '비밀번호 변경에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="비밀번호 변경" 
        showMenuButton={true}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#1976D2" />
          <Text style={styles.infoText}>
            계정 보안을 위해 정기적으로 비밀번호를 변경해주세요.
          </Text>
        </View>

        {user?.auth_provider !== 'email' ? (
          <View style={styles.socialLoginNotice}>
            <Ionicons name="information-circle" size={48} color="#E65100" />
            <Text style={styles.socialLoginNoticeText}>
              소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.{'\n'}
              연동된 소셜 계정에서 비밀번호를 관리해주세요.
            </Text>
          </View>
        ) : (
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
              • 안전한 비밀번호를 위해 영문, 숫자, 특수문자를 조합하는 것을 권장합니다
            </Text>

            <Button
              title={isLoading ? '변경 중...' : '비밀번호 변경'}
              onPress={handleChangePassword}
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
            />
          </View>
        )}
      </ScrollView>
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
    padding: 24,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
    marginLeft: 12,
  },
  socialLoginNotice: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  socialLoginNoticeText: {
    fontSize: 15,
    color: '#E65100',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
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
});

