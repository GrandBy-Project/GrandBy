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
  Alert,
  Image,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { getKakaoLoginUrl, kakaoCallback, KakaoUserInfo } from '../api/auth';

// WebBrowser 세션 완료 처리
WebBrowser.maybeCompleteAuthSession();

export const LoginScreen = () => {
  const router = useRouter();
  const { login, isLoading, error } = useAuthStore();
  
  // Input refs
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  
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

  const handleKakaoLogin = async () => {
    try {
      console.log('🔵 카카오 로그인 시작');
      
      // 1. 백엔드에서 카카오 로그인 URL 받기
      const { authorization_url } = await getKakaoLoginUrl();
      console.log('🔵 카카오 인증 URL:', authorization_url);
      
      // 2. WebBrowser로 카카오 로그인 페이지 열기
      const result = await WebBrowser.openAuthSessionAsync(
        authorization_url,
        'grandby://kakao-callback' // Deep Link (나중에 설정)
      );
      
      console.log('🔵 WebBrowser 결과:', result);
      
      if (result.type === 'success' && result.url) {
        // 3. URL에서 code 파라미터 추출
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        
        if (!code) {
          Alert.alert('오류', '인증 코드를 받지 못했습니다.');
          return;
        }
        
        console.log('🔵 인증 코드:', code);
        
        // 4. 백엔드에 code 전달
        const response = await kakaoCallback(code);
        
        // 5-1. 기존 사용자 - 자동 로그인
        if ('access_token' in response) {
          console.log('✅ 기존 사용자 로그인 성공');
          Alert.alert('환영합니다!', '카카오 로그인에 성공했습니다.');
          router.replace('/home');
        }
        // 5-2. 신규 사용자 - 추가 정보 입력 화면으로 이동
        else {
          console.log('🆕 신규 사용자 - 추가 정보 입력 필요');
          // @ts-ignore - router params
          router.push({
            pathname: '/kakao-register',
            params: { kakaoUserInfo: JSON.stringify(response) }
          });
        }
      } else if (result.type === 'cancel') {
        console.log('❌ 사용자가 카카오 로그인을 취소했습니다.');
      }
    } catch (error: any) {
      console.error('❌ 카카오 로그인 실패:', error);
      Alert.alert(
        '카카오 로그인 실패',
        error?.response?.data?.detail || error?.message || '카카오 로그인 중 오류가 발생했습니다.'
      );
    }
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
            source={require('../../assets/GranbyLogoMed.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* 환영 메시지 */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>오늘도 함께해요!</Text>
        </View>

        {/* 입력 폼 */}
        <View style={styles.formSection}>
          <Input
            inputRef={emailRef}
            label=""
            value={email}
            onChangeText={setEmail}
            placeholder="아이디"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Input
            inputRef={passwordRef}
            label=""
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            secureTextEntry
            error={passwordError}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
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
          <TouchableOpacity onPress={handleKakaoLogin} activeOpacity={0.8}>
            <Image
              source={require('../../assets/kakao_login_medium_wide.png')}
              style={styles.kakaoButton}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
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
  logo: {
    width: 300,
    height: 130,
  },
  welcomeSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
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
    fontSize: 12,
    fontWeight: 'bold',
  },
  autoLoginText: {
    fontSize: 14,
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
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
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
