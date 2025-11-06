/**
 * 보호자용 할일 추가 화면
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Header, BottomNavigationBar, TimePicker, CategorySelector } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import * as todoApi from '../api/todo';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/Colors';
import { useAlert } from '../components/GlobalAlertProvider';
import { formatDateForDisplayWithRelative } from '../utils/dateUtils';
import { TODO_CATEGORIES } from '../constants/TodoCategories';

interface TodoItem {
  id: string;
  title: string;
  description: string;
  category: string;
  time: string;
  date: string;
  isRecurring: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly';
  reminderEnabled: boolean;
  reminderTime?: string;
}

export const GuardianTodoAddScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { show } = useAlert();
  const { elderlyId, elderlyName, todoId } = useLocalSearchParams<{
    elderlyId: string;
    elderlyName: string;
    todoId?: string;
  }>();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTodo, setIsLoadingTodo] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    category: '',
    time: '', // "오전/오후 X시" 형식 (표시용)
    timeValue: '12:00', // "HH:MM" 형식 (TimePicker용)
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    elderlyId: elderlyId || '', // 쿼리 파라미터에서 받은 어르신 ID 사용
    isRecurring: false,
    recurringType: 'daily' as 'daily' | 'weekly' | 'monthly',
    reminderEnabled: true,
    reminderTime: '',
    recurringDays: [] as number[], // 주간 반복 요일: [0,1,2,3,4,5,6] (월~일)
  });
  
  const isEditMode = !!todoId;

  // elderlyId가 없으면 뒤로가기
  useEffect(() => {
    if (!elderlyId) {
      show('오류', '어르신 정보가 없습니다.', [
        { text: '확인', onPress: () => router.back() }
      ]);
    }
  }, [elderlyId]);
  
  // 수정 모드일 때 TODO 데이터 로드
  useEffect(() => {
    const loadTodoForEdit = async () => {
      if (isEditMode && todoId) {
        setIsLoadingTodo(true);
        try {
          const todo = await todoApi.getTodoById(todoId);
          
          // 시간 변환 (HH:MM → 오전/오후 형식)
          let timeDisplay = '';
          let timeValue = todo.due_time || '12:00';
          if (todo.due_time) {
            const [hours, minutes] = todo.due_time.split(':');
            const hour = parseInt(hours);
            const isPM = hour >= 12;
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            timeDisplay = `${isPM ? '오후' : '오전'} ${displayHour}시`;
          }
          
          // 반복 요일 변환
          let recurringDays: number[] = [];
          if (todo.recurring_days && Array.isArray(todo.recurring_days)) {
            recurringDays = todo.recurring_days;
          }
          
          setNewTodo({
            title: todo.title,
            description: todo.description || '',
            category: todo.category || '',
            time: timeDisplay,
            timeValue: timeValue,
            date: todo.due_date,
            elderlyId: todo.elderly_id,
            isRecurring: todo.is_recurring || false,
            recurringType: todo.recurring_type?.toLowerCase() as 'daily' | 'weekly' | 'monthly' || 'daily',
            reminderEnabled: true,
            reminderTime: '',
            recurringDays: recurringDays,
          });
        } catch (error: any) {
          console.error('TODO 로드 실패:', error);
          show('오류', '할일 정보를 불러오는데 실패했습니다.');
          router.back();
        } finally {
          setIsLoadingTodo(false);
        }
      }
    };
    
    loadTodoForEdit();
  }, [isEditMode, todoId]);

  // 로딩 중일 때 표시
  if (isLoadingTodo) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingTop: 100 }]}> 
        <ActivityIndicator size="large" color="#34B79F" />
        <Text style={{ marginTop: 16, color: '#666666' }}>할일 정보를 불러오는 중...</Text>
      </View>
    );
  }

  // 모달 상태
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showWeeklyDaysModal, setShowWeeklyDaysModal] = useState(false);
  
  // 입력 필드 포커스 상태
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // 카테고리 옵션 (Backend Enum과 일치)
  // 카테고리 옵션 (공통 상수 사용)
  const categories = TODO_CATEGORIES;

  // 반복 옵션
  const recurringOptions = [
    { id: 'daily', name: '매일' },
    { id: 'weekly', name: '매주' },
    { id: 'monthly', name: '매월' },
  ];

  const handleSaveTodo = async () => {
    if (!newTodo.title.trim()) {
      show('알림', '할일 제목을 입력해주세요.');
      return;
    }

    if (!newTodo.category) {
      show('알림', '카테고리를 선택해주세요.');
      return;
    }

    if (!newTodo.timeValue) {
      show('알림', '시간을 선택해주세요.');
      return;
    }

    try {
      setIsSaving(true);

      // 시간은 이미 "HH:MM" 형식으로 저장되어 있음
      const formattedTime = newTodo.timeValue || '12:00';

      // 반복 설정에 따른 추가 데이터 처리
      const selectedDate = new Date(newTodo.date);
      const selectedDayOfMonth = selectedDate.getDate(); // 1~31
      const selectedWeekday = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1; // 월요일=0, 일요일=6
      
      if (isEditMode && todoId) {
        // 수정 모드
        const updateData: todoApi.TodoUpdateRequest = {
          title: newTodo.title,
          description: newTodo.description || undefined,
          category: newTodo.category as any,
          due_date: newTodo.date,
          due_time: formattedTime,
          is_recurring: newTodo.isRecurring,
          recurring_type: newTodo.isRecurring ? newTodo.recurringType.toUpperCase() as any : undefined,
          recurring_days: newTodo.isRecurring && newTodo.recurringType === 'weekly' 
            ? (newTodo.recurringDays.length > 0 ? newTodo.recurringDays : [selectedWeekday])
            : undefined,
          recurring_day_of_month: newTodo.isRecurring && newTodo.recurringType === 'monthly'
            ? selectedDayOfMonth
            : undefined,
        };

        console.log('📤 TODO 수정 요청:', JSON.stringify(updateData, null, 2));

        const result = await todoApi.updateTodo(todoId, updateData);
        console.log('✅ TODO 수정 성공:', result.todo_id);

        show(
          '수정 완료',
          '할일이 수정되었습니다.',
          [
            {
              text: '확인',
              onPress: () => {
                setTimeout(() => {
                  router.back();
                }, 300);
              },
            },
          ]
        );
      } else {
        // 생성 모드
        const todoData: todoApi.TodoCreateRequest = {
          elderly_id: newTodo.elderlyId,
          title: newTodo.title,
          description: newTodo.description || undefined,
          category: newTodo.category as any, // 이미 대문자로 저장됨
          due_date: newTodo.date,
          due_time: formattedTime,
          is_shared_with_caregiver: true, // 보호자와 공유 설정
          is_recurring: newTodo.isRecurring,
          recurring_type: newTodo.isRecurring ? newTodo.recurringType.toUpperCase() as any : undefined,
          recurring_days: newTodo.isRecurring && newTodo.recurringType === 'weekly' 
            ? (newTodo.recurringDays.length > 0 ? newTodo.recurringDays : [selectedWeekday])
            : undefined,
          recurring_day_of_month: newTodo.isRecurring && newTodo.recurringType === 'monthly'
            ? selectedDayOfMonth
            : undefined,
        };

        console.log('📤 TODO 생성 요청:', JSON.stringify(todoData, null, 2));

        const result = await todoApi.createTodo(todoData);
        console.log('✅ TODO 생성 성공:', result.todo_id);
        console.log('📊 생성된 할일 상세:', {
          todo_id: result.todo_id,
          title: result.title,
          due_date: result.due_date,
          is_recurring: result.is_recurring,
          is_shared_with_caregiver: result.is_shared_with_caregiver
        });

        show(
          '저장 완료',
          '어르신의 할일이 등록되었습니다.',
          [
            {
              text: '확인',
              onPress: () => {
                // 화면 이동 전에 약간의 지연을 두어 백엔드 처리 시간 확보
                setTimeout(() => {
                  router.back();
                }, 300);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('TODO 저장 실패:', error);
      show('오류', '할일 등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryById = (id: string) => {
    return categories.find(cat => cat.id === id);
  };

  // formatDate, formatDateForDisplay 함수는 공통 유틸리티 사용
  // formatDateForDisplay → formatDateForDisplayWithRelative로 대체

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Header 
        title={isEditMode 
          ? (elderlyName ? `${elderlyName}님의 할일 수정` : '할일 수정')
          : (elderlyName ? `${elderlyName}님의 할일 추가` : '할일 추가')
        } 
        showMenuButton={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 제목 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>할일 제목 *</Text>
          <TextInput
            style={styles.titleInput}
            value={newTodo.title}
            onChangeText={(text) => setNewTodo({ ...newTodo, title: text })}
            placeholder={focusedField !== 'title' ? "어르신이 해야 할 일을 입력해주세요" : undefined}
            placeholderTextColor="#999999"
            onFocus={() => setFocusedField('title')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        {/* 설명 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>상세 설명</Text>
          <TextInput
            style={styles.descriptionInput}
            value={newTodo.description}
            onChangeText={(text) => setNewTodo({ ...newTodo, description: text })}
            placeholder={focusedField !== 'description' ? "할일에 대한 자세한 설명을 입력해주세요" : undefined}
            placeholderTextColor="#999999"
            multiline
            numberOfLines={4}
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        {/* 카테고리 선택 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>카테고리 *</Text>
          <View style={styles.categoryGridInline}>
            <CategorySelector
              selectedCategory={newTodo.category}
              onSelect={(categoryId) => setNewTodo({ ...newTodo, category: categoryId })}
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

        {/* 날짜 선택 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>날짜</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePickerModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dateButtonContent}>
              <Ionicons name="calendar-outline" size={20} color="#34B79F" />
              <Text style={styles.dateButtonText}>
                {formatDateForDisplayWithRelative(newTodo.date)}
              </Text>
            </View>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* 시간 선택 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>시간 *</Text>
          <View style={styles.timePickerContainer}>
            <TimePicker
              value={newTodo.timeValue}
              compact={true}
              onChange={(time: string) => {
                // "HH:MM" 형식에서 "오전/오후 X시" 형식으로 변환
                const [hours, minutes] = time.split(':');
                const hour = parseInt(hours);
                const isPM = hour >= 12;
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                const timeDisplay = `${isPM ? '오후' : '오전'} ${displayHour}시`;
                
                setNewTodo({
                  ...newTodo,
                  time: timeDisplay,
                  timeValue: time,
                });
              }}
            />
          </View>
        </View>

        {/* 반복 설정 */}
        <View style={styles.inputSection}>
          <View style={styles.toggleSection}>
            <Text style={styles.inputLabel}>반복 설정</Text>
            <TouchableOpacity
              style={[styles.toggleButton, newTodo.isRecurring && styles.toggleButtonActive]}
              onPress={() => setNewTodo({ ...newTodo, isRecurring: !newTodo.isRecurring })}
            >
              <Text style={[
                styles.toggleButtonText,
                newTodo.isRecurring && styles.toggleButtonTextActive
              ]}>
                {newTodo.isRecurring ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {newTodo.isRecurring && (
            <>
              <TouchableOpacity
                style={styles.recurringButton}
                onPress={() => setShowRecurringModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.recurringButtonText}>
                  {recurringOptions.find(opt => opt.id === newTodo.recurringType)?.name || '반복 주기 선택'}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
              
              {newTodo.recurringType === 'weekly' && (
                <TouchableOpacity
                  style={styles.recurringButton}
                  onPress={() => setShowWeeklyDaysModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.recurringButtonText}>
                    {newTodo.recurringDays.length > 0 
                      ? `${newTodo.recurringDays.length}개 요일 선택됨`
                      : '반복 요일 선택'}
                  </Text>
                  <Text style={styles.dropdownIcon}>▼</Text>
                </TouchableOpacity>
              )}
              
              <View style={styles.recurringInfo}>
                <View style={styles.recurringInfoContent}>
                  <Ionicons name="repeat-outline" size={16} color="#34B79F" />
                  <Text style={styles.recurringInfoText}>
                    {newTodo.recurringType === 'daily' && '매일 반복됩니다'}
                    {newTodo.recurringType === 'weekly' && '선택한 요일마다 반복됩니다'}
                    {newTodo.recurringType === 'monthly' && '선택한 날짜의 날짜마다 반복됩니다'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 알림 설정 */}
        <View style={styles.inputSection}>
          <View style={styles.toggleSection}>
            <Text style={styles.inputLabel}>알림 설정</Text>
            <TouchableOpacity
              style={[styles.toggleButton, newTodo.reminderEnabled && styles.toggleButtonActive]}
              onPress={() => setNewTodo({ ...newTodo, reminderEnabled: !newTodo.reminderEnabled })}
            >
              <Text style={[
                styles.toggleButtonText,
                newTodo.reminderEnabled && styles.toggleButtonTextActive
              ]}>
                {newTodo.reminderEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {newTodo.reminderEnabled && (
            <View style={styles.reminderInfo}>
              <View style={styles.reminderInfoContent}>
                <Ionicons name="notifications-outline" size={16} color="#B8860B" />
                <Text style={styles.reminderText}>
                  설정한 시간 10분 전에 어르신께 알림이 전송됩니다.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 하단 여백 */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 저장 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
          onPress={handleSaveTodo}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>할일 등록하기</Text>
          )}
        </TouchableOpacity>
      </View>


      {/* 반복 주기 선택 모달 */}
      <Modal
        visible={showRecurringModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecurringModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>반복 주기 선택</Text>
              <TouchableOpacity 
                onPress={() => setShowRecurringModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {recurringOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.recurringOption,
                    newTodo.recurringType === option.id && styles.recurringOptionSelected,
                    index === recurringOptions.length - 1 && styles.recurringOptionLast
                  ]}
                  onPress={() => {
                    setNewTodo({ ...newTodo, recurringType: option.id as 'daily' | 'weekly' | 'monthly' });
                    setShowRecurringModal(false);
                  }}
                >
                  <Text style={[
                    styles.recurringOptionText,
                    newTodo.recurringType === option.id && styles.recurringOptionTextSelected
                  ]}>
                    {option.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 날짜 선택 모달 */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>날짜 선택</Text>
              <TouchableOpacity 
                onPress={() => setShowDatePickerModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.calendarContainer}>
              <Calendar
                onDayPress={(day) => {
                  setNewTodo({ ...newTodo, date: day.dateString });
                  setShowDatePickerModal(false);
                }}
                markedDates={{
                  [newTodo.date]: { 
                    selected: true, 
                    selectedColor: '#34B79F',
                    selectedTextColor: '#FFFFFF'
                  }
                }}
                monthFormat={'yyyy년 M월'}
                current={newTodo.date}
                minDate={new Date().toISOString().split('T')[0]}
                theme={{
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
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 12,
                }}
                enableSwipeMonths={true}
              />
              
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setNewTodo({ ...newTodo, date: today });
                  setShowDatePickerModal(false);
                }}
              >
                <Ionicons name="today-outline" size={18} color="#34B79F" />
                <Text style={styles.todayButtonText}>오늘</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 주간 반복 요일 선택 모달 */}
      <Modal
        visible={showWeeklyDaysModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeeklyDaysModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>반복 요일 선택</Text>
              <TouchableOpacity 
                onPress={() => setShowWeeklyDaysModal(false)}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {['월', '화', '수', '목', '금', '토', '일'].map((dayName, index) => {
                const isSelected = newTodo.recurringDays.includes(index);
                const isLast = index === ['월', '화', '수', '목', '금', '토', '일'].length - 1;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.weeklyDayOption,
                      isSelected && styles.weeklyDayOptionSelected,
                      isLast && styles.weeklyDayOptionLast
                    ]}
                    onPress={() => {
                      const updatedDays = isSelected
                        ? newTodo.recurringDays.filter(d => d !== index)
                        : [...newTodo.recurringDays, index];
                      setNewTodo({ ...newTodo, recurringDays: updatedDays });
                    }}
                  >
                    <Text style={[
                      styles.weeklyDayOptionText,
                      isSelected && styles.weeklyDayOptionTextSelected
                    ]}>
                      {dayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalFooterButton}
                onPress={() => setShowWeeklyDaysModal(false)}
              >
                <Text style={styles.modalFooterButtonText}>완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    padding: 20,
  },
  
  // 입력 섹션
  inputSection: {
    marginBottom: 28,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  
  // 버튼 스타일
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  categoryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  timeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#999999',
  },
  timePickerContainer: {
    marginTop: 8,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#34B79F',
    fontWeight: 'bold',
  },
  
  // 날짜 선택 버튼
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    marginLeft: 12,
  },
  
  // 토글 섹션
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#34B79F',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  
  // 반복 설정
  recurringButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  recurringButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  recurringInfo: {
    backgroundColor: '#E6F7F4',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  recurringInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recurringInfoText: {
    fontSize: 13,
    color: '#34B79F',
    lineHeight: 18,
  },
  
  // 알림 정보
  reminderInfo: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  reminderInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderText: {
    fontSize: 14,
    color: '#B8860B',
    lineHeight: 20,
    flex: 1,
  },
  
  // 하단 버튼
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  saveButton: {
    backgroundColor: '#34B79F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '70%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#999999',
    fontWeight: 'normal',
    lineHeight: 24,
  },
  modalBody: {
    maxHeight: 300,
  },
  
  // 카테고리 옵션 (인라인 그리드)
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
    // CategorySelector 카드와 동일하게 그림자 제거
    // margin은 CategorySelector 내부에서 처리하므로 여기서는 제거
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
    fontWeight: '600',
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
  
  // 카테고리 옵션 (모달용)
  categoryGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardSelected: {
    borderColor: '#34B79F',
    backgroundColor: '#F0FDFA',
    shadowColor: '#34B79F',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryCardIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryCardText: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // 시간 옵션
  timeOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeOptionSelected: {
    backgroundColor: '#E6F7F4',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
  
  // 반복 옵션
  recurringOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recurringOptionSelected: {
    backgroundColor: '#E6F7F4',
  },
  recurringOptionLast: {
    borderBottomWidth: 0,
  },
  recurringOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  recurringOptionTextSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
  
  // 주간 반복 요일 옵션
  weeklyDayOption: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  weeklyDayOptionSelected: {
    backgroundColor: '#E6F7F4',
  },
  weeklyDayOptionLast: {
    borderBottomWidth: 0,
  },
  weeklyDayOptionText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  weeklyDayOptionTextSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
  
  // 모달 푸터
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  modalFooterButton: {
    backgroundColor: '#34B79F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // 날짜 선택 캘린더 모달
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '95%',
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    paddingBottom: 10,
  },
  calendarContainer: {
    padding: 10,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F7F4',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    marginHorizontal: 10,
  },
  todayButtonText: {
    fontSize: 16,
    color: '#34B79F',
    fontWeight: '600',
    marginLeft: 8,
  },
});
