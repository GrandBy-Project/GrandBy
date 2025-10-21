/**
 * 어르신 통합 캘린더 화면 (주간 달력 + 일정 추가)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header, BottomNavigationBar } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TodoItem, getTodosByRange, createTodo, deleteTodo } from '../api/todo';
import { useAuthStore } from '../store/authStore';

export const CalendarScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  // 날짜 선택 상태
  const [selectedDay, setSelectedDay] = useState(new Date());
  
  // 현재 주 상태
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // 년/월 피커 상태
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  // 시간 드롭다운 상태
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // 일정 추가 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    title: '',
    description: '',
    time: '',
    date: '',
  });
  
  // API 연동: TodoItem 타입 사용
  const [schedules, setSchedules] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const timeOptions = [
    '오전 6시', '오전 7시', '오전 8시', '오전 9시', '오전 10시',
    '오전 11시', '오후 12시', '오후 1시', '오후 2시', '오후 3시',
    '오후 4시', '오후 5시', '오후 6시', '오후 7시', '오후 8시',
    '오후 9시', '하루 종일'
  ];

  // 시간 형식 변환 함수
  const convertKoreanTimeToHHMM = (koreanTime: string): string => {
    if (koreanTime === '하루 종일') return '00:00';
    
    const match = koreanTime.match(/(오전|오후)\s*(\d+)시/);
    if (!match) return '00:00';
    
    const [, period, hourStr] = match;
    let hour = parseInt(hourStr, 10);
    
    if (period === '오후' && hour !== 12) {
      hour += 12;
    } else if (period === '오전' && hour === 12) {
      hour = 0;
    }
    
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const convertHHMMToKoreanTime = (timeStr: string | null): string => {
    if (!timeStr) return '시간 미정';
    
    const [hourStr, minute] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    
    if (hour === 0 && minute === '00') return '하루 종일';
    
    const period = hour >= 12 ? '오후' : '오전';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    
    return `${period} ${hour}시`;
  };

  // 날짜 범위별 일정 조회
  const loadSchedules = async () => {
    if (!user) {
      console.log('⚠️ 사용자 정보 없음, 조회 중단');
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
      
      // 현재 보이는 날짜 범위 계산 (selectedDay 기준으로 ±2주)
      const startDate = new Date(selectedDay);
      startDate.setDate(startDate.getDate() - 14);
      
      const endDate = new Date(selectedDay);
      endDate.setDate(endDate.getDate() + 21);
      
      const startDateStr = formatDateString(startDate);
      const endDateStr = formatDateString(endDate);
      
      console.log(`📅 캘린더 일정 조회 시작`);
      console.log(`  - 사용자 ID: ${user.user_id}`);
      console.log(`  - 사용자 역할: ${user.role}`);
      console.log(`  - 날짜 범위: ${startDateStr} ~ ${endDateStr}`);
      
      const todos = await getTodosByRange(startDateStr, endDateStr);
      
      console.log(`✅ 조회된 일정: ${todos.length}개`);
      setSchedules(todos);
    } catch (error: any) {
      console.error('❌ 일정 조회 실패:', error);
      console.error('❌ 에러 상세:', JSON.stringify(error, null, 2));
      console.error('❌ 응답 데이터:', error.response?.data);
      console.error('❌ 응답 상태:', error.response?.status);
      Alert.alert('오류', `일정을 불러오는데 실패했습니다.\n${error.message || JSON.stringify(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 & selectedDay 변경 시 일정 로딩
  useEffect(() => {
    loadSchedules();
  }, [selectedDay]);

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

  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSameDate = (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  };

  const getSchedulesForDate = (date: Date) => {
    const dateString = formatDateString(date);
    return schedules.filter(schedule => schedule.due_date === dateString);
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

  // 날짜 선택기 함수들 - 더 많은 날짜 생성
  const getExtendedDates = (centerDate: Date) => {
    const dates = [];
    const startDate = new Date(centerDate);
    startDate.setDate(startDate.getDate() - 14); // 2주 전부터 시작
    
    for (let i = 0; i < 35; i++) { // 5주치 날짜
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const goToPreviousDay = () => {
    const newDay = new Date(selectedDay);
    newDay.setDate(newDay.getDate() - 1);
    setSelectedDay(newDay);
  };

  const goToNextDay = () => {
    const newDay = new Date(selectedDay);
    newDay.setDate(newDay.getDate() + 1);
    setSelectedDay(newDay);
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

  const handleAddSchedule = () => {
    // 선택된 날짜 또는 오늘 날짜로 일정 추가 모달 열기
    const targetDate = selectedDate || new Date();
    setNewSchedule({ 
      ...newSchedule, 
      date: formatDateString(targetDate)
    });
    setShowAddModal(true);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // 날짜만 선택하고 모달은 열지 않음
  };

  const handleSaveSchedule = async () => {
    if (!newSchedule.title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
      return;
    }
    
    if (!newSchedule.description.trim()) {
      Alert.alert('알림', '내용을 입력해주세요.');
      return;
    }

    if (!newSchedule.time) {
      Alert.alert('알림', '시간을 선택해주세요.');
      return;
    }

    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    try {
      setIsLoading(true);
      
      // 시간 형식 변환: "오후 12시" → "12:00"
      const timeHHMM = convertKoreanTimeToHHMM(newSchedule.time);
      
      console.log('📝 일정 생성 요청:', {
        title: newSchedule.title,
        due_date: newSchedule.date,
        due_time: timeHHMM,
      });
      
      await createTodo({
        elderly_id: user.user_id,
        title: newSchedule.title,
        description: newSchedule.description,
        due_date: newSchedule.date,
        due_time: timeHHMM,
        category: 'other', // 기본 카테고리
      });
      
      console.log('✅ 일정 생성 성공');
      
      // 일정 다시 불러오기
      await loadSchedules();
      
      setNewSchedule({ title: '', description: '', time: '', date: '' });
      setShowAddModal(false);
      Alert.alert('저장 완료', '일정이 추가되었습니다.');
    } catch (error: any) {
      console.error('❌ 일정 생성 실패:', error);
      Alert.alert('오류', '일정을 저장하는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAdd = () => {
    setNewSchedule({ title: '', description: '', time: '', date: '' });
    setShowAddModal(false);
    setShowTimePicker(false); // 시간 선택 모달도 함께 닫기
  };


  const handleDeleteSchedule = (todoId: string) => {
    Alert.alert(
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
              
              Alert.alert('삭제 완료', '일정이 삭제되었습니다.');
            } catch (error: any) {
              console.error('❌ 일정 삭제 실패:', error);
              Alert.alert('오류', '일정을 삭제하는데 실패했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };


  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header title="달력" showBackButton />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 날짜 선택기 */}
        <View style={styles.dateSelector}>
          <TouchableOpacity 
            style={styles.dateNavButton}
            onPress={goToPreviousDay}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#666666" />
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
            onPress={goToNextDay}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={20} color="#666666" />
          </TouchableOpacity>
        </View>

        {/* 날짜 선택 */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.daySelectorScroll}
          contentContainerStyle={styles.daySelectorContent}
        >
          {getExtendedDates(selectedDay).map((date, index) => {
            const isSelected = isSameDate(date, selectedDay);
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayButton,
                  isSelected && styles.dayButtonSelected
                ]}
                onPress={() => setSelectedDay(date)}
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>


        {/* 일정 추가 버튼 */}
        <View style={styles.addScheduleSection}>
          <TouchableOpacity
            style={styles.addScheduleButton}
            onPress={handleAddSchedule}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text style={styles.addScheduleText}>
              {selectedDate ? `${formatDate(selectedDate)} 일정 추가` : '일정 추가'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 시간대별 일정 목록 */}
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleSectionTitle}>
              {selectedDate ? `${formatDate(selectedDate)} 일정` : '오늘의 일정'}
            </Text>
            <View style={styles.filterContainer}>
              <Text style={styles.filterText}>전체</Text>
              <Text style={styles.filterArrow}>▼</Text>
            </View>
          </View>
          
          {(() => {
            const targetDateString = formatDateString(selectedDay);
            const filteredSchedules = schedules.filter(schedule => schedule.due_date === targetDateString);
            
            if (isLoading) {
              return (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color="#40B59F" />
                  <Text style={styles.emptySubText}>일정을 불러오는 중...</Text>
                </View>
              );
            }
            
            if (filteredSchedules.length === 0) {
              return (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {selectedDate ? `${formatDate(selectedDate)} 등록된 일정이 없습니다` : '오늘 등록된 일정이 없습니다'}
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
            
            return (
              <View style={styles.timeScheduleContainer}>
                {sortedSchedules.map((schedule, index) => (
                  <TouchableOpacity
                    key={schedule.todo_id}
                    style={styles.scheduleCard}
                    onPress={() => handleDeleteSchedule(schedule.todo_id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.scheduleIconContainer}>
                      <View style={[
                        styles.scheduleIcon,
                        index % 3 === 0 && styles.scheduleIconBlue,
                        index % 3 === 1 && styles.scheduleIconGreen,
                        index % 3 === 2 && styles.scheduleIconOrange,
                      ]}>
                        <Ionicons 
                          name={
                            schedule.title.includes('약') || schedule.category === 'medicine' ? 'medical' : 
                            schedule.title.includes('병원') || schedule.category === 'hospital' ? 'medical-outline' :
                            schedule.category === 'exercise' ? 'fitness-outline' :
                            schedule.category === 'meal' ? 'restaurant-outline' :
                            'calendar-outline'
                          }
                          size={24} 
                          color="#FFFFFF" 
                        />
                      </View>
                    </View>
                    
                    <View style={styles.scheduleContent}>
                      <Text style={styles.scheduleTitle}>{schedule.title}</Text>
                      <Text style={styles.scheduleTime}>{convertHHMMToKoreanTime(schedule.due_time)}</Text>
                      {schedule.description && (
                        <Text style={styles.scheduleDescription}>{schedule.description}</Text>
                      )}
                    </View>
                    
                    <View style={styles.scheduleArrow}>
                      <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
        </View>


        {/* 하단 여백 */}
        <View style={{ height: 100 + Math.max(insets.bottom, 10) }} />
      </ScrollView>

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />

      {/* 일정 추가 모달 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelAdd}
        presentationStyle="overFullScreen"
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>일정 추가</Text>
              <TouchableOpacity onPress={handleCancelAdd} style={styles.closeButton}>
                <Ionicons name="close" size={18} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
              {/* 제목 입력 */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>제목</Text>
                <TextInput
                  style={styles.titleInput}
                  value={newSchedule.title}
                  onChangeText={(text) => setNewSchedule({ ...newSchedule, title: text })}
                  placeholder="일정 제목을 입력해주세요"
                  placeholderTextColor="#999999"
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
                  placeholderTextColor="#999999"
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* 시간 선택 */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>시간</Text>
                
                {/* 드롭다운 선택 버튼 */}
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowTimePicker(!showTimePicker)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.timePickerText,
                    !newSchedule.time && styles.timePickerPlaceholder
                  ]}>
                    {newSchedule.time || '시간을 선택해주세요'}
                  </Text>
                  <Ionicons 
                    name={showTimePicker ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="#40B59F" 
                  />
                </TouchableOpacity>

                {/* 드롭다운 목록 */}
                {showTimePicker && (
                  <View style={styles.timePickerDropdown}>
                    <ScrollView 
                      style={styles.timePickerScroll} 
                      showsVerticalScrollIndicator={true}
                    >
                      {timeOptions.map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={[
                            styles.timePickerOption,
                            newSchedule.time === time && styles.timePickerOptionSelected,
                          ]}
                          onPress={() => {
                            setNewSchedule({ ...newSchedule, time });
                            setShowTimePicker(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.timePickerOptionText,
                            newSchedule.time === time && styles.timePickerOptionTextSelected,
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* 저장 버튼 */}
            <View style={styles.modalFooter}>
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

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  content: {
    flex: 1,
    backgroundColor: '#FAFBFC',
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
  filterContainer: {
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
  scheduleIconContainer: {
    marginRight: 16,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    marginBottom: 4,
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
  scheduleDescription: {
    fontSize: 15,
    color: '#5A6C7D',
    lineHeight: 20,
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleIconBlue: {
    backgroundColor: '#2196F3',
  },
  scheduleIconGreen: {
    backgroundColor: '#4CAF50',
  },
  scheduleIconOrange: {
    backgroundColor: '#FF9800',
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
  // 일정 추가 버튼
  addScheduleSection: {
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 20,
  },
  addScheduleButton: {
    backgroundColor: '#40B59F',
    borderRadius: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#40B59F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  addScheduleText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
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
    maxHeight: '85%',
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
  // 시간 선택 스타일
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
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    maxHeight: 250,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  timePickerScroll: {
    maxHeight: 200,
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
    padding: 24,
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
});

export default CalendarScreen;
