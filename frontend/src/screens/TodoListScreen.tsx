/**
 * 어르신 할일 목록 화면 - 리디자인 버전
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header, BottomNavigationBar } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

interface TodoItem {
  id: string;
  title: string;
  description: string;
  time: string;
  isCompleted: boolean;
  priority: 'high' | 'medium' | 'low';
  category: 'medicine' | 'hospital' | 'daily' | 'other';
}

export const TodoListScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [completedTodoTitle, setCompletedTodoTitle] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [expandAnim] = useState(new Animated.Value(0));
  const [todos, setTodos] = useState<TodoItem[]>([
    {
      id: '1',
      title: '혈압약 복용',
      description: '아침 식사 후 혈압약 복용',
      time: '오전 8시',
      isCompleted: false,
      priority: 'high',
      category: 'medicine',
    },
    {
      id: '2',
      title: '정형외과 진료',
      description: '무릎 관절 진료 예약',
      time: '오후 2시',
      isCompleted: false,
      priority: 'high',
      category: 'hospital',
    },
    {
      id: '3',
      title: '산책하기',
      description: '공원에서 30분 산책',
      time: '오후 4시',
      isCompleted: true,
      priority: 'medium',
      category: 'daily',
    },
    {
      id: '4',
      title: '물 마시기',
      description: '하루 8잔 물 마시기',
      time: '하루 종일',
      isCompleted: false,
      priority: 'medium',
      category: 'daily',
    },
    {
      id: '5',
      title: '가족과 통화',
      description: '딸과 전화 통화',
      time: '오후 7시',
      isCompleted: false,
      priority: 'low',
      category: 'other',
    },
  ]);

  const handleCompletePress = (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (todo.isCompleted) {
      // 완료된 할일을 누르면 미완료로 변경
      setTodos(prevTodos =>
        prevTodos.map(t => 
          t.id === id ? { ...t, isCompleted: false } : t
        )
      );
    } else {
      // 미완료 할일을 누르면 완료 처리
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
  };

  // 카테고리별 아이콘 컴포넌트
  const CategoryIcon = ({ category, size = 24 }: { category: string; size?: number }) => {
    const iconStyle = {
      width: size,
      height: size,
      borderRadius: size / 2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    };

    switch (category) {
      case 'medicine':
        return (
          <View style={[iconStyle, { backgroundColor: '#FF6B6B' }]}>
            <View style={{
              width: size * 0.6,
              height: size * 0.6,
              backgroundColor: 'white',
              borderRadius: 2,
            }} />
          </View>
        );
      case 'hospital':
        return (
          <View style={[iconStyle, { backgroundColor: '#4ECDC4' }]}>
            <View style={{
              width: size * 0.4,
              height: size * 0.6,
              backgroundColor: 'white',
            }} />
            <View style={{
              position: 'absolute',
              width: size * 0.6,
              height: size * 0.4,
              backgroundColor: 'white',
            }} />
          </View>
        );
      case 'daily':
        return (
          <View style={[iconStyle, { backgroundColor: '#45B7D1' }]}>
            <View style={{
              width: size * 0.5,
              height: size * 0.5,
              borderRadius: size * 0.25,
              backgroundColor: 'white',
            }} />
          </View>
        );
      default:
        return (
          <View style={[iconStyle, { backgroundColor: '#96CEB4' }]}>
            <View style={{
              width: size * 0.6,
              height: 2,
              backgroundColor: 'white',
              marginBottom: 2,
            }} />
            <View style={{
              width: size * 0.4,
              height: 2,
              backgroundColor: 'white',
              marginBottom: 2,
            }} />
            <View style={{
              width: size * 0.5,
              height: 2,
              backgroundColor: 'white',
            }} />
          </View>
        );
    }
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
            <Text style={styles.successTitle}>완료했어요!</Text>
          <Text style={styles.successMessage}>
            "{completedTodoTitle}"
          </Text>
            <Text style={styles.successSubtitle}>
              오늘 {completedTodos.length + 1}개 완료
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
    const isExpanded = expandedTodoId === todo.id;
    
    return (
      <TouchableOpacity
        style={[
        styles.todoCard,
        todo.isCompleted && styles.completedCard,
        ]}
          onPress={() => handleCardPress(todo.id)}
        activeOpacity={0.95}
        >
        {/* 기본 카드 내용 */}
        <View style={styles.cardContent}>
            <View style={styles.todoLeft}>
            <View style={styles.categoryIconContainer}>
              <CategoryIcon category={todo.category} size={28} />
            </View>
              <View style={styles.todoInfo}>
                <Text
                  style={[
                    styles.todoTitle,
                    todo.isCompleted && styles.completedText,
                  ]}
                >
                  {todo.title}
                </Text>
                <Text
                  style={[
                    styles.todoDescription,
                    todo.isCompleted && styles.completedText,
                  ]}
                >
                  {todo.description}
                </Text>
                <View style={[
                  styles.timeContainer,
                  todo.isCompleted && styles.completedTimeContainer,
                ]}>
                <View style={styles.timeIconContainer}>
                  <View style={styles.clockIcon} />
                </View>
                  <Text
                    style={[
                      styles.todoTime,
                      todo.isCompleted && styles.completedText,
                    ]}
                  >
                    {todo.time}
                  </Text>
                </View>
              </View>
            </View>
            
          {/* 완료 버튼 */}
            <TouchableOpacity 
              style={styles.completeButtonContainer}
            onPress={(e) => {
              e.stopPropagation(); // 카드 클릭 이벤트 방지
              handleCompletePress(todo.id);
            }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.completeButton,
                todo.isCompleted && styles.completedButton,
              ]}>
                {todo.isCompleted ? (
                  <Text style={styles.completedButtonText}>취소</Text>
                ) : (
                  <Text style={styles.completeButtonText}>완료</Text>
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
            <Text style={styles.expandedLabel}>더 자세한 정보</Text>
            <Text style={styles.expandedDescription}>
              이 할일에 대한 추가 정보나 메모가 여기에 표시됩니다.
            </Text>
          </Animated.View>
        )}
        </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="할 일" 
        showBackButton 
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 오늘의 할일 요약 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.calendarIconContainer}>
              <View style={styles.calendarIcon}>
                <View style={styles.calendarTop} />
                <View style={styles.calendarBody} />
              </View>
            </View>
            <Text style={styles.summaryTitle}>오늘의 할일</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{pendingTodos.length}</Text>
              <Text style={styles.statLabel}>남은 일</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{completedTodos.length}</Text>
              <Text style={styles.statLabel}>완료</Text>
            </View>
          </View>
        </View>

        {/* 완료되지 않은 할일 */}
        {pendingTodos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>해야 할 일</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{pendingTodos.length}</Text>
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
              <Text style={styles.sectionTitle}>완료된 일</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{completedTodos.length}</Text>
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
            <Text style={styles.emptyTitle}>오늘 할일이 없습니다</Text>
            <Text style={styles.emptyDescription}>
              보호자가 설정한 할일이 여기에 표시됩니다
            </Text>
          </View>
        )}

        {/* 하단 여백 (네비게이션 바 공간 확보) */}
        <View style={[styles.bottomSpacer, { height: 100 + Math.max(insets.bottom, 10) }]} />
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
  
  // 새로운 아이콘 스타일들
  categoryIconContainer: {
    marginRight: 12,
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
  timeIconContainer: {
    marginRight: 6,
  },
  clockIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
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
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  todoInfo: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  todoDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
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
  expandedDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
  },
  detailTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  detailTimeText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
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
