/**
 * 어르신 할일 상세 화면 - 리디자인 버전
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

// 카테고리별 아이콘 컴포넌트
const CategoryIcon = ({ category, size = 32 }: { category: string; size?: number }) => {
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



  const handleComplete = () => {
    Alert.alert(
      '할일 완료',
      '이 할일을 완료하시겠습니까?',
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
              <View style={styles.categoryIconContainer}>
                <CategoryIcon category={todo.category} size={40} />
              </View>
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
              <View style={styles.timeIconContainer}>
                <View style={styles.clockIcon} />
              </View>
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
              <Text style={styles.completeButtonText}>완료
                
              </Text>
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
    paddingHorizontal: 20,
  },
  
  // 새로운 아이콘 스타일들
  categoryIconContainer: {
    marginRight: 16,
  },
  timeIconContainer: {
    marginRight: 8,
  },
  clockIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  
  todoCard: {
    marginTop: 20,
    marginBottom: 20,
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
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  categorySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
    fontWeight: '500',
  },
  categoryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 20,
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
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  timeText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  actionSection: {
    marginBottom: 20,
  },
  completeButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
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
