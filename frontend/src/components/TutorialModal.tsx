/**
 * 튜토리얼 모달 컴포넌트
 * 회원가입 후 최초 진입 시 AI 통화 기능 안내
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { PhoneIcon } from './CustomIcons';

export type TutorialType = 'home' | 'ai-call';

interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  type?: TutorialType; // 'home' (기본값) 또는 'ai-call'
  targetButtonPosition?: { x: number; y: number; width: number; height: number };
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  visible,
  onClose,
  onComplete,
  type = 'home',
  targetButtonPosition,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible]);

  const handleComplete = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete();
      onClose();
    });
  };

  // 대화박스 위치 계산
  const dialogBoxStyle = type === 'ai-call'
    ? {
        position: 'absolute' as const,
        top: screenHeight * 0.5 - 200,
        left: screenWidth * 0.5 - 150,
      }
    : targetButtonPosition
    ? {
        position: 'absolute' as const,
        top: targetButtonPosition.y - 120,
        left: Math.max(16, Math.min(targetButtonPosition.x - 100, screenWidth - 232)),
      }
    : {
        position: 'absolute' as const,
        top: screenHeight * 0.35,
        left: (screenWidth - 300) / 2,
      };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleComplete}
    >
      <View style={styles.overlay}>
        {/* 반투명 배경 */}
        <Animated.View
          style={[
            styles.overlayContent,
            { opacity: fadeAnim },
          ]}
        />

        {/* 대화박스 */}
        <Animated.View
          style={[
            styles.dialogBox,
            dialogBoxStyle,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* 말풍선 꼬리 (home 타입만) */}
          {type === 'home' && targetButtonPosition && (
            <View
              style={[
                styles.tail,
                {
                  top: 120,
                  left: targetButtonPosition.x - (dialogBoxStyle as any).left - 20,
                },
              ]}
            />
          )}

          {/* 대화 내용 */}
          <View style={styles.dialogContent}>
            <View style={styles.iconContainer}>
              <PhoneIcon size={32} color={Colors.primary} />
            </View>
            
            {type === 'home' ? (
              <>
                <Text style={styles.title}>안녕하세요! 👋</Text>
                <Text style={styles.message}>
                  <Text style={styles.highlight}>AI 통화</Text> 버튼을 통해{'\n'}
                  하루와 대화할 수 있어요!
                </Text>
                <Text style={styles.subMessage}>
                  대화 내용은 자동으로{'\n'}
                  일기로 저장됩니다
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>하루와 대화하기</Text>
                
                <View style={styles.messageContainer}>
                  <Text style={styles.message}>
                    아래 <Text style={styles.highlight}>"하루와 대화하기"</Text> 버튼을 눌러서{'\n'}
                    지금 바로 통화할 수 있어요!
                  </Text>
                  
                  <Text style={styles.message}>
                    또는 <Text style={styles.highlight}>"자동 전화 예약"</Text>을 통해{'\n'}
                    원하는 시간대에 하루가 전화를 걸어드릴 수 있습니다.
                  </Text>
                </View>

                <View style={styles.limitContainer}>
                  <Ionicons name="information-circle" size={20} color={Colors.warning} style={{ marginRight: 8 }} />
                  <Text style={styles.limitText}>
                    전화는 하루 한 번만 가능합니다
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* 확인 버튼 */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleComplete}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmButtonText}>알겠어요</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayContent: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  dialogBox: {
    width: 300,
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tail: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.background,
  },
  dialogContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  highlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
  subMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  messageContainer: {
    width: '100%',
    marginBottom: 16,
  },
  limitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginTop: 8,
  },
  limitText: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '600',
    flex: 1,
  },
});

