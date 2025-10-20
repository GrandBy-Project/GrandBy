/**
 * 다이어리 리스트 화면
 * 날짜별로 작성된 일기 목록 표시 + 캘린더 뷰
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { getDiaries, Diary } from '../api/diary';
import { useAuthStore } from '../store/authStore';

export const DiaryListScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  /**
   * 다이어리 목록 로드
   */
  const loadDiaries = async () => {
    try {
      setIsLoading(true);
      const data = await getDiaries({ limit: 100 });
      setDiaries(data);
    } catch (error: any) {
      console.error('다이어리 로드 실패:', error);
      Alert.alert(
        '오류',
        error.response?.data?.detail || '일기를 불러오는데 실패했습니다.',
        [{ text: '확인' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 새로고침
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDiaries();
    setIsRefreshing(false);
  };

  /**
   * 화면 포커스 시 데이터 새로고침
   * 일기 작성/삭제 후 돌아왔을 때 자동으로 목록 갱신
   */
  useFocusEffect(
    useCallback(() => {
      loadDiaries();
    }, [])
  );

  /**
   * 날짜 포맷팅 (YYYY-MM-DD → YYYY년 MM월 DD일)
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  /**
   * 요일 표시
   */
  const formatDayOfWeek = (dateString: string): string => {
    const date = new Date(dateString);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  };

  /**
   * 작성자 타입 한글 표시
   */
  const getAuthorTypeText = (authorType: string): string => {
    switch (authorType) {
      case 'elderly':
        return '어르신 작성';
      case 'caregiver':
        return '보호자 작성';
      case 'ai':
        return 'AI 자동 생성';
      default:
        return '';
    }
  };

  /**
   * 기분 이모지 가져오기
   */
  const getMoodEmoji = (mood?: string | null): string => {
    const moodMap: Record<string, string> = {
      happy: '😊',
      excited: '🤗',
      calm: '😌',
      sad: '😢',
      angry: '😠',
      tired: '😴',
    };
    return mood ? moodMap[mood] || '' : '';
  };

  /**
   * 다이어리 아이템 렌더링
   */
  const renderDiaryItem = ({ item }: { item: Diary }) => {
    const contentPreview = item.content.length > 100 
      ? item.content.substring(0, 100) + '...'
      : item.content;

    return (
      <TouchableOpacity
        style={styles.diaryCard}
        onPress={() => router.push(`/diary-detail?diaryId=${item.diary_id}`)}
      >
        {/* 날짜 헤더 */}
        <View style={styles.dateHeader}>
          <View style={styles.dateTitleRow}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            <Text style={styles.dayText}>({formatDayOfWeek(item.date)})</Text>
          </View>
          {item.mood && (
            <Text style={styles.moodEmoji}>{getMoodEmoji(item.mood)}</Text>
          )}
        </View>

        {/* 제목 */}
        {item.title && (
          <Text style={styles.titleText}>{item.title}</Text>
        )}

        {/* 작성자 정보 */}
        <View style={styles.authorInfo}>
          <Text style={styles.authorType}>
            {item.is_auto_generated ? '🤖 ' : '✏️ '}
            {getAuthorTypeText(item.author_type)}
          </Text>
          {item.status === 'draft' && (
            <View style={styles.draftBadge}>
              <Text style={styles.draftText}>임시저장</Text>
            </View>
          )}
        </View>

        {/* 내용 미리보기 */}
        <Text style={styles.contentPreview}>{contentPreview}</Text>

        {/* 작성 시간 */}
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  /**
   * 빈 상태 렌더링
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📖</Text>
      <Text style={styles.emptyTitle}>작성된 일기가 없습니다</Text>
      <Text style={styles.emptyDescription}>
        AI와의 통화를 통해 자동으로 일기가 생성되거나{'\n'}
        직접 일기를 작성해보세요
      </Text>
    </View>
  );

  /**
   * 캘린더에 표시할 마커 데이터 생성
   */
  const getMarkedDates = () => {
    const marked: any = {};
    
    // 일기가 있는 날짜는 녹색 점으로만 표시
    diaries.forEach((diary) => {
      const dateKey = diary.date;
      
      marked[dateKey] = {
        marked: true,
        dotColor: '#34B79F',
      };
    });

    // 선택된 날짜에 녹색 배경 표시
    if (selectedDate) {
      if (marked[selectedDate]) {
        // 이미 일기가 있는 날짜를 선택한 경우 (점 + 배경)
        marked[selectedDate] = {
          ...marked[selectedDate],
          selected: true,
          selectedColor: '#34B79F',
          selectedTextColor: '#FFFFFF',
        };
      } else {
        // 일기가 없는 날짜를 선택한 경우 (배경만)
        marked[selectedDate] = {
          selected: true,
          selectedColor: '#34B79F',
          selectedTextColor: '#FFFFFF',
        };
      }
    }

    return marked;
  };

  /**
   * 캘린더에서 날짜 선택 시
   */
  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  /**
   * 캘린더 뷰 렌더링
   */
  const renderCalendarView = () => {
    return (
      <ScrollView 
        style={styles.calendarContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#34B79F']}
            tintColor="#34B79F"
          />
        }
      >
        <Calendar
          markedDates={getMarkedDates()}
          onDayPress={handleDayPress}
          theme={{
            backgroundColor: '#FFFFFF',
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
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 14,
          }}
          style={styles.calendar}
        />

        {/* 선택한 날짜의 일기 */}
        <View style={styles.recentDiariesSection}>
          {selectedDate ? (
            <>
              <Text style={styles.sectionTitle}>
                📅 {formatDate(selectedDate)} ({formatDayOfWeek(selectedDate)})
              </Text>
              {diaries.filter(diary => diary.date === selectedDate).length > 0 ? (
                diaries
                  .filter(diary => diary.date === selectedDate)
                  .map((diary) => (
                    <TouchableOpacity
                      key={diary.diary_id}
                      style={styles.miniDiaryCard}
                      onPress={() => router.push(`/diary-detail?diaryId=${diary.diary_id}`)}
                    >
                      <View style={styles.miniDiaryHeader}>
                        <Text style={styles.miniDiaryDate}>
                          {formatDate(diary.date)} ({formatDayOfWeek(diary.date)})
                        </Text>
                        {diary.mood && (
                          <Text style={styles.miniMoodEmoji}>{getMoodEmoji(diary.mood)}</Text>
                        )}
                      </View>
                      {diary.title && (
                        <Text style={styles.miniDiaryTitle} numberOfLines={1}>
                          {diary.title}
                        </Text>
                      )}
                      <Text style={styles.miniDiaryContent} numberOfLines={2}>
                        {diary.content}
                      </Text>
                    </TouchableOpacity>
                  ))
              ) : (
                <View style={styles.emptySelectedDate}>
                  <Text style={styles.emptySelectedDateIcon}>📖</Text>
                  <Text style={styles.emptySelectedDateText}>
                    작성된 일기가 없습니다
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.selectDatePrompt}>
              <Text style={styles.selectDateIcon}>👆</Text>
              <Text style={styles.selectDateText}>
                캘린더에서 날짜를 선택하면{'\n'}해당 날짜의 일기를 확인할 수 있습니다
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#34B79F" />
        <Text style={styles.loadingText}>일기를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>나의 일기장</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 탭 메뉴 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.activeTab]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>
            📋 목록
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'calendar' && styles.activeTab]}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.activeTabText]}>
            📅 캘린더
          </Text>
        </TouchableOpacity>
      </View>

      {/* 컨텐츠 영역 */}
      {activeTab === 'list' ? (
        <FlatList
          data={diaries}
          renderItem={renderDiaryItem}
          keyExtractor={(item) => item.diary_id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#34B79F']}
              tintColor="#34B79F"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderCalendarView()
      )}

      {/* 일기 작성 플로팅 버튼 */}
      <TouchableOpacity
        style={[styles.floatingButton, { bottom: insets.bottom + 24 }]}
        onPress={() => router.push('/diary-write')}
      >
        <Text style={styles.floatingButtonIcon}>✏️</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
  },
  placeholder: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#34B79F',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  calendar: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  recentDiariesSection: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
  },
  miniDiaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  miniDiaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniDiaryDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34B79F',
  },
  miniMoodEmoji: {
    fontSize: 20,
  },
  miniDiaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  miniDiaryContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  floatingButton: {
    position: 'absolute',
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#34B79F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonIcon: {
    fontSize: 28,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  diaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginRight: 8,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#34B79F',
  },
  moodEmoji: {
    fontSize: 24,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorType: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
  },
  draftBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  draftText: {
    fontSize: 12,
    color: '#F57C00',
    fontWeight: '600',
  },
  contentPreview: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    marginBottom: 12,
  },
  timestamp: {
    fontSize: 13,
    color: '#999999',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySelectedDate: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginTop: 8,
  },
  emptySelectedDateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptySelectedDateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  selectDatePrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  selectDateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  selectDateText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default DiaryListScreen;

