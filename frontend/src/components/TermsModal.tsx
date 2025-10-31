/**
 * 약관 동의 모달
 * 사용자 유형별로 다른 약관 표시
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
  BackHandler,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
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
본 약관은 그랜비(이하 "회사")가 제공하는 AI 기반 어르신 케어 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리·의무 및 책임 사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조 (서비스의 제공)
1. AI 자동 전화/대화 서비스 및 안부 확인
2. 대화 내용 기반 자동 다이어리 생성 및 보관
3. 일정/할 일 관리, 알림 제공
4. 감정 분석 및 이상 징후 탐지·알림
※ 서비스 내용은 운영 정책에 따라 변경될 수 있으며, 변경 시 사전 공지합니다.

제3조 (회원의 의무)
1. 회원은 관계 법령, 본 약관, 이용안내 및 공지사항을 준수해야 합니다.
2. 타인의 정보를 도용하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.
3. 기기 분실 등 보안 사고 발생 시 즉시 회사에 통지해야 합니다.

제4조 (서비스 중단)
천재지변, 정전, 설비 고장, 통신 장애 등 불가항력적 사유로 서비스가 일시 중단될 수 있습니다.`,
  },
  {
    id: 'privacy',
    title: '개인정보 처리방침',
    required: true,
    content: `1. 수집하는 개인정보 항목
- 필수: 이메일, 비밀번호, 이름, 전화번호, 생년월일, 성별
- 선택: 프로필 사진, 알림 수신 설정

2. 개인정보의 이용 목적
- 회원 식별 및 본인 확인, 서비스 제공/유지/개선
- 이상 징후 탐지, 고객 문의 대응, 공지사항 전달

3. 보유 및 이용 기간
- 회원 탈퇴 시 즉시 파기. 다만 관계 법령(전자상거래 등에서의 소비자보호에 관한 법률 등)에 따라 일정 기간 보관할 수 있습니다.

4. 위탁 및 제3자 제공
- 서비스 제공을 위해 필요한 범위에서 개인정보 처리업무를 위탁할 수 있으며, 위탁처리 현황은 홈페이지/앱 내 고지합니다.

5. 이용자의 권리
- 개인정보 열람·정정·삭제·처리정지 요구 및 동의 철회가 가능합니다.`,
  },
  {
    id: 'ai_call',
    title: 'AI 전화 서비스 이용 동의',
    required: true,
    content: `1. AI 전화 서비스란?
인공지능 기술을 활용하여 정기적으로 전화를 드려 안부를 확인하고 대화를 이어주는 서비스입니다.

2. 수집 및 이용 정보
- 통화 녹음 파일 및 변환된 텍스트
- 대화 메타데이터(통화 일시, 지속시간 등)
- 감정/키워드 분석 결과

3. 정보의 이용 및 공유
- 기록은 어르신 본인과 연결된 보호자에게만 열람 권한이 부여됩니다.
- 긴급 상황 감지 시 보호자/담당자에게 즉시 알림을 전송합니다.`,
    userTypes: [UserRole.ELDERLY],
  },
  {
    id: 'notification',
    title: '알림 수신 동의',
    required: true,
    content: `1. 알림 수신 내용
- 어르신의 이상 징후 감지 알림
- 일정/할 일/복약 알림
- AI 전화 통화 결과 및 요약
- 감정 상태 변화/연속 미응답 경고

2. 수신 방법
- 앱 푸시(기본), 이메일(선택), 문자(긴급 시)`,
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
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // 반응형 스케일 헬퍼(기준 375x812)
  const guidelineBaseWidth = 375;
  const guidelineBaseHeight = 812;
  const scale = (size: number) => (screenWidth / guidelineBaseWidth) * size;
  const verticalScale = (size: number) => (screenHeight / guidelineBaseHeight) * size;
  const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

  // 하드웨어 뒤로가기: 상세 보기일 때는 상세를 닫고 목록으로 복귀
  useEffect(() => {
    const onBack = () => {
      if (visible && viewingTerm) {
        setViewingTerm(null);
        return true; // 기본 동작(화면 종료) 막기
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, viewingTerm]);

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
      <Modal visible={visible} animationType="slide" onRequestClose={() => setViewingTerm(null)}>
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: verticalScale(60), paddingBottom: verticalScale(16) }]}>
            <TouchableOpacity onPress={() => setViewingTerm(null)}>
              <Text style={[styles.backButton, { fontSize: moderateScale(16) }]}>← 돌아가기</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { fontSize: moderateScale(20) }]}>{term.title}</Text>
          </View>
          <ScrollView style={styles.contentScroll} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.contentText, { fontSize: moderateScale(14), lineHeight: moderateScale(24) }]}>{term.content}</Text>
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
        <View style={[styles.header, { paddingTop: verticalScale(60), paddingBottom: verticalScale(16) }]}>
          <Text style={[styles.headerTitle, { fontSize: moderateScale(20) }]}>약관 동의</Text>
          <TouchableOpacity onPress={onCancel}>
            <Text style={[styles.closeButton, { fontSize: moderateScale(24) }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: Math.max(140, insets.bottom + 100) }}
        >
          {/* 전체 동의 */}
          <TouchableOpacity style={styles.allAgreeContainer} onPress={handleToggleAll}>
            <View style={[styles.checkbox, allAgreed && styles.checkboxChecked, { width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(4) }]}>
              {allAgreed && <Text style={[styles.checkmark, { fontSize: moderateScale(16) }]}>✓</Text>}
            </View>
            <Text style={[styles.allAgreeText, { fontSize: moderateScale(18) }]}>전체 동의</Text>
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
                  style={[styles.checkbox, agreements[term.id] && styles.checkboxChecked, { width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(4) }]}
                >
                  {agreements[term.id] && <Text style={[styles.checkmark, { fontSize: moderateScale(16) }]}>✓</Text>}
                </View>
                <Text style={[styles.termTitle, { fontSize: moderateScale(14) }]}>
                  {term.required ? '[필수]' : '[선택]'} {term.title}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewingTerm(term.id)}>
                <Text style={[styles.viewButton, { fontSize: moderateScale(14) }]}>보기</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* 사용자 유형별 안내 */}
          <View style={styles.infoBox}>
            <Text style={[styles.infoText, { fontSize: moderateScale(14), lineHeight: moderateScale(20) }]}>
              {userRole === UserRole.ELDERLY
                ? '어르신 회원으로 가입하시면 AI 전화 서비스를 이용하실 수 있습니다.'
                : '보호자 회원으로 가입하시면 연결된 어르신의 상태를 확인하실 수 있습니다.'}
            </Text>
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + verticalScale(16) }] }>
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
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 24,
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

