/**
 * 어르신 할일 상세 화면
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

export const TodoDetailScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  // 목업 데이터 (실제로는 API에서 받아올 데이터)
  const todo: TodoItem = {
    id: id as string || '1',
    title: '혈압약 복용',
    description: '아침 식사 후 혈압약을 복용해주세요. 물과 함께 드시면 됩니다.',
    time: '오전 8시',
    isCompleted: false,
    priority: 'high',
    category: 'medicine',
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


  const handleComplete = () => {
    Alert.alert(
      '할일 완료',
      '이 할일을 완료 처리하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '완료',
          onPress: () => {
            // 실제로는 API 호출
            Alert.alert('완료', '할일이 완료되었습니다!');
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header title="할일 상세" showBackButton />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 할일 정보 카드 */}
        <View style={styles.todoCard}>
          <View style={styles.todoHeader}>
            <View style={styles.categorySection}>
              <Text style={styles.categoryIcon}>
                {getCategoryIcon(todo.category)}
              </Text>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryLabel}>카테고리</Text>
                <Text style={styles.categoryValue}>
                  {todo.category === 'medicine' ? '약물' :
                   todo.category === 'hospital' ? '병원' :
                   todo.category === 'daily' ? '일상' : '기타'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.titleSection}>
            <Text style={styles.todoTitle}>{todo.title}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {todo.isCompleted ? '완료됨' : '진행중'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionLabel}>상세 내용</Text>
            <Text style={styles.descriptionText}>{todo.description}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.timeSection}>
            <Text style={styles.timeLabel}>예정 시간</Text>
            <View style={styles.timeContainer}>
              <Text style={styles.timeIcon}>🕐</Text>
              <Text style={styles.timeText}>{todo.time}</Text>
            </View>
          </View>
        </View>

        {/* 액션 버튼들 */}
        <View style={styles.actionSection}>
          {!todo.isCompleted && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleComplete}
              activeOpacity={0.7}
            >
              <Text style={styles.completeButtonText}>완료 처리</Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  todoCard: {
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
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  categorySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  categoryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 15,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  todoTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#40B59F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  descriptionSection: {
    marginBottom: 5,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
  },
  timeSection: {
    marginBottom: 5,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  timeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  timeText: {
    fontSize: 16,
    color: '#40B59F',
    fontWeight: '600',
  },
  actionSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  completeButton: {
    backgroundColor: '#40B59F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#40B59F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 20,
  },
});
