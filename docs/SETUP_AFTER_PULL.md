# 🚀 Pull 후 초기 설정 가이드

> **이 브랜치를 처음 pull 받았다면 이 가이드를 따라주세요!**

---

## 📋 **필수 작업 순서**

### **1. 프로젝트 루트로 이동**
```cmd
cd C:\myWs\granby\GrandBy
```

---

### **2. Git Pull**
```cmd
git fetch origin
git checkout feature/sm/elderly-main-ui
git pull origin feature/sm/elderly-main-ui
```

---

### **3. Backend 환경 설정 (기존 .env 유지)**

**⚠️ 기존 `.env` 파일이 있다면 그대로 사용하세요!**

```cmd
REM 기존 .env가 없다면 생성
cd backend
copy env.example .env
```

**변경 불필요** - 날씨 API는 Frontend만 사용

---

### **4. Frontend 환경 설정 (중요!)**

#### **4-1. .env 파일 생성**
```cmd
cd ..\frontend
copy env.example .env
```

#### **4-2. .env 파일 수정**

`frontend\.env` 파일을 메모장으로 열고:

```bash
# Backend API URL (Ngrok 사용 중)
EXPO_PUBLIC_API_BASE_URL=https://your-ngrok-url.ngrok-free.app

# 날씨 API 키 (새로 추가!)
EXPO_PUBLIC_OPENWEATHER_API_KEY=24cda45057xxxxxxxxxxxxxxxxxx
```

**📌 중요:**
- `EXPO_PUBLIC_API_BASE_URL`: 팀장에게 받은 Ngrok URL로 설정
- `EXPO_PUBLIC_OPENWEATHER_API_KEY`: 팀장에게 받은 날씨 API 키로 설정

---

### **5. Docker 컨테이너 재시작 (Backend)**

```cmd
cd ..
docker-compose down
docker-compose up -d --build
```

**대기:** 컨테이너 시작까지 약 30초

---

### **6. Frontend 의존성 설치**

```cmd
cd frontend
npm install
```

---

### **7. Expo 개발 서버 실행**

```cmd
npm start
```

**대기:** Metro Bundler 시작까지 약 10초

---

### **8. 앱 실행 (선택)**

#### **Android Emulator:**
```
Expo 터미널에서 'a' 키
```

#### **실제 기기:**
```
QR 코드 스캔 또는
Expo Go 앱에서 수동 연결
```

---

## 📱 **날씨 기능 테스트 (실제 기기만)**

### **⚠️ 중요: Development Build 필요**

날씨 기능은 `expo-location` 플러그인을 사용하므로 **EAS Development Build**가 필요합니다.

#### **Option 1: 팀장이 공유한 APK 설치 (추천)**
```
1. 팀장이 공유한 QR 코드 스캔
2. APK 다운로드 및 설치
3. 앱 실행
```

#### **Option 2: 직접 빌드 (시간 소요)**
```cmd
cd frontend
eas build --profile development --platform android
```
**소요 시간:** 15-30분

---

## 🧪 **정상 작동 확인**

### **1. Backend 확인**
```cmd
REM 별도 터미널에서
docker ps

REM 다음 컨테이너들이 실행 중이어야 함:
REM - grandby_postgres
REM - grandby_redis
REM - grandby_api
REM - grandby_celery_worker
REM - grandby_celery_beat
```

### **2. Frontend 확인**
```
Expo 터미널:
› Metro waiting on exp://...
```

### **3. 앱 실행 확인**

**콘솔 로그:**
```
🔍 환경: 실제 기기 | GPS: 실제
📍 GPS 좌표: 37.5172, 127.0134
📍 위치: 서울특별시 서초구
🌤️ 날씨: 서울특별시 서초구 17°C, 온흐림
```

---

## ⚠️ **문제 해결**

### **"API 키가 설정되지 않았습니다"**
```cmd
REM .env 파일 확인
notepad frontend\.env

REM 앱 재시작 (Expo 터미널에서)
r
```

### **"위치 권한 거부"**
```
설정 → 앱 → Grandby → 권한 → 위치 → 허용
```

### **Docker 컨테이너 오류**
```cmd
docker-compose logs api
docker-compose restart api
```

### **Ngrok 연결 실패**
```
팀장에게 최신 Ngrok URL 요청
frontend\.env 파일 업데이트
```

---

## 📞 **도움 요청**

문제가 해결되지 않으면:
1. 콘솔 로그 전체 캡처
2. `.env` 파일 내용 확인 (API 키는 가려서)
3. 팀장에게 공유

---

## ✅ **체크리스트**

- [ ] Git Pull 완료
- [ ] Backend .env 확인 (기존 사용)
- [ ] Frontend .env 생성 및 수정
- [ ] Docker 컨테이너 실행 중
- [ ] Frontend 의존성 설치 (npm install)
- [ ] Expo 개발 서버 실행
- [ ] 앱 실행 (Emulator 또는 실제 기기)
- [ ] 날씨 정보 정상 표시 (실제 기기 + Development Build)

---

## 🎯 **최소 설정 (빠른 시작)**

날씨 기능 제외하고 기본 기능만 테스트하려면:

```cmd
cd C:\myWs\granby\GrandBy
git pull origin feature/sm/elderly-main-ui
docker-compose up -d
cd frontend
npm install
npm start
```

날씨 기능은 팀장이 공유한 Development Build APK로만 테스트 가능합니다.

