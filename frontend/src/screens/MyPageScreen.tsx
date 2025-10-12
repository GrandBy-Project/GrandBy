/**
 * 마이페이지 화면 (어르신/보호자 공통)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { BottomNavigationBar, Header } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserRole } from '../types';

export const MyPageScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

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
      icon: '👤',
    },
    {
      id: 'email',
      label: '이메일',
      value: user?.email || '이메일 없음',
      icon: '📧',
    },
    {
      id: 'phone',
      label: '전화번호',
      value: user?.phone_number || '전화번호 없음',
      icon: '📱',
    },
    {
      id: 'role',
      label: '계정 유형',
      value: user?.role === UserRole.ELDERLY ? '👴 어르신' : '👨‍👩‍👧 보호자',
      icon: user?.role === UserRole.ELDERLY ? '👴' : '👨‍👩‍👧',
    },
  ];

  // 개인정보 관리 메뉴 항목들
  const personalItems = [
    {
      id: 'profile-edit',
      title: '프로필 수정',
      description: '이름, 전화번호 등 수정',
      icon: '✏️',
      color: '#007AFF',
      onPress: () => Alert.alert('준비중', '프로필 수정 기능은 개발 중입니다.'),
    },
    {
      id: 'password-change',
      title: '비밀번호 변경',
      description: '계정 보안을 위한 비밀번호 변경',
      icon: '🔐',
      color: '#FF9500',
      onPress: () => Alert.alert('준비중', '비밀번호 변경 기능은 개발 중입니다.'),
    },
    {
      id: 'account-delete',
      title: '계정 삭제',
      description: '계정을 완전히 삭제하기',
      icon: '🗑️',
      color: '#FF3B30',
      onPress: () => Alert.alert('계정 삭제', '계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 정말 삭제하시겠습니까?'),
    },
  ];

  // 개인정보 보호 및 약관 메뉴 항목들
  const privacyItems = [
    {
      id: 'privacy-policy',
      title: '개인정보 처리방침',
      description: '개인정보 수집 및 이용 방침',
      icon: '🛡️',
      color: '#34C759',
      onPress: () => Alert.alert('개인정보 처리방침', '개인정보 처리방침을 확인할 수 있습니다.'),
    },
    {
      id: 'terms',
      title: '이용약관',
      description: '서비스 이용약관',
      icon: '📋',
      color: '#5856D6',
      onPress: () => Alert.alert('이용약관', '서비스 이용약관을 확인할 수 있습니다.'),
    }
  ];

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="마이페이지"
        showBackButton={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 사용자 정보 카드 */}
        <View style={styles.userCard}>
          <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              <Text style={styles.profileImage}>
                {user?.role === UserRole.ELDERLY ? '👴' : '👨‍👩‍👧'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.name || '사용자'}</Text>
              <Text style={styles.userRole}>
                {user?.role === UserRole.ELDERLY ? '👴 어르신 계정' : '👨‍👩‍👧 보호자 계정'}
              </Text>
            </View>
          </View>

          {/* 사용자 정보 리스트 */}
          <View style={styles.userInfoList}>
            {userInfoItems.map((item, index) => (
              <View key={item.id} style={styles.userInfoItem}>
                <View style={styles.userInfoLeft}>
                  <Text style={styles.userInfoIcon}>{item.icon}</Text>
                  <Text style={styles.userInfoLabel}>{item.label}</Text>
                </View>
                <Text style={styles.userInfoValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 개인정보 관리 */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>개인정보 관리</Text>
          <View style={styles.settingsList}>
            {personalItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.settingItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: item.color }]}>
                    <Text style={styles.settingIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    <Text style={styles.settingDescription}>{item.description}</Text>
                  </View>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 개인정보 보호 및 약관 */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>개인정보 보호 및 약관</Text>
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
                    <Text style={styles.settingIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    <Text style={styles.settingDescription}>{item.description}</Text>
                  </View>
                </View>
                <Text style={styles.settingArrow}>›</Text>
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
  },
  profileImage: {
    fontSize: 40,
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
    fontSize: 16,
    color: '#666666',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
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
  userInfoIcon: {
    fontSize: 20,
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    paddingHorizontal: 4,
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
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingIcon: {
    fontSize: 20,
    color: '#FFFFFF',
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
  },
  settingArrow: {
    fontSize: 24,
    color: '#C7C7CC',
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
