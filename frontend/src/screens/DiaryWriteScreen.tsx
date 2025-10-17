/**
 * 다이어리 작성 화면
 * 제목, 내용, 기분 입력
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createDiary } from '../api/diary';

// 기분 옵션
const MOOD_OPTIONS = [
  { value: 'happy', label: '행복해요', emoji: '😊' },
  { value: 'excited', label: '신나요', emoji: '🤗' },
  { value: 'calm', label: '평온해요', emoji: '😌' },
  { value: 'sad', label: '슬퍼요', emoji: '😢' },
  { value: 'angry', label: '화나요', emoji: '😠' },
  { value: 'tired', label: '피곤해요', emoji: '😴' },
];

export const DiaryWriteScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
   * 일기 저장
   */
  const handleSubmit = async () => {
    // 유효성 검사
    if (!title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
      return;
    }

    if (!selectedMood) {
      Alert.alert('알림', '오늘의 기분을 선택해주세요.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('알림', '일기 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);

      await createDiary({
        date,
        title: title.trim(),
        content: content.trim(),
        mood: selectedMood,
        status: 'published',
      });

      router.back();
    } catch (error: any) {
      console.error('일기 저장 실패:', error);
      Alert.alert(
        '오류',
        error.response?.data?.detail || '일기 저장에 실패했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          disabled={isSubmitting}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>일기 작성</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
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

        {/* 저장 버튼 */}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>✏️ 작성하기</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  backButtonText: {
    fontSize: 28,
    color: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
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
  moodEmoji: {
    fontSize: 26,
    marginBottom: 4,
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
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default DiaryWriteScreen;

