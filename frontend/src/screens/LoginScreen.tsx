/**
 * 로그인 화면 - 새 디자인
 * 메인 컬러: #40B59F
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
  Image,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';

export const LoginScreen = () => {
  const router = useRouter();
  const { login, isLoading, error } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    // 이메일 검증
    if (!email.trim()) {
      setEmailError('아이디를 입력해주세요');
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
      Alert.alert('환영합니다!', '로그인되었습니다.');
      router.replace('/home');
    } catch (err: any) {
      Alert.alert(
        '로그인 실패',
        error || err?.message || '로그인에 실패했습니다.'
      );
    }
  };

  const goToRegister = () => {
    router.push('/register');
  };

  const goToFindAccount = () => {
    Alert.alert('준비 중', '계정 찾기 기능은 준비 중입니다.');
  };

  const handleKakaoLogin = () => {
    Alert.alert('준비 중', '카카오 로그인은 준비 중입니다.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 로고 섹션 */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/GrandByLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>소중한 부모님 곁에 함께</Text>
        </View>

        {/* 환영 메시지 */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>오늘도 함께해요!</Text>
        </View>

        {/* 입력 폼 */}
        <View style={styles.formSection}>
          <Input
            label=""
            value={email}
            onChangeText={setEmail}
            placeholder="아이디"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
          />

          <Input
            label=""
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            secureTextEntry
            error={passwordError}
          />

          {/* 자동 로그인 체크박스 */}
          <TouchableOpacity
            style={styles.autoLoginContainer}
            onPress={() => setAutoLogin(!autoLogin)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, autoLogin && styles.checkboxChecked]}>
              {autoLogin && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.autoLoginText}>자동 로그인</Text>
          </TouchableOpacity>

          {/* 로그인 버튼 */}
          <Button
            title="로그인"
            onPress={handleLogin}
            loading={isLoading}
          />

          {/* 계정 찾기 / 회원가입 */}
          <View style={styles.linkContainer}>
            <TouchableOpacity onPress={goToFindAccount}>
              <Text style={styles.linkText}>계정 찾기</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={goToRegister}>
              <Text style={styles.linkText}>회원가입</Text>
            </TouchableOpacity>
          </View>

          {/* 구분선 */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
          </View>

          {/* 카카오 로그인 */}
          <Button
            title="카카오 로그인"
            onPress={handleKakaoLogin}
            variant="kakao"
            icon={<Text style={styles.kakaoIcon}>💬</Text>}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 200,
    height: 100,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  welcomeSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  formSection: {
    gap: 12,
  },
  autoLoginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: 'bold',
  },
  autoLoginText: {
    fontSize: 14,
    color: Colors.text,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  separator: {
    marginVertical: 24,
  },
  separatorLine: {
    height: 1,
    backgroundColor: Colors.border,
  },
  kakaoIcon: {
    fontSize: 20,
  },
});
