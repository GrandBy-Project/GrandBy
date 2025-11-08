/**
 * 사이드 메뉴 컴포넌트
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useSelectedElderlyStore } from '../store/selectedElderlyStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive, getResponsiveFontSize, getResponsivePadding, getResponsiveSize } from '../hooks/useResponsive';
import { useFontSizeStore } from '../store/fontSizeStore';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { UserRole } from '../types';

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedElderlyId, selectedElderlyName } = useSelectedElderlyStore();
  const insets = useSafeAreaInsets();
  const { scale, width: screenWidth, height: screenHeight } = useResponsive();
  const { fontSizeLevel } = useFontSizeStore();

  // 애니메이션 값들
  const slideAnim = React.useRef(new Animated.Value(-300)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      // 메뉴가 나타날 때
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = () => {
    // 닫기 애니메이션 실행 후 onClose 호출
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 애니메이션 완료 후 onClose 호출
      onClose();
    });
  };

  // 역할에 따른 메뉴 항목 정의
  const getMenuItems = () => {
    // 보호자 메뉴
    if (user?.role === UserRole.CAREGIVER) {
      return [
        {
          id: 'schedule-management',
          iconName: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
          title: '일정 관리',
          onPress: () => {
            router.push('/calendar');
            handleClose();
          },
        },
        {
          id: 'statistics',
          iconName: 'bar-chart-outline' as keyof typeof Ionicons.glyphMap,
          title: '통계',
          onPress: () => {
            // 선택된 어르신이 있으면 쿼리 파라미터 포함, 없으면 기본 경로
            if (selectedElderlyId && selectedElderlyName) {
              router.push(`/guardian-statistics?elderlyId=${selectedElderlyId}&elderlyName=${encodeURIComponent(selectedElderlyName)}`);
            } else {
              router.push('/guardian-statistics');
            }
            handleClose();
          },
        },
        {
          id: 'ai-call-settings',
          iconName: 'phone-portrait-outline' as keyof typeof Ionicons.glyphMap,
          title: 'AI 통화 설정',
          onPress: () => {
            router.push('/guardian-ai-call');
            handleClose();
          },
        },
        {
          id: 'diary',
          iconName: 'book-outline' as keyof typeof Ionicons.glyphMap,
          title: '일기장',
          onPress: () => {
            router.push('/diaries');
            handleClose();
          },
        },
        {
          id: 'mypage',
          iconName: 'person-outline' as keyof typeof Ionicons.glyphMap,
          title: '내 정보',
          onPress: () => {
            router.push('/mypage');
            handleClose();
          },
        },
      ];
    }
    
    // 어르신 메뉴 (기본값)
    return [
      {
        id: 'todo-list',
        iconName: 'list-outline' as keyof typeof Ionicons.glyphMap,
        title: '해야 할 일',
        onPress: () => {
          router.push('/todos');
          handleClose();
        },
      },
      {
        id: 'ai-call',
        iconName: 'call-outline' as keyof typeof Ionicons.glyphMap,
        title: 'AI 통화',
        onPress: () => {
          router.push('/ai-call');
          handleClose();
        },
      },
      {
        id: 'shared-diary',
        iconName: 'book-outline' as keyof typeof Ionicons.glyphMap,
        title: '일기장',
        onPress: () => {
          router.push('/diaries');
          handleClose();
        },
      },
      {
        id: 'calendar',
        iconName: 'calendar-outline' as keyof typeof Ionicons.glyphMap,
        title: '달력',
        onPress: () => {
          router.push('/calendar');
          handleClose();
        },
      },
      {
        id: 'mypage',
        iconName: 'person-outline' as keyof typeof Ionicons.glyphMap,
        title: '내 정보',
        onPress: () => {
          router.push('/mypage');
          handleClose();
        },
      },
    ];
  };

  const menuItems = getMenuItems();

  // 순수 비율 기반 동적 계산
  // 메뉴 너비: 화면 너비의 70-75% (화면 크기에 따라 자연스럽게)
  const menuWidth = screenWidth * (screenWidth < 400 ? 0.70 : 0.75);
  
  // 프로필 섹션
  const profilePadding = getResponsivePadding(24, scale);
  const profileImageSize = getResponsiveSize(80, scale);
  const profileImageBorderRadius = profileImageSize / 2;
  const profileImageFontSize = getResponsiveFontSize(40, scale);
  const profileImageMarginBottom = getResponsivePadding(16, scale);
  const userNameFontSize = getResponsiveFontSize(24, scale);
  const userNameMarginBottom = getResponsivePadding(8, scale);
  const userInfoFontSize = getResponsiveFontSize(16, scale);
  
  // 메뉴 섹션
  const menuSectionPadding = getResponsivePadding(16, scale);
  const menuItemPaddingVertical = getResponsivePadding(10, scale); // 세로폭 더 축소 (12 → 10)
  const menuItemPaddingHorizontal = getResponsivePadding(20, scale);
  
  // 메뉴 아이콘 컨테이너 (원형)
  const menuIconContainerSize = getResponsiveSize(48, scale, true);
  const menuIconContainerBorderRadius = menuIconContainerSize / 2; // 원형을 위한 borderRadius
  const menuIconSize = getResponsiveFontSize(22, scale);
  const menuIconMarginRight = getResponsivePadding(16, scale);
  
  // 메뉴 텍스트
  const menuTextFontSize = getResponsiveFontSize(16, scale);
  const menuTextLineHeight = menuTextFontSize * 1.4;
  const menuItemMarginBottom = getResponsivePadding(8, scale); // 간격도 조금 축소
  const menuItemBorderRadius = getResponsivePadding(16, scale);
  
  // 하단 섹션 (Safe Area 고려)
  const bottomSectionPadding = getResponsivePadding(20, scale);
  const bottomSectionPaddingBottom = Math.max(
    insets.bottom + getResponsivePadding(20, scale),
    getResponsivePadding(40, scale)
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* 배경 오버레이 - 자연스럽게 페이드 인/아웃 */}
        <Animated.View 
          style={[
            styles.backdrop,
            { opacity: fadeAnim }
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>
        
          {/* 사이드 메뉴 - 왼쪽에서 오른쪽으로 슬라이드 */}
        <Animated.View 
          style={[
            styles.menuContainer, 
            { 
              width: menuWidth,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          {/* 프로필 섹션 */}
          <View style={[
            styles.profileSection,
            {
              padding: profilePadding,
              paddingTop: Math.max(insets.top, getResponsivePadding(20, scale)) + profilePadding,
            }
          ]}>
            <View style={[
              styles.profileImageContainer,
              {
                width: profileImageSize,
                height: profileImageSize,
                borderRadius: profileImageBorderRadius,
                marginBottom: profileImageMarginBottom,
              }
            ]}>
              <Ionicons 
                name="person-circle" 
                size={profileImageSize * 0.9} 
                color="#34B79F" 
              />
            </View>
            <Text style={[
              styles.userName, 
              { 
                fontSize: userNameFontSize, 
                marginBottom: userNameMarginBottom 
              },
              fontSizeLevel >= 1 && { fontSize: userNameFontSize * 1.2 },
              fontSizeLevel >= 2 && { fontSize: userNameFontSize * 1.4 }
            ]}>
              {user?.name || 'Patrick'}
            </Text>
            <Text style={[
              styles.userInfo, 
              { fontSize: userInfoFontSize },
              fontSizeLevel >= 1 && { fontSize: userInfoFontSize * 1.15 },
              fontSizeLevel >= 2 && { fontSize: userInfoFontSize * 1.3 }
            ]}>
              Ford Transit Connect
            </Text>
          </View>

          {/* 메뉴 항목들 - ScrollView로 감싸서 오버플로우 방지 */}
          <ScrollView
            style={styles.menuScrollView}
            contentContainerStyle={[
              styles.menuSection,
              {
                padding: menuSectionPadding,
              }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  {
                    paddingVertical: menuItemPaddingVertical,
                    paddingHorizontal: menuItemPaddingHorizontal,
                    marginBottom: index < menuItems.length - 1 ? menuItemMarginBottom : 0,
                    borderRadius: menuItemBorderRadius,
                  }
                ]}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                {/* 아이콘 컨테이너 */}
                <View style={[
                  styles.menuIconContainer,
                  {
                    width: menuIconContainerSize,
                    height: menuIconContainerSize,
                    borderRadius: menuIconContainerBorderRadius,
                    marginRight: menuIconMarginRight,
                  }
                ]}>
                  <Ionicons 
                    name={item.iconName} 
                    size={menuIconSize} 
                    color={Colors.primary}
                    style={item.id === 'ai-call-settings' ? { transform: [{ scaleY: 0.85 }] } : undefined}
                  />
                </View>
                {/* 메뉴 텍스트 */}
                <Text 
                  style={[
                    styles.menuText,
                    {
                      color: Colors.text,
                      fontSize: menuTextFontSize,
                      lineHeight: menuTextLineHeight,
                      flex: 1,
                    },
                    fontSizeLevel >= 1 && { fontSize: menuTextFontSize * 1.15, lineHeight: menuTextFontSize * 1.15 * 1.4 },
                    fontSizeLevel >= 2 && { fontSize: menuTextFontSize * 1.3, lineHeight: menuTextFontSize * 1.3 * 1.4 }
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.title}
                </Text>
                {/* 화살표 아이콘 */}
                <Ionicons 
                  name="chevron-forward" 
                  size={getResponsiveFontSize(20, scale)} 
                  color={Colors.textLight}
                  style={{ marginLeft: getResponsivePadding(8, scale) }}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 하단 섹션 */}
          <View style={[
            styles.bottomSection,
            {
              padding: bottomSectionPadding,
              paddingBottom: bottomSectionPaddingBottom,
            }
          ]}>
            {/* 닫기 버튼 - 텍스트로 우측 배치 */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.closeText,
                { fontSize: getResponsiveFontSize(16, scale) },
                fontSizeLevel >= 1 && { fontSize: getResponsiveFontSize(16, scale) * 1.15 },
                fontSizeLevel >= 2 && { fontSize: getResponsiveFontSize(16, scale) * 1.3 }
              ]}>
                닫기
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    flex: 1,
  },
  menuContainer: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden', // 둥근 모서리가 확실히 적용되도록
  },
  
  // 프로필 섹션
  profileSection: {
    backgroundColor: '#34B79F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    // padding, paddingTop은 동적으로 적용됨
  },
  profileImageContainer: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    // width, height, borderRadius, marginBottom은 동적으로 적용됨
  },
  profileImage: {
    // fontSize는 동적으로 적용됨
  },
  userName: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    // fontSize, marginBottom은 동적으로 적용됨
  },
  userInfo: {
    color: '#FFFFFF',
    opacity: 0.9,
    // fontSize는 동적으로 적용됨
  },
 
  // 메뉴 섹션
  menuScrollView: {
    flex: 1,
    backgroundColor: Colors.backgroundGray, // 연한 회색 배경으로 구분감 강화
  },
  menuSection: {
    // padding은 동적으로 적용됨
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background, // 흰색 카드 배경
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    // paddingVertical, paddingHorizontal, marginBottom, borderRadius는 동적으로 적용됨
  },
  menuIconContainer: {
    backgroundColor: Colors.primaryPale, // 연한 민트색 배경
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // 원형이 확실히 적용되도록
    // width, height, borderRadius, marginRight는 동적으로 적용됨
  },
  menuText: {
    fontWeight: '600',
    // fontSize, lineHeight, color는 동적으로 적용됨
  },

  // 하단 섹션
  bottomSection: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: Colors.backgroundGray, // 상단과 일관성 유지
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    // padding, paddingBottom은 동적으로 적용됨
  },
  closeButton: {
    // 스타일은 동적으로 적용됨
  },
  closeText: {
    color: Colors.primary,
    fontWeight: '600',
    // fontSize는 동적으로 적용됨
  },
});
