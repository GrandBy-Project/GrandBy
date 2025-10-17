# 사용자 프로필 기능 구현 완료

## 📋 구현된 기능 목록

### 1. ✅ 회원가입 시 생년월일 및 성별 추가
- **입력 방식**: 직접 입력 (YYYY-MM-DD 형식)
- **성별 옵션**: 남성/여성
- **필수 여부**: 필수 입력
- **유효성 검사**:
  - 만 14세 이상 가입 가능
  - 120세 이하만 가입 가능
  - 미래 날짜 입력 불가
  - YYYY-MM-DD 형식 자동 포맷팅

### 2. ✅ 프로필 이미지 설정
- **이미지 저장 방식**: 
  - 현재: 로컬 파일시스템 (`backend/uploads/profiles/`)
  - 향후: AWS S3로 마이그레이션 예정
- **이미지 크기 제한**: 5MB
- **자동 리사이징**: 512x512 정사각형으로 자동 크롭 및 리사이즈
- **지원 형식**: JPEG, PNG, GIF, WEBP
- **추가 기능**:
  - EXIF 회전 정보 자동 보정
  - RGB 색상 모드 자동 변환
  - 중앙 기준 크롭

### 3. ✅ 계정 찾기 기능
#### 이메일 찾기
- **입력 정보**: 이름 + 전화번호
- **출력 형식**: 마스킹된 이메일 (예: `abc***@gmail.com`)

#### 비밀번호 재설정
- **방식**: 이메일로 6자리 인증 코드 발송
- **코드 유효 시간**: 5분
- **최대 시도 횟수**: 5회
- **코드 재발송 가능**

### 4. ✅ 비밀번호 변경
- **현재 비밀번호 확인 필수**
- **새 비밀번호 조건**:
  - 최소 6자 이상
  - 현재 비밀번호와 달라야 함
- **소셜 로그인 사용자**: 비밀번호 변경 불가 (안내 메시지 표시)

### 5. ✅ 프로필 수정
- **수정 가능 항목**:
  - 이름
  - 전화번호
  - 생년월일
  - 성별
- **수정 불가 항목**:
  - 이메일 (회원가입 시 확정)
  - 계정 유형 (어르신/보호자)

### 6. ✅ 계정 삭제 (Soft Delete)
- **삭제 방식**: Soft Delete (복구 가능)
- **유예 기간**: 30일
- **데이터 처리**:
  - 이메일, 이름, 전화번호 익명화
  - 프로필 이미지 삭제
  - `is_active = False` 설정
  - `deleted_at` 타임스탬프 기록
- **비밀번호 확인**: 이메일 로그인 사용자는 비밀번호 확인 필수
- **복구 방법**: 30일 이내 재로그인 (향후 구현 예정)

---

## 🗄️ 데이터베이스 변경사항

### User 테이블 추가 컬럼
```sql
-- 생년월일
birth_date DATE NULL

-- 성별 (MALE, FEMALE)
gender VARCHAR(10) NULL

-- 프로필 이미지 URL
profile_image_url VARCHAR(500) NULL

-- Soft Delete 타임스탬프
deleted_at TIMESTAMP NULL
```

### 마이그레이션 파일
- 파일: `backend/migrations/versions/20251016_1500-add_user_profile_fields.py`
- 실행 명령어: `cd backend && alembic upgrade head`

---

## 🔧 백엔드 구현

### 새로운 파일
1. **`backend/app/utils/image.py`**
   - 프로필 이미지 저장, 리사이징, 삭제 유틸리티
   - EXIF 회전 정보 자동 보정
   - 중앙 기준 크롭 및 정사각형 리사이즈

### 수정된 파일
1. **`backend/app/models/user.py`**
   - `Gender` enum 추가
   - `birth_date`, `gender`, `profile_image_url`, `deleted_at` 필드 추가

2. **`backend/app/schemas/user.py`**
   - `UserCreate`: `birth_date`, `gender` 필수 필드 추가
   - `UserResponse`: 새 필드 포함
   - 생년월일 유효성 검사 (만 14세 이상)

3. **`backend/app/routers/auth.py`**
   - 회원가입: `birth_date`, `gender` 받기
   - `POST /find-email`: 이메일 찾기 엔드포인트
   - `POST /reset-password-request`: 비밀번호 재설정 코드 발송
   - `POST /reset-password-verify`: 비밀번호 재설정 검증 및 변경

4. **`backend/app/routers/users.py`**
   - `POST /profile-image`: 프로필 이미지 업로드
   - `DELETE /profile-image`: 프로필 이미지 삭제
   - `PUT /profile`: 프로필 정보 수정
   - `PUT /change-password`: 비밀번호 변경
   - `DELETE /account`: 계정 삭제 (Soft Delete)

5. **`backend/app/config.py`**
   - 이미지 업로드 관련 설정 추가:
     - `UPLOAD_DIR`
     - `MAX_IMAGE_SIZE`
     - `PROFILE_IMAGE_SIZE`

6. **`backend/app/main.py`**
   - 정적 파일 서빙 설정: `/uploads` 경로

7. **`backend/app/utils/email.py`**
   - `send_password_reset_email()`: 비밀번호 재설정 이메일 발송

8. **`backend/requirements.txt`**
   - `Pillow==10.4.0` 추가 (이미지 처리)

---

## 📱 프론트엔드 구현

### 새로운 파일
1. **`frontend/src/screens/FindAccountScreen.tsx`**
   - 이메일 찾기 탭
   - 비밀번호 재설정 탭

2. **`frontend/src/screens/ChangePasswordScreen.tsx`**
   - 비밀번호 변경 화면
   - 소셜 로그인 사용자 안내

3. **`frontend/src/screens/ProfileEditScreen.tsx`**
   - 프로필 정보 수정 화면
   - 수정 가능/불가 항목 구분

4. **라우트 파일**
   - `frontend/app/find-account.tsx`
   - `frontend/app/change-password.tsx`
   - `frontend/app/profile-edit.tsx`

### 수정된 파일
1. **`frontend/src/types/index.ts`**
   - `Gender` enum 추가
   - `User` 인터페이스: `birth_date`, `gender`, `profile_image_url` 추가
   - `RegisterRequest`: `birth_date`, `gender` 필수 필드 추가

2. **`frontend/src/utils/validation.ts`**
   - `validateBirthDate()`: 생년월일 유효성 검사
   - `formatBirthDate()`: YYYY-MM-DD 자동 포맷팅

3. **`frontend/src/screens/RegisterScreen.tsx`**
   - 생년월일 입력 필드 추가 (자동 포맷팅)
   - 성별 선택 버튼 추가
   - 만 14세 이상 안내 문구

4. **`frontend/src/screens/MyPageScreen.tsx`**
   - 프로필 이미지 업로드/삭제 기능
   - 이미지 선택 시 권한 요청
   - 업로드 진행 상태 표시
   - 프로필 수정, 비밀번호 변경, 계정 삭제 버튼 연결
   - 계정 삭제 핸들러 구현

5. **`frontend/src/screens/LoginScreen.tsx`**
   - 계정 찾기 버튼 → `/find-account` 페이지 연결

---

## 🚀 실행 방법

### 1. 백엔드 설정 및 실행

```bash
# 1. 데이터베이스 시작 (Docker)
cd grandby_proj
docker-compose up -d postgres redis

# 2. 마이그레이션 적용
cd backend
alembic upgrade head

# 3. 업로드 디렉토리 생성 (자동 생성되지만 미리 생성 가능)
mkdir -p uploads/profiles

# 4. 백엔드 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 프론트엔드 실행

```bash
cd frontend

# Expo 개발 서버 시작
npx expo start

# 또는 안드로이드 직접 실행
npx expo run:android
```

---

## 🧪 테스트 시나리오

### 1. 회원가입 테스트
- [ ] 생년월일 자동 포맷팅 확인 (19900101 → 1990-01-01)
- [ ] 만 14세 미만 가입 차단 확인
- [ ] 성별 선택 필수 확인
- [ ] 회원가입 후 프로필 정보 확인

### 2. 프로필 이미지 테스트
- [ ] 이미지 선택 권한 요청 확인
- [ ] 5MB 이상 이미지 업로드 차단 확인
- [ ] 업로드 후 512x512 리사이즈 확인
- [ ] 이미지 삭제 후 기본 이모지 표시 확인

### 3. 계정 찾기 테스트
- [ ] 이메일 찾기 (이름 + 전화번호) → 마스킹된 이메일 확인
- [ ] 비밀번호 재설정 코드 이메일 수신 확인
- [ ] 코드 5분 만료 확인
- [ ] 잘못된 코드 5회 입력 시 차단 확인
- [ ] 비밀번호 재설정 성공 → 로그인 확인

### 4. 비밀번호 변경 테스트
- [ ] 현재 비밀번호 틀린 경우 차단 확인
- [ ] 새 비밀번호 = 현재 비밀번호인 경우 차단 확인
- [ ] 소셜 로그인 사용자 안내 메시지 확인
- [ ] 비밀번호 변경 후 로그인 확인

### 5. 프로필 수정 테스트
- [ ] 이메일, 계정 유형 수정 불가 확인
- [ ] 이름, 전화번호, 생년월일, 성별 수정 확인
- [ ] 전화번호 중복 시 오류 확인
- [ ] 만 14세 미만 생년월일 차단 확인

### 6. 계정 삭제 테스트
- [ ] 이메일 로그인: 비밀번호 확인 프롬프트 표시
- [ ] 소셜 로그인: 즉시 삭제 확인
- [ ] Soft Delete 확인 (DB에서 `is_active=False`, `deleted_at` 설정)
- [ ] 이메일, 이름, 전화번호 익명화 확인
- [ ] 프로필 이미지 파일 삭제 확인
- [ ] 30일 복구 안내 메시지 확인

---

## 📝 향후 개선 사항

### 1. AWS S3 마이그레이션
- 로컬 파일시스템 → AWS S3로 이미지 저장소 변경
- `backend/app/utils/image.py`의 `save_profile_image()` 및 `delete_profile_image()` 수정
- `backend/app/config.py`에 S3 설정 추가

### 2. 계정 복구 기능
- 30일 이내 재로그인 시 계정 복구 옵션 제공
- `deleted_at`과 현재 시간 비교
- 복구 시 `is_active=True`, `deleted_at=None`, 익명화 데이터 복원 불가 안내

### 3. 프로필 이미지 최적화
- 썸네일 생성 (128x128)
- WebP 형식 지원
- 이미지 CDN 연동

### 4. 비밀번호 정책 강화
- 영문, 숫자, 특수문자 조합 필수
- 최소 8자 이상 권장
- 비밀번호 강도 표시

### 5. 계정 삭제 개선
- 삭제 사유 수집 및 분석
- 관리자 승인 프로세스 (옵션)
- 삭제 전 데이터 백업 다운로드 제공

---

## 🐛 알려진 이슈

1. **이미지 업로드 진행률 표시 없음**
   - 해결 방안: `FormData` 업로드 진행률 추적 구현

2. **Alert.prompt() iOS 전용**
   - 문제: Android에서는 `Alert.prompt()` 미지원
   - 해결 방안: 커스텀 모달 다이얼로그 구현 필요

3. **프로필 이미지 캐싱 문제**
   - 문제: 이미지 업데이트 후 캐시된 이전 이미지 표시
   - 해결 방안: 이미지 URL에 타임스탬프 쿼리 파라미터 추가

---

## 📞 문의 및 지원

구현 관련 문의사항이나 버그 리포트는 팀 채널로 연락 주세요.

---

## ✅ 체크리스트

- [x] 백엔드 API 구현 완료
- [x] 데이터베이스 마이그레이션 작성 완료
- [x] 프론트엔드 화면 구현 완료
- [x] 유효성 검사 로직 구현 완료
- [x] 이미지 처리 유틸리티 구현 완료
- [ ] 데이터베이스 마이그레이션 적용 (로컬 환경 실행 필요)
- [ ] 통합 테스트 진행
- [ ] UI/UX 검토
- [ ] 코드 리뷰
- [ ] QA 테스트

