/**
 * Google Fit 서비스
 * Android 전용 - 걸음 수 및 거리 데이터 가져오기
 */

import GoogleFit, { Scopes } from '@react-native-community/google-fit';

// Google Fit 인증 상태
let isAuthorized = false;

/**
 * Google Fit 초기화 및 권한 요청
 */
export const initializeGoogleFit = async (): Promise<boolean> => {
  if (isAuthorized) {
    return true;
  }

  try {
    const options = {
      scopes: [
        Scopes.FITNESS_ACTIVITY_READ, // 걸음 수 읽기
      ],
    };

    const authResult = await GoogleFit.authorize(options);
    isAuthorized = authResult.success;

    if (!isAuthorized) {
      console.log('⚠️ Google Fit 권한 거부됨');
      return false;
    }

    console.log('✅ Google Fit 인증 완료');
    return true;
  } catch (error) {
    console.error('❌ Google Fit 초기화 실패:', error);
    return false;
  }
};

/**
 * 오늘 날짜의 걸음 수 가져오기
 */
export const getStepCount = async (): Promise<number> => {
  try {
    const authorized = await initializeGoogleFit();
    if (!authorized) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const result = await GoogleFit.getDailyStepCountSamples({
      startDate: today.toISOString(),
      endDate: now.toISOString(),
    });

    if (result && result.length > 0 && result[0].steps && result[0].steps.length > 0) {
      const totalSteps = result[0].steps.reduce(
        (sum: number, step: any) => sum + (step.value || 0),
        0
      );
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
    const authorized = await initializeGoogleFit();
    if (!authorized) {
      return [];
    }

    const result = await GoogleFit.getDailyStepCountSamples({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    if (!result || result.length === 0) {
      return [];
    }

    const dailySteps: Array<{ date: string; steps: number }> = [];

    result.forEach((day: any) => {
      if (day.steps && day.steps.length > 0) {
        const totalSteps = day.steps.reduce(
          (sum: number, step: any) => sum + (step.value || 0),
          0
        );
        const date = new Date(day.date).toISOString().split('T')[0]; // YYYY-MM-DD
        dailySteps.push({
          date,
          steps: Math.round(totalSteps),
        });
      }
    });

    return dailySteps;
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
    const authorized = await initializeGoogleFit();
    if (!authorized) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const result = await GoogleFit.getDailyDistanceSamples({
      startDate: today.toISOString(),
      endDate: now.toISOString(),
    });

    if (result && result.length > 0) {
      const totalDistance = result.reduce(
        (sum: number, day: any) => sum + (day.distance || 0),
        0
      );
      console.log(`✅ 오늘 거리: ${Math.round(totalDistance)}m`);
      return Math.round(totalDistance);
    }

    return 0;
  } catch (error) {
    console.error('❌ 거리 가져오기 실패:', error);
    return 0;
  }
};

/**
 * Google Fit 권한 해제 (테스트용)
 */
export const disconnectGoogleFit = async (): Promise<void> => {
  try {
    await GoogleFit.disconnect();
    isAuthorized = false;
    console.log('✅ Google Fit 연결 해제됨');
  } catch (error) {
    console.error('❌ Google Fit 연결 해제 실패:', error);
  }
};

