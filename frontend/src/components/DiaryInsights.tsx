/**
 * 다이어리 인사이트 컴포넌트
 * StreakCard, MoodHeatmap 포함
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Diary } from '../api/diary';

export interface DiaryInsightsProps {
  month: string; // YYYY-MM
  diaries: Diary[]; // 월별 다이어리 (히트맵용)
  allDiaries?: Diary[]; // 전체 다이어리 (연속 작성 계산용)
  onInsightPress?: (type: string) => void;
  onMonthChange?: (month: string) => void; // 월 변경 핸들러
  availableMonths?: string[]; // 다이어리가 있는 월 목록 (YYYY-MM 형식)
}

interface StreakData {
  current: number;
  longest: number;
  thisMonthProgress: number;
}

const MOOD_COLORS: Record<string, string> = {
  happy: '#FFD700',
  excited: '#FF6B6B',
  calm: '#4ECDC4',
  sad: '#5499C7',
  angry: '#E74C3C',
  tired: '#9B59B6',
};

/**
 * StreakCard 컴포넌트
 */
const StreakCard: React.FC<{ streak: StreakData; onPress?: () => void }> = ({ streak, onPress }) => (
  <TouchableOpacity
    style={styles.streakCard}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.streakHeader}>
      <Ionicons name="flame" size={24} color="#FF6B6B" />
      <Text style={styles.streakTitle}>연속 작성</Text>
    </View>
    <View style={styles.streakStats}>
      <View style={styles.streakStat}>
        <Text style={styles.streakValue}>{streak.current}일</Text>
        <Text style={styles.streakLabel}>현재</Text>
      </View>
      <View style={styles.streakDivider} />
      <View style={styles.streakStat}>
        <Text style={styles.streakValue}>{streak.longest}일</Text>
        <Text style={styles.streakLabel}>최장</Text>
      </View>
    </View>
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${streak.thisMonthProgress}%` },
          ]}
        />
      </View>
      <Text style={styles.progressText}>이번 달 {streak.thisMonthProgress}%</Text>
    </View>
  </TouchableOpacity>
);

/**
 * MoodHeatmap 컴포넌트
 */
const MoodHeatmap: React.FC<{ month: string; diaries: Diary[] }> = ({ month, diaries }) => {
  const [year, monthNum] = month.split('-');
  const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const isCurrentMonth = parseInt(year) === currentYear && parseInt(monthNum) === currentMonth;

  // 날짜별 mood 매핑
  const moodMap: Record<number, string | null> = {};
  diaries.forEach(diary => {
    const day = new Date(diary.date).getDate();
    moodMap[day] = diary.mood || null;
  });

  // 그리드 생성 (7일씩 행으로)
  const weeks: number[][] = [];
  let currentWeek: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7 || day === daysInMonth) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  }

  // 화면 너비 계산 (패딩 제외)
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 32; // heatmapCard padding 16 * 2
  const rowGap = 4; // gap between cells
  const availableWidth = screenWidth - cardPadding - 32; // 추가 마진
  const cellWidth = (availableWidth - (rowGap * 6)) / 7; // 7개 셀, 6개 gap

  return (
    <View style={styles.heatmapCard}>
      <View style={styles.heatmapHeader}>
        <Ionicons name="grid-outline" size={20} color={Colors.primary} />
        <Text style={styles.heatmapTitle}>감정 히트맵</Text>
      </View>
      <View style={styles.heatmapGrid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.heatmapRow}>
            {week.map(day => {
              const mood = moodMap[day];
              const isFuture = isCurrentMonth && day > today.getDate();
              const hasDiary = mood !== undefined && mood !== null;

              return (
                <View
                  key={day}
                  style={[
                    styles.heatmapCell,
                    { width: cellWidth, height: cellWidth },
                    hasDiary && { backgroundColor: MOOD_COLORS[mood] + '40' || Colors.primaryPale + '40' },
                    isFuture && styles.heatmapCellFuture,
                    !hasDiary && !isFuture && styles.heatmapCellEmpty,
                  ]}
                >
                  {hasDiary && (
                    <View style={[styles.heatmapDot, { backgroundColor: MOOD_COLORS[mood] || Colors.primary }]} />
                  )}
                  <Text style={styles.heatmapDayNumber}>{day}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

/**
 * SkeletonLoader 컴포넌트
 */
const SkeletonLoader: React.FC = () => (
  <View style={styles.skeletonContainer}>
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%' }]} />
    </View>
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '70%' }]} />
    </View>
  </View>
);


export const DiaryInsights: React.FC<DiaryInsightsProps> = ({
  month,
  diaries,
  allDiaries, // 전체 다이어리 (연속 작성 계산용)
  onInsightPress,
  onMonthChange,
  availableMonths = [],
}) => {
  /**
   * 과거 달로 이동 (다이어리가 있는 월 중)
   * < 버튼: 인덱스 증가 (과거로)
   */
  const goToPreviousMonth = () => {
    if (availableMonths.length === 0) return;
    
    const currentIndex = availableMonths.indexOf(month);
    if (currentIndex < availableMonths.length - 1) {
      // 과거 월로 이동 (인덱스 증가)
      onMonthChange?.(availableMonths[currentIndex + 1]);
    }
  };

  /**
   * 미래 달로 이동 (다이어리가 있는 월 중)
   * > 버튼: 인덱스 감소 (미래로)
   */
  const goToNextMonth = () => {
    if (availableMonths.length === 0) return;
    
    const currentIndex = availableMonths.indexOf(month);
    if (currentIndex > 0) {
      // 미래 월로 이동 (인덱스 감소)
      onMonthChange?.(availableMonths[currentIndex - 1]);
    }
  };

  /**
   * 과거 달 이동 가능 여부 (< 버튼)
   */
  const canGoToPreviousMonth = () => {
    if (availableMonths.length === 0) return false;
    const currentIndex = availableMonths.indexOf(month);
    return currentIndex < availableMonths.length - 1;
  };

  /**
   * 미래 달 이동 가능 여부 (> 버튼)
   */
  const canGoToNextMonth = () => {
    if (availableMonths.length === 0) return false;
    const currentIndex = availableMonths.indexOf(month);
    return currentIndex > 0;
  };

  /**
   * 현재 달 여부 확인 (다음 달 버튼 비활성화용)
   */
  const isCurrentMonth = () => {
    const [year, monthNum] = month.split('-');
    const today = new Date();
    return parseInt(year) === today.getFullYear() && parseInt(monthNum) === today.getMonth() + 1;
  };
  // 연속 작성 일수 계산
  const calculateStreak = (): StreakData => {
    // 전체 다이어리 사용 (연속 작성은 월별로 나누지 않고 전체 기록 기준)
    const diariesForStreak = allDiaries && allDiaries.length > 0 ? allDiaries : diaries;
    
    if (diariesForStreak.length === 0) {
      return { current: 0, longest: 0, thisMonthProgress: 0 };
    }

    // 날짜 순 정렬
    const sortedDates = [...new Set(diariesForStreak.map(d => d.date))].sort();

    // 현재 연속 작성 일수
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const date = new Date(sortedDates[i]);
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === currentStreak) {
        currentStreak++;
      } else {
        break;
      }
    }

    // 최장 연속 작성 일수
    let longestStreak = 1;
    let currentLongest = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentLongest++;
        longestStreak = Math.max(longestStreak, currentLongest);
      } else {
        currentLongest = 1;
      }
    }

    // 이번 달 진행률 (월별 다이어리 사용)
    const [yearStr, monthNumStr] = month.split('-');
    const daysInMonth = new Date(parseInt(yearStr), parseInt(monthNumStr), 0).getDate();
    const todayDate = new Date();
    const currentMonth = todayDate.getMonth() + 1;
    const currentYear = todayDate.getFullYear();
    const isCurrentMonth = parseInt(yearStr) === currentYear && parseInt(monthNumStr) === currentMonth;
    
    const daysPassed = isCurrentMonth ? todayDate.getDate() : daysInMonth;
    const daysWithDiary = new Set(diaries.map(d => new Date(d.date).getDate())).size;
    const progress = daysPassed > 0 ? Math.round((daysWithDiary / daysPassed) * 100) : 0;

    return {
      current: currentStreak,
      longest: longestStreak,
      thisMonthProgress: progress,
    };
  };

  const streak = calculateStreak();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="bar-chart-outline" size={20} color={Colors.primary} />
        <Text style={styles.title}>월간 요약</Text>
        {/* 월 변경 버튼 */}
        <View style={styles.monthNavigator}>
          <TouchableOpacity
            style={[styles.monthButton, !canGoToPreviousMonth() && styles.monthButtonDisabled]}
            onPress={goToPreviousMonth}
            disabled={!canGoToPreviousMonth()}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="chevron-back" 
              size={20} 
              color={canGoToPreviousMonth() ? Colors.primary : Colors.textDisabled} 
            />
          </TouchableOpacity>
          <Text style={styles.month}>{formatMonth(month)}</Text>
          <TouchableOpacity
            style={[styles.monthButton, !canGoToNextMonth() && styles.monthButtonDisabled]}
            onPress={goToNextMonth}
            disabled={!canGoToNextMonth()}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={canGoToNextMonth() ? Colors.primary : Colors.textDisabled} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 위아래 배치: 위에 연속 작성, 아래에 히트맵 */}
      <View style={styles.verticalContent}>
        <StreakCard streak={streak} onPress={() => onInsightPress?.('streak')} />
        <MoodHeatmap month={month} diaries={diaries} />
      </View>
    </View>
  );
};

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  return `${year}년 ${parseInt(month)}월`;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 8,
  },
  monthButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.primaryPale,
  },
  monthButtonDisabled: {
    backgroundColor: Colors.backgroundLight,
    opacity: 0.5,
  },
  month: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 80,
    textAlign: 'center',
  },
  verticalContent: {
    gap: 16,
  },
  streakCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  streakStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakStat: {
    flex: 1,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  heatmapCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  heatmapTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  heatmapGrid: {
    marginBottom: 8,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  heatmapCell: {
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  heatmapCellEmpty: {
    backgroundColor: Colors.background,
  },
  heatmapCellFuture: {
    backgroundColor: Colors.background,
    opacity: 0.5,
  },
  heatmapDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 4,
    right: 4,
  },
  heatmapDayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  skeletonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  skeletonCard: {
    width: 200,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.backgroundLight,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    marginBottom: 8,
  },
});
