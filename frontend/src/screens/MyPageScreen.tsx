/**
 * 마이페이지 화면 (어르신/보호자 공통)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Switch,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { BottomNavigationBar, Header } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserRole } from '../types';
import apiClient, { API_BASE_URL } from '../api/client';
import { useFontSizeStore } from '../store/fontSizeStore';

export const MyPageScreen = () => {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { fontSizeLevel } = useFontSizeStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isNotificationExpanded, setIsNotificationExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Android에서 LayoutAnimation 활성화
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // 알림 설정 상태 관리
  const [notificationSettings, setNotificationSettings] = useState({
    push_notification_enabled: true,
    push_todo_reminder_enabled: true,
    push_todo_incomplete_enabled: true,
    push_todo_created_enabled: true,
    push_diary_enabled: true,
    push_call_enabled: true,
    push_connection_enabled: true,
  });

  // 알림 설정 로드
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const response = await apiClient.get('/api/users/settings');
      if (response.data) {
        setNotificationSettings(prev => ({
          ...prev,
          ...response.data,
        }));
        console.log('✅ 알림 설정 로드 성공:', response.data);
      }
    } catch (error: any) {
      console.error('알림 설정 로드 실패:', error);
    }
  };

  const updateNotificationSetting = async (key: string, value: boolean) => {
    // 먼저 로컬 상태 업데이트
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
    
    // 백엔드에 설정 저장
    try {
      await apiClient.put('/api/users/settings', {
        [key]: value,
      });
      console.log('✅ 알림 설정 저장 성공:', key, value);
    } catch (error: any) {
      console.error('알림 설정 저장 실패:', error);
      
      // 실패 시 이전 값으로 되돌리기
      setNotificationSettings(prev => ({ ...prev, [key]: !value }));
      
      // 사용자에게 알림
      Alert.alert(
        '설정 저장 실패', 
        '설정을 저장할 수 없습니다. 네트워크 연결을 확인해주세요.',
        [{ text: '확인' }]
      );
    }
  };

  // 사용자 역할에 따른 알림 설정 필터링
  const getNotificationSettingsList = () => {
    const allSettings = [
      {
        id: 'push_notification_enabled',
        title: '푸시 알림 전체',
        description: '모든 푸시 알림을 켜거나 끕니다',
        value: notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY, UserRole.CAREGIVER],
      },
      {
        id: 'push_todo_reminder_enabled',
        title: '할 일 리마인더',
        description: '할 일 시작 10분 전 알림',
        value: notificationSettings.push_todo_reminder_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_todo_incomplete_enabled',
        title: '미완료 할 일 알림',
        description: '매일 밤 9시 미완료 할 일 알림',
        value: notificationSettings.push_todo_incomplete_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_todo_created_enabled',
        title: '새 할 일 생성 알림',
        description: '보호자가 새 할 일을 추가할 때 알림',
        value: notificationSettings.push_todo_created_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_diary_enabled',
        title: '일기 생성 알림',
        description: 'AI 전화 후 일기가 생성될 때 알림',
        value: notificationSettings.push_diary_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.CAREGIVER],
      },
      {
        id: 'push_call_enabled',
        title: 'AI 전화 완료 알림',
        description: 'AI 전화가 완료될 때 알림',
        value: notificationSettings.push_call_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_connection_enabled',
        title: '연결 요청/수락 알림',
        description: '보호자-어르신 연결 관련 알림',
        value: notificationSettings.push_connection_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY, UserRole.CAREGIVER],
      },
    ];

    return allSettings.filter(setting => 
      setting.roles.includes(user?.role as UserRole)
    );
  };

  const notificationSettingsList = getNotificationSettingsList();

  // 알림 설정 펼침/접힘 토글
  const toggleNotificationExpanded = () => {
    const toValue = isNotificationExpanded ? 0 : 1;
    
    // LayoutAnimation으로 부드러운 전환 효과
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });

    // 슬라이드 애니메이션
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setIsNotificationExpanded(!isNotificationExpanded);
  };

  // 프로필 이미지 URL 가져오기
  const getProfileImageUrl = () => {
    if (!user?.profile_image_url) return null;
    // 이미 전체 URL인 경우
    if (user.profile_image_url.startsWith('http')) {
      return user.profile_image_url;
    }
    // 상대 경로인 경우
    return `${API_BASE_URL}/${user.profile_image_url}`;
  };

  // 프로필 이미지 선택 및 업로드
  const handleImagePick = async () => {
    try {
      // 권한 요청
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
        return;
      }

      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0].uri;
      await uploadProfileImage(imageUri);
    } catch (error) {
      console.error('이미지 선택 오류:', error);
      Alert.alert('오류', '이미지를 선택하는 중 오류가 발생했습니다.');
    }
  };

  // 프로필 이미지 업로드
  const uploadProfileImage = async (imageUri: string) => {
    try {
      setIsUploading(true);

      // FormData 생성
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      // API 호출
      const response = await apiClient.post('/api/users/profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // 사용자 정보 업데이트
      if (response.data) {
        setUser(response.data);
        Alert.alert('성공', '프로필 사진이 업데이트되었습니다.');
      }
    } catch (error: any) {
      console.error('이미지 업로드 오류:', error);
      const errorMessage = error.response?.data?.detail || '이미지 업로드 중 오류가 발생했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // 프로필 이미지 삭제
  const handleImageDelete = async () => {
    Alert.alert(
      '프로필 사진 삭제',
      '프로필 사진을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUploading(true);
              const response = await apiClient.delete('/api/users/profile-image');
              
              // 사용자 정보 업데이트
              if (response.data) {
                setUser(response.data);
                Alert.alert('성공', '프로필 사진이 삭제되었습니다.');
              }
            } catch (error: any) {
              console.error('이미지 삭제 오류:', error);
              const errorMessage = error.response?.data?.detail || '이미지 삭제 중 오류가 발생했습니다.';
              Alert.alert('오류', errorMessage);
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  };

  // 프로필 이미지 편집 옵션 표시
  const showImageOptions = () => {
    const options = user?.profile_image_url
      ? ['사진 선택', '사진 삭제', '취소']
      : ['사진 선택', '취소'];
    
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = user?.profile_image_url ? 1 : undefined;

    Alert.alert(
      '프로필 사진',
      '프로필 사진을 변경하거나 삭제할 수 있습니다.',
      options.map((option, index) => ({
        text: option,
        style: index === cancelButtonIndex ? 'cancel' : 
               index === destructiveButtonIndex ? 'destructive' : 'default',
        onPress: () => {
          if (option === '사진 선택') {
            handleImagePick();
          } else if (option === '사진 삭제') {
            handleImageDelete();
          }
        },
      }))
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하시겠습니까?\n\n⚠️ 중요:\n• 30일 이내에는 복구 가능합니다\n• 30일 후에는 모든 데이터가 영구 삭제됩니다\n• 관련된 할일, 일기 등이 익명화됩니다',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            // 비밀번호 확인 (소셜 로그인이 아닌 경우)
            if (user?.auth_provider === 'email') {
              Alert.prompt(
                '본인 확인',
                '계정 삭제를 위해 비밀번호를 입력해주세요.',
                [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async (password?: string) => {
                      if (!password) {
                        Alert.alert('오류', '비밀번호를 입력해주세요.');
                        return;
                      }
                      await deleteAccount(password);
                    },
                  },
                ],
                'secure-text'
              );
            } else {
              // 소셜 로그인 사용자
              Alert.alert(
                '계정 삭제 확인',
                '정말로 계정을 삭제하시겠습니까?',
                [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => await deleteAccount(''),
                  },
                ]
              );
            }
          },
        },
      ]
    );
  };

  const deleteAccount = async (password: string) => {
    try {
      setIsUploading(true); // 로딩 상태 표시
      
      await apiClient.delete('/api/users/account', {
        data: {
          password: user?.auth_provider === 'email' ? password : undefined,
          reason: '사용자 요청',
        },
      });

      Alert.alert(
        '계정 삭제 완료',
        '계정이 삭제되었습니다.\n30일 이내에 다시 로그인하시면 계정을 복구할 수 있습니다.',
        [
          {
            text: '확인',
            onPress: async () => {
              await logout();
              router.replace('/');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('계정 삭제 오류:', error);
      const errorMessage = error.response?.data?.detail || '계정 삭제에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  // 사용자 정보 섹션
  const userInfoItems = [
    {
      id: 'name',
      label: '이름',
      value: user?.name || '사용자',
      iconName: 'person-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
    {
      id: 'email',
      label: '이메일',
      value: user?.email || '이메일 없음',
      iconName: 'mail-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
    {
      id: 'phone',
      label: '전화번호',
      value: user?.phone_number || '전화번호 없음',
      iconName: 'call-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
    {
      id: 'role',
      label: '계정 유형',
      value: user?.role === UserRole.ELDERLY ? '어르신' : '보호자',
      iconName: user?.role === UserRole.ELDERLY ? 'person-circle-outline' : 'people-circle-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
  ];

  // 개인정보 관리 메뉴 항목들
  const personalItems = [
    {
      id: 'profile-edit',
      title: '프로필 수정',
      description: '이름, 전화번호 등 수정',
      iconName: 'account-edit' as const,
      iconLibrary: 'MaterialCommunityIcons' as const,
      color: '#007AFF',
      onPress: () => router.push('/profile-edit'),
    },
    {
      id: 'password-change',
      title: '비밀번호 변경',
      description: '계정 보안을 위한 비밀번호 변경',
      iconName: 'lock-reset' as const,
      iconLibrary: 'MaterialCommunityIcons' as const,
      color: '#FF9500',
      onPress: () => router.push('/change-password'),
    },
    {
      id: 'account-delete',
      title: '계정 삭제',
      description: '계정을 완전히 삭제하기',
      iconName: 'delete-forever' as const,
      iconLibrary: 'MaterialIcons' as const,
      color: '#FF3B30',
      onPress: handleDeleteAccount,
    },
  ];

  // 개인정보 보호 및 약관 메뉴 항목들
  const privacyItems = [
    {
      id: 'privacy-policy',
      title: '개인정보 처리방침',
      description: '개인정보 수집 및 이용 방침',
      iconName: 'shield-checkmark' as const,
      iconLibrary: 'Ionicons' as const,
      color: '#34C759',
      onPress: () => Alert.alert('개인정보 처리방침', '개인정보 처리방침을 확인할 수 있습니다.'),
    },
    {
      id: 'terms',
      title: '이용약관',
      description: '서비스 이용약관',
      iconName: 'document-text' as const,
      iconLibrary: 'Ionicons' as const,
      color: '#5856D6',
      onPress: () => Alert.alert('이용약관', '서비스 이용약관을 확인할 수 있습니다.'),
    }
  ];

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="마이페이지"
        showMenuButton={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 사용자 정보 카드 */}
        <View style={styles.userCard}>
          <View style={styles.profileSection}>
            <TouchableOpacity 
              style={styles.profileImageContainer}
              onPress={showImageOptions}
              disabled={isUploading}
              activeOpacity={0.7}
            >
              {getProfileImageUrl() ? (
                <Image
                  source={{ uri: getProfileImageUrl()! }}
                  style={styles.profileImageReal}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons 
                    name={user?.role === UserRole.ELDERLY ? 'person' : 'people'} 
                    size={40} 
                    color="#FFFFFF" 
                  />
                </View>
              )}
              {isUploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
              <View style={styles.editIconContainer}>
                <MaterialCommunityIcons name="camera" size={14} color="#34B79F" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.name || '사용자'}</Text>
              <View style={styles.roleContainer}>
                <Ionicons 
                  name={user?.role === UserRole.ELDERLY ? 'person-circle' : 'people-circle'} 
                  size={16} 
                  color="#34B79F" 
                />
                <Text style={styles.userRole}>
                  {user?.role === UserRole.ELDERLY ? '어르신 계정' : '보호자 계정'}
                </Text>
              </View>
            </View>
          </View>

          {/* 사용자 정보 리스트 */}
          <View style={styles.userInfoList}>
            {userInfoItems.map((item, index) => (
              <View key={item.id} style={styles.userInfoItem}>
                <View style={styles.userInfoLeft}>
                  <View style={styles.userInfoIconContainer}>
                    <Ionicons name={item.iconName as any} size={20} color="#34B79F" />
                  </View>
                  <Text style={styles.userInfoLabel}>{item.label}</Text>
                </View>
                <Text style={styles.userInfoValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 개인정보 관리 */}
        <View style={styles.settingsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⚙️</Text>
            <Text style={styles.sectionTitle}>개인정보 관리</Text>
          </View>
          <View style={styles.settingsList}>
            {personalItems.map((item) => {
              const IconComponent = item.iconLibrary === 'MaterialCommunityIcons' ? MaterialCommunityIcons : MaterialIcons;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.settingItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIconContainer, { backgroundColor: item.color }]}>
                      <IconComponent name={item.iconName as any} size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={styles.settingTitle}>{item.title}</Text>
                      <Text style={styles.settingDescription}>{item.description}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 알림 설정 */}
        <View style={styles.settingsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🔔</Text>
            <Text style={styles.sectionTitle}>알림 설정</Text>
          </View>
          <View style={styles.settingsList}>
            {/* 푸시 알림 전체 토글 */}
            {notificationSettingsList.filter(setting => setting.id === 'push_notification_enabled').map((setting) => (
              <View key={setting.id} style={styles.settingItem}>
                <TouchableOpacity
                  style={styles.settingLeft}
                  onPress={toggleNotificationExpanded}
                  activeOpacity={0.7}
                >
                  <Text style={styles.settingTitle}>
                    {setting.title}
                  </Text>
                  {setting.description && (
                    <Text style={styles.settingDescription}>
                      {setting.description}
                    </Text>
                  )}
                  <Text style={styles.expandHint}>
                    {isNotificationExpanded ? '상세 설정 접기' : '상세 설정 보기'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.settingRight}>
                  <Switch
                    value={setting.value}
                    onValueChange={(value) => updateNotificationSetting(setting.id, value)}
                    trackColor={{ false: '#E5E5E7', true: '#34B79F' }}
                    thumbColor={setting.value ? '#FFFFFF' : '#FFFFFF'}
                  />
                  <TouchableOpacity
                    onPress={toggleNotificationExpanded}
                    activeOpacity={0.7}
                    style={{ marginLeft: 8, padding: 4 }}
                  >
                    <Animated.View
                      style={{
                        transform: [{
                          rotate: slideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '180deg'],
                          }),
                        }],
                      }}
                    >
                      <Ionicons 
                        name="chevron-down" 
                        size={20} 
                        color="#C7C7CC"
                      />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {/* 상세 알림 설정들 (접힘/펼침) */}
            {isNotificationExpanded && (
              <Animated.View
                style={{
                  opacity: slideAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.5, 1],
                  }),
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  }],
                }}
              >
                {notificationSettingsList
                  .filter(setting => setting.id !== 'push_notification_enabled')
                  .map((setting) => (
                    <View key={setting.id} style={[styles.settingItem, styles.nestedSettingItem]}>
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
                        onValueChange={(value) => updateNotificationSetting(setting.id, value)}
                        trackColor={{ false: '#E5E5E7', true: '#34B79F' }}
                        thumbColor={setting.value ? '#FFFFFF' : '#FFFFFF'}
                        disabled={setting.disabled}
                      />
                    </View>
                  ))}
                <View style={styles.nestedInfoBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#34B79F" />
                  <Text style={styles.nestedInfoText}>
                    각 알림을 개별적으로 켜거나 끌 수 있습니다
                  </Text>
                </View>
              </Animated.View>
            )}
          </View>
        </View>

        {/* 개인정보 보호 및 약관 */}
        <View style={styles.settingsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🛡️</Text>
            <Text style={styles.sectionTitle}>개인정보 보호 및 약관</Text>
          </View>
          <View style={styles.settingsList}>
            {privacyItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.settingItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: item.color }]}>
                    <Ionicons name={item.iconName as any} size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    <Text style={styles.settingDescription}>{item.description}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 로그아웃 버튼 */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>로그아웃</Text>
          </TouchableOpacity>
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

  // 사용자 정보 카드
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34B79F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageReal: {
    width: '100%',
    height: '100%',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#F0F9F7',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  userRole: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 6,
    fontWeight: '500',
  },

  // 사용자 정보 리스트
  userInfoList: {
    gap: 16,
  },
  userInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfoLabel: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  userInfoValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
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
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nestedSettingItem: {
    paddingLeft: 40, // 들여쓰기로 상세 설정임을 표시
    backgroundColor: '#FAFAFA',
  },
  expandHint: {
    fontSize: 12,
    color: '#34B79F',
    marginTop: 6,
    fontWeight: '500',
  },
  nestedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 40,
    backgroundColor: '#F0F9F7',
    borderLeftWidth: 3,
    borderLeftColor: '#34B79F',
    marginTop: 4,
    marginHorizontal: 0,
  },
  nestedInfoText: {
    fontSize: 13,
    color: '#34B79F',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  settingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
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

  // 로그아웃 섹션
  logoutSection: {
    marginTop: 20,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutButtonText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 20,
  },
});
