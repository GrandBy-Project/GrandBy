/**
 * 공통 헤더 컴포넌트
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  rightButton?: React.ReactNode;
  leftButton?: React.ReactNode;
  showDefaultTitle?: boolean; // 기본 "그랜비" 타이틀 표시 여부
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  rightButton,
  leftButton,
  showDefaultTitle = true,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  // 표시할 타이틀 결정
  const displayTitle = title || (showDefaultTitle ? '그랜비' : '');

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        {leftButton}
      </View>

      <View style={styles.centerSection}>
        {displayTitle && <Text style={styles.title}>{displayTitle}</Text>}
      </View>

      <View style={styles.rightSection}>{rightButton}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 80, // 고정 높이 대신 최소 높이 사용
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10, // 하단 패딩으로 일관성 유지
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#007AFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
  },
});