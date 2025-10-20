/**
 * 감지된 TODO 추천 목록 컴포넌트
 * 일기에서 자동으로 감지된 할 일을 표시하고 선택하여 등록
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getSuggestedTodos, acceptSuggestedTodos } from '../api/diary';

interface SuggestedTodo {
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'high' | 'medium' | 'low';
  category: string;
  elderly_id: string;
  elderly_name?: string;
  creator_id: string;
  source: 'todo' | 'future_plan';
}

interface Props {
  diaryId: string;
  onTodosAccepted?: () => void;
}

export const SuggestedTodoList: React.FC<Props> = ({ diaryId, onTodosAccepted }) => {
  const [todos, setTodos] = useState<SuggestedTodo[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    loadSuggestedTodos();
  }, [diaryId]);

  /**
   * 감지된 TODO 목록 로드
   */
  const loadSuggestedTodos = async () => {
    try {
      setLoading(true);
      const response = await getSuggestedTodos(diaryId);
      setTodos(response.suggested_todos);
    } catch (error: any) {
      console.error('Failed to load suggested todos:', error);
      // 에러가 나도 조용히 넘어감 (TODO가 없는 경우)
    } finally {
      setLoading(false);
    }
  };

  /**
   * TODO 선택/해제 토글
   */
  const toggleTodo = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  /**
   * 선택한 TODO 등록
   */
  const handleAccept = async () => {
    if (selectedIndices.length === 0) {
      Alert.alert('알림', '추가할 할 일을 선택해주세요.');
      return;
    }

    setAccepting(true);
    try {
      const response = await acceptSuggestedTodos(diaryId, selectedIndices);

      Alert.alert(
        '✅ 등록 완료',
        `${response.created_todos_count}개의 할 일이 추가되었습니다.\n할 일 화면에서 확인하세요!`,
        [
          {
            text: '확인',
            onPress: () => {
              setTodos([]);
              setSelectedIndices([]);
              onTodosAccepted?.();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Failed to accept todos:', error);
      Alert.alert(
        '오류',
        error.response?.data?.detail || '할 일 추가에 실패했습니다.'
      );
    } finally {
      setAccepting(false);
    }
  };

  /**
   * 우선순위 배지 색상
   */
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#FF5722';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  /**
   * 우선순위 텍스트
   */
  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '중요';
      case 'medium':
        return '보통';
      case 'low':
        return '낮음';
      default:
        return '';
    }
  };

  /**
   * 카테고리 이모지
   */
  const getCategoryEmoji = (category: string) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('건강') || lowerCategory.includes('hospital')) return '🏥';
    if (lowerCategory.includes('식사') || lowerCategory.includes('meal')) return '🍽️';
    if (lowerCategory.includes('외출') || lowerCategory.includes('outdoor')) return '🚶';
    if (lowerCategory.includes('약속') || lowerCategory.includes('meeting')) return '🤝';
    return '📋';
  };

  /**
   * 날짜 포맷팅
   */
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateStr = date.toDateString();
    const todayStr = today.toDateString();
    const tomorrowStr = tomorrow.toDateString();

    if (dateStr === todayStr) {
      return '오늘';
    } else if (dateStr === tomorrowStr) {
      return '내일';
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}월 ${day}일`;
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#34B79F" />
        <Text style={styles.loadingText}>할 일 감지 중...</Text>
      </View>
    );
  }

  // TODO가 없으면 표시 안 함
  if (todos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>📌 감지된 일정</Text>
        <Text style={styles.subtitle}>
          통화 중 언급된 할 일이 {todos.length}개 발견되었습니다.
        </Text>
      </View>

      {/* TODO 목록 */}
      {todos.map((todo, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.todoItem,
            selectedIndices.includes(index) && styles.todoItemSelected,
          ]}
          onPress={() => toggleTodo(index)}
          activeOpacity={0.7}
        >
          {/* 체크박스 */}
          <View
            style={[
              styles.checkbox,
              selectedIndices.includes(index) && styles.checkboxSelected,
            ]}
          >
            {selectedIndices.includes(index) && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>

          {/* TODO 내용 */}
          <View style={styles.todoContent}>
            <View style={styles.todoTitleRow}>
              <Text style={styles.todoTitle}>{todo.title}</Text>
              {todo.priority === 'high' && (
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: getPriorityColor(todo.priority) },
                  ]}
                >
                  <Text style={styles.priorityText}>
                    {getPriorityText(todo.priority)}
                  </Text>
                </View>
              )}
            </View>

            {todo.description && (
              <Text style={styles.todoDescription} numberOfLines={2}>
                {todo.description}
              </Text>
            )}

            <View style={styles.todoMeta}>
              {todo.due_date && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaText}>
                    📅 {formatDate(todo.due_date)}
                    {todo.due_time && ` ${todo.due_time}`}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>
                  {getCategoryEmoji(todo.category)} {todo.category}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* 등록 버튼 */}
      <TouchableOpacity
        style={[
          styles.acceptButton,
          (accepting || selectedIndices.length === 0) &&
            styles.acceptButtonDisabled,
        ]}
        onPress={handleAccept}
        disabled={accepting || selectedIndices.length === 0}
      >
        {accepting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.acceptButtonText}>
            {selectedIndices.length > 0
              ? `선택한 ${selectedIndices.length}개 할 일 추가`
              : '할 일을 선택해주세요'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    marginVertical: 16,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666666',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  todoItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  todoItemSelected: {
    borderColor: '#34B79F',
    borderWidth: 2,
    backgroundColor: '#F0FFF8',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#34B79F',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#34B79F',
    borderColor: '#34B79F',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  todoContent: {
    flex: 1,
  },
  todoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  todoDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 20,
  },
  todoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#666666',
  },
  acceptButton: {
    backgroundColor: '#34B79F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#34B79F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  acceptButtonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SuggestedTodoList;

