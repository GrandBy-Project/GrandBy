/**
 * 어르신 전용 홈 화면
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

export const ElderlyHomeScreen = () => {
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
      id: 'diary',
      title: '일기',
      icon: '📖',
      color: '#FFB6C1',
      onPress: () => Alert.alert('준비중', '일기 기능은 개발 중입니다.'),
    },
    {
      id: 'call',
      title: 'AI 통화',
      icon: '📞',
      color: '#87CEEB',
      onPress: () => Alert.alert('준비중', 'AI 통화 기능은 개발 중입니다.'),
    },
    {
      id: 'todo',
      title: '할 일',
      icon: '✅',
      color: '#98FB98',
      onPress: () => Alert.alert('준비중', '할일 기능은 개발 중입니다.'),
    },
    {
      id: 'notification',
      title: '알림',
      icon: '🔔',
      color: '#DDA0DD',
      onPress: () => Alert.alert('준비중', '알림 기능은 개발 중입니다.'),
    },
  ];

  // 현재 날짜 정보
  const today = new Date();
  const dateString = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayString = dayNames[today.getDay()];

  // 설정 버튼 컴포넌트
  const SettingsButton = () => (
    <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
      <Text style={styles.logoutText}>⚙️</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        rightButton={<SettingsButton />}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 사용자 정보 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>👴</Text>
            </View>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>안녕하세요!</Text>
              <Text style={styles.userName}>{user?.name || '사용자'}님</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.todaySection}>
            <View style={styles.todayBadge}>
              <Text style={styles.todayText}>오늘</Text>
            </View>
            <Text style={styles.dateText}>
              {dateString} {dayString}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.reminderSection}>
            <Text style={styles.reminderText}>
              💊 오후 4시에 정형외과 진료가 잡혀있어요!
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.weatherSection}>
            <Text style={styles.weatherIcon}>🌧️</Text>
            <Text style={styles.weatherText}>
              오늘은 비소식이 있으니 외출 하실 때 우산을 챙기시는게 좋겠네요.
            </Text>
          </View>
        </View>

        {/* 메뉴 섹션 */}
        <View style={styles.menuSection}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuHeaderIcon}>💡</Text>
            <Text style={styles.menuHeaderText}>원하시는 메뉴를 선택해주세요.</Text>
          </View>

          <View style={styles.menuGrid}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuCard, { backgroundColor: item.color }]}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
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
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profileCard: {
    margin: 20,
    marginTop: 20,
    backgroundColor: '#40B59F',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarContainer: {
    width: 71,
    height: 71,
    borderRadius: 35.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 40,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 5,
  },
  userName: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 12,
  },
  todaySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  todayText: {
    fontSize: 16,
    color: '#40B59F',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  reminderSection: {
    paddingVertical: 5,
  },
  reminderText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
  },
  weatherSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  weatherIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  weatherText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
  },
  menuSection: {
    padding: 20,
    paddingTop: 10,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  menuHeaderIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  menuHeaderText: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '500',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  menuIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 20,
  },
});

