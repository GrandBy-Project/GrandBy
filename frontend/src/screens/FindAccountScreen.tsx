/**
 * 계정 찾기 화면 (이메일 찾기 & 비밀번호 재설정)
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Header, Button, Input } from '../components';
import { useAlert } from '../components/GlobalAlertProvider';
import { validatePhoneNumber, validateName, validateVerificationCode, validatePassword } from '../utils/validation';
import apiClient from '../api/client';
import { useFontSizeStore } from '../store/fontSizeStore';

type TabType = 'email' | 'password';

export const FindAccountScreen = () => {
  const router = useRouter();
  const { fontSizeLevel } = useFontSizeStore();
  const [activeTab, setActiveTab] = useState<TabType>('email');
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const guidelineBaseWidth = 375;
  const guidelineBaseHeight = 812;
  const scale = (size: number) => (screenWidth / guidelineBaseWidth) * size;
  const verticalScale = (size: number) => (screenHeight / guidelineBaseHeight) * size;
  const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Header 
        title="계정 찾기" 
        showBackButton={false}
        showMenuButton={false}
        showFontSizeButton={false}
      />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'email' && styles.activeTab]}
          onPress={() => setActiveTab('email')}
        >
          <Text style={[styles.tabText, { fontSize: moderateScale(16) }, activeTab === 'email' && styles.activeTabText]}>
            이메일 찾기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'password' && styles.activeTab]}
          onPress={() => setActiveTab('password')}
        >
          <Text style={[styles.tabText, { fontSize: moderateScale(16) }, activeTab === 'password' && styles.activeTabText]}>
            비밀번호 재설정
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={[styles.content, { backgroundColor: '#FFFFFF' }]} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { width: '90%', alignSelf: 'center' }]}
      >
        {activeTab === 'email' ? <FindEmailTab /> : <ResetPasswordTab />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ==================== 이메일 찾기 탭 ====================
const FindEmailTab = () => {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const { show } = useAlert();

  const handleFindEmail = async () => {
    try {
      // 입력값 검증
      const nameValidation = validateName(name);
      if (!nameValidation.valid) {
        show('입력 오류', nameValidation.message);
        return;
      }

      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.valid) {
        show('입력 오류', phoneValidation.message);
        return;
      }

      setIsLoading(true);

      const response = await apiClient.post('/api/auth/find-email', {
        name,
        phone_number: phoneNumber,
      });

      // API는 masked_email 키를 반환하므로 해당 값 사용
      const maskedEmail = response.data.masked_email || response.data.email;
      show('이메일 찾기 성공', `등록된 이메일: ${maskedEmail}\n\n로그인 화면에서 해당 이메일로 로그인하세요.`);

      // 입력값 초기화
      setName('');
      setPhoneNumber('');
    } catch (error: any) {
      console.error('이메일 찾기 오류:', error);
      const errorMessage = error.response?.data?.detail || '이메일을 찾을 수 없습니다.';
      show('오류', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.tabContent}>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color="#34B79F" />
        <Text style={styles.infoBoxText}>
          가입 시 입력한 이름과 전화번호를 입력해주세요.
        </Text>
      </View>

      <View style={styles.narrow}>
      <Input
        label="이름"
        value={name}
        onChangeText={setName}
        placeholder="홍길동"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      </View>

      <View style={styles.narrow}>
      <Input
        ref={phoneRef}
        label="전화번호"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="010-1234-5678"
        keyboardType="phone-pad"
        returnKeyType="done"
        onSubmitEditing={handleFindEmail}
      />
      </View>

      <Button
        title={isLoading ? '찾는 중...' : '이메일 찾기'}
        onPress={handleFindEmail}
        disabled={isLoading || !name || !phoneNumber}
      />
    </View>
  );
};

// ==================== 비밀번호 재설정 탭 ====================
const ResetPasswordTab = () => {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { show } = useAlert();

  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Step 1: 이메일로 인증 코드 발송
  const handleSendCode = async () => {
    try {
      if (!email) {
        show('입력 오류', '이메일을 입력해주세요.');
        return;
      }

      setIsLoading(true);

      await apiClient.post('/api/auth/reset-password-request', { email });

      show('인증 코드 발송', '이메일로 인증 코드가 발송되었습니다. 이메일 확인후 인증 번호를 입력해주세요.');

      setStep('code');
    } catch (error: any) {
      console.error('코드 발송 오류:', error);
      const errorMessage = error.response?.data?.detail || '코드 발송에 실패했습니다.';
      show('오류', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: 인증 코드 확인 & 비밀번호 재설정
  const handleResetPassword = async () => {
    try {
      // 입력값 검증
      const codeValidation = validateVerificationCode(code);
      if (!codeValidation.valid) {
        show('입력 오류', codeValidation.message);
        return;
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        show('입력 오류', passwordValidation.message);
        return;
      }

      if (newPassword !== confirmPassword) {
        show('입력 오류', '비밀번호가 일치하지 않습니다.');
        return;
      }

      setIsLoading(true);

      await apiClient.post('/api/auth/reset-password-verify', {
        email,
        code,
        new_password: newPassword,
      });

      setStep('success');
      
      show('비밀번호 재설정 완료', '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.');
      router.replace('/login');
    } catch (error: any) {
      console.error('비밀번호 재설정 오류:', error);
      const errorMessage = error.response?.data?.detail || '비밀번호 재설정에 실패했습니다.';
      show('오류', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCode('');
    await handleSendCode();
  };

  return (
    <View style={styles.tabContent}>
      {step === 'email' && (
        <>
          <View style={styles.infoBox}>
            <Ionicons name="mail-outline" size={24} color="#34B79F" />
            <Text style={styles.infoBoxText}>
              가입하신 이메일 주소를 입력하시면{'\n'}
              비밀번호 재설정 인증 코드를 보내드립니다.
            </Text>
          </View>

          <View style={styles.narrow}>
          <Input
            label="이메일"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSendCode}
          />
          </View>

          <Button
            title={isLoading ? '발송 중...' : '인증 코드 받기'}
            onPress={handleSendCode}
            disabled={isLoading || !email}
          />
        </>
      )}

      {step === 'code' && (
        <>
          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#34B79F" />
            <Text style={styles.infoBoxText}>
              {email}로 발송된 6자리 인증 코드를 입력하고{'\n'}
              새로운 비밀번호를 설정해주세요.
            </Text>
          </View>

          <View style={[styles.codeSection, styles.narrow]}>
            <Input
              ref={codeRef}
              label="인증 코드"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="numeric"
              maxLength={6}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={isLoading}
            >
              <Ionicons name="refresh-outline" size={16} color="#34B79F" style={{ marginRight: 4 }} />
              <Text style={styles.resendButtonText}>코드 재발송</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.narrow}>
          <Input
            ref={passwordRef}
            label="새 비밀번호"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="6자 이상"
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          />
          </View>

          <View style={styles.narrow}>
          <Input
            ref={confirmPasswordRef}
            label="비밀번호 확인"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="비밀번호 재입력"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleResetPassword}
          />
          </View>

          <Button
            title={isLoading ? '재설정 중...' : '비밀번호 재설정'}
            onPress={handleResetPassword}
            disabled={isLoading || !code || !newPassword || !confirmPassword}
          />

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('email')}
          >
            <Ionicons name="arrow-back-outline" size={18} color="#666666" style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>이메일 변경</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#34B79F',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#34B79F',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  tabContent: {
    padding: 24,
  },
  narrow: {
    width: '100%',
    alignSelf: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#34B79F',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 14,
    color: '#2C7A6B',
    lineHeight: 20,
    marginLeft: 12,
  },
  codeSection: {
    marginBottom: 8,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -8,
    marginBottom: 8,
    backgroundColor: '#F0F9F7',
    borderRadius: 8,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
});

