/**
 * 어르신 통합 캘린더 화면 (달력 + 일정 추가)
 */
import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header, BottomNavigationBar } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScheduleItem {
  id: string;
  title: string;
  description: string;
  time: string;
  date: string;
}

export const CalendarScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // 선택된 날짜 상태
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  
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
  
  // 목업 데이터
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    {
      id: '1',
      title: '친구와 점심',
      description: '오랜만에 만나는 친구와 점심 약속',
      time: '오후 12시',
      date: '2024-01-15',
    },
    {
      id: '2',
      title: '독서 모임',
      description: '월간 독서 모임 참석',
      time: '오후 2시',
      date: '2024-01-20',
    },
    {
      id: '3',
      title: '가족 모임',
      description: '딸 가족과 저녁 식사',
      time: '오후 6시',
      date: '2024-01-25',
    },
  ]);

  const timeOptions = [
    '오전 6시', '오전 7시', '오전 8시', '오전 9시', '오전 10시',
    '오전 11시', '오후 12시', '오후 1시', '오후 2시', '오후 3시',
    '오후 4시', '오후 5시', '오후 6시', '오후 7시', '오후 8시',
    '오후 9시', '하루 종일'
  ];

  const handleAddSchedule = () => {
    // 기본 날짜로 일정 추가 모달 열기
    setNewSchedule({ 
      ...newSchedule, 
      date: selectedDate ? `2024-01-${selectedDate.toString().padStart(2, '0')}` : '2024-01-15'
    });
    setShowAddModal(true);
  };

  const handleDateSelect = (day: number) => {
    setSelectedDate(day);
    // 선택된 날짜로 일정 추가 모달 열기
    setNewSchedule({ 
      ...newSchedule, 
      date: `2024-01-${day.toString().padStart(2, '0')}` 
    });
    setShowAddModal(true);
  };

  const handleSaveSchedule = () => {
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

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      title: newSchedule.title,
      description: newSchedule.description,
      time: newSchedule.time,
      date: '2024-01-15', // 실제로는 선택된 날짜
    };

    setSchedules(prev => [...prev, newItem]);
    setNewSchedule({ title: '', description: '', time: '', date: '' });
    setShowAddModal(false);
    Alert.alert('저장 완료', '일정이 추가되었습니다.');
  };

  const handleCancelAdd = () => {
    setNewSchedule({ title: '', description: '', time: '', date: '' });
    setShowAddModal(false);
    setShowTimePicker(false); // 시간 선택 모달도 함께 닫기
  };


  const handleDeleteSchedule = (scheduleId: string) => {
    Alert.alert(
      '일정 삭제',
      '이 일정을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setSchedules(prev => prev.filter(s => s.id !== scheduleId));
            Alert.alert('삭제 완료', '일정이 삭제되었습니다.');
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header title="달력" showBackButton />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 탭 네비게이션 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabTextActive}>캘린더</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>요약</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>리뷰</Text>
          </TouchableOpacity>
        </View>

        {/* 월간 달력 영역 */}
        <View style={styles.calendarSection}>
          <Text style={styles.monthTitle}>2024년 1월</Text>
          <View style={styles.calendarContainer}>
            {/* 요일 헤더 */}
            <View style={styles.weekHeader}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`day-${index}`} style={[
                  styles.dayHeader,
                  index === 0 && styles.sundayHeader
                ]}>{day}</Text>
              ))}
            </View>
            
            {/* 달력 날짜들 */}
            <View style={styles.calendarGrid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const hasSchedule = schedules.some(s => 
                  new Date(s.date).getDate() === day
                );
                const isSelected = selectedDate === day;
                const dayOfWeek = (day - 1) % 7;
                const isSunday = dayOfWeek === 0;
                
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayCell,
                      isSelected && styles.daySelected,
                    ]}
                    onPress={() => handleDateSelect(day)}
                  >
                    <Text style={[
                      styles.dayText,
                      isSunday && styles.sundayText,
                      isSelected && styles.dayTextSelected,
                    ]}>
                      {day}
                    </Text>
                    {hasSchedule && <View style={styles.eventDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 일정 추가 버튼 */}
        <View style={styles.addScheduleSection}>
          <TouchableOpacity
            style={styles.addScheduleButton}
            onPress={handleAddSchedule}
            activeOpacity={0.7}
          >
            <Text style={styles.addScheduleIcon}>➕</Text>
            <Text style={styles.addScheduleText}>
              {selectedDate ? `${selectedDate}일 일정 만들기` : '일정 만들기'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 일정 목록 */}
        <View style={styles.scheduleSection}>
          <Text style={styles.scheduleSectionTitle}>이번 달 일정</Text>
          {schedules.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>등록된 일정이 없습니다</Text>
              <Text style={styles.emptySubText}>+ 버튼을 눌러 일정을 추가해보세요</Text>
            </View>
          ) : (
            schedules.map((schedule) => (
              <View
                key={schedule.id}
                style={styles.scheduleCard}
              >
                <View style={styles.scheduleContent}>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleTitle}>{schedule.title}</Text>
                    <Text style={styles.scheduleDate}>{formatDate(schedule.date)}</Text>
                    <Text style={styles.scheduleTime}>{schedule.time}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
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
                <Text style={styles.closeButtonText}>✕</Text>
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
                  <Text style={styles.dropdownIcon}>{showTimePicker ? '▲' : '▼'}</Text>
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
  
  // 탭 네비게이션
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#40B59F',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#40B59F',
  },

  // 캘린더 섹션
  calendarSection: {
    margin: 20,
    marginBottom: 15,
  },
  monthTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    paddingVertical: 8,
  },
  sundayHeader: {
    color: '#FF6B6B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 8,
    position: 'relative',
  },
  daySelected: {
    backgroundColor: '#40B59F',
    borderRadius: 12,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  sundayText: {
    color: '#FF6B6B',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#40B59F',
  },
  
  // 스케줄 섹션
  scheduleSection: {
    margin: 20,
    marginTop: 0,
  },
  scheduleSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
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
  scheduleCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  scheduleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#40B59F',
    marginBottom: 4,
  },
  scheduleDate: {
    fontSize: 12,
    color: '#40B59F',
    fontWeight: '600',
    marginBottom: 2,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
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
    margin: 20,
    marginTop: 5,
    marginBottom: 15,
  },
  addScheduleButton: {
    backgroundColor: '#40B59F',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#40B59F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addScheduleIcon: {
    fontSize: 20,
    marginRight: 8,
    color: '#FFFFFF',
  },
  addScheduleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  closeButtonText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: 'bold',
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
  dropdownIcon: {
    fontSize: 12,
    color: '#40B59F',
    fontWeight: 'bold',
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
});
