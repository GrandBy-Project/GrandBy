/**
 * 다이어리 상세 화면
 * 일기 내용 전체 보기
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getDiary, deleteDiary, Diary, getComments, createComment, deleteComment, DiaryComment } from '../api/diary';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/Colors';
import { BottomNavigationBar } from '../components';

export const DiaryDetailScreen = () => {
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

  /**
   * 다이어리 상세 로드
   */
  const loadDiary = async () => {
    if (!diaryId) {
      Alert.alert('오류', '일기 ID가 없습니다.');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      const data = await getDiary(diaryId);
      
      // 임시저장 상태면 바로 작성 페이지로 이동
      if (data.status === 'draft') {
        router.replace({
          pathname: '/diary-write',
          params: { 
            diaryId: data.diary_id,
            callSid: data.call_id || '',
            fromCall: 'true'
          },
        });
        return;
      }
      
      setDiary(data);
    } catch (error: any) {
      console.error('다이어리 로드 실패:', error);
      Alert.alert(
        '오류',
        error.response?.data?.detail || '일기를 불러오는데 실패했습니다.',
        [
          {
            text: '확인',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 일기 삭제
   */
  const handleDelete = () => {
    Alert.alert(
      '일기 삭제',
      '정말 이 일기를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDiary(diaryId);
              Alert.alert('삭제 완료', '일기가 삭제되었습니다.', [
                {
                  text: '확인',
                  onPress: () => {
                    router.back();
                  },
                },
              ]);
            } catch (error: any) {
              console.error('삭제 실패:', error);
              Alert.alert(
                '오류',
                error.response?.data?.detail || '삭제에 실패했습니다.'
              );
            }
          },
        },
      ]
    );
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
      Alert.alert('알림', '댓글 내용을 입력해주세요.');
      return;
    }

    if (!diaryId) return;

    try {
      setIsSubmittingComment(true);
      await createComment(diaryId, { content: commentText.trim() });
      setCommentText('');
      await loadComments();
      Alert.alert('완료', '댓글이 작성되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', error.response?.data?.detail || '댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  /**
   * 댓글 삭제
   */
  const handleDeleteComment = async (commentId: string) => {
    if (!diaryId) return;

    Alert.alert(
      '댓글 삭제',
      '이 댓글을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(diaryId, commentId);
              await loadComments();
              Alert.alert('완료', '댓글이 삭제되었습니다.');
            } catch (error: any) {
              Alert.alert('오류', error.response?.data?.detail || '댓글 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.placeholder} />
          <Text style={styles.headerTitle}>일기 상세</Text>
          
          {/* 삭제 버튼 - 본인이 작성한 경우만 표시 */}
          {canDelete ? (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

      {/* 내용 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 날짜 */}
        <Text style={styles.dateText}>{formatDate(diary.date)}</Text>

        {/* 작성시간 */}
        <Text style={styles.timestampText}>{formatCreatedTime(diary.created_at)}</Text>

        {/* 제목 */}
        {diary.title && (
          <Text style={styles.titleText}>{diary.title}</Text>
        )}

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
          {diary.status === 'draft' && (
            <View style={styles.draftBadge}>
              <Text style={styles.draftText}>임시저장</Text>
            </View>
          )}
        </View>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 일기 내용 */}
        <Text style={styles.contentText}>{diary.content}</Text>

        {/* 댓글 작성 입력창 */}
        <View style={styles.commentInputContainer}>
          <View style={styles.commentInputWrapper}>
            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="댓글을 입력하세요"
              multiline
              maxLength={100}
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.commentSubmitButton,
              (!commentText.trim() || isSubmittingComment) && styles.commentSubmitButtonDisabled
            ]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || isSubmittingComment}
          >
            {isSubmittingComment ? (
              <ActivityIndicator size="small" color={Colors.textWhite} />
            ) : (
              <Ionicons name="send" size={18} color={Colors.textWhite} />
            )}
          </TouchableOpacity>
        </View>

        {/* 댓글 섹션 */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsSectionHeader}>
            <Ionicons name="chatbubbles" size={24} color={Colors.primary} />
            <Text style={styles.commentsSectionTitle}>댓글 {comments.length}</Text>
          </View>

          {/* 댓글 목록 */}
          {isLoadingComments ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <View key={comment.comment_id} style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAuthor}>
                    <Ionicons name="person-circle" size={32} color={Colors.primary} />
                    <Text style={styles.commentAuthorName}>
                      {comment.user_name}
                    </Text>
                  </View>
                  {comment.user_id === user?.user_id && (
                    <TouchableOpacity onPress={() => handleDeleteComment(comment.comment_id)}>
                      <Ionicons name="trash" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
                <Text style={styles.commentDate}>
                  {formatTimestamp(comment.created_at)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyCommentsText}>아직 댓글이 없습니다</Text>
            </View>
          )}
        </View>
      </ScrollView>
      </View>

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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
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
  draftBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  draftText: {
    fontSize: 13,
    color: '#F57C00',
    fontWeight: '600',
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
  // 댓글 섹션
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
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  commentContent: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
    marginBottom: 8,
  },
  commentDate: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: 32,
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 80,
    paddingVertical: 4,
  },
  commentSubmitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSubmitButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
});

export default DiaryDetailScreen;

