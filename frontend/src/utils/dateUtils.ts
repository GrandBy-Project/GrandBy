/**
 * 날짜/시간 포맷팅 유틸리티
 * 프로젝트 전체에서 일관된 날짜/시간 표시를 위해 통합
 * 
 * 기존 함수들의 모든 기능과 엣지 케이스를 포함합니다.
 */

/**
 * Date 객체 또는 "YYYY-MM-DD" 문자열을 "YYYY-MM-DD" 형식으로 변환
 * @param date Date 객체 또는 "YYYY-MM-DD" 문자열
 * @returns "YYYY-MM-DD" 형식의 문자열
 */
export const formatDateString = (date: Date | string): string => {
  let d: Date;
  
  if (typeof date === 'string') {
    // "YYYY-MM-DD" 형식의 문자열인 경우
    if (date.includes('T')) {
      d = new Date(date);
    } else {
      // "YYYY-MM-DD" 형식만 있는 경우, 로컬 시간으로 파싱
      d = new Date(date + 'T00:00:00');
    }
  } else {
    d = date;
  }
  
  // 유효하지 않은 날짜인 경우 오늘 날짜 사용
  if (isNaN(d.getTime())) {
    d = new Date();
  }
  
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Date 객체를 "X월 X일 (요일)" 형식으로 변환
 * @param date Date 객체
 * @returns "X월 X일 (요일)" 형식의 문자열
 */
export const formatDateWithWeekday = (date: Date | string): string => {
  let d: Date;
  
  if (typeof date === 'string') {
    if (date.includes('T')) {
      d = new Date(date);
    } else {
      d = new Date(date + 'T00:00:00');
    }
  } else {
    d = date;
  }
  
  if (isNaN(d.getTime())) {
    d = new Date();
  }
  
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${month}월 ${day}일 (${dayOfWeek})`;
};

/**
 * "YYYY-MM-DD" 형식의 날짜 문자열을 "YYYY년 X월 X일 (요일)" 형식으로 변환
 * CalendarScreen의 formatDateDisplay 함수와 동일
 * @param dateString "YYYY-MM-DD" 형식의 날짜 문자열
 * @returns "YYYY년 X월 X일 (요일)" 형식 또는 "날짜 선택" (빈 문자열인 경우)
 */
export const formatDateDisplay = (dateString: string): string => {
  if (!dateString) return '날짜 선택';
  
  const date = new Date(dateString + 'T00:00:00'); // 로컬 시간으로 파싱
  if (isNaN(date.getTime())) {
    return '날짜 선택';
  }
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
};

/**
 * "YYYY-MM-DD" 형식의 날짜 문자열을 "X월 X일 (요일)" 형식으로 변환
 * GuardianHomeScreen의 formatDateForDisplay 함수와 동일
 * @param dateString "YYYY-MM-DD" 형식의 날짜 문자열
 * @returns "X월 X일 (요일)" 형식
 */
export const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return '';
  }
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
};

/**
 * "YYYY-MM-DD" 형식의 날짜 문자열을 "오늘/어제/내일 X월 X일 요일" 또는 "X월 X일 요일" 형식으로 변환
 * GuardianTodoAddScreen의 formatDateForDisplay 함수와 동일
 * @param dateString "YYYY-MM-DD" 형식의 날짜 문자열
 * @returns "오늘/어제/내일 X월 X일 요일" 또는 "X월 X일 요일"
 */
export const formatDateForDisplayWithRelative = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString + 'T00:00:00');
  if (isNaN(date.getTime())) {
    return '';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateString + 'T00:00:00');
  targetDate.setHours(0, 0, 0, 0);
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[date.getDay()];
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `오늘 ${month}월 ${day}일 ${dayName}`;
  } else if (diffDays === -1) {
    return `어제 ${month}월 ${day}일 ${dayName}`;
  } else if (diffDays === 1) {
    return `내일 ${month}월 ${day}일 ${dayName}`;
  }
  
  return `${month}월 ${day}일 ${dayName}`;
};

/**
 * "HH:MM" 형식의 시간 문자열을 "X시 X분" 형식으로 변환
 * CalendarScreen의 convertHHMMToKoreanTime 함수와 동일
 * @param timeStr "HH:MM" 형식의 시간 문자열 또는 null
 * @returns "X시 X분" 형식 또는 "시간 미정" 또는 "하루 종일"
 */
export const formatTimeKorean = (timeStr: string | null): string => {
  if (!timeStr) return '시간 미정';
  
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  
  if (isNaN(hour) || isNaN(minute)) {
    return '시간 미정';
  }
  
  if (hour === 0 && minute === 0) return '하루 종일';
  
  return `${hour}시 ${minute}분`;
};

/**
 * "HH:MM" 형식의 시간 문자열을 "X시 X분" 형식으로 변환 (에러 메시지 포함)
 * CalendarScreen의 formatHHMMToDisplay 함수와 동일
 * @param timeStr "HH:MM" 형식의 시간 문자열
 * @returns "X시 X분" 형식 또는 "시간을 선택해주세요"
 */
export const formatHHMMToDisplay = (timeStr: string): string => {
  if (!timeStr) return '시간을 선택해주세요';
  
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr || '0', 10);
  const minute = parseInt(minuteStr || '0', 10);
  
  if (isNaN(hour) || isNaN(minute)) {
    return '시간을 선택해주세요';
  }
  
  return `${hour}시 ${minute}분`;
};

/**
 * "HH:MM" 형식의 시간 문자열을 "오전/오후 X:XX" 형식으로 변환
 * GuardianHomeScreen의 formatTime 함수와 동일
 * @param timeStr "HH:MM" 형식의 시간 문자열
 * @returns "오전/오후 X:XX" 형식
 */
export const formatTimeAmPm = (timeStr: string): string => {
  if (!timeStr) return '';
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    return '';
  }
  
  const period = hours < 12 ? '오전' : '오후';
  const displayHours = hours % 12 || 12;
  return `${period} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * "HH:MM" 형식의 시간 문자열을 "오전/오후 X시" 형식으로 변환
 * GuardianHomeScreen의 formatTimeToDisplay 함수와 동일
 * @param time24 "HH:MM" 형식의 시간 문자열 또는 null
 * @returns "오전/오후 X시" 형식 또는 빈 문자열
 */
export const formatTimeToDisplay = (time24: string | null): string => {
  if (!time24) return '';
  
  const [hour] = time24.split(':').map(Number);
  if (isNaN(hour)) {
    return '';
  }
  
  if (hour === 0) return '오전 12시';
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return '오후 12시';
  return `오후 ${hour - 12}시`;
};

/**
 * 시간과 분을 "HH:MM" 형식으로 변환
 * CalendarScreen의 formatTimeToHHMM 함수와 동일
 * @param hour 시간 (0-23)
 * @param minute 분 (0-59)
 * @returns "HH:MM" 형식의 문자열
 */
export const formatTimeToHHMM = (hour: number, minute: number): string => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

/**
 * "오전/오후 X시" 형식을 24시간 형식 "HH:MM"으로 변환
 * GuardianHomeScreen의 parseDisplayTimeToApi 함수와 동일
 * @param displayTime "오전/오후 X시" 형식의 문자열
 * @returns "HH:MM" 형식의 문자열 (분은 항상 00)
 */
export const parseDisplayTimeToApi = (displayTime: string): string => {
  const timeStr = displayTime.replace(/[^0-9]/g, '');
  const hour = displayTime.includes('오후')
    ? (parseInt(timeStr) === 12 ? 12 : parseInt(timeStr) + 12)
    : (parseInt(timeStr) === 12 ? 0 : parseInt(timeStr));
  return `${hour.toString().padStart(2, '0')}:00`;
};

/**
 * Date 객체가 오늘인지 확인
 * @param date Date 객체
 * @returns 오늘이면 true, 아니면 false
 */
export const isToday = (date: Date | string): boolean => {
  let d: Date;
  
  if (typeof date === 'string') {
    d = new Date(date + 'T00:00:00');
  } else {
    d = date;
  }
  
  if (isNaN(d.getTime())) {
    return false;
  }
  
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

/**
 * 두 날짜가 같은 날인지 확인
 * @param date1 첫 번째 Date 객체
 * @param date2 두 번째 Date 객체
 * @returns 같은 날이면 true, 아니면 false
 */
export const isSameDate = (date1: Date | string, date2: Date | string): boolean => {
  let d1: Date;
  let d2: Date;
  
  if (typeof date1 === 'string') {
    d1 = new Date(date1 + 'T00:00:00');
  } else {
    d1 = date1;
  }
  
  if (typeof date2 === 'string') {
    d2 = new Date(date2 + 'T00:00:00');
  } else {
    d2 = date2;
  }
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return false;
  }
  
  return d1.toDateString() === d2.toDateString();
};

/**
 * 한국 시간대(KST, UTC+9) 기준으로 오늘 날짜를 "YYYY-MM-DD" 형식으로 반환
 * toISOString()은 UTC 기준이므로 한국 시간대에서 자정 이후에 전날 날짜가 될 수 있는 문제를 해결
 * @returns "YYYY-MM-DD" 형식의 한국 시간대 기준 오늘 날짜
 */
export const getTodayKST = (): string => {
  const now = new Date();
  // 한국 시간대 기준으로 날짜 가져오기
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = koreaTime.getFullYear();
  // getMonth()는 0부터 시작 (0=1월, 11=12월)이므로 +1을 해서 실제 월을 구함
  const month = (koreaTime.getMonth() + 1).toString().padStart(2, '0');
  const day = koreaTime.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

