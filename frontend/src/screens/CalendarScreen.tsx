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
    if (selectedDate) {
      setNewSchedule({ 
        ...newSchedule, 
        date: `2024-01-${selectedDate.toString().padStart(2, '0')}` 
      });
    }
    setShowAddModal(true);
  };

  const handleDateSelect = (day: number) => {
    setSelectedDate(day);
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
    setNewSchedule({ title: '', description: '', time: '' });
    setShowAddModal(false);
    Alert.alert('저장 완료', '일정이 추가되었습니다.');
  };

  const handleCancelAdd = () => {
    setNewSchedule({ title: '', description: '', time: '' });
    setShowAddModal(false);
  };

  const handleSchedulePress = (scheduleId: string) => {
    router.push(`/todo-detail?id=${scheduleId}&type=schedule`);
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
        {/* 월간 달력 영역 */}
        <View style={styles.calendarSection}>
          <Text style={styles.sectionTitle}>2024년 1월</Text>
          <View style={styles.calendarGrid}>
            {/* 요일 헤더 */}
            <View style={styles.weekHeader}>
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <Text key={day} style={styles.dayHeader}>{day}</Text>
              ))}
            </View>
            
            {/* 달력 날짜들 */}
            <View style={styles.calendarDays}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const hasSchedule = schedules.some(s => 
                  new Date(s.date).getDate() === day
                );
                const isSelected = selectedDate === day;
                
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayCell,
                      hasSchedule && styles.dayWithSchedule,
                      isSelected && styles.daySelected,
                    ]}
                    onPress={() => handleDateSelect(day)}
                  >
                    <Text style={[
                      styles.dayText,
                      hasSchedule && styles.dayTextWithSchedule,
                      isSelected && styles.dayTextSelected,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 일정 목록 */}
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>이번 달 일정</Text>
          {schedules.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>등록된 일정이 없습니다</Text>
              <Text style={styles.emptySubText}>+ 버튼을 눌러 일정을 추가해보세요</Text>
            </View>
          ) : (
            schedules.map((schedule) => (
              <TouchableOpacity
                key={schedule.id}
                style={styles.scheduleCard}
                onPress={() => handleSchedulePress(schedule.id)}
                activeOpacity={0.7}
              >
                <View style={styles.scheduleHeader}>
                  <View style={styles.scheduleLeft}>
                    <Text style={styles.scheduleIcon}>📅</Text>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleTitle}>{schedule.title}</Text>
                      <Text style={styles.scheduleDescription}>
                        {schedule.description}
                      </Text>
                      <View style={styles.scheduleMeta}>
                        <Text style={styles.scheduleDate}>
                          {formatDate(schedule.date)}
                        </Text>
                        <Text style={styles.scheduleTime}>{schedule.time}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.scheduleRight}>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteSchedule(schedule.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteButtonText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
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

        {/* 하단 여백 */}
        <View style={[styles.bottomSpacer, { height: 100 + Math.max(insets.bottom, 10) }]} />
      </ScrollView>

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />

      {/* 일정 추가 모달 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelAdd}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>일정 추가</Text>
              <TouchableOpacity onPress={handleCancelAdd} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
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
                    <ScrollView style={styles.timePickerScroll} nestedScrollEnabled>
                      {timeOptions.map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={[
                            styles.timeOption,
                            newSchedule.time === time && styles.timeOptionSelected,
                          ]}
                          onPress={() => {
                            setNewSchedule({ ...newSchedule, time });
                            setShowTimePicker(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.timeOptionText,
                            newSchedule.time === time && styles.timeOptionTextSelected,
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* 직접 입력 */}
                <TextInput
                  style={styles.timeInput}
                  value={newSchedule.time}
                  onChangeText={(text) => setNewSchedule({ ...newSchedule, time: text })}
                  placeholder="또는 직접 입력해주세요 (예: 오후 3시 30분)"
                  placeholderTextColor="#999999"
                />
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
        </View>
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
  calendarSection: {
    margin: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 15,
  },
  calendarGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FF9500',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    paddingVertical: 8,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  dayWithSchedule: {
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  daySelected: {
    backgroundColor: '#FF9500',
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  dayTextWithSchedule: {
    color: '#FF9500',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scheduleSection: {
    margin: 20,
    marginTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999999',
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scheduleIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  scheduleDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  scheduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleDate: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
    marginRight: 12,
  },
  scheduleTime: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  scheduleRight: {
    alignItems: 'flex-end',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 20,
  },
  // 일정 추가 버튼
  addScheduleSection: {
    margin: 20,
    marginTop: 10,
  },
  addScheduleButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  addScheduleIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  addScheduleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  descriptionInput: {
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  // 시간 드롭다운 스타일
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF9500',
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
    color: '#FF9500',
    fontWeight: 'bold',
  },
  timePickerDropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 12,
    maxHeight: 200,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timePickerScroll: {
    maxHeight: 200,
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeOptionSelected: {
    backgroundColor: '#FFF4E6',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#333333',
  },
  timeOptionTextSelected: {
    color: '#FF9500',
    fontWeight: '700',
  },
  timeInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333333',
    backgroundColor: '#F8F9FA',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
