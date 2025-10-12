/**
 * 공통 하단 네비게이션 바 컴포넌트
 */
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BottomNavigationBar: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleHome = () => {
    // 사용자 role에 따라 홈 화면 이동
    router.push('/home');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      Alert.alert('알림', '이전 화면이 없습니다.');
    }
  };

  const handleMenu = () => {
    Alert.alert('준비중', '메뉴 기능은 개발 중입니다.');
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {/* 왼쪽: 햄버거 메뉴 */}
      <TouchableOpacity
        style={styles.navButton}
        onPress={handleMenu}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>☰</Text>
        <Text style={styles.label}>메뉴</Text>
      </TouchableOpacity>

      {/* 중간: 홈 버튼 */}
      <TouchableOpacity
        style={[styles.navButton, styles.homeButton]}
        onPress={handleHome}
        activeOpacity={0.7}
      >
        <View style={styles.homeIconContainer}>
          <Text style={styles.homeIcon}>🏠</Text>
        </View>
        <Text style={styles.homeLabel}>홈</Text>
      </TouchableOpacity>

      {/* 오른쪽: 뒤로가기 */}
      <TouchableOpacity
        style={styles.navButton}
        onPress={handleBack}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>←</Text>
        <Text style={styles.label}>뒤로</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 80, // 더 높게 만들어 접근성 향상
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 2, // 더 굵은 테두리로 구분 명확화
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    // Android 시스템 네비게이션 바 위에 표시되도록 z-index 높임
    zIndex: 1000,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, // 더 큰 터치 영역
    paddingHorizontal: 8,
    // 터치 피드백을 위한 최소 터치 영역 확보
    minHeight: 60,
  },
  homeButton: {
    position: 'relative',
  },
  icon: {
    fontSize: 32, // 더 큰 아이콘
    color: '#333333', // 더 진한 색상으로 가독성 향상
    marginBottom: 6,
  },
  label: {
    fontSize: 14, // 더 큰 폰트
    color: '#333333', // 더 진한 색상
    fontWeight: '500', // 약간 굵게
  },
  homeIconContainer: {
    backgroundColor: '#007AFF',
    width: 60, // 더 큰 원형 버튼
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  homeIcon: {
    fontSize: 32, // 더 큰 홈 아이콘
  },
  homeLabel: {
    fontSize: 14, // 더 큰 폰트
    color: '#007AFF',
    fontWeight: '700', // 더 굵게
  },
});

