/**
 * 로그인 화면
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useRouter } from 'expo-router';
import { UserRole } from '../types';

export const LoginScreen = () => {
  const router = useRouter();
  const { login, isLoading, error, setUser } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    // 이메일 검증
    if (!email.trim()) {
      setEmailError('이메일을 입력해주세요');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('올바른 이메일 형식이 아닙니다');
      isValid = false;
    }

    // 비밀번호 검증
    if (!password) {
      setPasswordError('비밀번호를 입력해주세요');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      await login(email, password);
      Alert.alert('성공', '로그인되었습니다!');
      router.replace('/home');
    } catch (err: any) {
      Alert.alert('로그인 실패', error || '로그인에 실패했습니다.');
    }
  };

  const goToRegister = () => {
    router.push('/register');
  };

  // 테스트용 - 어르신 화면으로 이동
  const goToElderlyScreen = () => {
    setUser({
      user_id: 'test-elderly-1',
      email: 'elderly@test.com',
      name: '김정순',
      role: UserRole.ELDERLY,
      phone_number: '010-1234-5678',
      is_active: true,
      created_at: new Date().toISOString(),
    });
    router.replace('/home');
  };

  // 테스트용 - 보호자 화면으로 이동
  const goToGuardianScreen = () => {
    setUser({
      user_id: 'test-guardian-1',
      email: 'guardian@test.com',
      name: '김보호',
      role: UserRole.CAREGIVER,
      phone_number: '010-9876-5432',
      is_active: true,
      created_at: new Date().toISOString(),
    });
    router.replace('/home');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Grandby</Text>
          <Text style={styles.subtitle}>어르신과 보호자를 연결하는 AI 케어 서비스</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="이메일"
            value={email}
            onChangeText={setEmail}
            placeholder="이메일을 입력하세요"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
          />

          <Input
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호를 입력하세요"
            secureTextEntry
            error={passwordError}
          />

          <Button
            title="로그인"
            onPress={handleLogin}
            loading={isLoading}
          />

          <Button
            title="회원가입"
            onPress={goToRegister}
            variant="outline"
          />

          {/* 테스트용 버튼들 */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는 테스트하기</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="👴 어르신 화면 보기"
            onPress={goToElderlyScreen}
            variant="outline"
          />

          <Button
            title="👨‍👩‍👧 보호자 화면 보기"
            onPress={goToGuardianScreen}
            variant="outline"
          />
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999999',
  },
  version: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 12,
    marginTop: 32,
  },
});

