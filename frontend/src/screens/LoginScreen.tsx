/**
 * 로그인 화면 - 새 디자인
 * 메인 컬러: #40B59F
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAlert } from '../components/GlobalAlertProvider';

export const LoginScreen = () => {
  const router = useRouter();
  const { login, isLoading, error } = useAuthStore();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { show } = useAlert();
  
  // Input refs
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);

  // 간단 스케일 헬퍼(기준 375x812)
  const guidelineBaseWidth = 375;
  const guidelineBaseHeight = 812;
  const scale = (size: number) => (screenWidth / guidelineBaseWidth) * size;
  const verticalScale = (size: number) => (screenHeight / guidelineBaseHeight) * size;
  const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;


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
      show('로그인 완료', 'GrandBy에 오신 것을 환영합니다.');
      router.replace('/home');
    } catch (err: any) {
      const message =
        error || err?.message || '아이디 또는 비밀번호가 일치하지 않습니다.';
      show('로그인 실패', message);
    }
  };

  const goToRegister = () => {
    router.push('/register');
  };

  const goToFindAccount = () => {
    router.push('/find-account');
  };

  const handleKakaoLogin = () => {
    show('준비 중', '카카오 로그인은 준비 중입니다.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ backgroundColor: '#FFFFFF' }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 로고 (배경 없는 로고) - 반응형 */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/grandby_noBackground-logo.png')}
            style={{
              width: Math.min(screenWidth * 0.9, 520),
              // 실제 이미지 비율 유지
              aspectRatio: 480 / 200,
              height: undefined,
              marginBottom: verticalScale(-140),
              maxWidth: '100%',
            }}
            resizeMode="contain"
          />
        </View>

        {/* 중간에 기존 로고 배치 - 반응형 */}
        <View style={styles.middleLogoSection}>
          <Image
            source={require('../../assets/grandby-logo.png')}
            style={{
              width: Math.min(screenWidth * 0.8, 340),
              aspectRatio: 300 / 130,
              height: undefined,
              maxWidth: '100%',
            }}
            resizeMode="contain"
          />
        </View>

        {/* 환영 메시지 - 중간 로고 아래, 입력 폼 위 */}
        <View style={styles.welcomeSection}
        >
          <Text style={[styles.welcomeText, { fontSize: moderateScale(22), lineHeight: moderateScale(32) }]}>오늘도 함께해요!</Text>
        </View>

        {/* 입력 폼 */}
        <View style={styles.formSection}>
          <View style={styles.narrow}>
            <Input
              ref={emailRef}
              label=""
              value={email}
              onChangeText={setEmail}
              placeholder="아이디(이메일)"
              keyboardType="email-address"
              autoCapitalize="none"
              error={emailError}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              inputStyle={{ fontSize: moderateScale(18) }}
            />

            <Input
              ref={passwordRef}
              label=""
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              secureTextEntry
              error={passwordError}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              inputStyle={{ fontSize: moderateScale(18) }}
            />
          </View>

          {/* 자동 로그인 체크박스 (아이콘 기반) */}
          <TouchableOpacity
            style={styles.autoLoginContainer}
            onPress={() => setAutoLogin(!autoLogin)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {autoLogin ? (
              <MaterialCommunityIcons
                name="checkbox-marked"
                size={28}
                color={Colors.primary}
                style={styles.checkboxIcon}
              />
            ) : (
              <MaterialCommunityIcons
                name="checkbox-blank-outline"
                size={28}
                color={Colors.border}
                style={styles.checkboxIcon}
              />
            )}
            <Text style={[styles.autoLoginText, { fontSize: moderateScale(16) }]}>자동 로그인</Text>
          </TouchableOpacity>

          {/* 로그인 버튼 */}
          <Button
            title="로그인"
            onPress={handleLogin}
            loading={isLoading}
            style={{ alignSelf: 'center', width: '90%' }}
            textStyle={{ fontSize: moderateScale(20) }}
          />

          {/* 계정 찾기 / 회원가입 */}
          <View style={styles.linkContainer}>
            <TouchableOpacity onPress={goToFindAccount}>
              <Text style={[styles.linkText, { fontSize: moderateScale(18) }]}>계정 찾기</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={goToRegister}>
              <Text style={[styles.linkText, { fontSize: moderateScale(18) }]}>회원가입</Text>
            </TouchableOpacity>
          </View>

          {/* 카카오 로그인 영역 제거됨 */}
        </View>

        {/* 전역 알림은 GlobalAlertProvider에서 렌더링됩니다. */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // 흰색 배경
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 80,
    marginTop: 10,
  },
  brandKorean: {
    marginTop: 8,
    bottom: -20,
    fontSize: 40,
    fontWeight: 'bold',
    fontFamily: 'Pretendard-Bold',
    color: Colors.primary,
    letterSpacing: 1,
  },
  middleLogoSection: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 12,
  },
  welcomeSection: {
    marginTop: -8,
    marginBottom: 12,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    color: Colors.primary,
    lineHeight: 32,
  },
  formSection: {
    gap: 12,
  },
  narrow: {
    width: '90%',
    alignSelf: 'center',
  },
  autoLoginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 6,
    width: '90%',
    alignSelf: 'center',
  },
  checkboxIcon: {
    marginRight: 8,
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
    fontSize: 12,
    fontWeight: 'bold',
  },
  autoLoginText: {
    fontSize: 16,
    color: '#000000',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '700',
  },
  divider: {
    width: 1.5,
    height: 14,
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
  kakaoButton: {
    width: '100%',
    height: 50,
  },
});
