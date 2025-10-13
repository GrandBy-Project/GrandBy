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

  // 오늘의 할일 데이터
  const todayTasks = [
    {
      id: 1,
      icon: '💊',
      title: '아침 약 드시기',
      completed: false,
    },
    {
      id: 2,
      icon: '🏥',
      title: '병원 방문 (정형외과, 오후 4시)',
      completed: false,
    },
    {
      id: 3,
      icon: '💊',
      title: '고혈압 약 처방 받아오기',
      completed: false,
    },
  ];

  // 현재 날짜 정보
  const today = new Date();
  const dateString = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayString = dayNames[today.getDay()];

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 프로필 섹션 */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Text style={styles.profileImage}>👴</Text>
          </View>
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileGreeting}>안녕하세요!</Text>
            <Text style={styles.profileName}>{user?.name || '사용자'}님</Text>
          </View>
        </View>

        {/* 오늘 섹션 */}
        <View style={styles.todaySection}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayTitle}>오늘</Text>
            <View style={styles.dateTag}>
              <Text style={styles.dateText}>{dateString} {dayString}</Text>
            </View>
          </View>

          {/* 할일 목록 */}
          <View style={styles.tasksList}>
            {todayTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                activeOpacity={0.7}
              >
                <Text style={styles.taskIcon}>{task.icon}</Text>
                <Text style={styles.taskTitle}>{task.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 새 할일 추가 버튼 */}
          <TouchableOpacity
            style={styles.addTaskButton}
            activeOpacity={0.7}
          >
            <Text style={styles.addTaskText}>+ 새로운 할 일 추가하기</Text>
          </TouchableOpacity>
        </View>

        {/* 최근 다이어리 섹션 */}
        <View style={styles.diarySection}>
          <View style={styles.diaryHeader}>
            <View style={styles.diaryTitleContainer}>
              <Text style={styles.diaryIcon}>📖</Text>
              <Text style={styles.diaryTitle}>최근 다이어리</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>전체보기 {'>'}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.diaryPlaceholder}>
            <Text style={styles.diaryPlaceholderText}>다이어리가 없습니다</Text>
          </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  
  // 프로필 섹션
  profileSection: {
    backgroundColor: '#34B79F',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileImage: {
    fontSize: 40,
  },
  profileTextContainer: {
    flex: 1,
  },
  profileGreeting: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // 오늘 섹션
  todaySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  dateTag: {
    backgroundColor: '#34B79F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  tasksList: {
    marginBottom: 16,
  },
  taskItem: {
    backgroundColor: '#E0F7F4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    flex: 1,
  },
  addTaskButton: {
    borderWidth: 2,
    borderColor: '#34B79F',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addTaskText: {
    fontSize: 16,
    color: '#34B79F',
    fontWeight: '500',
  },

  // 다이어리 섹션
  diarySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  diaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  diaryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diaryIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  diaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#999999',
  },
  diaryPlaceholder: {
    backgroundColor: '#34B79F',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  diaryPlaceholderText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // 로그아웃 버튼
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

