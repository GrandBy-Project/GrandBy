/**
 * 어르신 전용 홈 화면
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { BottomNavigationBar, Header } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as todoApi from '../api/todo';
import { Colors } from '../constants/Colors';
import * as connectionsApi from '../api/connections';
import * as notificationsApi from '../api/notifications';
import { Modal } from 'react-native';

// 커스텀 아이콘 컴포넌트들
const CheckIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.8,
      height: size * 0.8,
      borderRadius: size * 0.1,
      borderWidth: size * 0.08,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <View style={{
        width: size * 0.3,
        height: size * 0.15,
        borderBottomWidth: size * 0.08,
        borderRightWidth: size * 0.08,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -size * 0.05,
      }} />
    </View>
  </View>
);

const PhoneIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.7,
      height: size * 0.9,
      borderRadius: size * 0.15,
      borderWidth: size * 0.08,
      borderColor: color,
      backgroundColor: 'transparent',
    }} />
    <View style={{
      width: size * 0.3,
      height: size * 0.05,
      backgroundColor: color,
      borderRadius: size * 0.025,
      position: 'absolute',
      top: size * 0.2,
    }} />
    <View style={{
      width: size * 0.15,
      height: size * 0.15,
      backgroundColor: color,
      borderRadius: size * 0.075,
      position: 'absolute',
      bottom: size * 0.15,
    }} />
  </View>
);

const DiaryIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.8,
      height: size * 0.9,
      borderRadius: size * 0.05,
      borderWidth: size * 0.08,
      borderColor: color,
      backgroundColor: 'transparent',
    }} />
    <View style={{
      width: size * 0.5,
      height: size * 0.08,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.25,
    }} />
    <View style={{
      width: size * 0.4,
      height: size * 0.08,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.4,
    }} />
    <View style={{
      width: size * 0.3,
      height: size * 0.08,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.55,
    }} />
  </View>
);

const NotificationIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.6,
      height: size * 0.6,
      borderTopLeftRadius: size * 0.3,
      borderTopRightRadius: size * 0.3,
      borderWidth: size * 0.08,
      borderBottomWidth: 0,
      borderColor: color,
      backgroundColor: 'transparent',
    }} />
    <View style={{
      width: size * 0.8,
      height: size * 0.1,
      backgroundColor: color,
      borderRadius: size * 0.05,
      position: 'absolute',
      bottom: size * 0.25,
    }} />
    <View style={{
      width: size * 0.2,
      height: size * 0.15,
      borderTopLeftRadius: size * 0.1,
      borderTopRightRadius: size * 0.1,
      backgroundColor: color,
      position: 'absolute',
      bottom: size * 0.1,
    }} />
  </View>
);

const PillIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.8,
      height: size * 0.4,
      borderRadius: size * 0.2,
      backgroundColor: color,
      flexDirection: 'row',
    }}>
      <View style={{
        width: '50%',
        height: '100%',
        backgroundColor: color,
        borderTopLeftRadius: size * 0.2,
        borderBottomLeftRadius: size * 0.2,
      }} />
      <View style={{
        width: '50%',
        height: '100%',
        backgroundColor: 'rgba(52, 183, 159, 0.5)',
        borderTopRightRadius: size * 0.2,
        borderBottomRightRadius: size * 0.2,
      }} />
    </View>
  </View>
);

const SunIcon = ({ size = 24, color = '#FFB800' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.5,
      height: size * 0.5,
      borderRadius: size * 0.25,
      backgroundColor: color,
    }} />
    {/* 태양 광선들 */}
    {Array.from({ length: 8 }).map((_, index) => {
      const angle = (index * 45) * (Math.PI / 180);
      const x = Math.cos(angle) * size * 0.35;
      const y = Math.sin(angle) * size * 0.35;
      return (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: size * 0.08,
            height: size * 0.2,
            backgroundColor: color,
            borderRadius: size * 0.04,
            transform: [
              { translateX: x },
              { translateY: y },
              { rotate: `${index * 45}deg` }
            ],
          }}
        />
      );
    })}
  </View>
);

const ProfileIcon = ({ size = 36, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.4,
      height: size * 0.4,
      borderRadius: size * 0.2,
      backgroundColor: color,
      marginBottom: size * 0.1,
    }} />
    <View style={{
      width: size * 0.7,
      height: size * 0.35,
      backgroundColor: color,
      borderTopLeftRadius: size * 0.35,
      borderTopRightRadius: size * 0.35,
    }} />
  </View>
);

export const ElderlyHomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isLargeView, setIsLargeView] = useState(false);
  const [todayTodos, setTodayTodos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 연결 요청 알림 관련 state
  const [pendingConnections, setPendingConnections] = useState<connectionsApi.ConnectionWithUserInfo[]>([]);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<connectionsApi.ConnectionWithUserInfo | null>(null);

  // 오늘의 할 일 및 연결 요청 불러오기
  useEffect(() => {
    loadTodayTodos();
    loadPendingConnections();
  }, []);

  const loadTodayTodos = async () => {
    try {
      const todos = await todoApi.getTodos('today');
      setTodayTodos(todos);
    } catch (error) {
      console.error('오늘 할 일 불러오기 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 대기 중인 연결 요청 불러오기
  const loadPendingConnections = async () => {
    try {
      const connections = await connectionsApi.getConnections();
      setPendingConnections(connections.pending);
    } catch (error) {
      console.error('연결 요청 불러오기 실패:', error);
    }
  };

  // 연결 요청 수락
  const handleAcceptConnection = async () => {
    if (!selectedConnection) return;

    try {
      await connectionsApi.acceptConnection(selectedConnection.connection_id);
      Alert.alert(
        '연결 완료',
        `${selectedConnection.name}님과 연결되었습니다!`,
        [
          {
            text: '확인',
            onPress: () => {
              setShowConnectionModal(false);
              setSelectedConnection(null);
              loadPendingConnections(); // 목록 새로고침
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('연결 수락 실패:', error);
      Alert.alert('오류', error.message || '연결 수락에 실패했습니다.');
    }
  };

  // 연결 요청 거절
  const handleRejectConnection = async () => {
    if (!selectedConnection) return;

    Alert.alert(
      '연결 거절',
      `${selectedConnection.name}님의 연결 요청을 거절하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '거절',
          style: 'destructive',
          onPress: async () => {
            try {
              await connectionsApi.rejectConnection(selectedConnection.connection_id);
              Alert.alert(
                '거절 완료',
                '연결 요청을 거절했습니다.',
                [
                  {
                    text: '확인',
                    onPress: () => {
                      setShowConnectionModal(false);
                      setSelectedConnection(null);
                      loadPendingConnections(); // 목록 새로고침
                    }
                  }
                ]
              );
            } catch (error: any) {
              console.error('연결 거절 실패:', error);
              Alert.alert('오류', error.message || '연결 거절에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  // 카테고리 한글 이름 변환
  const getCategoryName = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'MEDICINE': '복약',
      'medicine': '복약',
      'HOSPITAL': '병원',
      'hospital': '병원',
      'EXERCISE': '운동',
      'exercise': '운동',
      'MEAL': '식사',
      'meal': '식사',
      'OTHER': '기타',
      'other': '기타',
    };
    return categoryMap[category] || '기타';
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

      {/* 연결 요청 알림 배너 */}
      {pendingConnections.length > 0 && (
        <TouchableOpacity
          style={styles.notificationBanner}
          onPress={() => {
            setSelectedConnection(pendingConnections[0]);
            setShowConnectionModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerIcon}>🔔</Text>
            <View style={styles.bannerText}>
              <Text style={[styles.bannerTitle, isLargeView && { fontSize: 18 }]}>
                새로운 연결 요청 ({pendingConnections.length})
              </Text>
              <Text style={[styles.bannerSubtitle, isLargeView && { fontSize: 16 }]}>
                {pendingConnections[0].name}님이 보호자 연결을 요청했습니다
              </Text>
            </View>
            <Text style={styles.bannerArrow}>›</Text>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 어르신 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <ProfileIcon size={36} color="#34B79F" />
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
            <View style={styles.reminderContent}>
              <PillIcon size={isLargeView ? 20 : 16} color="#FFFFFF" />
              <Text style={[styles.reminderText, isLargeView && styles.reminderTextLarge]}>
                오후 4시에 정형외과 진료가 잡혀있어요!
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.weatherSection}>
            <SunIcon size={isLargeView ? 32 : 24} color="#FFB800" />
            <Text style={[styles.weatherText, isLargeView && styles.weatherTextLarge]}>
              오늘은 날씨가 좋으니 산책하기 좋은 날이에요.
            </Text>
          </View>
        </View>

        {/* 빠른 액션 버튼들 */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => router.push('/todos')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <CheckIcon size={isLargeView ? 32 : 24} color="#34B79F" />
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>할 일</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => Alert.alert('준비중', 'AI 통화 기능은 개발 중입니다.')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <PhoneIcon size={isLargeView ? 32 : 24} color="#34B79F" />
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>AI 통화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => Alert.alert('준비중', '일기 기능은 개발 중입니다.')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <DiaryIcon size={isLargeView ? 32 : 24} color="#34B79F" />
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>일기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, isLargeView && styles.actionButtonLarge]} onPress={() => Alert.alert('준비중', '알림 기능은 개발 중입니다.')}>
            <View style={[styles.actionIcon, isLargeView && styles.actionIconLarge]}>
              <NotificationIcon size={isLargeView ? 32 : 24} color="#34B79F" />
            </View>
            <Text style={[styles.actionLabel, isLargeView && styles.actionLabelLarge]}>알림</Text>
          </TouchableOpacity>
        </View>

        {/* 오늘의 일정 카드 */}
        <View style={styles.scheduleCard}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, isLargeView && styles.cardTitleLarge]}>오늘의 일정</Text>
            <TouchableOpacity onPress={() => router.push('/todos')}>
              <Text style={[styles.viewAllText, isLargeView && styles.viewAllTextLarge]}>전체보기</Text>
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : todayTodos.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#999999' }}>오늘 할 일이 없습니다</Text>
            </View>
          ) : (
            todayTodos.slice(0, 3).map((todo, index) => (
              <View key={todo.todo_id} style={styles.scheduleItem}>
                <View style={styles.scheduleTime}>
                  <Text style={[styles.scheduleTimeText, isLargeView && styles.scheduleTimeTextLarge]}>
                    {todo.due_time ? todo.due_time.substring(0, 5) : '시간미정'}
                  </Text>
                </View>
                <View style={styles.scheduleContent}>
                  <Text style={[styles.scheduleTitle, isLargeView && styles.scheduleTitleLarge]}>
                    {todo.title}
                  </Text>
                  <Text style={[styles.scheduleLocation, isLargeView && styles.scheduleLocationLarge]}>
                    {todo.description || ''}
                  </Text>
                  <Text style={[styles.scheduleDate, isLargeView && styles.scheduleDateLarge]}>
                    {todo.category ? `[${getCategoryName(todo.category)}]` : ''}
                  </Text>
                </View>
                <View style={styles.scheduleStatus}>
                  <Text style={[styles.scheduleStatusText, isLargeView && styles.scheduleStatusTextLarge]}>
                    {todo.status === 'COMPLETED' || todo.status === 'completed' ? '완료' : '예정'}
                  </Text>
                </View>
              </View>
            ))
          )}
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

      {/* 연결 요청 수락/거절 모달 */}
      <Modal
        visible={showConnectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConnectionModal(false);
          setSelectedConnection(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.connectionModalContent}>
            {selectedConnection && (
              <>
                <Text style={[styles.modalTitle, isLargeView && { fontSize: 24 }]}>연결 요청</Text>
                
                <View style={styles.modalProfileSection}>
                  <Text style={styles.modalProfileIcon}>👨‍💼</Text>
                  <Text style={[styles.modalProfileName, isLargeView && { fontSize: 24 }]}>
                    {selectedConnection.name}님이
                  </Text>
                  <Text style={[styles.modalProfileSubtitle, isLargeView && { fontSize: 18 }]}>
                    보호자 연결을 요청했습니다
                  </Text>
                </View>

                <View style={styles.modalInfoSection}>
                  <View style={styles.modalInfoRow}>
                    <Text style={[styles.modalInfoLabel, isLargeView && { fontSize: 16 }]}>📧</Text>
                    <Text style={[styles.modalInfoText, isLargeView && { fontSize: 16 }]}>
                      {selectedConnection.email}
                    </Text>
                  </View>
                  {selectedConnection.phone_number && (
                    <View style={styles.modalInfoRow}>
                      <Text style={[styles.modalInfoLabel, isLargeView && { fontSize: 16 }]}>📞</Text>
                      <Text style={[styles.modalInfoText, isLargeView && { fontSize: 16 }]}>
                        {selectedConnection.phone_number}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalPermissionSection}>
                  <Text style={[styles.modalPermissionTitle, isLargeView && { fontSize: 16 }]}>
                    ℹ️ 연결하시면 다음을 공유합니다:
                  </Text>
                  <Text style={[styles.modalPermissionItem, isLargeView && { fontSize: 16 }]}>
                    • 할일 관리
                  </Text>
                  <Text style={[styles.modalPermissionItem, isLargeView && { fontSize: 16 }]}>
                    • 일기 열람
                  </Text>
                  <Text style={[styles.modalPermissionItem, isLargeView && { fontSize: 16 }]}>
                    • 건강 정보
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.rejectButton]}
                    onPress={handleRejectConnection}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.rejectButtonText, isLargeView && { fontSize: 18 }]}>
                      거절
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.acceptButton]}
                    onPress={handleAcceptConnection}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.acceptButtonText, isLargeView && { fontSize: 18 }]}>
                      수락
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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
  reminderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
  weatherSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  weatherText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
    marginLeft: 12,
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

  // 연결 요청 알림 배너
  notificationBanner: {
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  bannerArrow: {
    fontSize: 24,
    color: '#999',
  },

  // 연결 요청 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  connectionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalProfileSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  modalProfileIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modalProfileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modalProfileSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  modalInfoSection: {
    marginBottom: 20,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalInfoLabel: {
    fontSize: 14,
    marginRight: 8,
    width: 24,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  modalPermissionSection: {
    backgroundColor: '#E8F5F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  modalPermissionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  modalPermissionItem: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginBottom: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#34B79F',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

