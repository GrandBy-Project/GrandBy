/**
 * 회원가입 화면
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
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { UserRole } from '../types';
import { useRouter } from 'expo-router';

export const RegisterScreen = () => {
  const router = useRouter();
  const { register, isLoading, error } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.ELDERLY);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다';
    }

    if (!password) {
      newErrors.password = '비밀번호를 입력해주세요';
    } else if (password.length < 4) {
      newErrors.password = '비밀번호는 4자 이상이어야 합니다';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }

    if (!name.trim()) {
      newErrors.name = '이름을 입력해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        phone_number: phoneNumber.trim() || undefined,
      });
      
      Alert.alert('환영합니다!', '회원가입이 완료되었습니다.', [
        {
          text: '확인',
          onPress: () => router.replace('/home'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('회원가입 실패', error || '회원가입에 실패했습니다.');
    }
  };

  const goBack = () => {
    router.back();
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
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>Grandby에 오신 것을 환영합니다</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="이메일"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호를 입력하세요"
            secureTextEntry
            error={errors.password}
          />

          <Input
            label="비밀번호 확인"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="비밀번호를 다시 입력하세요"
            secureTextEntry
            error={errors.confirmPassword}
          />

          <Input
            label="이름"
            value={name}
            onChangeText={setName}
            placeholder="이름을 입력하세요"
            error={errors.name}
          />

          <Input
            label="전화번호 (선택)"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="010-1234-5678"
            keyboardType="phone-pad"
          />

          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>사용자 유형</Text>
            <View style={styles.roleButtons}>
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
                  👴 어르신
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
                  👨‍👩‍👧 보호자
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title="회원가입"
            onPress={handleRegister}
            loading={isLoading}
          />

          <Button
            title="취소"
            onPress={goBack}
            variant="outline"
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  form: {
    gap: 16,
  },
  roleContainer: {
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
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
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FF',
  },
  roleButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

