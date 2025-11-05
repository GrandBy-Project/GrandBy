/**
 * 보호자 통계 화면
 * 할일 통계 및 건강 상태 분석
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Header, BottomNavigationBar } from '../components';
import * as todoApi from '../api/todo';
import { useAlert } from '../components/GlobalAlertProvider';

export const GuardianStatisticsScreen = () => {
  const router = useRouter();
  const { show } = useAlert();
  const params = useLocalSearchParams();
  const elderlyId = params.elderlyId as string | undefined;
  const elderlyName = params.elderlyName as string | undefined;

  const [monthlyStats, setMonthlyStats] = useState<todoApi.TodoDetailedStats | null>(null);
  const [lastMonthStats, setLastMonthStats] = useState<todoApi.TodoDetailedStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'last_month'>('month');
  const [allTodos, setAllTodos] = useState<todoApi.TodoItem[]>([]);
  const [todayTodos, setTodayTodos] = useState<todoApi.TodoItem[]>([]);

  // 어르신의 통계 불러오기
  const loadStatsForElderly = async (
    targetElderlyId: string,
    period: 'month' | 'last_month',
    skipLoadingState: boolean = false
  ) => {
    if (!skipLoadingState && isLoadingStats) {
      return;
    }
    if (!skipLoadingState) {
      setIsLoadingStats(true);
    }
    try {
      const stats = await todoApi.getDetailedStats(period, targetElderlyId);
      
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

  // 전체 할일 목록 불러오기 (통계 없을 때 구분용)
  const loadAllTodosForElderly = async (targetElderlyId: string) => {
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      const endDate = new Date(today);
      endDate.setMonth(today.getMonth() + 3);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const todos = await todoApi.getTodosByRange(startDateStr, endDateStr, targetElderlyId);
      setAllTodos(Array.isArray(todos) ? todos : []);
    } catch (error: any) {
      console.error('전체 할일 조회 실패:', error);
      setAllTodos([]);
      // 통계용이므로 에러 알림은 생략 (너무 자주 발생할 수 있음)
    }
  };

  // 오늘 할일 목록 불러오기
  const loadTodayTodos = async (targetElderlyId: string) => {
    try {
      const todos = await todoApi.getTodos('today', targetElderlyId);
      setTodayTodos(Array.isArray(todos) ? todos : []);
    } catch (error: any) {
      console.error('오늘 할일 조회 실패:', error);
      setTodayTodos([]);
      // 통계용이므로 에러 알림은 생략 (너무 자주 발생할 수 있음)
    }
  };

  // 데이터 새로고침
  const handleRefresh = useCallback(async () => {
    if (!elderlyId) return;
    
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadStatsForElderly(elderlyId, 'month', true),
        loadStatsForElderly(elderlyId, 'last_month', true),
        loadAllTodosForElderly(elderlyId),
        loadTodayTodos(elderlyId),
      ]);
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [elderlyId]);

  // 화면 포커스 시 데이터 로딩
  useFocusEffect(
    useCallback(() => {
      if (!elderlyId) {
        router.back();
        return;
      }

      loadStatsForElderly(elderlyId, 'month');
      loadStatsForElderly(elderlyId, 'last_month');
      loadAllTodosForElderly(elderlyId);
      loadTodayTodos(elderlyId);
    }, [elderlyId])
  );

  // 건강 알림 생성 (통일된 기준: <80%, 완료된 항목이 있을 때만)
  const generateHealthAlerts = (stats: todoApi.TodoDetailedStats | null) => {
    if (!stats) return [];
    const alerts = [];
    
    const medicineCategory = stats.by_category.find(cat => cat.category === 'MEDICINE');
    if (medicineCategory && medicineCategory.total > 0 && medicineCategory.completed > 0 && medicineCategory.completion_rate < 0.8) {
      const rate = Math.round(medicineCategory.completion_rate * 100);
      alerts.push({
        message: `약 복용이 부족해요 (${rate}%)`,
        recommendation: rate < 50 
          ? '복약이 많이 누락되고 있어요. 아침 식사 후 복약 시간을 정해두시면 좋을 것 같아요'
          : '복약 알림을 더 자주 해주시거나, 복약표를 만들어 벽에 붙여두시면 도움이 될 것 같아요'
      });
    }

    const hospitalCategory = stats.by_category.find(cat => cat.category === 'HOSPITAL');
    if (hospitalCategory && hospitalCategory.total > 0 && hospitalCategory.completed > 0 && hospitalCategory.completion_rate < 0.8) {
      const rate = Math.round(hospitalCategory.completion_rate * 100);
      alerts.push({
        message: `병원 방문 일정이 부족해요 (${rate}%)`,
        recommendation: '정기 검진을 놓치지 않도록 캘린더에 표시해두시면 좋을 것 같아요'
      });
    }

    const exerciseCategory = stats.by_category.find(cat => cat.category === 'EXERCISE');
    if (exerciseCategory && exerciseCategory.total > 0 && exerciseCategory.completed > 0 && exerciseCategory.completion_rate < 0.8) {
      const rate = Math.round(exerciseCategory.completion_rate * 100);
      alerts.push({
        message: `운동이 부족해요 (${rate}%)`,
        recommendation: rate < 50
          ? '집에서 할 수 있는 간단한 스트레칭부터 시작해보시는 건 어떨까요? 하루 10분씩이라도 꾸준히 하시면 좋아요'
          : '운동 횟수를 조금씩 늘려보시거나, 산책을 함께 해보시면 어떨까요?'
      });
    }

    const mealCategory = stats.by_category.find(cat => cat.category === 'MEAL');
    if (mealCategory && mealCategory.total > 0 && mealCategory.completed > 0 && mealCategory.completion_rate < 0.8) {
      const rate = Math.round(mealCategory.completion_rate * 100);
      alerts.push({
        message: `식사 시간이 불규칙해요 (${rate}%)`,
        recommendation: rate < 50
          ? '식사 시간을 정해두시고, 아침·점심·저녁 시간을 일정하게 유지하시면 건강에 더 좋아요'
          : '규칙적인 식사 시간을 정해보시면 소화에도 좋고 건강한 생활 패턴을 유지하실 수 있어요'
      });
    }

    return alerts;
  };

  // 양호한 상태 생성 (통일된 기준: ≥90%, 완료된 항목이 있을 때만)
  const generateGoodStatus = (stats: todoApi.TodoDetailedStats | null) => {
    if (!stats) return [];
    const goodItems = [];
    
    const medicineCategory = stats.by_category.find(cat => cat.category === 'MEDICINE');
    if (medicineCategory && medicineCategory.total > 0 && medicineCategory.completed > 0 && medicineCategory.completion_rate >= 0.9) {
      goodItems.push(`약 복용을 정말 잘 하고 계세요! (${Math.round(medicineCategory.completion_rate * 100)}%)`);
    }

    const hospitalCategory = stats.by_category.find(cat => cat.category === 'HOSPITAL');
    if (hospitalCategory && hospitalCategory.total > 0 && hospitalCategory.completed > 0 && hospitalCategory.completion_rate >= 0.9) {
      goodItems.push(`병원 일정을 잘 지키고 계세요! (${Math.round(hospitalCategory.completion_rate * 100)}%)`);
    }

    const exerciseCategory = stats.by_category.find(cat => cat.category === 'EXERCISE');
    if (exerciseCategory && exerciseCategory.total > 0 && exerciseCategory.completed > 0 && exerciseCategory.completion_rate >= 0.9) {
      goodItems.push(`운동을 정말 열심히 하시는군요! (${Math.round(exerciseCategory.completion_rate * 100)}%)`);
    }

    const mealCategory = stats.by_category.find(cat => cat.category === 'MEAL');
    if (mealCategory && mealCategory.total > 0 && mealCategory.completed > 0 && mealCategory.completion_rate >= 0.9) {
      goodItems.push(`식사 시간을 규칙적으로 잘 지키고 계세요! (${Math.round(mealCategory.completion_rate * 100)}%)`);
    }

    if (stats.completed > 0 && stats.completion_rate >= 0.9) {
      goodItems.push(`전반적으로 정말 잘 하고 계세요! (${Math.round(stats.completion_rate * 100)}%)`);
    }

    return goodItems;
  };

  // 개선 권장사항 생성 (80-90% 구간 구체적 조언, 90% 이상은 제외, 완료된 항목이 있을 때만)
  const generateRecommendations = (stats: todoApi.TodoDetailedStats | null) => {
    if (!stats) return [];
    if (stats.total === 0) return [];
    
    // 완료된 항목이 없으면 조언 제외
    if (stats.completed === 0) return [];
    
    const recommendations = [];
    
    // 복약 관리 (80-90% 구간 또는 <80% 구체적 조언)
    const medicineCategory = stats.by_category.find(cat => cat.category === 'MEDICINE');
    if (medicineCategory && medicineCategory.total > 0 && medicineCategory.completed > 0) {
      const rate = medicineCategory.completion_rate;
      if (rate >= 0.8 && rate < 0.9) {
        recommendations.push('복약 완료율이 좋아지고 있어요! 조금만 더 꾸준히 하시면 더 좋을 것 같아요. 복약 시간을 정해두시면 도움이 될 거예요');
      } else if (rate < 0.8) {
        // 이미 경고에서 나왔으므로 조언은 간단하게
        recommendations.push('복약 시간을 정해두시고, 복약 알림을 활용하시면 잊지 않으실 수 있어요');
      }
    }

    // 병원 일정 (80-90% 구간 또는 <80% 구체적 조언)
    const hospitalCategory = stats.by_category.find(cat => cat.category === 'HOSPITAL');
    if (hospitalCategory && hospitalCategory.total > 0 && hospitalCategory.completed > 0) {
      const rate = hospitalCategory.completion_rate;
      if (rate >= 0.8 && rate < 0.9) {
        recommendations.push('병원 일정을 잘 지키고 계세요! 정기 검진을 놓치지 않도록 캘린더에 미리 표시해두시면 좋아요');
      } else if (rate < 0.8) {
        recommendations.push('병원 일정을 미리 확인하시고, 검진 날짜를 놓치지 않도록 주의해주세요');
      }
    }

    // 운동 기록 (80-90% 구간 또는 <80% 구체적 조언)
    const exerciseCategory = stats.by_category.find(cat => cat.category === 'EXERCISE');
    if (exerciseCategory && exerciseCategory.total > 0 && exerciseCategory.completed > 0) {
      const rate = exerciseCategory.completion_rate;
      if (rate >= 0.8 && rate < 0.9) {
        recommendations.push('운동을 꾸준히 하고 계시네요! 조금만 더 하시면 더욱 건강해지실 거예요');
      } else if (rate < 0.8) {
        recommendations.push('운동 횟수를 조금씩 늘려보시거나, 간단한 스트레칭부터 시작해보시는 건 어떨까요?');
      }
    }

    // 식사 관리 (80-90% 구간 또는 <80% 구체적 조언)
    const mealCategory = stats.by_category.find(cat => cat.category === 'MEAL');
    if (mealCategory && mealCategory.total > 0 && mealCategory.completed > 0) {
      const rate = mealCategory.completion_rate;
      if (rate >= 0.8 && rate < 0.9) {
        recommendations.push('식사 시간을 잘 지키고 계세요! 조금만 더 규칙적으로 하시면 더 좋을 것 같아요');
      } else if (rate < 0.8) {
        recommendations.push('아침·점심·저녁 시간을 정해두시고 규칙적으로 식사하시면 건강에 더 좋아요');
      }
    }

    // 모든 항목이 90% 이상일 때
    if (recommendations.length === 0 && stats.total > 0) {
      recommendations.push('모든 할일을 정말 잘 수행하고 계세요! 현재 상태를 계속 유지해주세요');
      recommendations.push('새로운 취미 활동이나 독서 같은 활동을 추가해보시면 더욱 즐거운 하루가 되실 거예요');
    }

    return recommendations;
  };

  // 건강관리 카테고리별 분석 함수
  const getCategoryAnalysis = (category: 'MEDICINE' | 'HOSPITAL' | 'EXERCISE' | 'MEAL') => {
    // 안전한 배열 접근 (null/undefined 체크)
    const safeTodayTodos = Array.isArray(todayTodos) ? todayTodos : [];
    const safeAllTodos = Array.isArray(allTodos) ? allTodos : [];
    
    // 오늘 날짜의 TODO 필터링
    const todayCategoryTodos = safeTodayTodos.filter(t => t && t.category === category);
    const todayCompleted = todayCategoryTodos.filter(t => t.status === 'completed').length;
    const todayTotal = todayCategoryTodos.length;

    // 선택된 기간 통계에서 카테고리 찾기
    const stats = selectedPeriod === 'month' ? monthlyStats : lastMonthStats;
    const categoryStats = stats?.by_category?.find(c => c?.category === category) || null;
    const completionRate = categoryStats ? Math.round(categoryStats.completion_rate * 100) : 0;
    
    // 다가오는 일정 찾기 (병원 일정용)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingTodos = safeAllTodos
      .filter(t => {
        if (!t || !t.due_date || t.category !== category || t.status !== 'pending') return false;
        try {
          const todoDate = new Date(t.due_date);
          todoDate.setHours(0, 0, 0, 0);
          return todoDate.getTime() >= today.getTime();
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        try {
          const dateA = new Date(`${a.due_date} ${a.due_time || '00:00'}`);
          const dateB = new Date(`${b.due_date} ${b.due_time || '00:00'}`);
          return dateA.getTime() - dateB.getTime();
        } catch {
          return 0;
        }
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
        const nextAppointment = upcomingTodos[0] || null;
        let statusText = '일정 없음';
        
        if (nextAppointment && nextAppointment.due_date) {
          try {
            const appointmentDate = new Date(nextAppointment.due_date);
            if (!isNaN(appointmentDate.getTime())) {
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
          } catch {
            statusText = '일정 없음';
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

  // 건강관리 카드 렌더링
  const renderHealthCards = () => {
    const medicineAnalysis = getCategoryAnalysis('MEDICINE');
    const hospitalAnalysis = getCategoryAnalysis('HOSPITAL');
    const exerciseAnalysis = getCategoryAnalysis('EXERCISE');
    const mealAnalysis = getCategoryAnalysis('MEAL');

    return (
      <View style={styles.healthCardsContainer}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>건강관리</Text>
        </View>

        {/* 복약 관리 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleContainer}>
              <Ionicons name="medical" size={20} color="#FF6B6B" />
              <Text style={styles.healthCardTitle}>복약 관리</Text>
            </View>
            {medicineAnalysis.categoryStats ? (
              <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#FF6B6B' }]}>
                <Text style={[styles.healthCardCompletionRate, { color: '#FFFFFF' }]}>
                  {medicineAnalysis.completionRate}%
                </Text>
                <Text style={[styles.healthCardCompletionLabel, { color: '#FFFFFF' }]}>
                  {selectedPeriod === 'month' ? '이번 달' : '지난 달'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 통계 - Progress Bar */}
          {medicineAnalysis.categoryStats && (
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
            </View>
          )}
        </View>

        {/* 병원 일정 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleContainer}>
              <Ionicons name="calendar" size={20} color="#4ECDC4" />
              <Text style={styles.healthCardTitle}>병원 일정</Text>
            </View>
            {hospitalAnalysis.categoryStats ? (
              <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#4ECDC4' }]}>
                <Text style={[styles.healthCardCompletionRate, { color: '#FFFFFF' }]}>
                  {hospitalAnalysis.completionRate}%
                </Text>
                <Text style={[styles.healthCardCompletionLabel, { color: '#FFFFFF' }]}>
                  {selectedPeriod === 'month' ? '이번 달' : '지난 달'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 통계 - Progress Bar */}
          {hospitalAnalysis.categoryStats && (
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
            {exerciseAnalysis.categoryStats ? (
              <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#45B7D1' }]}>
                <Text style={[styles.healthCardCompletionRate, { color: '#FFFFFF' }]}>
                  {exerciseAnalysis.completionRate}%
                </Text>
                <Text style={[styles.healthCardCompletionLabel, { color: '#FFFFFF' }]}>
                  {selectedPeriod === 'month' ? '이번 달' : '지난 달'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 통계 - Progress Bar */}
          {exerciseAnalysis.categoryStats && (
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
            {mealAnalysis.categoryStats ? (
              <View style={[styles.healthCardCompletionBadge, { backgroundColor: '#96CEB4' }]}>
                <Text style={[styles.healthCardCompletionRate, { color: '#FFFFFF' }]}>
                  {mealAnalysis.completionRate}%
                </Text>
                <Text style={[styles.healthCardCompletionLabel, { color: '#FFFFFF' }]}>
                  {selectedPeriod === 'month' ? '이번 달' : '지난 달'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 통계 - Progress Bar */}
          {mealAnalysis.categoryStats && (
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
            </View>
          )}
        </View>
      </View>
    );
  };

  const stats = selectedPeriod === 'month' ? monthlyStats : lastMonthStats;
  const hasNoStats = stats?.total === 0;

  return (
    <View style={styles.container}>
      <Header 
        title="그랜비"
        showMenuButton={true}
        showBackButton={false}
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
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
        {/* 월간/전월 요약 선택 */}
        <View style={styles.periodSelectorCard}>
          <View style={styles.periodSelector}>
            <TouchableOpacity 
              style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedPeriod('month');
                if (elderlyId && !monthlyStats) {
                  loadStatsForElderly(elderlyId, 'month');
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
                if (elderlyId && !lastMonthStats) {
                  loadStatsForElderly(elderlyId, 'last_month');
                }
              }}
            >
              <Text style={[styles.periodButtonText, selectedPeriod === 'last_month' && styles.periodButtonTextActive]}>
                지난 달
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* 요약 통계 */}
          {stats && !hasNoStats && (
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

        {/* 건강관리 카드 섹션 - 요약 통계 바로 다음에 항상 표시 */}
        {renderHealthCards()}

        {/* 데이터 로딩 중 */}
        {isLoadingStats && !stats && (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#34B79F" />
            <Text style={styles.emptyStateText}>통계 데이터를 불러오는 중...</Text>
          </View>
        )}

        {/* 통계 데이터가 없을 때 */}
        {stats && hasNoStats && (
          <View style={styles.emptyStatsCard}>
            <Image 
              source={require('../../assets/haru-error.png')} 
              style={styles.emptyStatsImage}
              resizeMode="contain"
            />
            {(() => {
              const hasAnyTodos = allTodos.length > 0;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
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
              
              return (
                <>
                  <Text style={styles.emptyStatsText}>할일을 등록해주세요!</Text>
                  <Text style={styles.emptyStatsSubText}>
                    어르신의 할일을 등록하시면{'\n'}통계와 조언을 제공해드릴게요
                  </Text>
                </>
              );
            })()}
            {elderlyId && (
              <TouchableOpacity
                style={styles.addTodoButton}
                onPress={() => router.push(`/guardian-todo-add?elderlyId=${elderlyId}&elderlyName=${encodeURIComponent(elderlyName || '어르신')}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.addTodoButtonText}>할일 등록하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 통계 데이터가 있을 때 */}
        {stats && !hasNoStats && (
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
                
                // 완료된 항목이 없을 때
                if (stats.completed === 0 && stats.total > 0) {
                  return (
                    <View style={styles.statusAdviceItemWithImage}>
                      <Image 
                        source={require('../../assets/haru-statistic-nodata.png')} 
                        style={styles.statusAdviceImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.statusAdviceTextWithImage}>
                        완료된 할일이 생기면{'\n'}맞춤 조언을 제공해드릴게요
                      </Text>
                    </View>
                  );
                }
                
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
        )}

        {/* 하단 여백 */}
        <View style={{ height: 20 }} />
      </ScrollView>

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
  },
  periodSelectorCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#34B79F',
    fontWeight: '600',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999999',
  },
  emptyStatsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStatsImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  emptyStatsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStatsSubText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addTodoButton: {
    backgroundColor: '#34B79F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addTodoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  healthStatusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  healthStatusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 20,
  },
  statusSection: {
    marginBottom: 20,
  },
  statusSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  statusItem: {
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginLeft: 8,
    flex: 1,
  },
  statusRecommendation: {
    fontSize: 13,
    color: '#666666',
    marginLeft: 24,
    marginTop: 4,
  },
  statusGoodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusGoodText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 8,
    flex: 1,
  },
  statusAdviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusAdviceText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  statusAdviceItemWithImage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusAdviceImage: {
    width: 80,
    height: 80,
    marginRight: 16,
  },
  statusAdviceTextWithImage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
    lineHeight: 22,
    textAlign: 'left',
  },
  // 건강관리 카드 스타일
  healthCardsContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginLeft: 8,
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
  healthCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
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
});
