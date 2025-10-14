/**
 * 보호자 전용 홈 화면
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { BottomNavigationBar, Header } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ElderlyProfile {
  id: string;
  name: string;
  age: number;
  profileImage: string;
  healthStatus: 'good' | 'normal' | 'attention';
  todayTasksCompleted: number;
  todayTasksTotal: number;
  lastActivity: string;
  emergencyContact: string;
}

interface Task {
  id: number;
  icon: string;
  title: string;
  completed: boolean;
}

export const GuardianHomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentElderlyIndex, setCurrentElderlyIndex] = useState(0);

  // 화면 너비
  const { width: screenWidth } = Dimensions.get('window');

  // 연결된 어르신 목업 데이터
  const connectedElderly: ElderlyProfile[] = [
    {
      id: '1',
      name: '김할머니',
      age: 78,
      profileImage: '👵',
      healthStatus: 'good',
      todayTasksCompleted: 3,
      todayTasksTotal: 5,
      lastActivity: '30분 전',
      emergencyContact: '010-1234-5678',
    },
    {
      id: '2',
      name: '박할아버지',
      age: 82,
      profileImage: '👴',
      healthStatus: 'attention',
      todayTasksCompleted: 1,
      todayTasksTotal: 4,
      lastActivity: '2시간 전',
      emergencyContact: '010-9876-5432',
    },
    {
      id: '3',
      name: '이할머니',
      age: 75,
      profileImage: '👵',
      healthStatus: 'normal',
      todayTasksCompleted: 4,
      todayTasksTotal: 4,
      lastActivity: '1시간 전',
      emergencyContact: '010-5555-1234',
    },
  ];

  const currentElderly = connectedElderly[currentElderlyIndex];

  const getHealthStatusColor = (status: 'good' | 'normal' | 'attention') => {
    switch (status) {
      case 'good': return '#34C759';
      case 'normal': return '#FF9500';
      case 'attention': return '#FF3B30';
      default: return '#999999';
    }
  };

  const getHealthStatusText = (status: 'good' | 'normal' | 'attention') => {
    switch (status) {
      case 'good': return '양호';
      case 'normal': return '보통';
      case 'attention': return '주의';
      default: return '알 수 없음';
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

  // 현재 선택된 어르신의 오늘 할일 데이터
  const getTodayTasksForElderly = (elderlyId: string): Task[] => {
    const tasksByElderly: Record<string, Task[]> = {
      '1': [
        { id: 1, icon: '💊', title: '아침 약 드시기', completed: true },
        { id: 2, icon: '🏃', title: '산책하기 (30분)', completed: true },
        { id: 3, icon: '🍽️', title: '점심 식사', completed: true },
        { id: 4, icon: '💊', title: '저녁 약 드시기', completed: false },
        { id: 5, icon: '📞', title: 'AI 통화 (오후 7시)', completed: false },
      ],
      '2': [
        { id: 1, icon: '💊', title: '혈압약 복용', completed: true },
        { id: 2, icon: '🏥', title: '병원 방문 (정형외과)', completed: false },
        { id: 3, icon: '🍽️', title: '식사 관리', completed: false },
        { id: 4, icon: '📞', title: 'AI 통화 확인', completed: false },
      ],
      '3': [
        { id: 1, icon: '💊', title: '당뇨약 복용', completed: true },
        { id: 2, icon: '🏃', title: '가벼운 운동', completed: true },
        { id: 3, icon: '👥', title: '이웃과 대화', completed: true },
        { id: 4, icon: '📞', title: 'AI 통화', completed: true },
      ],
    };
    return tasksByElderly[elderlyId] || [];
  };

  const todayTasks = getTodayTasksForElderly(currentElderly?.id || '1');

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
        {/* 연결된 어르신 프로필 슬라이드 */}
        <View style={styles.elderlyProfileSection}>
          <FlatList
            ref={flatListRef}
            data={connectedElderly}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setCurrentElderlyIndex(index);
            }}
            renderItem={({ item, index }) => (
              <View style={[styles.elderlyCard, { width: screenWidth - 32 }]}>
                <View style={styles.elderlyCardHeader}>
                  <View style={styles.elderlyProfileInfo}>
                    <View style={styles.elderlyProfileImageContainer}>
                      <Text style={styles.elderlyProfileImage}>{item.profileImage}</Text>
                      <View style={[
                        styles.healthStatusDot,
                        { backgroundColor: getHealthStatusColor(item.healthStatus) }
                      ]} />
                    </View>
                    <View style={styles.elderlyProfileText}>
                      <Text style={styles.elderlyName}>{item.name}</Text>
                      <Text style={styles.elderlyAge}>{item.age}세</Text>
                      <Text style={styles.elderlyLastActivity}>마지막 활동: {item.lastActivity}</Text>
                    </View>
                  </View>
                  <View style={styles.elderlyHealthStatus}>
                    <Text style={[
                      styles.healthStatusText,
                      { color: getHealthStatusColor(item.healthStatus) }
                    ]}>
                      {getHealthStatusText(item.healthStatus)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.elderlyStatsContainer}>
                  <View style={styles.elderlyStat}>
                    <Text style={styles.elderlyStatNumber}>
                      {item.todayTasksCompleted}/{item.todayTasksTotal}
                    </Text>
                    <Text style={styles.elderlyStatLabel}>오늘 할일</Text>
                  </View>
                  <View style={styles.elderlyStatDivider} />
                  <View style={styles.elderlyStat}>
                    <Text style={styles.elderlyStatNumber}>
                      {Math.round((item.todayTasksCompleted / item.todayTasksTotal) * 100)}%
                    </Text>
                    <Text style={styles.elderlyStatLabel}>완료율</Text>
                  </View>
                  <View style={styles.elderlyStatDivider} />
                  <TouchableOpacity style={styles.elderlyStat}>
                    <Text style={styles.elderlyStatNumber}>📞</Text>
                    <Text style={styles.elderlyStatLabel}>긴급연락</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          
          {/* 페이지 인디케이터 */}
          {connectedElderly.length > 1 && (
            <View style={styles.pageIndicator}>
              {connectedElderly.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pageIndicatorDot,
                    index === currentElderlyIndex && styles.pageIndicatorDotActive
                  ]}
                />
              ))}
            </View>
          )}
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
            {todayTasks.map((task: Task) => (
              <TouchableOpacity
                key={task.id}
                style={[
                  styles.taskItem,
                  task.completed && styles.taskItemCompleted
                ]}
                activeOpacity={0.7}
              >
                <Text style={styles.taskIcon}>{task.icon}</Text>
                <Text style={[
                  styles.taskTitle,
                  task.completed && styles.taskTitleCompleted
                ]}>
                  {task.title}
                </Text>
                {task.completed && (
                  <Text style={styles.taskCompletedIcon}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* 새 할일 추가 버튼 */}
          <TouchableOpacity
            style={styles.addTaskButton}
            onPress={() => router.push('/guardian-todo-add')}
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
  
  // 어르신 프로필 섹션
  elderlyProfileSection: {
    marginBottom: 20,
  },
  elderlyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  elderlyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  elderlyProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  elderlyProfileImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  elderlyProfileImage: {
    fontSize: 35,
  },
  healthStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  elderlyProfileText: {
    flex: 1,
  },
  elderlyName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  elderlyAge: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  elderlyLastActivity: {
    fontSize: 14,
    color: '#999999',
  },
  elderlyHealthStatus: {
    alignItems: 'center',
  },
  healthStatusText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  elderlyStatsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
  },
  elderlyStat: {
    flex: 1,
    alignItems: 'center',
  },
  elderlyStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34B79F',
    marginBottom: 4,
  },
  elderlyStatLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  elderlyStatDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  pageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  pageIndicatorDotActive: {
    backgroundColor: '#34B79F',
    width: 20,
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
  taskItemCompleted: {
    backgroundColor: '#F0F0F0',
    opacity: 0.7,
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
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  taskCompletedIcon: {
    fontSize: 18,
    color: '#34C759',
    fontWeight: '700',
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

