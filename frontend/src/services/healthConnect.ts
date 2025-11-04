/**
 * Health Connect 서비스
 * Android 전용 - 걸음 수 및 거리 데이터 가져오기
 * Google Fit API 대신 Health Connect 사용 (2026년 지원 중단 대비)
 */

import { 
  isAvailable, 
  requestPermission, 
  readRecords,
  TimeRangeFilter 
} from 'react-native-health-connect';
import { Platform, Linking, Alert } from 'react-native';
import { ENABLE_HEALTH_CONNECT } from '../constants/AppConfig';

// Health Connect 인증 상태
let isInitialized = false;
let userDeclined = false; // 사용자가 취소를 눌렀는지 여부

/**
 * Health Connect 사용 가능 여부 확인 (에러 없이 조용히)
 * @returns Health Connect 사용 가능 여부
 */
export const isHealthConnectUsable = (): boolean => {
  // 설정에서 비활성화되어 있으면 사용 불가
  if (!ENABLE_HEALTH_CONNECT) {
    return false;
  }
  
  if (Platform.OS !== 'android') {
    return false;
  }
  
  // 사용자가 취소했으면 사용 불가
  if (userDeclined) {
    return false;
  }
  
  // 네이티브 모듈이 연결되지 않았으면 사용 불가
  if (typeof isAvailable !== 'function') {
    return false;
  }
  
  return true;
};

// Health Connect Play Store 링크
const HEALTH_CONNECT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

/**
 * Health Connect 앱 설치 여부 확인
 * @returns Health Connect 사용 가능 여부
 */
export const checkHealthConnectAvailability = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  // isAvailable 함수가 없는 경우 (네이티브 모듈 연결 실패)
  if (typeof isAvailable !== 'function') {
    console.error('❌ Health Connect 모듈이 연결되지 않았습니다.');
    return false;
  }

  try {
    const available = await isAvailable();
    return available;
  } catch (error) {
    console.error('❌ Health Connect 확인 중 오류:', error);
    return false;
  }
};

/**
 * Health Connect Play Store로 이동
 */
export const openHealthConnectPlayStore = (): void => {
  Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URL).catch((err) => {
    console.error('❌ Play Store 열기 실패:', err);
    Alert.alert('오류', 'Play Store를 열 수 없습니다.');
  });
};

/**
 * Health Connect 초기화 및 권한 요청
 */
export const initializeHealthConnect = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    console.log('⚠️ Health Connect는 Android 전용입니다');
    return false;
  }

  // 사용자가 이미 취소를 눌렀으면 더 이상 시도하지 않음
  if (userDeclined) {
    return false;
  }

  if (isInitialized) {
    return true;
  }

  try {
    // Health Connect가 설치되어 있는지 확인
    const available = await checkHealthConnectAvailability();
    if (!available) {
      console.log('⚠️ Health Connect 앱이 설치되어 있지 않습니다.');
      
      // 사용자에게 Health Connect 앱 설치 안내
      return new Promise<boolean>((resolve) => {
        Alert.alert(
          'Health Connect 앱 필요',
          '걸음 수 기능을 사용하려면 Health Connect 앱이 필요합니다.\n\nPlay Store에서 설치하시겠습니까?',
          [
            {
              text: '취소',
              style: 'cancel',
              onPress: () => {
                userDeclined = true; // 사용자가 취소했음을 기록
                console.log('❌ 사용자가 Health Connect 설치를 취소했습니다.');
                resolve(false);
              },
            },
            {
              text: '설치하기',
              onPress: () => {
                openHealthConnectPlayStore();
                // 설치 후에도 사용자가 다시 시도할 수 있도록 userDeclined는 false 유지
                resolve(false);
              },
            },
          ]
        );
      });
    }

    // 권한 요청
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
    ]);

    if (!granted || granted.length === 0) {
      console.log('⚠️ Health Connect 권한이 거부되었습니다');
      Alert.alert(
        '권한 필요',
        '걸음 수 데이터를 읽기 위해 Health Connect 권한이 필요합니다.\n\n설정에서 권한을 허용해주세요.'
      );
      return false;
    }

    isInitialized = true;
    console.log('✅ Health Connect 초기화 완료');
    return true;
  } catch (error) {
    console.error('❌ Health Connect 초기화 실패:', error);
    return false;
  }
};

/**
 * 오늘 날짜의 걸음 수 가져오기
 */
export const getStepCount = async (): Promise<number> => {
  try {
    const authorized = await initializeHealthConnect();
    if (!authorized) {
      // 초기화 실패 시 조용히 0 반환 (에러 로그 없음)
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const timeRangeFilter: TimeRangeFilter = {
      operator: 'between',
      startTime: today.toISOString(),
      endTime: now.toISOString(),
    };

    const result = await readRecords('Steps', {
      timeRangeFilter,
    });

    if (result && result.length > 0) {
      const totalSteps = result.reduce((sum: number, record: any) => {
        // Health Connect의 Steps 레코드는 count 필드를 가짐
        return sum + (record.count || 0);
      }, 0);
      console.log(`✅ 오늘 걸음 수: ${totalSteps}걸음`);
      return Math.round(totalSteps);
    }

    return 0;
  } catch (error) {
    console.error('❌ 걸음 수 가져오기 실패:', error);
    return 0;
  }
};

/**
 * 기간별 걸음 수 가져오기
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 */
export const getStepCountRange = async (
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; steps: number }>> => {
  try {
    const authorized = await initializeHealthConnect();
    if (!authorized) {
      return [];
    }

    const timeRangeFilter: TimeRangeFilter = {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const result = await readRecords('Steps', {
      timeRangeFilter,
    });

    if (!result || result.length === 0) {
      return [];
    }

    // 날짜별로 그룹화
    const dailySteps: { [key: string]: number } = {};

    result.forEach((record: any) => {
      const date = new Date(record.startTime).toISOString().split('T')[0]; // YYYY-MM-DD
      if (!dailySteps[date]) {
        dailySteps[date] = 0;
      }
      dailySteps[date] += record.count || 0;
    });

    return Object.entries(dailySteps).map(([date, steps]) => ({
      date,
      steps: Math.round(steps),
    }));
  } catch (error) {
    console.error('❌ 기간별 걸음 수 가져오기 실패:', error);
    return [];
  }
};

/**
 * 오늘 날짜의 거리 가져오기 (미터 단위)
 */
export const getDistance = async (): Promise<number> => {
  try {
    const authorized = await initializeHealthConnect();
    if (!authorized) {
      // 초기화 실패 시 조용히 0 반환 (에러 로그 없음)
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const timeRangeFilter: TimeRangeFilter = {
      operator: 'between',
      startTime: today.toISOString(),
      endTime: now.toISOString(),
    };

    const result = await readRecords('Distance', {
      timeRangeFilter,
    });

    if (result && result.length > 0) {
      const totalDistance = result.reduce((sum: number, record: any) => {
        // Health Connect의 Distance 레코드는 distance 필드를 가짐
        // distance는 { inMeters: number } 형태 (LengthResult)
        return sum + (record.distance?.inMeters || 0);
      }, 0);
      console.log(`✅ 오늘 거리: ${Math.round(totalDistance)}m`);
      return Math.round(totalDistance);
    }

    return 0;
  } catch (error) {
    console.error('❌ 거리 가져오기 실패:', error);
    return 0;
  }
};

