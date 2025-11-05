/**
 * 공통 헤더 컴포넌트
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive, getResponsiveFontSize, getResponsivePadding, getResponsiveSize } from '../hooks/useResponsive';
import { useFontSizeStore } from '../store/fontSizeStore';
import { SideMenu } from './SideMenu';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  rightButton?: React.ReactNode;
  leftButton?: React.ReactNode;
  showDefaultTitle?: boolean;
  showFontSizeButton?: boolean; // 폰트 크기 조절 버튼 표시 여부
  showMenuButton?: boolean; // 메뉴 버튼 표시 여부
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  rightButton,
  leftButton,
  showDefaultTitle = true,
  showFontSizeButton = false,
  showMenuButton = false,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scale } = useResponsive();
  const { fontSizeLevel, toggleFontSize, getFontSizeText } = useFontSizeStore();
  const [sideMenuVisible, setSideMenuVisible] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const displayTitle = title || (showDefaultTitle ? '그랜비' : '');

  // 순수 비율 기반 동적 계산 (높이 더 축소)
  const paddingHorizontal = getResponsivePadding(20, scale);
  const paddingBottom = getResponsivePadding(2, scale); // 4 → 2 (높이 더 축소)
  const titleFontSize = getResponsiveFontSize(18, scale); // 20 → 18 (더 축소)
  const backIconSize = getResponsiveFontSize(18, scale); // 20 → 18
  const backButtonPadding = getResponsivePadding(3, scale); // 4 → 3
  
  // Safe Area 고려한 동적 패딩 (높이 더 축소)
  const paddingTop = Math.max(insets.top, getResponsivePadding(6, scale)); // 8 → 6

  // 폰트 크기 버튼 스타일
  const fontSizeButtonSize = getResponsiveSize(48, scale, true);
  const fontSizeButtonBorderRadius = fontSizeButtonSize / 2;
  const fontSizeButtonPaddingHorizontal = getResponsivePadding(6, scale);
  const fontSizeButtonPaddingVertical = getResponsivePadding(4, scale);
  const fontSizeButtonTextSize = getResponsiveFontSize(12, scale);

  // 폰트 크기 버튼 컴포넌트
  const FontSizeButton = () => (
    <TouchableOpacity 
      onPress={toggleFontSize} 
      style={[
        styles.fontSizeButton,
        {
          width: fontSizeButtonSize,
          height: fontSizeButtonSize,
          borderRadius: fontSizeButtonBorderRadius,
          paddingHorizontal: fontSizeButtonPaddingHorizontal,
          paddingVertical: fontSizeButtonPaddingVertical,
        }
      ]}
      activeOpacity={0.7}
    >
      <Text style={[styles.fontSizeButtonText, { fontSize: fontSizeButtonTextSize }]}>
        {getFontSizeText()}
      </Text>
    </TouchableOpacity>
  );

  // rightButton이 있고 showFontSizeButton도 true면 둘 다 표시, 아니면 우선순위: rightButton > FontSizeButton
  const rightButtonContent = rightButton || (showFontSizeButton ? <FontSizeButton /> : null);

  // 메뉴 아이콘 크기
  const menuIconSize = getResponsiveFontSize(24, scale);

  return (
    <>
      <View style={[
        styles.container,
        {
          paddingHorizontal,
          paddingBottom,
          paddingTop,
        }
      ]}>
        <View style={styles.leftSection}>
          {showMenuButton && (
            <TouchableOpacity
              onPress={() => setSideMenuVisible(true)}
              style={[styles.menuButton, { padding: backButtonPadding }]}
              activeOpacity={0.7}
            >
              <Ionicons name="menu" size={menuIconSize} color="#333333" />
            </TouchableOpacity>
          )}
          {showBackButton && (
            <TouchableOpacity
              onPress={handleBack}
              style={[styles.backButton, { padding: backButtonPadding }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.backIcon, { fontSize: backIconSize }]}>←</Text>
            </TouchableOpacity>
          )}
          {leftButton}
        </View>

      <View style={styles.centerSection}>
        {displayTitle && (
          <Text 
            style={[styles.title, { fontSize: titleFontSize }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayTitle}
          </Text>
        )}
      </View>

      <View style={styles.rightSection}>
        {rightButton && showFontSizeButton ? (
          <View style={styles.rightButtonContainer}>
            {rightButton}
            <View style={{ marginLeft: getResponsivePadding(8, scale) }}>
              <FontSizeButton />
            </View>
          </View>
        ) : (
          rightButtonContent
        )}
      </View>
      </View>

      {/* 사이드 메뉴 */}
      <SideMenu
        visible={sideMenuVisible}
        onClose={() => setSideMenuVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  menuButton: {
    // padding은 동적으로 적용됨
  },
  backButton: {
    // padding은 동적으로 적용됨
  },
  backIcon: {
    color: '#007AFF',
    // fontSize는 동적으로 적용됨
  },
  title: {
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    // fontSize는 동적으로 적용됨
  },
  rightButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fontSizeButton: {
    backgroundColor: '#34B79F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    // width, height, borderRadius, padding은 동적으로 적용됨
  },
  fontSizeButtonText: {
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    // fontSize는 동적으로 적용됨
  },
});