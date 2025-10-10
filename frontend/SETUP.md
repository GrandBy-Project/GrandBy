# 🚀 프론트엔드 설정 가이드

## 📱 현재 완료된 것

✅ **폴더 구조 완성**
✅ **로그인/회원가입 화면**
✅ **홈 화면 (메인)**
✅ **API 연동 준비**
✅ **상태 관리 (Zustand)**
✅ **Expo Router 네비게이션**

---

## ⚙️ API 서버 연결 설정 (필수!)

### 1. PC의 IP 주소 확인

**Windows:**
```bash
ipconfig
```
- `무선 LAN 어댑터 Wi-Fi` 또는 `이더넷 어댑터` 섹션에서
- `IPv4 주소` 찾기 (예: `192.168.0.63`)

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```

### 2. API 클라이언트 설정 수정

**파일**: `frontend/src/api/client.ts`

```typescript
// 8번째 줄을 수정하세요
export const API_BASE_URL = 'http://YOUR_PC_IP:8000';
// 예: export const API_BASE_URL = 'http://192.168.0.63:8000';
```

⚠️ **주의**: `localhost`나 `127.0.0.1`이 아닌 **실제 IP 주소**를 사용해야 합니다!

---

## 📱 앱 실행 방법

### 1. 개발 서버 시작
```bash
cd frontend
npx expo start --tunnel
```

### 2. 스마트폰에서 실행
1. **Expo Go** 앱 다운로드 (Google Play / App Store)
2. QR 코드 스캔
3. 앱이 자동으로 로드됩니다

---

## 🧪 테스트 계정

회원가입 후 바로 사용 가능합니다:

**테스트 회원가입 정보:**
- 이메일: `test@example.com`
- 비밀번호: `test1234`
- 이름: `테스트사용자`
- 역할: 어르신 or 보호자

---

## 📂 프로젝트 구조

```
frontend/
├── app/                    # Expo Router 라우팅
│   ├── _layout.tsx        # 루트 레이아웃
│   ├── index.tsx          # 로그인 화면 (/)
│   ├── register.tsx       # 회원가입 (/register)
│   └── home.tsx           # 홈 화면 (/home)
│
├── src/
│   ├── api/               # API 클라이언트
│   │   ├── client.ts      # Axios 설정
│   │   └── auth.ts        # 인증 API
│   │
│   ├── components/        # 공통 컴포넌트
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   │
│   ├── screens/           # 화면 컴포넌트
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── HomeScreen.tsx
│   │
│   ├── store/             # 상태 관리 (Zustand)
│   │   └── authStore.ts
│   │
│   ├── types/             # TypeScript 타입
│   │   └── index.ts
│   │
│   └── utils/             # 유틸리티 함수
│
├── package.json
└── app.json
```

---

## 🔧 주요 기능

### ✅ 완료된 기능
- 회원가입 (어르신/보호자 선택)
- 로그인/로그아웃
- JWT 토큰 자동 관리
- 입력 폼 검증
- 에러 처리
- 상태 관리

### 🚧 개발 예정 기능
- 일기 작성/조회
- AI 통화
- 할일 관리
- 보호자-어르신 연결
- 알림
- 대시보드

---

## 🐛 문제 해결

### 1. "Network Error" 발생
- PC IP 주소를 정확히 입력했는지 확인
- PC와 스마트폰이 같은 Wi-Fi에 연결되어 있는지 확인
- 백엔드 서버가 실행 중인지 확인: `docker-compose ps`

### 2. "Cannot connect to Metro"
```bash
# Expo 서버 재시작
npx expo start --clear
```

### 3. 캐시 문제
```bash
# 캐시 삭제 후 재시작
npx expo start --clear
```

---

## 📝 다음 단계

1. **API 서버 연결**: `src/api/client.ts`에서 IP 수정
2. **앱 테스트**: 회원가입 → 로그인 → 홈 화면 확인
3. **기능 개발**: 일기, AI 통화 등 구현

---

## 💡 팁

- **Hot Reload**: 코드 수정 시 자동으로 앱이 새로고침됩니다
- **디버깅**: 터미널에서 `j` 키를 누르면 Chrome DevTools 열림
- **재시작**: 터미널에서 `r` 키를 누르면 앱 재시작

---

**문제가 발생하면 팀원들과 공유하세요!** 🚀

