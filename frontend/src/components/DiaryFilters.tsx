/**
 * 다이어리 필터 컴포넌트
 * 월 선택, 칩 필터 (감정, 어르신)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';


export interface DiaryFiltersProps {
  month: string; // YYYY-MM
  selectedMoods: string[];
  selectedTags: string[];
  selectedElderlyIds: string[];
  onMonthChange: (month: string) => void;
  onMoodsChange: (moods: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  onElderlyIdsChange: (elderlyIds: string[]) => void;
  connectedElderly?: Array<{ user_id: string; name: string }>;
  availableMonths?: string[]; // 다이어리가 있는 월 목록 (YYYY-MM 형식)
}

const MOOD_OPTIONS = [
  { value: 'happy', label: '행복', icon: 'happy', color: '#FFD700' },
  { value: 'excited', label: '신남', icon: 'sparkles', color: '#FF6B6B' },
  { value: 'calm', label: '평온', icon: 'leaf', color: '#4ECDC4' },
  { value: 'sad', label: '슬픔', icon: 'sad', color: '#5499C7' },
  { value: 'angry', label: '화남', icon: 'thunderstorm', color: '#E74C3C' },
  { value: 'tired', label: '피곤', icon: 'moon', color: '#9B59B6' },
];


export const DiaryFilters: React.FC<DiaryFiltersProps> = ({
  month,
  selectedMoods,
  selectedTags,
  selectedElderlyIds,
  onMonthChange,
  onMoodsChange,
  onTagsChange,
  onElderlyIdsChange,
  connectedElderly = [],
  availableMonths = [],
}) => {
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const toggleMood = (mood: string) => {
    if (selectedMoods.includes(mood)) {
      onMoodsChange(selectedMoods.filter(m => m !== mood));
    } else {
      onMoodsChange([...selectedMoods, mood]);
    }
  };

  const toggleElderly = (elderlyId: string) => {
    if (selectedElderlyIds.includes(elderlyId)) {
      onElderlyIdsChange(selectedElderlyIds.filter(id => id !== elderlyId));
    } else {
      onElderlyIdsChange([...selectedElderlyIds, elderlyId]);
    }
  };

  const getCurrentMonthOptions = () => {
    // 현재월 계산
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 현재월 + 일기가 있는 월들을 합치고 중복 제거
    const monthset = new Set<string>();
    monthset.add(currentMonthStr); // 현재월은 항상 포함

    // 일기가 있는 월들 추가
    availableMonths.forEach(month => monthset.add(month));

    // 최신순 정렬
    return Array.from(monthset).sort((a, b) => b.localeCompare(a));
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${parseInt(month)}월`;
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.expandedContainer}>
            {/* 월 선택 */}
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.monthButton}
                onPress={() => setShowMonthPicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.monthText}>{formatMonth(month)}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 칩 필터 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsContainer}
              contentContainerStyle={styles.chipsContent}
            >
              {/* 감정 필터 */}
              {MOOD_OPTIONS.map(mood => (
                <TouchableOpacity
                  key={mood.value}
                  style={[
                    styles.chip,
                    selectedMoods.includes(mood.value) && styles.chipSelected,
                    selectedMoods.includes(mood.value) && { backgroundColor: mood.color + '20', borderColor: mood.color },
                  ]}
                  onPress={() => toggleMood(mood.value)}
                >
                  <Ionicons
                    name={mood.icon as any}
                    size={16}
                    color={selectedMoods.includes(mood.value) ? mood.color : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      selectedMoods.includes(mood.value) && { color: mood.color },
                    ]}
                  >
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
        </View>
      </View>

      {/* 월 선택 모달 */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>월 선택</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.monthList}>
              {getCurrentMonthOptions().map(monthOption => (
                <TouchableOpacity
                  key={monthOption}
                  style={[
                    styles.monthItem,
                    month === monthOption && styles.monthItemSelected,
                  ]}
                  onPress={() => {
                    onMonthChange(monthOption);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.monthItemText,
                      month === monthOption && styles.monthItemTextSelected,
                    ]}
                  >
                    {formatMonth(monthOption)}
                  </Text>
                  {month === monthOption && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
  },
  expandedContainer: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  chipsContainer: {
    marginBottom: 12,
  },
  chipsContent: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  chipSelected: {
    borderWidth: 2,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  monthList: {
    maxHeight: 400,
  },
  monthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  monthItemSelected: {
    backgroundColor: Colors.primaryPale,
  },
  monthItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  monthItemTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
});

