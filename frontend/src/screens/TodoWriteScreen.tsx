/**
 * 어르신 할일 작성/수정 화면
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Header, BottomNavigationBar, useAlert } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSizeStore } from '../store/fontSizeStore';

interface TodoFormData {
  title: string;
  description: string;
  time: string;
}

export const TodoWriteScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, mode } = useLocalSearchParams();
  const { fontSizeLevel } = useFontSizeStore();
  const { show } = useAlert();
  
  const isEdit = mode === 'edit';
  
  // 폼 데이터 상태
  const [formData, setFormData] = useState<TodoFormData>({
    title: isEdit ? '혈압약 복용' : '',
    description: isEdit ? '아침 식사 후 혈압약을 복용해주세요.' : '',
    time: isEdit ? '오전 8시' : '',
  });

  const timeOptions = [
    '오전 6시', '오전 7시', '오전 8시', '오전 9시', '오전 10시',
    '오전 11시', '오후 12시', '오후 1시', '오후 2시', '오후 3시',
    '오후 4시', '오후 5시', '오후 6시', '오후 7시', '오후 8시',
    '오후 9시', '하루 종일'
  ];

  const handleSave = () => {
    if (!formData.title.trim()) {
      show('알림', '할일 제목을 입력해주세요.');
      return;
    }
    
    if (!formData.description.trim()) {
      show('알림', '할일 내용을 입력해주세요.');
      return;
    }

    show(
      '저장',
      isEdit ? '할일을 수정하시겠습니까?' : '새 할일을 저장하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '저장',
          onPress: () => {
            // 실제로는 API 호출
            show(
              '저장 완료',
              isEdit ? '할일이 수정되었습니다.' : '새 할일이 저장되었습니다.'
            );
            router.back();
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    show(
      '취소',
      '작성 중인 내용이 사라집니다. 정말 취소하시겠습니까?',
      [
        { text: '계속 작성', style: 'cancel' },
        {
          text: '취소',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title={isEdit ? "일정 수정" : "일정 추가"} 
        showMenuButton={true}
        rightButton={
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 제목 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>제목</Text>
          <TextInput
            style={styles.titleInput}
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            placeholder="일정 제목을 입력해주세요"
            placeholderTextColor="#999999"
          />
        </View>

        {/* 내용 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>내용</Text>
          <TextInput
            style={styles.descriptionInput}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="일정 내용을 자세히 입력해주세요"
            placeholderTextColor="#999999"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* 시간 선택 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>시간</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScrollView}>
            <View style={styles.timeContainer}>
              {timeOptions.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeItem,
                    formData.time === time && styles.timeItemSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, time })}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.timeText,
                    formData.time === time && styles.timeTextSelected,
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 저장 버튼 */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>
              {isEdit ? '수정하기' : '저장하기'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 하단 여백 (네비게이션 바 공간 확보) */}
        <View style={{ height: 20 }} />
      </ScrollView>

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
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  inputSection: {
    margin: 20,
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  titleInput: {
    borderWidth: 2,
    borderColor: '#40B59F',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  descriptionInput: {
    borderWidth: 2,
    borderColor: '#40B59F',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  timeScrollView: {
    marginHorizontal: -20,
  },
  timeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  timeItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeItemSelected: {
    backgroundColor: '#40B59F',
    borderColor: '#40B59F',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  timeTextSelected: {
    color: '#FFFFFF',
  },
  saveSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#40B59F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#40B59F',
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
  bottomSpacer: {
    height: 20,
  },
});
