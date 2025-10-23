/**
 * 전화번호 ARS 인증 모달
 * 회원가입 후 Twilio ARS 인증 안내 및 상태 확인
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Button } from './Button';
import { checkPhoneVerification } from '../api/auth';
import { PhoneVerification } from '../types';

interface PhoneVerificationModalProps {
  visible: boolean;
  verificationInfo: PhoneVerification;
  onVerified: () => void;
}

export const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({
  visible,
  verificationInfo,
  onVerified,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [verified, setVerified] = useState(false);

  // 자동 확인 (10초마다)
  useEffect(() => {
    if (!visible || verified) return;

    const interval = setInterval(() => {
      handleCheckVerification(true);
    }, 10000); // 10초마다 자동 확인

    return () => clearInterval(interval);
  }, [visible, verified]);

  // 인증 상태 확인
  const handleCheckVerification = async (auto = false) => {
    try {
      if (!auto) setIsChecking(true);

      const response = await checkPhoneVerification(verificationInfo.phone_number);

      if (response.verified) {
        setVerified(true);
        onVerified();
      } else {
        if (!auto) {
          setCheckCount(checkCount + 1);
          Alert.alert(
            '인증 대기 중',
            '아직 인증이 완료되지 않았습니다.\n전화를 받아 코드를 입력해주세요.'
          );
        }
      }
    } catch (error: any) {
      if (!auto) {
        Alert.alert('오류', '인증 상태 확인에 실패했습니다.');
      }
    } finally {
      if (!auto) setIsChecking(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="call" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.title}>전화번호 인증</Text>
            <Text style={styles.subtitle}>ARS 인증이 필요합니다</Text>
          </View>

          {/* 내용 */}
          <View style={styles.content}>
            {/* 국제전화 안내 - 강조 */}
            <View style={[styles.infoBox, { backgroundColor: Colors.warningLight }]}>
              <Text style={[styles.infoTitle, { color: Colors.warning }]}>⚠️ 국제전화 안내</Text>
              <Text style={styles.infoText}>
                • "국제전화입니다" 음성이 먼저 나옵니다{'\n'}
                • 음성 안내 후 아래 코드를 입력해주세요
              </Text>
            </View>

            {/* 인증 코드 */}
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>인증 코드</Text>
              <Text style={styles.code}>{verificationInfo.validation_code}</Text>
            </View>

            {/* 안내사항 */}
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>💡 안내사항</Text>
              <Text style={styles.noticeText}>
                • 코드를 정확히 입력해주세요{'\n'}
                • 인증 완료까지 최대 1분 소요됩니다{'\n'}
              </Text>
            </View>
          </View>

          {/* 자동 확인 안내 */}
          <View style={styles.autoCheckInfo}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryPale,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  content: {
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: Colors.primaryPale,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  codeLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  code: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: 8,
  },
  codeHelper: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  phoneBox: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  phoneLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  phone: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  noticeBox: {
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  buttons: {
    gap: 12,
  },
  button: {
    marginBottom: 0,
  },
  autoCheckInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  autoCheckText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});

