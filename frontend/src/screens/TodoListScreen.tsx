/**
 * 어르신 할일 목록 화면
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'medicine':
        return '💊';
      case 'hospital':
        return '🏥';
      case 'daily':
        return '🏃';
      case 'other':
        return '📞';
      default:
        return '📝';
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

  // 성공 애니메이션 컴포넌트
  const SuccessAnimation = () => {
    if (!showSuccessAnimation) return null;

    return (
      <Animated.View style={[styles.successOverlay, { opacity: fadeAnim }]}>
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>완료되었습니다</Text>
          <Text style={styles.successMessage}>
            "{completedTodoTitle}"
          </Text>
          <Text style={styles.successSubMessage}>
            고생 많으셨어요
          </Text>
        </View>
      </Animated.View>
    );
  };

  const handleCardPress = (todoId: string) => {
    // 카드 터치 시 상세 보기로 이동
    router.push(`/todo-detail?id=${todoId}`);
  };

  const handleAddTodo = () => {
    router.push('/todo-write');
  };

  const TodoCard = ({ todo }: { todo: TodoItem }) => {
    return (
      <View style={[
        styles.todoCard,
        todo.isCompleted && styles.completedCard,
      ]}>
        {/* 완료된 항목에 대한 배지 */}
        {todo.isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>완료</Text>
          </View>
        )}
        
        {/* 카드 전체 터치 영역 - 상세보기로 이동 */}
        <TouchableOpacity
          style={styles.cardTouchArea}
          onPress={() => handleCardPress(todo.id)}
          activeOpacity={0.7}
        >
          <View style={styles.todoHeader}>
            <View style={styles.todoLeft}>
              <Text style={styles.categoryIcon}>
                {getCategoryIcon(todo.category)}
              </Text>
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
                  <Text style={styles.timeIcon}>🕐</Text>
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
            
            {/* 완료 버튼만 남김 */}
            <TouchableOpacity 
              style={styles.completeButtonContainer}
              onPress={() => handleCompletePress(todo.id)}
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
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="할 일" 
        showBackButton 
        rightButton={
          <TouchableOpacity onPress={handleAddTodo} style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 오늘의 할일 요약 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryIcon}>📅</Text>
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
            <Text style={styles.emptyIcon}>✅</Text>
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
  summaryCard: {
    margin: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#40B59F',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  summaryIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  todoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#40B59F',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  cardTouchArea: {
    flex: 1,
  },
  completedCard: {
    backgroundColor: '#F8F9FA',
    borderColor: '#40B59F',
    opacity: 0.9,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
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
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  timeIcon: {
    fontSize: 12,
    marginRight: 4,
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
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    marginHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 3,
    borderColor: '#40B59F',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#40B59F',
    marginBottom: 10,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 18,
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  successSubMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 5,
  },
  completedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#40B59F',
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
  completedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  completedTimeContainer: {
    backgroundColor: '#E8F5E8',
    borderColor: '#40B59F',
    borderWidth: 1,
  },
  selectedCard: {
    backgroundColor: '#40B59F',
    borderColor: '#40B59F',
    borderWidth: 3,
    shadowColor: '#40B59F',
    shadowOpacity: 0.3,
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#2E8B87',
    minWidth: 80,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  completedButton: {
    backgroundColor: '#1E6B67',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
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
  selectedCompleteButtonText: {
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#40B59F',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#40B59F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
});
