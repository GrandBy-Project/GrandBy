/**
 * 약관 동의 모달
 * 사용자 유형별로 다른 약관 표시
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Button } from './Button';
import { UserRole } from '../types';

interface TermsModalProps {
  visible: boolean;
  userRole: UserRole;
  onAgree: () => void;
  onCancel: () => void;
}

interface TermItem {
  id: string;
  title: string;
  required: boolean;
  content: string;
  userTypes?: UserRole[];
}

const TERMS_ITEMS: TermItem[] = [
  {
    id: 'service',
    title: '서비스 이용약관',
    required: true,
    content: `제1조 (목적)
본 약관은 그랜비가 제공하는 AI 기반 어르신 케어 서비스의 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (서비스의 제공)
1. AI 자동 전화 서비스
2. 대화 내용 기반 자동 다이어리 생성
3. 일정 및 할 일 관리
4. 감정 분석 및 이상 징후 알림

제3조 (회원의 의무)
회원은 관계 법령, 본 약관, 이용안내 등을 준수하여야 합니다.`,
  },
  {
    id: 'privacy',
    title: '개인정보 처리방침',
    required: true,
    content: `1. 수집하는 개인정보 항목
- 필수: 이메일, 비밀번호, 이름, 전화번호
- 선택: 프로필 사진, 생년월일

2. 개인정보의 이용 목적
- 회원 관리 및 본인 확인
- 서비스 제공 및 개선
- 고객 상담 및 불만 처리

3. 개인정보의 보유 및 이용 기간
회원 탈퇴 시까지 보유하며, 관계 법령에 따라 일정 기간 보관할 수 있습니다.`,
  },
  {
    id: 'ai_call',
    title: 'AI 전화 서비스 이용 동의',
    required: true,
    content: `1. AI 전화 서비스란?
인공지능 기술을 활용하여 정기적으로 전화를 드려 안부를 확인하고 대화하는 서비스입니다.

2. 수집 및 이용 정보
- 통화 내용 녹음
- 음성 데이터의 텍스트 변환
- 대화 내용 분석 (감정, 키워드 등)

3. 정보의 공유
연결된 보호자에게 공유되며, 긴급 상황 시 즉시 알림이 전송됩니다.`,
    userTypes: [UserRole.ELDERLY],
  },
  {
    id: 'notification',
    title: '알림 수신 동의',
    required: true,
    content: `1. 알림 수신 내용
- 어르신의 이상 징후 감지 알림
- 일정 및 할 일 알림
- AI 전화 통화 완료 알림
- 감정 상태 변화 알림

2. 알림 수신 방법
- 앱 푸시 알림
- 이메일 (선택)
- 문자 메시지 (긴급 상황)`,
    userTypes: [UserRole.CAREGIVER],
  },
  {
    id: 'marketing',
    title: '마케팅 정보 수신 동의',
    required: false,
    content: `1. 수신 내용
- 신규 서비스 및 기능 안내
- 이벤트 및 프로모션 정보
- 서비스 이용 팁

2. 수신 방법
- 앱 푸시 알림
- 이메일
- 문자 메시지

※ 본 동의는 선택사항이며, 거부하셔도 서비스 이용에 제한이 없습니다.`,
  },
];

export const TermsModal: React.FC<TermsModalProps> = ({
  visible,
  userRole,
  onAgree,
  onCancel,
}) => {
  const [agreements, setAgreements] = useState<Record<string, boolean>>({});
  const [viewingTerm, setViewingTerm] = useState<string | null>(null);

  // 현재 사용자 유형에 해당하는 약관만 필터링
  const filteredTerms = TERMS_ITEMS.filter(
    (term) => !term.userTypes || term.userTypes.includes(userRole)
  );

  // 전체 동의
  const allAgreed = filteredTerms
    .filter((term) => term.required)
    .every((term) => agreements[term.id]);

  const handleToggle = (id: string) => {
    setAgreements({ ...agreements, [id]: !agreements[id] });
  };

  const handleToggleAll = () => {
    const newAgreements: Record<string, boolean> = {};
    filteredTerms.forEach((term) => {
      newAgreements[term.id] = !allAgreed;
    });
    setAgreements(newAgreements);
  };

  const handleAgree = () => {
    if (allAgreed) {
      onAgree();
    }
  };

  // 약관 상세 보기
  if (viewingTerm) {
    const term = TERMS_ITEMS.find((t) => t.id === viewingTerm);
    if (!term) return null;

    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setViewingTerm(null)}>
              <Text style={styles.backButton}>← 돌아가기</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{term.title}</Text>
          </View>
          <ScrollView style={styles.contentScroll}>
            <Text style={styles.contentText}>{term.content}</Text>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // 약관 동의 목록
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>약관 동의</Text>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* 전체 동의 */}
          <TouchableOpacity style={styles.allAgreeContainer} onPress={handleToggleAll}>
            <View style={[styles.checkbox, allAgreed && styles.checkboxChecked]}>
              {allAgreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.allAgreeText}>전체 동의</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 개별 약관 */}
          {filteredTerms.map((term) => (
            <View key={term.id} style={styles.termItem}>
              <TouchableOpacity
                style={styles.termLeft}
                onPress={() => handleToggle(term.id)}
              >
                <View
                  style={[styles.checkbox, agreements[term.id] && styles.checkboxChecked]}
                >
                  {agreements[term.id] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termTitle}>
                  {term.required ? '[필수]' : '[선택]'} {term.title}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewingTerm(term.id)}>
                <Text style={styles.viewButton}>보기</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* 사용자 유형별 안내 */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {userRole === UserRole.ELDERLY
                ? '👴 어르신 회원으로 가입하시면 AI 전화 서비스를 이용하실 수 있습니다.'
                : '👨‍👩‍👧 보호자 회원으로 가입하시면 연결된 어르신의 상태를 확인하실 수 있습니다.'}
            </Text>
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={styles.footer}>
          <Button title="동의하고 가입" onPress={handleAgree} disabled={!allAgreed} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  backButton: {
    fontSize: 16,
    color: Colors.primary,
  },
  closeButton: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  allAgreeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  allAgreeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  termItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  termLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: 'bold',
  },
  termTitle: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
  viewButton: {
    fontSize: 14,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.primaryPale,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contentScroll: {
    flex: 1,
    padding: 24,
  },
  contentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 24,
  },
});

