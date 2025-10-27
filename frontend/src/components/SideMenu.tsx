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
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

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

  const handleLogout = async () => {
    Alert.alert(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
            onClose();
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      id: 'shared-diary',
      icon: '📖',
      title: '일기장',
      color: '#34B79F',
      onPress: () => {
        router.push('/diaries');
        handleClose();
      },
    },
    {
      id: 'todo-list',
      icon: '📋',
      title: '해야 할 일',
      color: '#FF6B6B',
      onPress: () => {
        router.push('/todos');
        handleClose();
      },
    },
    {
      id: 'calendar',
      icon: '📅',
      title: '달력',
      color: '#FF9500',
      onPress: () => {
        router.push('/calendar');
        handleClose();
      },
    },
    {
      id: 'mypage',
      icon: '👤',
      title: '내 정보',
      color: '#5856D6',
      onPress: () => {
        router.push('/mypage');
        handleClose();
      },
    },
    {
      id: 'settings',
      icon: '⚙️',
      title: '설정',
      color: '#5856D6',
      onPress: () => {
        router.push('/settings');
        handleClose();
      },
    },
  ];

  const screenWidth = Dimensions.get('window').width;

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
              width: screenWidth * 0.75,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          {/* 프로필 섹션 */}
          <View style={[styles.profileSection, { paddingTop: Math.max(insets.top, 20) + 20 }]}>
            <View style={styles.profileImageContainer}>
              <Text style={styles.profileImage}>👤</Text>
            </View>
            <Text style={styles.userName}>{user?.name || 'Patrick'}</Text>
            <Text style={styles.userInfo}>Ford Transit Connect</Text>
            
          </View>

          {/* 메뉴 항목들 */}
          <View style={styles.menuSection}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconContainer, { borderColor: item.color }]}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <Text style={[styles.menuText, { color: item.color }]}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 하단 섹션 */}
          <View style={styles.bottomSection}>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>
            
            {/* 닫기 버튼 */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeIcon}>✕</Text>
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
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileImage: {
    fontSize: 40,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  userInfo: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
 
  // 메뉴 섹션
  menuSection: {
    flex: 1,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },

  // 하단 섹션
  bottomSection: {
    padding: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#34B79F',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeIcon: {
    fontSize: 20,
    color: '#666666',
    fontWeight: 'bold',
  },
});
