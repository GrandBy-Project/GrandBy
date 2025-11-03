/**
 * 다이어리 작성 화면
 * 제목, 내용, 기분 입력
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createDiary, getDiary, updateDiary, Diary } from '../api/diary';
import { getCallLog, getExtractedTodos, ExtractedTodo } from '../api/call';
import { createTodo } from '../api/todo';
import { useAuthStore } from '../store/authStore';
import { BottomNavigationBar, Header } from '../components';
import { Colors } from '../constants/Colors';

// 기분 옵션
const MOOD_OPTIONS = [
  { value: 'happy', label: '행복해요', icon: 'happy', color: '#FFD700' },
  { value: 'excited', label: '신나요', icon: 'sparkles', color: '#FF6B6B' },
  { value: 'calm', label: '평온해요', icon: 'leaf', color: '#4ECDC4' },
  { value: 'sad', label: '슬퍼요', icon: 'sad', color: '#5499C7' },
  { value: 'angry', label: '화나요', icon: 'thunderstorm', color: '#E74C3C' },
  { value: 'tired', label: '피곤해요', icon: 'moon', color: '#9B59B6' },
];

export const DiaryWriteScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  // URL 파라미터에서 정보 가져오기
  const searchParams = useLocalSearchParams();
  const fromCall = searchParams.fromCall === 'true';
  const callSid = searchParams.callSid as string | undefined;
  const fromBanner = searchParams.fromBanner === 'true'; // 상단 배너에서 온 경우 파라미터 추가
  const diaryId = searchParams.diaryId as string | undefined; // 수정 모드용
  const givenDiaryId = searchParams.givenDiaryId as string | undefined; // 기존 다이어리 ID
  const isEditMode = !!(diaryId || givenDiaryId); // 수정 모드 여부

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [existingDiary, setExistingDiary] = useState<Diary | null>(null);
  
  // TODO 관련 state
  const [suggestedTodos, setSuggestedTodos] = useState<ExtractedTodo[]>([]);
  const [expandedTodoIndex, setExpandedTodoIndex] = useState<number | null>(null);
  const [editingTodo, setEditingTodo] = useState<{
    title: string;
    description: string;
    isShared: boolean;
  } | null>(null);

  // 확인 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: '확인',
    cancelText: '취소',
  });

  /**
   * 날짜 포맷팅
   */
  const formatDateDisplay = (dateString: string): string => {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[d.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  /**
   * 수정 모드: 기존 다이어리 불러오기
   */
  useEffect(() => {
    const loadDiary = async () => {
      if (isEditMode && (diaryId || givenDiaryId)) {
        try {
          setIsLoadingSummary(true);
          const diary = await getDiary(diaryId || givenDiaryId!);
          setExistingDiary(diary);
          
          // 폼에 기존 데이터 채우기
          setDate(diary.date);
          setTitle(diary.title || '');
          setContent(diary.content);
          setSelectedMood(diary.mood || '');
          
        } catch (error) {
          console.error('다이어리 로드 실패:', error);
          setConfirmModal({
            visible: true,
            title: '오류',
            message: '일기를 불러올 수 없습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
              router.back();
            },
          });
        } finally {
          setIsLoadingSummary(false);
        }
      }
    };

    loadDiary();
  }, [isEditMode, diaryId, givenDiaryId]);

  /**
   * 통화 요약 및 TODO 불러오기 (컴포넌트 마운트 시)
   */
  useEffect(() => {
    const loadCallData = async () => {
      // ✅ 통화에서 온 경우 또는 상단 배너를 통해 온 경우 실행
      if (fromCall || fromBanner) {
        try {
          setIsLoadingSummary(true);
          console.log('📞 통화 데이터 불러오기 시작');
          
          let callSidToUse = callSid;
          
          // ✅ callSid가 없으면 오늘의 통화 기록에서 찾기 (상단 배너에서 온 경우)
          if (!callSidToUse) {
            console.log('📞 오늘의 통화 기록에서 callSid 찾기');
            const { getCallLogs } = await import('../api/call');
            const calls = await getCallLogs({ limit: 10 });
            
            // 오늘 완료된 통화 기록 찾기
            const today = new Date().toISOString().split('T')[0];
            
            const todayCalls = calls.find((call: any) => {
              const callDate = new Date(call.created_at);
              const callDateString = callDate.toISOString().split('T')[0];
              return callDateString === today && call.call_status === 'completed';
            });
            
            if (todayCalls) {
              callSidToUse = todayCalls.call_id;
              console.log('✅ 오늘의 통화 기록 발견:', callSidToUse);
            }
          }
          
          if (callSidToUse) {
            // 통화 기록 가져오기 (일기 내용)
            const callLog = await getCallLog(callSidToUse);
            console.log('✅ 통화 기록 조회 완료:', callLog);
            
            // conversation_summary가 있으면 content에 자동 입력
            if (callLog.conversation_summary) {
              setContent(callLog.conversation_summary);
              setTitle('AI와의 대화 기록');
              console.log('✅ 통화 요약 자동 입력 완료');
            }
            
            // TODO 자동 추출
            const extractedTodos = await getExtractedTodos(callSidToUse);
            console.log('📋 추출된 TODO:', extractedTodos);
            
            if (extractedTodos.length > 0) {
              setSuggestedTodos(extractedTodos);
              
              // 사용자에게 피드백
              setConfirmModal({
                visible: true,
                title: '💡 일정 발견!',
                message: `대화에서 ${extractedTodos.length}개의 일정을 발견했습니다.\n아래에서 등록할 일정을 선택해주세요!`,
                confirmText: '확인',
                onConfirm: () => {
                  setConfirmModal(prev => ({ ...prev, visible: false }));
                },
              });
            } else if (callLog.conversation_summary) {
              // TODO는 없지만 일기는 있는 경우
              setConfirmModal({
                visible: true,
                title: '자동 완성',
                message: 'AI와의 대화 내용이 자동으로 입력되었습니다.\n수정 후 저장해주세요!',
                confirmText: '확인',
                onConfirm: () => {
                  setConfirmModal(prev => ({ ...prev, visible: false }));
                },
              });
            }
          }
        } catch (error) {
          console.error('❌ 통화 데이터 로딩 실패:', error);
          setConfirmModal({
            visible: true,
            title: '오류',
            message: '통화 데이터를 불러올 수 없습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
        } finally {
          setIsLoadingSummary(false);
        }
      }
    };

    loadCallData();
  }, [fromCall, fromBanner, callSid]); // fromBanner 의존성 추가

  /**
   * 카테고리 아이콘 반환
   */
  const getCategoryIcon = (category?: string): string => {
    switch (category) {
      case 'MEDICINE': return '💊';
      case 'HOSPITAL': return '🏥';
      case 'EXERCISE': return '🏃';
      case 'MEAL': return '🍽️';
      default: return '📅';
    }
  };

  /**
   * TODO 날짜 포맷팅
   */
  const formatTodoDate = (dateStr: string, timeStr?: string | null): string => {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let result = '';
    if (d.toDateString() === today.toDateString()) {
      result = '오늘';
    } else if (d.toDateString() === tomorrow.toDateString()) {
      result = '내일';
    } else {
      result = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }
    
    if (timeStr) {
      result += ` ${timeStr}`;
    }
    return result;
  };

  /**
   * TODO 확장 (등록 폼 표시)
   */
  const handleExpandTodo = (index: number, todo: ExtractedTodo) => {
    setExpandedTodoIndex(index);
    setEditingTodo({
      title: todo.title,
      description: todo.description || '',
      isShared: true,  // 기본값: 공유
    });
  };

  /**
   * TODO 등록 확인
   */
  const handleConfirmTodo = async (index: number, originalTodo: ExtractedTodo) => {
    if (!editingTodo || !user) return;
    
    try {
      await createTodo({
        elderly_id: user.user_id,
        title: editingTodo.title,
        description: editingTodo.description,
        category: originalTodo.category,
        due_date: originalTodo.due_date,
        due_time: originalTodo.due_time || undefined,
        is_shared_with_caregiver: editingTodo.isShared,
      });
      
      // 성공 피드백
      setConfirmModal({
        visible: true,
        title: '✅ 등록 완료',
        message: '일정이 등록되었습니다!',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
      
      // 등록된 TODO 제거
      setSuggestedTodos(prev => prev.filter((_, i) => i !== index));
      setExpandedTodoIndex(null);
      setEditingTodo(null);
      
    } catch (error) {
      console.error('TODO 등록 실패:', error);
      setConfirmModal({
        visible: true,
        title: '오류',
        message: '일정 등록에 실패했습니다.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
    }
  };

  /**
   * 일기 저장
   */
  const handleSubmit = async () => {
    // 유효성 검사
    if (!title.trim()) {
      setConfirmModal({
        visible: true,
        title: '알림',
        message: '제목을 입력해주세요.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
      return;
    }

    if (!selectedMood) {
      setConfirmModal({
        visible: true,
        title: '알림',
        message: '오늘의 기분을 선택해주세요.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
      return;
    }

    if (!content.trim()) {
      setConfirmModal({
        visible: true,
        title: '알림',
        message: '일기 내용을 입력해주세요.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (isEditMode && (diaryId || givenDiaryId)) {
        // 수정 모드
        await updateDiary(diaryId || givenDiaryId!, {
          title: title.trim() || undefined,
          content: content.trim(),
          mood: selectedMood || undefined,
          status: 'published',
        });

        setConfirmModal({
          visible: true,
          title: '완료',
          message: '일기가 수정되었습니다!',
          confirmText: '확인',
          onConfirm: () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
            router.back();
          },
        });
      } else {
        // 작성 모드
        await createDiary({
          date,
          title: title.trim() || undefined,
          content: content.trim(),
          mood: selectedMood || undefined,
          status: 'published',
        });

        setConfirmModal({
          visible: true,
          title: '완료',
          message: '일기가 저장되었습니다!',
          confirmText: '확인',
          onConfirm: () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
            // 통화에서 온 경우 메인 페이지로, 아니면 뒤로가기
            if (fromCall) {
              router.replace('/home');
            } else {
              router.back();
            }
          },
        });
      }

    } catch (error: any) {
      console.error('일기 저장 실패:', error);
      setConfirmModal({
        visible: true,
        title: '오류',
        message: error.response?.data?.detail || '일기 저장에 실패했습니다.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Header
        title={isEditMode ? '일기 수정' : '일기 작성'}
        showMenuButton={true}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 통화 요약 로딩 인디케이터 */}
        {isLoadingSummary && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4A90E2" />
            <Text style={styles.loadingText}>통화 내용을 불러오는 중...</Text>
          </View>
        )}

        {/* 날짜 (숨김 - 자동으로 오늘 날짜) */}
        <View style={styles.section}>
          <Text style={styles.dateText}>{formatDateDisplay(date)}</Text>
        </View>

        {/* 제목 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>제목</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="제목을 입력하세요"
            placeholderTextColor="#CCCCCC"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            editable={!isSubmitting}
          />
        </View>

        {/* 기분 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>오늘의 기분</Text>
          <View style={styles.moodGrid}>
            {MOOD_OPTIONS.map((mood) => (
              <TouchableOpacity
                key={mood.value}
                style={[
                  styles.moodButton,
                  selectedMood === mood.value && styles.moodButtonSelected,
                ]}
                onPress={() => setSelectedMood(mood.value)}
                disabled={isSubmitting}
              >
                <Ionicons 
                  name={mood.icon as any} 
                  size={28} 
                  color={selectedMood === mood.value ? mood.color : '#999999'} 
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={[
                    styles.moodLabel,
                    selectedMood === mood.value && styles.moodLabelSelected,
                  ]}
                >
                  {mood.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 내용 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>일기 내용</Text>
          <TextInput
            style={styles.contentInput}
            placeholder="오늘 하루는 어떠셨나요?&#10;일어난 일이나 느낀 점을 자유롭게 작성해보세요."
            placeholderTextColor="#CCCCCC"
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={15}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
          <Text style={styles.charCount}>{content.length}자</Text>
        </View>

        {/* TODO 제안 섹션 (작성 모드일 때만) */}
        {!isEditMode && suggestedTodos.length > 0 && (
          <View style={styles.todoSection}>
            <Text style={styles.todoSectionTitle}>
              💡 대화에서 발견된 일정 ({suggestedTodos.length}개)
            </Text>
            <Text style={styles.todoSectionHint}>
              등록하고 싶은 일정을 선택해주세요
            </Text>
            
            {suggestedTodos.map((todo, index) => (
              <View key={index} style={styles.todoCard}>
                {/* 카드 헤더 */}
                <View style={styles.todoCardHeader}>
                  <View style={styles.todoCardLeft}>
                    <Text style={styles.todoCategoryIcon}>
                      {getCategoryIcon(todo.category)}
                    </Text>
                    <View style={styles.todoCardInfo}>
                      <Text style={styles.todoCardTitle}>{todo.title}</Text>
                      <Text style={styles.todoCardDate}>
                        {formatTodoDate(todo.due_date, todo.due_time)}
                      </Text>
                    </View>
                  </View>
                  
                  {expandedTodoIndex === index ? (
                    <Text style={styles.todoExpandedIcon}>▼</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.todoAddButton}
                      onPress={() => handleExpandTodo(index, todo)}
                    >
                      <Text style={styles.todoAddButtonText}>+ 등록</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* 설명 */}
                {todo.description && (
                  <Text style={styles.todoCardDescription}>
                    {todo.description}
                  </Text>
                )}
                
                {/* 확장 폼 */}
                {expandedTodoIndex === index && editingTodo && (
                  <View style={styles.todoExpandedForm}>
                    {/* 제목 */}
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>제목</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editingTodo.title}
                        onChangeText={(text) => 
                          setEditingTodo({ ...editingTodo, title: text })
                        }
                        placeholder="일정 제목"
                      />
                    </View>
                    
                    {/* 설명 */}
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>설명 (선택)</Text>
                      <TextInput
                        style={[styles.formInput, styles.formTextArea]}
                        value={editingTodo.description}
                        onChangeText={(text) => 
                          setEditingTodo({ ...editingTodo, description: text })
                        }
                        placeholder="일정 설명"
                        multiline
                      />
                    </View>
                    
                    {/* 공유 설정 토글 */}
                    <View style={styles.formField}>
                      <View style={styles.shareToggleContainer}>
                        <View style={styles.shareToggleLeft}>
                          <Text style={styles.shareToggleLabel}>
                            보호자와 공유
                          </Text>
                          <Text style={styles.shareToggleHint}>
                            {editingTodo.isShared 
                              ? '보호자도 이 일정을 볼 수 있어요'
                              : '나만 볼 수 있어요'}
                          </Text>
                        </View>
                        <Switch
                          value={editingTodo.isShared}
                          onValueChange={(value) => 
                            setEditingTodo({ ...editingTodo, isShared: value })
                          }
                          trackColor={{ false: '#E8E8E8', true: '#34B79F' }}
                          thumbColor='#FFFFFF'
                        />
                      </View>
                    </View>
                    
                    {/* 버튼 */}
                    <View style={styles.formButtons}>
                      <TouchableOpacity
                        style={[styles.formButton, styles.cancelButton]}
                        onPress={() => {
                          setExpandedTodoIndex(null);
                          setEditingTodo(null);
                        }}
                      >
                        <Text style={styles.cancelButtonText}>취소</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.formButton, styles.confirmButton]}
                        onPress={() => handleConfirmTodo(index, todo)}
                      >
                        <Text style={styles.confirmButtonText}>등록하기</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 저장 버튼 */}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.submitButtonContent}>
              <Ionicons 
                name={isEditMode ? "checkmark-circle" : "pencil"} 
                size={20} 
                color="#FFFFFF" 
                style={{ marginRight: 8 }} 
              />
              <Text style={styles.submitButtonText}>
                {isEditMode ? '수정 완료' : '작성하기'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* 확인 모달 */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      >
        <Pressable 
          style={styles.commonModalBackdrop} 
          onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable style={styles.commonModalContainer} onPress={() => {}}>
            <Text style={styles.commonModalTitle}>
              {confirmModal.title}
            </Text>
            <Text style={styles.commonModalText}>
              {confirmModal.message}
            </Text>
            <View style={styles.confirmModalActions}>
              {confirmModal.onCancel && (
                <TouchableOpacity
                  style={[styles.confirmModalButton, styles.confirmModalCancelButton]}
                  onPress={confirmModal.onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmModalCancelButtonText}>
                    {confirmModal.cancelText || '취소'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalConfirmButton]}
                onPress={confirmModal.onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmModalConfirmButtonText}>
                  {confirmModal.confirmText || '확인'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    // paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#34B79F',
    textAlign: 'center',
  },
  titleInput: {
    fontSize: 18,
    color: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moodButton: {
    width: '30%',
    paddingVertical: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodButtonSelected: {
    backgroundColor: '#E8F5F2',
    borderColor: '#34B79F',
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  moodLabelSelected: {
    color: '#34B79F',
    fontWeight: '700',
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 240,
  },
  charCount: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'right',
    marginTop: 8,
  },
  submitButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#34B79F',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D0E8FF',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  // TODO 섹션 스타일
  todoSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  todoSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  todoSectionHint: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 12,
  },
  // TODO 카드
  todoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  todoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todoCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  todoCategoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  todoCardInfo: {
    flex: 1,
  },
  todoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  todoCardDate: {
    fontSize: 13,
    color: '#666666',
  },
  todoCardDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    lineHeight: 20,
  },
  todoAddButton: {
    backgroundColor: '#34B79F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  todoAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  todoExpandedIcon: {
    fontSize: 18,
    color: '#34B79F',
  },
  // 확장 폼
  todoExpandedForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  formField: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333333',
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // 공유 토글
  shareToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
  },
  shareToggleLeft: {
    flex: 1,
  },
  shareToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  shareToggleHint: {
    fontSize: 12,
    color: '#666666',
  },
  // 버튼들
  formButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  formButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F8F8',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  confirmButton: {
    backgroundColor: '#34B79F',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // 공통 모달 스타일 (GlobalAlertProvider 디자인 참고)
  commonModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  commonModalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  commonModalTitle: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    fontSize: 18,
  },
  commonModalText: {
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
    fontSize: 15,
  },
  confirmModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 8,
  },
  confirmModalButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  confirmModalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  confirmModalConfirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmModalCancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmModalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DiaryWriteScreen;

