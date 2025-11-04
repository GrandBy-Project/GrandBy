/**
 * 다이어리 상세 화면
 * 일기 내용 전체 보기
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  Keyboard,
  Dimensions,
  Pressable,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getDiary, deleteDiary, Diary, getComments, createComment, deleteComment, DiaryComment } from '../api/diary';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/Colors';
import { BottomNavigationBar, Header } from '../components';
import { API_BASE_URL } from '../api/client';

export const DiaryDetailScreen = () => {
  const inputRef = useRef<TextInput>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();

  const [diary, setDiary] = useState<Diary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState<DiaryComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const commentScrollViewRef = useRef<ScrollView>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const [kbHeight, setKbHeight] = useState(0);

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

  useEffect(() => {
    const showEvt = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hideEvt = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';

    const showSub = Keyboard.addListener(showEvt, (e) => {
      const winH = Dimensions.get('window').height;
      const screenY = e?.endCoordinates?.screenY ?? winH;
      const inset = Math.max(0, winH - screenY);
      setKbHeight(inset);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);


  /**
   * 다이어리 상세 로드
   */
  const loadDiary = async () => {
    if (!diaryId) {
      setConfirmModal({
        visible: true,
        title: '오류',
        message: '일기 ID가 없습니다.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          router.back();
        },
      });
      return;
    }

    try {
      setIsLoading(true);
      const data = await getDiary(diaryId);
      setDiary(data);
    } catch (error: any) {
      console.error('다이어리 로드 실패:', error);
      setConfirmModal({
        visible: true,
        title: '오류',
        message: error.response?.data?.detail || '일기를 불러오는데 실패했습니다.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          router.back();
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 일기 삭제
   */
  const handleDelete = () => {
    setConfirmModal({
      visible: true,
      title: '일기 삭제',
      message: '정말 이 일기를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
      },
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          await deleteDiary(diaryId);
          setConfirmModal({
            visible: true,
            title: '삭제 완료',
            message: '일기가 삭제되었습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
              router.back();
            },
          });
        } catch (error: any) {
          console.error('삭제 실패:', error);
          setConfirmModal({
            visible: true,
            title: '오류',
            message: error.response?.data?.detail || '삭제에 실패했습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
        }
      },
    });
  };

  /**
   * 댓글 목록 로드
   */
  const loadComments = async () => {
    if (!diaryId) return;

    try {
      setIsLoadingComments(true);
      const data = await getComments(diaryId);
      setComments(data);
    } catch (error: any) {
      console.error('댓글 로드 실패:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  /**
   * 댓글 작성
   */
  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      setConfirmModal({
        visible: true,
        title: '알림',
        message: '댓글 내용을 입력해주세요.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
      return;
    }
    if (!diaryId) return;
    try {
      setIsSubmittingComment(true);
  
      // 1) 우선 포커스 해제 + 키보드 닫기 (깜빡임/재포커스 방지)
      inputRef.current?.blur();
      Keyboard.dismiss();
  
      // 2) 서버 요청
      await createComment(diaryId, { content: commentText.trim() });
  
      // 3) 입력값 초기화
      setCommentText('');
  
      // 4) 목록 리로드 + 맨 아래로 스크롤
      await loadComments();
      setTimeout(() => {
        commentScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (error: any) {
      setConfirmModal({
        visible: true,
        title: '오류',
        message: error.response?.data?.detail || '댓글 작성에 실패했습니다.',
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  /**
   * 댓글 삭제
   */
  const handleDeleteComment = async (commentId: string) => {
    if (!diaryId) return;

    setConfirmModal({
      visible: true,
      title: '댓글 삭제',
      message: '이 댓글을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
      },
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          await deleteComment(diaryId, commentId);
          await loadComments();
          setConfirmModal({
            visible: true,
            title: '완료',
            message: '댓글이 삭제되었습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
        } catch (error: any) {
          setConfirmModal({
            visible: true,
            title: '오류',
            message: error.response?.data?.detail || '댓글 삭제에 실패했습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
        }
      },
    });
  };

  /**
   * 초기 데이터 로드
   */
  useEffect(() => {
    loadDiary();
    loadComments();
  }, [diaryId]);

  /**
   * 날짜 포맷팅
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  /**
   * 타임스탬프 포맷팅 (상대적 시간)
   */
  const formatTimestamp = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}월 ${day}일`;
  };

  /**
   * 작성시간 포맷팅
   */
  const formatCreatedTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 작성자 타입 표시
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
   * 기분 아이콘 및 텍스트
   */
  const getMoodDisplay = (mood?: string | null): { icon: string; color: string; text: string } | null => {
    const moodMap: Record<string, { icon: string; color: string; text: string }> = {
      happy: { icon: 'happy', color: '#FFD700', text: '행복해요' },
      excited: { icon: 'sparkles', color: '#FF6B6B', text: '신나요' },
      calm: { icon: 'leaf', color: '#4ECDC4', text: '평온해요' },
      sad: { icon: 'sad', color: '#5499C7', text: '슬퍼요' },
      angry: { icon: 'thunderstorm', color: '#E74C3C', text: '화나요' },
      tired: { icon: 'moon', color: '#9B59B6', text: '피곤해요' },
    };
    return mood && moodMap[mood] ? moodMap[mood] : null;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#34B79F" />
        <Text style={styles.loadingText}>일기를 불러오는 중...</Text>
      </View>
    );
  }

  if (!diary) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>일기를 찾을 수 없습니다</Text>
        <TouchableOpacity
          style={styles.backToListButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backToListText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 삭제 권한: 본인이 작성했거나 본인 일기장에 있는 일기
  const canDelete = user && (diary.author_id === user.user_id || diary.user_id === user.user_id);

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Header
        title="일기 상세"
        showMenuButton={true}
        rightButton={
          canDelete ? (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* 내용 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 제목 */}
        {diary.title && (
          <Text style={styles.titleText}>{diary.title}</Text>
        )}

        {/* 날짜와 작성시간을 한 줄로 */}
        <View style={styles.dateTimeRow}>
          <Text style={styles.timestampText}>
            {formatDate(diary.date)} {formatCreatedTime(diary.created_at)}
          </Text>
        </View>

        {/* 기분 */}
        {diary.mood && getMoodDisplay(diary.mood) && (
          <View style={styles.moodContainer}>
            <Ionicons 
              name={getMoodDisplay(diary.mood)!.icon as any} 
              size={24} 
              color={getMoodDisplay(diary.mood)!.color} 
              style={{ marginRight: 10 }}
            />
            <Text style={styles.moodText}>{getMoodDisplay(diary.mood)!.text}</Text>
          </View>
        )}

        {/* 작성자 정보 */}
        <View style={styles.metaInfo}>
          <View style={styles.authorTypeContainer}>
            {diary.is_auto_generated ? (
              <MaterialCommunityIcons name="robot" size={18} color="#666666" style={{ marginRight: 4 }} />
            ) : (
              <Ionicons name="pencil" size={16} color="#666666" style={{ marginRight: 4 }} />
            )}
            <Text style={styles.authorType}>
              {getAuthorTypeText(diary.author_type)}
            </Text>
          </View>

        </View>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 일기 내용 */}
        <Text style={styles.contentText}>{diary.content}</Text>

        {/* 사진 갤러리 */}
        {diary.photos && diary.photos.length > 0 && (
          <View style={styles.photosSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosContainer}
            >
              {diary.photos.map((photo) => {
                const photoUrl = photo.photo_url.startsWith('http') 
                  ? photo.photo_url 
                  : `${API_BASE_URL}${photo.photo_url}`;
                
                return (
                  <TouchableOpacity
                    key={photo.photo_id}
                    style={styles.photoItem}
                    activeOpacity={0.9}
                    onPress={() => {
                      // TODO: 이미지 확대 보기 모달 (선택 사항)
                    }}
                  >
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 댓글 버튼 */}
        <TouchableOpacity
          style={styles.commentButton}
          onPress={() => setShowCommentModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={Colors.textWhite} />
          <Text style={styles.commentButtonText}>
            댓글 {comments.length}
          </Text>
        </TouchableOpacity>
      </ScrollView>

{/* 댓글 모달 */}
<Modal
  visible={showCommentModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowCommentModal(false)}
  presentationStyle="overFullScreen"
>
  <View style={styles.modalOverlay}>
    <TouchableOpacity
      style={styles.modalBackdrop}
      activeOpacity={1}
      onPress={() => setShowCommentModal(false)}
    />
    <View style={styles.modalContentWrapper} /* onStartShouldSetResponder={() => true} */>
      <View style={styles.modalContent}>
        {/* 헤더 */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>댓글 {comments.length}</Text>
          <TouchableOpacity
            onPress={() => setShowCommentModal(false)}
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* 댓글 목록: 입력창 높이만큼 하단 패딩을 줘서 가려지지 않게 */}
        <ScrollView
          ref={commentScrollViewRef}
          style={styles.modalBody}
          contentContainerStyle={[
            styles.modalBodyContent,
            { 
              paddingBottom: 
              footerHeight + Math.max(insets.bottom, kbHeight) +8 
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          onContentSizeChange={() => {
            setTimeout(() => {
              commentScrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
        >
          {isLoadingComments ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <View key={comment.comment_id} style={styles.commentItem}>
                <Ionicons name="person-circle" size={40} color={Colors.primary} style={styles.commentAvatar} />
                <View style={styles.commentContentWrapper}>
                  <View style={styles.commentHeaderRow}>
                    <Text style={styles.commentAuthorName}>{comment.user_name}</Text>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                  </View>
                  <View style={styles.commentFooterRow}>
                    <Text style={styles.commentDate}>{formatTimestamp(comment.created_at)}</Text>
                    {comment.user_id === user?.user_id && (
                      <TouchableOpacity
                        onPress={() => handleDeleteComment(comment.comment_id)}
                        style={styles.commentDeleteButton}
                      >
                        <Text style={styles.commentDeleteText}>삭제</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyCommentsText}>아직 댓글이 없습니다</Text>
            </View>
          )}
        </ScrollView>

        {/* ✅ 하단 입력창만 키보드에 반응하도록: 모달은 그대로, footer만 위로 이동 */}
          <View
            style={[
              styles.modalFooterFloating,
              {
                bottom: Math.max(insets.bottom, kbHeight),
              },
            ]}
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.commentInputContainer}>
              {/* 말풍선 아이콘 */}
              <Ionicons 
                name="chatbubble-outline" 
                size={24} 
                color={Colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <TextInput
                ref={inputRef}
                style={styles.commentInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="댓글 추가..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                maxLength={100}
                returnKeyType="default"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[
                  styles.commentSubmitButton,
                  (!commentText.trim() || isSubmittingComment) && styles.commentSubmitButtonDisabled,
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || isSubmittingComment}
                activeOpacity={0.7}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons
                    name="send"
                    size={24}
                    color={commentText.trim() ? Colors.primary : Colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
      </View>
    </View>
  </View>
</Modal>

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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorText: {
    fontSize: 18,
    color: '#999999',
    marginBottom: 24,
  },
  backToListButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#34B79F',
    borderRadius: 8,
  },
  backToListText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 0,
  },
  dateText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  timestampText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    marginBottom: 8,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  dateTimeRow: {
    marginBottom: 8,
  },
  moodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  moodText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666666',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  authorType: {
    fontSize: 15,
    color: '#666666',
  },

  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginBottom: 24,
  },
  contentText: {
    fontSize: 17,
    lineHeight: 28,
    color: '#333333',
    marginBottom: 32,
  },
  timestamp: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 4,
  },
  // 사진 갤러리 스타일
  photosSection: {
    marginBottom: 24,
  },
  photosSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  photosContainer: {
    paddingRight: 24,
    gap: 12,
  },
  photoItem: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    marginRight: 12,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  // 댓글 버튼 (스크롤뷰 안)
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 20,
    gap: 8,
  },
  commentButtonText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    // position: 'absolute',
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContentWrapper: {
    height: '70%',
    width: '100%',
    zIndex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '100%',
    flexDirection: 'column',
  },
  modalContentContainer: {
    flexGrow: 1,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 8,
  },
  modalFooter: {
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  // 댓글 섹션 (모달 내부에서 사용)
  commentsSection: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginBottom: 20,
  },
  commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  commentsSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  commentAvatar: {
    marginRight: 12,
  },
  commentContentWrapper: {
    flex: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
    flex: 1,
  },
  commentFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  commentDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  commentDeleteButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  commentDeleteText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '500',
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 8,
  },
  commentSubmitButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSubmitButtonDisabled: {
    opacity: 0.5,
  },
  modalFooterFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E0E0E0',
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

export default DiaryDetailScreen;

