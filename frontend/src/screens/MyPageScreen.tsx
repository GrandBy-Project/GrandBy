/**
 * 마이페이지 화면 (어르신/보호자 공통)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Switch,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { BottomNavigationBar, Header } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserRole } from '../types';
import apiClient, { API_BASE_URL } from '../api/client';
import { useFontSizeStore } from '../store/fontSizeStore';
import { useResponsive, getResponsiveFontSize, getResponsivePadding, getResponsiveSize } from '../hooks/useResponsive';
import { getConnections, deleteConnection, ConnectionWithUserInfo } from '../api/connections';
import { Colors } from '../constants/Colors';

export const MyPageScreen = () => {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { fontSizeLevel } = useFontSizeStore();
  const { scale } = useResponsive();
  const [isUploading, setIsUploading] = useState(false);
  const [isNotificationExpanded, setIsNotificationExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [connectedCaregivers, setConnectedCaregivers] = useState<ConnectionWithUserInfo[]>([]);
  const [connectedElderly, setConnectedElderly] = useState<ConnectionWithUserInfo[]>([]);
  const [isLoadingCaregivers, setIsLoadingCaregivers] = useState(false);
  const [isLoadingElderly, setIsLoadingElderly] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  // 확인 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: '확인',
    cancelText: '취소',
  });

  // Android에서 LayoutAnimation 활성화
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // 알림 설정 상태 관리
  const [notificationSettings, setNotificationSettings] = useState({
    push_notification_enabled: true,
    push_todo_reminder_enabled: true,
    push_todo_incomplete_enabled: true,
    push_todo_created_enabled: true,
    push_diary_enabled: true,
    push_call_enabled: true,
    push_connection_enabled: true,
  });

  // 알림 설정 로드
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  // 연결된 목록 로드
  useEffect(() => {
    if (user?.role === UserRole.ELDERLY) {
      loadConnectedCaregivers();
    } else if (user?.role === UserRole.CAREGIVER) {
      loadConnectedElderly();
    }
  }, [user]);

  const loadNotificationSettings = async () => {
    try {
      const response = await apiClient.get('/api/users/settings');
      if (response.data) {
        setNotificationSettings(prev => ({
          ...prev,
          ...response.data,
        }));
        console.log('✅ 알림 설정 로드 성공:', response.data);
      }
    } catch (error: any) {
      console.error('알림 설정 로드 실패:', error);
    }
  };

  const updateNotificationSetting = async (key: string, value: boolean) => {
    // 먼저 로컬 상태 업데이트
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
    
    // 백엔드에 설정 저장
    try {
      await apiClient.put('/api/users/settings', {
        [key]: value,
      });
      console.log('✅ 알림 설정 저장 성공:', key, value);
    } catch (error: any) {
      console.error('알림 설정 저장 실패:', error);
      
      // 실패 시 이전 값으로 되돌리기
      setNotificationSettings(prev => ({ ...prev, [key]: !value }));
      
      // 사용자에게 알림
      Alert.alert(
        '설정 저장 실패', 
        '설정을 저장할 수 없습니다. 네트워크 연결을 확인해주세요.',
        [{ text: '확인' }]
      );
    }
  };

  // 사용자 역할에 따른 알림 설정 필터링
  const getNotificationSettingsList = () => {
    const allSettings = [
      {
        id: 'push_notification_enabled',
        title: '푸시 알림 전체',
        description: '모든 알림을 켜거나 끕니다',
        value: notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY, UserRole.CAREGIVER],
      },
      {
        id: 'push_todo_reminder_enabled',
        title: '할 일 리마인더',
        description: '할 일 시작 10분 전 알림',
        value: notificationSettings.push_todo_reminder_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_todo_incomplete_enabled',
        title: '미완료 할 일 알림',
        description: '매일 밤 9시 미완료 할 일 알림',
        value: notificationSettings.push_todo_incomplete_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_todo_created_enabled',
        title: '새 할 일 생성 알림',
        description: '보호자가 새 할 일을 추가할 때 알림',
        value: notificationSettings.push_todo_created_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_diary_enabled',
        title: '일기 생성 알림',
        description: 'AI 전화 후 일기가 생성될 때 알림',
        value: notificationSettings.push_diary_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.CAREGIVER],
      },
      {
        id: 'push_call_enabled',
        title: 'AI 전화 완료 알림',
        description: 'AI 전화가 완료될 때 알림',
        value: notificationSettings.push_call_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY],
      },
      {
        id: 'push_connection_enabled',
        title: '연결 요청/수락 알림',
        description: '보호자-어르신 연결 관련 알림',
        value: notificationSettings.push_connection_enabled,
        disabled: !notificationSettings.push_notification_enabled,
        roles: [UserRole.ELDERLY, UserRole.CAREGIVER],
      },
    ];

    return allSettings.filter(setting => 
      setting.roles.includes(user?.role as UserRole)
    );
  };

  const notificationSettingsList = getNotificationSettingsList();

  // 연결된 보호자 목록 로드 (어르신용)
  const loadConnectedCaregivers = async () => {
    try {
      setIsLoadingCaregivers(true);
      const response = await getConnections();
      setConnectedCaregivers(response.active || []);
      console.log('✅ 연결된 보호자 목록 로드 성공:', response.active?.length || 0);
    } catch (error: any) {
      console.error('연결된 보호자 목록 로드 실패:', error);
      setConnectedCaregivers([]);
    } finally {
      setIsLoadingCaregivers(false);
    }
  };

  // 연결된 어르신 목록 로드 (보호자용)
  const loadConnectedElderly = async () => {
    try {
      setIsLoadingElderly(true);
      const response = await getConnections();
      setConnectedElderly(response.active || []);
      console.log('✅ 연결된 어르신 목록 로드 성공:', response.active?.length || 0);
    } catch (error: any) {
      console.error('연결된 어르신 목록 로드 실패:', error);
      setConnectedElderly([]);
    } finally {
      setIsLoadingElderly(false);
    }
  };

  // 연결 해제 처리 (어르신용 - 보호자 해제)
  const handleDisconnectCaregiver = (caregiver: ConnectionWithUserInfo) => {
    setConfirmModal({
      visible: true,
      title: '연결 해제',
      message: `${caregiver.name} 보호자와의 연결을 해제하시겠습니까?\n\n연결 해제 후:\n• 해당 보호자는 할 일을 추가할 수 없습니다\n• 해당 보호자는 일기장을 볼 수 없습니다\n• 연결을 다시 설정하려면 보호자가 다시 요청해야 합니다`,
      confirmText: '해제',
      cancelText: '취소',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          setIsLoadingCaregivers(true);
          await deleteConnection(caregiver.connection_id);
          setConfirmModal({
            visible: true,
            title: '완료',
            message: '연결이 해제되었습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
          await loadConnectedCaregivers();
        } catch (error: any) {
          console.error('연결 해제 실패:', error);
          const errorMessage = error.response?.data?.detail || '연결 해제 중 오류가 발생했습니다.';
          setConfirmModal({
            visible: true,
            title: '오류',
            message: errorMessage,
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
        } finally {
          setIsLoadingCaregivers(false);
        }
      },
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
      },
    });
  };

  // 연결 해제 처리 (보호자용 - 어르신 해제)
  const handleDisconnectElderly = (elderly: ConnectionWithUserInfo) => {
    setConfirmModal({
      visible: true,
      title: '연결 해제',
      message: `${elderly.name} 어르신과의 연결을 해제하시겠습니까?\n\n연결 해제 후:\n• 해당 어르신의 할 일을 관리할 수 없습니다\n• 해당 어르신의 일기장을 볼 수 없습니다\n• 연결을 다시 설정하려면 다시 연결 요청을 해야 합니다`,
      confirmText: '해제',
      cancelText: '취소',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          setIsLoadingElderly(true);
          await deleteConnection(elderly.connection_id);
          setConfirmModal({
            visible: true,
            title: '완료',
            message: '연결이 해제되었습니다.',
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
          await loadConnectedElderly();
        } catch (error: any) {
          console.error('연결 해제 실패:', error);
          const errorMessage = error.response?.data?.detail || '연결 해제 중 오류가 발생했습니다.';
          setConfirmModal({
            visible: true,
            title: '오류',
            message: errorMessage,
            confirmText: '확인',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
        } finally {
          setIsLoadingElderly(false);
        }
      },
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
      },
    });
  };

  // 개인정보 처리방침 텍스트
  const getPrivacyPolicyText = () => {
    return `제1조 (개인정보의 처리 목적)
그랜비(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.

1. 회원 관리
- 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리
- 각종 고지·통지, 고충처리, 분쟁 조정을 위한 기록 보존

2. 서비스 제공
- 일기장 서비스 제공, AI 전화 서비스 제공
- 할 일 관리 서비스 제공, 보호자-어르신 연결 서비스 제공
- 맞춤형 콘텐츠 제공 및 서비스 개선

3. 안전 및 보안 관리
- 이상 징후 탐지 및 보호자 알림
- 부정 이용 방지 및 서비스 안정성 확보

제2조 (개인정보의 처리 및 보유기간)
1. 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
2. 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.
- 회원 가입 및 관리: 회원 탈퇴 시까지 (단, 관계 법령 위반에 따른 수사·조사 등이 진행중인 경우에는 해당 수사·조사 종료 시까지)
- 재화 또는 서비스 제공: 재화·서비스 공급완료 및 요금결제·정산 완료 시까지
- 전화 상담 등 서비스 이용 기록: 3년 (통신비밀보호법)

제3조 (처리하는 개인정보의 항목)
회사는 다음의 개인정보 항목을 처리하고 있습니다.
1. 필수항목: 이메일, 비밀번호, 이름, 전화번호, 생년월일, 성별, 사용자 유형(어르신/보호자)
2. 선택항목: 프로필 사진, 알림 수신 설정
3. 자동 수집항목: IP주소, 쿠키, 서비스 이용 기록, 접속 로그

제4조 (개인정보의 제3자 제공)
회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.

제5조 (개인정보처리의 위탁)
회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.
- 클라우드 서비스 제공업체: 서버 운영 및 데이터 보관
- 푸시 알림 서비스 제공업체: 알림 발송 서비스

제6조 (정보주체의 권리·의무 및 그 행사방법)
1. 정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
- 개인정보 처리정지 요구
- 개인정보 열람요구
- 개인정보 정정·삭제요구
- 개인정보 처리정지 요구

2. 제1항에 따른 권리 행사는 회사에 대해 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.

제7조 (개인정보의 파기)
회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.

제8조 (개인정보 보호책임자)
회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.

- 개인정보 보호책임자
  이메일: privacy@grandby.kr
  전화번호: 02-1234-5678

제9조 (개인정보의 안전성 확보 조치)
회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
1. 관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육 등
2. 기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치
3. 물리적 조치: 전산실, 자료보관실 등의 접근통제

제10조 (개인정보 처리방침 변경)
이 개인정보 처리방침은 2024년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.`;
  };

  // 이용약관 텍스트
  const getTermsText = () => {
    return `제1조 (목적)
이 약관은 그랜비(이하 "회사")가 제공하는 어르신 돌봄 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 어르신 일상 관리 및 보호자 연계 서비스를 말합니다.
2. "회원"이란 이 약관에 동의하고 회사와 이용계약을 체결한 자를 말하며, 어르신 회원과 보호자 회원으로 구분됩니다.
3. "어르신 회원"이란 본인의 건강과 일상을 관리하고자 하는 자를 말합니다.
4. "보호자 회원"이란 어르신 회원과 연결되어 어르신의 상태를 확인하고 돌봄을 제공하는 자를 말합니다.

제3조 (약관의 게시와 개정)
1. 회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.
2. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.
3. 회사가 약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행약관과 함께 서비스의 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.

제4조 (이용계약의 체결)
1. 이용계약은 회원으로 가입하고자 하는 자가 약관의 내용에 동의를 한 다음 회원가입 신청을 하고 회사가 이러한 신청에 대하여 승낙함으로써 체결됩니다.
2. 회사는 다음 각 호에 해당하는 신청에 대하여는 승낙을 하지 않거나 사후에 이용계약을 해지할 수 있습니다.
- 가입 신청자가 이 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우
- 실명이 아니거나 타인의 명의를 이용한 경우
- 회사가 요구하는 정보를 제공하지 않거나 허위 정보를 제공한 경우
- 기타 회원으로 등록하는 것이 회사의 기술상 현저히 지장이 있다고 판단되는 경우

제5조 (서비스의 제공 및 변경)
1. 회사는 다음과 같은 서비스를 제공합니다.
- 일기장 서비스: 어르신의 일상을 기록하고 관리할 수 있는 서비스
- 할 일 관리 서비스: 할 일 등록, 완료 확인 등 일정 관리 서비스
- AI 전화 서비스: 정기적으로 안부 확인 전화를 드리는 서비스 (어르신 회원만 해당)
- 보호자 연계 서비스: 보호자와 어르신을 연결하여 정보를 공유하는 서비스
- 알림 서비스: 중요한 일정이나 상태 변화에 대한 알림 서비스

2. 회사는 서비스의 내용을 변경할 수 있으며, 변경 시에는 사전에 공지합니다.

제6조 (서비스의 중단)
1. 회사는 컴퓨터 등 정보통신설비의 보수점검·교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
2. 회사는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 회원 또는 제3자가 입은 손해에 대하여 배상합니다. 단, 회사가 고의 또는 과실이 없음을 입증하는 경우에는 그러하지 아니합니다.

제7조 (회원의 의무)
1. 회원은 다음 행위를 하여서는 안 됩니다.
- 신청 또는 변경 시 허위내용의 등록
- 타인의 정보 도용
- 회사가 게시한 정보의 변경
- 회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시
- 회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해
- 회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위
- 외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 공개 또는 게시하는 행위

2. 보호자 회원은 연결된 어르신 회원의 동의 없이 개인정보를 제3자에게 제공하거나 부적절하게 이용하여서는 안 됩니다.

제8조 (개인정보보호)
1. 회사는 회원의 개인정보 보호를 위하여 노력합니다. 회원의 개인정보 보호에 관해서는 관련법령 및 회사가 정하는 "개인정보 처리방침"에 정한 바에 따릅니다.

제9조 (회사의 의무)
1. 회사는 법령과 이 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며, 이 약관이 정하는 바에 따라 지속적이고, 안정적으로 서비스를 제공하는데 최선을 다하여야 합니다.
2. 회사는 회원이 서비스를 이용함에 있어 회원에게 법률상 손해를 입힐 가능성이 있는 물리적·기술적 장치의 설치 및 관리에 최선을 다합니다.

제10조 (회원의 게시물)
1. 회원이 서비스 내에 게시한 게시물의 저작권은 해당 게시물의 저작자에게 귀속됩니다.
2. 회원이 서비스 내에 게시한 게시물은 회사의 서비스 운영, 홍보 등의 목적으로 사용될 수 있습니다.

제11조 (이용계약의 해지)
1. 회원은 언제든지 회사에게 회원 탈퇴를 요청할 수 있으며, 회사는 즉시 회원 탈퇴를 처리합니다.
2. 회원이 다음 각 호의 사유에 해당하는 경우, 회사는 이용계약을 해지할 수 있습니다.
- 제7조 제1항에서 정한 회원의 의무를 위반한 경우
- 다른 회원의 권리나 이익을 침해한 경우
- 기타 이 약관을 위반한 경우

제12조 (손해배상)
1. 회사는 무료로 제공되는 서비스와 관련하여 회원에게 어떠한 손해가 발생하더라도 동 손해가 회사의 중대한 과실에 의한 경우를 제외하고 이에 대하여 책임을 부담하지 아니합니다.

제13조 (면책조항)
1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
2. 회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.

제14조 (준거법 및 관할법원)
1. 회사와 회원 간 제기된 소송은 대한민국 법을 준거법으로 합니다.
2. 회사와 회원 간 발생한 분쟁에 관한 소송은 제소 당시의 회원의 주소에 의하고, 주소가 없는 경우에는 거소를 관할하는 지방법원의 전속관할로 합니다.

부칙
이 약관은 2024년 1월 1일부터 시행됩니다.`;
  };

  // 알림 설정 펼침/접힘 토글
  const toggleNotificationExpanded = () => {
    const toValue = isNotificationExpanded ? 0 : 1;
    
    // LayoutAnimation으로 부드러운 전환 효과
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });

    // 슬라이드 애니메이션
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setIsNotificationExpanded(!isNotificationExpanded);
  };

  // 프로필 이미지 URL 가져오기
  const getProfileImageUrl = () => {
    if (!user?.profile_image_url) return null;
    // 이미 전체 URL인 경우
    if (user.profile_image_url.startsWith('http')) {
      return user.profile_image_url;
    }
    // 상대 경로인 경우
    return `${API_BASE_URL}/${user.profile_image_url}`;
  };

  // 프로필 이미지 선택 및 업로드
  const handleImagePick = async () => {
    try {
      // 권한 요청
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
        return;
      }

      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets[0].uri;
      await uploadProfileImage(imageUri);
    } catch (error) {
      console.error('이미지 선택 오류:', error);
      Alert.alert('오류', '이미지를 선택하는 중 오류가 발생했습니다.');
    }
  };

  // 프로필 이미지 업로드
  const uploadProfileImage = async (imageUri: string) => {
    try {
      setIsUploading(true);

      // FormData 생성
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      // API 호출
      const response = await apiClient.post('/api/users/profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // 사용자 정보 업데이트
      if (response.data) {
        setUser(response.data);
        Alert.alert('성공', '프로필 사진이 업데이트되었습니다.');
      }
    } catch (error: any) {
      console.error('이미지 업로드 오류:', error);
      const errorMessage = error.response?.data?.detail || '이미지 업로드 중 오류가 발생했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // 프로필 이미지 삭제
  const handleImageDelete = async () => {
    Alert.alert(
      '프로필 사진 삭제',
      '프로필 사진을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUploading(true);
              const response = await apiClient.delete('/api/users/profile-image');
              
              // 사용자 정보 업데이트
              if (response.data) {
                setUser(response.data);
                Alert.alert('성공', '프로필 사진이 삭제되었습니다.');
              }
            } catch (error: any) {
              console.error('이미지 삭제 오류:', error);
              const errorMessage = error.response?.data?.detail || '이미지 삭제 중 오류가 발생했습니다.';
              Alert.alert('오류', errorMessage);
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  };

  // 프로필 이미지 편집 옵션 표시
  const showImageOptions = () => {
    const options = user?.profile_image_url
      ? ['사진 선택', '사진 삭제', '취소']
      : ['사진 선택', '취소'];
    
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = user?.profile_image_url ? 1 : undefined;

    Alert.alert(
      '프로필 사진',
      '프로필 사진을 변경하거나 삭제할 수 있습니다.',
      options.map((option, index) => ({
        text: option,
        style: index === cancelButtonIndex ? 'cancel' : 
               index === destructiveButtonIndex ? 'destructive' : 'default',
        onPress: () => {
          if (option === '사진 선택') {
            handleImagePick();
          } else if (option === '사진 삭제') {
            handleImageDelete();
          }
        },
      }))
    );
  };

  const handleDeleteAccount = async () => {
    setConfirmModal({
      visible: true,
      title: '계정 삭제',
      message: '계정을 삭제하시겠습니까?\n\n⚠️ 중요:\n• 30일 이내에는 복구 가능합니다\n• 30일 후에는 모든 데이터가 영구 삭제됩니다\n• 관련된 할일, 일기 등이 익명화됩니다',
      confirmText: '삭제',
      cancelText: '취소',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        // 비밀번호 확인 (소셜 로그인이 아닌 경우)
        if (user?.auth_provider === 'email') {
          Alert.prompt(
            '본인 확인',
            '계정 삭제를 위해 비밀번호를 입력해주세요.',
            [
              { text: '취소', style: 'cancel' },
              {
                text: '삭제',
                style: 'destructive',
                onPress: async (password?: string) => {
                  if (!password) {
                    setConfirmModal({
                      visible: true,
                      title: '오류',
                      message: '비밀번호를 입력해주세요.',
                      confirmText: '확인',
                      onConfirm: () => {
                        setConfirmModal(prev => ({ ...prev, visible: false }));
                      },
                    });
                    return;
                  }
                  await deleteAccount(password);
                },
              },
            ],
            'secure-text'
          );
        } else {
          // 소셜 로그인 사용자
          setConfirmModal({
            visible: true,
            title: '계정 삭제 확인',
            message: '정말로 계정을 삭제하시겠습니까?',
            confirmText: '삭제',
            cancelText: '취소',
            onConfirm: async () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
              await deleteAccount('');
            },
            onCancel: () => {
              setConfirmModal(prev => ({ ...prev, visible: false }));
            },
          });
        }
      },
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
      },
    });
  };

  const deleteAccount = async (password: string) => {
    try {
      setIsUploading(true); // 로딩 상태 표시
      
      await apiClient.delete('/api/users/account', {
        data: {
          password: user?.auth_provider === 'email' ? password : undefined,
          reason: '사용자 요청',
        },
      });

      setConfirmModal({
        visible: true,
        title: '계정 삭제 완료',
        message: '계정이 삭제되었습니다.\n30일 이내에 다시 로그인하시면 계정을 복구할 수 있습니다.',
        confirmText: '확인',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          await logout();
          router.replace('/');
        },
      });
    } catch (error: any) {
      console.error('계정 삭제 오류:', error);
      const errorMessage = error.response?.data?.detail || '계정 삭제에 실패했습니다.';
      setConfirmModal({
        visible: true,
        title: '오류',
        message: errorMessage,
        confirmText: '확인',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
        },
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    setConfirmModal({
      visible: true,
      title: '로그아웃',
      message: '로그아웃 하시겠습니까?',
      confirmText: '로그아웃',
      cancelText: '취소',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        await logout();
        router.replace('/');
      },
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
      },
    });
  };

  // 사용자 정보 섹션
  const userInfoItems = [
    {
      id: 'name',
      label: '이름',
      value: user?.name || '사용자',
      iconName: 'person-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
    {
      id: 'email',
      label: '이메일',
      value: user?.email || '이메일 없음',
      iconName: 'mail-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
    {
      id: 'phone',
      label: '전화번호',
      value: user?.phone_number || '전화번호 없음',
      iconName: 'call-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
    {
      id: 'role',
      label: '계정 유형',
      value: user?.role === UserRole.ELDERLY ? '어르신' : '보호자',
      iconName: user?.role === UserRole.ELDERLY ? 'person-circle-outline' : 'people-circle-outline' as const,
      iconLibrary: 'Ionicons' as const,
    },
  ];

  // 개인정보 및 약관 메뉴 항목들
  const privacyItems = [
    {
      id: 'password-change',
      title: '비밀번호 변경',
      description: '계정 보안을 위한 비밀번호 변경',
      iconName: 'lock-reset' as const,
      iconLibrary: 'MaterialCommunityIcons' as const,
      color: '#fb9a4b', // 파스텔 오렌지
      onPress: () => router.push('/change-password'),
    },
    {
      id: 'privacy-policy',
      title: '개인정보 처리방침',
      description: '개인정보 수집 및 이용 방침',
      iconName: 'shield-checkmark' as const,
      iconLibrary: 'Ionicons' as const,
      color: '#83fb4b', // 파스텔 그린
      onPress: () => setShowPrivacyPolicy(true),
    },
    {
      id: 'terms',
      title: '이용약관',
      description: '서비스 이용약관',
      iconName: 'document-text' as const,
      iconLibrary: 'Ionicons' as const,
      color: '#ce4bfb', // 파스텔 퍼플
      onPress: () => setShowTerms(true),
    }
  ];

  // 반응형 크기 계산
  const sectionIconSize = getResponsiveSize(44, scale);
  const sectionIconFontSize = getResponsiveFontSize(20, scale);
  const sectionTitleFontSize = getResponsiveFontSize(18, scale);
  const sectionHeaderMarginBottom = getResponsivePadding(12, scale);
  const sectionPadding = getResponsivePadding(16, scale);
  const sectionMarginBottom = getResponsivePadding(24, scale);
  const sectionIconMarginRight = getResponsivePadding(12, scale);
  
  // 설정 아이템 반응형 크기
  const settingIconSize = getResponsiveSize(44, scale);
  const settingIconInnerSize = getResponsiveFontSize(20, scale);
  const settingIconMarginRight = getResponsivePadding(16, scale);
  const settingItemPadding = getResponsivePadding(20, scale);
  const settingTitleFontSize = getResponsiveFontSize(16, scale);
  const settingDescriptionFontSize = getResponsiveFontSize(14, scale);
  const expandHintFontSize = getResponsiveFontSize(12, scale);
  const nestedPaddingLeft = getResponsivePadding(40, scale);

  // 프로필 섹션 반응형 크기
  const profileImageSize = getResponsiveSize(80, scale);
  const profileImageRadius = profileImageSize / 2;
  const profileImageMarginRight = getResponsivePadding(20, scale);
  const profileSectionMarginBottom = getResponsivePadding(24, scale);
  const profileIconSize = getResponsiveFontSize(40, scale);
  const editIconContainerSize = getResponsiveSize(28, scale);
  const editIconSize = getResponsiveFontSize(14, scale);
  const roleIconSize = getResponsiveFontSize(16, scale);
  const userNameFontSize = getResponsiveFontSize(24, scale);
  const userNameMarginBottom = getResponsivePadding(8, scale);
  const userRoleFontSize = getResponsiveFontSize(14, scale);
  const userRoleMarginLeft = getResponsivePadding(6, scale);

  // 사용자 정보 리스트 반응형 크기
  const userInfoIconSize = getResponsiveSize(32, scale);
  const userInfoIconRadius = userInfoIconSize / 2;
  const userInfoIconMarginRight = getResponsivePadding(12, scale);
  const userInfoIconInnerSize = getResponsiveFontSize(20, scale);
  const userInfoLabelFontSize = getResponsiveFontSize(16, scale);
  const userInfoValueFontSize = getResponsiveFontSize(16, scale);
  const userInfoItemPaddingVertical = getResponsivePadding(12, scale);
  const userInfoItemPaddingHorizontal = getResponsivePadding(16, scale);

  // 로그아웃/계정삭제 버튼 반응형 크기
  const logoutButtonPadding = getResponsivePadding(20, scale);
  const deleteAccountButtonPadding = getResponsivePadding(20, scale);
  const deleteAccountTextFontSize = getResponsiveFontSize(14, scale);
  const logoutButtonTextFontSize = getResponsiveFontSize(16, scale);

  // 모달 반응형 크기
  const modalTitleFontSize = getResponsiveFontSize(18, scale);
  const modalTextFontSize = getResponsiveFontSize(15, scale);

  // 컨텐츠 패딩/마진 반응형 크기
  const contentPadding = getResponsivePadding(16, scale);
  const userCardPadding = getResponsivePadding(24, scale);
  const userCardMarginBottom = getResponsivePadding(20, scale);
  const roleContainerPaddingHorizontal = getResponsivePadding(12, scale);
  const roleContainerPaddingVertical = getResponsivePadding(6, scale);

  return (
    <View style={styles.container}>
      {/* 공통 헤더 */}
      <Header 
        title="마이페이지"
        showMenuButton={true}
      />

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, padding: contentPadding }}
      >
        {/* 사용자 정보 카드 */}
        <View style={[styles.userCard, { padding: userCardPadding, marginBottom: userCardMarginBottom }]}>
          <View style={[styles.profileSection, { marginBottom: profileSectionMarginBottom }]}>
            <TouchableOpacity 
              style={[
                styles.profileImageContainer,
                {
                  width: profileImageSize,
                  height: profileImageSize,
                  borderRadius: profileImageRadius,
                  marginRight: profileImageMarginRight,
                }
              ]}
              onPress={showImageOptions}
              disabled={isUploading}
              activeOpacity={0.7}
            >
              {getProfileImageUrl() ? (
                <Image
                  source={{ uri: getProfileImageUrl()! }}
                  style={styles.profileImageReal}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons 
                    name={user?.role === UserRole.ELDERLY ? 'person' : 'people'} 
                    size={profileIconSize} 
                    color="#FFFFFF" 
                  />
                </View>
              )}
              {isUploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
              <View style={[
                styles.editIconContainer,
                {
                  width: editIconContainerSize,
                  height: editIconContainerSize,
                  borderRadius: editIconContainerSize / 2,
                }
              ]}>
                <MaterialCommunityIcons name="camera" size={editIconSize} color="#34B79F" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { fontSize: userNameFontSize, marginBottom: userNameMarginBottom }]}>
                {user?.name || '사용자'}
              </Text>
              <View style={[
                styles.roleContainer,
                {
                  paddingHorizontal: roleContainerPaddingHorizontal,
                  paddingVertical: roleContainerPaddingVertical,
                }
              ]}>
                <Ionicons 
                  name={user?.role === UserRole.ELDERLY ? 'person-circle' : 'people-circle'} 
                  size={roleIconSize} 
                  color="#34B79F" 
                />
                <Text style={[styles.userRole, { fontSize: userRoleFontSize, marginLeft: userRoleMarginLeft }]}>
                  {user?.role === UserRole.ELDERLY ? '어르신 계정' : '보호자 계정'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/profile-edit')}
              activeOpacity={0.7}
            >
              <Text style={[styles.editButtonText, { fontSize: getResponsiveFontSize(15, scale) }]}>수정</Text>
            </TouchableOpacity>
          </View>

          {/* 사용자 정보 리스트 */}
          <View style={styles.userInfoList}>
            {userInfoItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.userInfoItem,
                  {
                    paddingVertical: userInfoItemPaddingVertical,
                    paddingHorizontal: userInfoItemPaddingHorizontal,
                  }
                ]}
                onPress={() => router.push('/profile-edit')}
                activeOpacity={0.7}
              >
                <View style={styles.userInfoLeft}>
                  <View style={[
                    styles.userInfoIconContainer,
                    {
                      width: userInfoIconSize,
                      height: userInfoIconSize,
                      borderRadius: userInfoIconRadius,
                      marginRight: userInfoIconMarginRight,
                    }
                  ]}>
                    <Ionicons name={item.iconName as any} size={userInfoIconInnerSize} color="#34B79F" />
                  </View>
                  <Text style={[styles.userInfoLabel, { fontSize: userInfoLabelFontSize }]}>
                    {item.label}
                  </Text>
                </View>
                <Text style={[styles.userInfoValue, { fontSize: userInfoValueFontSize }]}>
                  {item.value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 연결된 보호자 관리 (어르신용) */}
        {user?.role === UserRole.ELDERLY && (
          <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
            <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
              <View style={[
                styles.sectionIconContainer,
                { 
                  width: sectionIconSize,
                  height: sectionIconSize,
                  borderRadius: sectionIconSize / 2,
                  marginRight: sectionIconMarginRight,
                }
              ]}>
                <Ionicons name="people-outline" size={sectionIconFontSize} color="#34B79F" />
              </View>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>연결된 보호자</Text>
            </View>
            <View style={styles.settingsList}>
              {isLoadingCaregivers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#34B79F" />
                  <Text style={styles.loadingText}>로딩 중...</Text>
                </View>
              ) : connectedCaregivers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={getResponsiveFontSize(48, scale)} color="#C7C7CC" />
                  <Text style={[styles.emptyText, { fontSize: getResponsiveFontSize(14, scale) }]}>
                    연결된 보호자가 없습니다
                  </Text>
                </View>
              ) : (
                connectedCaregivers.map((caregiver) => (
                  <View key={caregiver.connection_id} style={[styles.settingItem, { padding: settingItemPadding }]}>
                    <View style={styles.settingLeft}>
                      <View style={[
                        styles.settingIconContainer,
                        {
                          backgroundColor: '#E8F5E9',
                          width: settingIconSize,
                          height: settingIconSize,
                          borderRadius: settingIconSize / 2,
                          marginRight: settingIconMarginRight,
                        }
                      ]}>
                        <Ionicons name="person" size={settingIconInnerSize} color="#4CAF50" />
                      </View>
                      <View style={styles.settingTextContainer}>
                        <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]} numberOfLines={1}>
                          {caregiver.name}
                        </Text>
                        {caregiver.email && (
                          <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                            {caregiver.email}
                          </Text>
                        )}
                        {caregiver.phone_number && (
                          <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                            {caregiver.phone_number}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDisconnectCaregiver(caregiver)}
                      activeOpacity={0.7}
                      style={styles.disconnectButton}
                    >
                      <Text style={[styles.disconnectButtonText, { fontSize: getResponsiveFontSize(14, scale) }]}>
                        해제
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* 연결된 어르신 관리 (보호자용) */}
        {user?.role === UserRole.CAREGIVER && (
          <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
            <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
              <View style={[
                styles.sectionIconContainer,
                { 
                  width: sectionIconSize,
                  height: sectionIconSize,
                  borderRadius: sectionIconSize / 2,
                  marginRight: sectionIconMarginRight,
                }
              ]}>
                <Ionicons name="people-outline" size={sectionIconFontSize} color="#34B79F" />
              </View>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>연결된 어르신</Text>
            </View>
            <View style={styles.settingsList}>
              {isLoadingElderly ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#34B79F" />
                  <Text style={styles.loadingText}>로딩 중...</Text>
                </View>
              ) : connectedElderly.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={getResponsiveFontSize(48, scale)} color="#C7C7CC" />
                  <Text style={[styles.emptyText, { fontSize: getResponsiveFontSize(14, scale) }]}>
                    연결된 어르신이 없습니다
                  </Text>
                </View>
              ) : (
                connectedElderly.map((elderly) => (
                  <View key={elderly.connection_id} style={[styles.settingItem, { padding: settingItemPadding }]}>
                    <View style={styles.settingLeft}>
                      <View style={[
                        styles.settingIconContainer,
                        {
                          backgroundColor: '#E8F5E9',
                          width: settingIconSize,
                          height: settingIconSize,
                          borderRadius: settingIconSize / 2,
                          marginRight: settingIconMarginRight,
                        }
                      ]}>
                        <Ionicons name="person" size={settingIconInnerSize} color="#4CAF50" />
                      </View>
                      <View style={styles.settingTextContainer}>
                        <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]} numberOfLines={1}>
                          {elderly.name}
                        </Text>
                        {elderly.email && (
                          <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                            {elderly.email}
                          </Text>
                        )}
                        {elderly.phone_number && (
                          <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                            {elderly.phone_number}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDisconnectElderly(elderly)}
                      activeOpacity={0.7}
                      style={styles.disconnectButton}
                    >
                      <Text style={[styles.disconnectButtonText, { fontSize: getResponsiveFontSize(14, scale) }]}>
                        해제
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* 알림 설정 */}
        <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
          <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
            <View style={[
              styles.sectionIconContainer,
              { 
                width: sectionIconSize,
                height: sectionIconSize,
                borderRadius: sectionIconSize / 2,
                marginRight: sectionIconMarginRight,
              }
            ]}>
              <Ionicons name="notifications-outline" size={sectionIconFontSize} color="#34B79F" />
            </View>
            <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>알림 설정</Text>
          </View>
          <View style={styles.settingsList}>
            {/* 푸시 알림 전체 토글 */}
            {notificationSettingsList.filter(setting => setting.id === 'push_notification_enabled').map((setting) => (
              <TouchableOpacity
                key={setting.id}
                style={[styles.settingItem, { padding: settingItemPadding }]}
                onPress={toggleNotificationExpanded}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[
                    styles.settingIconContainer,
                    {
                      backgroundColor: '#fbd54b', // 파스텔 민트
                      width: settingIconSize,
                      height: settingIconSize,
                      borderRadius: settingIconSize / 2,
                      marginRight: settingIconMarginRight,
                    }
                  ]}>
                    <Ionicons name="notifications" size={settingIconInnerSize} color="#ffffff" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]} numberOfLines={1}>
                      {setting.title}
                    </Text>
                    {setting.description && (
                      <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]} numberOfLines={1}>
                        {setting.description}
                      </Text>
                    )}
                    <Text style={[styles.expandHint, { fontSize: expandHintFontSize }]}>
                      {isNotificationExpanded ? '상세 설정 접기' : '상세 설정 보기'}
                    </Text>
                  </View>
                </View>
                <View style={styles.settingRight}>
                  <Switch
                    value={setting.value}
                    onValueChange={(value) => updateNotificationSetting(setting.id, value)}
                    trackColor={{ false: '#E5E5E7', true: '#34B79F' }}
                    thumbColor={setting.value ? '#FFFFFF' : '#FFFFFF'}
                  />
                  <TouchableOpacity
                    onPress={toggleNotificationExpanded}
                    activeOpacity={0.7}
                    style={{ marginLeft: getResponsivePadding(8, scale), padding: getResponsivePadding(4, scale) }}
                  >
                    <Ionicons 
                      name={isNotificationExpanded ? "chevron-down" : "chevron-forward"} 
                      size={getResponsiveFontSize(20, scale)} 
                      color="#C7C7CC"
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
            
            {/* 상세 알림 설정들 (접힘/펼침) */}
            {isNotificationExpanded && (
              <Animated.View
                style={{
                  opacity: slideAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.5, 1],
                  }),
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  }],
                }}
              >
                {notificationSettingsList
                  .filter(setting => setting.id !== 'push_notification_enabled')
                  .map((setting) => (
                    <View key={setting.id} style={[
                      styles.settingItem, 
                      styles.nestedSettingItem,
                      { 
                        padding: settingItemPadding,
                        paddingLeft: nestedPaddingLeft,
                      }
                    ]}>
                      <View style={styles.settingLeft}>
                        <View style={styles.settingTextContainer}>
                          <Text style={[
                            styles.settingTitle,
                            { fontSize: settingTitleFontSize },
                            setting.disabled && styles.disabledText
                          ]} numberOfLines={1}>
                            {setting.title}
                          </Text>
                          {setting.description && (
                            <Text style={[
                              styles.settingDescription,
                              { fontSize: settingDescriptionFontSize },
                              setting.disabled && styles.disabledText
                            ]} numberOfLines={2}>
                              {setting.description}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Switch
                        value={setting.value}
                        onValueChange={(value) => updateNotificationSetting(setting.id, value)}
                        trackColor={{ false: '#E5E5E7', true: '#34B79F' }}
                        thumbColor={setting.value ? '#FFFFFF' : '#FFFFFF'}
                        disabled={setting.disabled}
                      />
                    </View>
                  ))}
              </Animated.View>
            )}
          </View>
        </View>

        {/* 개인정보 및 약관 */}
        <View style={[styles.settingsSection, { marginBottom: sectionMarginBottom }]}>
          <View style={[styles.sectionHeader, { marginBottom: sectionHeaderMarginBottom }]}>
            <View style={[
              styles.sectionIconContainer,
              { 
                width: sectionIconSize,
                height: sectionIconSize,
                borderRadius: sectionIconSize / 2,
                marginRight: sectionIconMarginRight,
              }
            ]}>
              <Ionicons name="shield-checkmark-outline" size={sectionIconFontSize} color="#34B79F" />
            </View>
            <Text style={[styles.sectionTitle, { fontSize: sectionTitleFontSize }]}>개인정보 및 약관</Text>
          </View>
          <View style={styles.settingsList}>
            {privacyItems.map((item) => {
              const IconComponent = item.iconLibrary === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.settingItem, { padding: settingItemPadding }]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <View style={[
                      styles.settingIconContainer, 
                      { 
                        backgroundColor: item.color,
                        width: settingIconSize,
                        height: settingIconSize,
                        borderRadius: settingIconSize / 2,
                        marginRight: settingIconMarginRight,
                      }
                    ]}>
                      <IconComponent name={item.iconName as any} size={settingIconInnerSize} color="#FFFFFF" />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={[styles.settingTitle, { fontSize: settingTitleFontSize }]}>{item.title}</Text>
                      <Text style={[styles.settingDescription, { fontSize: settingDescriptionFontSize }]}>{item.description}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={getResponsiveFontSize(24, scale)} color="#C7C7CC" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 로그아웃 버튼 */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={[styles.logoutButton, { padding: logoutButtonPadding }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={[styles.logoutButtonText, { fontSize: logoutButtonTextFontSize }]}>로그아웃</Text>
          </TouchableOpacity>
          
          {/* 계정 삭제 버튼 */}
          <TouchableOpacity
            style={[styles.deleteAccountButton, { paddingVertical: getResponsivePadding(12, scale) }]}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <Text style={[styles.deleteAccountButtonText, { fontSize: deleteAccountTextFontSize }]}>계정 삭제</Text>
          </TouchableOpacity>
        </View>

        {/* 하단 여백 (네비게이션 바 공간 확보) */}
        <View style={[styles.bottomSpacer, { height: 100 + Math.max(insets.bottom, 10) }]} />
      </ScrollView>

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />

      {/* 개인정보 처리방침 모달 */}
      <Modal
        visible={showPrivacyPolicy}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPrivacyPolicy(false)}
      >
        <View style={[styles.fullScreenModalContainer, { paddingTop: insets.top }]}>
          <View style={[
            styles.fullScreenModalHeader,
            {
              paddingHorizontal: getResponsivePadding(20, scale),
              paddingVertical: getResponsivePadding(16, scale),
            }
          ]}>
            <Text style={[styles.fullScreenModalTitle, { fontSize: modalTitleFontSize }]}>
              개인정보 처리방침
            </Text>
            <TouchableOpacity
              style={styles.fullScreenModalCloseButton}
              onPress={() => setShowPrivacyPolicy(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={getResponsiveFontSize(24, scale)} color="#333333" />
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.fullScreenModalContent}
            contentContainerStyle={[
              styles.fullScreenModalScrollContent,
              {
                padding: getResponsivePadding(20, scale),
                paddingBottom: Math.max(insets.bottom, 40) + getResponsivePadding(20, scale),
              }
            ]}
            showsVerticalScrollIndicator={true}
          >
            <Text style={[styles.fullScreenModalText, { fontSize: modalTextFontSize }]}>
              {getPrivacyPolicyText()}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* 이용약관 모달 */}
      <Modal
        visible={showTerms}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowTerms(false)}
      >
        <View style={[styles.fullScreenModalContainer, { paddingTop: insets.top }]}>
          <View style={[
            styles.fullScreenModalHeader,
            {
              paddingHorizontal: getResponsivePadding(20, scale),
              paddingVertical: getResponsivePadding(16, scale),
            }
          ]}>
            <Text style={[styles.fullScreenModalTitle, { fontSize: modalTitleFontSize }]}>
              이용약관
            </Text>
            <TouchableOpacity
              style={styles.fullScreenModalCloseButton}
              onPress={() => setShowTerms(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={getResponsiveFontSize(24, scale)} color="#333333" />
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.fullScreenModalContent}
            contentContainerStyle={[
              styles.fullScreenModalScrollContent,
              {
                padding: getResponsivePadding(20, scale),
                paddingBottom: Math.max(insets.bottom, 40) + getResponsivePadding(20, scale),
              }
            ]}
            showsVerticalScrollIndicator={true}
          >
            <Text style={[styles.fullScreenModalText, { fontSize: modalTextFontSize }]}>
              {getTermsText()}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* 확인 모달 (로그아웃, 계정 삭제, 연결 해제 등) */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable style={styles.commonModalContainer} onPress={() => {}}>
            <Text style={[styles.commonModalTitle, { fontSize: modalTitleFontSize }]}>
              {confirmModal.title}
            </Text>
            <Text style={[styles.commonModalText, { fontSize: modalTextFontSize, marginBottom: 16 }]}>
              {confirmModal.message}
            </Text>
            <View style={styles.confirmModalActions}>
              {confirmModal.onCancel && (
                <TouchableOpacity
                  style={[styles.confirmModalButton, styles.confirmModalCancelButton]}
                  onPress={confirmModal.onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmModalCancelButtonText}>
                    {confirmModal.cancelText || '취소'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalConfirmButton]}
                onPress={confirmModal.onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmModalConfirmButtonText}>
                  {confirmModal.confirmText || '확인'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    // padding은 동적으로 적용
  },

  // 사용자 정보 카드
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    // padding, marginBottom은 동적으로 적용
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginBottom은 동적으로 적용
  },
  profileImageContainer: {
    backgroundColor: '#34B79F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    // width, height, borderRadius, marginRight은 동적으로 적용
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageReal: {
    width: '100%',
    height: '100%',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    alignSelf: 'flex-start',
    // paddingHorizontal, paddingVertical은 동적으로 적용
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#F0F9F7',
    // width, height, borderRadius은 동적으로 적용
  },
  profileInfo: {
    flex: 1,
  },
  editButton: {
    backgroundColor: '#F0F9F7',
    paddingHorizontal: getResponsivePadding(20, 1),
    paddingVertical: getResponsivePadding(10, 1),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34B79F',
    minWidth: getResponsiveSize(70, 1),
    minHeight: getResponsiveSize(36, 1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#34B79F',
    fontWeight: '600',
    // fontSize는 동적으로 적용
  },
  userName: {
    fontWeight: 'bold',
    color: '#333333',
    // fontSize, marginBottom은 동적으로 적용
  },
  userRole: {
    color: '#666666',
    fontWeight: '500',
    // fontSize, marginLeft은 동적으로 적용
  },

  // 사용자 정보 리스트
  userInfoList: {
    gap: 16,
  },
  userInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    // paddingVertical, paddingHorizontal은 동적으로 적용
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfoIconContainer: {
    backgroundColor: '#F0F9F7',
    alignItems: 'center',
    justifyContent: 'center',
    // width, height, borderRadius, marginRight은 동적으로 적용
  },
  userInfoLabel: {
    color: '#666666',
    fontWeight: '500',
    // fontSize는 동적으로 적용
  },
  userInfoValue: {
    color: '#333333',
    fontWeight: '600',
    // fontSize는 동적으로 적용
  },

  // 설정 섹션
  settingsSection: {
    // marginBottom은 동적으로 적용
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    // marginBottom은 동적으로 적용
  },
  sectionIconContainer: {
    backgroundColor: '#F0F9F7',
    alignItems: 'center',
    justifyContent: 'center',
    // width, height, borderRadius, marginRight는 동적으로 적용
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#333333',
    // fontSize는 동적으로 적용
  },
  settingsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // padding은 동적으로 적용
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    minHeight: 60, // 터치 영역 확보
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // 텍스트 오버플로우 방지
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nestedSettingItem: {
    // paddingLeft은 동적으로 적용
    backgroundColor: '#FAFAFA',
  },
  expandHint: {
    color: '#34B79F',
    marginTop: 6,
    fontWeight: '500',
    // fontSize는 동적으로 적용
  },
  settingIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // width, height, borderRadius, marginRight는 동적으로 적용
  },
  settingTextContainer: {
    flex: 1,
    minWidth: 0, // 텍스트 오버플로우 방지
  },
  settingTitle: {
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
    // fontSize는 동적으로 적용
  },
  settingDescription: {
    color: '#666666',
    marginTop: 4,
    lineHeight: 18,
    // fontSize는 동적으로 적용
  },
  disabledText: {
    color: '#999999',
  },

  // 로그아웃 섹션
  logoutSection: {
    marginTop: 20,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
    // padding은 동적으로 적용
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontWeight: '700',
    // fontSize는 동적으로 적용
  },
  deleteAccountButton: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    // paddingVertical은 동적으로 적용
  },
  deleteAccountButtonText: {
    color: '#999999',
    fontWeight: '500',
    // fontSize는 동적으로 적용
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#999999',
    textAlign: 'center',
    // fontSize는 동적으로 적용
  },
  disconnectButton: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  disconnectButtonText: {
    color: '#FF9999',
    fontWeight: '600',
    // fontSize는 동적으로 적용
  },
  bottomSpacer: {
    height: 20,
  },
  // 공통 모달 스타일 (GlobalAlertProvider 디자인 참고)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  commonModalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    maxHeight: '90%',
  },
  commonModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commonModalTitle: {
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    // fontSize는 동적으로 적용
  },
  commonModalCloseButton: {
    padding: 4,
    marginLeft: 12,
  },
  commonModalContent: {
    flex: 1,
    maxHeight: 600,
  },
  commonModalScrollContent: {
    paddingBottom: 20,
    // paddingBottom은 동적으로 적용
  },
  commonModalText: {
    color: '#374151',
    lineHeight: 22,
    // fontSize는 동적으로 적용
  },
  // 전체 화면 모달 스타일 (개인정보 처리방침, 이용약관용)
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullScreenModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
    backgroundColor: '#FFFFFF',
    // paddingHorizontal, paddingVertical은 동적으로 적용
  },
  fullScreenModalTitle: {
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    // fontSize는 동적으로 적용
  },
  fullScreenModalCloseButton: {
    padding: 4,
    marginLeft: 12,
    // padding은 동적으로 적용 가능
  },
  fullScreenModalContent: {
    flex: 1,
  },
  fullScreenModalScrollContent: {
    // padding은 동적으로 적용
  },
  fullScreenModalText: {
    color: '#333333',
    lineHeight: 22,
    // fontSize는 동적으로 적용
  },
  confirmModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  confirmModalButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  confirmModalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  confirmModalConfirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmModalCancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmModalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
