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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Header, BottomNavigationBar } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as todoApi from '../api/todo';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/Colors';
import { useAlert } from '../components/GlobalAlertProvider';

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
  const [isSaving, setIsSaving] = useState(false);
  
  // 쿼리 파라미터로 어르신 ID와 이름 받기
  const { elderlyId, elderlyName } = useLocalSearchParams<{
    elderlyId: string;
    elderlyName: string;
  }>();

  // elderlyId가 없으면 뒤로가기
  useEffect(() => {
    if (!elderlyId) {
      show('오류', '어르신 정보가 없습니다.', [
        { text: '확인', onPress: () => router.back() }
      ]);
    }
  }, [elderlyId]);

  // 폼 상태
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    category: '',
    time: '',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    elderlyId: elderlyId || '', // 쿼리 파라미터에서 받은 어르신 ID 사용
    isRecurring: false,
    recurringType: 'daily' as 'daily' | 'weekly' | 'monthly',
    reminderEnabled: true,
    reminderTime: '',
  });

  // 모달 상태
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // 카테고리 옵션 (Backend Enum과 일치)
  const categories = [
    { id: 'MEDICINE', name: '💊 약 복용', color: '#FF6B6B' },
    { id: 'HOSPITAL', name: '🏥 병원 방문', color: '#4ECDC4' },
    { id: 'EXERCISE', name: '🏃 운동', color: '#45B7D1' },
    { id: 'MEAL', name: '🍽️ 식사', color: '#96CEB4' },
    { id: 'OTHER', name: '📝 기타', color: '#95A5A6' },
  ];

  // 시간 옵션
  const timeOptions = [
    '오전 6시', '오전 7시', '오전 8시', '오전 9시', '오전 10시',
    '오전 11시', '오후 12시', '오후 1시', '오후 2시', '오후 3시',
    '오후 4시', '오후 5시', '오후 6시', '오후 7시', '오후 8시',
    '오후 9시', '오후 10시'
  ];

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

    if (!newTodo.time) {
      show('알림', '시간을 선택해주세요.');
      return;
    }

    try {
      setIsSaving(true);

      // 시간 변환 (오전 8시 → 08:00)
      const timeStr = newTodo.time.replace('오전 ', '').replace('오후 ', '').replace('시', '');
      const hour = newTodo.time.includes('오후') 
        ? (parseInt(timeStr) === 12 ? 12 : parseInt(timeStr) + 12)
        : (parseInt(timeStr) === 12 ? 0 : parseInt(timeStr));
      const formattedTime = `${hour.toString().padStart(2, '0')}:00`;

      // API 요청 데이터
      const todoData: todoApi.TodoCreateRequest = {
        elderly_id: newTodo.elderlyId,
        title: newTodo.title,
        description: newTodo.description || undefined,
        category: newTodo.category as any, // 이미 대문자로 저장됨
        due_date: newTodo.date,
        due_time: formattedTime,
        is_recurring: newTodo.isRecurring,
        recurring_type: newTodo.isRecurring ? newTodo.recurringType.toUpperCase() as any : undefined,
      };

      console.log('📤 TODO 생성 요청:', JSON.stringify(todoData, null, 2));

      const result = await todoApi.createTodo(todoData);
      console.log('✅ TODO 생성 성공:', result.todo_id);

      show(
        '저장 완료',
        '어르신의 할일이 등록되었습니다.',
        [
          {
            text: '확인',
            onPress: () => router.back(),
          },
        ]
      );
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

  const formatDate = () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[today.getDay()];
    return `${month}월 ${date}일 (${day})`;
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Header 
        title={elderlyName ? `${elderlyName}님의 할일 추가` : '할일 추가'} 
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
            placeholder="어르신이 해야 할 일을 입력해주세요"
            placeholderTextColor="#999999"
          />
        </View>

        {/* 설명 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>상세 설명</Text>
          <TextInput
            style={styles.descriptionInput}
            value={newTodo.description}
            onChangeText={(text) => setNewTodo({ ...newTodo, description: text })}
            placeholder="할일에 대한 자세한 설명을 입력해주세요"
            placeholderTextColor="#999999"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* 카테고리 선택 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>카테고리 *</Text>
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.categoryButtonText,
              !newTodo.category && styles.placeholderText
            ]}>
              {newTodo.category ? getCategoryById(newTodo.category)?.name : '카테고리를 선택해주세요'}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* 시간 선택 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>시간 *</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimeModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.timeButtonText,
              !newTodo.time && styles.placeholderText
            ]}>
              {newTodo.time || '시간을 선택해주세요'}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* 날짜 표시 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>날짜</Text>
          <View style={styles.dateDisplay}>
            <Text style={styles.dateText}>오늘 ({formatDate()})</Text>
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
              <Text style={styles.reminderText}>
                💡 설정한 시간 10분 전에 어르신께 알림이 전송됩니다.
              </Text>
            </View>
          )}
        </View>

        {/* 하단 여백 */}
        <View style={{ height: 120 + Math.max(insets.bottom, 10) }} />
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

      {/* 카테고리 선택 모달 */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>카테고리 선택</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    { borderLeftColor: category.color },
                    newTodo.category === category.id && styles.categoryOptionSelected
                  ]}
                  onPress={() => {
                    setNewTodo({ ...newTodo, category: category.id });
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 시간 선택 모달 */}
      <Modal
        visible={showTimeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>시간 선택</Text>
              <TouchableOpacity onPress={() => setShowTimeModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {timeOptions.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    newTodo.time === time && styles.timeOptionSelected
                  ]}
                  onPress={() => {
                    setNewTodo({ ...newTodo, time });
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={[
                    styles.timeOptionText,
                    newTodo.time === time && styles.timeOptionTextSelected
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
              <TouchableOpacity onPress={() => setShowRecurringModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {recurringOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.recurringOption,
                    newTodo.recurringType === option.id && styles.recurringOptionSelected
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
    padding: 20,
  },
  
  // 입력 섹션
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
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
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
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#999999',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#34B79F',
    fontWeight: 'bold',
  },
  
  // 날짜 표시
  dateDisplay: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 16,
    color: '#34B79F',
    fontWeight: '600',
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
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  recurringButtonText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  
  // 알림 정보
  reminderInfo: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  reminderText: {
    fontSize: 14,
    color: '#B8860B',
    lineHeight: 20,
  },
  
  // 하단 버튼
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#34B79F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#34B79F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: 'bold',
  },
  modalBody: {
    maxHeight: 300,
  },
  
  // 카테고리 옵션
  categoryOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    borderLeftWidth: 4,
  },
  categoryOptionSelected: {
    backgroundColor: '#F0FFF0',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
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
  recurringOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  recurringOptionTextSelected: {
    color: '#34B79F',
    fontWeight: '600',
  },
});
