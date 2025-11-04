# 만보기 기능 - Android 전용 가장 간단한 API 구현 방법

## 🎯 가장 간단한 방법: Google Fit API 활용 (Android 전용)

### 방법: @react-native-community/google-fit 사용

**장점:**
- ✅ **가장 간단함**: Google Fit API 직접 사용 (정확도 95%+)
- ✅ **배터리 효율**: 시스템 레벨 데이터 활용 (앱이 직접 측정하지 않음)
- ✅ **네이티브 모듈 최소화**: 라이브러리가 모든 걸 처리
- ✅ **정확도 높음**: Android 시스템의 걸음 수 데이터 활용
- ✅ **Google Services 이미 설정됨**: `google-services.json` 있음 ✅

**단점:**
- ⚠️ EAS Build 필요 (expo-dev-client 사용)
- ⚠️ Google Fit 권한 필요
- ⚠️ Google 계정 로그인 필요 (선택사항)

---

## 📦 필요한 패키지

### Android 전용 (가장 간단!)
```bash
npm install @react-native-community/google-fit
```

---

## 🚀 구현 단계 (가장 간단)

### Step 1: 패키지 설치

```bash
cd frontend
npm install @react-native-community/google-fit
```

### Step 2: 권한 설정

**app.json**의 Android 권한에 추가:

```json
"android": {
  "permissions": [
    "android.permission.ACTIVITY_RECOGNITION",
    "android.permission.FITNESS_ACTIVITY_READ"
  ]
}
```

**참고**: `expo-dev-client`가 이미 설치되어 있으므로 추가 설정 불필요!

### Step 3: Google Fit OAuth 설정 (선택사항)

Google Fit은 두 가지 모드가 있습니다:
1. **OAuth 없이 사용** (가장 간단!): Android의 기본 걸음 수 데이터만 읽기
2. **OAuth 사용**: Google Fit 클라우드 데이터도 읽기 (더 정확)

OAuth 없이 사용하려면 별도 설정 불필요!

### Step 4: 코드 구현 (매우 간단!)

**frontend/src/api/health.ts** 생성:

```typescript
import GoogleFit, { Scopes } from '@react-native-community/google-fit';

// Google Fit 초기화 (한 번만 실행)
let isAuthorized = false;

const initializeGoogleFit = async (): Promise<boolean> => {
  if (isAuthorized) return true;

  try {
    const options = {
      scopes: [
        Scopes.FITNESS_ACTIVITY_READ,  // 걸음 수 읽기
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
    // Google Fit 초기화
    const authorized = await initializeGoogleFit();
    if (!authorized) {
      return 0;
    }

    // 오늘 날짜 설정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    // 걸음 수 데이터 가져오기
    const result = await GoogleFit.getDailyStepCountSamples({
      startDate: today.toISOString(),
      endDate: now.toISOString(),
    });

    if (result && result.length > 0 && result[0].steps && result[0].steps.length > 0) {
      const totalSteps = result[0].steps.reduce((sum: number, step: any) => {
        return sum + (step.value || 0);
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
 * 특정 날짜 범위의 걸음 수 가져오기
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

    return result.map((day: any) => ({
      date: day.date,
      steps: day.steps.reduce((sum: number, step: any) => sum + (step.value || 0), 0),
    }));
  } catch (error) {
    console.error('❌ 걸음 수 범위 가져오기 실패:', error);
    return [];
  }
};

/**
 * 거리 정보 가져오기 (미터 단위)
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
      const totalDistance = result.reduce((sum: number, day: any) => {
        return sum + (day.distance || 0);
      }, 0);
      
      return Math.round(totalDistance); // 미터 단위
    }

    return 0;
  } catch (error) {
    console.error('❌ 거리 가져오기 실패:', error);
    return 0;
  }
};
```

### Step 5: 사용 예시

```typescript
import { getStepCount, getDistance } from '../api/health';

const PedometerScreen = () => {
  const [steps, setSteps] = useState(0);
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const stepCount = await getStepCount();
      const distanceMeters = await getDistance();
      
      setSteps(stepCount);
      setDistance(Math.round(distanceMeters / 1000 * 10) / 10); // km로 변환
      setLoading(false);
    };
    
    fetchData();
    
    // 1분마다 업데이트 (선택사항)
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      <Text>오늘 걸음 수: {steps.toLocaleString()}걸음</Text>
      <Text>이동 거리: {distance}km</Text>
    </View>
  );
};
```

---

## ⏱️ 예상 소요 시간 (Android 전용)

| 작업 | 시간 |
|------|------|
| 패키지 설치 | **10분** |
| 권한 설정 | **10분** |
| API 코드 작성 | **1시간** |
| UI 구현 | **2-3시간** |
| 테스트 | **1시간** |
| **총계** | **4-5시간 (반나절 내 완료 가능!)** |

iOS를 고려하지 않으므로 더 빠르게 구현 가능!

---

## 🎯 난이도: ⭐ (1/5) - 매우 쉬움!

**이유:**
- 라이브러리가 모든 복잡한 작업 처리
- 단순히 API 호출만 하면 됨
- 네이티브 코드 작성 불필요
- Android만 고려하므로 더 간단!

---

## ⚠️ 주의사항

### 1. EAS Build 필요
- `expo-dev-client` 사용 (이미 설치됨 ✅)
- 개발 빌드 필요: `npx expo run:android`
- 또는 EAS Build 사용

### 2. Google Fit 권한
- 첫 실행 시 Google Fit 권한 요청 팝업
- 사용자가 허용해야 데이터 읽기 가능
- Google 계정 로그인 불필요 (기본 걸음 수만 읽기)

### 3. Android 버전
- Android 4.4 (API 19) 이상 필요
- 대부분의 기기에서 지원

---

## 🔧 추가 설정 (OAuth 사용 시)

Google Fit 클라우드 데이터도 읽으려면:

1. **Google Cloud Console**에서 프로젝트 생성
2. **Google Fit API** 활성화
3. **OAuth 2.0 클라이언트 ID** 생성
4. `google-services.json` 업데이트

하지만 **기본 걸음 수만 필요하면 OAuth 설정 불필요!**

---

## 💡 결론

**가장 간단한 방법: @react-native-community/google-fit 사용 (Android 전용)**

1. **설치**: `npm install @react-native-community/google-fit`
2. **권한**: app.json에 권한 추가
3. **코드**: 간단한 API 호출
4. **시간**: **반나절 내 완료 가능!**

이 방법이 센서 직접 구현보다 **10배 이상 간단**하고, 정확도도 훨씬 높습니다!

