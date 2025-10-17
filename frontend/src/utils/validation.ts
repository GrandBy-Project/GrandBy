/**
 * 유효성 검증 유틸리티
 */

/**
 * 이메일 검증
 */
export const validateEmail = (email: string): { valid: boolean; message: string } => {
  if (!email.trim()) {
    return { valid: false, message: '이메일을 입력해주세요' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: '올바른 이메일 형식이 아닙니다' };
  }
  
  return { valid: true, message: '' };
};

/**
 * 비밀번호 강도 체크
 */
export const checkPasswordStrength = (password: string): {
  strength: 'weak' | 'fair' | 'good' | 'strong';
  message: string;
  score: number;
} => {
  let score = 0;
  
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 2) {
    return { strength: 'weak', message: '약함', score };
  } else if (score <= 3) {
    return { strength: 'fair', message: '보통', score };
  } else if (score <= 4) {
    return { strength: 'good', message: '좋음', score };
  } else {
    return { strength: 'strong', message: '강함', score };
  }
};

/**
 * 비밀번호 검증
 */
export const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (!password) {
    return { valid: false, message: '비밀번호를 입력해주세요' };
  }
  
  if (password.length < 6) {
    return { valid: false, message: '비밀번호는 최소 6자 이상이어야 합니다' };
  }
  
  if (password.length > 72) {
    return { valid: false, message: '비밀번호는 최대 72자까지 가능합니다' };
  }
  
  return { valid: true, message: '' };
};

/**
 * 전화번호 포맷팅 (010-1234-5678)
 */
export const formatPhoneNumber = (phone: string): string => {
  // 숫자만 추출
  const numbers = phone.replace(/[^\d]/g, '');
  
  // 길이에 따라 포맷팅
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
};

/**
 * 전화번호 검증
 */
export const validatePhoneNumber = (phone: string): { valid: boolean; message: string } => {
  if (!phone.trim()) {
    return { valid: false, message: '전화번호를 입력해주세요' };
  }
  
  // 숫자만 추출
  const numbers = phone.replace(/[^\d]/g, '');
  
  // 010, 011, 016, 017, 018, 019로 시작하는 11자리
  const phoneRegex = /^01[0-9]\d{7,8}$/;
  
  if (!phoneRegex.test(numbers)) {
    return { valid: false, message: '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)' };
  }
  
  return { valid: true, message: '' };
};

/**
 * 이름 검증
 */
export const validateName = (name: string): { valid: boolean; message: string } => {
  if (!name.trim()) {
    return { valid: false, message: '이름을 입력해주세요' };
  }
  
  if (name.trim().length < 2) {
    return { valid: false, message: '이름은 최소 2자 이상이어야 합니다' };
  }
  
  return { valid: true, message: '' };
};

/**
 * 인증 코드 검증 (6자리 숫자)
 */
export const validateVerificationCode = (code: string): { valid: boolean; message: string } => {
  if (!code.trim()) {
    return { valid: false, message: '인증 코드를 입력해주세요' };
  }
  
  if (!/^\d{6}$/.test(code)) {
    return { valid: false, message: '6자리 숫자를 입력해주세요' };
  }
  
  return { valid: true, message: '' };
};

/**
 * 생년월일 검증
 */
export const validateBirthDate = (birthDate: string): { valid: boolean; message: string } => {
  if (!birthDate) {
    return { valid: false, message: '생년월일을 입력해주세요' };
  }
  
  // YYYY-MM-DD 형식 검증
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(birthDate)) {
    return { valid: false, message: 'YYYY-MM-DD 형식으로 입력해주세요' };
  }
  
  // 유효한 날짜인지 확인
  const date = new Date(birthDate);
  const today = new Date();
  
  if (isNaN(date.getTime())) {
    return { valid: false, message: '올바른 날짜를 입력해주세요' };
  }
  
  // 미래 날짜 방지
  if (date > today) {
    return { valid: false, message: '미래 날짜는 입력할 수 없습니다' };
  }
  
  // 만 14세 이상 확인
  const age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  const dayDiff = today.getDate() - date.getDate();
  
  const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
  
  if (actualAge < 14) {
    return { valid: false, message: '만 14세 이상만 가입 가능합니다' };
  }
  
  if (actualAge > 120) {
    return { valid: false, message: '올바른 생년월일을 입력해주세요' };
  }
  
  return { valid: true, message: '' };
};

/**
 * 생년월일 포맷팅 (자동 하이픈 추가)
 */
export const formatBirthDate = (text: string): string => {
  // 숫자만 추출
  const numbers = text.replace(/[^\d]/g, '');
  
  // YYYY-MM-DD 형식으로 변환
  if (numbers.length <= 4) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  } else {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
  }
};

