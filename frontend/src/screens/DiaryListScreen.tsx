/**
 * 다이어리 허브 화면
 * 필터, 인사이트, 일기 목록을 한 화면에 통합
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getDiaries, Diary } from '../api/diary';
import { useAuthStore } from '../store/authStore';
import { useSelectedElderlyStore } from '../store/selectedElderlyStore';
import * as connectionsApi from '../api/connections';
import { BottomNavigationBar, Header } from '../components';
import { DiaryFilters } from '../components/DiaryFilters';
import { DiaryInsights } from '../components/DiaryInsights';
import { Colors } from '../constants/Colors';
import { useAlert } from '../components/GlobalAlertProvider';

export const DiaryListScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { selectedElderlyId, selectedElderlyName, setSelectedElderly } = useSelectedElderlyStore();
  const { show } = useAlert();

  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [allDiaries, setAllDiaries] = useState<Diary[]>([]); // 모든 다이어리 (월 필터 없이)
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 필터 상태
  const currentDate = new Date();
  const [month, setMonth] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedElderlyIds, setSelectedElderlyIds] = useState<string[]>([]);

  // 보호자용 상태
  const [connectedElderly, setConnectedElderly] = useState<any[]>([]);
  const [showElderlySelector, setShowElderlySelector] = useState(false);
  
  // 어르신용 상태: 연결된 보호자 목록
  const [connectedCaregivers, setConnectedCaregivers] = useState<any[]>([]);

  const flatListRef = useRef<FlatList<Diary>>(null);

  // 무한 스크롤
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  /**
   * 연결된 어르신 목록 로드 (보호자용)
   */
  const loadConnectedElderly = async () => {
    try {
      const elderly = await connectionsApi.getConnectedElderly();
      setConnectedElderly(elderly);
      
      // 전역 스토어에서 선택된 어르신이 없으면 첫 번째 어르신을 기본 선택
      if (elderly.length > 0 && !selectedElderlyId) {
        setSelectedElderly(elderly[0].user_id, elderly[0].name);
      }
    } catch (error) {
      console.error('연결된 어르신 로드 실패:', error);
    }
  };

  /**
   * 연결된 보호자 목록 로드 (어르신용)
   */
  const loadConnectedCaregivers = async () => {
    try {
      const connections = await connectionsApi.getConnections();
      // 연결된 보호자 정보 추출 (active 상태만)
      const caregivers = connections.active.map(conn => ({
        user_id: conn.user_id,
        name: conn.name,
      }));
      setConnectedCaregivers(caregivers);
    } catch (error) {
      console.error('연결된 보호자 로드 실패:', error);
    }
  };

  /**
   * 모든 다이어리 로드 
   */
  const loadAllDiaries = async () => {
    try {
      const params: any = {
        limit: 1000, // 충분히 큰 수
        skip: 0,
      };
      if (user?.role === 'caregiver' && selectedElderlyId) {
        params.elderly_id = selectedElderlyId;
      }
      
      const data = await getDiaries(params);
      const sortedData = [...data].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      setAllDiaries(sortedData);
    } catch (error: any) {
      console.error('전체 다이어리 로드 실패:', error);
    }
  };

  /**
   * 다이어리 목록 로드 (선택된 월만)
   */
  const loadDiaries = async (reset = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setPage(0);
        setHasMore(true);
      }
      
      // 월 필터 적용
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;
      const endDate = `${year}-${monthNum}-${new Date(parseInt(year), parseInt(monthNum), 0).getDate()}`;
      
      // 보호자인 경우 선택된 어르신의 다이어리 조회
      const params: any = {
        start_date: startDate,
        end_date: endDate,
        limit: reset ? 100 : limit * (page + 1), // 월별 조회 시 최대 100개까지 가져오기
        skip: 0,
      };
      if (user?.role === 'caregiver' && selectedElderlyId) {
        params.elderly_id = selectedElderlyId;
      }
      
      const data = await getDiaries(params);
      
      // 최신순 정렬 (날짜 내림차순)
      const sortedData = [...data].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      if (reset) {
        setDiaries(sortedData);
      } else {
        setDiaries(prev => [...prev, ...sortedData].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }));
      }
      
      if (data.length < limit) {
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('다이어리 로드 실패:', error);
      show('오류', error.response?.data?.detail || '일기를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * 필터링된 다이어리 목록 (리스트 탭용)
   */
  const filteredListDiaries = useMemo(() => {
    let filtered = [...diaries];

    // 월 필터 적용
    // if (month) {
    //   filtered = filtered.filter(diary => {
    //     const diaryMonth = diary.date.substring(0, 7); // YYYY-MM
    //     return diaryMonth === month;
    //   });
    // }

    // 감정 필터
    if (selectedMoods.length > 0) {
      filtered = filtered.filter(diary => diary.mood && selectedMoods.includes(diary.mood));
    }

    // 어르신 필터 (보호자용)
    if (selectedElderlyIds.length > 0 && user?.role === 'caregiver') {
      filtered = filtered.filter(diary => selectedElderlyIds.includes(diary.author_id));
    }

    // 최신순 정렬 (날짜 내림차순)
    filtered.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return filtered;
  }, [diaries, selectedMoods, selectedElderlyIds, user?.role]);

  /**
   * 월별로 그룹화된 데이터 생성 (캘린더 탭용)
   */
  const groupedDiaries = useMemo(() => {
    let filtered = [...diaries];

    // // 월 필터 적용
    // if (month) {
    //   filtered = filtered.filter(diary => {
    //     const diaryMonth = diary.date.substring(0, 7); // YYYY-MM
    //     return diaryMonth === month;
    //   });
    // }

    // 감정 필터
    if (selectedMoods.length > 0) {
      filtered = filtered.filter(diary => diary.mood && selectedMoods.includes(diary.mood));
    }

    // 어르신 필터 (보호자용)
    if (selectedElderlyIds.length > 0 && user?.role === 'caregiver') {
      filtered = filtered.filter(diary => selectedElderlyIds.includes(diary.author_id));
    }

    // 최신순 정렬 (날짜 내림차순)
    filtered.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // 월별 그룹화
    const grouped: Record<string, Diary[]> = {};
    filtered.forEach(diary => {
      const monthKey = diary.date.substring(0, 7); // YYYY-MM
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(diary);
    });

    // 섹션 배열로 변환 (최신 월부터)
    const sections = Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a)) // 최신 월부터
      .map(monthKey => {
        const [year, month] = monthKey.split('-');
        return {
          title: `${year}년 ${parseInt(month)}월`,
          data: grouped[monthKey],
          monthKey,
        };
      });

    return sections;
  }, [diaries, selectedMoods, selectedElderlyIds, user?.role]);

  /**
   * 월 변경 시 다이어리 다시 로드
   */
  useEffect(() => {
    if (activeTab === 'list') {
      loadDiaries(true);
    } else if (activeTab === 'calendar') {
      // 월간 리포트 탭에서도 월 변경 시 데이터 다시 로드
      setIsReportLoading(true);
      loadDiaries(true).finally(() => {
        // 약간의 지연을 두어 로딩 상태를 명확히 표시
        setTimeout(() => {
          setIsReportLoading(false);
        }, 300);
      });
    }
  }, [month, selectedElderlyId, activeTab]);

  /**
   * 새로고침
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDiaries(true);
  };

  /**
   * 더 불러오기
   */
  const loadMore = () => {
    if (!isLoading && hasMore) {
      setPage(prev => prev + 1);
      loadDiaries(false);
    }
  };


  /**
   * 역할에 따라 연결된 사용자 목록 로드
   */
  useEffect(() => {
    if (user?.role === 'caregiver') {
      loadConnectedElderly();
    } else if (user?.role === 'elderly') {
      loadConnectedCaregivers();
    }
  }, [user]);

  /**
   * 어르신 선택 변경 시 전체 다이어리 다시 로드
   */
  useEffect(() => {
    if (selectedElderlyId) {
      loadAllDiaries();
    }
  }, [selectedElderlyId]);

  /**
   * 화면 포커스 시 데이터 새로고침
   * 일기 작성/삭제 후 돌아왔을 때 자동으로 목록 갱신
   * 월 필터는 캘린더와 독립적으로 관리됨
   */
  useFocusEffect(
    useCallback(() => {
      // 전체 다이어리 로드 (availableMonths 계산용)
      loadAllDiaries();
      // 선택된 월의 다이어리 로드
      loadDiaries(true);
    }, [selectedElderlyId, user, month])
  );

  /**
   * 어르신 선택
   */
  const handleSelectElderly = (elderly: any) => {
    setSelectedElderly(elderly.user_id, elderly.name);
    setShowElderlySelector(false);
  };

  /**
   * 기분 아이콘 정보 가져오기
   */
  const getMoodIcon = (mood?: string | null): { name: string; color: string } | null => {
    const moodMap: Record<string, { name: string; color: string }> = {
      happy: { name: 'happy', color: '#FFD700' },
      excited: { name: 'sparkles', color: '#FF6B6B' },
      calm: { name: 'leaf', color: '#4ECDC4' },
      sad: { name: 'sad', color: '#5499C7' },
      angry: { name: 'thunderstorm', color: '#E74C3C' },
      tired: { name: 'moon', color: '#9B59B6' },
    };
    return mood && moodMap[mood] ? moodMap[mood] : null;
  };

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
   * 한국 시간으로 포맷팅 (created_at이 KST로 저장되어 있으므로)
   */
  const formatKSTDateTime = (dateString: string): string => {
    try {
      // DB에서 저장된 시간은 한국 시간(KST)인데 시간대 정보가 없음
      // ISO 형식인 경우 시간대 정보 추가
      let date: Date;
      
      if (dateString.includes('T')) {
        // ISO 형식이면 시간대 정보 확인
        // 시간대 정보가 없으면 (Z, +, -가 없으면) 한국 시간대(+09:00)로 추가
        if (!dateString.includes('Z') && !dateString.match(/[+-]\d{2}:\d{2}$/)) {
          // 마이크로초 제거 후 한국 시간대 추가
          dateString = dateString.replace(/\.\d+/, '') + '+09:00';
        }
        date = new Date(dateString);
      } else {
        // 다른 형식이면 그대로 파싱
        date = new Date(dateString);
      }
      
      // 유효하지 않은 날짜인 경우 빈 문자열 반환
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // 한국 시간대로 표시
      return date.toLocaleString('ko-KR', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
      });
    } catch (error) {
      console.error('날짜 포맷팅 오류:', error);
      return '';
    }
  };

  /**
   * 작성자 이름 가져오기
   */
  const getAuthorName = (diary: Diary): string => {
    // 현재 사용자가 작성자인 경우
    if (diary.author_id === user?.user_id) {
      return user.name;
    }
    
    // 보호자인 경우: 연결된 어르신 중에서 작성자를 찾기
    if (user?.role === 'caregiver') {
      const author = connectedElderly.find(elderly => elderly.user_id === diary.author_id);
      if (author) {
        return author.name;
      }
    }
    
    // 어르신인 경우: 연결된 보호자 중에서 작성자를 찾기
    if (user?.role === 'elderly') {
      const author = connectedCaregivers.find(caregiver => caregiver.user_id === diary.author_id);
      if (author) {
        return author.name;
      }
    }
    
    // 찾을 수 없는 경우 빈 문자열 반환
    return '';
  };

  /**
   * 작성자 배지 정보 가져오기
   */
  const getAuthorBadgeInfo = (diary: Diary) => {
    if (diary.is_auto_generated) {
      return {
        icon: 'robot' as const,
        iconFamily: 'MaterialCommunityIcons' as const,
        text: 'AI 자동 생성',
        color: '#9C27B0',
        bgColor: '#F3E5F5',
      };
    }
    
    const authorName = getAuthorName(diary);
    
    if (diary.author_type === 'caregiver') {
      return {
        icon: 'medical' as const,
        iconFamily: 'Ionicons' as const,
        text: authorName ? `${authorName}님 작성` : '보호자 작성',
        color: '#2196F3',
        bgColor: '#E3F2FD',
      };
    }
    
    if (diary.author_type === 'elderly') {
      return {
        icon: 'pencil' as const,
        iconFamily: 'Ionicons' as const,
        text: authorName ? `${authorName}님 작성` : '어르신님 작성',
        color: '#4CAF50',
        bgColor: '#E8F5E9',
      };
    }
    
    return null;
  };

  /**
   * 다이어리 아이템 렌더링
   */
  const renderDiaryItem = ({ item }: { item: Diary }) => {
    const contentPreview = item.content.length > 100 
      ? item.content.substring(0, 100) + '...'
      : item.content;

    const authorBadge = getAuthorBadgeInfo(item);
    const moodInfo = getMoodIcon(item.mood);
    const borderColor = moodInfo ? moodInfo.color : '#9C27B0';
    
    // 디버깅용 (개발 중에만)
    if (__DEV__) {
      console.log('Diary item:', {
        diary_id: item.diary_id,
        photos: item.photos,
        photosLength: item.photos?.length,
        comment_count: item.comment_count,
      });
    }

    return (
      <TouchableOpacity
        style={[
          styles.diaryCard,
          { borderLeftColor: borderColor }
        ]}
        onPress={() => router.push(`/diary-detail?diaryId=${item.diary_id}`)}
      >
        {/* 날짜 헤더 */}
        <View style={styles.dateHeader}>
          <View style={styles.dateTitleRow}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            <Text style={styles.dayText}>({formatDayOfWeek(item.date)})</Text>
          </View>
          {item.mood && getMoodIcon(item.mood) && (
            <Ionicons 
              name={getMoodIcon(item.mood)!.name as any} 
              size={24} 
              color={getMoodIcon(item.mood)!.color} 
            />
          )}
        </View>

        {/* 제목 */}
        {item.title && (
          <Text style={styles.titleText}>{item.title}</Text>
        )}

        {/* 작성자 정보 */}
        <View style={styles.authorInfo}>
          {authorBadge && (
            <View style={[styles.authorBadge, { backgroundColor: authorBadge.bgColor }]}>
              {authorBadge.iconFamily === 'MaterialCommunityIcons' ? (
                <MaterialCommunityIcons 
                  name={authorBadge.icon as any} 
                  size={14} 
                  color={authorBadge.color} 
                />
              ) : (
                <Ionicons 
                  name={authorBadge.icon as any} 
                  size={14} 
                  color={authorBadge.color} 
                />
              )}
              <Text style={[styles.authorBadgeText, { color: authorBadge.color }]}>
                {authorBadge.text}
              </Text>
            </View>
          )}
          {item.status === 'draft' && (
            <View style={styles.draftBadge}>
              <Ionicons name="document-text" size={12} color="#F57C00" />
              <Text style={styles.draftText}>임시저장</Text>
            </View>
          )}
        </View>

        {/* 내용 미리보기 */}
        <Text style={styles.contentPreview}>{contentPreview}</Text>

        {/* 작성 시간 및 댓글 개수, 사진 개수 */}
        <View style={styles.footerRow}>
          <Text style={styles.timestamp}>
            {formatKSTDateTime(item.created_at)}
          </Text>
          {(item.photos && item.photos.length > 0) || (item.comment_count !== undefined && item.comment_count > 0) ? (
            <View style={styles.badgeContainer}>
              {/* 사진 배지 */}
              {item.photos && item.photos.length > 0 && (
                <View style={styles.photoCountBadge}>
                  <Ionicons name="camera-outline" size={14} color="#FF9500" />
                  <Text style={styles.photoCountText}>{item.photos.length}</Text>
                </View>
              )}
              {/* 댓글 배지 */}
              {item.comment_count !== undefined && item.comment_count > 0 && (
                <View style={styles.commentCountBadge}>
                  <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
                  <Text style={styles.commentCountText}>{item.comment_count}</Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * 섹션 헤더 렌더링 (캘린더 탭용)
   */
  const renderSectionHeader = ({ section }: { section: { title: string; data: Diary[] } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      <Text style={styles.sectionHeaderCount}>{section.data.length}개</Text>
    </View>
  );

  /**
   * 캘린더 탭용 다이어리 아이템 렌더링 (간소화: 제목, 감정 도트, 작성일)
   */
  const renderCalendarDiaryItem = ({ item }: { item: Diary }) => {
    const moodInfo = getMoodIcon(item.mood);
    const dateObj = new Date(item.date);
    const day = dateObj.getDate();

    return (
      <TouchableOpacity
        style={styles.diaryItem}
        onPress={() => router.push(`/diary-detail?diaryId=${item.diary_id}`)}
        activeOpacity={0.7}
      >
        {/* 감정 도트 */}
        <View style={[
          styles.moodDot,
          moodInfo && { backgroundColor: moodInfo.color }
        ]} />

        {/* 제목 및 작성일 */}
        <View style={styles.diaryItemContent}>
          <Text style={styles.diaryItemTitle} numberOfLines={1}>
            {item.title || '제목 없음'}
          </Text>
          <Text style={styles.diaryItemDate}>
            {day}일
          </Text>
        </View>

        {/* 화살표 */}
        <Ionicons name="chevron-forward" size={20} color={Colors.textDisabled} />
      </TouchableOpacity>
    );
  };

  /**
   * 빈 상태 렌더링
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="book-outline" size={64} color="#CCCCCC" style={{ marginBottom: 16 }} />
      <Text style={styles.emptyTitle}>작성된 일기가 없습니다</Text>
      <Text style={styles.emptyDescription}>
        하루와 대화를 통해 일기를 작성하거나{'\n'}
        직접 일기를 작성해보세요
      </Text>
    </View>
  );

  /**
   * 인사이트 클릭 핸들러 (월간리포트 탭용 - 필터 적용 안함)
   */
  const handleInsightPress = (type: string) => {
    // 월간리포트에서는 필터 적용하지 않음
  };

  // 월간 일기 목록 (인사이트용)
  const monthlyDiaries = diaries.filter(diary => {
    const diaryMonth = diary.date.substring(0, 7);
    return diaryMonth === month;
  });

  const reportAllDiaries = useMemo(() => {
    return allDiaries.filter(diary => diary.user_id === diary.author_id);
  }, [allDiaries]);

  const reportMonthlyDiaries = useMemo(() => {
    return monthlyDiaries.filter(diary => diary.user_id === diary.author_id);
  }, [monthlyDiaries]);

  // 월간 리포트 탭에서 월 변경 시 로딩 상태
  const [isReportLoading, setIsReportLoading] = useState(false);

  /**
   * 다이어리가 있는 월 목록 계산 (YYYY-MM 형식)
   * allDiaries에서 계산 (전체 다이어리 기준)
   */
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    allDiaries.forEach(diary => {
      const diaryMonth = diary.date.substring(0, 7); // YYYY-MM
      monthSet.add(diaryMonth);
    });
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a)); // 최신 월부터
  }, [allDiaries]);

  const reportAvailableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    reportAllDiaries.forEach(diary => {
      const diaryMonth = diary.date.substring(0, 7);
      monthSet.add(diaryMonth);
    });
    const months = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
    if (!months.includes(month)) {
      months.push(month);
      months.sort((a, b) => b.localeCompare(a));
    }
    return months;
  }, [reportAllDiaries, month]);

  if (isLoading && !isRefreshing && diaries.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>일기를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Header
        title={
          user?.role === 'caregiver' && selectedElderlyName
            ? `${selectedElderlyName}님의 일기장`
            : '나의 일기장'
        }
        showMenuButton={true}
        rightButton={
          user?.role === 'caregiver' && connectedElderly.length > 0 ? (
            <TouchableOpacity
              onPress={() => setShowElderlySelector(true)}
              style={styles.elderlySelectButton}
            >
              <Ionicons name="person-outline" size={20} color="#333333" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* 어르신 선택 모달 */}
      <Modal
        visible={showElderlySelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowElderlySelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>어르신 선택</Text>
              <TouchableOpacity 
                onPress={() => setShowElderlySelector(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={28} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.elderlyList}>
              {connectedElderly.map((elderly) => (
                <TouchableOpacity
                  key={elderly.user_id}
                  style={[
                    styles.elderlyItem,
                    selectedElderlyId === elderly.user_id && styles.selectedElderlyItem
                  ]}
                  onPress={() => handleSelectElderly(elderly)}
                >
                  <Text style={styles.elderlyName}>
                    {elderly.name}
                  </Text>
                  {selectedElderlyId === elderly.user_id && (
                    <Ionicons name="checkmark" size={28} color="#34B79F" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 탭 메뉴 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.activeTab]}
          onPress={() => setActiveTab('list')}
        >
          <Ionicons 
            name="list-outline" 
            size={20} 
            color={activeTab === 'list' ? '#FFFFFF' : '#666666'} 
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>
            목록
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'calendar' && styles.activeTab]}
          onPress={() => setActiveTab('calendar')}
        >
          <Ionicons 
            name="stats-chart-outline" 
            size={20} 
            color={activeTab === 'calendar' ? '#FFFFFF' : '#666666'} 
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.activeTabText]}>
            월간리포트
          </Text>
        </TouchableOpacity>
      </View>

      {/* 컨텐츠 영역 */}
      {activeTab === 'list' ? (
        /* 리스트 탭: 필터 + 다이어리 목록 */
        <FlatList
          ref={flatListRef}
          data={filteredListDiaries}
          renderItem={renderDiaryItem}
          keyExtractor={(item) => item.diary_id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <DiaryFilters
              month={month}
              selectedMoods={selectedMoods}
              selectedTags={selectedTags}
              selectedElderlyIds={selectedElderlyIds}
              onMonthChange={setMonth}
              onMoodsChange={setSelectedMoods}
              onTagsChange={setSelectedTags}
              onElderlyIdsChange={setSelectedElderlyIds}
              connectedElderly={connectedElderly}
              availableMonths={availableMonths}
            />
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          // 콘텐츠가 부족해도 스크롤 허용 (bounce 효과)
          bounces={true}
          alwaysBounceVertical={false}
        />
      ) : (
        /* 월간리포트 탭: 인사이트만 표시 */
        <ScrollView
          contentContainerStyle={
            isReportLoading 
              ? styles.reportLoadingContent 
              : styles.reportContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {isReportLoading ? (
            <View style={styles.reportLoadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>월간 리포트를 불러오는 중...</Text>
            </View>
          ) : (
            <DiaryInsights
              month={month}
              diaries={reportMonthlyDiaries}
              allDiaries={reportAllDiaries}
              onInsightPress={handleInsightPress}
              onMonthChange={setMonth}
              availableMonths={reportAvailableMonths}
            />
          )}
        </ScrollView>
      )}

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />

      {/* 일기 작성 플로팅 버튼 (리스트 탭만) */}
      {activeTab === 'list' && (
        <TouchableOpacity
          style={[styles.floatingButton, { bottom: insets.bottom + 90 }]}
          onPress={() => router.push('/diary-write')}
        >
          <Ionicons name="create" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  reportLoadingContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  reportLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
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
    flexDirection: 'row',
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
  elderlySelectButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elderlyList: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  elderlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedElderlyItem: {
    backgroundColor: '#E8F5F2',
    borderColor: '#34B79F',
  },
  elderlyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  listContent: {
    padding: 16,
    paddingBottom: 0,
  },
  reportContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    marginTop: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionHeaderCount: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  diaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  moodDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.textDisabled,
  },
  diaryItemContent: {
    flex: 1,
  },
  diaryItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  diaryItemDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  diaryCard: {
    backgroundColor: '#FFF9F5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
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
    color: Colors.text,
    marginRight: 8,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  authorBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  draftText: {
    fontSize: 12,
    color: '#F57C00',
    fontWeight: '600',
  },
  contentPreview: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
    marginBottom: 12,
  },
  timestamp: {
    fontSize: 13,
    color: Colors.textLight,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
  },
  photoCountText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
  },
  commentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
  },
  commentCountText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default DiaryListScreen;

