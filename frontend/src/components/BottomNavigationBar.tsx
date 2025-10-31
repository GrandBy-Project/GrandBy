/**
 * 공통 하단 네비게이션 바 컴포넌트
 */
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useResponsive, getResponsiveFontSize, getResponsivePadding, getResponsiveSize } from '../hooks/useResponsive';

export const BottomNavigationBar: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scale } = useResponsive();

  const handleHome = () => {
    router.push('/home');
  };

  // 순수 비율 기반 동적 계산
  const containerPaddingBottom = getResponsivePadding(6, scale);
  const navButtonPaddingVertical = getResponsivePadding(6, scale);
  
  // 홈 아이콘 컨테이너 크기 (중앙 배치를 위해 크기 유지)
  const homeIconSize = getResponsiveSize(48, scale, true);
  const homeIconBorderRadius = homeIconSize / 2;
  const homeIconIconSize = getResponsiveFontSize(24, scale);

  return (
    <View style={[
      styles.container,
      {
        paddingBottom: Math.max(insets.bottom, containerPaddingBottom),
        paddingTop: navButtonPaddingVertical,
      }
    ]}>
      {/* 홈 버튼 - 중앙 배치 */}
      <TouchableOpacity
        style={[
          styles.homeButton,
          {
            paddingVertical: navButtonPaddingVertical,
            paddingHorizontal: getResponsivePadding(8, scale),
          }
        ]}
        onPress={handleHome}
        activeOpacity={0.7}
      >
        <View style={[
          styles.homeIconContainer,
          {
            width: homeIconSize,
            height: homeIconSize,
            borderRadius: homeIconBorderRadius,
          }
        ]}>
          <Ionicons name="home" size={homeIconIconSize} color={Colors.textWhite} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
  },
  homeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    // paddingVertical, paddingHorizontal은 동적으로 적용됨
  },
  homeIconContainer: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    // width, height, borderRadius은 동적으로 적용됨
  },
});

