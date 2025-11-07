/**
 * 어르신 통합 캘린더 화면 (주간 달력 + 일정 추가)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  Switch,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header, BottomNavigationBar, TimePicker, CategorySelector } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { TodoItem, getTodosByRange, createTodo, deleteTodo, completeTodo, cancelTodo } from '../api/todo';
import { getDiaries, Diary } from '../api/diary';
import { useAuthStore } from '../store/authStore';
import { useSelectedElderlyStore } from '../store/selectedElderlyStore';
import * as connectionsApi from '../api/connections';
import { Colors } from '../constants/Colors';
import { useFontSizeStore } from '../store/fontSizeStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAlert } from '../components/GlobalAlertProvider';
import {
  formatDateString,
  formatDateWithWeekday,
  formatDateDisplay,
  formatTimeKorean,
  formatHHMMToDisplay,
  formatTimeToHHMM,
  isToday,
  isSameDate,
} from '../utils/dateUtils';
import {
  TODO_CATEGORIES,
  getCategoryName,
  getCategoryIcon,
  getCategoryColor,
} from '../constants/TodoCategories';

export const CalendarScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { selectedElderlyId, selectedElderlyName, setSelectedElderly } = useSelectedElderlyStore();
  const { fontSizeLevel } = useFontSizeStore();
  const { show } = useAlert();

  // 날짜 선택 상태
  const [selectedDay, setSelectedDay] = useState(new Date());

  // 현재 주 상태
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 날짜 스크롤 뷰 ref
  const dayScrollViewRef = useRef<ScrollView>(null);
  // 시간 선택 스크롤 뷰 ref
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // 월간/일간 뷰 상태
  const [isMonthlyView, setIsMonthlyView] = useState(false);

  // 필터 상태
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'schedule' | 'diary'>('all');

  // 년/월 피커 상태
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);


  // 날짜 선택 모달 상태
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 일정 추가 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    title: '',
    description: '',
    time: '', // HH:MM 형식
    date: '',
    category: '', // 카테고리
    isShared: false, // 공유 여부 (어르신 직접 등록 시 기본 비공유)
  });

  // 카테고리 옵션 (공통 상수 사용)
  const categories = TODO_CATEGORIES;
  // 시간 선택 상태 (시간, 분) - 기본값 12:00
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // 일정 상세 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<TodoItem | null>(null);

  // API 연동: TodoItem 타입 사용
  const [schedules, setSchedules] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 일기 상태
  const [diaries, setDiaries] = useState<Diary[]>([]);

  // 보호자용: 연결된 어르신 목록
  const [connectedElderly, setConnectedElderly] = useState<any[]>([]);
  
  // 어르신용: 연결된 보호자 목록
  const [connectedCaregivers, setConnectedCaregivers] = useState<any[]>([]);

  // 필터링된 일정 가져오기
  const getFilteredSchedules = (schedules: TodoItem[]) => {
    // 'diary' 필터일 때는 일정을 보여주지 않음
    if (selectedFilter === 'diary') {
      return [];
    }
    // 'all' 또는 'schedule' 필터일 때는 모든 일정 표시
    return schedules;
  };

  // 필터링된 일기 가져오기
  const getFilteredDiaries = (diaries: Diary[]) => {
    // 'schedule' 필터일 때는 일기를 보여주지 않음
    if (selectedFilter === 'schedule') {
      return [];
    }
    // 'all' 또는 'diary' 필터일 때는 모든 일기 표시
    return diaries;
  };

  // 일정 등록자 표시용 텍스트
  const getScheduleCreatorLabel = useCallback((schedule: TodoItem) => {
    if (schedule.creator_type === 'elderly') {
      return user?.role === 'elderly' ? '내가 등록' : '어르신이 등록';
    }
    if (schedule.creator_type === 'caregiver') {
      const isMySchedule = user?.role === 'caregiver' && schedule.creator_id === user?.user_id;
      if (isMySchedule) {
        return '내가 등록';
      }
      return '보호자가 등록';
    }
    if (schedule.creator_type === 'ai') {
      return 'AI가 추천';
    }
    return '등록자 정보 없음';
  }, [user?.role, user?.user_id]);

  const getScheduleShareLabel = useCallback((schedule: TodoItem) => {
    return schedule.is_shared_with_caregiver ? '보호자와 공유' : '나만 보기';
  }, []);

  const getScheduleIconName = useCallback((schedule: TodoItem) => {
    if (schedule.category === 'MEDICINE' || schedule.title?.includes('약')) {
      return 'medical';
    }
    if (schedule.category === 'HOSPITAL' || schedule.title?.includes('병원')) {
      return 'medical-outline';
    }
    if (schedule.category === 'EXERCISE' || schedule.title?.includes('운동')) {
      return 'fitness-outline';
    }
    if (schedule.category === 'MEAL' || schedule.title?.includes('식사')) {
      return 'restaurant-outline';
    }
    return 'calendar-outline';
  }, []);

  const canElderlyModifySchedule = useCallback((schedule: TodoItem) => {
    if (user?.role !== 'elderly') {
      return false;
    }

    if (schedule.creator_type === 'elderly') {
      return schedule.creator_id === user?.user_id;
    }

    if (schedule.creator_type === 'ai') {
      return true;
    }

    return false;
  }, [user?.role, user?.user_id]);

  const canCaregiverModifySchedule = useCallback((schedule: TodoItem) => {
    if (user?.role !== 'caregiver') {
      return false;
    }

    return schedule.creator_type === 'caregiver' && schedule.creator_id === user?.user_id;
  }, [user?.role, user?.user_id]);

  // 월간 달력용 마킹 데이터 생성
  const getMarkedDates = () => {
    const marked: any = {};
    const filteredSchedules = getFilteredSchedules(schedules);
    const filteredDiaries = getFilteredDiaries(diaries);

    // 날짜별로 일정과 일기를 그룹화
    const dateMap: Record<string, { hasSchedule: boolean; hasElderlyDiary: boolean; hasCaregiverDiary: boolean }> = {};

    filteredSchedules.forEach(schedule => {
      const date = schedule.due_date;
      if (!dateMap[date]) {
        dateMap[date] = { hasSchedule: false, hasElderlyDiary: false, hasCaregiverDiary: false };
      }
      dateMap[date].hasSchedule = true;
    });

    filteredDiaries.forEach(diary => {
      const date = diary.date;
      if (!dateMap[date]) {
        dateMap[date] = { hasSchedule: false, hasElderlyDiary: false, hasCaregiverDiary: false };
      }
      
      if (diary.author_type === 'elderly' || diary.author_type === 'ai') {
        dateMap[date].hasElderlyDiary = true;
      } else if (diary.author_type === 'caregiver') {
        dateMap[date].hasCaregiverDiary = true;
      }
    });

    // 각 날짜에 대해 마킹 생성 (최대 3개)
    Object.keys(dateMap).forEach(date => {
      const { hasSchedule, hasElderlyDiary, hasCaregiverDiary } = dateMap[date];
      const dots: any[] = [];

      // 일정이 있으면 주황색 점
      if (hasSchedule) {
        dots.push({
          key: 'schedule',
          color: '#FF9800', // 주황색
          selectedDotColor: Colors.textWhite
        });
      }

      // 어르신/AI 작성 일기가 있으면 초록색 점
      if (hasElderlyDiary) {
        dots.push({
          key: 'elderly_diary',
          color: '#4CAF50', // 초록색 (어르신 작성 배지 색상과 동일)
          selectedDotColor: Colors.textWhite
        });
      }

      // 보호자 작성 일기가 있으면 파란색 점
      if (hasCaregiverDiary) {
        dots.push({
          key: 'caregiver_diary',
          color: '#2196F3', // 파란색 (보호자 작성 배지 색상과 동일)
          selectedDotColor: Colors.textWhite
        });
      }

      marked[date] = {
        dots: dots,
        selected: false,
        selectedColor: Colors.primary
      };
    });

    // 선택된 날짜 표시
    const selectedDateStr = selectedDay.toISOString().split('T')[0];
    if (marked[selectedDateStr]) {
      marked[selectedDateStr].selected = true;
      marked[selectedDateStr].selectedColor = Colors.primary;
    } else {
      marked[selectedDateStr] = {
        selected: true,
        selectedColor: Colors.primary
      };
    }

    return marked;
  };

  // 시간 옵션 (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  // 분 옵션 (5분 단위 0-55)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  // 시간 형식 변환 함수 (HH:MM 형식 유지)
  const convertKoreanTimeToHHMM = (timeStr: string): string => {
    if (!timeStr || timeStr === '하루 종일') return '00:00';
    // 이미 HH:MM 형식이면 그대로 반환
    if (timeStr.includes(':')) return timeStr;
    return '00:00';
  };

  // convertHHMMToKoreanTime 함수는 formatTimeKorean으로 대체됨 (공통 유틸리티 사용)

  // 연결된 어르신 목록 로드 (보호자용)
  const loadConnectedElderly = async () => {
    if (user?.role !== 'caregiver') return;
    
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

  // 날짜 범위별 일정 조회
  const loadSchedules = async (baseDate?: Date) => {
    if (!user) {
      console.log('⚠️ 사용자 정보 없음, 조회 중단');
      return;
    }

    // 보호자인데 어르신이 선택되지 않은 경우
    if (user.role === 'caregiver' && !selectedElderlyId) {
      console.log('⚠️ 보호자: 어르신이 선택되지 않아 조회 중단');
      return;
    }

    // 토큰 확인
    const { TokenManager } = require('../api/client');
    const tokens = await TokenManager.getTokens();
    console.log('🔑 저장된 토큰 확인:', tokens ? '있음' : '없음');
    if (tokens) {
      console.log('🔑 Access Token:', tokens.access_token ? '존재' : '없음');
      console.log('🔑 Refresh Token:', tokens.refresh_token ? '존재' : '없음');
    }

    try {
      setIsLoading(true);

      // 기준 날짜 설정 (기본값: selectedDay)
      const referenceDate = baseDate || selectedDay;

      let startDate: Date;
      let endDate: Date;

      if (isMonthlyView) {
        // 월간 뷰일 때는 ±1개월 범위 조회
        const rangeMonths = 1;
        startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - rangeMonths, 1);
        endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + rangeMonths + 1, 0);
      } else {
        // 일간 뷰일 때는 기존 범위 유지 (selectedDay 기준으로 ±2주, +3주)
        startDate = new Date(referenceDate);
        startDate.setDate(startDate.getDate() - 14);
        endDate = new Date(referenceDate);
        endDate.setDate(endDate.getDate() + 21);
      }

      const startDateStr = formatDateString(startDate);
      const endDateStr = formatDateString(endDate);

      console.log(`📅 캘린더 일정 조회 시작`);
      console.log(`  - 사용자 ID: ${user.user_id}`);
      console.log(`  - 사용자 역할: ${user.role}`);
      console.log(`  - 어르신 ID: ${user.role === 'caregiver' ? selectedElderlyId : 'N/A'}`);
      console.log(`  - 날짜 범위: ${startDateStr} ~ ${endDateStr}`);
      console.log(`  - 월간 뷰: ${isMonthlyView}`);

      // 보호자인 경우 어르신 ID 전달
      if (user.role === 'caregiver' && selectedElderlyId) {
        // 보호자인 경우: 본인이 등록했거나 공유된 일정만 유지
        const todos = await getTodosByRange(startDateStr, endDateStr, selectedElderlyId);
        const filtered = todos.filter(todo =>
          todo.creator_type === 'caregiver' || todo.is_shared_with_caregiver === true
        );
        setSchedules(filtered);
      } else {
        // 어르신인 경우: 모든 일정 조회
        const todos = await getTodosByRange(startDateStr, endDateStr);
        setSchedules(todos);
      }
      
      return; // 이미 setSchedules 호출 완료
    } catch (error: any) {
      console.error('❌ 일정 조회 실패:', error);
      console.error('❌ 에러 상세:', JSON.stringify(error, null, 2));
      console.error('❌ 응답 데이터:', error.response?.data);
      console.error('❌ 응답 상태:', error.response?.status);
      show('오류', `일정을 불러오는데 실패했습니다.\n${error.response?.data?.detail || error.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 일기 조회
  const loadDiaries = async (baseDate?: Date) => {
    if (!user) {
      return;
    }

    try {
      // 기준 날짜 설정 (기본값: selectedDay)
      const referenceDate = baseDate || selectedDay;

      let startDate: Date;
      let endDate: Date;

      if (isMonthlyView) {
        // 월간 뷰일 때는 ±1개월 범위 조회
        const rangeMonths = 1;
        startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - rangeMonths, 1);
        endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + rangeMonths + 1, 0);
      } else {
        // 일간 뷰일 때는 기존 범위 유지 (selectedDay 기준으로 ±30일)
        startDate = new Date(referenceDate);
        startDate.setDate(startDate.getDate() - 30);
        endDate = new Date(referenceDate);
        endDate.setDate(endDate.getDate() + 30);
      }

      const startDateStr = formatDateString(startDate);
      const endDateStr = formatDateString(endDate);

      console.log(`📖 일기 조회 시작: ${startDateStr} ~ ${endDateStr}`);
      console.log(`  - 월간 뷰: ${isMonthlyView}`);

      const params: any = { 
        limit: 200, // 더 넓은 범위를 위해 limit 증가
        start_date: startDateStr,
        end_date: endDateStr
      };
      
      // 보호자인 경우 선택된 어르신 ID 전달
      if (user.role === 'caregiver' && selectedElderlyId) {
        params.elderly_id = selectedElderlyId;
      }
      
      const data = await getDiaries(params);
      console.log(`✅ 조회된 일기: ${data.length}개`);
      setDiaries(data);
    } catch (error: any) {
      console.error('❌ 일기 조회 실패:', error);
    }
  };

  // 새로고침 핸들러
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadSchedules(),
        loadDiaries(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 화면 마운트 시 연결된 사용자 목록 로드
  useEffect(() => {
    if (user?.role === 'caregiver') {
      loadConnectedElderly();
    } else if (user?.role === 'elderly') {
      loadConnectedCaregivers();
    }
  }, [user]);

  // 날짜 변경 시 스크롤 뷰에서 해당 날짜로 이동
  useEffect(() => {
    const dates = getExtendedDates(selectedDay);
    scrollToDate(selectedDay, dates);
  }, [selectedDay]);

  // 화면 포커스 시 및 날짜/뷰 변경 시 일정 목록 로드 (중복 호출 방지)
  useFocusEffect(
    useCallback(() => {
      // 보호자인 경우 어르신이 선택된 후에만 로드
      if (user?.role === 'caregiver' && !selectedElderlyId) {
        return;
      }
      
      // 일정 및 일기 로드
      if (user?.role === 'caregiver' && selectedElderlyId) {
        loadSchedules();
        loadDiaries();
      } else if (user?.role === 'elderly') {
        loadSchedules();
        loadDiaries();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.role, selectedElderlyId, selectedDay, isMonthlyView])
  );

  // 주간 캘린더 유틸리티 함수들
  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      week.push(weekDate);
    }
    return week;
  };

  // formatDate, formatDateString, isToday, isSameDate 함수는 공통 유틸리티 사용
  // formatDate → formatDateWithWeekday로 대체

  const getSchedulesForDate = (date: Date) => {
    const dateString = formatDateString(date);
    const dateSchedules = schedules.filter(schedule => schedule.due_date === dateString);
    return getFilteredSchedules(dateSchedules);
  };

  const getDiariesForDate = (date: Date) => {
    const dateString = formatDateString(date);
    const dateDiaries = diaries.filter(diary => diary.date === dateString);
    return getFilteredDiaries(dateDiaries);
  };

  // 날짜별 점 정보 가져오기 (일간 달력용)
  const getDotsForDate = (date: Date) => {
    const dateString = formatDateString(date);
    const dots: { color: string }[] = [];
    
    const filteredSchedules = getFilteredSchedules(schedules);
    const filteredDiaries = getFilteredDiaries(diaries);
    
    // 해당 날짜에 일정이 있는지 확인
    const hasSchedule = filteredSchedules.some(schedule => schedule.due_date === dateString);
    if (hasSchedule) {
      dots.push({ color: '#FF9800' }); // 주황색
    }
    
    // 해당 날짜에 어르신/AI 작성 일기가 있는지 확인
    const hasElderlyDiary = filteredDiaries.some(
      diary => diary.date === dateString && (diary.author_type === 'elderly' || diary.author_type === 'ai')
    );
    if (hasElderlyDiary) {
      dots.push({ color: '#4CAF50' }); // 초록색 (어르신 작성 배지 색상과 동일)
    }
    
    // 해당 날짜에 보호자 작성 일기가 있는지 확인
    const hasCaregiverDiary = filteredDiaries.some(
      diary => diary.date === dateString && diary.author_type === 'caregiver'
    );
    if (hasCaregiverDiary) {
      dots.push({ color: '#2196F3' }); // 파란색 (보호자 작성 배지 색상과 동일)
    }
    
    return dots;
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
        text: authorName ? `${authorName}님 작성` : '어르신 작성',
        color: '#4CAF50',
        bgColor: '#E8F5E9',
      };
    }
    
    return null;
  };

  // 주간 네비게이션
  const goToPreviousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setCurrentWeek(newWeek);
  };

  const goToNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setCurrentWeek(newWeek);
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  // 월간 캘린더 함수들
  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const dates = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  // 날짜 선택기 함수들 - 해당 월의 1일부터 마지막 일까지
  const getExtendedDates = (centerDate: Date) => {
    const dates = [];
    const year = centerDate.getFullYear();
    const month = centerDate.getMonth();
    
    // 해당 월의 1일
    const firstDay = new Date(year, month, 1);
    // 해당 월의 마지막 일
    const lastDay = new Date(year, month + 1, 0);

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      dates.push(date);
    }
    return dates;
  };

  // 날짜를 스크롤 뷰 중앙으로 이동
  const scrollToDate = (date: Date, dates: Date[]) => {
    const index = dates.findIndex(d => isSameDate(d, date));
    if (index !== -1 && dayScrollViewRef.current) {
      // 각 날짜 버튼의 전체 너비: minWidth(50) + marginRight(8) = 58
      const buttonWidth = 58;
      // 버튼의 실제 콘텐츠 너비 (minWidth)
      const buttonContentWidth = 50;
      // ScrollView의 좌측 padding (daySelectorContent의 paddingHorizontal)
      const scrollViewPadding = 24;
      const screenWidth = Dimensions.get('window').width;
      
      // 날짜 텍스트의 중앙 위치 계산 (padding 포함)
      const dateTextCenterX = scrollViewPadding + index * buttonWidth + buttonContentWidth / 2;
      
      // 화면 중앙으로 맞추기 위한 스크롤 위치
      const scrollPosition = dateTextCenterX - screenWidth / 2;
      
      // 약간의 지연 후 스크롤 (렌더링 완료 후)
      setTimeout(() => {
        dayScrollViewRef.current?.scrollTo({
          x: Math.max(0, scrollPosition),
          animated: true,
        });
      }, 150);
    }
  };

  // 날짜 선택 헤더의 월 이동 함수
  const handlePreviousMonth = () => {
    const newDate = new Date(selectedDay);
    newDate.setDate(1); // 먼저 1일로 설정 (월말 날짜 오류 방지)
    newDate.setMonth(newDate.getMonth() - 1); // 그 다음 월 변경
    
    // 새 날짜가 현재 달이면 오늘 날짜로 설정
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && 
        newDate.getMonth() === today.getMonth()) {
      newDate.setDate(today.getDate());
    }
    
    setSelectedDay(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedDay);
    newDate.setDate(1); // 먼저 1일로 설정 (월말 날짜 오류 방지)
    newDate.setMonth(newDate.getMonth() + 1); // 그 다음 월 변경
    
    // 새 날짜가 현재 달이면 오늘 날짜로 설정
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && 
        newDate.getMonth() === today.getMonth()) {
      newDate.setDate(today.getDate());
    }
    
    setSelectedDay(newDate);
  };

  // 년/월 피커 데이터
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = [
    { value: 1, label: '1월' },
    { value: 2, label: '2월' },
    { value: 3, label: '3월' },
    { value: 4, label: '4월' },
    { value: 5, label: '5월' },
    { value: 6, label: '6월' },
    { value: 7, label: '7월' },
    { value: 8, label: '8월' },
    { value: 9, label: '9월' },
    { value: 10, label: '10월' },
    { value: 11, label: '11월' },
    { value: 12, label: '12월' },
  ];

  const handleYearMonthSelect = () => {
    const newDate = new Date(selectedYear, selectedMonth - 1, selectedDay.getDate());
    setSelectedDay(newDate);
    setShowYearMonthPicker(false);
  };

  // 현재 한국 시간 가져오기
  const getCurrentKoreaTime = () => {
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return {
      hour: koreaTime.getHours(),
      minute: koreaTime.getMinutes(),
    };
  };

  // 시간을 HH:MM 형식으로 변환
  // formatTimeToHHMM, formatHHMMToDisplay 함수는 공통 유틸리티 사용

  const handleAddSchedule = () => {
    // 보호자인 경우 GuardianTodoAddScreen으로 이동
    if (user?.role === 'caregiver' && selectedElderlyId) {
      // 연결된 어르신 목록에서 이름 찾기
      const elderly = connectedElderly.find(e => e.user_id === selectedElderlyId);
      const elderlyName = elderly?.name || '어르신';
      router.push(`/guardian-todo-add?elderlyId=${selectedElderlyId}&elderlyName=${encodeURIComponent(elderlyName)}`);
      return;
    }
    
    // 어르신인 경우 기존 모달 방식 사용
    // 선택된 날짜 또는 오늘 날짜로 일정 추가 모달 열기
    const targetDate = selectedDay || new Date();
    // 기본 시간 12:00으로 설정
    const defaultTime = formatTimeToHHMM(12, 0);
    
    // 시간과 분을 먼저 설정 (12:00으로)
    setSelectedHour(12);
    setSelectedMinute(0);
    
    setNewSchedule({
      title: '',
      description: '',
      time: defaultTime,
      date: formatDateString(targetDate),
      category: '',
      isShared: false,
    });
    setShowAddModal(true);
    
    // 모달이 열린 후 스크롤 위치 설정 (선택된 항목이 중앙에 오도록)
    const itemHeight = isSmallScreen ? 40 : isMediumScreen ? 45 : 50;
    setTimeout(() => {
      if (hourScrollRef.current) {
        hourScrollRef.current.scrollTo({
          y: 12 * itemHeight,
          animated: false,
        });
      }
      if (minuteScrollRef.current) {
        minuteScrollRef.current.scrollTo({
          y: 0 * itemHeight,
          animated: false,
        });
      }
    }, 350);
  };

  // 날짜 표시 포맷팅 (예: 2024년 10월 31일 (목))
  // formatDateDisplay 함수는 공통 유틸리티 사용

  // 날짜 선택 핸들러 (일정 추가 모달용)
  const handleDateSelectInModal = (day: { dateString: string }) => {
    // 과거 날짜 선택 방지
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(day.dateString);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      show('알림', '과거 날짜는 선택할 수 없습니다. 오늘 또는 미래 날짜를 선택해주세요.');
      return;
    }
    
    setNewSchedule({ ...newSchedule, date: day.dateString });
    setShowDatePicker(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // 날짜만 선택하고 모달은 열지 않음
  };

  const handleSaveSchedule = async () => {
    if (!newSchedule.date) {
      show('알림', '날짜를 선택해주세요.');
      return;
    }

    if (!newSchedule.title.trim()) {
      show('알림', '제목을 입력해주세요.');
      return;
    }

    if (!newSchedule.description.trim()) {
      show('알림', '내용을 입력해주세요.');
      return;
    }

    if (!newSchedule.category) {
      show('알림', '카테고리를 선택해주세요.');
      return;
    }

    if (!newSchedule.time) {
      show('알림', '시간을 선택해주세요.');
      return;
    }

    if (!user) {
      show('오류', '로그인이 필요합니다.');
      return;
    }

    try {
      setIsLoading(true);

      // 시간 형식 (이미 HH:MM 형식)
      const timeHHMM = newSchedule.time;

      // 보호자인 경우 선택된 어르신 ID 사용, 어르신인 경우 본인 ID 사용
      const targetElderlyId = user.role === 'caregiver' && selectedElderlyId 
        ? selectedElderlyId 
        : user.user_id;

      // 출처별 공유 설정:
      // - 보호자가 등록: 항상 공유 (백엔드에서 자동 처리)
      // - 어르신이 직접 등록: 사용자가 선택한 공유 여부 사용
      const isShared = user.role === 'caregiver' ? true : newSchedule.isShared;

      const todoData = {
        elderly_id: targetElderlyId,
        title: newSchedule.title,
        description: newSchedule.description || '',
        category: newSchedule.category as any,
        due_date: newSchedule.date,
        due_time: timeHHMM,
        is_shared_with_caregiver: isShared,
      };

      console.log('📝 일정 생성 요청:', todoData);

      await createTodo(todoData);

      console.log('✅ 일정 생성 성공');

      // 일정 다시 불러오기
      await loadSchedules();

      setNewSchedule({ title: '', description: '', time: '', date: '', category: '', isShared: false });
      setShowAddModal(false);
      show('저장 완료', '일정이 추가되었습니다.');
    } catch (error: any) {
      console.error('❌ 일정 생성 실패:', error);
      show('오류', '일정을 저장하는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAdd = () => {
    setNewSchedule({ title: '', description: '', time: '', date: '', category: '', isShared: false });
    setShowAddModal(false);
    setShowDatePicker(false); // 날짜 선택 모달도 함께 닫기
  };


  const handleSchedulePress = (schedule: TodoItem) => {
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  const handleEditSchedule = () => {
    if (!selectedSchedule) {
      return;
    }

    const elderlyCanModify = canElderlyModifySchedule(selectedSchedule);
    const caregiverCanModify = canCaregiverModifySchedule(selectedSchedule);

    // 어르신인 경우 권한 체크
    if (user?.role === 'elderly' && !elderlyCanModify) {
      show('수정 불가', '보호자가 할당한 일정은 수정할 수 없습니다.');
      return;
    }

    // 보호자인 경우 권한 체크
    if (user?.role === 'caregiver' && !caregiverCanModify) {
      show('수정 불가', '어르신이 등록한 일정은 수정할 수 없습니다.');
      return;
    }

    setShowDetailModal(false);

    // 보호자인 경우 GuardianTodoAddScreen으로 이동 (수정 모드)
    if (user?.role === 'caregiver') {
      // 연결된 어르신 목록에서 이름 찾기
      const elderly = connectedElderly.find(e => e.user_id === selectedSchedule.elderly_id);
      const elderlyName = elderly?.name || '어르신';

      router.push(
        `/guardian-todo-add?elderlyId=${selectedSchedule.elderly_id}&elderlyName=${encodeURIComponent(elderlyName)}&todoId=${selectedSchedule.todo_id}`
      );
      return;
    }

    // 어르신인 경우: 본인이 작성한 일정이거나 AI가 추출한 일정만 수정 가능
    if (user?.role === 'elderly' && elderlyCanModify) {
      router.push(
        `/guardian-todo-add?elderlyId=${selectedSchedule.elderly_id}&elderlyName=나&todoId=${selectedSchedule.todo_id}`
      );
      return;
    }
  };

  const handleDeleteFromDetail = () => {
    if (!selectedSchedule) {
      return;
    }

    // 권한 체크
    if (user?.role === 'elderly' && !canElderlyModifySchedule(selectedSchedule)) {
      show('삭제 불가', '보호자가 할당한 일정은 삭제할 수 없습니다.');
      return;
    }

    if (user?.role === 'caregiver' && !canCaregiverModifySchedule(selectedSchedule)) {
      show('삭제 불가', '어르신이 등록한 일정은 삭제할 수 없습니다.');
      return;
    }

    setShowDetailModal(false);
    handleDeleteSchedule(selectedSchedule.todo_id);
  };

  const handleDeleteSchedule = (todoId: string) => {
    show(
      '일정 삭제',
      '이 일정을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);

              console.log('🗑️ 일정 삭제 요청:', todoId);

              await deleteTodo(todoId);

              console.log('✅ 일정 삭제 성공');

              // 일정 다시 불러오기
              await loadSchedules();

              show('삭제 완료', '일정이 삭제되었습니다.');
            } catch (error: any) {
              console.error('❌ 일정 삭제 실패:', error);
              show('오류', '일정을 삭제하는데 실패했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // TODO 완료 처리 (어르신 전용)
  const handleCompleteTodo = async (todoId: string) => {
    try {
      await completeTodo(todoId);
      show('완료!', '할 일을 완료했습니다.');
      // 일정 목록 새로고침
      await loadSchedules();
      setShowDetailModal(false);
    } catch (error: any) {
      console.error('할 일 완료 실패:', error);
      show('오류', '할 일 완료에 실패했습니다.');
    }
  };

  // TODO 완료 취소 (어르신 전용)
  const handleCancelTodo = async (todoId: string) => {
    try {
      await cancelTodo(todoId);
      show('취소됨', '할 일 완료를 취소했습니다.');
      // 일정 목록 새로고침
      await loadSchedules();
      setShowDetailModal(false);
    } catch (error: any) {
      console.error('할 일 취소 실패:', error);
      show('오류', '할 일 취소에 실패했습니다.');
    }
  };


  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header
        title="달력"
        showMenuButton={true}
        rightButton={
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => setIsMonthlyView(!isMonthlyView)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isMonthlyView ? "calendar-outline" : "grid-outline"}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.viewToggleText}>
              {isMonthlyView ? "일간" : "월간"}
            </Text>
          </TouchableOpacity>
        }
      />


      {/* 보호자인데 어르신이 선택되지 않은 경우 안내 */}
      {user?.role === 'caregiver' && !selectedElderlyId && connectedElderly.length === 0 && (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyStateText}>연결된 어르신 정보를 불러오는 중...</Text>
        </View>
      )}

      {/* 보호자용 공유 필터 */}

      <ScrollView 
        style={styles.content} 
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
        {/* 필터 탭 */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'all' && styles.filterTabActive
            ]}
            onPress={() => setSelectedFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterTabText,
              selectedFilter === 'all' && styles.filterTabTextActive
            ]}>
              전체
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'schedule' && styles.filterTabActive
            ]}
            onPress={() => setSelectedFilter('schedule')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterTabText,
              selectedFilter === 'schedule' && styles.filterTabTextActive
            ]}>
              일정
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'diary' && styles.filterTabActive
            ]}
            onPress={() => setSelectedFilter('diary')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterTabText,
              selectedFilter === 'diary' && styles.filterTabTextActive
            ]}>
              일기
            </Text>
          </TouchableOpacity>
        </View>

        {/* 월간 달력 뷰 */}
        {isMonthlyView ? (
          <View style={styles.monthlyCalendarContainer}>
            <Calendar
              current={selectedDay.toISOString().split('T')[0]}
              onDayPress={(day) => {
                const newDate = new Date(day.dateString);
                setSelectedDay(newDate);
                // 월간 뷰 유지, 일간 뷰로 전환하지 않음
              }}
              onMonthChange={(month) => {
                // 월 변경 시 데이터 로드
                const newDate = new Date(month.year, month.month - 1, 1);
                loadSchedules(newDate);
                loadDiaries(newDate);
              }}
              monthFormat={'yyyy년 MM월'}
              hideArrows={false}
              hideExtraDays={true}
              disableMonthChange={false}
              firstDay={0} // 일요일부터 시작
              hideDayNames={false}
              showWeekNumbers={false}
              onPressArrowLeft={(subtractMonth) => subtractMonth()}
              onPressArrowRight={(addMonth) => addMonth()}
              enableSwipeMonths={true}
              markedDates={getMarkedDates()}
              markingType={'multi-dot'}
              theme={{
                backgroundColor: Colors.background,
                calendarBackground: Colors.background,
                textSectionTitleColor: Colors.textLight,
                selectedDayBackgroundColor: Colors.primary,
                selectedDayTextColor: Colors.textWhite,
                todayTextColor: Colors.primary,
                dayTextColor: Colors.text,
                textDisabledColor: Colors.textDisabled,
                dotColor: Colors.primary,
                selectedDotColor: Colors.textWhite,
                arrowColor: Colors.primary,
                disabledArrowColor: Colors.textDisabled,
                monthTextColor: Colors.text,
                indicatorColor: Colors.primary,
                textDayFontWeight: '400',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '400',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
            />

            {/* 월간 달력 하단 일정 + 일기 미리보기 */}
            <View style={styles.monthlySchedulePreview}>
              {/* 일정 섹션 - 'diary' 필터가 아닐 때만 표시 */}
              {selectedFilter !== 'diary' && (
                <View style={styles.previewSection}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>
                      {selectedDay.getMonth() + 1}월 {selectedDay.getDate()}일 일정
                    </Text>
                    <TouchableOpacity
                      style={styles.monthlyAddButton}
                      onPress={handleAddSchedule}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color={Colors.textWhite} />
                      <Text style={styles.monthlyAddButtonText}>추가</Text>
                    </TouchableOpacity>
                  </View>
                  {getSchedulesForDate(selectedDay).length > 0 ? (
                    <View style={styles.previewList}>
                      {getSchedulesForDate(selectedDay).slice(0, 3).map((schedule, index) => (
                      <TouchableOpacity
                        key={schedule.todo_id}
                        style={styles.previewItem}
                        onPress={() => handleSchedulePress(schedule)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.previewIcon,
                          schedule.category === 'MEDICINE' && styles.previewIconMedicine,
                          schedule.category === 'HOSPITAL' && styles.previewIconHospital,
                          schedule.category === 'EXERCISE' && styles.previewIconExercise,
                          schedule.category === 'MEAL' && styles.previewIconMeal,
                          !schedule.category && styles.previewIconDefault,
                        ]}>
                          <Ionicons
                            name={
                              schedule.title.includes('약') || schedule.category === 'MEDICINE' ? 'medical' :
                                schedule.title.includes('병원') || schedule.category === 'HOSPITAL' ? 'medical-outline' :
                                  schedule.category === 'EXERCISE' ? 'fitness-outline' :
                                    schedule.category === 'MEAL' ? 'restaurant-outline' :
                                      'calendar-outline'
                            }
                            size={16}
                            color={Colors.textWhite}
                          />
                        </View>
                        <Text style={styles.previewText}>{schedule.title}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
                      </TouchableOpacity>
                      ))}
                      {getSchedulesForDate(selectedDay).length > 3 && (
                        <Text style={styles.previewMore}>
                          +{getSchedulesForDate(selectedDay).length - 3}개 더 보기
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.previewEmpty}>등록된 일정이 없습니다</Text>
                  )}
                </View>
              )}

              {/* 일기 섹션 - 'schedule' 필터가 아닐 때만 표시 */}
              {selectedFilter !== 'schedule' && (
                <View style={styles.previewSection}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>
                      {selectedDay.getMonth() + 1}월 {selectedDay.getDate()}일 일기
                    </Text>
                  </View>
                  {getDiariesForDate(selectedDay).length > 0 ? (
                    <View style={styles.previewList}>
                      {getDiariesForDate(selectedDay).map((diary) => {
                        const authorBadge = getAuthorBadgeInfo(diary);
                        const moodInfo = getMoodIcon(diary.mood);
                        const borderColor = moodInfo ? moodInfo.color : '#9C27B0';
                        
                        return (
                          <TouchableOpacity
                            key={diary.diary_id}
                            style={[
                              styles.diaryPreviewCard,
                              { borderLeftColor: borderColor }
                            ]}
                            onPress={() => router.push(`/diary-detail?diaryId=${diary.diary_id}`)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.diaryPreviewHeader}>
                              <View style={styles.diaryPreviewTitleRow}>
                                {diary.title && (
                                  <Text style={styles.diaryPreviewTitle} numberOfLines={1}>
                                    {diary.title}
                                  </Text>
                                )}
                                {diary.mood && getMoodIcon(diary.mood) && (
                                  <Ionicons 
                                    name={getMoodIcon(diary.mood)!.name as any} 
                                    size={20} 
                                    color={getMoodIcon(diary.mood)!.color} 
                                  />
                                )}
                              </View>
                              {authorBadge && (
                                <View style={[styles.diaryAuthorBadge, { backgroundColor: authorBadge.bgColor }]}>
                                  {authorBadge.iconFamily === 'MaterialCommunityIcons' ? (
                                    <MaterialCommunityIcons 
                                      name={authorBadge.icon} 
                                      size={12} 
                                      color={authorBadge.color} 
                                    />
                                  ) : (
                                    <Ionicons 
                                      name={authorBadge.icon} 
                                      size={12} 
                                      color={authorBadge.color} 
                                    />
                                  )}
                                  <Text style={[styles.diaryAuthorBadgeText, { color: authorBadge.color }]}>
                                    {authorBadge.text}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.diaryPreviewContent} numberOfLines={2}>
                              {diary.content}
                            </Text>
                            {/* 댓글 및 사진 배지 */}
                            {(diary.photos && diary.photos.length > 0) || (diary.comment_count !== undefined && diary.comment_count > 0) ? (
                              <View style={styles.diaryBadgeContainer}>
                                {/* 사진 배지 */}
                                {diary.photos && diary.photos.length > 0 && (
                                  <View style={styles.diaryPhotoCountBadge}>
                                    <Ionicons name="camera-outline" size={14} color="#FF9500" />
                                    <Text style={styles.diaryPhotoCountText}>{diary.photos.length}</Text>
                                  </View>
                                )}
                                {/* 댓글 배지 */}
                                {diary.comment_count !== undefined && diary.comment_count > 0 && (
                                  <View style={styles.diaryCommentCountBadge}>
                                    <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
                                    <Text style={styles.diaryCommentCountText}>{diary.comment_count}</Text>
                                  </View>
                                )}
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.previewEmpty}>작성된 일기가 없습니다</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            {/* 날짜 선택기 */}
            <View style={styles.dateSelector}>
              <TouchableOpacity
                style={styles.dateNavButton}
                onPress={handlePreviousMonth}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.selectedDateContainer}
                onPress={() => setShowYearMonthPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectedDateText}>
                  {selectedDay.getFullYear()}년 {selectedDay.getMonth() + 1}월
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateNavButton}
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 날짜 선택 */}
            <ScrollView
              ref={dayScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.daySelectorScroll}
              contentContainerStyle={styles.daySelectorContent}
              onLayout={() => {
                // 초기 로드 시 오늘 날짜로 스크롤
                const dates = getExtendedDates(selectedDay);
                scrollToDate(selectedDay, dates);
              }}
            >
              {getExtendedDates(selectedDay).map((date, index) => {
                const isSelected = isSameDate(date, selectedDay);
                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                const dots = getDotsForDate(date);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected
                    ]}
                    onPress={() => {
                      setSelectedDay(date);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayNumber,
                      isSelected && styles.dayNumberSelected
                    ]}>
                      {date.getDate()}
                    </Text>
                    <Text style={[
                      styles.dayName,
                      isSelected && styles.dayNameSelected
                    ]}>
                      {dayNames[date.getDay()]}
                    </Text>
                    {/* 점 표시 */}
                    {dots.length > 0 && (
                      <View style={styles.dayDotsContainer}>
                        {dots.map((dot, dotIndex) => (
                          <View
                            key={dotIndex}
                            style={[
                              styles.dayDot,
                              { 
                                backgroundColor: isSelected ? Colors.textWhite : dot.color 
                              }
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>


            {/* 일기 작성 및 일정 추가 버튼 */}
            <View style={styles.addButtonSection}>
              {/* 일기 작성 버튼 - 'schedule' 필터가 아닐 때만 표시 */}
              {selectedFilter !== 'schedule' && (
                <TouchableOpacity
                  style={styles.addDiaryButton}
                  onPress={() => {
                    const today = formatDateString(new Date());
                    router.push(`/diary-write?date=${today}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="book-outline" size={20} color={Colors.textWhite} />
                  <Text style={styles.addDiaryButtonText}>일기 작성</Text>
                </TouchableOpacity>
              )}

              {/* 일정 추가 버튼 - 'diary' 필터가 아닐 때만 표시 */}
              {selectedFilter !== 'diary' && (
                <TouchableOpacity
                  style={[
                    styles.addScheduleButton,
                    selectedFilter === 'schedule' && styles.addScheduleButtonFullWidth
                  ]}
                  onPress={handleAddSchedule}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={Colors.textWhite} />
                  <Text style={styles.addScheduleText}>일정 추가</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 시간대별 일정 목록 - 'diary' 필터가 아닐 때만 표시 */}
            {selectedFilter !== 'diary' && (
              <View style={styles.scheduleSection}>
                <View style={styles.scheduleHeader}>
                  <Text style={styles.scheduleSectionTitle}>
                    {isToday(selectedDay) 
                      ? '오늘의 일정' 
                      : `${selectedDay.getMonth() + 1}월 ${selectedDay.getDate()}일의 일정`}
                  </Text>
                </View>

                {(() => {
                  const targetDateString = formatDateString(selectedDay);
                  const dateSchedules = schedules.filter(schedule => schedule.due_date === targetDateString);
                  const filteredSchedules = getFilteredSchedules(dateSchedules);

                  // 일간 뷰에서는 로딩 마커 표시하지 않음
                  if (isLoading && isMonthlyView) {
                    return (
                      <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.emptySubText}>일정을 불러오는 중...</Text>
                      </View>
                    );
                  }

                  if (filteredSchedules.length === 0) {
                    return (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                          {selectedDate ? `${formatDateWithWeekday(selectedDate)} 등록된 일정이 없습니다` : '오늘 등록된 일정이 없습니다'}
                        </Text>
                        <Text style={styles.emptySubText}>+ 버튼을 눌러 일정을 추가해보세요</Text>
                      </View>
                    );
                  }

                  // 시간순으로 정렬
                  const sortedSchedules = filteredSchedules.sort((a, b) => {
                    if (!a.due_time) return 1;
                    if (!b.due_time) return -1;
                    return a.due_time.localeCompare(b.due_time);
                  });

                  const pendingSchedules = sortedSchedules.filter(schedule => schedule.status !== 'completed' && schedule.status !== 'cancelled');
                  const completedSchedules = sortedSchedules.filter(schedule => schedule.status === 'completed' || schedule.status === 'cancelled');

                  const renderScheduleCard = (schedule: TodoItem) => {
                    const isCompleted = schedule.status === 'completed';
                    const isCancelled = schedule.status === 'cancelled';

                    return (
                      <TouchableOpacity
                        key={schedule.todo_id}
                        style={[
                          styles.scheduleCard,
                          (isCompleted || isCancelled) && styles.scheduleCardCompleted,
                          isCancelled && styles.scheduleCardCancelled,
                        ]}
                        onPress={() => handleSchedulePress(schedule)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.scheduleIconContainer}>
                          <View style={[
                            styles.scheduleIcon,
                            schedule.category === 'MEDICINE' && styles.scheduleIconMedicine,
                            schedule.category === 'HOSPITAL' && styles.scheduleIconHospital,
                            schedule.category === 'EXERCISE' && styles.scheduleIconExercise,
                            schedule.category === 'MEAL' && styles.scheduleIconMeal,
                            (!schedule.category || schedule.category === 'OTHER') && styles.scheduleIconDefault,
                          ]}>
                            <Ionicons
                              name={getScheduleIconName(schedule) as any}
                              size={24}
                              color={Colors.textWhite}
                            />
                          </View>
                        </View>

                        <View style={styles.scheduleContent}>
                          {/* 완료 또는 취소 상태일 때만 배지 표시 */}
                          {(isCompleted || isCancelled) && (
                            <View style={styles.scheduleMetaRow}>
                              <View style={[
                                styles.scheduleStatusBadge,
                                isCompleted && styles.scheduleStatusBadgeCompleted,
                                isCancelled && styles.scheduleStatusBadgeCancelled,
                              ]}>
                                <Text
                                  style={[
                                    styles.scheduleStatusBadgeText,
                                    isCompleted && styles.scheduleStatusBadgeTextCompleted,
                                    isCancelled && styles.scheduleStatusBadgeTextCancelled,
                                  ]}
                                >
                                  {isCompleted ? '완료' : '취소'}
                                </Text>
                              </View>
                            </View>
                          )}

                          {/* 제목과 공유 아이콘을 같은 라인에 배치 */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={[styles.scheduleTitle, (isCompleted || isCancelled) && styles.scheduleTitleCompleted, { flex: 1, marginRight: 8 }]}>
                              {schedule.title}
                            </Text>
                            {/* 공유 아이콘 (우측 배치) */}
                            <Ionicons
                              name={schedule.is_shared_with_caregiver ? 'people' : 'lock-closed'}
                              size={18}
                              color={schedule.is_shared_with_caregiver ? Colors.primary : Colors.textLight}
                            />
                          </View>

                          <Text style={[styles.scheduleTime, (isCompleted || isCancelled) && styles.scheduleTimeCompleted]}>
                            {formatTimeKorean(schedule.due_time)}
                          </Text>
                          {schedule.description && (
                            <Text style={[styles.scheduleDescription, (isCompleted || isCancelled) && styles.scheduleDescriptionCompleted]}>
                              {schedule.description}
                            </Text>
                          )}
                        </View>

                        <View style={styles.scheduleArrow}>
                          <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
                        </View>
                      </TouchableOpacity>
                    );
                  };

                  return (
                    <View style={styles.timeScheduleContainer}>
                      {pendingSchedules.length > 0 && (
                        <View style={styles.scheduleSubsection}>
                          {pendingSchedules.map(renderScheduleCard)}
                        </View>
                      )}

                      {completedSchedules.length > 0 && (
                        <View style={styles.scheduleSubsection}>
                          <Text style={styles.scheduleSubsectionTitle}>완료된 일정</Text>
                          {completedSchedules.map(renderScheduleCard)}
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}

            {/* 일기 목록 - 'schedule' 필터가 아닐 때만 표시 */}
            {selectedFilter !== 'schedule' && (
              <View style={styles.scheduleSection}>
                <View style={styles.scheduleHeader}>
                  <Text style={styles.scheduleSectionTitle}>
                    {isToday(selectedDay) 
                      ? '오늘의 일기' 
                      : `${selectedDay.getMonth() + 1}월 ${selectedDay.getDate()}일의 일기`}
                  </Text>
                </View>

                {(() => {
                  const filteredDiaries = getDiariesForDate(selectedDay);

                  // 일간 뷰에서는 로딩 마커 표시하지 않음
                  if (isLoading && isMonthlyView) {
                    return (
                      <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.emptySubText}>일기를 불러오는 중...</Text>
                      </View>
                    );
                  }

                  if (filteredDiaries.length === 0) {
                    return (
                      <View style={styles.emptyState}>
                        <Ionicons name="book-outline" size={48} color="#CCCCCC" style={{ marginBottom: 12 }} />
                        <Text style={styles.emptyText}>
                          {selectedDate ? `${formatDateWithWeekday(selectedDate)} 작성된 일기가 없습니다` : '오늘 작성된 일기가 없습니다'}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View style={styles.timeScheduleContainer}>
                      {filteredDiaries.map((diary) => {
                        const authorBadge = getAuthorBadgeInfo(diary);
                        const moodInfo = getMoodIcon(diary.mood);
                        const borderColor = moodInfo ? moodInfo.color : '#9C27B0';
                        
                        return (
                          <TouchableOpacity
                            key={diary.diary_id}
                            style={[
                              styles.scheduleCard, 
                              styles.diaryCard,
                              { borderLeftColor: borderColor }
                            ]}
                            onPress={() => router.push(`/diary-detail?diaryId=${diary.diary_id}`)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.diaryCardContent}>
                              <View style={styles.diaryCardHeader}>
                                <View style={styles.diaryCardTitleRow}>
                                  {diary.title && (
                                    <Text style={styles.scheduleTitle} numberOfLines={1}>
                                      {diary.title}
                                    </Text>
                                  )}
                                  {diary.mood && getMoodIcon(diary.mood) && (
                                    <Ionicons 
                                      name={getMoodIcon(diary.mood)!.name as any} 
                                      size={24} 
                                      color={getMoodIcon(diary.mood)!.color} 
                                    />
                                  )}
                                </View>
                                {authorBadge && (
                                  <View style={[styles.diaryAuthorBadge, { backgroundColor: authorBadge.bgColor }]}>
                                    {authorBadge.iconFamily === 'MaterialCommunityIcons' ? (
                                      <MaterialCommunityIcons 
                                        name={authorBadge.icon} 
                                        size={14} 
                                        color={authorBadge.color} 
                                      />
                                    ) : (
                                      <Ionicons 
                                        name={authorBadge.icon} 
                                        size={14} 
                                        color={authorBadge.color} 
                                      />
                                    )}
                                    <Text style={[styles.diaryAuthorBadgeText, { color: authorBadge.color, fontSize: 12 }]}>
                                      {authorBadge.text}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.scheduleDescription} numberOfLines={3}>
                                {diary.content}
                              </Text>
                              {/* 댓글 및 사진 배지 */}
                              {(diary.photos && diary.photos.length > 0) || (diary.comment_count !== undefined && diary.comment_count > 0) ? (
                                <View style={styles.diaryBadgeContainer}>
                                  {/* 사진 배지 */}
                                  {diary.photos && diary.photos.length > 0 && (
                                    <View style={styles.diaryPhotoCountBadge}>
                                      <Ionicons name="camera-outline" size={14} color="#FF9500" />
                                      <Text style={styles.diaryPhotoCountText}>{diary.photos.length}</Text>
                                    </View>
                                  )}
                                  {/* 댓글 배지 */}
                                  {diary.comment_count !== undefined && diary.comment_count > 0 && (
                                    <View style={styles.diaryCommentCountBadge}>
                                      <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
                                      <Text style={styles.diaryCommentCountText}>{diary.comment_count}</Text>
                                    </View>
                                  )}
                                </View>
                              ) : null}
                            </View>

                            <View style={styles.scheduleArrow}>
                              <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            )}


            {/* 하단 여백 */}
            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />

      {/* 일정 추가 모달 - 중앙 배치 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelAdd}
      >
        <KeyboardAvoidingView
          style={styles.centeredModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <TouchableWithoutFeedback onPress={handleCancelAdd}>
            <View style={styles.centeredModalBackdrop} />
          </TouchableWithoutFeedback>
          
          <View style={styles.centeredModalContent}>
            {/* 헤더 */}
            <View style={styles.centeredModalHeader}>
              <Text style={styles.centeredModalTitle}>일정 추가</Text>
              <TouchableOpacity 
                onPress={handleCancelAdd} 
                style={styles.centeredCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.centeredModalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              nestedScrollEnabled={true}
              scrollEnabled={!showDatePicker}
              bounces={false}
            >
              {/* 날짜 선택 */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>날짜</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => {
                    setShowDatePicker(!showDatePicker);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.datePickerText,
                    !newSchedule.date && styles.datePickerPlaceholder
                  ]}>
                    {newSchedule.date ? formatDateDisplay(newSchedule.date) : '날짜를 선택해주세요'}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={Colors.primary}
                  />
                </TouchableOpacity>

                {/* 날짜 선택 달력 */}
                {showDatePicker && (
                  <View style={styles.centeredDatePickerContainer}>
                    <Calendar
                      current={newSchedule.date || formatDateString(selectedDay)}
                      onDayPress={handleDateSelectInModal}
                      monthFormat={'yyyy년 M월'}
                      hideExtraDays={true}
                      minDate={new Date().toISOString().split('T')[0]}
                      theme={{
                        backgroundColor: '#FFFFFF',
                        calendarBackground: '#FFFFFF',
                        textSectionTitleColor: '#666666',
                        selectedDayBackgroundColor: Colors.primary,
                        selectedDayTextColor: '#FFFFFF',
                        todayTextColor: Colors.primary,
                        dayTextColor: '#333333',
                        textDisabledColor: '#CCCCCC',
                        dotColor: Colors.primary,
                        selectedDotColor: '#FFFFFF',
                        arrowColor: Colors.primary,
                        monthTextColor: '#333333',
                        textDayFontWeight: '500',
                        textMonthFontWeight: '700',
                        textDayHeaderFontWeight: '600',
                        textDayFontSize: 16,
                        textMonthFontSize: 18,
                        textDayHeaderFontSize: 14,
                      }}
                      markedDates={{
                        [newSchedule.date || formatDateString(selectedDay)]: {
                          selected: true,
                          selectedColor: Colors.primary,
                        }
                      }}
                    />
                  </View>
                )}
              </View>

              {/* 제목 입력 */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>제목</Text>
                <TextInput
                  style={styles.titleInput}
                  value={newSchedule.title}
                  onChangeText={(text) => setNewSchedule({ ...newSchedule, title: text })}
                  placeholder="일정 제목을 입력해주세요"
                  placeholderTextColor={Colors.textLight}
                  editable={!showDatePicker}
                />
              </View>

              {/* 내용 입력 */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>내용</Text>
                <TextInput
                  style={styles.descriptionInput}
                  value={newSchedule.description}
                  onChangeText={(text) => setNewSchedule({ ...newSchedule, description: text })}
                  placeholder="일정 내용을 자세히 입력해주세요"
                  placeholderTextColor={Colors.textLight}
                  multiline
                  numberOfLines={4}
                  editable={!showDatePicker}
                />
              </View>

              {/* 카테고리 선택 */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>카테고리</Text>
                <View style={styles.categoryGridInline}>
                  <CategorySelector
                    selectedCategory={newSchedule.category}
                    onSelect={(categoryId) => setNewSchedule({ ...newSchedule, category: categoryId })}
                    disabled={showDatePicker}
                  />
                  {/* 장식용 캐릭터 카드 (3x2 그리드를 채우기 위해) */}
                  <View style={styles.categoryCardInlineDisabled}>
                    <Image 
                      source={require('../../assets/haru-character.png')} 
                      style={styles.decorativeCharacterImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              </View>

              {/* 시간 선택 - AICallScreen과 동일한 TimePicker 사용 */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>시간</Text>
                <TimePicker
                  value={newSchedule.time || '12:00'}
                  onChange={(time: string) => {
                    setNewSchedule({
                      ...newSchedule,
                      time,
                    });
                  }}
                />
              </View>

              {/* 공유 설정 토글 - 어르신만 표시 */}
              {user?.role === 'elderly' && (
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>공유 설정</Text>
                  <View style={styles.shareToggleContainer}>
                    <View style={styles.shareToggleLeft}>
                      <View style={styles.shareToggleHeader}>
                        <Ionicons 
                          name={newSchedule.isShared ? "people" : "lock-closed"} 
                          size={24} 
                          color={newSchedule.isShared ? '#34B79F' : '#666666'} 
                          style={styles.shareToggleIcon}
                        />
                        <Text style={styles.shareToggleLabel}>
                          보호자와 공유
                        </Text>
                      </View>
                      <Text style={styles.shareToggleHint}>
                        {newSchedule.isShared 
                          ? '보호자도 이 일정을 볼 수 있어요 ✓'
                          : '나만 볼 수 있어요 (비공개)'}
                      </Text>
                    </View>
                    <Switch
                      value={newSchedule.isShared}
                      onValueChange={(value) => 
                        setNewSchedule({ ...newSchedule, isShared: value })
                      }
                      trackColor={{ false: '#E8E8E8', true: '#34B79F' }}
                      thumbColor='#FFFFFF'
                      ios_backgroundColor='#E8E8E8'
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* 저장 버튼 */}
            <View style={styles.centeredModalFooter}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveSchedule}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>저장하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 년/월 선택 피커 모달 */}
      <Modal
        visible={showYearMonthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearMonthPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            {/* 헤더 */}
            <View style={styles.pickerHeader}>
              <TouchableOpacity
                onPress={() => setShowYearMonthPicker(false)}
                style={styles.pickerCancelButton}
              >
                <Text style={styles.pickerCancelText}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>날짜 선택</Text>
              <TouchableOpacity
                onPress={handleYearMonthSelect}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>완료</Text>
              </TouchableOpacity>
            </View>

            {/* 피커 영역 */}
            <View style={styles.pickerContent}>
              {/* 년도 피커 */}
              <View style={styles.pickerColumn}>
                <View style={styles.pickerMask} />
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={40}
                  decelerationRate="fast"
                >
                  {years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.pickerItem,
                        selectedYear === year && styles.pickerItemSelected
                      ]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedYear === year && styles.pickerItemTextSelected
                      ]}>
                        {year}년
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 월 피커 */}
              <View style={styles.pickerColumn}>
                <View style={styles.pickerMask} />
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={40}
                  decelerationRate="fast"
                >
                  {months.map((month) => (
                    <TouchableOpacity
                      key={month.value}
                      style={[
                        styles.pickerItem,
                        selectedMonth === month.value && styles.pickerItemSelected
                      ]}
                      onPress={() => setSelectedMonth(month.value)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedMonth === month.value && styles.pickerItemTextSelected
                      ]}>
                        {month.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 일정 상세 모달 */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
        presentationStyle="overFullScreen"
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            {selectedSchedule && (
              <>
                {/* 헤더 */}
                <View style={styles.detailModalHeader}>
                  <Text style={styles.detailModalTitle}>일정 상세</Text>
                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    style={styles.detailCloseButton}
                  >
                    <Ionicons name="close" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* 일정 정보 */}
                <ScrollView style={styles.detailModalBody}>
                  <View style={styles.detailInfoSection}>
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>제목</Text>
                      <Text style={styles.detailInfoValue}>{selectedSchedule.title}</Text>
                    </View>

                    {selectedSchedule.description && (
                      <View style={styles.detailInfoRow}>
                        <Text style={styles.detailInfoLabel}>내용</Text>
                        <Text style={styles.detailInfoValue}>{selectedSchedule.description}</Text>
                      </View>
                    )}

                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>날짜</Text>
                      <Text style={styles.detailInfoValue}>{selectedSchedule.due_date}</Text>
                    </View>

                    {selectedSchedule.due_time && (
                      <View style={styles.detailInfoRow}>
                        <Text style={styles.detailInfoLabel}>시간</Text>
                        <Text style={styles.detailInfoValue}>
                          {formatTimeKorean(selectedSchedule.due_time)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>카테고리</Text>
                      <View style={[
                        styles.detailCategoryTag,
                        selectedSchedule.category === 'MEDICINE' && styles.detailCategoryMedicine,
                        selectedSchedule.category === 'HOSPITAL' && styles.detailCategoryHospital,
                        selectedSchedule.category === 'EXERCISE' && styles.detailCategoryExercise,
                        selectedSchedule.category === 'MEAL' && styles.detailCategoryMeal,
                      ]}>
                        <Text style={styles.detailCategoryText}>
                          {selectedSchedule.category === 'MEDICINE' ? '약물' :
                            selectedSchedule.category === 'HOSPITAL' ? '병원' :
                              selectedSchedule.category === 'EXERCISE' ? '운동' :
                                selectedSchedule.category === 'MEAL' ? '식사' : '기타'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>상태</Text>
                      <View
                        style={[
                          styles.detailStatusBadge,
                          selectedSchedule.status === 'completed' && styles.detailStatusBadgeCompleted,
                          selectedSchedule.status === 'cancelled' && styles.detailStatusBadgeCancelled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailStatusBadgeText,
                            selectedSchedule.status === 'completed' && styles.detailStatusBadgeTextCompleted,
                            selectedSchedule.status === 'cancelled' && styles.detailStatusBadgeTextCancelled,
                          ]}
                        >
                          {selectedSchedule.status === 'completed'
                            ? '완료'
                            : selectedSchedule.status === 'cancelled'
                              ? '취소'
                              : '예정'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>등록자</Text>
                      <Text style={styles.detailInfoValue}>
                        {getScheduleCreatorLabel(selectedSchedule)}
                      </Text>
                    </View>

                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>공유 상태</Text>
                      <View
                        style={[
                          styles.detailShareBadge,
                          selectedSchedule.is_shared_with_caregiver ? styles.detailShareBadgeOn : styles.detailShareBadgeOff,
                        ]}
                      >
                        <Ionicons
                          name={selectedSchedule.is_shared_with_caregiver ? 'people' : 'lock-closed'}
                          size={14}
                          color={selectedSchedule.is_shared_with_caregiver ? Colors.primary : Colors.textSecondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.detailShareBadgeText,
                            selectedSchedule.is_shared_with_caregiver ? styles.detailShareBadgeTextOn : styles.detailShareBadgeTextOff,
                          ]}
                        >
                          {getScheduleShareLabel(selectedSchedule)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* 하단 버튼 */}
                <View style={[styles.detailModalFooter, { paddingBottom: insets.bottom }]}>
                  {(() => {
                    // 어르신인 경우: 보호자가 할당한 TODO는 완료 버튼만 표시
                    if (user?.role === 'elderly' && selectedSchedule.creator_type === 'caregiver') {
                      const isCompleted = selectedSchedule.status === 'completed';
                      return (
                        <>
                          {!isCompleted ? (
                            <TouchableOpacity
                              style={styles.detailCompleteButton}
                              onPress={() => handleCompleteTodo(selectedSchedule.todo_id)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                              <Text style={styles.detailCompleteButtonText}>완료</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.detailCancelButton}
                              onPress={() => handleCancelTodo(selectedSchedule.todo_id)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                              <Text style={styles.detailCancelButtonText}>완료 취소</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      );
                    }
                    
                    // 어르신인 경우: 본인이 작성한 일정이거나 AI가 추출한 일정은 수정/삭제 가능
                    if (user?.role === 'elderly' && canElderlyModifySchedule(selectedSchedule)) {
                      return (
                        <>
                          <TouchableOpacity
                            style={styles.detailEditButton}
                            onPress={handleEditSchedule}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="create-outline" size={18} color={Colors.primary} />
                            <Text style={styles.detailEditButtonText}>수정</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.detailDeleteButton}
                            onPress={handleDeleteFromDetail}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={18} color={Colors.error} />
                            <Text style={styles.detailDeleteButtonText}>삭제</Text>
                          </TouchableOpacity>
                        </>
                      );
                    }

                    // 보호자인 경우: 수정/삭제 버튼 표시
                    if (user?.role === 'caregiver') {
                      if (!canCaregiverModifySchedule(selectedSchedule)) {
                        return (
                          <View style={styles.detailNoticeBox}>
                            <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                            <Text style={styles.detailNoticeText}>어르신이 등록한 일정입니다. 보호자는 수정하거나 삭제할 수 없습니다.</Text>
                          </View>
                        );
                      }

                      return (
                        <>
                          <TouchableOpacity
                            style={styles.detailEditButton}
                            onPress={handleEditSchedule}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="create-outline" size={18} color={Colors.primary} />
                            <Text style={styles.detailEditButtonText}>수정</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.detailDeleteButton}
                            onPress={handleDeleteFromDetail}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={18} color={Colors.error} />
                            <Text style={styles.detailDeleteButtonText}>삭제</Text>
                          </TouchableOpacity>
                        </>
                      );
                    }

                    return null;
                  })()}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
};

// 반응형 디자인을 위한 화면 크기 계산
const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;
const isSmallScreen = windowHeight < 700;
const isMediumScreen = windowHeight >= 700 && windowHeight < 900;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },

  // 날짜 선택기
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 20,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  selectedDateContainer: {
    alignItems: 'center',
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555555',
  },

  // 요일 선택
  daySelectorScroll: {
    marginBottom: 24,
  },
  daySelectorContent: {
    paddingHorizontal: 24,
    flexDirection: 'row',
  },
  dayButton: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minWidth: 50,
    height: 70,
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#40B59F',
    shadowColor: '#40B59F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }],
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 2,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#888888',
  },
  dayNameSelected: {
    color: '#FFFFFF',
  },
  dayDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    height: 6,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // 캘린더 섹션
  calendarSection: {
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 20,
  },

  // 주간 네비게이션
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  navButtonText: {
    fontSize: 20,
    color: '#40B59F',
    fontWeight: 'bold',
  },
  weekTitleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 20,
  },
  weekTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  weekSubtitle: {
    fontSize: 14,
    color: '#40B59F',
    fontWeight: '500',
  },

  // 주간 달력
  weekCalendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    paddingVertical: 8,
  },
  sundayHeader: {
    color: '#FF6B6B',
  },
  dateGrid: {
    flexDirection: 'row',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 3,
  },
  monthDateCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 8,
    position: 'relative',
  },
  otherMonthText: {
    color: '#CCCCCC',
  },
  todayCell: {
    backgroundColor: '#F0F9F2',
    borderWidth: 2,
    borderColor: '#40B59F',
  },
  selectedCell: {
    backgroundColor: '#40B59F',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  sundayText: {
    color: '#FF6B6B',
  },
  todayText: {
    color: '#40B59F',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  scheduleIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#40B59F',
  },
  scheduleCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // 일정 미리보기
  schedulePreview: {
    marginTop: 8,
    width: '100%',
  },
  schedulePreviewText: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 12,
  },
  schedulePreviewTextSelected: {
    color: '#FFFFFF',
  },

  // 스케줄 섹션
  scheduleSection: {
    marginHorizontal: 24,
    marginTop: 0,
    marginBottom: 24,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  scheduleSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  scheduleFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterText: {
    fontSize: 14,
    color: '#666666',
    marginRight: 4,
  },
  filterArrow: {
    fontSize: 12,
    color: '#666666',
  },

  // 시간대별 일정
  timeScheduleContainer: {
    marginTop: 10,
  },
  timeScheduleItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timeColumn: {
    width: 80,
    alignItems: 'center',
    paddingTop: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  scheduleColumn: {
    flex: 1,
    marginLeft: 16,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleCardCompleted: {
    backgroundColor: '#F7F8FA',
  },
  scheduleCardCancelled: {
    backgroundColor: '#FBF3F3',
  },
  scheduleIconContainer: {
    marginRight: 16,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scheduleStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F5E8',
  },
  scheduleStatusBadgeCompleted: {
    backgroundColor: '#E0F2F1',
  },
  scheduleStatusBadgeCancelled: {
    backgroundColor: '#FFE0E0',
  },
  scheduleStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2B6CB0',
  },
  scheduleStatusBadgeTextCompleted: {
    color: '#2C7A4B',
  },
  scheduleStatusBadgeTextCancelled: {
    color: '#C53030',
  },
  scheduleShareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#F1F3F5',
  },
  scheduleShareBadgeOn: {
    backgroundColor: '#E8F9F5',
  },
  scheduleShareBadgeOff: {
    backgroundColor: '#F3F4F6',
  },
  scheduleShareBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A5568',
  },
  scheduleShareBadgeTextOn: {
    color: Colors.primary,
  },
  scheduleShareBadgeTextOff: {
    color: Colors.textSecondary,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    marginBottom: 4,
  },
  scheduleTimeCompleted: {
    color: '#A0AEC0',
    textDecorationLine: 'line-through',
  },
  scheduleArrow: {
    marginLeft: 16,
  },
  scheduleCardBlue: {
    backgroundColor: '#E3F2FD',
  },
  scheduleCardGreen: {
    backgroundColor: '#E8F5E8',
  },
  scheduleCardOrange: {
    backgroundColor: '#FFF3E0',
  },
  scheduleCardContent: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 6,
  },
  scheduleTitleCompleted: {
    color: '#718096',
    textDecorationLine: 'line-through',
  },
  scheduleDescription: {
    fontSize: 15,
    color: '#5A6C7D',
    lineHeight: 20,
  },
  scheduleDescriptionCompleted: {
    color: '#A0AEC0',
  },
  scheduleSubsection: {
    marginBottom: 16,
  },
  scheduleSubsectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 12,
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleIconDefault: {
    backgroundColor: Colors.primary,
  },
  scheduleIconMedicine: {
    backgroundColor: Colors.error,
  },
  scheduleIconHospital: {
    backgroundColor: Colors.warning,
  },
  scheduleIconExercise: {
    backgroundColor: Colors.success,
  },
  scheduleIconMeal: {
    backgroundColor: Colors.info,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999999',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999999',
    marginTop: 16,
  },
  // 보호자용 어르신 선택기
  elderlySelectorContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  elderlySelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  elderlySelectorScroll: {
    flexDirection: 'row',
  },
  elderlySelectorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  elderlySelectorButtonActive: {
    backgroundColor: Colors.primary,
  },
  elderlySelectorButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  elderlySelectorButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // 보호자용 공유 필터
  sharedFilterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  sharedFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sharedFilterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sharedFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  sharedFilterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scheduleDate: {
    fontSize: 12,
    color: '#40B59F',
    fontWeight: '600',
    marginBottom: 2,
  },
  scheduleAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#40B59F',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scheduleActionIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // 일기 작성 및 일정 추가 버튼 섹션
  addButtonSection: {
    flexDirection: 'row',
    marginHorizontal: Math.max(16, Dimensions.get('window').width * 0.06),
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
  },
  addDiaryButton: {
    flex: 1,
    backgroundColor: '#6FCDB7',
    borderRadius: 20,
    paddingVertical: Math.max(16, Dimensions.get('window').height * 0.022),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    minHeight: 56,
  },
  addDiaryButtonText: {
    color: Colors.textWhite,
    fontSize: Math.max(14, Dimensions.get('window').width * 0.04),
    fontWeight: '600',
    marginLeft: 6,
  },
  addScheduleButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: Math.max(16, Dimensions.get('window').height * 0.022),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    minHeight: 56,
  },
  addScheduleText: {
    color: Colors.textWhite,
    fontSize: Math.max(14, Dimensions.get('window').width * 0.04),
    fontWeight: '600',
    marginLeft: 6,
  },
  addScheduleButtonFullWidth: {
    flex: 1,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get('window').height * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  timeDisplayText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  // 날짜 선택 스타일
  datePickerContainer: {
    position: 'relative',
    zIndex: 1,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  datePickerText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    flex: 1,
  },
  datePickerPlaceholder: {
    color: '#999999',
  },
  datePickerDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
    overflow: 'hidden',
  },
  // 시간 선택 스타일
  timePickerContainer: {
    position: 'relative',
    zIndex: 1,
  },
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  timePickerText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  timePickerPlaceholder: {
    color: '#999999',
  },
  timePickerDropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    maxHeight: Math.min(250, Dimensions.get('window').height * 0.3),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  timePickerScroll: {
    maxHeight: Math.min(250, Dimensions.get('window').height * 0.3),
  },
  timePickerScrollContent: {
    paddingVertical: 4,
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  timePickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timePickerOptionSelected: {
    backgroundColor: '#E6F7F4',
  },
  timePickerOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  timePickerOptionTextSelected: {
    color: '#40B59F',
    fontWeight: '600',
  },

  modalFooter: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  saveButton: {
    backgroundColor: '#40B59F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#40B59F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // 중앙 모달 스타일
  centeredModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  centeredModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centeredModalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: Dimensions.get('window').height * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  centeredModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  centeredModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
  },
  centeredCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredModalBody: {
    maxHeight: Dimensions.get('window').height * 0.5,
    padding: 20,
  },
  centeredModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  centeredDatePickerContainer: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    overflow: 'hidden',
  },

  // 시간 선택 스크롤 휠 스타일
  timeWheelContainer: {
    marginTop: 12,
    height: isSmallScreen ? 160 : isMediumScreen ? 180 : 200,
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    overflow: 'hidden',
    zIndex: 10,
  },
  timeWheelMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#E9ECEF',
    borderBottomColor: '#E9ECEF',
    zIndex: 1,
    pointerEvents: 'none',
  },
  timeWheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: isSmallScreen ? 160 : isMediumScreen ? 180 : 200,
  },
  timeWheelColumn: {
    flex: 1,
    height: '100%',
  },
  timeWheelScroll: {
    flex: 1,
  },
  timeWheelContent: {
    paddingVertical: isSmallScreen ? 55 : isMediumScreen ? 65 : 75,
  },
  timeWheelSeparator: {
    fontSize: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    fontWeight: '700',
    color: '#40B59F',
    marginHorizontal: 8,
    marginTop: isSmallScreen ? 5 : isMediumScreen ? 5 : 5,
  },
  timeWheelUnitContainer: {
    width: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  timeWheelUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    height: 50,
    lineHeight: 50,
  },
  timeWheelItem: {
    height: isSmallScreen ? 40 : isMediumScreen ? 45 : 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : 16,
  },
  timeWheelItemSelected: {
    backgroundColor: '#E6F7F4',
  },
  timeWheelItemText: {
    fontSize: isSmallScreen ? 16 : isMediumScreen ? 17 : 18,
    color: '#666666',
    fontWeight: '400',
  },
  timeWheelItemTextSelected: {
    color: '#40B59F',
    fontWeight: '700',
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 19 : 20,
  },

  // 년/월 피커 스타일
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  pickerCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#666666',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  pickerDoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#40B59F',
  },
  pickerContent: {
    flexDirection: 'row',
    height: 200,
  },
  pickerColumn: {
    flex: 1,
    position: 'relative',
  },
  pickerMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
    pointerEvents: 'none',
  },
  pickerScroll: {
    flex: 1,
    paddingVertical: 80, // 상하 여백
  },
  pickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0,
  },
  pickerItemSelected: {
    backgroundColor: 'transparent',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '400',
  },
  pickerItemTextSelected: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '600',
  },

  // 월간 달력 스타일
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewToggleText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },

  // 필터 탭 스타일
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 4,
    margin: 16,
    marginBottom: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: Colors.textWhite,
    fontWeight: '600',
  },
  monthlyCalendarContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  monthlySchedulePreview: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  previewSection: {
    marginBottom: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  monthlyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  monthlyAddButtonText: {
    fontSize: 12,
    color: Colors.textWhite,
    marginLeft: 4,
    fontWeight: '500',
  },
  previewList: {
    gap: 8,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  previewIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  previewIconDefault: {
    backgroundColor: Colors.primary,
  },
  previewIconMedicine: {
    backgroundColor: Colors.error,
  },
  previewIconHospital: {
    backgroundColor: Colors.warning,
  },
  previewIconExercise: {
    backgroundColor: Colors.success,
  },
  previewIconMeal: {
    backgroundColor: Colors.info,
  },
  previewText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  previewMore: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
    marginTop: 4,
  },
  previewEmpty: {
    fontSize: 14,
    color: Colors.textLight,
    fontStyle: 'italic',
  },

  // 일정 상세 모달 스타일
  detailModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalContent: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
    width: '90%',
    alignSelf: 'center',
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  detailCloseButton: {
    padding: 4,
  },
  detailModalBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  detailInfoSection: {
    paddingVertical: 20,
  },
  detailInfoRow: {
    marginBottom: 16,
  },
  detailInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  detailInfoValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
  },
  detailCategoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primaryPale,
  },
  detailCategoryMedicine: {
    backgroundColor: Colors.errorLight,
  },
  detailCategoryHospital: {
    backgroundColor: Colors.warningLight,
  },
  detailCategoryExercise: {
    backgroundColor: Colors.successLight,
  },
  detailCategoryMeal: {
    backgroundColor: Colors.infoLight,
  },
  detailCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
  },
  detailStatusBadgeCompleted: {
    backgroundColor: '#E0F2F1',
  },
  detailStatusBadgeCancelled: {
    backgroundColor: '#FFE0E0',
  },
  detailStatusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2B6CB0',
  },
  detailStatusBadgeTextCompleted: {
    color: '#2C7A4B',
  },
  detailStatusBadgeTextCancelled: {
    color: '#C53030',
  },
  detailShareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  detailShareBadgeOn: {
    borderColor: Colors.primary,
    backgroundColor: '#E8F9F5',
  },
  detailShareBadgeOff: {
    borderColor: '#CBD5E0',
    backgroundColor: '#F1F3F5',
  },
  detailShareBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  detailShareBadgeTextOn: {
    color: Colors.primary,
  },
  detailShareBadgeTextOff: {
    color: Colors.textSecondary,
  },
  detailModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 12,
  },
  detailEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryPale,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  detailEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 6,
  },
  detailDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.errorLight,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  detailDeleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginLeft: 6,
  },
  detailNoticeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailNoticeText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  detailCompleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryPale,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  detailCompleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 6,
  },
  detailCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
  },
  detailCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 6,
  },

  // 일기 미리보기 스타일
  diaryPreviewCard: {
    backgroundColor: '#FFF9F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0', // 기본 색상, 동적으로 변경됨
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  diaryPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  diaryPreviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  diaryPreviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  diaryAuthorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  diaryAuthorBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  diaryPreviewContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },

  // 일간 뷰 일기 카드 스타일
  diaryCard: {
    backgroundColor: '#FFF9F5',
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  diaryCardContent: {
    flex: 1,
  },
  diaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  diaryCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  // 일기 배지 스타일
  diaryBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  diaryPhotoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
  },
  diaryPhotoCountText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
  },
  diaryCommentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
  },
  diaryCommentCountText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  // 공유 토글 스타일
  shareToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F8FF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0F2F1',
    minHeight: 80,
  },
  shareToggleLeft: {
    flex: 1,
    marginRight: 16,
  },
  shareToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareToggleIcon: {
    marginRight: 10,
  },
  shareToggleLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  shareToggleHint: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  // 카테고리 선택 스타일
  categoryGridInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    // gap 대신 margin을 사용하여 정확한 3x2 배치
  },
  categoryCardInline: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    // margin은 CategorySelector 내부에서 처리
  },
  categoryCardInlineDisabled: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    // CategorySelector 카드와 동일하게 그림자 제거
    overflow: 'hidden',
    marginRight: 0, // 마지막 카드이므로 marginRight 제거
    marginBottom: 10,
  },
  decorativeCharacterImage: {
    width: 75,
    height: 75,
  },
  categoryCardInlineSelected: {
    borderColor: '#34B79F',
    backgroundColor: '#F0FDFA',
    shadowColor: '#34B79F',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryCardIconContainerInline: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryCardTextInline: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryCardTextInlineSelected: {
    color: '#34B79F',
    fontWeight: '700',
  },
});

export default CalendarScreen;
