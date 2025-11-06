/**
 * 카테고리 선택 컴포넌트
 * TODO 카테고리를 선택할 수 있는 재사용 가능한 컴포넌트
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TODO_CATEGORIES } from '../constants/TodoCategories';
import { Colors } from '../constants/Colors';

interface CategorySelectorProps {
  /** 선택된 카테고리 ID */
  selectedCategory: string | null;
  /** 카테고리 선택 시 호출되는 콜백 */
  onSelect: (categoryId: string) => void;
  /** 레이아웃 타입 ('inline' 또는 'grid') */
  layout?: 'inline' | 'grid';
  /** 비활성화 여부 */
  disabled?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  onSelect,
  layout = 'inline',
  disabled = false,
}) => {
  return (
    <>
      {TODO_CATEGORIES.map((category, index) => {
        const isSelected = selectedCategory === category.id;
        // 3개씩 배치하므로 마지막 카드 (index % 3 === 2)는 marginRight 제거
        const isLastInRow = index % 3 === 2;
        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryCardInline,
              isSelected && styles.categoryCardInlineSelected,
              isLastInRow && styles.categoryCardInlineLastInRow,
            ]}
            onPress={() => onSelect(category.id)}
            activeOpacity={0.7}
            disabled={disabled}
          >
            <View
              style={[
                styles.categoryCardIconContainerInline,
                { backgroundColor: category.color + '15' },
              ]}
            >
              <Ionicons
                name={category.icon as any}
                size={28}
                color={category.color}
              />
            </View>
            <Text
              style={[
                styles.categoryCardTextInline,
                isSelected && styles.categoryCardTextInlineSelected,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  categoryGridInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%', // 부모 컨테이너의 전체 너비 사용
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
    marginRight: '3.33%', // 3개 배치를 위한 간격
    marginBottom: 10,
  },
  categoryCardInlineLastInRow: {
    marginRight: 0, // 마지막 카드는 marginRight 제거하여 정확한 3x2 배치
  },
  categoryCardInlineSelected: {
    borderColor: '#34B79F',
    backgroundColor: '#F0FDFA',
  },
  categoryCardIconContainerInline: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
  },
});

