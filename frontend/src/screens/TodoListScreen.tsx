/**
 * 어르신 할일 목록 화면 - 리디자인 버전
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header, BottomNavigationBar } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryIcon, getCategoryColor } from '../constants/TodoCategories';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import * as todoApi from '../api/todo';
import { TokenManager } from '../api/client';
import { useFontSizeStore } from '../store/fontSizeStore';
import { useAlert } from '../components/GlobalAlertProvider';
import { useAuthStore } from '../store/authStore';

interface TodoItem {
  id: string;
  title: string;
  description: string;
  rawDescription: string | null;
  time: string;
  rawDueTime: string | null;
  dueDate: string;
  isCompleted: boolean;
  priority: 'high' | 'medium' | 'low';
  category: 'medicine' | 'hospital' | 'daily' | 'other' | 'exercise' | 'meal';
  rawCategory: todoApi.TodoItem['category'];
  status: todoApi.TodoItem['status'];
  creatorType: todoApi.TodoItem['creator_type'];
  creatorId: string;
  creatorName: string | null;
  isSharedWithCaregiver: boolean;
  isRecurring: boolean;
  recurringType: todoApi.TodoItem['recurring_type'];
  recurringInterval: number | null;
  recurringDays: number[] | null;
  recurringDayOfMonth: number | null;
  recurringEndDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type DateFilter = 'yesterday' | 'today' | 'tomorrow';

export const TodoListScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontSizeLevel } = useFontSizeStore();
  const { show } = useAlert();
  const { user } = useAuthStore();
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [completedTodoTitle, setCompletedTodoTitle] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [expandAnim] = useState(new Animated.Value(0));
  const [selectedDate, setSelectedDate] = useState<DateFilter>('today');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // TODO 목록 불러오기
  const loadTodos = async () => {
    try {
      setIsRefreshing(true);
      
      // 디버깅: 토큰 확인
      // const { TokenManager } = await import('../api/client');
      const tokens = await TokenManager.getTokens();
      console.log('🔑 토큰 상태:', tokens ? '있음' : '없음');
      
      const apiTodos = await todoApi.getTodos(selectedDate);
      
      // API 데이터를 화면 형식에 맞게 변환
      const mappedTodos: TodoItem[] = apiTodos.map(todo => ({
        id: todo.todo_id,
        title: todo.title,
        description: todo.description || '',
        rawDescription: todo.description,
        time: todo.due_time ? formatTime(todo.due_time) : '시간 미정',
        rawDueTime: todo.due_time,
        dueDate: todo.due_date,
        isCompleted: todo.status === 'completed',
        priority: getPriority(todo.category),
        category: mapCategory(todo.category),
        rawCategory: todo.category,
        status: todo.status,
        creatorType: todo.creator_type,
        creatorId: todo.creator_id,
        creatorName: (todo as any).creator_name ?? null,
        isSharedWithCaregiver: todo.is_shared_with_caregiver,
        isRecurring: todo.is_recurring,
        recurringType: todo.recurring_type,
        recurringInterval: todo.recurring_interval,
        recurringDays: todo.recurring_days,
        recurringDayOfMonth: todo.recurring_day_of_month,
        recurringEndDate: todo.recurring_end_date,
        completedAt: todo.completed_at,
        createdAt: todo.created_at,
        updatedAt: todo.updated_at,
      }));
      
      setTodos(mappedTodos);
    } catch (error: any) {
      console.error('TODO 목록 불러오기 실패:', error);
      show('오류', '할 일 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 시간 포맷 변환 (HH:MM -> 오전/오후 H시)
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours % 12 || 12;
    return `${period} ${displayHours}시${minutes > 0 ? ` ${minutes}분` : ''}`;
  };

  // 카테고리 우선순위 매핑
  const getPriority = (category: string | null): 'high' | 'medium' | 'low' => {
    if (category === 'medicine' || category === 'hospital') return 'high';
    if (category === 'exercise' || category === 'meal') return 'medium';
    return 'low';
  };

  // 카테고리 매핑
  const mapCategory = (category: string | null): 'medicine' | 'hospital' | 'daily' | 'other' | 'exercise' | 'meal' => {
    if (!category) return 'other';
    if (category === 'medicine') return 'medicine';
    if (category === 'hospital') return 'hospital';
    if (category === 'exercise') return 'exercise';
    if (category === 'meal') return 'meal';
    return 'daily';
  };

  // 날짜 변경 시 TODO 목록 다시 불러오기
  useEffect(() => {
    loadTodos();
  }, [selectedDate]);

  // 초기 로딩
  useEffect(() => {
    loadTodos();
  }, []);

  const handleCompletePress = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    try {
      if (todo.isCompleted) {
        // 완료된 할일을 누르면 미완료로 변경 (완료 취소)
        await todoApi.cancelTodo(id);
        
        // 로컬 상태 업데이트
        setTodos(prevTodos =>
          prevTodos.map(t => 
            t.id === id ? { ...t, isCompleted: false } : t
          )
        );
      } else {
        // 미완료 할일을 누르면 완료 처리
        await todoApi.completeTodo(id);
        
        // 로컬 상태 업데이트
        setTodos(prevTodos =>
          prevTodos.map(t => 
            t.id === id ? { ...t, isCompleted: true } : t
          )
        );
        
        // 성공 애니메이션 표시
        setCompletedTodoTitle(todo.title);
        setShowSuccessAnimation(true);
        
        // Fade in 애니메이션
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();

        // 2.5초 후 fade out 애니메이션
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            setShowSuccessAnimation(false);
          });
        }, 2000);
      }
    } catch (error: any) {
      console.error('TODO 상태 변경 실패:', error);
      show('오류', '할 일 상태를 변경하지 못했습니다.');
    }
  };

  // 카테고리별 아이콘 컴포넌트
  const CategoryIcon = ({ category, size = 24 }: { category: string; size?: number }) => {
    const containerSize = size;
    const iconName = getCategoryIcon(category?.toUpperCase() || null);
    const iconColor = getCategoryColor(category?.toUpperCase() || null);
    const backgroundColor = `${iconColor}1A`; // 10% alpha

    return (
      <View
        style={{
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={iconName as any} size={size * 0.6} color={iconColor} />
      </View>
    );
  };

  const formatRecurringInfo = (todo: TodoItem) => {
    if (!todo.isRecurring) {
      return '';
    }

    if (todo.recurringType === 'DAILY') {
      return '매일';
    }

    if (todo.recurringType === 'WEEKLY' && todo.recurringDays?.length) {
      const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
      const days = todo.recurringDays
        .map(day => dayMap[day] ?? '')
        .filter(Boolean)
        .join(', ');
      return days ? `매주 ${days}` : '매주';
    }

    if (todo.recurringType === 'MONTHLY' && todo.recurringDayOfMonth) {
      return `매월 ${todo.recurringDayOfMonth}일`;
    }

    return '';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#FF6B6B';
      case 'medium':
        return '#4ECDC4';
      case 'low':
        return '#95E1D3';
      default:
        return '#95E1D3';
    }
  };

  const completedTodos = todos.filter(todo => todo.isCompleted);
  const pendingTodos = todos.filter(todo => !todo.isCompleted);

  // 성공 애니메이션 컴포넌트 - 시니어 친화적 버전
  const SuccessAnimation = () => {
    if (!showSuccessAnimation) return null;

    return (
      <Animated.View style={[styles.successOverlay, { opacity: fadeAnim }]}>
        <View style={styles.successCard}>
          {/* 민트 컬러 체크 아이콘 */}
          <View style={styles.checkContainer}>
            <View style={styles.checkCircle}>
              <View style={styles.checkIcon} />
            </View>
          </View>
          
          {/* 친근한 메시지 */}
          <View style={styles.messageContainer}>
            <Text style={[styles.successTitle, fontSizeLevel >= 1 && { fontSize: 24 }, fontSizeLevel >= 2 && { fontSize: 28 }]}>완료했어요!</Text>
          <Text style={[styles.successMessage, fontSizeLevel >= 1 && { fontSize: 20 }, fontSizeLevel >= 2 && { fontSize: 24 }]}>
            "{completedTodoTitle}"
          </Text>
            <Text style={[styles.successSubtitle, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 20 }]}>
              오늘 {completedTodos.length}개 완료
          </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const handleCardPress = (todoId: string) => {
    const isCurrentlyExpanded = expandedTodoId === todoId;
    
    if (isCurrentlyExpanded) {
      // 닫기 애니메이션
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setExpandedTodoId(null);
      });
    } else {
      // 열기
      setExpandedTodoId(todoId);
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleAddTodo = () => {
    router.push('/todo-write');
  };

  const TodoCard = ({ todo }: { todo: TodoItem }) => {
    const { fontSizeLevel } = useFontSizeStore();
    const isExpanded = expandedTodoId === todo.id;
    const categorySource = todo.rawCategory || todo.category;
    const categoryKey = categorySource ? categorySource.toUpperCase() : null;
    const recurringLabel = formatRecurringInfo(todo);
    const creatorLabel = (() => {
      if (todo.creatorId === user?.user_id) {
        return '나';
      }

      if (todo.creatorName) {
        return todo.creatorName;
      }

      if (todo.creatorType === 'elderly') {
        return user?.name || '어르신';
      }

      if (todo.creatorType === 'caregiver') {
        return '보호자';
      }

      return 'AI';
    })();
    
    return (
      <TouchableOpacity
        style={[
        styles.todoCard,
        todo.isCompleted && styles.completedCard,
        ]}
          onPress={() => handleCardPress(todo.id)}
        activeOpacity={0.95}
        >
        <View style={styles.cardContent}>
          <View style={styles.todoLeft}>
            <View style={styles.categoryIconWrapper}>
              <CategoryIcon category={categoryKey || categorySource} size={44} />
            </View>
            <View style={styles.todoInfo}>
              <View style={styles.todoTitleRow}>
                <Text
                  style={[
                    styles.todoTitle,
                    todo.isCompleted && styles.completedText,
                    fontSizeLevel >= 1 && { fontSize: 20 },
                    fontSizeLevel >= 2 && { fontSize: 24 },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {todo.title}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.timeContainer,
                    todo.isCompleted && styles.completedTimeContainer,
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={todo.isCompleted ? '#999999' : Colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.todoTime,
                      todo.isCompleted && styles.completedText,
                      fontSizeLevel >= 1 && { fontSize: 16 },
                      fontSizeLevel >= 2 && { fontSize: 18 },
                    ]}
                  >
                    {todo.time}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.completeButtonContainer}
            onPress={(e) => {
              e.stopPropagation();
              handleCompletePress(todo.id);
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.completeButton,
                todo.isCompleted && styles.completedButton,
              ]}
            >
              {todo.isCompleted ? (
                <Text
                  style={[
                    styles.completedButtonText,
                    fontSizeLevel >= 1 && { fontSize: 16 },
                    fontSizeLevel >= 2 && { fontSize: 18 },
                  ]}
                >
                  취소
                </Text>
              ) : (
                <Text
                  style={[
                    styles.completeButtonText,
                    fontSizeLevel >= 1 && { fontSize: 16 },
                    fontSizeLevel >= 2 && { fontSize: 18 },
                  ]}
                >
                  완료
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* 확장된 내용 - 부드러운 opacity 애니메이션 */}
        {isExpanded && (
          <Animated.View style={[
            styles.expandedContent,
            {
              opacity: expandAnim,
            }
          ]}>
            <View style={styles.detailDivider} />
            <Text style={[styles.expandedLabel, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 20 }]}>상세 정보</Text>
            <View style={styles.detailInfoBox}>
              <View style={styles.detailInfoItem}>
                <View style={[styles.detailInfoIconCircle, { backgroundColor: 'rgba(74, 85, 104, 0.12)' }]}>
                  <Ionicons name="person-circle" size={18} color="#4A5568" />
                </View>
                <View style={styles.detailInfoText}>
                  <Text style={[styles.detailInfoLabel, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>
                    등록자
                  </Text>
                  <Text style={[styles.detailInfoValue, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>
                    {creatorLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.detailInfoItem}>
                <View
                  style={[
                    styles.detailInfoIconCircle,
                    {
                      backgroundColor: todo.isSharedWithCaregiver
                        ? 'rgba(52, 183, 159, 0.14)'
                        : 'rgba(153, 153, 153, 0.14)',
                    },
                  ]}
                >
                  <Ionicons
                    name={todo.isSharedWithCaregiver ? 'people' : 'lock-closed'}
                    size={16}
                    color={todo.isSharedWithCaregiver ? Colors.primary : '#999999'}
                  />
                </View>
                <View style={styles.detailInfoText}>
                  <Text style={[styles.detailInfoLabel, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>
                    공유 상태
                  </Text>
                  <Text
                    style={[
                      styles.detailInfoValue,
                      todo.isSharedWithCaregiver
                        ? styles.detailInfoValuePositive
                        : styles.detailInfoValueNeutral,
                      fontSizeLevel >= 1 && { fontSize: 16 },
                      fontSizeLevel >= 2 && { fontSize: 18 },
                    ]}
                  >
                    {todo.isSharedWithCaregiver ? '보호자와 공유 중' : '비공유'}
                  </Text>
                </View>
              </View>

              {recurringLabel ? (
                <View style={[styles.detailInfoItem, styles.detailInfoItemLast]}>
                  <View style={[styles.detailInfoIconCircle, { backgroundColor: 'rgba(74, 85, 104, 0.12)' }]}
                  >
                    <Ionicons name="refresh" size={16} color="#4A5568" />
                  </View>
                  <View style={styles.detailInfoText}>
                    <Text style={[styles.detailInfoLabel, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>
                      반복 일정
                    </Text>
                    <Text
                      style={[
                        styles.detailInfoValueMultiline,
                        fontSizeLevel >= 1 && { fontSize: 16 },
                        fontSizeLevel >= 2 && { fontSize: 18 },
                      ]}
                      numberOfLines={2}
                    >
                      {recurringLabel}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </Animated.View>
        )}
        </TouchableOpacity>
    );
  };

  // 날짜 정보 계산
  const getDateInfo = (dateType: DateFilter) => {
    const today = new Date();
    let targetDate: Date;
    
    switch (dateType) {
      case 'yesterday':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() - 1);
        break;
      case 'tomorrow':
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 1);
        break;
      default:
        targetDate = today;
    }
    
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const month = targetDate.getMonth() + 1;
    const date = targetDate.getDate();
    const day = days[targetDate.getDay()];
    
    return {
      dateString: `${month}월 ${date}일`,
      dayString: `${day}요일`,
      fullDate: targetDate,
    };
  };

  const dateInfo = getDateInfo(selectedDate);

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="할 일" 
        showMenuButton={true}
      />

      {/* 날짜 탭 네비게이션 */}
      <View style={styles.dateTabContainer}>
        <TouchableOpacity 
          style={[styles.dateTab, selectedDate === 'yesterday' && styles.dateTabActive]}
          onPress={() => setSelectedDate('yesterday')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateTabText, selectedDate === 'yesterday' && styles.dateTabTextActive, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 20 }]}>
            어제
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.dateTab, selectedDate === 'today' && styles.dateTabActive]}
          onPress={() => setSelectedDate('today')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateTabText, selectedDate === 'today' && styles.dateTabTextActive, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 20 }]}>
            오늘
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.dateTab, selectedDate === 'tomorrow' && styles.dateTabActive]}
          onPress={() => setSelectedDate('tomorrow')}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateTabText, selectedDate === 'tomorrow' && styles.dateTabTextActive, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 20 }]}>
            내일
          </Text>
        </TouchableOpacity>
      </View>

      {/* 선택된 날짜 정보 */}
      <View style={styles.dateInfoCard}>
        <Text style={[styles.dateInfoText, fontSizeLevel >= 1 && { fontSize: 22 }, fontSizeLevel >= 2 && { fontSize: 26 }]}>
          {dateInfo.dateString}
        </Text>
        <Text style={[styles.dateInfoDay, fontSizeLevel >= 1 && { fontSize: 20 }, fontSizeLevel >= 2 && { fontSize: 24 }]}>
          {dateInfo.dayString}
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadTodos}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* 로딩 상태 */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.loadingText, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 20 }]}>할 일을 불러오는 중...</Text>
          </View>
        ) : (
          <>
        {/* 오늘의 할일 요약 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.calendarIconContainer}>
              <View style={styles.calendarIcon}>
                <View style={styles.calendarTop} />
                <View style={styles.calendarBody} />
              </View>
            </View>
            <Text style={[styles.summaryTitle, fontSizeLevel >= 1 && { fontSize: 20 }, fontSizeLevel >= 2 && { fontSize: 24 }]}>오늘의 할일</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, fontSizeLevel >= 1 && { fontSize: 28 }, fontSizeLevel >= 2 && { fontSize: 32 }]}>{pendingTodos.length}</Text>
              <Text style={[styles.statLabel, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>남은 일</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, fontSizeLevel >= 1 && { fontSize: 28 }, fontSizeLevel >= 2 && { fontSize: 32 }]}>{completedTodos.length}</Text>
              <Text style={[styles.statLabel, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>완료</Text>
            </View>
          </View>
        </View>

        {/* 완료되지 않은 할일 */}
        {pendingTodos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, fontSizeLevel >= 1 && { fontSize: 20 }, fontSizeLevel >= 2 && { fontSize: 24 }]}>해야 할 일</Text>
              <View style={styles.sectionBadge}>
                <Text style={[styles.sectionBadgeText, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>{pendingTodos.length}</Text>
              </View>
            </View>
            <View style={styles.cardsContainer}>
              {pendingTodos.map((todo, index) => (
                <View key={todo.id} style={index === pendingTodos.length - 1 ? { marginBottom: 0 } : {}}>
                  <TodoCard todo={todo} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 완료된 할일 */}
        {completedTodos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, fontSizeLevel >= 1 && { fontSize: 20 }, fontSizeLevel >= 2 && { fontSize: 24 }]}>완료된 일</Text>
              <View style={styles.sectionBadge}>
                <Text style={[styles.sectionBadgeText, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>{completedTodos.length}</Text>
              </View>
            </View>
            <View style={styles.cardsContainer}>
              {completedTodos.map((todo, index) => (
                <View key={todo.id} style={index === completedTodos.length - 1 ? { marginBottom: 0 } : {}}>
                  <TodoCard todo={todo} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 할일이 없는 경우 */}
        {todos.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.checkmarkIcon}>
                <View style={styles.checkmarkLine1} />
                <View style={styles.checkmarkLine2} />
              </View>
            </View>
            <Text style={[styles.emptyTitle, fontSizeLevel >= 1 && { fontSize: 20 }, fontSizeLevel >= 2 && { fontSize: 24 }]}>오늘 할일이 없습니다</Text>
            <Text style={[styles.emptyDescription, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}>
              보호자가 설정한 할일이 여기에 표시됩니다
            </Text>
          </View>
        )}

        {/* 하단 여백 (네비게이션 바 공간 확보) */}
        <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />

      {/* 성공 애니메이션 */}
      <SuccessAnimation />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // 날짜 탭 네비게이션
  dateTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  dateTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTabActive: {
    backgroundColor: Colors.primary,
  },
  dateTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  dateTabTextActive: {
    color: '#FFFFFF',
  },
  
  // 날짜 정보 카드
  dateInfoCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dateInfoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
  },
  dateInfoDay: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.primary,
  },
  
  // 로딩 상태
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  
  // 새로운 아이콘 스타일들
  categoryIconWrapper: {
    width: 48,
    height: 48,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIconContainer: {
    marginRight: 12,
  },
  calendarIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarTop: {
    width: 20,
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginBottom: 2,
  },
  calendarBody: {
    width: 18,
    height: 14,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmarkIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkLine1: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: 'white',
    transform: [{ rotate: '45deg' }],
    left: 8,
    top: 16,
  },
  checkmarkLine2: {
    position: 'absolute',
    width: 16,
    height: 2,
    backgroundColor: 'white',
    transform: [{ rotate: '-45deg' }],
    left: 12,
    top: 14,
  },

  summaryCard: {
    margin: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#40B59F',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  sectionBadge: {
    backgroundColor: '#40B59F',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  sectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardsContainer: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
  },
  todoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  completedCard: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E0E0E0',
    opacity: 0.85,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  todoInfo: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    justifyContent: 'flex-start',
    marginBottom: -4,
  },
  todoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  todoRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // 펼쳐진 콘텐츠 스타일 - 상자가 길어지는 부분
  expandedContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  expandedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 16,
  },
  detailInfoBox: {
    backgroundColor: '#F8F9FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E6ED',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  detailInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailInfoItemLast: {
    marginBottom: 0,
  },
  detailInfoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  detailInfoText: {
    flex: 1,
    marginLeft: 0,
  },
  detailInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 2,
  },
  detailInfoValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '600',
  },
  detailInfoValueMultiline: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  detailInfoValuePositive: {
    color: Colors.primary,
  },
  detailInfoValueNeutral: {
    color: '#999999',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginRight: 8,
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    flexShrink: 0,
    marginBottom: 4,
  },
  todoTime: {
    fontSize: 14,
    color: '#40B59F',
    fontWeight: '600',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 20,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 280,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  
  // 민트 컬러 체크 아이콘
  checkContainer: {
    marginBottom: 20,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkIcon: {
    width: 24,
    height: 14,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    marginTop: -3,
    marginLeft: 3,
  },
  
  // 시니어 친화적 메시지 스타일
  messageContainer: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 18,
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 24,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  completedTimeContainer: {
    backgroundColor: '#F0F0F0',
    opacity: 0.7,
  },
  selectedBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    backgroundColor: '#FFA500',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  selectedTimeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
    borderWidth: 1,
  },
  completeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    minWidth: 80,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  completedButton: {
    backgroundColor: '#95A5A6',
    shadowColor: '#95A5A6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCompleteButton: {
    backgroundColor: '#4A9B97',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  completedButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
