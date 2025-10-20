# 🌤️ 날씨 API 설정 가이드

## 1. .env 파일 생성

```bash
# frontend 디렉토리에서 실행
cp env.example .env
```

## 2. OpenWeatherMap API 키 발급

### 2.1. 회원가입
1. https://openweathermap.org/ 접속
2. **Sign Up** 클릭
3. 이메일 인증 완료

### 2.2. API 키 발급
1. 로그인 후 **My API keys** 메뉴 클릭
2. 기본 API 키 복사 (또는 새로 생성)
3. 무료 플랜: **1,000 calls/day** (충분함)

## 3. .env 파일 수정

`frontend/.env` 파일을 열고 다음을 수정:

```bash
# 기존 설정은 그대로 유지
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000

# 발급받은 API 키로 교체
EXPO_PUBLIC_OPENWEATHER_API_KEY=여기에_발급받은_API_키_붙여넣기
```

### 예시:
```bash
EXPO_PUBLIC_OPENWEATHER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## 4. 앱 재시작

환경 변수 변경 후 앱을 재시작하세요:

```bash
# Expo 개발 서버 종료 (Ctrl+C)
# 다시 시작
npm start
```

## 5. 테스트

### Android Emulator
1. **Emulator 우측 패널** 열기 (`...` 버튼)
2. **Location** 탭 클릭
3. 좌표 입력:
   - Latitude: `37.5665` (서울)
   - Longitude: `126.9780`
4. **SEND** 버튼 클릭
5. 앱에서 날씨 정보 확인

### 실제 기기
1. 위치 권한 허용
2. GPS 활성화
3. 자동으로 날씨 표시

## 6. 문제 해결

### "API 키가 설정되지 않았습니다"
- `.env` 파일이 `frontend/` 디렉토리에 있는지 확인
- 앱을 재시작했는지 확인

### "위치 권한이 거부되었습니다"
- Emulator: Location 패널에서 좌표 설정
- 실제 기기: 설정 → 앱 → 권한 → 위치 → 허용

### "날씨 API 호출 실패"
- API 키가 올바른지 확인
- 인터넷 연결 확인
- API 키 활성화까지 몇 분 소요될 수 있음

## 7. 보안 주의사항

⚠️ `.env` 파일은 절대 Git에 커밋하지 마세요!
- `.gitignore`에 이미 추가되어 있음
- API 키가 노출되면 무단 사용될 수 있음

✅ 팀원과 공유할 때는 `.env` 파일을 직접 전달 (Slack, Discord 등)

## 8. 디버깅 로그

앱 실행 시 콘솔에서 다음 로그 확인:

```
📍 [Android Emulator] 현재 좌표: 37.5665, 126.9780
🌤️ 날씨 API 요청: 37.5665, 126.9780
✅ 날씨 정보: 23°C, 맑음
✅ 날씨 로딩 성공: {...}
```

문제가 있으면 이 로그를 확인하세요!

