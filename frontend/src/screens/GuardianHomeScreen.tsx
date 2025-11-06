/**
 * 보호자 전용 홈 화면 (대시보드)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useAuthStore } from '../store/authStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { BottomNavigationBar, Header, QuickActionGrid, type QuickAction, CheckIcon, PhoneIcon, DiaryIcon, TimePicker, CategorySelector } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as todoApi from '../api/todo';
import * as connectionsApi from '../api/connections';
import * as diaryApi from '../api/diary';
import { useAlert } from '../components/GlobalAlertProvider';
import {
  formatDateForDisplay,
  formatTimeAmPm,
  formatTimeToDisplay,
  parseDisplayTimeToApi,
} from '../utils/dateUtils';
import {
  TODO_CATEGORIES,
  getCategoryName,
  getCategoryIcon,
  getCategoryColor,
} from '../constants/TodoCategories';

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

// TabType 제거됨 (탭 네비게이션 제거)

export const GuardianHomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { show } = useAlert();
  const [currentElderlyIndex, setCurrentElderlyIndex] = useState(0);
  const [todayTodos, setTodayTodos] = useState<todoApi.TodoItem[]>([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<todoApi.TodoItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTodo, setEditedTodo] = useState({
    title: '',
    description: '',
    category: '',
    time: '', // "오전/오후 X시" 형식 (표시용)
    timeValue: '12:00', // "HH:MM" 형식 (TimePicker용)
    date: '',
    isRecurring: false,
    recurringType: 'daily' as 'daily' | 'weekly' | 'monthly',
    recurringDays: [] as number[],
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showWeeklyDaysModal, setShowWeeklyDaysModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 어르신 추가 모달 관련 state
  const [showAddElderlyModal, setShowAddElderlyModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<connectionsApi.ElderlySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // 통계 데이터 상태
  const [monthlyStats, setMonthlyStats] = useState<todoApi.TodoDetailedStats | null>(null);
  const [lastMonthStats, setLastMonthStats] = useState<todoApi.TodoDetailedStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'last_month'>('month');
  const [allTodos, setAllTodos] = useState<todoApi.TodoItem[]>([]); // 전체 할일 목록 (통계 없을 때 구분용)
  const [selectedDayTab, setSelectedDayTab] = useState<'today' | 'tomorrow'>('today'); // 오늘/내일 탭

  // 연결된 어르신 목록 (API에서 가져옴)
  const [connectedElderly, setConnectedElderly] = useState<ElderlyProfile[]>([]);
  const [isLoadingElderly, setIsLoadingElderly] = useState(false);
  
  // 스크롤 관련 ref
  const scrollViewRef = useRef<ScrollView>(null);
  
  // 전체보기 토글 상태
  const [showAllTodos, setShowAllTodos] = useState(false);
  
  // 다이어리 관련 상태
  const [recentDiaries, setRecentDiaries] = useState<diaryApi.Diary[]>([]);
  const [isLoadingDiaries, setIsLoadingDiaries] = useState(false);
  
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

      {/* 빠른 액션 버튼 (어르신 카드 바로 아래) */}
      {currentElderly && quickActions.length > 0 && (
        <QuickActionGrid actions={quickActions} />
      )}

      {/* 오늘/내일 할 일 카드 (어르신 화면 스타일) */}
      {currentElderly && (
        <View style={styles.scheduleCard}>
          <View style={styles.cardHeader}>
            {/* 오늘/내일 탭 */}
            <View style={styles.dayTabContainer}>
              <TouchableOpacity
                style={[styles.dayTab, selectedDayTab === 'today' && styles.dayTabActive]}
                onPress={() => {
                  setSelectedDayTab('today');
                  if (currentElderly) {
                    loadTodosForElderly(currentElderly.id, false, 'today');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayTabText, selectedDayTab === 'today' && styles.dayTabTextActive]}>
                  오늘
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dayTab, selectedDayTab === 'tomorrow' && styles.dayTabActive]}
                onPress={() => {
                  setSelectedDayTab('tomorrow');
                  if (currentElderly) {
                    loadTodosForElderly(currentElderly.id, false, 'tomorrow');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayTabText, selectedDayTab === 'tomorrow' && styles.dayTabTextActive]}>
                  내일
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isLoadingTodos ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#34B79F" />
            </View>
          ) : (() => {
            // 시간순 정렬 함수
            const sortByTime = (a: todoApi.TodoItem, b: todoApi.TodoItem) => {
              // 시간이 없는 항목은 뒤로
              if (!a.due_time && !b.due_time) return 0;
              if (!a.due_time) return 1;
              if (!b.due_time) return -1;
              return a.due_time.localeCompare(b.due_time);
            };

            // 완료되지 않은 항목과 완료된 항목 분리
            const pendingTodos = todayTodos.filter(todo => 
              todo.status !== 'completed' && todo.status !== 'cancelled'
            ).sort(sortByTime);
            
            const completedTodos = todayTodos.filter(todo => 
              todo.status === 'completed'
            ).sort(sortByTime);

            // 전체 목록: 미완료 항목 먼저, 완료 항목 나중에
            const allSortedTodos = [...pendingTodos, ...completedTodos];
            
            // 표시할 항목 결정 (전체보기 토글에 따라)
            const displayTodos = showAllTodos ? allSortedTodos : pendingTodos.slice(0, 3);
            const hasMoreTodos = pendingTodos.length > 3 || completedTodos.length > 0;

            return allSortedTodos.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: '#999999' }}>
                  {selectedDayTab === 'today' ? '오늘' : '내일'} 할 일이 없습니다
                </Text>
              </View>
            ) : (
              <>
                {displayTodos.map((todo) => {
                const isCompleted = todo.status === 'completed';
                return (
                  <TouchableOpacity
                    key={todo.todo_id}
                    style={[
                      styles.scheduleItem,
                      isCompleted && styles.scheduleItemCompleted
                    ]}
                    onPress={() => {
                      // 모든 항목을 모달로 표시 (수정 가능)
                      setSelectedTodo(todo);
                      setIsEditMode(false);
                      // 모달 열 때 즉시 수정 모드로 진입
                      if (todo) {
                        // 시간 변환 (HH:MM → 오전/오후 형식)
                        let timeDisplay = '';
                        if (todo.due_time) {
                          const [hours] = todo.due_time.split(':');
                          const hour = parseInt(hours);
                          const isPM = hour >= 12;
                          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                          timeDisplay = `${isPM ? '오후' : '오전'} ${displayHour}시`;
                        }
                        
                        // 반복 요일 변환
                        let recurringDays: number[] = [];
                        if (todo.recurring_days && Array.isArray(todo.recurring_days)) {
                          recurringDays = todo.recurring_days;
                        }
                        
                        setEditedTodo({
                          title: todo.title,
                          description: todo.description || '',
                          category: todo.category || '',
                          time: timeDisplay,
                          timeValue: todo.due_time || '12:00',
                          date: todo.due_date,
                          isRecurring: todo.is_recurring || false,
                          recurringType: todo.recurring_type?.toLowerCase() as 'daily' | 'weekly' | 'monthly' || 'daily',
                          recurringDays: recurringDays,
                        });
                        setIsEditMode(true);
                      }
                      setShowEditModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.scheduleTime}>
                      <Text style={[
                        styles.scheduleTimeText,
                        isCompleted && styles.scheduleTimeTextCompleted
                      ]}>
                        {todo.due_time ? todo.due_time.substring(0, 5) : '시간미정'}
                      </Text>
                    </View>
                    <View style={styles.scheduleContent}>
                      <Text 
                        style={[
                          styles.scheduleTitle,
                          isCompleted && styles.scheduleTitleCompleted
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {todo.title}
                      </Text>
                      {todo.description && (
                        <Text 
                          style={[
                            styles.scheduleLocation,
                            isCompleted && styles.scheduleLocationCompleted
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {todo.description}
                        </Text>
                      )}
                      {todo.category && (
                        <Text style={[
                          styles.scheduleDate,
                          isCompleted && styles.scheduleDateCompleted
                        ]}>
                          [{getCategoryName(todo.category)}]
                        </Text>
                      )}
                    </View>
                    <View style={[
                      styles.scheduleStatus,
                      isCompleted && styles.scheduleStatusCompleted
                    ]}>
                      <Text style={[
                        styles.scheduleStatusText,
                        isCompleted && styles.scheduleStatusTextCompleted
                      ]}>
                        {isCompleted ? '완료' : '예정'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
                {hasMoreTodos && (
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => setShowAllTodos(!showAllTodos)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.expandButtonText}>
                      {showAllTodos ? '접기 ▲' : `전체보기 ▼ (${allSortedTodos.length}개)`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
        </View>
      )}

    </>
  );

  // 통계 탭 (새로 추가)
  const renderStatsTab = () => {
    const stats = selectedPeriod === 'month' ? monthlyStats : lastMonthStats;
    
    // 데이터 로딩 중
    if (!connectedElderly.length || !stats) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#34B79F" />
          <Text style={styles.emptyStateText}>통계 데이터를 불러오는 중...</Text>
        </View>
      );
    }
    
    // 통계 데이터가 없을 때 (total === 0) - 하루 이미지와 안내 문구 표시
    const hasNoStats = stats.total === 0;
    
    return (
      <>
        {/* 월간/전월 요약 선택 - 항상 표시 */}
        <View style={styles.periodSelectorCard}>
          <View style={styles.periodSelector}>
            <TouchableOpacity 
              style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedPeriod('month');
                // 월간 통계가 없으면 로딩
                if (currentElderly && !monthlyStats) {
                  loadMonthlyStatsForElderly(currentElderly.id);
                }
              }}
            >
              <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>
                이번 달
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.periodButton, selectedPeriod === 'last_month' && styles.periodButtonActive]}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedPeriod('last_month');
                // 전월 통계가 없으면 로딩
                if (currentElderly && !lastMonthStats) {
                  loadLastMonthStatsForElderly(currentElderly.id);
                }
              }}
            >
              <Text style={[styles.periodButtonText, selectedPeriod === 'last_month' && styles.periodButtonTextActive]}>
                지난 달
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* 요약 통계 - 통계 데이터가 있을 때만 표시 */}
          {!hasNoStats && (
            <View style={styles.summaryStats}>
              <View style={styles.summaryStatItem}>
                <Ionicons name="checkmark-circle" size={20} color="#34B79F" />
                <Text style={styles.summaryStatNumber}>{stats.completed || 0}</Text>
                <Text style={styles.summaryStatLabel}>완료</Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Ionicons name="time" size={20} color="#FF9500" />
                <Text style={styles.summaryStatNumber}>{stats.pending || 0}</Text>
                <Text style={styles.summaryStatLabel}>대기</Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                <Text style={styles.summaryStatNumber}>{stats.cancelled || 0}</Text>
                <Text style={styles.summaryStatLabel}>취소</Text>
              </View>
            </View>
          )}
        </View>

        {/* 통계 데이터가 없을 때 - 하루 이미지와 안내 문구 */}
        {hasNoStats ? (
          <View style={styles.emptyStatsCard}>
            <Image 
              source={require('../../assets/haru-error.png')} 
              style={styles.emptyStatsImage}
              resizeMode="contain"
            />
            {(() => {
              // 할일이 아예 없는지, 미래 일정만 있는지 확인
              const hasAnyTodos = allTodos.length > 0;
              const today = new Date();
              today.setHours(0, 0, 0, 0); // 시간 제거하여 날짜만 비교
              
              // 미래 할일만 있는지 확인
              const hasFutureTodos = allTodos.some(todo => {
                if (!todo.due_date) return false;
                const todoDate = new Date(todo.due_date);
                todoDate.setHours(0, 0, 0, 0);
                return todoDate > today;
              });
              
              const hasPastOrTodayTodos = allTodos.some(todo => {
                if (!todo.due_date) return false;
                const todoDate = new Date(todo.due_date);
                todoDate.setHours(0, 0, 0, 0);
                return todoDate <= today;
              });
              
              // 할일이 아예 없는 경우
              if (!hasAnyTodos) {
                return (
                  <>
                    <Text style={styles.emptyStatsText}>할일을 등록해주세요!</Text>
                    <Text style={styles.emptyStatsSubText}>
                      어르신의 할일을 등록하시면{'\n'}통계와 조언을 제공해드릴게요
                    </Text>
                  </>
                );
              }
              
              // 할일은 있지만 미래 일정만 있는 경우 (과거/오늘 할일이 없음)
              if (hasFutureTodos && !hasPastOrTodayTodos) {
                return (
                  <>
                    <Text style={styles.emptyStatsText}>아직 통계 데이터가 없어요</Text>
                    <Text style={styles.emptyStatsSubText}>
                      {selectedPeriod === 'month' ? '이번 달' : '지난 달'}에 해당하는 할일이 없습니다.{'\n'}
                      할일이 등록되어 있지만 미래 날짜라서 통계가 잡히지 않았어요
                    </Text>
                  </>
                );
              }
              
              // 그 외의 경우 (할일이 있지만 통계가 안 잡힌 경우 - 혹시 모를 상황)
              return (
                <>
                  <Text style={styles.emptyStatsText}>할일을 등록해주세요!</Text>
                  <Text style={styles.emptyStatsSubText}>
                    어르신의 할일을 등록하시면{'\n'}통계와 조언을 제공해드릴게요
                  </Text>
                </>
              );
            })()}
            {currentElderly && (
              <TouchableOpacity
                style={styles.addTodoButton}
                onPress={() => router.push(`/guardian-todo-add?elderlyId=${currentElderly.id}&elderlyName=${encodeURIComponent(currentElderly.name)}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.addTodoButtonText}>할일 등록하기</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* 건강 상태 알림 */}
            <View style={styles.healthStatusCard}>
              <Text style={styles.healthStatusTitle}>건강 상태 체크</Text>
              
              {/* 주의 필요 */}
              {generateHealthAlerts(stats).length > 0 && (
                <View style={styles.statusSection}>
                  <Text style={styles.statusSectionTitle}>확인이 필요한 부분</Text>
                  {generateHealthAlerts(stats).map((alert, index) => (
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
              {generateGoodStatus(stats).length > 0 && (
                <View style={styles.statusSection}>
                  <Text style={styles.statusSectionTitle}>잘하고 있어요</Text>
                  {generateGoodStatus(stats).map((item, index) => (
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
                {(() => {
                  const recommendations = generateRecommendations(stats);
                  
                  if (recommendations.length === 0) {
                    return (
                      <View style={styles.statusAdviceItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={[styles.statusAdviceText, { color: '#4CAF50' }]}>
                          모든 할일을 잘 수행하고 계세요! 현재 상태를 계속 유지해주세요.
                        </Text>
                      </View>
                    );
                  }
                  
                  return recommendations.map((rec, index) => (
                    <View key={index} style={styles.statusAdviceItem}>
                      <Ionicons name="bulb" size={16} color="#34B79F" />
                      <Text style={styles.statusAdviceText}>{rec}</Text>
                    </View>
                  ));
                })()}
              </View>
            </View>
          </>
        )}
      </>
    );
  };

  // 건강관리 카테고리별 분석 함수 (간결한 버전)
  const getCategoryAnalysis = (category: 'MEDICINE' | 'HOSPITAL' | 'EXERCISE' | 'MEAL') => {
    // 오늘 날짜의 TODO 필터링
    const todayCategoryTodos = todayTodos.filter(t => t.category === category);
    const todayCompleted = todayCategoryTodos.filter(t => t.status === 'completed').length;
    const todayTotal = todayCategoryTodos.length;

    // 이번 달 통계에서 카테고리 찾기
    const categoryStats = monthlyStats?.by_category.find(c => c.category === category);
    const completionRate = categoryStats ? Math.round(categoryStats.completion_rate * 100) : 0;
    
    // 다가오는 일정 찾기 (병원 일정용)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingTodos = allTodos
      .filter(t => {
        if (t.category !== category || t.status !== 'pending') return false;
        const todoDate = new Date(t.due_date);
        todoDate.setHours(0, 0, 0, 0);
        return todoDate.getTime() >= today.getTime();
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.due_date} ${a.due_time || '00:00'}`);
        const dateB = new Date(`${b.due_date} ${b.due_time || '00:00'}`);
        return dateA.getTime() - dateB.getTime();
      });

    switch (category) {
      case 'MEDICINE': {
        // 복약 관리: 오늘 완료/전체
        const statusText = todayTotal > 0 ? `오늘 ${todayCompleted}/${todayTotal}` : '오늘 일정 없음';
        return {
          status: statusText,
          completionRate,
          categoryStats,
        };
      }

      case 'HOSPITAL': {
        // 병원 일정: 다가오는 일정
        const nextAppointment = upcomingTodos[0];
        let statusText = '일정 없음';
        
        if (nextAppointment) {
          const appointmentDate = new Date(nextAppointment.due_date);
          const daysUntil = Math.ceil((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntil === 0) {
            statusText = '오늘';
          } else if (daysUntil === 1) {
            statusText = '내일';
          } else if (daysUntil <= 7) {
            statusText = `${daysUntil}일 후`;
          } else {
            const month = appointmentDate.getMonth() + 1;
            const day = appointmentDate.getDate();
            statusText = `${month}월 ${day}일`;
          }
        }
        
        return {
          status: statusText,
          completionRate,
          categoryStats,
          nextAppointment,
        };
      }

      case 'EXERCISE': {
        // 운동 기록: 오늘 완료 여부
        const statusText = todayCompleted > 0 ? '오늘 완료' : todayTotal > 0 ? '오늘 미완료' : '오늘 일정 없음';
        return {
          status: statusText,
          completionRate,
          categoryStats,
        };
      }

      case 'MEAL': {
        // 식사 관리: 오늘 완료/전체
        const statusText = todayTotal > 0 ? `오늘 ${todayCompleted}/${todayTotal}` : '오늘 일정 없음';
        return {
          status: statusText,
          completionRate,
          categoryStats,
        };
      }

      default:
        return {
          status: '데이터 없음',
          completionRate: 0,
          categoryStats: null,
        };
    }
  };

  const renderHealthTab = () => {
    const medicineAnalysis = getCategoryAnalysis('MEDICINE');
    const hospitalAnalysis = getCategoryAnalysis('HOSPITAL');
    const exerciseAnalysis = getCategoryAnalysis('EXERCISE');
    const mealAnalysis = getCategoryAnalysis('MEAL');

    return (
      <View>
        <View style={styles.healthSection}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="fitness" size={24} color="#34B79F" />
            <Text style={styles.sectionTitle}>건강관리</Text>
          </View>
          
          {/* 복약 관리 */}
          <View style={styles.healthCard}>
            <View style={styles.healthCardHeader}>
              <View style={styles.healthCardTitleContainer}>
                <Ionicons name="medical" size={20} color="#FF6B6B" />
                <Text style={styles.healthCardTitle}>복약 관리</Text>
              </View>
              {medicineAnalysis.categoryStats && medicineAnalysis.categoryStats.total > 0 && (
                <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#FF6B6B15' }]}>
                  <Text style={[styles.healthCardCompletionRate, { color: '#FF6B6B' }]}>
                    {medicineAnalysis.completionRate}%
                  </Text>
                  <Text style={[styles.healthCardCompletionLabel, { color: '#FF6B6B' }]}>
                    이번 달
                  </Text>
                </View>
              )}
            </View>
            
            {/* 오늘 상태 배지 */}
            <View style={styles.healthCardTodaySection}>
              <Text style={styles.healthCardSectionLabel}>오늘</Text>
              <View style={[styles.healthCardTodayBadge, { backgroundColor: '#FF6B6B15' }]}>
                <Text style={[styles.healthCardTodayText, { color: '#FF6B6B' }]}>
                  {medicineAnalysis.status}
                </Text>
              </View>
            </View>

            {/* 이번 달 통계 - Progress Bar */}
            {medicineAnalysis.categoryStats && medicineAnalysis.categoryStats.total > 0 && (
              <View style={styles.healthCardStatsSection}>
                <View style={styles.healthCardProgressContainer}>
                  <View style={styles.healthCardProgressBg}>
                    <View 
                      style={[
                        styles.healthCardProgressBar,
                        { 
                          width: `${medicineAnalysis.completionRate}%`,
                          backgroundColor: '#FF6B6B'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.healthCardProgressText}>
                    {medicineAnalysis.categoryStats.completed}/{medicineAnalysis.categoryStats.total}
                  </Text>
                </View>
                <Text style={styles.healthCardStatsLabel}>이번 달 통계</Text>
              </View>
            )}
          </View>

          {/* 병원 일정 */}
          <View style={styles.healthCard}>
            <View style={styles.healthCardHeader}>
              <View style={styles.healthCardTitleContainer}>
                <Ionicons name="medical-outline" size={20} color="#4ECDC4" />
                <Text style={styles.healthCardTitle}>병원 일정</Text>
              </View>
              {hospitalAnalysis.categoryStats && hospitalAnalysis.categoryStats.total > 0 && (
                <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#4ECDC415' }]}>
                  <Text style={[styles.healthCardCompletionRate, { color: '#4ECDC4' }]}>
                    {hospitalAnalysis.completionRate}%
                  </Text>
                  <Text style={[styles.healthCardCompletionLabel, { color: '#4ECDC4' }]}>
                    이번 달
                  </Text>
                </View>
              )}
            </View>
            
            {/* 다가오는 일정 */}
            <View style={styles.healthCardTodaySection}>
              <Text style={styles.healthCardSectionLabel}>다가오는 일정</Text>
              {hospitalAnalysis.nextAppointment ? (
                (() => {
                  const appointmentDate = new Date(hospitalAnalysis.nextAppointment.due_date);
                  const month = appointmentDate.getMonth() + 1;
                  const day = appointmentDate.getDate();
                  const timeDisplay = hospitalAnalysis.nextAppointment.due_time 
                    ? `${hospitalAnalysis.nextAppointment.due_time.substring(0, 5)}`
                    : '시간 미정';
                  return (
                    <View style={[styles.healthCardTodayBadge, { backgroundColor: '#4ECDC415' }]}>
                      <Text style={[styles.healthCardTodayText, { color: '#4ECDC4' }]}>
                        {hospitalAnalysis.nextAppointment.title || '병원 방문'}
                      </Text>
                      <Text style={[styles.healthCardTodaySubText, { color: '#4ECDC4' }]}>
                        {month}월 {day}일 {timeDisplay}
                      </Text>
                    </View>
                  );
                })()
              ) : (
                <View style={[styles.healthCardTodayBadge, { backgroundColor: '#F0F0F0' }]}>
                  <Text style={[styles.healthCardTodayText, { color: '#999999' }]}>
                    일정 없음
                  </Text>
                </View>
              )}
            </View>

            {/* 이번 달 통계 - Progress Bar */}
            {hospitalAnalysis.categoryStats && hospitalAnalysis.categoryStats.total > 0 && (
              <View style={styles.healthCardStatsSection}>
                <View style={styles.healthCardProgressContainer}>
                  <View style={styles.healthCardProgressBg}>
                    <View 
                      style={[
                        styles.healthCardProgressBar,
                        { 
                          width: `${hospitalAnalysis.completionRate}%`,
                          backgroundColor: '#4ECDC4'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.healthCardProgressText}>
                    {hospitalAnalysis.categoryStats.completed}/{hospitalAnalysis.categoryStats.total}
                  </Text>
                </View>
                <Text style={styles.healthCardStatsLabel}>이번 달 통계</Text>
              </View>
            )}
          </View>

          {/* 운동 기록 */}
          <View style={styles.healthCard}>
            <View style={styles.healthCardHeader}>
              <View style={styles.healthCardTitleContainer}>
                <Ionicons name="fitness" size={20} color="#45B7D1" />
                <Text style={styles.healthCardTitle}>운동 기록</Text>
              </View>
              {exerciseAnalysis.categoryStats && exerciseAnalysis.categoryStats.total > 0 && (
                <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#45B7D115' }]}>
                  <Text style={[styles.healthCardCompletionRate, { color: '#45B7D1' }]}>
                    {exerciseAnalysis.completionRate}%
                  </Text>
                  <Text style={[styles.healthCardCompletionLabel, { color: '#45B7D1' }]}>
                    이번 달
                  </Text>
                </View>
              )}
            </View>
            
            {/* 오늘 상태 배지 */}
            <View style={styles.healthCardTodaySection}>
              <Text style={styles.healthCardSectionLabel}>오늘</Text>
              <View style={[
                styles.healthCardTodayBadge, 
                { 
                  backgroundColor: exerciseAnalysis.status === '오늘 완료' ? '#45B7D115' : '#F0F0F0'
                }
              ]}>
                <Text style={[
                  styles.healthCardTodayText, 
                  { color: exerciseAnalysis.status === '오늘 완료' ? '#45B7D1' : '#999999' }
                ]}>
                  {exerciseAnalysis.status}
                </Text>
              </View>
            </View>

            {/* 이번 달 통계 - Progress Bar */}
            {exerciseAnalysis.categoryStats && exerciseAnalysis.categoryStats.total > 0 && (
              <View style={styles.healthCardStatsSection}>
                <View style={styles.healthCardProgressContainer}>
                  <View style={styles.healthCardProgressBg}>
                    <View 
                      style={[
                        styles.healthCardProgressBar,
                        { 
                          width: `${exerciseAnalysis.completionRate}%`,
                          backgroundColor: '#45B7D1'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.healthCardProgressText}>
                    {exerciseAnalysis.categoryStats.completed}/{exerciseAnalysis.categoryStats.total}
                  </Text>
                </View>
                <Text style={styles.healthCardStatsLabel}>이번 달 통계</Text>
              </View>
            )}
          </View>

          {/* 식사 관리 */}
          <View style={styles.healthCard}>
            <View style={styles.healthCardHeader}>
              <View style={styles.healthCardTitleContainer}>
                <Ionicons name="restaurant" size={20} color="#96CEB4" />
                <Text style={styles.healthCardTitle}>식사 관리</Text>
              </View>
              {mealAnalysis.categoryStats && mealAnalysis.categoryStats.total > 0 && (
                <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#96CEB415' }]}>
                  <Text style={[styles.healthCardCompletionRate, { color: '#96CEB4' }]}>
                    {mealAnalysis.completionRate}%
                  </Text>
                  <Text style={[styles.healthCardCompletionLabel, { color: '#96CEB4' }]}>
                    이번 달
                  </Text>
                </View>
              )}
            </View>
            
            {/* 오늘 상태 배지 */}
            <View style={styles.healthCardTodaySection}>
              <Text style={styles.healthCardSectionLabel}>오늘</Text>
              <View style={[styles.healthCardTodayBadge, { backgroundColor: '#96CEB415' }]}>
                <Text style={[styles.healthCardTodayText, { color: '#96CEB4' }]}>
                  {mealAnalysis.status}
                </Text>
              </View>
            </View>

            {/* 이번 달 통계 - Progress Bar */}
            {mealAnalysis.categoryStats && mealAnalysis.categoryStats.total > 0 && (
              <View style={styles.healthCardStatsSection}>
                <View style={styles.healthCardProgressContainer}>
                  <View style={styles.healthCardProgressBg}>
                    <View 
                      style={[
                        styles.healthCardProgressBar,
                        { 
                          width: `${mealAnalysis.completionRate}%`,
                          backgroundColor: '#96CEB4'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.healthCardProgressText}>
                    {mealAnalysis.categoryStats.completed}/{mealAnalysis.categoryStats.total}
                  </Text>
                </View>
                <Text style={styles.healthCardStatsLabel}>이번 달 통계</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // 감정 아이콘 및 색상 매핑
  const getMoodIcon = (mood: string | null | undefined) => {
    if (!mood) return { name: 'help-circle-outline', color: '#999999' };
    
    const moodLower = mood.toLowerCase();
    if (moodLower.includes('happy')) {
      return { name: 'happy', color: '#FFD700' };
    } else if (moodLower.includes('excited')) {
      return { name: 'happy', color: '#FF6B6B' };
    } else if (moodLower.includes('calm')) {
      return { name: 'happy-outline', color: '#4ECDC4' };
    } else if (moodLower.includes('sad')) {
      return { name: 'sad', color: '#5499C7' };
    } else if (moodLower.includes('angry')) {
      return { name: 'flame', color: '#E74C3C' };
    } else if (moodLower.includes('tired')) {
      return { name: 'moon', color: '#9B59B6' };
    }
    return { name: 'help-circle-outline', color: '#999999' };
  };
  
  const getMoodLabel = (mood: string | null | undefined) => {
    if (!mood) return '감정 없음';
    
    const moodLower = mood.toLowerCase();
    if (moodLower.includes('happy')) return '행복함';
    if (moodLower.includes('excited')) return '신남';
    if (moodLower.includes('calm')) return '평온함';
    if (moodLower.includes('sad')) return '슬픔';
    if (moodLower.includes('angry')) return '화남';
    if (moodLower.includes('tired')) return '피곤함';
    return mood;
  };
  
  // 날짜 포맷팅
  const formatDiaryDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  };

  const renderCommunicationTab = () => {
    const emotionAnalysis = analyzeEmotionState();
    
    return (
      <View>
        <View style={styles.communicationSection}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="chatbubbles" size={24} color="#34B79F" />
            <Text style={styles.sectionTitle}>소통</Text>
          </View>
          
          {/* 최근 다이어리 목록 */}
          {isLoadingDiaries ? (
            <View style={styles.commCard}>
              <ActivityIndicator size="small" color="#34B79F" />
              <Text style={styles.commCardContent}>다이어리를 불러오는 중...</Text>
            </View>
          ) : recentDiaries.length > 0 ? (
            recentDiaries.slice(0, 5).map((diary) => {
              const moodIcon = getMoodIcon(diary.mood);
              return (
                <TouchableOpacity
                  key={diary.diary_id}
                  style={styles.commCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/diary-detail?id=${diary.diary_id}`)}
                >
                  <View style={styles.commCardHeader}>
                    <View style={styles.commCardTitleContainer}>
                      <Ionicons name="book" size={18} color="#FF9500" />
                      <Text style={styles.commCardTitle}>최근 일기</Text>
                    </View>
                    <Text style={styles.commCardTime}>{formatDiaryDate(diary.date)}</Text>
                  </View>
                  <Text 
                    style={styles.commCardContent}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {diary.content}
                  </Text>
                  {diary.mood && (
                    <View style={styles.moodContainer}>
                      <Ionicons name={moodIcon.name as any} size={16} color={moodIcon.color} />
                      <Text style={[styles.commCardMood, { color: moodIcon.color }]}>
                        {getMoodLabel(diary.mood)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.commCard}>
              <Text style={styles.commCardContent}>아직 작성된 다이어리가 없습니다.</Text>
            </View>
          )}

          {/* 감정 분석 */}
          {/* {emotionAnalysis.total && emotionAnalysis.total > 0 && (
            <View style={styles.commCard}>
              <View style={styles.commCardHeader}>
                <View style={styles.commCardTitleContainer}>
                  <Ionicons name="analytics" size={18} color="#9C27B0" />
                  <Text style={styles.commCardTitle}>감정 분석</Text>
                </View>
                <Text style={styles.commCardTime}>최근 7일</Text>
              </View>
              <Text style={styles.commCardContent}>{emotionAnalysis.summary}</Text>
              {Object.keys(emotionAnalysis.emotionStats).length > 0 && (
                <View style={styles.emotionTags}>
                  {Object.entries(emotionAnalysis.emotionStats).map(([mood, percentage]) => {
                    const moodIcon = getMoodIcon(mood);
                    return (
                      <View key={mood} style={styles.emotionTagWithIcon}>
                        <Ionicons name={moodIcon.name as any} size={12} color={moodIcon.color} />
                        <Text style={styles.emotionTag}>
                          {getMoodLabel(mood)} {percentage}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )} */}
          
          {/* 일기장 바로가기 */}
          {currentElderly && (
            <TouchableOpacity
              style={[styles.commCard, styles.viewAllCard]}
              activeOpacity={0.7}
              onPress={() => router.push('/diaries')}
            >
              <View style={styles.commCardHeader}>
                <View style={styles.commCardTitleContainer}>
                  <Ionicons name="book-outline" size={18} color="#34B79F" />
                  <Text style={styles.commCardTitle}>전체 일기장 보기</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#999999" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
    } catch (error: any) {
      console.error('❌ 연결된 어르신 로딩 실패:', error);
      setConnectedElderly([]);
      show('오류', '연결된 어르신 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingElderly(false);
    }
  };

  // 어르신의 TODO 불러오기 (선택된 날짜만 조회 - 어르신 화면과 동일한 방식)
  const loadTodosForElderly = async (
    elderlyId: string, 
    skipLoadingState: boolean = false,
    dayTab?: 'today' | 'tomorrow'  // 명시적으로 전달하지 않으면 현재 selectedDayTab 사용
  ) => {
    // dayTab이 전달되지 않으면 현재 selectedDayTab 사용
    const targetDayTab = dayTab ?? selectedDayTab;
    if (!elderlyId) {
      console.warn('⚠️ 보호자: elderlyId가 없어서 TODO 로딩 스킵');
      return;
    }
    
    // 이미 로딩 중이면 중복 호출 방지 (단, skipLoadingState가 true면 강제 실행)
    // 하지만 dayTab이 변경된 경우(탭 전환)는 강제 실행하여 최신 데이터 로드
    const isTabChanged = dayTab !== undefined && dayTab !== selectedDayTab;
    if (isLoadingTodos && !skipLoadingState && !isTabChanged) {
      console.log('⚠️ 보호자: 이미 TODO 로딩 중이므로 스킵');
      return;
    }
    
    if (!skipLoadingState) {
      setIsLoadingTodos(true);
    }
    try {
      // 선택된 탭에 따라 날짜 필터 결정 (어르신 화면과 동일한 방식)
      const dateFilter = targetDayTab === 'today' ? 'today' : 'tomorrow';
      console.log('📥 보호자: 어르신 TODO 로딩 시작 -', elderlyId, `(${targetDayTab === 'today' ? '오늘' : '내일'})`);
      
      // 백엔드에서 해당 날짜만 조회 (반복 일정 자동 생성 포함)
      const todos = await todoApi.getTodos(dateFilter, elderlyId);
      
      console.log(`✅ 보호자: TODO 목록 불러오기 완료 - ${todos.length}개 (${targetDayTab === 'today' ? '오늘' : '내일'})`);
      console.log('📊 완료된 TODO:', todos.filter(t => t.status === 'completed').length);

      
      // 성공 시에만 상태 업데이트 (로딩 중에도 이전 데이터 유지)
      setTodayTodos(todos);
    } catch (error: any) {
      console.error('❌ TODO 로딩 실패:', error);
      console.error('❌ 에러 상세:', error.response?.data || error.message);
      // 에러 시에만 빈 배열로 설정 (이전 데이터가 있으면 유지하지 않음)
      // 하지만 사용자에게는 에러 알림만 표시하고 데이터는 유지
      show('오류', '할일 목록을 불러오는데 실패했습니다.');
    } finally {
      if (!skipLoadingState) {
        setIsLoadingTodos(false);
      }
    }
  };

  // 최근 다이어리 불러오기
  const loadRecentDiaries = async (elderlyId: string) => {
    if (!elderlyId) return;
    
    setIsLoadingDiaries(true);
    try {
      console.log('📖 보호자: 최근 다이어리 로딩 시작 -', elderlyId);
      const diaries = await diaryApi.getDiaries({
        elderly_id: elderlyId,
        limit: 5, // 최근 5개만
      });
      console.log('✅ 보호자: 다이어리 로딩 성공 -', diaries.length, '개');
      setRecentDiaries(diaries);
    } catch (error: any) {
      console.error('❌ 다이어리 로딩 실패:', error);
      setRecentDiaries([]);
    } finally {
      setIsLoadingDiaries(false);
    }
  };
  
  // 감정 상태 분석 함수
  const analyzeEmotionState = () => {
    if (recentDiaries.length === 0) {
      return {
        summary: '아직 다이어리가 없습니다.',
        emotionStats: {},
        dominantEmotion: null,
      };
    }
    
    // 최근 7일간의 다이어리만 분석
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentWeekDiaries = recentDiaries.filter(diary => {
      const diaryDate = new Date(diary.date);
      return diaryDate >= sevenDaysAgo;
    });
    
    if (recentWeekDiaries.length === 0) {
      return {
        summary: '최근 7일간 작성된 다이어리가 없습니다.',
        emotionStats: {},
        dominantEmotion: null,
      };
    }
    
    // mood별 카운트
    const moodCount: Record<string, number> = {};
    recentWeekDiaries.forEach(diary => {
      if (diary.mood) {
        moodCount[diary.mood] = (moodCount[diary.mood] || 0) + 1;
      }
    });
    
    // 전체 감정 통계 계산
    const total = recentWeekDiaries.length;
    const emotionStats: Record<string, number> = {};
    Object.keys(moodCount).forEach(mood => {
      emotionStats[mood] = Math.round((moodCount[mood] / total) * 100);
    });
    
    // 주요 감정 찾기
    const dominantEmotion = Object.keys(moodCount).reduce((a, b) => 
      moodCount[a] > moodCount[b] ? a : b, Object.keys(moodCount)[0]
    );
    
    // 요약 메시지 생성
    let summary = '';
    const positiveMoods = ['happy', 'excited', 'calm', 'content'];
    const negativeMoods = ['sad', 'angry', 'anxious', 'worried'];
    
    const positiveCount = Object.keys(moodCount).filter(m => 
      positiveMoods.includes(m.toLowerCase())
    ).reduce((sum, m) => sum + moodCount[m], 0);
    
    const negativeCount = Object.keys(moodCount).filter(m => 
      negativeMoods.includes(m.toLowerCase())
    ).reduce((sum, m) => sum + moodCount[m], 0);
    
    if (positiveCount > negativeCount * 2) {
      summary = '전반적으로 긍정적이고 안정적인 감정 상태를 보이고 있습니다.';
    } else if (positiveCount > negativeCount) {
      summary = '대체로 안정적인 감정 상태를 보이고 있습니다.';
    } else if (negativeCount > positiveCount) {
      summary = '감정 상태에 주의가 필요할 수 있습니다.';
    } else {
      summary = '감정 상태를 지속적으로 확인해주세요.';
    }
    
    return {
      summary,
      emotionStats,
      dominantEmotion,
      total,
    };
  };

  // 통계 데이터 불러오기
  const loadStatsForElderly = async (
    elderlyId: string,
    period: 'month' | 'last_month',
    skipLoadingState: boolean = false
  ) => {
    if (!skipLoadingState) {
      setIsLoadingStats(true);
    }
    try {
      const stats = await todoApi.getDetailedStats(period, elderlyId);
      
      if (period === 'month') {
        setMonthlyStats(stats);
      } else {
        setLastMonthStats(stats);
      }
    } catch (error: any) {
      console.error(`통계 로딩 실패:`, error);
      show('오류', '통계를 불러오는데 실패했습니다.');
    } finally {
      if (!skipLoadingState) {
        setIsLoadingStats(false);
      }
    }
  };

  // 하위 호환성을 위한 별칭 함수들 (기존 코드 호환성 유지)
  const loadMonthlyStatsForElderly = (elderlyId: string, skipLoadingState: boolean = false) => {
    return loadStatsForElderly(elderlyId, 'month', skipLoadingState);
  };

  const loadLastMonthStatsForElderly = (elderlyId: string, skipLoadingState: boolean = false) => {
    return loadStatsForElderly(elderlyId, 'last_month', skipLoadingState);
  };

  // 통계 새로고침 공통 함수 (선택된 기간에 따라 자동 로딩)
  const refreshStats = useCallback(async (elderlyId: string, skipLoadingState: boolean = false) => {
    if (selectedPeriod === 'month') {
      await loadStatsForElderly(elderlyId, 'month', skipLoadingState);
    } else if (selectedPeriod === 'last_month') {
      await loadStatsForElderly(elderlyId, 'last_month', skipLoadingState);
    }
  }, [selectedPeriod]);

  // Pull-to-Refresh 핸들러
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 연결된 어르신 목록 새로고침
      await loadConnectedElderly();
      
      // currentElderly는 연결된 어르신 목록이 업데이트된 후에 다시 계산되므로
      // connectedElderly 상태를 직접 사용하거나 현재 인덱스로 접근
      const targetElderly = currentElderlyIndex < connectedElderly.length 
        ? connectedElderly[currentElderlyIndex] 
        : null;
      
      // 현재 어르신이 있으면 데이터도 새로고침
      if (targetElderly) {
        // Pull-to-Refresh 중에는 로딩 상태 표시 없이 백그라운드에서 업데이트
        // 이렇게 하면 RefreshControl의 로딩 인디케이터만 표시되고 데이터는 부드럽게 업데이트됨
        // 순차적으로 실행하여 데이터가 확실히 업데이트되도록 함
        // selectedDayTab을 명시적으로 전달하여 최신 값 사용
        await loadTodosForElderly(targetElderly.id, true, selectedDayTab); // skipLoadingState = true
        // 최근 다이어리 로딩
        await loadRecentDiaries(targetElderly.id);
      } else if (currentElderly) {
        // fallback: currentElderly가 있으면 사용
        // selectedDayTab을 명시적으로 전달하여 최신 값 사용
        await loadTodosForElderly(currentElderly.id, true, selectedDayTab);
        // 최근 다이어리 로딩
        await loadRecentDiaries(currentElderly.id);
      }
    } catch (error: any) {
      console.error('새로고침 실패:', error);
      show('오류', '데이터를 새로고침하는데 실패했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 화면 마운트 시 연결된 어르신 목록 로딩
  useEffect(() => {
    loadConnectedElderly();
  }, []);

  // 전체 할일 목록 불러오기 (통계 없을 때 구분용)
  const loadAllTodosForElderly = async (elderlyId: string) => {
    try {
      // 최근 3개월치 할일 조회 (과거/현재/미래 모두 포함)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      const endDate = new Date(today);
      endDate.setMonth(today.getMonth() + 3);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const todos = await todoApi.getTodosByRange(startDateStr, endDateStr, elderlyId);
      setAllTodos(todos);
    } catch (error: any) {
      console.error('❌ 전체 할일 조회 실패:', error);
      setAllTodos([]);
      // 전체 할일 조회는 통계용이므로 에러 알림은 생략 (너무 자주 발생할 수 있음)
    }
  };

  // 현재 어르신 변경 시 TODO 및 다이어리 다시 로딩
  useEffect(() => {
    if (currentElderly) {
      // selectedDayTab을 명시적으로 전달하여 최신 값 사용
      loadTodosForElderly(currentElderly.id, false, selectedDayTab);
      // 최근 다이어리 로딩
      loadRecentDiaries(currentElderly.id);
    }
  }, [currentElderly?.id, selectedDayTab]);

  // 화면 포커스 시 데이터 새로고침 (다른 화면 갔다가 돌아올 때만)
  useFocusEffect(
    useCallback(() => {
      // user가 없으면 데이터 로딩 안함 (로그아웃 시)
      if (!user) return;
      
      let isMounted = true;
      
      // 할일 등록 후 백엔드 처리 시간을 고려한 지연 새로고침
      const refreshData = async () => {
        if (!isMounted) return;
        
        await loadConnectedElderly();
        if (currentElderly && isMounted) {
          // 로딩 상태 표시 없이 백그라운드에서 데이터만 업데이트 (깜빡임 방지)
          // selectedDayTab을 명시적으로 전달하여 최신 값 사용
          await loadTodosForElderly(currentElderly.id, true, selectedDayTab);
          // 최근 다이어리 로딩
          await loadRecentDiaries(currentElderly.id);
        }
      };
      
      // 300ms 후 실행 (백엔드 처리 시간 확보, 너무 빠르면 깜빡임 발생)
      const refreshTimer = setTimeout(() => {
        if (isMounted) {
          refreshData();
        }
      }, 300);
      
      return () => {
        isMounted = false;
        clearTimeout(refreshTimer);
      };
    }, [user, currentElderly?.id, selectedDayTab]) // selectedDayTab도 의존성에 포함
  );

  // 날짜 포맷팅 유틸리티 함수들
  const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  
  // 날짜를 "X월 X일" 형식으로 변환
  const formatDateString = (date: Date): string => {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };
  
  // 날짜를 "X월 X일 요일" 형식으로 변환
  const formatDateWithDay = (date: Date): string => {
    const dateStr = formatDateString(date);
    const dayStr = DAY_NAMES[date.getDay()];
    return `${dateStr} ${dayStr}`;
  };
  
  // 내일 날짜를 "X월 X일 요일" 형식으로 변환
  const formatTomorrowDate = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateWithDay(tomorrow);
  };

  // getCategoryIcon, formatTime, getCategoryName 함수는 공통 유틸리티/상수 사용
  // formatTime → formatTimeAmPm로 대체

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
    if (!stats) return [];
    // 데이터가 없으면 조언 생성하지 않음
    if (stats.total === 0) return [];
    
    const recommendations = [];
    
    // 복약 관련 권장사항
    const medicineCategory = stats.by_category.find(cat => cat.category === 'MEDICINE');
    if (medicineCategory && medicineCategory.total > 0 && medicineCategory.completion_rate < 0.9) {
      recommendations.push('복약 알림을 더 자주 해주시면 어르신께서 잊지 않으실 것 같아요');
    }

    // 운동 관련 권장사항
    const exerciseCategory = stats.by_category.find(cat => cat.category === 'EXERCISE');
    if (exerciseCategory && exerciseCategory.total > 0 && exerciseCategory.completion_rate < 0.8) {
      recommendations.push('집에서 할 수 있는 간단한 스트레칭이나 산책을 함께 해보시는 건 어떨까요?');
    }

    // 식사 관련 권장사항
    const mealCategory = stats.by_category.find(cat => cat.category === 'MEAL');
    if (mealCategory && mealCategory.total > 0 && mealCategory.completion_rate < 0.9) {
      recommendations.push('규칙적인 식사 시간을 정해서 건강한 생활을 유지해보세요');
    }

    // 기본 권장사항 (모든 상태가 좋을 때, 데이터가 있을 때만)
    if (recommendations.length === 0 && stats.total > 0) {
      recommendations.push('현재 상태를 잘 유지하고 계세요!');
      recommendations.push('새로운 취미나 독서 같은 활동을 추가해보시면 더욱 즐거울 것 같아요');
    }

    return recommendations;
  };

  // 카테고리 옵션 (공통 상수 사용)
  const categories = TODO_CATEGORIES;

  // 시간 옵션
  const timeOptions = [
    '오전 6시', '오전 7시', '오전 8시', '오전 9시', '오전 10시',
    '오전 11시', '오후 12시', '오후 1시', '오후 2시', '오후 3시',
    '오후 4시', '오후 5시', '오후 6시', '오후 7시', '오후 8시',
    '오후 9시', '오후 10시'
  ];

  // formatTimeToDisplay, parseDisplayTimeToApi 함수는 공통 유틸리티 사용

  // 반복 옵션
  const recurringOptions = [
    { id: 'daily', name: '매일' },
    { id: 'weekly', name: '매주' },
    { id: 'monthly', name: '매월' },
  ];

  // formatDateForDisplay 함수는 공통 유틸리티 사용

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

    if (!editedTodo.timeValue) {
      show('알림', '시간을 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 시간은 이미 "HH:MM" 형식으로 저장되어 있음
      const formattedTime = editedTodo.timeValue || '12:00';

      // 반복 설정에 따른 추가 데이터 처리
      const selectedDate = new Date(editedTodo.date);
      const selectedDayOfMonth = selectedDate.getDate(); // 1~31
      const selectedWeekday = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1; // 월요일=0, 일요일=6
      
      const updateData: todoApi.TodoUpdateRequest = {
        title: editedTodo.title,
        description: editedTodo.description || undefined,
        category: editedTodo.category.toUpperCase() as any,
        due_date: editedTodo.date,
        due_time: formattedTime,
        is_recurring: editedTodo.isRecurring,
        recurring_type: editedTodo.isRecurring ? editedTodo.recurringType.toUpperCase() as any : undefined,
        recurring_days: editedTodo.isRecurring && editedTodo.recurringType === 'weekly' 
          ? (editedTodo.recurringDays.length > 0 ? editedTodo.recurringDays : [selectedWeekday])
          : undefined,
        recurring_day_of_month: editedTodo.isRecurring && editedTodo.recurringType === 'monthly'
          ? selectedDayOfMonth
          : undefined,
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
              await loadTodosForElderly(currentElderly.id, false, selectedDayTab);
              await refreshStats(currentElderly.id, false);
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
                  await loadTodosForElderly(currentElderly.id, false, selectedDayTab);
                  if (selectedPeriod === 'month') {
                    await loadMonthlyStatsForElderly(currentElderly.id);
                  } else if (selectedPeriod === 'last_month') {
                    await loadLastMonthStatsForElderly(currentElderly.id);
                  }
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
                  await loadTodosForElderly(currentElderly.id, false, selectedDayTab);
                  if (selectedPeriod === 'month') {
                    await loadMonthlyStatsForElderly(currentElderly.id);
                  } else if (selectedPeriod === 'last_month') {
                    await loadLastMonthStatsForElderly(currentElderly.id);
                  }
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
                  await loadTodosForElderly(currentElderly.id, false, selectedDayTab);
                  if (selectedPeriod === 'month') {
                    await loadMonthlyStatsForElderly(currentElderly.id);
                  } else if (selectedPeriod === 'last_month') {
                    await loadLastMonthStatsForElderly(currentElderly.id);
                  }
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


  // 빠른 액션 버튼 설정 (보호자용)
  const quickActions: QuickAction[] = currentElderly ? [
    {
      id: 'todos',
      label: '일정 관리',
      icon: <CheckIcon size={24} color="#34B79F" />,
      onPress: () => router.push('/calendar'), // 캘린더에서 전체 일정 조회 및 추가/수정/삭제
    },
    {
      id: 'stats',
      label: '통계',
      icon: 'stats-chart-outline',
      onPress: () => {
        if (currentElderly) {
          router.push(`/guardian-statistics?elderlyId=${currentElderly.id}&elderlyName=${encodeURIComponent(currentElderly.name)}`);
        }
      },
    },
    {
      id: 'ai-call',
      label: 'AI 통화 설정',
      icon: <PhoneIcon size={24} color="#34B79F" />,
      onPress: () => {
        // TODO: AI 통화 설정 화면으로 이동
        show('준비중', 'AI 통화 설정 기능은 개발 중입니다.');
      },
    },
    {
      id: 'diaries',
      label: '일기장',
      icon: <DiaryIcon size={24} color="#34B79F" />,
      onPress: () => router.push('/diaries'), // 어르신 일기 조회 및 인사이트
    },
  ] : [];

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="그랜비"
        showMenuButton={true} 
      />

      {/* 메인 컨텐츠 */}
      <ScrollView 
        ref={scrollViewRef}
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
        {/* 보호자용 공유 필터 */}

        {/* 어르신 카드 섹션 */}
        {renderFamilyTab()}

        {/* 소통 섹션 */}
        {currentElderly && (
          <View style={styles.communicationSectionContainer}>
            {renderCommunicationTab()}
          </View>
        )}

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
          setShowDatePickerModal(false);
          setShowRecurringModal(false);
          setShowWeeklyDaysModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            {/* 모달 헤더 */}
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>
                할 일 수정
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedTodo(null);
                  setIsEditMode(false);
                  setShowCategoryPicker(false);
                  setShowDatePickerModal(false);
                  setShowRecurringModal(false);
                  setShowWeeklyDaysModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
          </View>

            {/* TODO 정보 - 수정 폼 (GuardianTodoAddScreen과 동일한 UI) */}
            {selectedTodo && (
              <ScrollView style={styles.editModalBody} showsVerticalScrollIndicator={false}>
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

                    {/* 카테고리 선택 - 그리드 형식 */}
                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>카테고리 *</Text>
                      <CategorySelector
                        selectedCategory={editedTodo.category}
                        onSelect={(categoryId) => setEditedTodo({ ...editedTodo, category: categoryId })}
                      />
                    </View>

                    {/* 날짜 선택 */}
                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>날짜</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowDatePickerModal(true)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.dateButtonContent}>
                          <Ionicons name="calendar-outline" size={20} color="#34B79F" />
                          <Text style={styles.dateButtonText}>
                            {formatDateForDisplay(editedTodo.date)}
                          </Text>
                        </View>
                        <Text style={styles.dropdownIcon}>▼</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 시간 선택 */}
                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>시간 *</Text>
                      <View style={styles.timePickerContainer}>
                        <TimePicker
                          value={editedTodo.timeValue}
                          compact={true}
                          onChange={(time: string) => {
                            // "HH:MM" 형식에서 "오전/오후 X시" 형식으로 변환
                            const [hours, minutes] = time.split(':');
                            const hour = parseInt(hours);
                            const isPM = hour >= 12;
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                            const timeDisplay = `${isPM ? '오후' : '오전'} ${displayHour}시`;
                            
                            setEditedTodo({
                              ...editedTodo,
                              time: timeDisplay,
                              timeValue: time,
                            });
                          }}
                        />
                      </View>
                    </View>

                    {/* 등록자 정보 */}
                    {selectedTodo && (
                      <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>등록자</Text>
                        <Text style={styles.todoDetailValue}>
                          {selectedTodo.creator_type === 'elderly' ? '어르신이 등록' : 
                           selectedTodo.creator_type === 'ai' ? 'AI가 추출' : 
                           '보호자가 등록'}
                        </Text>
                      </View>
                    )}

                    {/* 반복 설정 */}
                    <View style={styles.inputSection}>
                      <View style={styles.toggleSection}>
                        <Text style={styles.inputLabel}>반복 설정</Text>
                        <TouchableOpacity
                          style={[styles.toggleButton, editedTodo.isRecurring && styles.toggleButtonActive]}
                          onPress={() => setEditedTodo({ ...editedTodo, isRecurring: !editedTodo.isRecurring })}
                        >
                          <Text style={[
                            styles.toggleButtonText,
                            editedTodo.isRecurring && styles.toggleButtonTextActive
                          ]}>
                            {editedTodo.isRecurring ? 'ON' : 'OFF'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      {editedTodo.isRecurring && (
                        <>
                          <TouchableOpacity
                            style={styles.recurringButton}
                            onPress={() => setShowRecurringModal(true)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.recurringButtonText}>
                              {recurringOptions.find(opt => opt.id === editedTodo.recurringType)?.name || '반복 주기 선택'}
                            </Text>
                            <Text style={styles.dropdownIcon}>▼</Text>
                          </TouchableOpacity>
                          
                          {editedTodo.recurringType === 'weekly' && (
                            <TouchableOpacity
                              style={styles.recurringButton}
                              onPress={() => setShowWeeklyDaysModal(true)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.recurringButtonText}>
                                {editedTodo.recurringDays.length > 0 
                                  ? `${editedTodo.recurringDays.length}개 요일 선택됨`
                                  : '반복 요일 선택'}
                              </Text>
                              <Text style={styles.dropdownIcon}>▼</Text>
                            </TouchableOpacity>
                          )}
                          
                          <View style={styles.recurringInfo}>
                            <View style={styles.recurringInfoContent}>
                              <Ionicons name="repeat-outline" size={16} color="#34B79F" />
                              <Text style={styles.recurringInfoText}>
                                {editedTodo.recurringType === 'daily' && '매일 반복됩니다'}
                                {editedTodo.recurringType === 'weekly' && '선택한 요일마다 반복됩니다'}
                                {editedTodo.recurringType === 'monthly' && '선택한 날짜의 날짜마다 반복됩니다'}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </View>
              </ScrollView>
            )}

            {/* 모달 액션 버튼 */}
            <View style={[styles.editModalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => {
                  setIsEditMode(false);
                  setShowCategoryPicker(false);
                  setShowDatePickerModal(false);
                  setShowRecurringModal(false);
                  setShowWeeklyDaysModal(false);
                  setShowEditModal(false);
                  setSelectedTodo(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>

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

              <TouchableOpacity
                style={[styles.modalActionButton, styles.saveButton]}
                onPress={handleSaveEdit}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>수정 완료</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* 반복 주기 선택 모달 */}
      <Modal
        visible={showRecurringModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecurringModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>반복 주기 선택</Text>
              <TouchableOpacity 
                onPress={() => setShowRecurringModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {recurringOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.recurringOption,
                    editedTodo.recurringType === option.id && styles.recurringOptionSelected,
                    index === recurringOptions.length - 1 && styles.recurringOptionLast
                  ]}
                  onPress={() => {
                    setEditedTodo({ ...editedTodo, recurringType: option.id as 'daily' | 'weekly' | 'monthly' });
                    setShowRecurringModal(false);
                  }}
                >
                  <Text style={[
                    styles.recurringOptionText,
                    editedTodo.recurringType === option.id && styles.recurringOptionTextSelected
                  ]}>
                    {option.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 날짜 선택 모달 */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>날짜 선택</Text>
              <TouchableOpacity 
                onPress={() => setShowDatePickerModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.calendarContainer}>
              <Calendar
                onDayPress={(day) => {
                  setEditedTodo({ ...editedTodo, date: day.dateString });
                  setShowDatePickerModal(false);
                }}
                markedDates={{
                  [editedTodo.date]: { 
                    selected: true, 
                    selectedColor: '#34B79F',
                    selectedTextColor: '#FFFFFF'
                  }
                }}
                monthFormat={'yyyy년 M월'}
                current={editedTodo.date}
                minDate={new Date().toISOString().split('T')[0]}
                theme={{
                  calendarBackground: '#FFFFFF',
                  textSectionTitleColor: '#666666',
                  selectedDayBackgroundColor: '#34B79F',
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: '#34B79F',
                  dayTextColor: '#333333',
                  textDisabledColor: '#CCCCCC',
                  dotColor: '#34B79F',
                  selectedDotColor: '#FFFFFF',
                  arrowColor: '#34B79F',
                  monthTextColor: '#333333',
                  textDayFontWeight: '500',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 12,
                }}
                enableSwipeMonths={true}
              />
              
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setEditedTodo({ ...editedTodo, date: today });
                  setShowDatePickerModal(false);
                }}
              >
                <Ionicons name="today-outline" size={18} color="#34B79F" />
                <Text style={styles.todayButtonText}>오늘</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 주간 반복 요일 선택 모달 */}
      <Modal
        visible={showWeeklyDaysModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeeklyDaysModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>반복 요일 선택</Text>
              <TouchableOpacity 
                onPress={() => setShowWeeklyDaysModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {['월', '화', '수', '목', '금', '토', '일'].map((dayName, index) => {
                const isSelected = editedTodo.recurringDays.includes(index);
                const isLast = index === ['월', '화', '수', '목', '금', '토', '일'].length - 1;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.weeklyDayOption,
                      isSelected && styles.weeklyDayOptionSelected,
                      isLast && styles.weeklyDayOptionLast
                    ]}
                    onPress={() => {
                      const updatedDays = isSelected
                        ? editedTodo.recurringDays.filter(d => d !== index)
                        : [...editedTodo.recurringDays, index];
                      setEditedTodo({ ...editedTodo, recurringDays: updatedDays });
                    }}
                  >
                    <Text style={[
                      styles.weeklyDayOptionText,
                      isSelected && styles.weeklyDayOptionTextSelected
                    ]}>
                      {dayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalFooterButton}
                onPress={() => setShowWeeklyDaysModal(false)}
              >
                <Text style={styles.modalFooterButtonText}>완료</Text>
              </TouchableOpacity>
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
  
  // 빠른 액션 버튼 컨테이너
  quickActionsContainer: {
    marginBottom: 20,
  },

  // 섹션 스타일
  statsSection: {
    marginBottom: 20,
  },
  healthSectionContainer: {
    marginBottom: 20,
  },
  communicationSectionContainer: {
    marginBottom: 20,
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
  healthCardCompletionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'flex-end',
  },
  healthCardCompletionRate: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  healthCardCompletionLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
  healthCardTodaySection: {
    marginBottom: 12,
  },
  healthCardSectionLabel: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  healthCardTodayBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  healthCardTodayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  healthCardTodaySubText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
  healthCardStatsSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  healthCardStatsLabel: {
    fontSize: 11,
    color: '#999999',
    marginTop: 6,
    fontWeight: '500',
  },
  healthCardProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  healthCardProgressBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  healthCardProgressBar: {
    height: '100%',
    borderRadius: 5,
  },
  healthCardProgressText: {
    fontSize: 12,
    color: '#999999',
    minWidth: 60,
    textAlign: 'right',
    fontWeight: '600',
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
  viewAllCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
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
    justifyContent: 'flex-start',
    marginBottom: 8,
    width: '100%',
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  dayTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 0,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0, // flex 아이템이 컨텐츠보다 작아질 수 있도록
    overflow: 'hidden', // 텍스트 오버플로우 방지
  },
  dayTabActive: {
    backgroundColor: '#34B79F',
  },
  dayTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
    textAlign: 'center',
    flexShrink: 1, // 텍스트가 컨테이너보다 크면 축소
    overflow: 'hidden',
  },
  dayTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dateTextBelow: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'left',
  },
  // 보호자용 공유 필터
  sharedFilterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  sharedFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sharedFilterButtonActive: {
    backgroundColor: '#34B79F',
    borderColor: '#34B79F',
  },
  sharedFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  sharedFilterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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

  // 어르신 화면 스타일 (scheduleCard)
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
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
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
    color: '#333333',
  },
  scheduleContent: {
    flex: 1,
    marginRight: 12,
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
    marginBottom: 4,
  },
  scheduleDate: {
    fontSize: 12,
    color: '#999999',
  },
  scheduleStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E0F7F4',
  },
  scheduleStatusText: {
    fontSize: 12,
    color: '#34B79F',
    fontWeight: '500',
  },
  // 완료된 항목 스타일
  scheduleItemCompleted: {
    opacity: 0.6,
  },
  scheduleTimeTextCompleted: {
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  scheduleTitleCompleted: {
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  scheduleLocationCompleted: {
    color: '#CCCCCC',
  },
  scheduleDateCompleted: {
    color: '#CCCCCC',
  },
  scheduleStatusCompleted: {
    backgroundColor: '#E8E8E8',
  },
  scheduleStatusTextCompleted: {
    color: '#666666',
  },
  // 전체보기 버튼
  expandButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
  },
  expandButtonText: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '600',
  },
  // 카테고리 그리드 (GuardianTodoAddScreen 스타일)
  categoryGridInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  categoryCardInline: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardInlineSelected: {
    borderColor: '#34B79F',
    backgroundColor: '#F0FDFA',
    shadowColor: '#34B79F',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryCardIconContainerInline: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryCardTextInline: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryCardTextInlineSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
  // 날짜/시간 버튼 (GuardianTodoAddScreen 스타일)
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    marginLeft: 12,
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  timeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#999999',
  },
  timePickerContainer: {
    marginTop: 8,
  },
  // 토글 버튼
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#34B79F',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  // 반복 설정
  recurringButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  recurringButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  recurringInfo: {
    backgroundColor: '#E6F7F4',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  recurringInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recurringInfoText: {
    fontSize: 13,
    color: '#34B79F',
    lineHeight: 18,
  },
  // 모달 스타일 (GuardianTodoAddScreen과 동일)
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#999999',
    fontWeight: 'normal',
    lineHeight: 24,
  },
  modalBody: {
    maxHeight: 300,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '70%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  calendarContainer: {
    padding: 20,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    gap: 8,
  },
  todayButtonText: {
    fontSize: 16,
    color: '#34B79F',
    fontWeight: '600',
  },
  timeOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeOptionSelected: {
    backgroundColor: '#E6F7F4',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
  recurringOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recurringOptionSelected: {
    backgroundColor: '#E6F7F4',
  },
  recurringOptionLast: {
    borderBottomWidth: 0,
  },
  recurringOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  recurringOptionTextSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
  weeklyDayOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  weeklyDayOptionSelected: {
    backgroundColor: '#E6F7F4',
  },
  weeklyDayOptionLast: {
    borderBottomWidth: 0,
  },
  weeklyDayOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  weeklyDayOptionTextSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  modalFooterButton: {
    backgroundColor: '#34B79F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  emptyStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStatsImage: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  emptyStatsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStatsSubText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  addTodoButton: {
    backgroundColor: '#34B79F',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  addTodoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
