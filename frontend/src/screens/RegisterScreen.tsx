/**
 * 회원가입 화면 - 완전 개선 버전
 * 이메일 인증, 비밀번호 강도, 전화번호 필수, 약관 동의 포함
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, PasswordStrengthColors } from '../constants/Colors';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  validateEmail,
  validatePassword,
  checkPasswordStrength,
  validatePhoneNumber,
  formatPhoneNumber,
  validateName,
  validateVerificationCode,
  validateBirthDate,
  formatBirthDate,
} from '../utils/validation';
import { UserRole, Gender } from '../types';
import apiClient, { TokenManager } from '../api/client';
import { TermsModal } from '../components/TermsModal';
import { useAuthStore } from '../store/authStore';
import { useAlert } from '../components/GlobalAlertProvider';

export const RegisterScreen = () => {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { show } = useAlert();
  
  // Input refs
  const emailRef = useRef<TextInput>(null);
  const verificationCodeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const birthDateRef = useRef<TextInput>(null);
  
  // 폼 상태
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [role, setRole] = useState<UserRole>(UserRole.ELDERLY);
  
  // 에러 상태
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  // 약관 모달 상태
  const [showTermsModal, setShowTermsModal] = useState(false);

  // 반응형 스케일 헬퍼(기준 375x812)
  const guidelineBaseWidth = 375;
  const guidelineBaseHeight = 812;
  const scale = (size: number) => (screenWidth / guidelineBaseWidth) * size;
  const verticalScale = (size: number) => (screenHeight / guidelineBaseHeight) * size;
  const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

  // 타이머
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && codeSent) {
      show('인증 시간 만료', '인증 코드를 다시 발송해주세요.');
      setCodeSent(false);
    }
  }, [timeLeft]);

  // 비밀번호 강도
  const passwordStrength = password ? checkPasswordStrength(password) : null;

  // 이메일 중복 확인 및 인증 코드 발송
  const handleSendVerificationCode = async () => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setErrors({ ...errors, email: emailValidation.message });
      return;
    }

    try {
      setIsSendingCode(true);
      setErrors({ ...errors, email: '' });

      // 이메일 중복 확인
      const checkResponse = await apiClient.get('/api/auth/check-email', {
        params: { email }
      });

      if (!checkResponse.data.available) {
        setErrors({ ...errors, email: '이미 사용 중인 이메일입니다.' });
        return;
      }

      // 인증 코드 발송
      await apiClient.post('/api/auth/send-verification-code', { email });
      
      setCodeSent(true);
      setTimeLeft(300); // 5분
      show('인증 코드 발송', '이메일로 인증 코드가 발송되었습니다. 이메일 확인후 인증 번호를 입력해주세요.');
    } catch (error: any) {
      show('오류', error.response?.data?.detail || '인증 코드 발송에 실패했습니다.');
    } finally {
      setIsSendingCode(false);
    }
  };

  // 인증 코드 확인
  const handleVerifyCode = async () => {
    const codeValidation = validateVerificationCode(verificationCode);
    if (!codeValidation.valid) {
      setErrors({ ...errors, verificationCode: codeValidation.message });
      return;
    }

    try {
      setIsVerifyingCode(true);
      setErrors({ ...errors, verificationCode: '' });

      await apiClient.post('/api/auth/verify-email', {
        email,
        code: verificationCode
      });

      setEmailVerified(true);
      show('인증 완료', '이메일 인증이 완료되었습니다.');
    } catch (error: any) {
      setErrors({
        ...errors,
        verificationCode: error.response?.data?.detail || '인증 코드가 일치하지 않습니다.'
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // 전화번호 입력 처리
  const handlePhoneNumberChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };
  
  
  // 생년월일 입력 처리
  const handleBirthDateChange = (text: string) => {
    const formatted = formatBirthDate(text);
    setBirthDate(formatted);
  };

  // 폼 검증
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 이메일 인증 확인
    if (!emailVerified) {
      newErrors.email = '이메일 인증을 완료해주세요';
    }

    // 비밀번호 검증
    const pwdValidation = validatePassword(password);
    if (!pwdValidation.valid) {
      newErrors.password = pwdValidation.message;
    }

    // 비밀번호 확인
    if (password !== confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }

    // 이름 검증
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.message;
    }

    // 전화번호 검증 (필수)
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      newErrors.phoneNumber = phoneValidation.message;
    }
    
    
    // 생년월일 검증 (필수)
    const birthDateValidation = validateBirthDate(birthDate);
    if (!birthDateValidation.valid) {
      newErrors.birthDate = birthDateValidation.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 회원가입 버튼 클릭 (약관 모달 표시)
  const handleRegister = () => {
    if (!validateForm()) {
      show('입력 오류', '모든 항목을 올바르게 입력해주세요.');
      return;
    }

    // 약관 동의 모달 표시
    setShowTermsModal(true);
  };

  // 약관 동의 후 실제 회원가입
  const handleAgreeTerms = async () => {
    setShowTermsModal(false);
    
    try {
      setIsLoading(true);

      // 회원가입 요청 (토큰과 사용자 정보 반환)
      const response = await apiClient.post('/api/auth/register', {
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        phone_number: phoneNumber.replace(/[^\d]/g, ''),
        birth_date: birthDate,
        gender: gender,
        auth_provider: 'email',
      });

      // 토큰 저장 (자동 로그인)
      await TokenManager.saveTokens(
        response.data.access_token,
        response.data.refresh_token
      );

      // Zustand 스토어에 사용자 정보 저장
      setUser(response.data.user);

      // 회원가입 완료
      show('환영합니다!', '회원가입이 완료되었습니다.');
      router.replace('/home');
    } catch (error: any) {
      show('회원가입 실패', error.response?.data?.detail || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 고정 헤더 */}
      <View style={[styles.fixedHeader, { paddingTop: verticalScale(20), paddingBottom: verticalScale(12) }]}>
        <Text style={[styles.title, { fontSize: moderateScale(28) }]}>회원가입</Text>
        <Text style={[styles.subtitle, { fontSize: moderateScale(14) }]}>그랜비와 함께 시작해요</Text>
      </View>

      <ScrollView
        style={{ backgroundColor: '#FFFFFF' }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: verticalScale(100), flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 섹션 제거: 상단 고정 헤더로 대체 */}

        {/* 이메일 인증 */}
        <View style={styles.section}>
          <View style={styles.narrow}><Text style={styles.sectionTitle}>이메일 *</Text></View>
          <View style={[styles.emailContainer, styles.narrow]}>
            <View style={{ flex: 1 }}>
              <Input
                ref={emailRef}
                label=""
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                editable={!emailVerified}
                returnKeyType="next"
                onSubmitEditing={() => codeSent && !emailVerified && verificationCodeRef.current?.focus()}
              />
            </View>
            {!emailVerified && (
              <Button
                title={codeSent ? '재발송' : '인증하기'}
                onPress={handleSendVerificationCode}
                loading={isSendingCode}
                variant="outline"
                style={{ paddingHorizontal: 10 }}
              />
            )}
            {emailVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ 인증완료</Text>
              </View>
            )}
          </View>

          {/* 인증 코드 입력 */}
          {codeSent && !emailVerified && (
            <View style={[styles.codeContainer, styles.narrow]}>
              <View style={{ flex: 1 }}>
                <Input
                  ref={verificationCodeRef}
                  label=""
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="인증 코드 6자리"
                  keyboardType="numeric"
                  error={errors.verificationCode}
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyCode}
                />
              </View>
              <Button
                title="확인"
                onPress={handleVerifyCode}
                loading={isVerifyingCode}
                variant="outline"
              />
              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 비밀번호 */}
        <View style={styles.section}>
          <View style={styles.narrow}><Text style={styles.sectionTitle}>비밀번호 * (최소 6자)</Text></View>
          <View style={styles.narrow}>
            <Input
              ref={passwordRef}
              label=""
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              secureTextEntry
              error={errors.password}
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
          </View>
          
          {/* 비밀번호 강도 표시기 */}
          {password && passwordStrength && (
            <View style={[styles.strengthContainer, styles.narrow]}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4, 5, 6].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthBar,
                      level <= passwordStrength.score && {
                        backgroundColor: PasswordStrengthColors[passwordStrength.strength],
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                style={[
                  styles.strengthText,
                  { color: PasswordStrengthColors[passwordStrength.strength] },
                ]}
              >
                {passwordStrength.message}
              </Text>
            </View>
          )}

          <View style={styles.narrow}>
            <Input
              ref={confirmPasswordRef}
              label=""
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="비밀번호 확인"
              secureTextEntry
              error={errors.confirmPassword}
              returnKeyType="next"
              onSubmitEditing={() => nameRef.current?.focus()}
            />
          </View>
        </View>

        {/* 이름 */}
        <View style={styles.section}>
          <View style={styles.narrow}><Text style={styles.sectionTitle}>이름 *</Text></View>
          <View style={styles.narrow}>
            <Input
              ref={nameRef}
              label=""
              value={name}
              onChangeText={setName}
              placeholder="이름"
              error={errors.name}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>
        </View>

        {/* 전화번호 */}
        <View style={styles.section}>
          <View style={styles.narrow}><Text style={styles.sectionTitle}>전화번호 *</Text></View>
          <View>
            <View style={{ flex: 1 }}>
              <View style={styles.narrow}>
                <Input
                  ref={phoneRef}
                  label=""
                  value={phoneNumber}
                  onChangeText={handlePhoneNumberChange}
                  placeholder="010-1234-5678"
                  keyboardType="phone-pad"
                  error={errors.phoneNumber}
                  returnKeyType="next"
                />
              </View>
            </View>
          </View>
        </View>

        {/* 생년월일 */}
        <View style={styles.section}>
          <View style={styles.narrow}><Text style={styles.sectionTitle}>생년월일 * (YYYY-MM-DD)</Text></View>
          <View style={styles.narrow}>
            <Input
              ref={birthDateRef}
              label=""
              value={birthDate}
              onChangeText={handleBirthDateChange}
              placeholder="1990-01-01"
              keyboardType="numeric"
              error={errors.birthDate}
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={() => {}}
            />
          </View>
          
        </View>

        {/* 성별 */}
        <View style={styles.section}>
          <View style={styles.narrow}><Text style={styles.sectionTitle}>성별 *</Text></View>
          <View style={[styles.genderButtons, styles.narrow]}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === Gender.MALE && styles.genderButtonActive,
              ]}
              onPress={() => setGender(Gender.MALE)}
            >
              <Text style={[
                styles.genderButtonText,
                gender === Gender.MALE && styles.genderButtonTextActive,
              ]}>
                남성
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === Gender.FEMALE && styles.genderButtonActive,
              ]}
              onPress={() => setGender(Gender.FEMALE)}
            >
              <Text style={[
                styles.genderButtonText,
                gender === Gender.FEMALE && styles.genderButtonTextActive,
              ]}>
                여성
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 사용자 유형 */}
        <View style={styles.section}>
          <View style={styles.narrow}><Text style={styles.sectionTitle}>사용자 유형 *</Text></View>
          <View style={[styles.roleButtons, styles.narrow]}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === UserRole.ELDERLY && styles.roleButtonActive,
              ]}
              onPress={() => setRole(UserRole.ELDERLY)}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  role === UserRole.ELDERLY && styles.roleButtonTextActive,
                ]}
              >
                어르신
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === UserRole.CAREGIVER && styles.roleButtonActive,
              ]}
              onPress={() => setRole(UserRole.CAREGIVER)}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  role === UserRole.CAREGIVER && styles.roleButtonTextActive,
                ]}
              >
                보호자
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 회원가입 버튼 */}
        <View style={[styles.buttonContainer, styles.narrow]}>
          <Button
            title="회원가입"
            onPress={handleRegister}
            loading={isLoading}
          />
        </View>
      </ScrollView>

      {/* 약관 동의 모달 */}
      <TermsModal
        visible={showTermsModal}
        userRole={role}
        onAgree={handleAgreeTerms}
        onCancel={() => setShowTermsModal(false)}
      />
      
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
  },
  fixedHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  narrow: {
    width: '95%',
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
    
  },
  verifiedBadge: {
    minHeight: 54,
    paddingHorizontal: 16,
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    justifyContent: 'center',
  },
  verifiedText: {
    color: Colors.success,
    fontWeight: '600',
    fontSize: 16,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  timerContainer: {
    minHeight: 54,
    paddingHorizontal: 12,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    justifyContent: 'center',
  },
  timerText: {
    color: Colors.error,
    fontWeight: '600',
    fontSize: 16,
  },
  strengthContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: Colors.primaryPale,
  },
  roleButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  buttonContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
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
  genderButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryPale,
  },
  genderButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  genderButtonTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

