/**
 * 프로필 수정 화면
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Header, Button, Input } from '../components';
import { validateName, validatePhoneNumber, validateBirthDate, formatBirthDate } from '../utils/validation';
import { Gender } from '../types';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useFontSizeStore } from '../store/fontSizeStore';
import { useResponsive, getResponsiveFontSize, getResponsivePadding, getResponsiveSize } from '../hooks/useResponsive';
import { useAlert } from '../components/GlobalAlertProvider';

export const ProfileEditScreen = () => {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { fontSizeLevel } = useFontSizeStore();
  const insets = useSafeAreaInsets();
  const { scale } = useResponsive();
  const { show } = useAlert();
  
  const [name, setName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [birthDate, setBirthDate] = useState(user?.birth_date || '');
  const [gender, setGender] = useState<Gender | undefined>(user?.gender);
  const [isLoading, setIsLoading] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const birthDateRef = useRef<TextInput>(null);

  // 반응형 크기 계산
  const contentPadding = getResponsivePadding(24, scale);
  const infoBoxPadding = getResponsivePadding(16, scale);
  const infoBoxMarginBottom = getResponsivePadding(24, scale);
  const infoIconSize = getResponsiveFontSize(24, scale);
  const infoTextFontSize = getResponsiveFontSize(14, scale);
  const infoTextMarginLeft = getResponsivePadding(12, scale);
  const readOnlyFieldPadding = getResponsivePadding(16, scale);
  const readOnlyFieldMarginBottom = getResponsivePadding(16, scale);
  const readOnlyIconSize = getResponsiveFontSize(20, scale);
  const readOnlyLabelFontSize = getResponsiveFontSize(14, scale);
  const readOnlyValueFontSize = getResponsiveFontSize(16, scale);
  const readOnlyNoteFontSize = getResponsiveFontSize(12, scale);
  const inputLabelFontSize = getResponsiveFontSize(14, scale);
  const helperTextFontSize = getResponsiveFontSize(13, scale);
  const genderButtonPaddingVertical = getResponsivePadding(14, scale);
  const genderButtonPaddingHorizontal = getResponsivePadding(24, scale);
  const genderButtonTextFontSize = getResponsiveFontSize(16, scale);

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
        show('입력 오류', nameValidation.message);
        return;
      }

      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.valid) {
        show('입력 오류', phoneValidation.message);
        return;
      }

      const birthDateValidation = validateBirthDate(birthDate);
      if (!birthDateValidation.valid) {
        show('입력 오류', birthDateValidation.message);
        return;
      }

      if (!gender) {
        show('입력 오류', '성별을 선택해주세요.');
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
        show(
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
      show('오류', errorMessage);
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
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: contentPadding,
            paddingBottom: Math.max(insets.bottom, 40) + 100,
          }}
        >
          <View style={[
            styles.infoBox,
            {
              padding: infoBoxPadding,
              marginBottom: infoBoxMarginBottom,
            }
          ]}>
            <MaterialCommunityIcons 
              name="account-edit-outline" 
              size={infoIconSize} 
              color="#34B79F" 
            />
            <Text style={[
              styles.infoText,
              {
                fontSize: infoTextFontSize,
                marginLeft: infoTextMarginLeft,
              }
            ]}>
              개인정보를 수정할 수 있습니다.{'\n'}
              이메일과 계정 유형은 변경할 수 없습니다.
            </Text>
          </View>

          <View style={styles.form}>
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
            <Text style={[
              styles.helperText,
              { fontSize: helperTextFontSize }
            ]}>
              만 14세 이상만 가입 가능합니다
            </Text>

            {/* 성별 */}
            <View style={styles.inputContainer}>
              <Text style={[
                styles.inputLabel,
                { fontSize: inputLabelFontSize }
              ]}>
                성별
              </Text>
              <View style={styles.genderButtons}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    {
                      paddingVertical: genderButtonPaddingVertical,
                      paddingHorizontal: genderButtonPaddingHorizontal,
                    },
                    gender === Gender.MALE && styles.genderButtonActive,
                  ]}
                  onPress={() => setGender(Gender.MALE)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      { fontSize: genderButtonTextFontSize },
                      gender === Gender.MALE && styles.genderButtonTextActive,
                    ]}
                  >
                    남성
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    {
                      paddingVertical: genderButtonPaddingVertical,
                      paddingHorizontal: genderButtonPaddingHorizontal,
                    },
                    gender === Gender.FEMALE && styles.genderButtonActive,
                  ]}
                  onPress={() => setGender(Gender.FEMALE)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      { fontSize: genderButtonTextFontSize },
                      gender === Gender.FEMALE && styles.genderButtonTextActive,
                    ]}
                  >
                    여성
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* 이메일 (수정 불가) */}
            <View style={[
              styles.readOnlyField,
              {
                padding: readOnlyFieldPadding,
                marginBottom: readOnlyFieldMarginBottom,
              }
            ]}>
              <View style={styles.readOnlyHeader}>
                <Ionicons name="mail-outline" size={readOnlyIconSize} color="#34B79F" />
                <Text style={[
                  styles.readOnlyLabel,
                  { fontSize: readOnlyLabelFontSize }
                ]}>
                  이메일
                </Text>
              </View>
              <Text style={[
                styles.readOnlyValue,
                { fontSize: readOnlyValueFontSize }
              ]}>
                {user?.email || '이메일 없음'}
              </Text>
              <Text style={[
                styles.readOnlyNote,
                { fontSize: readOnlyNoteFontSize }
              ]}>
                이메일은 변경할 수 없습니다
              </Text>
            </View>

            {/* 계정 유형 (수정 불가) */}
            <View style={[
              styles.readOnlyField,
              {
                padding: readOnlyFieldPadding,
                marginBottom: readOnlyFieldMarginBottom,
              }
            ]}>
              <View style={styles.readOnlyHeader}>
                <Ionicons name="person-outline" size={readOnlyIconSize} color="#34B79F" />
                <Text style={[
                  styles.readOnlyLabel,
                  { fontSize: readOnlyLabelFontSize }
                ]}>
                  계정 유형
                </Text>
              </View>
              <Text style={[
                styles.readOnlyValue,
                { fontSize: readOnlyValueFontSize }
              ]}>
                {user?.role === 'elderly' ? '어르신' : '보호자'}
              </Text>
              <Text style={[
                styles.readOnlyNote,
                { fontSize: readOnlyNoteFontSize }
              ]}>
                계정 유형은 변경할 수 없습니다
              </Text>
            </View>

            <Button
              title={isLoading ? '저장 중...' : '저장'}
              onPress={handleSaveProfile}
              disabled={isLoading || !name || !phoneNumber || !birthDate || !gender}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    // padding은 동적으로 적용
  },
  infoBox: {
    backgroundColor: '#F0F9F7',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    // padding, marginBottom은 동적으로 적용
  },
  infoText: {
    flex: 1,
    color: '#34B79F',
    lineHeight: 20,
    // fontSize, marginLeft은 동적으로 적용
  },
  form: {
    gap: 8,
  },
  readOnlyField: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    // padding, marginBottom은 동적으로 적용
  },
  readOnlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  readOnlyLabel: {
    fontWeight: '600',
    color: '#34B79F',
    marginLeft: 8,
    // fontSize는 동적으로 적용
  },
  readOnlyValue: {
    fontWeight: '500',
    color: '#333333',
    marginBottom: 6,
    // fontSize는 동적으로 적용
  },
  readOnlyNote: {
    color: '#666666',
    // fontSize는 동적으로 적용
    // fontStyle: 'italic' 제거됨
  },
  divider: {
    height: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginVertical: 8,
  },
  helperText: {
    color: '#666666',
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
    // fontSize는 동적으로 적용
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    // fontSize는 동적으로 적용
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    // paddingVertical, paddingHorizontal은 동적으로 적용
  },
  genderButtonActive: {
    borderColor: '#34B79F',
    backgroundColor: '#F0F9F7',
  },
  genderButtonText: {
    fontWeight: '600',
    color: '#666666',
    // fontSize는 동적으로 적용
  },
  genderButtonTextActive: {
    color: '#34B79F',
  },
});

