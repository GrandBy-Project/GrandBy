/**
 * 보호자 전용 홈 화면
 */
import React, { useState } from 'react';
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

type TabType = 'family' | 'health' | 'communication' | 'profile';

export const GuardianHomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [currentElderlyIndex, setCurrentElderlyIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('family');

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

  // 어르신 추가 카드를 포함한 전체 데이터
  const elderlyWithAddCard = [...connectedElderly, { id: 'add-new', type: 'add' }];
  
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

  // 탭별 컨텐츠 렌더링
  const renderFamilyTab = () => (
    <>
      {/* 연결된 어르신 프로필 */}
      {connectedElderly.length > 0 ? (
        <View style={styles.elderlyCard}>
          <View style={styles.elderlyCardHeader}>
            <View style={styles.elderlyProfileInfo}>
              <View style={styles.elderlyProfileImageContainer}>
                <Text style={styles.elderlyProfileImage}>
                  {currentElderly.profileImage}
                </Text>
                <View style={[
                  styles.healthStatusDot,
                  { backgroundColor: getHealthStatusColor(currentElderly.healthStatus) }
                ]} />
              </View>
              <View style={styles.elderlyProfileText}>
                <Text style={styles.elderlyName}>{currentElderly.name}</Text>
                <Text style={styles.elderlyAge}>{currentElderly.age}세</Text>
                <Text style={styles.elderlyLastActivity}>마지막 활동: {currentElderly.lastActivity}</Text>
              </View>
            </View>
            <View style={styles.elderlyHealthStatus}>
              <Text style={[
                styles.healthStatusText,
                { color: getHealthStatusColor(currentElderly.healthStatus) }
              ]}>
                {getHealthStatusText(currentElderly.healthStatus)}
              </Text>
            </View>
          </View>
          
          <View style={styles.elderlyStatsContainer}>
            <View style={styles.elderlyStat}>
              <Text style={styles.elderlyStatNumber}>
                {currentElderly.todayTasksCompleted}/{currentElderly.todayTasksTotal}
              </Text>
              <Text style={styles.elderlyStatLabel}>오늘 할일</Text>
            </View>
            <View style={styles.elderlyStatDivider} />
            <View style={styles.elderlyStat}>
              <Text style={styles.elderlyStatNumber}>
                {Math.round((currentElderly.todayTasksCompleted / currentElderly.todayTasksTotal) * 100)}%
              </Text>
              <Text style={styles.elderlyStatLabel}>완료율</Text>
            </View>
            <View style={styles.elderlyStatDivider} />
            <TouchableOpacity style={styles.elderlyStat}>
              <Text style={styles.elderlyStatNumber}>📞</Text>
              <Text style={styles.elderlyStatLabel}>긴급연락</Text>
            </TouchableOpacity>
          </View>

          {/* 어르신 네비게이션 */}
          {connectedElderly.length > 1 && (
            <View style={styles.elderlyNavigation}>
              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => {
                  const newIndex = currentElderlyIndex > 0 ? currentElderlyIndex - 1 : connectedElderly.length - 1;
                  setCurrentElderlyIndex(newIndex);
                }}
              >
                <Text style={styles.navButtonText}>◀</Text>
              </TouchableOpacity>
              
              <View style={styles.pageIndicator}>
                {connectedElderly.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.pageIndicatorDot,
                      index === currentElderlyIndex && styles.pageIndicatorDotActive
                    ]}
                    onPress={() => setCurrentElderlyIndex(index)}
                  />
                ))}
              </View>
              
              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => {
                  const newIndex = currentElderlyIndex < connectedElderly.length - 1 ? currentElderlyIndex + 1 : 0;
                  setCurrentElderlyIndex(newIndex);
                }}
              >
                <Text style={styles.navButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 어르신 추가 버튼 */}
          <TouchableOpacity 
            style={styles.addElderlyButton}
            onPress={() => Alert.alert('준비중', '어르신 추가 기능은 개발 중입니다.')}
            activeOpacity={0.7}
          >
            <Text style={styles.addElderlyButtonText}>+ 어르신 추가하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* 연결된 어르신이 없을 때 */
        <TouchableOpacity 
          style={[styles.elderlyCard, styles.addElderlyCard]}
          onPress={() => Alert.alert('준비중', '어르신 추가 기능은 개발 중입니다.')}
          activeOpacity={0.7}
        >
          <View style={styles.addElderlyContent}>
            <View style={styles.addElderlyIconContainer}>
              <Text style={styles.addElderlyIcon}>+</Text>
            </View>
            <Text style={styles.addElderlyTitle}>어르신 추가하기</Text>
            <Text style={styles.addElderlySubtitle}>새로운 어르신을 연결해보세요</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 오늘 섹션 */}
      {connectedElderly.length > 0 && (
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
      )}
    </>
  );

  const renderHealthTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.healthSection}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionIcon}>⚕️</Text>
          <Text style={styles.sectionTitle}>건강관리</Text>
        </View>
        
        {/* 복약 관리 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleContainer}>
              <Text style={styles.healthCardIcon}>💊</Text>
              <Text style={styles.healthCardTitle}>복약 관리</Text>
            </View>
            <Text style={styles.healthCardStatus}>오늘 2/3</Text>
          </View>
          <Text style={styles.healthCardDesc}>아침, 점심 복용 완료</Text>
        </View>

        {/* 병원 일정 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleContainer}>
              <Text style={styles.healthCardIcon}>🏥</Text>
              <Text style={styles.healthCardTitle}>병원 일정</Text>
            </View>
            <Text style={styles.healthCardStatus}>이번 주</Text>
          </View>
          <Text style={styles.healthCardDesc}>정형외과 - 10월 16일 오후 2시</Text>
        </View>

        {/* 운동 기록 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleContainer}>
              <Text style={styles.healthCardIcon}>🏃</Text>
              <Text style={styles.healthCardTitle}>운동 기록</Text>
            </View>
            <Text style={styles.healthCardStatus}>주 3회</Text>
          </View>
          <Text style={styles.healthCardDesc}>산책 30분, 스트레칭 완료</Text>
        </View>

        {/* 식사 관리 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleContainer}>
              <Text style={styles.healthCardIcon}>🍽️</Text>
              <Text style={styles.healthCardTitle}>식사 관리</Text>
            </View>
            <Text style={styles.healthCardStatus}>규칙적</Text>
          </View>
          <Text style={styles.healthCardDesc}>아침, 점심 식사 완료</Text>
        </View>
      </View>
    </View>
  );

  const renderCommunicationTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.communicationSection}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionIcon}>💬</Text>
          <Text style={styles.sectionTitle}>소통</Text>
        </View>
        
        {/* AI 통화 내역 */}
        <View style={styles.commCard}>
          <View style={styles.commCardHeader}>
            <View style={styles.commCardTitleContainer}>
              <Text style={styles.commCardIcon}>📞</Text>
              <Text style={styles.commCardTitle}>AI 통화 내역</Text>
            </View>
            <Text style={styles.commCardTime}>오늘 오후 7시</Text>
          </View>
          <Text style={styles.commCardContent}>안부 인사 및 오늘 하루 일과 확인</Text>
          <View style={styles.moodContainer}>
            <Text style={styles.moodIcon}>😊</Text>
            <Text style={styles.commCardMood}>기분: 좋음</Text>
          </View>
        </View>

        {/* 일기 */}
        <View style={styles.commCard}>
          <View style={styles.commCardHeader}>
            <View style={styles.commCardTitleContainer}>
              <Text style={styles.commCardIcon}>📖</Text>
              <Text style={styles.commCardTitle}>최근 일기</Text>
            </View>
            <Text style={styles.commCardTime}>10월 13일</Text>
          </View>
          <Text style={styles.commCardContent}>오늘은 날씨가 좋아서 산책을 했다. 기분이 상쾌했다.</Text>
          <View style={styles.moodContainer}>
            <Text style={styles.moodIcon}>😌</Text>
            <Text style={styles.commCardMood}>감정: 평온함</Text>
          </View>
        </View>

        {/* 감정 분석 */}
        <View style={styles.commCard}>
          <View style={styles.commCardHeader}>
            <View style={styles.commCardTitleContainer}>
              <Text style={styles.commCardIcon}>💭</Text>
              <Text style={styles.commCardTitle}>감정 분석</Text>
            </View>
            <Text style={styles.commCardTime}>이번 주</Text>
          </View>
          <Text style={styles.commCardContent}>전반적으로 안정적인 감정 상태를 보이고 있습니다.</Text>
          <View style={styles.emotionTags}>
            <View style={styles.emotionTagWithIcon}>
              <Text style={styles.emotionIcon}>😊</Text>
              <Text style={styles.emotionTag}>긍정 70%</Text>
            </View>
            <View style={styles.emotionTagWithIcon}>
              <Text style={styles.emotionIcon}>😌</Text>
              <Text style={styles.emotionTag}>평온 25%</Text>
            </View>
            <View style={styles.emotionTagWithIcon}>
              <Text style={styles.emotionIcon}>😔</Text>
              <Text style={styles.emotionTag}>우울 5%</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.profileSection}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionIcon}>👤</Text>
          <Text style={styles.sectionTitle}>내 정보</Text>
        </View>
        
        {/* 보호자 프로필 */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              <Text style={styles.profileImageText}>👤</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || '사용자'}님</Text>
              <Text style={styles.profileRole}>보호자</Text>
              <Text style={styles.profileEmail}>{user?.email || 'user@example.com'}</Text>
            </View>
          </View>
        </View>

        {/* 설정 메뉴 */}
        <View style={styles.settingsSection}>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingIcon}>🔔</Text>
            <Text style={styles.settingText}>알림 설정</Text>
            <Text style={styles.settingArrow}>{'>'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingIcon}>👥</Text>
            <Text style={styles.settingText}>연결 관리</Text>
            <Text style={styles.settingArrow}>{'>'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingIcon}>🔒</Text>
            <Text style={styles.settingText}>개인정보 설정</Text>
            <Text style={styles.settingArrow}>{'>'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingIcon}>❓</Text>
            <Text style={styles.settingText}>도움말</Text>
            <Text style={styles.settingArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* 로그아웃 버튼 */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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

  // 탭 데이터
  const tabs = [
    { id: 'family', label: '가족', icon: '👥' },
    { id: 'health', label: '건강관리', icon: '⚕️' },
    { id: 'communication', label: '소통', icon: '💬' },
    { id: 'profile', label: '내정보', icon: '👤' },
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

      {/* 탭 네비게이션 */}
      <View style={styles.tabNavigation}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && styles.tabButtonActive
            ]}
            onPress={() => setActiveTab(tab.id as TabType)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabIcon,
              { color: activeTab === tab.id ? '#34B79F' : '#999999' }
            ]}>
              {tab.icon}
            </Text>
            <Text style={[
              styles.tabLabel,
              activeTab === tab.id && styles.tabLabelActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 탭 컨텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'family' && renderFamilyTab()}
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'communication' && renderCommunicationTab()}
        {activeTab === 'profile' && renderProfileTab()}

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
  
  // 탭 네비게이션
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#34B79F',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#34B79F',
    fontWeight: '600',
  },

  // 탭 컨텐츠
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginLeft: 8,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  healthCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthCardIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  commCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commCardIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  moodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  emotionTagWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  emotionIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  
  elderlyCard: {
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

  // 어르신 네비게이션
  elderlyNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 16,
    color: '#34B79F',
    fontWeight: '600',
  },
  addElderlyButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    alignItems: 'center',
  },
  addElderlyButtonText: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '500',
  },

  // 건강관리 탭
  healthSection: {
    flex: 1,
  },
  healthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  healthCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
  },
  healthCardStatus: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '500',
  },
  healthCardDesc: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },

  // 소통 탭
  communicationSection: {
    flex: 1,
  },
  commCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  commCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
  },
  commCardTime: {
    fontSize: 12,
    color: '#999999',
  },
  commCardContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 8,
  },
  commCardMood: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '500',
    marginLeft: 4,
  },
  emotionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  emotionTag: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },

  // 프로필 탭
  profileSection: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileImageText: {
    fontSize: 32,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '500',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666666',
  },
  settingsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  settingArrow: {
    fontSize: 16,
    color: '#999999',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },

  // 어르신 추가 카드
  addElderlyCard: {
    backgroundColor: '#34B79F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addElderlyContent: {
    alignItems: 'center',
  },
  addElderlyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addElderlyIcon: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  addElderlyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  addElderlySubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
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
    justifyContent: 'center',
    flexDirection: 'row',
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

