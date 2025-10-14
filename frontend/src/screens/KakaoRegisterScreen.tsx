/**
 * 카카오 로그인 추가 정보 입력 화면
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Colors } from '../constants/Colors';
import { kakaoRegister, KakaoUserInfo, KakaoRegisterRequest } from '../api/auth';
import { validateEmail, validatePassword, validatePhoneNumber, validateName } from '../utils/validation';

export const KakaoRegisterScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // 카카오 사용자 정보 파싱
  const [kakaoUserInfo, setKakaoUserInfo] = useState<KakaoUserInfo | null>(null);
  
  useEffect(() => {
    try {
      if (params.kakaoUserInfo && typeof params.kakaoUserInfo === 'string') {
        const parsed = JSON.parse(params.kakaoUserInfo);
        setKakaoUserInfo(parsed);
        
        // 카카오에서 받은 정보로 초기값 설정
        if (parsed.email) setEmail(parsed.email);
        if (parsed.name) setName(parsed.name);
        if (parsed.phone_number) setPhoneNumber(parsed.phone_number);
      }
    } catch (error) {
      console.error('카카오 정보 파싱 실패:', error);
      Alert.alert('오류', '카카오 정보를 불러올 수 없습니다.');
      router.back();
    }
  }, [params]);
  
  // Input refs
  const emailRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const passwordConfirmRef = useRef<TextInput>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<'elderly' | 'caregiver' | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Error state
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [roleError, setRoleError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;
    
    // 이메일 검증
    if (!email.trim()) {
      setEmailError('이메일을 입력해주세요');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('올바른 이메일 형식이 아닙니다');
      isValid = false;
    } else {
      setEmailError('');
    }
    
    // 이름 검증
    if (!name.trim()) {
      setNameError('이름을 입력해주세요');
      isValid = false;
    } else if (!validateName(name)) {
      setNameError('이름은 2-50자로 입력해주세요');
      isValid = false;
    } else {
      setNameError('');
    }
    
    // 전화번호 검증
    if (!phoneNumber.trim()) {
      setPhoneError('전화번호를 입력해주세요');
      isValid = false;
    } else if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError('올바른 전화번호 형식이 아닙니다 (예: 01012345678)');
      isValid = false;
    } else {
      setPhoneError('');
    }
    
    // 역할 검증
    if (!role) {
      setRoleError('역할을 선택해주세요');
      isValid = false;
    } else {
      setRoleError('');
    }
    
    // 비밀번호 검증
    if (!password) {
      setPasswordError('비밀번호를 입력해주세요');
      isValid = false;
    } else if (!validatePassword(password)) {
      setPasswordError('비밀번호는 8자 이상이어야 합니다');
      isValid = false;
    } else {
      setPasswordError('');
    }
    
    // 비밀번호 확인 검증
    if (!passwordConfirm) {
      setPasswordConfirmError('비밀번호를 다시 입력해주세요');
      isValid = false;
    } else if (password !== passwordConfirm) {
      setPasswordConfirmError('비밀번호가 일치하지 않습니다');
      isValid = false;
    } else {
      setPasswordConfirmError('');
    }
    
    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    if (!kakaoUserInfo) {
      Alert.alert('오류', '카카오 정보를 찾을 수 없습니다.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const data: KakaoRegisterRequest = {
        kakao_id: kakaoUserInfo.kakao_id,
        email: email.trim(),
        name: name.trim(),
        phone_number: phoneNumber.trim(),
        role: role!,
        password: password,
        birth_date: kakaoUserInfo.birth_date,
        gender: kakaoUserInfo.gender,
      };
      
      await kakaoRegister(data);
      
      Alert.alert(
        '회원가입 완료',
        '카카오 로그인으로 회원가입이 완료되었습니다!',
        [
          {
            text: '확인',
            onPress: () => router.replace('/home'),
          },
        ]
      );
    } catch (error: any) {
      console.error('카카오 회원가입 실패:', error);
      Alert.alert(
        '회원가입 실패',
        error?.response?.data?.detail || error?.message || '회원가입에 실패했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!kakaoUserInfo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>카카오 정보를 불러오는 중...</Text>
      </View>
    );
  }

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
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>추가 정보 입력</Text>
          <Text style={styles.subtitle}>
            카카오에서 받은 정보를 확인하고{'\n'}
            추가 정보를 입력해주세요
          </Text>
          {!kakaoUserInfo.email && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ 카카오 계정에 이메일이 없어 직접 입력이 필요합니다
              </Text>
            </View>
          )}
        </View>

        {/* 폼 */}
        <View style={styles.formSection}>
          {/* 이메일 */}
          <Input
            inputRef={emailRef}
            label="이메일 *"
            value={email}
            onChangeText={setEmail}
            placeholder="이메일 주소"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
            returnKeyType="next"
            onSubmitEditing={() => nameRef.current?.focus()}
          />

          {/* 이름 */}
          <Input
            inputRef={nameRef}
            label="이름 *"
            value={name}
            onChangeText={setName}
            placeholder="이름"
            error={nameError}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />

          {/* 전화번호 */}
          <Input
            inputRef={phoneRef}
            label="전화번호 *"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="01012345678"
            keyboardType="phone-pad"
            error={phoneError}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          {/* 역할 선택 */}
          <View style={styles.roleSection}>
            <Text style={styles.roleLabel}>역할 선택 *</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'elderly' && styles.roleButtonActive,
                ]}
                onPress={() => {
                  setRole('elderly');
                  setRoleError('');
                }}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'elderly' && styles.roleButtonTextActive,
                  ]}
                >
                  어르신
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'caregiver' && styles.roleButtonActive,
                ]}
                onPress={() => {
                  setRole('caregiver');
                  setRoleError('');
                }}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'caregiver' && styles.roleButtonTextActive,
                  ]}
                >
                  보호자
                </Text>
              </TouchableOpacity>
            </View>
            {roleError ? <Text style={styles.errorText}>{roleError}</Text> : null}
          </View>

          {/* 비밀번호 */}
          <Input
            inputRef={passwordRef}
            label="비밀번호 *"
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호 (8자 이상)"
            secureTextEntry
            error={passwordError}
            returnKeyType="next"
            onSubmitEditing={() => passwordConfirmRef.current?.focus()}
          />

          {/* 비밀번호 확인 */}
          <Input
            inputRef={passwordConfirmRef}
            label="비밀번호 확인 *"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="비밀번호 확인"
            secureTextEntry
            error={passwordConfirmError}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          {/* 안내 문구 */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 카카오 로그인 사용자도 보안을 위해 비밀번호 설정이 필요합니다.
            </Text>
          </View>

          {/* 회원가입 버튼 */}
          <Button
            title="회원가입 완료"
            onPress={handleRegister}
            loading={isLoading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  formSection: {
    gap: 16,
  },
  roleSection: {
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  roleButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  roleButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: Colors.textWhite,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 6,
  },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
});

