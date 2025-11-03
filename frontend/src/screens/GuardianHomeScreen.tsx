/**
 * 보호자 전용 홈 화면 (대시보드)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { BottomNavigationBar, Header } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as todoApi from '../api/todo';
import * as connectionsApi from '../api/connections';
import { useAlert } from '../components/GlobalAlertProvider';

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

type TabType = 'family' | 'stats' | 'health' | 'communication';

export const GuardianHomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { show } = useAlert();
  const [currentElderlyIndex, setCurrentElderlyIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('family');
  const [todayTodos, setTodayTodos] = useState<todoApi.TodoItem[]>([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<todoApi.TodoItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTodo, setEditedTodo] = useState({
    title: '',
    description: '',
    category: '',
    time: '',
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 어르신 추가 모달 관련 state
  const [showAddElderlyModal, setShowAddElderlyModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<connectionsApi.ElderlySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // 통계 데이터 상태
  const [weeklyStats, setWeeklyStats] = useState<todoApi.TodoDetailedStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<todoApi.TodoDetailedStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');

  // 연결된 어르신 목록 (API에서 가져옴)
  const [connectedElderly, setConnectedElderly] = useState<ElderlyProfile[]>([]);
  const [isLoadingElderly, setIsLoadingElderly] = useState(false);
  
  // 현재 보여줄 어르신 (마지막 인덱스는 "추가하기" 카드)
  const currentElderly = currentElderlyIndex < connectedElderly.length 
    ? connectedElderly[currentElderlyIndex] 
    : null;
  
  // 전체 카드 개수 (어르신 + 추가하기 카드)
  const totalCards = connectedElderly.length > 0 ? connectedElderly.length + 1 : 1;

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

  // 안부전화: 전화 앱으로 연결 (Android)
  const dialPhoneNumber = async (rawNumber?: string) => {
    try {
      if (!rawNumber) {
        show('연락처 없음', '어르신의 전화번호가 등록되어 있지 않습니다.');
        return;
      }
      const { Linking } = await import('react-native');
      const sanitized = rawNumber.replace(/[^\d+]/g, '');
      const url = `tel:${sanitized}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        show('실패', '이 기기에서 전화를 걸 수 없습니다.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('전화 앱 열기 실패:', error);
      show('오류', '전화 앱을 열 수 없습니다.');
    }
  };

  const handleLogout = async () => {
    show(
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
      {/* 어르신 카드 또는 추가하기 카드 */}
      {currentElderly ? (
        /* 어르신 프로필 카드 */
        <View style={styles.elderlyCard}>
          <View style={styles.elderlyCardHeader}>
            <View style={styles.elderlyProfileInfo}>
              <View style={styles.elderlyProfileImageContainer}>
                <Ionicons name={currentElderly.profileImage as any} size={35} color="#666666" />
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
                { backgroundColor: getHealthStatusColor(currentElderly.healthStatus) }
              ]}>
                {getHealthStatusText(currentElderly.healthStatus)}
              </Text>
            </View>
          </View>
          
          <View style={styles.elderlyStatsContainer}>
            <View style={styles.elderlyStat}>
              <Text style={styles.elderlyStatNumber}>
                {todayTodos.filter(t => t.status === 'completed').length}/{todayTodos.length}
              </Text>
              <Text style={styles.elderlyStatLabel}>오늘 할일</Text>
            </View>
            <View style={styles.elderlyStatDivider} />
            <View style={styles.elderlyStat}>
              <Text style={styles.elderlyStatNumber}>
                {todayTodos.length > 0 
                  ? Math.round((todayTodos.filter(t => t.status === 'completed').length / todayTodos.length) * 100)
                  : 0}%
              </Text>
              <Text style={styles.elderlyStatLabel}>완료율</Text>
            </View>
            <View style={styles.elderlyStatDivider} />
            <TouchableOpacity 
              style={styles.elderlyStat}
              activeOpacity={0.7}
              onPress={() => dialPhoneNumber(currentElderly.emergencyContact)}
            >
              <Ionicons name="call" size={20} color="#34B79F" />
              <Text style={styles.elderlyStatLabel}>안부전화</Text>
            </TouchableOpacity>
          </View>

          {/* 네비게이션 */}
          {totalCards > 1 && (
            <View style={styles.elderlyNavigation}>
              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => {
                  const newIndex = currentElderlyIndex > 0 ? currentElderlyIndex - 1 : totalCards - 1;
                  setCurrentElderlyIndex(newIndex);
                }}
              >
                <Text style={styles.navButtonText}>◀</Text>
              </TouchableOpacity>
              
              <View style={styles.pageIndicator}>
                {Array.from({ length: totalCards }).map((_, index) => (
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
                  const newIndex = currentElderlyIndex < totalCards - 1 ? currentElderlyIndex + 1 : 0;
                  setCurrentElderlyIndex(newIndex);
                }}
              >
                <Text style={styles.navButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        /* 어르신 추가하기 카드 (마지막 카드 또는 어르신이 없을 때) */
        <View style={styles.elderlyCard}>
          <TouchableOpacity 
            style={[styles.elderlyCard, styles.addElderlyCard]}
            onPress={() => setShowAddElderlyModal(true)}
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

          {/* 네비게이션 (어르신이 1명 이상 있을 때만) */}
          {totalCards > 1 && (
            <View style={styles.elderlyNavigation}>
              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => {
                  const newIndex = currentElderlyIndex > 0 ? currentElderlyIndex - 1 : totalCards - 1;
                  setCurrentElderlyIndex(newIndex);
                }}
              >
                <Text style={styles.navButtonText}>◀</Text>
              </TouchableOpacity>
              
              <View style={styles.pageIndicator}>
                {Array.from({ length: totalCards }).map((_, index) => (
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
                  const newIndex = currentElderlyIndex < totalCards - 1 ? currentElderlyIndex + 1 : 0;
                  setCurrentElderlyIndex(newIndex);
                }}
              >
                <Text style={styles.navButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 오늘 섹션 */}
      {currentElderly && (
        <View style={styles.todaySection}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayTitle}>오늘</Text>
            <View style={styles.dateTag}>
              <Text style={styles.dateText}>{dateString} {dayString}</Text>
            </View>
          </View>

          {/* 할일 목록 */}
          <View style={styles.tasksList}>
            {isLoadingTodos ? (
              <ActivityIndicator size="large" color="#34B79F" style={{ marginVertical: 20 }} />
            ) : todayTodos.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#999', paddingVertical: 20 }}>
                오늘 등록된 할 일이 없습니다
              </Text>
            ) : (
              (showAllTodos ? todayTodos : todayTodos.slice(0, 5)).map((todo) => (
                <TouchableOpacity
                  key={todo.todo_id}
                  style={[
                    styles.taskItem,
                    todo.status === 'completed' && styles.taskItemCompleted
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedTodo(todo);
                    setShowEditModal(true);
                  }}
                >
                  <View style={styles.taskIconContainer}>
                    <Ionicons name={getCategoryIcon(todo.category)} size={20} color="#34B79F" />
                  </View>
                  <View style={styles.taskContent}>
                    <Text style={[
                      styles.taskTitle,
                      todo.status === 'completed' && styles.taskTitleCompleted
                    ]}>
                      {todo.title}
                    </Text>
                    {todo.due_time && (
                      <Text style={styles.taskTime}>
                        {formatTime(todo.due_time)}
                      </Text>
                    )}
                  </View>
                  {todo.status === 'completed' ? (
                    <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                  ) : todo.status === 'cancelled' ? (
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  ) : null}
                </TouchableOpacity>
              ))
            )}
            {todayTodos.length > 5 && (
              <TouchableOpacity 
                style={styles.viewMoreButton}
                onPress={() => setShowAllTodos(!showAllTodos)}
              >
                <Text style={styles.viewMoreText}>
                  {showAllTodos 
                    ? '접기' 
                    : `+${todayTodos.length - 5}개 더보기`
                  }
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 새 할일 추가 버튼 */}
          <TouchableOpacity
            style={styles.addTaskButton}
            onPress={() => router.push(`/guardian-todo-add?elderlyId=${currentElderly.id}&elderlyName=${encodeURIComponent(currentElderly.name)}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.addTaskText}>+ 새로운 할 일 추가하기</Text>
          </TouchableOpacity>
        </View>
      )}

    </>
  );

  // 통계 탭 (새로 추가)
  const renderStatsTab = () => (
    <>
      {connectedElderly.length > 0 && (selectedPeriod === 'week' ? weeklyStats : monthlyStats) ? (
        <>
          {/* 주간/월간 요약 선택 */}
          <View style={styles.periodSelectorCard}>
            <View style={styles.periodSelector}>
              <TouchableOpacity 
                style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedPeriod('week')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>
                  이번 주
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedPeriod('month')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>
                  이번 달
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* 원형 차트 요약 */}
            <View style={styles.summaryChartContainer}>
              <View style={styles.chartSection}>
                <View style={styles.completionChart}>
                  <View style={styles.chartCircle}>
                    <View style={[styles.chartProgress, { 
                      transform: [{ rotate: `${((selectedPeriod === 'week' ? weeklyStats : monthlyStats)?.completion_rate || 0) * 360 - 90}deg` }]
                    }]}>
                    </View>
                    <View style={styles.chartInnerCircle}>
                      <Text style={styles.chartPercentage}>
                        {Math.round(((selectedPeriod === 'week' ? weeklyStats : monthlyStats)?.completion_rate || 0) * 100)}%
                      </Text>
                      <Text style={styles.chartLabel}>완료율</Text>
                    </View>
                  </View>
                </View>
              </View>
              
              <View style={styles.summaryStats}>
                <View style={styles.summaryStatItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#34B79F" />
                  <Text style={styles.summaryStatNumber}>{(selectedPeriod === 'week' ? weeklyStats : monthlyStats)?.completed || 0}</Text>
                  <Text style={styles.summaryStatLabel}>완료</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Ionicons name="time" size={20} color="#FF9500" />
                  <Text style={styles.summaryStatNumber}>{(selectedPeriod === 'week' ? weeklyStats : monthlyStats)?.pending || 0}</Text>
                  <Text style={styles.summaryStatLabel}>대기</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                  <Text style={styles.summaryStatNumber}>{(selectedPeriod === 'week' ? weeklyStats : monthlyStats)?.cancelled || 0}</Text>
                  <Text style={styles.summaryStatLabel}>취소</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 건강 상태 알림 */}
          <View style={styles.healthStatusCard}>
            <Text style={styles.healthStatusTitle}>건강 상태 체크</Text>
            
            {/* 주의 필요 */}
            {generateHealthAlerts(selectedPeriod === 'week' ? weeklyStats : monthlyStats).length > 0 && (
              <View style={styles.statusSection}>
                <Text style={styles.statusSectionTitle}>확인이 필요한 부분</Text>
                {generateHealthAlerts(selectedPeriod === 'week' ? weeklyStats : monthlyStats).map((alert, index) => (
                  <View key={index} style={styles.statusItem}>
                    <View style={styles.statusItemHeader}>
                      <Ionicons name="alert-circle" size={16} color="#FF9500" />
                      <Text style={styles.statusItemText}>{alert.message}</Text>
                    </View>
                    <Text style={styles.statusRecommendation}>{alert.recommendation}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 잘하고 있는 부분 */}
            {generateGoodStatus(selectedPeriod === 'week' ? weeklyStats : monthlyStats).length > 0 && (
              <View style={styles.statusSection}>
                <Text style={styles.statusSectionTitle}>잘하고 있어요</Text>
                {generateGoodStatus(selectedPeriod === 'week' ? weeklyStats : monthlyStats).map((item, index) => (
                  <View key={index} style={styles.statusGoodItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.statusGoodText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 조언 */}
            <View style={styles.statusSection}>
              <Text style={styles.statusSectionTitle}>조언</Text>
              {generateRecommendations(selectedPeriod === 'week' ? weeklyStats : monthlyStats).map((rec, index) => (
                <View key={index} style={styles.statusAdviceItem}>
                  <Ionicons name="bulb" size={16} color="#34B79F" />
                  <Text style={styles.statusAdviceText}>{rec}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 카테고리별 완료 현황 */}
          <View style={styles.categoryStatsCard}>
            <Text style={styles.categoryStatsTitle}>카테고리별 완료율</Text>
            {(selectedPeriod === 'week' ? weeklyStats : monthlyStats)?.by_category.map((cat) => (
              <View key={cat.category} style={styles.categoryStatRow}>
                <View style={styles.categoryStatLabelContainer}>
                  <Ionicons name={getCategoryIcon(cat.category)} size={16} color="#34B79F" />
                  <Text style={styles.categoryStatLabel}>
                    {getCategoryName(cat.category)}
                  </Text>
                </View>
                <View style={styles.categoryProgressContainer}>
                  <View style={styles.categoryProgressBg}>
                    <View 
                      style={[
                        styles.categoryProgressBar, 
                        { width: `${Math.round(cat.completion_rate * 100)}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.categoryProgressText}>
                    {cat.completed}/{cat.total} ({Math.round(cat.completion_rate * 100)}%)
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#34B79F" />
          <Text style={styles.emptyStateText}>통계 데이터를 불러오는 중...</Text>
        </View>
      )}
    </>
  );

  const renderHealthTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.healthSection}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons name="fitness" size={24} color="#34B79F" />
          <Text style={styles.sectionTitle}>건강관리</Text>
        </View>
        
        {/* 복약 관리 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleContainer}>
              <Ionicons name="medical" size={18} color="#FF6B6B" />
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
              <Ionicons name="medical-outline" size={18} color="#4ECDC4" />
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
              <Ionicons name="fitness" size={18} color="#45B7D1" />
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
              <Ionicons name="restaurant" size={18} color="#96CEB4" />
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
          <Ionicons name="chatbubbles" size={24} color="#34B79F" />
          <Text style={styles.sectionTitle}>소통</Text>
        </View>
        
        {/* AI 통화 내역 */}
        <View style={styles.commCard}>
          <View style={styles.commCardHeader}>
            <View style={styles.commCardTitleContainer}>
              <Ionicons name="call" size={18} color="#007AFF" />
              <Text style={styles.commCardTitle}>AI 통화 내역</Text>
            </View>
            <Text style={styles.commCardTime}>오늘 오후 7시</Text>
          </View>
          <Text style={styles.commCardContent}>안부 인사 및 오늘 하루 일과 확인</Text>
          <View style={styles.moodContainer}>
            <Ionicons name="happy" size={16} color="#4CAF50" />
            <Text style={styles.commCardMood}>기분: 좋음</Text>
          </View>
        </View>

        {/* 일기 */}
        <View style={styles.commCard}>
          <View style={styles.commCardHeader}>
            <View style={styles.commCardTitleContainer}>
              <Ionicons name="book" size={18} color="#FF9500" />
              <Text style={styles.commCardTitle}>최근 일기</Text>
            </View>
            <Text style={styles.commCardTime}>10월 13일</Text>
          </View>
          <Text style={styles.commCardContent}>오늘은 날씨가 좋아서 산책을 했다. 기분이 상쾌했다.</Text>
          <View style={styles.moodContainer}>
            <Ionicons name="happy-outline" size={16} color="#4CAF50" />
            <Text style={styles.commCardMood}>감정: 평온함</Text>
          </View>
        </View>

        {/* 감정 분석 */}
        <View style={styles.commCard}>
          <View style={styles.commCardHeader}>
            <View style={styles.commCardTitleContainer}>
              <Ionicons name="analytics" size={18} color="#9C27B0" />
              <Text style={styles.commCardTitle}>감정 분석</Text>
            </View>
            <Text style={styles.commCardTime}>이번 주</Text>
          </View>
          <Text style={styles.commCardContent}>전반적으로 안정적인 감정 상태를 보이고 있습니다.</Text>
          <View style={styles.emotionTags}>
            <View style={styles.emotionTagWithIcon}>
              <Ionicons name="happy" size={12} color="#4CAF50" />
              <Text style={styles.emotionTag}>긍정 70%</Text>
            </View>
            <View style={styles.emotionTagWithIcon}>
              <Ionicons name="happy-outline" size={12} color="#66BB6A" />
              <Text style={styles.emotionTag}>평온 25%</Text>
            </View>
            <View style={styles.emotionTagWithIcon}>
              <Ionicons name="sad" size={12} color="#FF9800" />
              <Text style={styles.emotionTag}>우울 5%</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  // menuItems는 현재 사용되지 않음 (참고용으로만 유지)
  const menuItems = [
    {
      id: 'diaries',
      title: '일기 관리',
      description: '어르신의 일기 확인',
      icon: 'book',
      color: '#FF9500',
      onPress: () => show('준비중', '일기 관리 기능은 개발 중입니다.'),
    },
    {
      id: 'calls',
      title: 'AI 통화 내역',
      description: '통화 기록 확인',
      icon: 'call',
      color: '#007AFF',
      onPress: () => show('준비중', 'AI 통화 내역 기능은 개발 중입니다.'),
    },
    {
      id: 'todos',
      title: '할일 관리',
      description: '할일 등록 및 관리',
      icon: 'checkmark-done',
      color: '#34C759',
      onPress: () => show('준비중', '할일 관리 기능은 개발 중입니다.'),
    },
    {
      id: 'connections',
      title: '연결 관리',
      description: '어르신과의 연결',
      icon: 'people',
      color: '#FF2D55',
      onPress: () => show('준비중', '연결 관리 기능은 개발 중입니다.'),
    },
    {
      id: 'notifications',
      title: '알림 설정',
      description: '알림 스케줄 관리',
      icon: 'notifications',
      color: '#5856D6',
      onPress: () => show('준비중', '알림 설정 기능은 개발 중입니다.'),
    },
    {
      id: 'dashboard',
      title: '대시보드',
      description: '감정 분석 및 통계',
      icon: 'stats-chart',
      color: '#AF52DE',
      onPress: () => show('준비중', '대시보드 기능은 개발 중입니다.'),
    },
  ];

  // 연결된 어르신 목록 불러오기
  const loadConnectedElderly = async () => {
    // user가 없으면 API 호출 안함 (로그아웃 시)
    if (!user) {
      console.log('⚠️ 보호자: user 없음 - API 호출 스킵');
      return;
    }
    
    setIsLoadingElderly(true);
    try {
      console.log('👥 보호자: 연결된 어르신 목록 로딩 시작');
      const elderly = await connectionsApi.getConnectedElderly();
      console.log('✅ 보호자: 연결된 어르신', elderly.length, '명');
      
      // API 응답을 ElderlyProfile 형태로 변환
      const elderlyProfiles: ElderlyProfile[] = elderly.map((e: any) => ({
        id: e.user_id,
        name: e.name,
        age: e.age || 0,
        profileImage: 'person-circle',
        healthStatus: 'good', // TODO: 실제 건강 상태 계산
        todayTasksCompleted: 0, // TODO: API에서 계산
        todayTasksTotal: 0, // TODO: API에서 계산
        lastActivity: '방금', // TODO: API에서 계산
        emergencyContact: e.phone_number || '010-0000-0000',
      }));
      
      setConnectedElderly(elderlyProfiles);
    } catch (error) {
      console.error('❌ 연결된 어르신 로딩 실패:', error);
      setConnectedElderly([]);
    } finally {
      setIsLoadingElderly(false);
    }
  };

  // 어르신의 오늘 TODO 불러오기
  const loadTodosForElderly = async (elderlyId: string) => {
    setIsLoadingTodos(true);
    try {
      console.log('📥 보호자: 어르신 TODO 로딩 시작 -', elderlyId);
      const todos = await todoApi.getTodos('today', elderlyId);
      console.log('✅ 보호자: TODO 로딩 성공 -', todos.length, '개');
      console.log('📊 완료된 TODO:', todos.filter(t => t.status === 'completed').length);
      setTodayTodos(todos);
    } catch (error) {
      console.error('❌ TODO 로딩 실패:', error);
    } finally {
      setIsLoadingTodos(false);
    }
  };

  // 어르신의 주간 통계 불러오기
  const loadWeeklyStatsForElderly = async (elderlyId: string) => {
    setIsLoadingStats(true);
    try {
      console.log('📊 보호자: 주간 통계 로딩 시작 -', elderlyId);
      const stats = await todoApi.getDetailedStats('week', elderlyId);
      console.log('✅ 보호자: 주간 통계 로딩 성공');
      console.log('📈 주간 완료율:', Math.round(stats.completion_rate * 100) + '%');
      console.log('📋 카테고리별:', stats.by_category.length, '개');
      setWeeklyStats(stats);
    } catch (error) {
      console.error('❌ 주간 통계 로딩 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Load monthly stats for a specific elderly
  const loadMonthlyStatsForElderly = async (elderlyId: string) => {
    setIsLoadingStats(true);
    try {
      console.log('📊 보호자: 월간 통계 로딩 시작 -', elderlyId);
      const stats = await todoApi.getDetailedStats('month', elderlyId);
      console.log('✅ 보호자: 월간 통계 로딩 성공');
      console.log('📈 월간 완료율:', Math.round(stats.completion_rate * 100) + '%');
      console.log('📋 카테고리별:', stats.by_category.length, '개');
      setMonthlyStats(stats);
    } catch (error) {
      console.error('❌ 월간 통계 로딩 실패:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Pull-to-Refresh 핸들러
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 연결된 어르신 목록 새로고침
      await loadConnectedElderly();
      
      // 현재 어르신이 있으면 데이터도 새로고침
      if (currentElderly) {
        await Promise.all([
          loadTodosForElderly(currentElderly.id),
          loadWeeklyStatsForElderly(currentElderly.id),
          loadMonthlyStatsForElderly(currentElderly.id),
        ]);
      }
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 화면 마운트 시 연결된 어르신 목록 로딩
  useEffect(() => {
    loadConnectedElderly();
  }, []);

  // 현재 어르신 변경 시 TODO 및 통계 다시 로딩
  useEffect(() => {
    if (currentElderly) {
      loadTodosForElderly(currentElderly.id);
      loadWeeklyStatsForElderly(currentElderly.id);
      loadMonthlyStatsForElderly(currentElderly.id);
    }
  }, [currentElderlyIndex, connectedElderly.length]);

  // 화면 포커스 시 데이터 새로고침 (다른 화면 갔다가 돌아올 때만)
  useFocusEffect(
    useCallback(() => {
      // user가 없으면 데이터 로딩 안함 (로그아웃 시)
      if (!user) return;
      
      loadConnectedElderly();
      if (currentElderly) {
        loadTodosForElderly(currentElderly.id);
        loadWeeklyStatsForElderly(currentElderly.id);
        loadMonthlyStatsForElderly(currentElderly.id);
      }
    }, [user, currentElderly?.id]) // user 의존성 추가
  );

  // 카테고리 아이콘 매핑 (Ionicons 사용)
  const getCategoryIcon = (category: string | null) => {
    const iconMap: Record<string, any> = {
      'medicine': 'medical',
      'MEDICINE': 'medical',
      'exercise': 'fitness',
      'EXERCISE': 'fitness',
      'meal': 'restaurant',
      'MEAL': 'restaurant',
      'hospital': 'medical-outline',
      'HOSPITAL': 'medical-outline',
      'other': 'list',
      'OTHER': 'list',
    };
    return iconMap[category || 'other'] || 'list';
  };

  // 카테고리 한국어 이름
  // 시간 포맷 변환 (HH:MM -> 오전/오후)
  const formatTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours % 12 || 12;
    return `${period} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
  };

  const getCategoryName = (category: string | null): string => {
    const nameMap: Record<string, string> = {
      'medicine': '약 복용',
      'MEDICINE': '약 복용',
      'exercise': '운동',
      'EXERCISE': '운동',
      'meal': '식사',
      'MEAL': '식사',
      'hospital': '병원 방문',
      'HOSPITAL': '병원 방문',
      'other': '기타',
      'OTHER': '기타',
    };
    return nameMap[category || 'other'] || '기타';
  };

  // 건강 알림 생성 (다정한 문구로 변경)
  const generateHealthAlerts = (stats: todoApi.TodoDetailedStats | null) => {
    if (!stats) return [];
    const alerts = [];
    
    // 복약 완료율 체크
    const medicineCategory = stats.by_category.find(cat => cat.category === 'MEDICINE');
    if (medicineCategory && medicineCategory.completion_rate < 0.8) {
      alerts.push({
        message: `약 복용이 조금 부족해요 (${Math.round(medicineCategory.completion_rate * 100)}%)`,
        recommendation: '복약 알림을 더 자주 해주시면 좋을 것 같아요'
      });
    }

    // 운동 완료율 체크
    const exerciseCategory = stats.by_category.find(cat => cat.category === 'EXERCISE');
    if (exerciseCategory && exerciseCategory.completion_rate < 0.7) {
      alerts.push({
        message: `운동을 주 ${exerciseCategory.completed}회만 하셨어요`,
        recommendation: '집에서도 할 수 있는 간단한 스트레칭을 함께 해보시면 어떨까요?'
      });
    }

    // 식사 완료율 체크
    const mealCategory = stats.by_category.find(cat => cat.category === 'MEAL');
    if (mealCategory && mealCategory.completion_rate < 0.85) {
      alerts.push({
        message: `식사 시간이 조금 불규칙해요 (${Math.round(mealCategory.completion_rate * 100)}%)`,
        recommendation: '규칙적인 식사 시간을 정해보시면 건강에 더 좋을 것 같아요'
      });
    }

    return alerts;
  };

  // 양호한 상태 생성 (다정한 문구로 변경)
  const generateGoodStatus = (stats: todoApi.TodoDetailedStats | null) => {
    if (!stats) return [];
    const goodItems = [];
    
    // 복약 완료율 체크
    const medicineCategory = stats.by_category.find(cat => cat.category === 'MEDICINE');
    if (medicineCategory && medicineCategory.completion_rate >= 0.9) {
      goodItems.push(`약 복용을 정말 잘 하고 계세요! (${Math.round(medicineCategory.completion_rate * 100)}%)`);
    }

    // 식사 완료율 체크
    const mealCategory = stats.by_category.find(cat => cat.category === 'MEAL');
    if (mealCategory && mealCategory.completion_rate >= 0.85) {
      goodItems.push(`식사 시간을 규칙적으로 잘 지키고 계세요 (${Math.round(mealCategory.completion_rate * 100)}%)`);
    }

    // 운동 완료율 체크
    const exerciseCategory = stats.by_category.find(cat => cat.category === 'EXERCISE');
    if (exerciseCategory && exerciseCategory.completion_rate >= 0.8) {
      goodItems.push(`운동을 주 ${exerciseCategory.completed}회나 열심히 하셨어요!`);
    }

    // 전체 완료율 체크
    if (stats.completion_rate >= 0.85) {
      goodItems.push(`전반적으로 정말 잘 하고 계세요 (${Math.round(stats.completion_rate * 100)}%)`);
    }

    return goodItems;
  };

  // 개선 권장사항 생성 (다정한 문구로 변경)
  const generateRecommendations = (stats: todoApi.TodoDetailedStats | null) => {
    if (!stats) return ['데이터를 불러오는 중입니다...'];
    const recommendations = [];
    
    // 복약 관련 권장사항
    const medicineCategory = stats.by_category.find(cat => cat.category === 'MEDICINE');
    if (medicineCategory && medicineCategory.completion_rate < 0.9) {
      recommendations.push('복약 알림을 더 자주 해주시면 어르신께서 잊지 않으실 것 같아요');
    }

    // 운동 관련 권장사항
    const exerciseCategory = stats.by_category.find(cat => cat.category === 'EXERCISE');
    if (exerciseCategory && exerciseCategory.completion_rate < 0.8) {
      recommendations.push('집에서 할 수 있는 간단한 스트레칭이나 산책을 함께 해보시는 건 어떨까요?');
    }

    // 식사 관련 권장사항
    const mealCategory = stats.by_category.find(cat => cat.category === 'MEAL');
    if (mealCategory && mealCategory.completion_rate < 0.9) {
      recommendations.push('규칙적인 식사 시간을 정해서 건강한 생활을 유지해보세요');
    }

    // 기본 권장사항 (모든 상태가 좋을 때)
    if (recommendations.length === 0) {
      recommendations.push('현재 상태를 잘 유지하고 계세요!');
      recommendations.push('새로운 취미나 독서 같은 활동을 추가해보시면 더욱 즐거울 것 같아요');
    }

    return recommendations;
  };

  // 카테고리 옵션 (GuardianTodoAddScreen과 동일)
  const categories = [
    { id: 'MEDICINE', name: '약 복용', icon: 'medical', color: '#FF6B6B' },
    { id: 'HOSPITAL', name: '병원 방문', icon: 'medical-outline', color: '#4ECDC4' },
    { id: 'EXERCISE', name: '운동', icon: 'fitness', color: '#45B7D1' },
    { id: 'MEAL', name: '식사', icon: 'restaurant', color: '#96CEB4' },
    { id: 'OTHER', name: '기타', icon: 'list', color: '#95A5A6' },
  ];

  // 시간 옵션
  const timeOptions = [
    '오전 6시', '오전 7시', '오전 8시', '오전 9시', '오전 10시',
    '오전 11시', '오후 12시', '오후 1시', '오후 2시', '오후 3시',
    '오후 4시', '오후 5시', '오후 6시', '오후 7시', '오후 8시',
    '오후 9시', '오후 10시'
  ];

  // 시간을 "오전/오후 X시" 형식으로 변환
  const formatTimeToDisplay = (time24: string | null): string => {
    if (!time24) return '';
    const [hour] = time24.split(':').map(Number);
    if (hour === 0) return '오전 12시';
    if (hour < 12) return `오전 ${hour}시`;
    if (hour === 12) return '오후 12시';
    return `오후 ${hour - 12}시`;
  };

  // "오전/오후 X시"를 24시간 형식으로 변환
  const parseDisplayTimeToApi = (displayTime: string): string => {
    const timeStr = displayTime.replace(/[^0-9]/g, '');
    const hour = displayTime.includes('오후')
      ? (parseInt(timeStr) === 12 ? 12 : parseInt(timeStr) + 12)
      : (parseInt(timeStr) === 12 ? 0 : parseInt(timeStr));
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  // TODO 수정 모드 활성화
  const handleEditMode = () => {
    if (selectedTodo) {
      setEditedTodo({
        title: selectedTodo.title,
        description: selectedTodo.description || '',
        category: selectedTodo.category || '',
        time: formatTimeToDisplay(selectedTodo.due_time),
      });
      setIsEditMode(true);
    }
  };

  // TODO 수정 저장
  const handleSaveEdit = async () => {
    if (!editedTodo.title.trim()) {
      show('알림', '제목을 입력해주세요.');
      return;
    }

    if (!editedTodo.category) {
      show('알림', '카테고리를 선택해주세요.');
      return;
    }

    if (!editedTodo.time) {
      show('알림', '시간을 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const updateData: todoApi.TodoUpdateRequest = {
        title: editedTodo.title,
        description: editedTodo.description || undefined,
        category: editedTodo.category.toUpperCase() as any,
        due_time: parseDisplayTimeToApi(editedTodo.time),
      };

      await todoApi.updateTodo(selectedTodo!.todo_id, updateData);
      
      show('수정 완료', '할 일이 수정되었습니다.', [
        {
          text: '확인',
          onPress: async () => {
            setShowEditModal(false);
            setSelectedTodo(null);
            setIsEditMode(false);
            // TODO 목록 및 통계 새로고침
            if (currentElderly) {
              await loadTodosForElderly(currentElderly.id);
              await loadWeeklyStatsForElderly(currentElderly.id);
              await loadMonthlyStatsForElderly(currentElderly.id);
            }
          },
        },
      ]);
    } catch (error) {
      console.error('수정 실패:', error);
      show('수정 실패', '할 일 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // TODO 삭제 핸들러
  const handleDeleteTodo = async (todoId: string, isRecurring: boolean) => {
    if (isRecurring) {
      // 반복 일정 삭제 옵션 선택
      show(
        '반복 일정 삭제',
        '어떻게 삭제하시겠습니까?',
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '오늘만 삭제',
            onPress: async () => {
              try {
                await todoApi.deleteTodo(todoId, false);
                show('삭제 완료', '할 일이 삭제되었습니다.');
                setShowEditModal(false);
                setSelectedTodo(null);
                // TODO 목록 및 통계 새로고침
                if (currentElderly) {
                  await loadTodosForElderly(currentElderly.id);
                  await loadWeeklyStatsForElderly(currentElderly.id);
                  await loadMonthlyStatsForElderly(currentElderly.id);
                }
              } catch (error) {
                console.error('삭제 실패:', error);
                show('삭제 실패', '할 일 삭제 중 오류가 발생했습니다.');
              }
            },
          },
          {
            text: '모든 반복 일정 삭제',
            style: 'destructive',
            onPress: async () => {
              try {
                await todoApi.deleteTodo(todoId, true);
                show('삭제 완료', '반복 일정이 모두 삭제되었습니다.');
                setShowEditModal(false);
                setSelectedTodo(null);
                // TODO 목록 및 통계 새로고침
                if (currentElderly) {
                  await loadTodosForElderly(currentElderly.id);
                  await loadWeeklyStatsForElderly(currentElderly.id);
                  await loadMonthlyStatsForElderly(currentElderly.id);
                }
              } catch (error) {
                console.error('삭제 실패:', error);
                show('삭제 실패', '할 일 삭제 중 오류가 발생했습니다.');
              }
            },
          },
        ]
      );
    } else {
      // 일반 TODO 삭제
      show(
        '할 일 삭제',
        '정말 삭제하시겠습니까?',
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              try {
                await todoApi.deleteTodo(todoId, false);
                show('삭제 완료', '할 일이 삭제되었습니다.');
                setShowEditModal(false);
                setSelectedTodo(null);
                // TODO 목록 및 통계 새로고침
                if (currentElderly) {
                  await loadTodosForElderly(currentElderly.id);
                  await loadWeeklyStatsForElderly(currentElderly.id);
                  await loadMonthlyStatsForElderly(currentElderly.id);
                }
              } catch (error) {
                console.error('삭제 실패:', error);
                show('삭제 실패', '할 일 삭제 중 오류가 발생했습니다.');
              }
            },
          },
        ]
      );
    }
  };

  // 어르신 검색
  const handleSearchElderly = async () => {
    if (!searchQuery.trim()) {
      show('알림', '이메일 또는 전화번호를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    try {
      const results = await connectionsApi.searchElderly(searchQuery);
      setSearchResults(results);
      
      if (results.length === 0) {
        show('알림', '검색 결과가 없습니다.');
      }
    } catch (error: any) {
      console.error('검색 실패:', error);
      show('오류', error.message || '검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 연결 요청 전송
  const handleSendConnectionRequest = async (elderly: connectionsApi.ElderlySearchResult) => {
    // 이미 연결된 경우
    if (elderly.is_already_connected) {
      const statusText = 
        elderly.connection_status === 'active' ? '이미 연결되어 있습니다.' :
        elderly.connection_status === 'pending' ? '연결 수락 대기 중입니다.' :
        '이전 연결 요청이 거절되었습니다.';
      
      show('알림', statusText);
      return;
    }

    show(
      '연결 요청',
      `${elderly.name}님에게 연결 요청을 보내시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '요청',
          onPress: async () => {
            setIsConnecting(true);
            try {
              await connectionsApi.createConnection(elderly.email);
              
               show(
                 '성공',
                 `${elderly.name}님에게 연결 요청을 보냈습니다.\n어르신이 수락하면 연결됩니다.`,
                 [
                   {
                     text: '확인',
                     onPress: async () => {
                       setShowAddElderlyModal(false);
                       setSearchQuery('');
                       setSearchResults([]);
                       // 연결된 어르신 목록 새로고침
                       await loadConnectedElderly();
                     }
                   }
                 ]
               );
            } catch (error: any) {
              console.error('연결 요청 실패:', error);
              show('오류', error.message || '연결 요청에 실패했습니다.');
            } finally {
              setIsConnecting(false);
            }
          }
        }
      ]
    );
  };

  // 탭 데이터
  const tabs = [
    { id: 'family', label: '홈', icon: 'home' },
    { id: 'stats', label: '통계', icon: 'stats-chart' },
    { id: 'health', label: '건강', icon: 'fitness' },
    { id: 'communication', label: '소통', icon: 'chatbubbles' },
  ];

  // 현재 날짜 정보
  const today = new Date();
  const dateString = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayString = dayNames[today.getDay()];

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="그랜비"
        showMenuButton={true} 
      />

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
            <Ionicons
              name={tab.icon as any}
              size={24}
              color={activeTab === tab.id ? '#34B79F' : '#999999'}
            />
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
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#34B79F']}
            tintColor="#34B79F"
          />
        }
      >
        {activeTab === 'family' && renderFamilyTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'communication' && renderCommunicationTab()}

        {/* 하단 여백 (네비게이션 바 공간 확보) */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* TODO 수정/삭제 모달 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          setSelectedTodo(null);
          setIsEditMode(false);
          setShowCategoryPicker(false);
          setShowTimePicker(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            {/* 모달 헤더 */}
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>
                {isEditMode ? '할 일 수정' : '할 일 상세'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedTodo(null);
                  setIsEditMode(false);
                  setShowCategoryPicker(false);
                  setShowTimePicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
          </View>

            {/* TODO 정보 */}
            {selectedTodo && (
              <ScrollView style={styles.editModalBody} showsVerticalScrollIndicator={false}>
                {!isEditMode ? (
                  // 상세 보기 모드
                  <>
                    <View style={styles.todoDetailSection}>
                      <Text style={styles.todoDetailLabel}>제목</Text>
                      <Text style={styles.todoDetailValue}>{selectedTodo.title}</Text>
        </View>

                    {selectedTodo.description && (
                      <View style={styles.todoDetailSection}>
                        <Text style={styles.todoDetailLabel}>설명</Text>
                        <Text style={styles.todoDetailValue}>{selectedTodo.description}</Text>
            </View>
                    )}

                    <View style={styles.todoDetailRow}>
                      <View style={[styles.todoDetailSection, { flex: 1 }]}>
                        <Text style={styles.todoDetailLabel}>카테고리</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name={getCategoryIcon(selectedTodo.category)} size={16} color="#34B79F" style={{ marginRight: 4 }} />
                          <Text style={styles.todoDetailValue}>{getCategoryName(selectedTodo.category)}</Text>
            </View>
          </View>

                      <View style={[styles.todoDetailSection, { flex: 1 }]}>
                        <Text style={styles.todoDetailLabel}>시간</Text>
                        <Text style={styles.todoDetailValue}>
                          {formatTimeToDisplay(selectedTodo.due_time) || '-'}
                        </Text>
            </View>
          </View>

                    <View style={styles.todoDetailSection}>
                      <Text style={styles.todoDetailLabel}>상태</Text>
                      <Text style={[
                        styles.todoDetailValue,
                        { color: selectedTodo.status === 'completed' ? '#34B79F' : '#666666' }
                      ]}>
                        {selectedTodo.status === 'completed' ? '완료' : 
                         selectedTodo.status === 'cancelled' ? '취소' : '대기'}
                      </Text>
                    </View>

                    {selectedTodo.is_recurring && (
                      <View style={styles.todoDetailSection}>
                        <Text style={styles.todoDetailLabel}>반복 일정</Text>
                        <Text style={styles.todoDetailValue}>
                          {selectedTodo.recurring_type === 'DAILY' ? '매일' :
                           selectedTodo.recurring_type === 'WEEKLY' ? '매주' :
                           selectedTodo.recurring_type === 'MONTHLY' ? '매월' : '-'}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  // 수정 모드
                  <>
                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>제목</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editedTodo.title}
                        onChangeText={(text) => setEditedTodo({ ...editedTodo, title: text })}
                        placeholder="할 일 제목을 입력하세요"
                        placeholderTextColor="#999999"
                      />
                    </View>

                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>설명</Text>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={editedTodo.description}
                        onChangeText={(text) => setEditedTodo({ ...editedTodo, description: text })}
                        placeholder="상세 설명을 입력하세요"
                        placeholderTextColor="#999999"
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>카테고리</Text>
              <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                activeOpacity={0.7}
              >
                        <Text style={[
                          styles.pickerButtonText,
                          !editedTodo.category && styles.pickerPlaceholder
                        ]}>
                          {editedTodo.category 
                            ? `${getCategoryName(editedTodo.category)}`
                            : '카테고리를 선택하세요'}
                        </Text>
                        <Text style={styles.dropdownIcon}>{showCategoryPicker ? '▲' : '▼'}</Text>
                      </TouchableOpacity>

                      {showCategoryPicker && (
                        <View style={styles.pickerDropdown}>
                          {categories.map((cat) => (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.pickerOption,
                                editedTodo.category === cat.id && styles.pickerOptionSelected,
                              ]}
                              onPress={() => {
                                setEditedTodo({ ...editedTodo, category: cat.id });
                                setShowCategoryPicker(false);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name={cat.icon as any} size={16} color={cat.color} style={{ marginRight: 8 }} />
                                <Text style={styles.pickerOptionText}>{cat.name}</Text>
                              </View>
              </TouchableOpacity>
            ))}
                        </View>
                      )}
          </View>

                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>시간</Text>
          <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowTimePicker(!showTimePicker)}
            activeOpacity={0.7}
          >
                        <Text style={[
                          styles.pickerButtonText,
                          !editedTodo.time && styles.pickerPlaceholder
                        ]}>
                          {editedTodo.time || '시간을 선택하세요'}
                        </Text>
                        <Text style={styles.dropdownIcon}>{showTimePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>

                      {showTimePicker && (
                        <View style={styles.pickerDropdown}>
                          <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={true}>
                            {timeOptions.map((time) => (
                              <TouchableOpacity
                                key={time}
                                style={[
                                  styles.pickerOption,
                                  editedTodo.time === time && styles.pickerOptionSelected,
                                ]}
                                onPress={() => {
                                  setEditedTodo({ ...editedTodo, time });
                                  setShowTimePicker(false);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.pickerOptionText}>{time}</Text>
            </TouchableOpacity>
                            ))}
                          </ScrollView>
        </View>
                      )}
          </View>
                  </>
                )}
              </ScrollView>
            )}

            {/* 모달 액션 버튼 */}
            <View style={[styles.editModalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {!isEditMode ? (
                // 상세 보기 모드 버튼
                <>
                  {selectedTodo && selectedTodo.status !== 'completed' && (
          <TouchableOpacity
                      style={[styles.modalActionButton, styles.editButton]}
                      onPress={handleEditMode}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editButtonText}>수정</Text>
          </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.deleteButton]}
                    onPress={() => {
                      if (selectedTodo) {
                        handleDeleteTodo(selectedTodo.todo_id, selectedTodo.is_recurring);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteButtonText}>삭제</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // 수정 모드 버튼
                <>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.cancelButton]}
                    onPress={() => {
                      setIsEditMode(false);
                      setShowCategoryPicker(false);
                      setShowTimePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>취소</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.saveButton]}
                    onPress={handleSaveEdit}
                    activeOpacity={0.7}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>저장</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* 어르신 추가 모달 */}
      <Modal
        visible={showAddElderlyModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAddElderlyModal(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.editModalContent}>
              {/* 헤더 */}
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>어르신 추가하기</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddElderlyModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButton}>×</Text>
            </TouchableOpacity>
          </View>
          
              {/* 검색 입력 - ScrollView로 감싸기 */}
              <ScrollView 
                style={styles.editModalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>이메일 또는 전화번호</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="예: elderly@example.com"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#999999"
                  />
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.editButton, { flex: 0, paddingHorizontal: 20 }]}
                    onPress={handleSearchElderly}
                    disabled={isSearching}
                    activeOpacity={0.7}
                  >
                    {isSearching ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.editButtonText}>검색</Text>
                    )}
                  </TouchableOpacity>
          </View>
        </View>

              {/* 검색 결과 */}
              {searchResults.length > 0 && (
                <View style={{ maxHeight: 300 }}>
                  {searchResults.map((elderly) => (
                    <View
                      key={elderly.user_id}
                      style={{
                        backgroundColor: '#F8F9FA',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: elderly.is_already_connected ? '#E0E0E0' : '#34B79F',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 }}>
                            성함 : {elderly.name}
                          </Text>
                          <Text style={{ fontSize: 14, color: '#666', marginBottom: 2 }}>
                            ID : {elderly.email}
                          </Text>
                          {elderly.phone_number && (
                            <Text style={{ fontSize: 14, color: '#666' }}>
                              번호 : {elderly.phone_number}
                            </Text>
                          )}
                        </View>

                        {/* 연결 버튼 */}
          <TouchableOpacity
                          style={[
                            styles.modalActionButton,
                            elderly.is_already_connected ? styles.cancelButton : styles.editButton,
                            { paddingHorizontal: 16, paddingVertical: 10 }
                          ]}
                          onPress={() => handleSendConnectionRequest(elderly)}
                          disabled={isConnecting || (elderly.is_already_connected && elderly.connection_status !== 'rejected')}
                          activeOpacity={0.7}
                        >
                          <Text style={elderly.is_already_connected ? styles.cancelButtonText : styles.editButtonText}>
                            {elderly.is_already_connected
                              ? (elderly.connection_status === 'active' ? '연결됨' :
                                 elderly.connection_status === 'pending' ? '대기중' : '거절됨')
                              : '연결 요청'}
                          </Text>
          </TouchableOpacity>
        </View>
                    </View>
                  ))}
                </View>
              )}

              {/* 안내 문구 */}
              {!isSearching && searchResults.length === 0 && searchQuery.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#999', textAlign: 'center', lineHeight: 24 }}>
                    어르신의 이메일 또는 전화번호를{'\n'}
                    입력하고 검색해주세요
                  </Text>
                </View>
              )}
      </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    paddingHorizontal: 16,
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
  tabLabel: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
    marginTop: 4,
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
  healthCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#FFFFFF',
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
  taskIconContainer: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTime: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
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
  viewMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '500',
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

  // 로그아웃 버튼
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

  // 수정/삭제 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',  // 중앙 배치
    alignItems: 'center',      // 가로 중앙
    padding: 20,               // 여백 추가
  },
  editModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,          // 4면 모두 둥글게
    width: '100%',             // 너비 100%
    maxWidth: 500,             // 최대 너비 제한
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  closeButton: {
    fontSize: 32,
    color: '#999999',
    fontWeight: '300',
  },
  editModalBody: {
    padding: 20,
    maxHeight: 400,
  },
  todoDetailSection: {
    marginBottom: 20,
  },
  todoDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  todoDetailLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
  },
  todoDetailValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  editModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#34B79F',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34B79F',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // 통계 탭 스타일
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999999',
    marginTop: 12,
  },

  // 기간 선택 카드
  periodSelectorCard: {
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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#34B79F',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  chartSection: {
    flex: 1,
    alignItems: 'center',
    paddingRight: 30,
  },
  completionChart: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  chartCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  chartProgress: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: 'transparent',
    borderTopColor: '#34B79F',
    borderRightColor: '#34B79F',
  },
  chartInnerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPercentage: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34B79F',
  },
  chartLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  summaryStats: {
    flex: 1,
  },
  summaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryStatNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 30,
  },
  summaryStatLabel: {
    fontSize: 14,
    color: '#666666',
  },

  // 건강 상태 카드
  healthStatusCard: {
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
  healthStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  statusSection: {
    marginBottom: 16,
  },
  statusSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  statusItem: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  statusItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusItemText: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  statusRecommendation: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
  statusGoodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  statusGoodText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  statusAdviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  statusAdviceText: {
    fontSize: 13,
    color: '#34B79F',
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  categoryStatsCard: {
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
  categoryStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  categoryStatRow: {
    marginBottom: 12,
  },
  categoryStatLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryStatLabel: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 6,
  },
  categoryProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryProgressBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryProgressBar: {
    height: '100%',
    backgroundColor: '#34B79F',
    borderRadius: 4,
  },
  categoryProgressText: {
    fontSize: 12,
    color: '#999999',
    minWidth: 80,
    textAlign: 'right',
  },

  // 수정 모드 입력 필드
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333333',
  },
  pickerPlaceholder: {
    color: '#999999',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666666',
  },
  pickerDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionSelected: {
    backgroundColor: '#E8F5F2',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333333',
  },
});
