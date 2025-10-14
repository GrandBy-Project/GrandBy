/**
 * 그랜비 디자인 시스템 - 색상 정의
 * 메인 컬러: #40B59F (민트)
 */

export const Colors = {
  // 메인 컬러 (민트)
  primary: '#40B59F',
  primaryDark: '#359681',
  primaryLight: '#6FCDB7',
  primaryLighter: '#A8E0D7',
  primaryPale: '#E6F7F4',
  
  // 텍스트
  text: '#333333',
  textSecondary: '#666666',
  textLight: '#999999',
  textDisabled: '#CCCCCC',
  textWhite: '#FFFFFF',
  
  // 배경
  background: '#FFFFFF',
  backgroundLight: '#F5F5F5',
  backgroundGray: '#F9F9F9',
  
  // 테두리
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  borderDark: '#CCCCCC',
  
  // 상태 색상
  success: '#34C759',
  successLight: '#D4F4DD',
  error: '#FF3B30',
  errorLight: '#FFE5E3',
  warning: '#FF9500',
  warningLight: '#FFE8CC',
  info: '#007AFF',
  infoLight: '#E3F2FF',
  
  // 소셜 로그인
  kakao: '#FEE500',
  kakaoText: '#191919',
  google: '#FFFFFF',
  googleBorder: '#DADCE0',
  naver: '#03C75A',
  
  // 그림자
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowDark: 'rgba(0, 0, 0, 0.2)',
  
  // 오버레이
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

/**
 * 비밀번호 강도별 색상
 */
export const PasswordStrengthColors = {
  weak: Colors.error,
  fair: Colors.warning,
  good: Colors.info,
  strong: Colors.success,
};

/**
 * 사용자 타입별 색상
 */
export const UserTypeColors = {
  elderly: '#FF9500',  // 주황색
  caregiver: '#007AFF',  // 파랑색
};

