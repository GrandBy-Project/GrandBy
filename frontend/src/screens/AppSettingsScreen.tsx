/**
 * 앱 설정 화면
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { BottomNavigationBar, Header } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';
import { useFontSizeStore } from '../store/fontSizeStore';

export const AppSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fontSizeLevel } = useFontSizeStore();

  // 설정 상태 관리
  const [settings, setSettings] = useState({
    // 화면/표시 설정
    fontSize: 'medium', // small, medium, large, extraLarge
    brightness: 'medium', // dark, medium, bright, max
    theme: 'light', // light, dark, highContrast
    language: 'ko', // ko, en

    // 실제 구현된 알림 설정
    push_notification_enabled: true, // 전체 푸시 알림
    push_todo_reminder_enabled: true, // TODO 10분 전 리마인더
    push_todo_incomplete_enabled: true, // 미완료 TODO 알림
    push_todo_created_enabled: true, // 새 TODO 생성 알림
    push_diary_enabled: true, // 다이어리 생성 알림
    push_call_enabled: true, // AI 전화 완료 알림
    push_connection_enabled: true, // 연결 요청/수락 알림
    auto_diary_enabled: true, // 자동 다이어리 생성

    // 접근성 설정
    touchDelay: 'normal', // fast, normal, slow
    buttonSize: 'medium', // small, medium, large
    voiceGuide: false,
    highContrast: false,
  });

  const [isLoading, setIsLoading] = useState(false);

  // 사용자 설정 로드
  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const response = await apiClient.get('/api/users/settings');
      if (response.data) {
        setSettings(prev => ({
          ...prev,
          ...response.data,
        }));
        console.log('✅ 사용자 설정 로드 성공:', response.data);
      }
    } catch (error: any) {
      console.error('사용자 설정 로드 실패:', error);
      // 에러가 발생해도 기본값으로 계속 진행
      console.log('기본 설정값으로 계속 진행합니다.');
    }
  };

  const updateSetting = async (key: string, value: any) => {
    // 먼저 로컬 상태 업데이트
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // 백엔드에 설정 저장
    try {
      const response = await apiClient.put('/api/users/settings', {
        [key]: value,
      });
      console.log('✅ 설정 저장 성공:', key, value);
    } catch (error: any) {
      console.error('설정 저장 실패:', error);
      
      // 실패 시 이전 값으로 되돌리기
      setSettings(prev => ({ ...prev, [key]: !value }));
      
      // 사용자에게 알림
      Alert.alert(
        '설정 저장 실패', 
        '설정을 저장할 수 없습니다. 네트워크 연결을 확인해주세요.',
        [{ text: '확인' }]
      );
    }
  };

  const handleCacheClear = () => {
    Alert.alert(
      '캐시 정리',
      '앱 캐시를 정리하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '정리',
          onPress: () => {
            Alert.alert('완료', '캐시가 정리되었습니다.');
          },
        },
      ]
    );
  };

  const handleAppInfo = () => {
    Alert.alert('앱 정보', '그랜비 v1.0.0\n개발: 그랜비팀\n문의: support@grandby.com');
  };

  const handleContact = () => {
    Alert.alert('문의하기', '고객지원: 1588-0000\n이메일: support@grandby.com');
  };

  const handleBrightnessSetting = () => {
    if (Platform.OS === 'ios') {
      // iOS는 시스템 설정으로 연결
      Alert.alert(
        '화면 밝기 설정',
        '화면 밝기는 시스템 설정에서 조절할 수 있습니다.\n설정으로 이동하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '설정으로 이동',
            onPress: () => {
              Linking.openSettings();
            },
          },
        ]
      );
    } else {
      // Android도 시스템 설정으로 연결
      Alert.alert(
        '화면 밝기 설정',
        '화면 밝기는 시스템 설정에서 조절할 수 있습니다.\n설정으로 이동하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '설정으로 이동',
            onPress: () => {
              Linking.openSettings();
            },
          },
        ]
      );
    }
  };

  // 화면/표시 설정
  const displaySettings = [
    {
      id: 'fontSize',
      title: '글씨 크기',
      type: 'select',
      value: settings.fontSize,
      options: [
        { label: '작게', value: 'small' },
        { label: '보통', value: 'medium' },
        { label: '크게', value: 'large' },
        { label: '매우 크게', value: 'extraLarge' },
      ],
    },
    {
      id: 'brightness',
      title: '화면 밝기',
      type: 'action',
      value: settings.brightness,
      platform: Platform.OS,
    },
    {
      id: 'theme',
      title: '색상 테마',
      type: 'select',
      value: settings.theme,
      options: [
        { label: '밝은 테마', value: 'light' },
        { label: '어두운 테마', value: 'dark' },
        { label: '고대비 모드', value: 'highContrast' },
      ],
    },
    {
      id: 'language',
      title: '언어 설정',
      type: 'select',
      value: settings.language,
      options: [
        { label: '한국어', value: 'ko' },
        { label: 'English', value: 'en' },
      ],
    },
  ];

  // 사용자 역할에 따른 알림 설정 필터링
  const getNotificationSettings = () => {
    const allSettings = [
      {
        id: 'push_notification_enabled',
        title: '푸시 알림 전체',
        description: '모든 푸시 알림을 켜거나 끕니다',
        type: 'switch',
        value: settings.push_notification_enabled,
        roles: [UserRole.ELDERLY, UserRole.CAREGIVER], // 모든 역할
      },
      {
        id: 'push_todo_reminder_enabled',
        title: '할 일 리마인더',
        description: '할 일 시작 10분 전 알림',
        type: 'switch',
        value: settings.push_todo_reminder_enabled,
        disabled: !settings.push_notification_enabled,
        roles: [UserRole.ELDERLY], // 어르신만
      },
      {
        id: 'push_todo_incomplete_enabled',
        title: '미완료 할 일 알림',
        description: '매일 밤 9시 미완료 할 일 알림',
        type: 'switch',
        value: settings.push_todo_incomplete_enabled,
        disabled: !settings.push_notification_enabled,
        roles: [UserRole.ELDERLY], // 어르신만
      },
      {
        id: 'push_todo_created_enabled',
        title: '새 할 일 생성 알림',
        description: '보호자가 새 할 일을 추가할 때 알림',
        type: 'switch',
        value: settings.push_todo_created_enabled,
        disabled: !settings.push_notification_enabled,
        roles: [UserRole.ELDERLY], // 어르신만
      },
      {
        id: 'push_diary_enabled',
        title: '일기 생성 알림',
        description: 'AI 전화 후 일기가 생성될 때 알림',
        type: 'switch',
        value: settings.push_diary_enabled,
        disabled: !settings.push_notification_enabled,
        roles: [UserRole.CAREGIVER], // 보호자만
      },
      {
        id: 'push_call_enabled',
        title: 'AI 전화 완료 알림',
        description: 'AI 전화가 완료될 때 알림',
        type: 'switch',
        value: settings.push_call_enabled,
        disabled: !settings.push_notification_enabled,
        roles: [UserRole.ELDERLY], // 어르신만 (전화를 받는 사람)
      },
      {
        id: 'push_connection_enabled',
        title: '연결 요청/수락 알림',
        description: '보호자-어르신 연결 관련 알림',
        type: 'switch',
        value: settings.push_connection_enabled,
        disabled: !settings.push_notification_enabled,
        roles: [UserRole.ELDERLY, UserRole.CAREGIVER], // 모든 역할
      },
      {
        id: 'auto_diary_enabled',
        title: '자동 일기 생성',
        description: 'AI 전화 후 자동으로 일기 생성',
        type: 'switch',
        value: settings.auto_diary_enabled,
        roles: [UserRole.ELDERLY], // 어르신만 (일기가 생성되는 대상)
      },
    ];

    // 현재 사용자 역할에 맞는 설정만 필터링
    return allSettings.filter(setting => 
      setting.roles.includes(user?.role as UserRole)
    );
  };

  const notificationSettings = getNotificationSettings();

  // 접근성 설정
  const accessibilitySettings = [
    {
      id: 'touchDelay',
      title: '터치 지연',
      type: 'select',
      value: settings.touchDelay,
      options: [
        { label: '빠르게', value: 'fast' },
        { label: '보통', value: 'normal' },
        { label: '천천히', value: 'slow' },
      ],
    },
    {
      id: 'buttonSize',
      title: '버튼 크기',
      type: 'select',
      value: settings.buttonSize,
      options: [
        { label: '작게', value: 'small' },
        { label: '보통', value: 'medium' },
        { label: '크게', value: 'large' },
      ],
    },
    {
      id: 'voiceGuide',
      title: '음성 안내',
      type: 'switch',
      value: settings.voiceGuide,
    },
    {
      id: 'highContrast',
      title: '고대비 모드',
      type: 'switch',
      value: settings.highContrast,
    },
  ];

  const renderSettingItem = (setting: any) => {
    if (setting.type === 'switch') {
      return (
        <View key={setting.id} style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Text style={[
              styles.settingTitle,
              setting.disabled && styles.disabledText
            ]}>
              {setting.title}
            </Text>
            {setting.description && (
              <Text style={[
                styles.settingDescription,
                setting.disabled && styles.disabledText
              ]}>
                {setting.description}
              </Text>
            )}
          </View>
          <Switch
            value={setting.value}
            onValueChange={(value) => updateSetting(setting.id, value)}
            trackColor={{ false: '#E5E5E7', true: '#34B79F' }}
            thumbColor={setting.value ? '#FFFFFF' : '#FFFFFF'}
            disabled={setting.disabled}
          />
        </View>
      );
    }

    if (setting.type === 'select') {
      const currentOption = setting.options.find((opt: any) => opt.value === setting.value);
      return (
        <TouchableOpacity
          key={setting.id}
          style={styles.settingItem}
          onPress={() => {
            Alert.alert(
              setting.title,
              '선택하세요:',
              setting.options.map((option: any) => ({
                text: option.label,
                onPress: () => updateSetting(setting.id, option.value),
              }))
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <Text style={styles.settingTitle}>{setting.title}</Text>
          </View>
          <View style={styles.settingRight}>
            <Text style={styles.settingValue}>{currentOption?.label}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (setting.type === 'action') {
      const getBrightnessLabel = () => {
        return '시스템 설정에서 조절';
      };

      return (
        <TouchableOpacity
          key={setting.id}
          style={styles.settingItem}
          onPress={handleBrightnessSetting}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <Text style={styles.settingTitle}>{setting.title}</Text>
          </View>
          <View style={styles.settingRight}>
            <Text style={styles.settingValue}>{getBrightnessLabel()}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderSettingsSection = (title: string, settings: any[], icon: string) => (
    <View style={styles.settingsSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.settingsList}>
        {settings.map(renderSettingItem)}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="앱 설정"
        showMenuButton={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 화면/표시 설정 */}
        {renderSettingsSection('화면/표시 설정', displaySettings, '🎨')}

        {/* 알림 설정 */}
        {renderSettingsSection('알림 설정', notificationSettings, '🔔')}

        {/* 접근성 설정 */}
        {renderSettingsSection('접근성 설정', accessibilitySettings, '♿')}

        {/* 기타 설정 */}
        <View style={styles.settingsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⚙️</Text>
            <Text style={styles.sectionTitle}>기타 설정</Text>
          </View>
          <View style={styles.settingsList}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleCacheClear}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingTitle}>캐시 정리</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleAppInfo}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingTitle}>앱 정보</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleContact}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingTitle}>문의하기</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 하단 여백 (네비게이션 바 공간 확보) */}
        <View style={[styles.bottomSpacer, { height: 100 + Math.max(insets.bottom, 10) }]} />
      </ScrollView>

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />
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
    padding: 16,
  },

  // 설정 섹션
  settingsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  settingsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // 설정 항목
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    minHeight: 60, // 터치 영역 확보
  },
  settingLeft: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    lineHeight: 18,
  },
  disabledText: {
    color: '#999999',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 16,
    color: '#666666',
    marginRight: 8,
  },
  settingArrow: {
    fontSize: 20,
    color: '#C7C7CC',
  },

  bottomSpacer: {
    height: 20,
  },
});
