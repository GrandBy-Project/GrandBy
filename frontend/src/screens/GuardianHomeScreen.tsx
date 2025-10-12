/**
 * 보호자 전용 홈 화면
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

export const GuardianHomeScreen = () => {
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

  const menuItems = [
    {
      id: 'diaries',
      title: '일기 관리',
      description: '어르신의 일기 확인',
      icon: '📖',
      color: '#FF9500',
      onPress: () => Alert.alert('준비중', '일기 관리 기능은 개발 중입니다.'),
    },
    {
      id: 'calls',
      title: 'AI 통화 내역',
      description: '통화 기록 확인',
      icon: '📞',
      color: '#007AFF',
      onPress: () => Alert.alert('준비중', 'AI 통화 내역 기능은 개발 중입니다.'),
    },
    {
      id: 'todos',
      title: '할일 관리',
      description: '할일 등록 및 관리',
      icon: '✅',
      color: '#34C759',
      onPress: () => Alert.alert('준비중', '할일 관리 기능은 개발 중입니다.'),
    },
    {
      id: 'connections',
      title: '연결 관리',
      description: '어르신과의 연결',
      icon: '👥',
      color: '#FF2D55',
      onPress: () => Alert.alert('준비중', '연결 관리 기능은 개발 중입니다.'),
    },
    {
      id: 'notifications',
      title: '알림 설정',
      description: '알림 스케줄 관리',
      icon: '🔔',
      color: '#5856D6',
      onPress: () => Alert.alert('준비중', '알림 설정 기능은 개발 중입니다.'),
    },
    {
      id: 'dashboard',
      title: '대시보드',
      description: '감정 분석 및 통계',
      icon: '📊',
      color: '#AF52DE',
      onPress: () => Alert.alert('준비중', '대시보드 기능은 개발 중입니다.'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header />

      {/* 사용자 인사말 */}
      <View style={styles.greetingSection}>
        <View>
          <Text style={styles.greeting}>안녕하세요,</Text>
          <Text style={styles.userName}>{user?.name || '보호자'}님! 👋</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userRole}>👨‍👩‍👧 보호자</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 요약 카드 */}
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>연결된 어르신</Text>
            <Text style={styles.summaryValue}>2명</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>오늘의 일기</Text>
            <Text style={styles.summaryValue}>1개</Text>
          </View>
        </View>

        {/* 메뉴 그리드 */}
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, { borderLeftColor: item.color }]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 로그아웃 버튼 */}
        <View style={styles.footer}>
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
  greetingSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  userInfo: {
    marginTop: 12,
  },
  userRole: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    backgroundColor: '#E3F2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  menuGrid: {
    gap: 12,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 14,
    color: '#666666',
  },
  footer: {
    marginTop: 24,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  logoutButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 20,
  },
});

