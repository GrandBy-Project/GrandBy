/**
 * 회원가입 화면 - 완전 개선 버전
 * 이메일 인증, 비밀번호 강도, 전화번호 필수, 약관 동의 포함
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
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
} from '../utils/validation';
import { UserRole } from '../types';
import apiClient from '../api/client';
import { TermsModal } from '../components/TermsModal';

export const RegisterScreen = () => {
  const router = useRouter();
  
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
  const [role, setRole] = useState<UserRole>(UserRole.ELDERLY);
  
  // 에러 상태
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  
  // 약관 모달 상태
  const [showTermsModal, setShowTermsModal] = useState(false);

  // 타이머
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && codeSent) {
      Alert.alert('인증 시간 만료', '인증 코드를 다시 발송해주세요.');
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
      Alert.alert(
        '인증 코드 발송',
        '이메일로 인증 코드가 발송되었습니다.\n개발 중에는 백엔드 콘솔을 확인해주세요.'
      );
    } catch (error: any) {
      Alert.alert('오류', error.response?.data?.detail || '인증 코드 발송에 실패했습니다.');
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
      Alert.alert('인증 완료', '이메일 인증이 완료되었습니다!');
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 회원가입 버튼 클릭 (약관 모달 표시)
  const handleRegister = () => {
    if (!validateForm()) {
      Alert.alert('입력 오류', '모든 항목을 올바르게 입력해주세요.');
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

      await apiClient.post('/api/auth/register', {
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        phone_number: phoneNumber.replace(/[^\d]/g, ''),
        auth_provider: 'EMAIL',
      });

      Alert.alert('환영합니다!', '회원가입이 완료되었습니다.', [
        {
          text: '확인',
          onPress: () => router.replace('/home'),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        '회원가입 실패',
        error.response?.data?.detail || '회원가입에 실패했습니다.'
      );
    } finally {
      setIsLoading(false);
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
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 돌아가기</Text>
          </TouchableOpacity>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>그랜비와 함께 시작해요</Text>
        </View>

        {/* 이메일 인증 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이메일 *</Text>
          <View style={styles.emailContainer}>
            <View style={{ flex: 1 }}>
              <Input
                label=""
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                editable={!emailVerified}
              />
            </View>
            {!emailVerified && (
              <Button
                title={codeSent ? '재발송' : '인증코드 발송'}
                onPress={handleSendVerificationCode}
                loading={isSendingCode}
                variant="outline"
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
            <View style={styles.codeContainer}>
              <View style={{ flex: 1 }}>
                <Input
                  label=""
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="인증 코드 6자리"
                  keyboardType="numeric"
                  error={errors.verificationCode}
                  maxLength={6}
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
          <Text style={styles.sectionTitle}>비밀번호 * (최소 6자)</Text>
          <Input
            label=""
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            secureTextEntry
            error={errors.password}
          />
          
          {/* 비밀번호 강도 표시기 */}
          {password && passwordStrength && (
            <View style={styles.strengthContainer}>
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

          <Input
            label=""
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="비밀번호 확인"
            secureTextEntry
            error={errors.confirmPassword}
          />
        </View>

        {/* 이름 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이름 *</Text>
          <Input
            label=""
            value={name}
            onChangeText={setName}
            placeholder="이름"
            error={errors.name}
          />
        </View>

        {/* 전화번호 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>전화번호 *</Text>
          <Input
            label=""
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            placeholder="010-1234-5678"
            keyboardType="phone-pad"
            error={errors.phoneNumber}
          />
        </View>

        {/* 사용자 유형 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>사용자 유형 *</Text>
          <View style={styles.roleButtons}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === UserRole.ELDERLY && styles.roleButtonActive,
              ]}
              onPress={() => setRole(UserRole.ELDERLY)}
            >
              <Text style={styles.roleIcon}>👴</Text>
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
              <Text style={styles.roleIcon}>👨‍👩‍👧</Text>
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
        <View style={styles.buttonContainer}>
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
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.primary,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  verifiedBadge: {
    height: 50,
    paddingHorizontal: 16,
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    justifyContent: 'center',
  },
  verifiedText: {
    color: Colors.success,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  timerContainer: {
    height: 50,
    paddingHorizontal: 12,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    justifyContent: 'center',
  },
  timerText: {
    color: Colors.error,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '600',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundLight,
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryPale,
  },
  roleIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  roleButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
});
