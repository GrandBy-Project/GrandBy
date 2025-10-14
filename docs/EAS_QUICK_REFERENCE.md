# EAS Build 빠른 참조 가이드

## 🚀 빠른 시작

### 신규 팀원 설정 (5분)
```bash
# 1. 저장소 클론
git clone https://github.com/GrandBy-Project/GrandBy.git
cd GrandBy/frontend

# 2. 의존성 설치
npm install

# 3. EAS CLI 설치
npm install -g eas-cli
eas login

# 4. Development Build 다운로드 및 설치
# https://expo.dev/accounts/parad327/projects/frontend/builds

# 5. 개발 시작
npx expo start --dev-client
```

---

## 📱 자주 사용하는 명령어

### 개발
```bash
# 개발 서버 시작
npx expo start --dev-client

# 캐시 삭제 후 시작
npx expo start --clear

# Android 에뮬레이터에서 실행
npx expo start --android

# iOS 시뮬레이터에서 실행 (Mac)
npx expo start --ios
```

### 빌드
```bash
# Development 빌드 (가장 자주 사용)
eas build --platform android --profile development

# Preview 빌드 (내부 테스트용)
eas build --platform android --profile preview

# Production 빌드 (스토어 배포용)
eas build --platform android --profile production

# 로컬 빌드 (빠름, Android Studio 필요)
eas build --platform android --profile development --local

# iOS 빌드
eas build --platform ios --profile development
```

### 빌드 관리
```bash
# 빌드 목록 확인
eas build:list

# 특정 빌드 상세 정보
eas build:view [BUILD_ID]

# 빌드 취소
eas build:cancel [BUILD_ID]

# 프로젝트 정보
eas project:info
```

### 패키지 관리
```bash
# Expo 호환 패키지 설치
npx expo install [패키지명]

# 의존성 체크
npx expo install --check

# 프로젝트 헬스 체크
npx expo-doctor
```

---

## 🔧 트러블슈팅 체크리스트

### 문제: 앱이 개발 서버에 연결 안 됨
```bash
# 1. 같은 WiFi 네트워크인지 확인
# 2. 방화벽 확인
# 3. Metro 번들러 재시작
r (터미널에서)

# 4. 캐시 삭제
npx expo start --clear

# 5. Tunnel 모드 사용
npx expo start --tunnel
```

### 문제: 빌드 실패
```bash
# 1. 패키지 의존성 확인
npx expo-doctor

# 2. package-lock.json 삭제 후 재설치
rm package-lock.json
rm -rf node_modules
npm install

# 3. eas.json 설정 확인
cat eas.json

# 4. app.json 검증
npx expo config --type public
```

### 문제: Hot Reload 안 됨
```bash
# 1. 개발 서버 재시작
r (터미널에서)

# 2. 앱에서 수동 새로고침
# Android: RR
# iOS: Cmd+D → Reload

# 3. Fast Refresh 활성화 확인
# 앱 메뉴 → Enable Fast Refresh
```

---

## 📋 언제 새 빌드가 필요한가?

### ✅ 새 빌드 필요
- 네이티브 모듈 추가/제거
- `app.json` 설정 변경
- `eas.json` 설정 변경
- 네이티브 코드 수정
- Expo Config Plugin 추가

### ❌ 새 빌드 불필요 (Hot Reload 가능)
- JS/TS 코드 수정
- 컴포넌트 추가/수정
- 스타일 변경
- API 호출 로직 변경
- 상태 관리 코드 변경

---

## 🎯 개발 워크플로우

### 시나리오 1: 일반 UI 개발
```
1. npx expo start --dev-client
2. 코드 수정
3. 저장 → 자동 Hot Reload
4. 테스트
5. 반복
```
**예상 시간**: 즉시 (Hot Reload)

### 시나리오 2: 네이티브 모듈 추가
```
1. npx expo install expo-camera
2. app.json에 권한 추가
3. eas build --platform android --profile development
4. 빌드 대기 (10-20분)
5. APK 다운로드 및 설치
6. npx expo start --dev-client
7. 기능 개발
```
**예상 시간**: 첫 빌드 10-20분, 이후 개발은 Hot Reload

### 시나리오 3: QA 테스트 배포
```
1. develop 브랜치 최신화
2. eas build --platform android --profile preview
3. 빌드 완료 대기
4. QR 코드 또는 링크를 QA 팀에 공유
5. 피드백 수집
```
**예상 시간**: 10-20분

---

## 🔑 핵심 개념

### Development Client vs Expo Go
| 항목 | Expo Go | Development Client |
|------|---------|-------------------|
| 네이티브 모듈 | 제한적 | 무제한 |
| 빌드 필요 | ❌ | ✅ (처음 1회) |
| 시작 속도 | 즉시 | APK 설치 필요 |
| 커스텀 네이티브 코드 | ❌ | ✅ |
| 프로덕션 배포 | ❌ | ✅ |

### 빌드 프로필
| 프로필 | 용도 | 배포 방식 |
|--------|------|----------|
| development | 개발용 (Hot Reload) | Internal |
| preview | 내부 테스트용 | Internal (APK) |
| production | 스토어 배포용 | Store (AAB) |

---

## 🌐 유용한 링크

### 프로젝트
- **EAS Dashboard**: https://expo.dev/accounts/parad327/projects/frontend
- **Builds**: https://expo.dev/accounts/parad327/projects/frontend/builds
- **Project ID**: e28f1ca6-9d5f-4503-997a-ac6a21fd7eb0

### 문서
- **EAS Build**: https://docs.expo.dev/build/introduction/
- **Development Client**: https://docs.expo.dev/development/introduction/
- **Expo Config**: https://docs.expo.dev/workflow/configuration/

### 커뮤니티
- **Expo Discord**: https://chat.expo.dev/
- **Expo Forums**: https://forums.expo.dev/
- **Stack Overflow**: [expo] 태그

---

## 📞 도움이 필요할 때

1. **문서 확인**: `/docs/EAS_SETUP_GUIDE.md`
2. **Slack**: #grandby-dev 채널
3. **팀 리더**: 직접 문의
4. **Expo Support**: https://expo.dev/support

---

## ⚡ 팁 & 트릭

### 빠른 개발
```bash
# alias 설정 (bashrc/zshrc)
alias expo-dev="cd ~/GrandBy/frontend && npx expo start --dev-client"
alias expo-clear="cd ~/GrandBy/frontend && npx expo start --clear"
```

### 여러 디바이스 동시 테스트
```bash
# 개발 서버 1개 실행으로 여러 디바이스 연결 가능
npx expo start --dev-client --lan
```

### Tunnel 모드 (네트워크 제한 시)
```bash
# ngrok을 사용한 터널링
npx expo start --tunnel
```

### 빌드 자동화
```bash
# GitHub Actions로 자동 빌드 설정 가능
# .github/workflows/eas-build.yml
```

---

**버전**: 1.0.0
**최종 업데이트**: 2025-10-15
