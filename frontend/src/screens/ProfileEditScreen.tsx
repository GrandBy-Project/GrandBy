/**
 * 프로필 수정 화면
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Header, Button, Input } from '../components';
import { validateName, validatePhoneNumber, validateBirthDate, formatBirthDate } from '../utils/validation';
import { Gender } from '../types';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useFontSizeStore } from '../store/fontSizeStore';

export const ProfileEditScreen = () => {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { fontSizeLevel } = useFontSizeStore();
  
  const [name, setName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [birthDate, setBirthDate] = useState(user?.birth_date || '');
  const [gender, setGender] = useState<Gender | undefined>(user?.gender);
  const [isLoading, setIsLoading] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const birthDateRef = useRef<TextInput>(null);

  // 사용자 정보가 업데이트되면 상태 업데이트
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhoneNumber(user.phone_number || '');
      setBirthDate(user.birth_date || '');
      setGender(user.gender);
    }
  }, [user]);

  const handleBirthDateChange = (text: string) => {
    const formatted = formatBirthDate(text);
    setBirthDate(formatted);
  };

  const handleSaveProfile = async () => {
    try {
      // 입력값 검증
      const nameValidation = validateName(name);
      if (!nameValidation.valid) {
        Alert.alert('입력 오류', nameValidation.message);
        return;
      }

      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.valid) {
        Alert.alert('입력 오류', phoneValidation.message);
        return;
      }

      const birthDateValidation = validateBirthDate(birthDate);
      if (!birthDateValidation.valid) {
        Alert.alert('입력 오류', birthDateValidation.message);
        return;
      }

      if (!gender) {
        Alert.alert('입력 오류', '성별을 선택해주세요.');
        return;
      }

      setIsLoading(true);

      const response = await apiClient.put('/api/users/profile', {
        name,
        phone_number: phoneNumber,
        birth_date: birthDate,
        gender,
      });

      // 사용자 정보 업데이트
      if (response.data) {
        setUser(response.data);
        Alert.alert(
          '프로필 수정 완료',
          '프로필이 성공적으로 수정되었습니다.',
          [
            {
              text: '확인',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('프로필 수정 오류:', error);
      const errorMessage = error.response?.data?.detail || '프로필 수정에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="프로필 수정" 
        showMenuButton={true}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="account-edit-outline" size={24} color="#2E7D32" />
          <Text style={styles.infoText}>
            개인정보를 수정할 수 있습니다.{'\n'}
            이메일과 계정 유형은 변경할 수 없습니다.
          </Text>
        </View>

        <View style={styles.form}>
          {/* 이메일 (수정 불가) */}
          <View style={styles.readOnlyField}>
            <View style={styles.readOnlyHeader}>
              <Ionicons name="mail-outline" size={20} color="#666666" />
              <Text style={styles.readOnlyLabel}>이메일</Text>
            </View>
            <Text style={styles.readOnlyValue}>{user?.email || '이메일 없음'}</Text>
            <Text style={styles.readOnlyNote}>이메일은 변경할 수 없습니다</Text>
          </View>

          {/* 계정 유형 (수정 불가) */}
          <View style={styles.readOnlyField}>
            <View style={styles.readOnlyHeader}>
              <Ionicons name="person-outline" size={20} color="#666666" />
              <Text style={styles.readOnlyLabel}>계정 유형</Text>
            </View>
            <Text style={styles.readOnlyValue}>
              {user?.role === 'elderly' ? '어르신' : '보호자'}
            </Text>
            <Text style={styles.readOnlyNote}>계정 유형은 변경할 수 없습니다</Text>
          </View>

          <View style={styles.divider} />

          {/* 이름 */}
          <Input
            label="이름"
            value={name}
            onChangeText={setName}
            placeholder="홍길동"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />

          {/* 전화번호 */}
          <Input
            ref={phoneRef}
            label="전화번호"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="010-1234-5678"
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => birthDateRef.current?.focus()}
          />

          {/* 생년월일 */}
          <Input
            ref={birthDateRef}
            label="생년월일"
            value={birthDate}
            onChangeText={handleBirthDateChange}
            placeholder="1990-01-01"
            keyboardType="numeric"
            maxLength={10}
            returnKeyType="done"
          />
          <Text style={styles.helperText}>만 14세 이상만 가입 가능합니다</Text>

          {/* 성별 */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>성별</Text>
            <View style={styles.genderButtons}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === Gender.MALE && styles.genderButtonActive,
                ]}
                onPress={() => setGender(Gender.MALE)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === Gender.MALE && styles.genderButtonTextActive,
                  ]}
                >
                  남성
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === Gender.FEMALE && styles.genderButtonActive,
                ]}
                onPress={() => setGender(Gender.FEMALE)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === Gender.FEMALE && styles.genderButtonTextActive,
                  ]}
                >
                  여성
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title={isLoading ? '저장 중...' : '저장'}
            onPress={handleSaveProfile}
            disabled={isLoading || !name || !phoneNumber || !birthDate || !gender}
          />
        </View>
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
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
    marginLeft: 12,
  },
  form: {
    gap: 8,
  },
  readOnlyField: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  readOnlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  readOnlyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginLeft: 8,
  },
  readOnlyValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 6,
  },
  readOnlyNote: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
  },
  divider: {
    height: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginVertical: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#666666',
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: '#34B79F',
    backgroundColor: '#E8F5E9',
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  genderButtonTextActive: {
    color: '#34B79F',
  },
});

