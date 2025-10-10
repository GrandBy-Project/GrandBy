# 🎨 Frontend 셋업 가이드

> React Native with Expo 프론트엔드 개발 가이드

---

## 📦 1. 프론트엔드 프로젝트 생성

```bash
cd frontend
```

### Expo 프로젝트 초기화

```bash
# Expo 프로젝트 생성 (TypeScript + Expo Router)
npx create-expo-app@latest . --template blank-typescript

# 또는 이미 폴더가 있다면
npx create-expo-app@latest frontend --template blank-typescript
```

---

## 📚 2. 필수 패키지 설치

```bash
cd frontend

# 핵심 라이브러리
npm install expo-router react-native-paper react-native-vector-icons zustand axios

# 미디어 & 알림
npm install expo-av expo-notifications expo-image-picker expo-secure-store

# 저장소 & 유틸
npm install @react-native-async-storage/async-storage react-native-calendars

# 폼 관리
npm install react-hook-form zod

# 네비게이션 관련
npm install react-native-gesture-handler react-native-safe-area-context

# 개발 의존성
npm install --save-dev @types/react @types/react-native
```

---

## 🗂️ 3. 프로젝트 구조 생성

```bash
# app 디렉토리 (Expo Router)
mkdir -p app/(auth) app/(elderly) app/(caregiver)

# components
mkdir -p components/common components/call components/diary components/dashboard

# services
mkdir -p services

# stores (Zustand)
mkdir -p stores

# types
mkdir -p types

# constants
mkdir -p constants

# utils
mkdir -p utils

# assets
mkdir -p assets/fonts assets/images
```

---

## 🔧 4. 환경 변수 설정

`frontend/.env` 파일 생성:

```env
# API Base URL
API_URL=http://localhost:8000
API_TIMEOUT=10000

# Environment
NODE_ENV=development
```

---

## 📱 5. App.json 설정

`app.json` 파일 수정:

```json
{
  "expo": {
    "name": "Grandby",
    "slug": "grandby",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.grandby.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.grandby.app"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "scheme": "grandby"
  }
}
```

---

## 🚀 6. 개발 서버 실행

```bash
# Expo 개발 서버 시작
npm start

# 또는 특정 플랫폼
npm run android  # Android
npm run ios      # iOS (Mac만 가능)
npm run web      # 웹 브라우저
```

---

## 📄 7. 기본 파일 생성 예시

### `app/_layout.tsx` (Root Layout)

```typescript
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(elderly)" options={{ headerShown: false }} />
      <Stack.Screen name="(caregiver)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

### `app/index.tsx` (Landing Page)

```typescript
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>🏠 Grandby</Text>
      <Button title="로그인" onPress={() => router.push('/auth/login')} />
    </View>
  );
}
```

### `services/api.ts` (Axios 설정)

```typescript
import axios from 'axios';
import { API_URL } from '@/constants/Config';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (JWT 토큰 추가)
api.interceptors.request.use(
  (config) => {
    // TODO: SecureStore에서 토큰 가져오기
    // const token = await SecureStore.getItemAsync('access_token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (에러 처리)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 토큰 만료 처리
      console.log('Unauthorized - redirect to login');
    }
    return Promise.reject(error);
  }
);

export default api;
```

### `stores/authStore.ts` (Zustand 상태 관리)

```typescript
import { create } from 'zustand';

interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  
  login: async (email, password) => {
    // TODO: API 호출
    set({ isAuthenticated: true });
  },
  
  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
```

---

## 🎨 8. UI 라이브러리 설정

### React Native Paper 설정

`app/_layout.tsx`에 Provider 추가:

```typescript
import { PaperProvider } from 'react-native-paper';

export default function RootLayout() {
  return (
    <PaperProvider>
      <Stack>
        {/* ... */}
      </Stack>
    </PaperProvider>
  );
}
```

---

## 📱 9. 실제 디바이스에서 테스트

1. **Expo Go 앱 설치**
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **QR 코드 스캔**
   - `npm start` 실행 후 나오는 QR 코드를 스캔

---

## 🔗 10. Backend API 연결

API 서비스 파일 생성:

```typescript
// services/authApi.ts
import api from './api';

export const authApi = {
  register: (data: any) => api.post('/api/auth/register', data),
  login: (data: any) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me'),
};

// services/callApi.ts
export const callApi = {
  getCallLogs: () => api.get('/api/calls'),
  getCallDetail: (id: string) => api.get(`/api/calls/${id}`),
};

// services/diaryApi.ts
export const diaryApi = {
  getDiaries: () => api.get('/api/diaries'),
  createDiary: (data: any) => api.post('/api/diaries', data),
  updateDiary: (id: string, data: any) => api.put(`/api/diaries/${id}`, data),
};
```

---

## 🧪 11. 개발 팁

### Hot Reload
- 파일 저장 시 자동으로 앱이 리로드됩니다
- Shake 제스처 또는 `cmd + d` (iOS), `cmd + m` (Android)로 개발 메뉴 접근

### 디버깅
- `console.log()`는 터미널에 출력됩니다
- React DevTools 사용 가능

### 네트워크
- **localhost 접근**: 
  - iOS 시뮬레이터: `http://localhost:8000`
  - Android 에뮬레이터: `http://10.0.2.2:8000`
  - 실제 디바이스: `http://YOUR_COMPUTER_IP:8000`

---

## 📚 12. 추가 자료

- [Expo 공식 문서](https://docs.expo.dev/)
- [Expo Router 가이드](https://expo.github.io/router/docs/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Zustand](https://zustand-demo.pmnd.rs/)

---

**Frontend 개발 준비 완료! 🎉**

이제 백엔드 API와 연동하여 기능을 구현하세요!

