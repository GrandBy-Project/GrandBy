/**
 * 어르신 전용 홈 화면
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

export const ElderlyHomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isLargeView, setIsLargeView] = useState(false);

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

  const toggleLargeView = () => {
    setIsLargeView(!isLargeView);
  };


  // 현재 날짜 정보
  const today = new Date();
  const dateString = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayString = dayNames[today.getDay()];

  // 크게 보기 토글 버튼 컴포넌트
  const LargeViewButton = () => (
    <TouchableOpacity onPress={toggleLargeView} style={styles.largeViewButton}>
      <Text style={styles.largeViewText}>{isLargeView ? 'A-' : 'A+'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        rightButton={<LargeViewButton />}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 어르신 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>👴</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.greeting, isLargeView && styles.greetingLarge]}>안녕하세요!</Text>
              <Text style={[styles.userName, isLargeView && styles.userNameLarge]}>{user?.name || '사용자'}님</Text>
              <Text style={[styles.userStatus, isLargeView && styles.userStatusLarge]}>건강한 하루 보내세요</Text>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <Text style={styles.moreButtonText}>⋯</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.todaySection}>
            <View style={styles.todayBadge}>
              <Text style={[styles.todayText, isLargeView && styles.todayTextLarge]}>오늘</Text>
            </View>
            <Text style={[styles.dateText, isLargeView && styles.dateTextLarge]}>{dateString} {dayString}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.reminderSection}>
            <Text style={[styles.reminderText, isLargeView && styles.reminderTextLarge]}>
              💊 오후 4시에 정형외과 진료가 잡혀있어요!
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.weatherSection}>
            <Text style={[styles.weatherIcon, isLargeView && styles.weatherIconLarge]}>☀️</Text>
            <Text style={[styles.weatherText, isLargeView && styles.weatherTextLarge]}>
              오늘은 날씨가 좋으니 산책하기 좋은 날이에요.
            </Text>
          </View>
        </View>

        {/* 빠른 액션 버튼들 */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => router.push('/todos')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <Text style={[styles.actionIconText, isLargeView && styles.actionIconTextLarge]}>✓</Text>
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>할 일</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => Alert.alert('준비중', 'AI 통화 기능은 개발 중입니다.')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <Text style={[styles.actionIconText, isLargeView && styles.actionIconTextLarge]}>📞</Text>
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>AI 통화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => Alert.alert('준비중', '일기 기능은 개발 중입니다.')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <Text style={[styles.actionIconText, isLargeView && styles.actionIconTextLarge]}>📝</Text>
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>일기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => Alert.alert('준비중', '알림 기능은 개발 중입니다.')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <Text style={[styles.actionIconText, isLargeView && styles.actionIconTextLarge]}>🔔</Text>
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>알림</Text>
          </TouchableOpacity>
        </View>

        {/* 오늘의 일정 카드 */}
        <View style={styles.scheduleCard}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, isLargeView && styles.cardTitleLarge]}>오늘의 일정</Text>
            <TouchableOpacity>
              <Text style={[styles.viewAllText, isLargeView && styles.viewAllTextLarge]}>전체보기</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.scheduleItem}>
            <View style={styles.scheduleTime}>
              <Text style={[styles.scheduleTimeText, isLargeView && styles.scheduleTimeTextLarge]}>16:00</Text>
            </View>
            <View style={styles.scheduleContent}>
              <Text style={[styles.scheduleTitle, isLargeView && styles.scheduleTitleLarge]}>정형외과 진료</Text>
              <Text style={[styles.scheduleLocation, isLargeView && styles.scheduleLocationLarge]}>서울대학교병원 정형외과</Text>
              <Text style={[styles.scheduleDate, isLargeView && styles.scheduleDateLarge]}>무릎 관절 정기검진</Text>
            </View>
            <View style={styles.scheduleStatus}>
              <Text style={[styles.scheduleStatusText, isLargeView && styles.scheduleStatusTextLarge]}>예정</Text>
            </View>
          </View>

          <View style={styles.scheduleItem}>
            <View style={styles.scheduleTime}>
              <Text style={[styles.scheduleTimeText, isLargeView && styles.scheduleTimeTextLarge]}>19:00</Text>
            </View>
            <View style={styles.scheduleContent}>
              <Text style={[styles.scheduleTitle, isLargeView && styles.scheduleTitleLarge]}>저녁 복약</Text>
              <Text style={[styles.scheduleLocation, isLargeView && styles.scheduleLocationLarge]}>혈압약, 당뇨약 복용</Text>
              <Text style={[styles.scheduleDate, isLargeView && styles.scheduleDateLarge]}>식후 30분 복용</Text>
            </View>
            <View style={styles.scheduleStatus}>
              <Text style={[styles.scheduleStatusText, isLargeView && styles.scheduleStatusTextLarge]}>완료</Text>
            </View>
          </View>
        </View>

        {/* 건강 상태 요약 */}
        <View style={styles.healthSummaryCard}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, isLargeView && styles.cardTitleLarge]}>건강 상태</Text>
            <TouchableOpacity>
              <Text style={[styles.viewAllText, isLargeView && styles.viewAllTextLarge]}>상세보기</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.healthMetrics}>
            <View style={styles.healthMetric}>
              <Text style={[styles.metricValue, isLargeView && styles.metricValueLarge]}>120/80</Text>
              <Text style={[styles.metricLabel, isLargeView && styles.metricLabelLarge]}>혈압</Text>
              <Text style={[styles.metricStatus, isLargeView && styles.metricStatusLarge]}>정상</Text>
            </View>
            <View style={styles.healthMetric}>
              <Text style={[styles.metricValue, isLargeView && styles.metricValueLarge]}>98</Text>
              <Text style={[styles.metricLabel, isLargeView && styles.metricLabelLarge]}>혈당</Text>
              <Text style={[styles.metricStatus, isLargeView && styles.metricStatusLarge]}>정상</Text>
            </View>
            <View style={styles.healthMetric}>
              <Text style={[styles.metricValue, isLargeView && styles.metricValueLarge]}>7,500</Text>
              <Text style={[styles.metricLabel, isLargeView && styles.metricLabelLarge]}>걸음수</Text>
              <Text style={[styles.metricStatus, isLargeView && styles.metricStatusLarge]}>양호</Text>
            </View>
          </View>
        </View>

        {/* 하단 여백 */}
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
    backgroundColor: '#F8F9FA',
  },
  largeViewButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#34B79F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  largeViewText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
  },
  
  // 어르신 프로필 카드
  profileCard: {
    backgroundColor: '#34B79F',
    borderRadius: 20,
    padding: 24,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  greeting: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.9,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 36,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  todayText: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  reminderSection: {
    paddingVertical: 4,
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
    paddingVertical: 4,
  },
  weatherIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  weatherText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
  },
  weatherBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  weatherBadgeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // 빠른 액션 버튼들
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    textAlign: 'center',
  },

  // 카드 공통 스타일
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  healthSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },

  // 일정 아이템
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  scheduleTime: {
    width: 60,
    alignItems: 'center',
    marginRight: 16,
  },
  scheduleTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  scheduleLocation: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  scheduleDate: {
    fontSize: 13,
    color: '#999999',
  },
  scheduleStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F0F8F5',
  },
  scheduleStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34B79F',
  },

  // 건강 지표
  healthMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  healthMetric: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  metricStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34B79F',
    backgroundColor: '#F0F8F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bottomSpacer: {
    height: 20,
  },

  // 크게 보기 모드 스타일들
  greetingLarge: {
    fontSize: 22,
  },
  userNameLarge: {
    fontSize: 32,
  },
  userStatusLarge: {
    fontSize: 18,
  },
  todayTextLarge: {
    fontSize: 18,
  },
  dateTextLarge: {
    fontSize: 20,
  },
  reminderTextLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  weatherIconLarge: {
    fontSize: 32,
  },
  weatherTextLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  actionButtonLarge: {
    paddingVertical: 20,
  },
  actionIconLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  actionIconTextLarge: {
    fontSize: 32,
  },
  actionLabelLarge: {
    fontSize: 18,
  },
  cardTitleLarge: {
    fontSize: 22,
  },
  viewAllTextLarge: {
    fontSize: 18,
  },
  scheduleTimeTextLarge: {
    fontSize: 20,
  },
  scheduleTitleLarge: {
    fontSize: 20,
  },
  scheduleLocationLarge: {
    fontSize: 18,
  },
  scheduleDateLarge: {
    fontSize: 16,
  },
  scheduleStatusTextLarge: {
    fontSize: 16,
  },
  metricValueLarge: {
    fontSize: 26,
  },
  metricLabelLarge: {
    fontSize: 18,
  },
  metricStatusLarge: {
    fontSize: 16,
  },
});

