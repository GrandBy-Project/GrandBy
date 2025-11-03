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
import { useResponsive, getResponsiveFontSize, getResponsivePadding, getResponsiveSize } from '../hooks/useResponsive';
import { getConnections, deleteConnection, ConnectionWithUserInfo } from '../api/connections';

export const MyPageScreen = () => {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { fontSizeLevel } = useFontSizeStore();
  const { scale } = useResponsive();
  const [isUploading, setIsUploading] = useState(false);
  const [isNotificationExpanded, setIsNotificationExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [connectedCaregivers, setConnectedCaregivers] = useState<ConnectionWithUserInfo[]>([]);
  const [isLoadingCaregivers, setIsLoadingCaregivers] = useState(false);

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

  // 연결된 보호자 목록 로드 (어르신만)
  useEffect(() => {
    if (user?.role === UserRole.ELDERLY) {
      loadConnectedCaregivers();
    }
  }, [user]);

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
        description: '모든 알림을 켜거나 끕니다',
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

  // 연결된 보호자 목록 로드
  const loadConnectedCaregivers = async () => {
    try {
      setIsLoadingCaregivers(true);
      const response = await getConnections();
      setConnectedCaregivers(response.active || []);
      console.log('✅ 연결된 보호자 목록 로드 성공:', response.active?.length || 0);
    } catch (error: any) {
      console.error('연결된 보호자 목록 로드 실패:', error);
      setConnectedCaregivers([]);
    } finally {
      setIsLoadingCaregivers(false);
    }
  };

  // 연결 해제 처리
  const handleDisconnectCaregiver = (caregiver: ConnectionWithUserInfo) => {
    Alert.alert(
      '연결 해제',
      `${caregiver.name} 보호자와의 연결을 해제하시겠습니까?\n\n연결 해제 후:\n• 해당 보호자는 할 일을 추가할 수 없습니다\n• 해당 보호자는 일기장을 볼 수 없습니다\n• 연결을 다시 설정하려면 보호자가 다시 요청해야 합니다`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoadingCaregivers(true);
              await deleteConnection(caregiver.connection_id);
              Alert.alert('완료', '연결이 해제되었습니다.');
              // 목록 새로고침
              await loadConnectedCaregivers();
            } catch (error: any) {
              console.error('연결 해제 실패:', error);
              const errorMessage = error.response?.data?.detail || '연결 해제 중 오류가 발생했습니다.';
              Alert.alert('오류', errorMessage);
            } finally {
              setIsLoadingCaregivers(false);
            }
          },
        },
      ]
    );
  };

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
      color: '#4bbcfb', // 파스텔 블루
      onPress: () => router.push('/profile-edit'),
    },
    {
      id: 'password-change',
      title: '비밀번호 변경',
      description: '계정 보안을 위한 비밀번호 변경',
      iconName: 'lock-reset' as const,
      iconLibrary: 'MaterialCommunityIcons' as const,
      color: '#fb9a4b', // 파스텔 오렌지
      onPress: () => router.push('/change-password'),
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
      color: '#83fb4b', // 파스텔 그린
      onPress: () => Alert.alert('개인정보 처리방침', '개인정보 처리방침을 확인할 수 있습니다.'),
    },
    {
      id: 'terms',
      title: '이용약관',
      description: '서비스 이용약관',
      iconName: 'document-text' as const,
      iconLibrary: 'Ionicons' as const,
      color: '#ce4bfb', // 파스텔 퍼플
      onPress: () => Alert.alert('이용약관', '서비스 이용약관을 확인할 수 있습니다.'),
    }
  ];

  // 반응형 크기 계산
  const sectionIconSize = getResponsiveSize(44, scale);
  const sectionIconFontSize = getResponsiveFontSize(20, scale);
  const sectionTitleFontSize = getResponsiveFontSize(18, scale);
  const sectionHeaderMarginBottom = getResponsivePadding(12, scale);
  const sectionPadding = getResponsivePadding(16, scale);
  const sectionMarginBottom = getResponsivePadding(24, scale);
  const sectionIconMarginRight = getResponsivePadding(12, scale);
  
  // 설정 아이템 반응형 크기
  const settingIconSize = getResponsiveSize(44, scale);
  const settingIconInnerSize = getResponsiveFontSize(20, scale);
  const settingIconMarginRight = getResponsivePadding(16, scale);
  const settingItemPadding = getResponsivePadding(20, scale);
  const settingTitleFontSize = getResponsiveFontSize(16, scale);
  const settingDescriptionFontSize = getResponsiveFontSize(14, scale);
  const expandHintFontSize = getResponsiveFontSize(12, scale);
  const nestedPaddingLeft = getResponsivePadding(40, scale);

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
              <TouchableOpacity
                key={item.id}
                style={styles.userInfoItem}
                onPress={() => router.push('/profile-edit')}
                activeOpacity={0.7}
              >
                <View style={styles.userInfoLeft}>
                  <View style={styles.userInfoIconContainer}>
                    <Ionicons name={item.iconName as any} size={20} color="#34B79F" />
                  </View>
                  <Text style={styles.userInfoLabel}>{item.label}</Text>
                </View>
                <Text style={styles.userInfoValue}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 연결된 보호자 관리 (어르신만) */}
        {user?.role === UserRole.ELDERLY && (
          <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
            <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
              <View style={[
                styles.sectionIconContainer,
                { 
                  width: sectionIconSize,
                  height: sectionIconSize,
                  borderRadius: sectionIconSize / 2,
                  marginRight: sectionIconMarginRight,
                }
              ]}>
                <Ionicons name="people-outline" size={sectionIconFontSize} color="#34B79F" />
              </View>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>연결된 보호자</Text>
            </View>
            <View style={styles.settingsList}>
              {isLoadingCaregivers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#34B79F" />
                  <Text style={styles.loadingText}>로딩 중...</Text>
                </View>
              ) : connectedCaregivers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={getResponsiveFontSize(48, scale)} color="#C7C7CC" />
                  <Text style={[styles.emptyText, { fontSize: getResponsiveFontSize(14, scale) }]}>
                    연결된 보호자가 없습니다
                  </Text>
                </View>
              ) : (
                connectedCaregivers.map((caregiver) => (
                  <View key={caregiver.connection_id} style={[styles.settingItem, { padding: settingItemPadding }]}>
                    <View style={styles.settingLeft}>
                      <View style={[
                        styles.settingIconContainer,
                        {
                          backgroundColor: '#E8F5E9',
                          width: settingIconSize,
                          height: settingIconSize,
                          borderRadius: settingIconSize / 2,
                          marginRight: settingIconMarginRight,
                        }
                      ]}>
                        <Ionicons name="person" size={settingIconInnerSize} color="#4CAF50" />
                      </View>
                      <View style={styles.settingTextContainer}>
                        <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]} numberOfLines={1}>
                          {caregiver.name}
                        </Text>
                        {caregiver.email && (
                          <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                            {caregiver.email}
                          </Text>
                        )}
                        {caregiver.phone_number && (
                          <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                            {caregiver.phone_number}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDisconnectCaregiver(caregiver)}
                      activeOpacity={0.7}
                      style={styles.disconnectButton}
                    >
                      <Text style={[styles.disconnectButtonText, { fontSize: getResponsiveFontSize(14, scale) }]}>
                        해제
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* 개인정보 관리 */}
        <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
          <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
            <View style={[
              styles.sectionIconContainer,
              { 
                width: sectionIconSize,
                height: sectionIconSize,
                borderRadius: sectionIconSize / 2,
                marginRight: sectionIconMarginRight,
              }
            ]}>
              <Ionicons name="settings-outline" size={sectionIconFontSize} color="#34B79F" />
            </View>
            <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>개인정보 관리</Text>
          </View>
          <View style={styles.settingsList}>
            {personalItems.map((item) => {
              const IconComponent = item.iconLibrary === 'MaterialCommunityIcons' ? MaterialCommunityIcons : MaterialIcons;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.settingItem, { padding: settingItemPadding }]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <View style={[
                      styles.settingIconContainer, 
                      { 
                        backgroundColor: item.color,
                        width: settingIconSize,
                        height: settingIconSize,
                        borderRadius: settingIconSize / 2,
                        marginRight: settingIconMarginRight,
                      }
                    ]}>
                      <IconComponent name={item.iconName as any} size={settingIconInnerSize} color="#FFFFFF" />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]}>{item.title}</Text>
                      <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]}>{item.description}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={getResponsiveFontSize(24, scale)} color="#C7C7CC" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 알림 설정 */}
        <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
          <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
            <View style={[
              styles.sectionIconContainer,
              { 
                width: sectionIconSize,
                height: sectionIconSize,
                borderRadius: sectionIconSize / 2,
                marginRight: sectionIconMarginRight,
              }
            ]}>
              <Ionicons name="notifications-outline" size={sectionIconFontSize} color="#34B79F" />
            </View>
            <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>알림 설정</Text>
          </View>
          <View style={styles.settingsList}>
            {/* 푸시 알림 전체 토글 */}
            {notificationSettingsList.filter(setting => setting.id === 'push_notification_enabled').map((setting) => (
              <TouchableOpacity
                key={setting.id}
                style={[styles.settingItem, { padding: settingItemPadding }]}
                onPress={toggleNotificationExpanded}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[
                    styles.settingIconContainer,
                    {
                      backgroundColor: '#fbd54b', // 파스텔 민트
                      width: settingIconSize,
                      height: settingIconSize,
                      borderRadius: settingIconSize / 2,
                      marginRight: settingIconMarginRight,
                    }
                  ]}>
                    <Ionicons name="notifications" size={settingIconInnerSize} color="#ffffff" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]} numberOfLines={1}>
                      {setting.title}
                    </Text>
                    {setting.description && (
                      <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                        {setting.description}
                      </Text>
                    )}
                    <Text style={[styles.expandHint, { fontSize: expandHintFontSize }]}>
                      {isNotificationExpanded ? '상세 설정 접기' : '상세 설정 보기'}
                    </Text>
                  </View>
                </View>
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
                    style={{ marginLeft: getResponsivePadding(8, scale), padding: getResponsivePadding(4, scale) }}
                  >
                    <Ionicons 
                      name={isNotificationExpanded ? "chevron-down" : "chevron-forward"} 
                      size={getResponsiveFontSize(20, scale)} 
                      color="#C7C7CC"
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
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
                    <View key={setting.id} style={[
                      styles.settingItem, 
                      styles.nestedSettingItem,
                      { 
                        padding: settingItemPadding,
                        paddingLeft: nestedPaddingLeft,
                      }
                    ]}>
                      <View style={styles.settingLeft}>
                        <View style={styles.settingTextContainer}>
                          <Text style={[
                            styles.settingTitle,
                            { fontSize: settingTitleFontSize },
                            setting.disabled && styles.disabledText
                          ]} numberOfLines={1}>
                            {setting.title}
                          </Text>
                          {setting.description && (
                            <Text style={[
                              styles.settingDescription,
                              { fontSize: settingDescriptionFontSize },
                              setting.disabled && styles.disabledText
                            ]} numberOfLines={2}>
                              {setting.description}
                            </Text>
                          )}
                        </View>
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
              </Animated.View>
            )}
          </View>
        </View>

        {/* 개인정보 보호 및 약관 */}
        <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
          <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
            <View style={[
              styles.sectionIconContainer,
              { 
                width: sectionIconSize,
                height: sectionIconSize,
                borderRadius: sectionIconSize / 2,
                marginRight: sectionIconMarginRight,
              }
            ]}>
              <Ionicons name="shield-checkmark-outline" size={sectionIconFontSize} color="#34B79F" />
            </View>
            <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>개인정보 보호 및 약관</Text>
          </View>
          <View style={styles.settingsList}>
            {privacyItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.settingItem, { padding: settingItemPadding }]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[
                    styles.settingIconContainer, 
                    { 
                      backgroundColor: item.color,
                      width: settingIconSize,
                      height: settingIconSize,
                      borderRadius: settingIconSize / 2,
                      marginRight: settingIconMarginRight,
                    }
                  ]}>
                    <Ionicons name={item.iconName as any} size={settingIconInnerSize} color="#FFFFFF" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]}>{item.title}</Text>
                    <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]}>{item.description}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={getResponsiveFontSize(24, scale)} color="#C7C7CC" />
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
          
          {/* 계정 삭제 버튼 */}
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteAccountButtonText}>계정 삭제</Text>
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
    // marginBottom은 동적으로 적용
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    // marginBottom은 동적으로 적용
  },
  sectionIconContainer: {
    backgroundColor: '#F0F9F7',
    alignItems: 'center',
    justifyContent: 'center',
    // width, height, borderRadius, marginRight는 동적으로 적용
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#333333',
    // fontSize는 동적으로 적용
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
    // padding은 동적으로 적용
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    minHeight: 60, // 터치 영역 확보
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // 텍스트 오버플로우 방지
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nestedSettingItem: {
    // paddingLeft은 동적으로 적용
    backgroundColor: '#FAFAFA',
  },
  expandHint: {
    color: '#34B79F',
    marginTop: 6,
    fontWeight: '500',
    // fontSize는 동적으로 적용
  },
  settingIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // width, height, borderRadius, marginRight는 동적으로 적용
  },
  settingTextContainer: {
    flex: 1,
    minWidth: 0, // 텍스트 오버플로우 방지
  },
  settingTitle: {
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
    // fontSize는 동적으로 적용
  },
  settingDescription: {
    color: '#666666',
    marginTop: 4,
    lineHeight: 18,
    // fontSize는 동적으로 적용
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
    marginBottom: 12,
  },
  logoutButtonText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '700',
  },
  deleteAccountButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    fontSize: 14,
    color: '#999999',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#999999',
    textAlign: 'center',
    // fontSize는 동적으로 적용
  },
  disconnectButton: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  disconnectButtonText: {
    color: '#E53935',
    fontWeight: '600',
    // fontSize는 동적으로 적용
  },
  bottomSpacer: {
    height: 20,
  },
});
