/**
 * 빠른 액션 버튼 그리드 컴포넌트
 * 어르신/보호자 화면 공통 사용
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface QuickAction {
  id: string;
  label: string;
  icon: string | React.ReactNode; // Ionicons name 또는 커스텀 컴포넌트
  onPress: () => void;
  iconColor?: string;
}

interface QuickActionGridProps {
  actions: QuickAction[];
  columns?: number; // 자동 조정: actions.length에 따라 결정
  size?: 'default' | 'large';
  iconColor?: string;
}

export const QuickActionGrid: React.FC<QuickActionGridProps> = ({
  actions,
  columns,
  size = 'default',
  iconColor = '#34B79F',
}) => {
  const iconSize = size === 'large' ? 32 : 24;
  const actionIconSize = size === 'large' ? 56 : 56;
  
  // columns가 지정되지 않으면 actions.length에 따라 자동 결정 (최대 4개)
  const actualColumns = columns || Math.min(actions.length, 4);

  return (
    <View style={styles.quickActions}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={[
            styles.actionButton,
            size === 'large' && styles.actionButtonLarge,
            { flex: 1 / actualColumns }
          ]}
          onPress={action.onPress}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              size === 'large' && styles.actionIconLarge,
              { width: actionIconSize, height: actionIconSize, borderRadius: actionIconSize / 2 }
            ]}
          >
            {typeof action.icon === 'string' ? (
              <Ionicons
                name={action.icon as any}
                size={iconSize}
                color={action.iconColor || iconColor}
              />
            ) : (
              React.isValidElement(action.icon) &&
              React.cloneElement(action.icon as React.ReactElement<any>, {
                size: iconSize,
                color: action.iconColor || iconColor,
              })
            )}
          </View>
          <Text
            style={[
              styles.actionLabel,
              size === 'large' && styles.actionLabelLarge
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
  },
  actionButtonLarge: {
    paddingVertical: 20,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    textAlign: 'center',
  },
  actionLabelLarge: {
    fontSize: 16,
  },
});

