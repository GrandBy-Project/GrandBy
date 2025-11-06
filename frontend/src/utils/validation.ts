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
export const validateBirthDate = (raw: string): { valid: boolean; message: string } => {
  const birthDate = (raw || "").trim();

  if (!birthDate) {
    return { valid: false, message: "생년월일을 입력해주세요" };
  }

  // 1) 형식(구조)만 체크: 숫자4-숫자2-숫자2
  const structureRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!structureRe.test(birthDate)) {
    return { valid: false, message: "YYYY-MM-DD 형식으로 입력해주세요" };
  }

  // 2) 숫자 분해
  const [yStr, mStr, dStr] = birthDate.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  // 3) 월/일 1차 범위 체크 (00, 13월, 32일 등 빠르게 차단)
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { valid: false, message: "올바른 날짜를 입력해주세요" };
  }

  // 4) 윤년/말일 체크
  const isLeap = (yy: number) => (yy % 4 === 0 && yy % 100 !== 0) || (yy % 400 === 0);
  const daysInMonth = (yy: number, mm: number) => {
    const base = [31, 28 + (isLeap(yy) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return base[mm - 1];
  };
  if (d > daysInMonth(y, m)) {
    return { valid: false, message: "올바른 날짜를 입력해주세요" };
  }

  // 5) 미래 날짜 방지 (로컬 오늘 기준; KST가 필요하면 KST 오늘 계산 함수로 대체)
  const now = new Date();
  const ty = now.getFullYear();
  const tm = now.getMonth() + 1;
  const td = now.getDate();
  const isFuture = y > ty || (y === ty && (m > tm || (m === tm && d > td)));
  if (isFuture) {
    return { valid: false, message: "미래 날짜는 입력할 수 없습니다" };
  }

  // 6) 나이 제한 (만 14~120세)
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  if (age < 14) return { valid: false, message: "만 14세 이상만 가입 가능합니다" };
  if (age > 120) return { valid: false, message: "올바른 생년월일을 입력해주세요" };

  return { valid: true, message: "" };
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

