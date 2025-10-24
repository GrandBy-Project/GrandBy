# 📱 푸시 알림 시스템 구현 완료

## 📋 구현 개요

**목적**: Expo 기반 백그라운드 푸시 알림 시스템 구현  
**날짜**: 2025-10-23  
**상태**: ✅ 완료

---

## 🎯 구현된 알림 시나리오

### 1️⃣ TODO 관련 알림
- ✅ **TODO 10분 전 리마인더**: 시작 시간 10분 전 어르신에게 알림
- ✅ **오늘 미완료 TODO 알림**: 매일 밤 9시에 미완료 TODO가 있으면 어르신에게 알림
- ✅ **새 TODO 생성 알림**: 보호자가 TODO를 추가하면 어르신에게 즉시 알림

### 2️⃣ 다이어리 관련 알림
- ✅ **다이어리 자동 생성 알림**: AI가 일기를 생성하면 보호자에게 알림

### 3️⃣ AI 전화 관련 알림
- ✅ **AI 전화 완료 알림**: 통화 완료 후 보호자에게 알림

### 4️⃣ 연결 관리 알림
- ✅ **연결 요청 알림**: 보호자가 연결을 요청하면 어르신에게 알림
- ✅ **연결 수락 알림**: 어르신이 수락하면 보호자에게 알림

---

## 🏗️ 구현된 파일 및 변경사항

### 1. 데이터베이스 모델 업데이트

#### `backend/app/models/user.py`
```python
class UserSettings(Base):
    # 기존
    push_notification_enabled = Column(Boolean, default=True)
    
    # 새로 추가된 세부 설정
    push_todo_reminder_enabled = Column(Boolean, default=True)  # TODO 10분 전 리마인더
    push_todo_incomplete_enabled = Column(Boolean, default=True)  # 미완료 TODO 알림
    push_todo_created_enabled = Column(Boolean, default=True)  # 새 TODO 생성 알림
    push_diary_enabled = Column(Boolean, default=True)  # 다이어리 생성 알림
    push_call_enabled = Column(Boolean, default=True)  # AI 전화 알림
    push_connection_enabled = Column(Boolean, default=True)  # 연결 요청/수락 알림
```

### 2. Pydantic 스키마 추가

#### `backend/app/schemas/user.py`
- `UserSettingsUpdate`: 설정 업데이트용
- `UserSettingsResponse`: 설정 조회 응답용
- `PushTokenUpdate`: 푸시 토큰 업데이트용

### 3. 푸시 알림 서비스

#### 🆕 `backend/app/services/notification_service.py`
**주요 기능:**
- ✅ Expo Push Notification API 연동
- ✅ 사용자별 알림 설정 확인
- ✅ 알림 유형별 전송 함수
  - `notify_todo_reminder()`: TODO 리마인더
  - `notify_todo_incomplete()`: 미완료 TODO
  - `notify_todo_created()`: 새 TODO 생성
  - `notify_diary_created()`: 다이어리 생성
  - `notify_call_completed()`: AI 전화 완료
  - `notify_connection_request()`: 연결 요청
  - `notify_connection_accepted()`: 연결 수락

### 4. Celery 태스크 업데이트

#### `backend/app/tasks/notification_sender.py`
```python
# 추가된 태스크
- send_push_notification_task()  # 푸시 알림 비동기 전송
- send_batch_notifications()  # 배치 알림 전송
```

#### `backend/app/tasks/todo_scheduler.py`
```python
# 구현 완료
- send_todo_reminders()  # 10분 전 리마인더 (10분마다 실행)
- check_overdue_todos()  # 미완료 TODO 체크 (매일 밤 9시)
```

#### `backend/app/tasks/diary_generator.py`
- 다이어리 생성 시 보호자들에게 알림 전송 추가
- AI 전화 완료 알림 추가

### 5. Celery Beat 스케줄 업데이트

#### `backend/app/tasks/celery_app.py`
```python
"send-todo-reminders": {
    "task": "app.tasks.todo_scheduler.send_todo_reminders",
    "schedule": crontab(minute="*/10"),  # 30분 → 10분으로 변경
},
```

### 6. API 라우터 업데이트

#### `backend/app/routers/todos.py`
- ✅ TODO 생성 시 어르신에게 알림 전송

#### `backend/app/routers/users.py`
- ✅ 연결 요청 생성 시 어르신에게 알림 전송
- ✅ 연결 수락 시 보호자에게 알림 전송
- ✅ **새 API 추가:**
  - `PUT /api/users/push-token`: 푸시 토큰 업데이트
  - `GET /api/users/settings`: 사용자 설정 조회
  - `PUT /api/users/settings`: 사용자 설정 업데이트

### 7. 마이그레이션 파일

#### 🆕 `backend/migrations/versions/20251023_0000-add_push_notification_detail_settings.py`
- UserSettings 테이블에 6개의 푸시 알림 세부 설정 컬럼 추가

---

## 🚀 배포 및 테스트 가이드

### 1. Docker Compose로 전체 서비스 실행

#### ✅ 백엔드 + Celery + Redis + PostgreSQL 모두 Docker로 실행

```bash
# 프로젝트 루트에서
docker-compose up -d
```

이 명령으로 다음 서비스가 모두 실행됩니다:
- 🐘 PostgreSQL (데이터베이스)
- 🔴 Redis (Celery 브로커)
- 🚀 FastAPI 백엔드
- 👷 Celery Worker
- ⏰ Celery Beat (스케줄러)

### 2. 데이터베이스 마이그레이션 실행

```bash
# Docker 컨테이너 내에서 마이그레이션 실행
docker-compose exec backend alembic upgrade head
```

### 3. 서비스 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f backend
docker-compose logs -f celery_worker
docker-compose logs -f celery_beat
```

### 3. 프론트엔드에서 푸시 토큰 등록

#### 앱 시작 시 (App.tsx 또는 home.tsx)
```typescript
import * as Notifications from 'expo-notifications';
import api from './src/api/client';

// 푸시 토큰 등록
async function registerPushToken() {
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: '8c549577-e069-461c-807f-3f64d823fe74'
  });
  
  // 백엔드로 토큰 전송
  await api.put('/users/push-token', {
    push_token: token.data
  });
}
```

### 4. 프론트엔드 알림 수신 리스너

```typescript
// 앱 내에서 알림 수신
Notifications.addNotificationReceivedListener(notification => {
  console.log('Notification received:', notification);
});

// 알림 탭 시
Notifications.addNotificationResponseReceivedListener(response => {
  const { notification_id, type, related_id } = response.notification.request.content.data;
  
  // 알림 타입에 따라 화면 이동
  switch(type) {
    case 'todo_reminder':
      navigation.navigate('TodoDetail', { id: related_id });
      break;
    case 'diary_created':
      navigation.navigate('DiaryDetail', { id: related_id });
      break;
    case 'connection_request':
      navigation.navigate('Connections');
      break;
  }
});
```

---

## 🧪 테스트 방법

### 1. TODO 10분 전 리마인더 테스트

1. 보호자 계정으로 로그인
2. 현재 시간 기준 10-20분 후 시작 시간의 TODO 생성
3. 10분 기다리거나 Celery Beat 스케줄 강제 실행
4. 어르신 기기에서 알림 수신 확인

```bash
# Docker에서 Celery Task 수동 실행
docker-compose exec celery_worker python -c "from app.tasks.todo_scheduler import send_todo_reminders; send_todo_reminders()"
```

### 2. 새 TODO 생성 알림 테스트

1. 보호자 계정으로 새 TODO 생성
2. 어르신 기기에서 즉시 알림 수신 확인

### 3. 연결 요청/수락 알림 테스트

1. 보호자 계정으로 어르신에게 연결 요청
2. 어르신 기기에서 알림 확인
3. 어르신 계정으로 수락
4. 보호자 기기에서 알림 확인

### 4. 미완료 TODO 알림 테스트

1. 오늘 날짜의 PENDING 상태 TODO 생성
2. 시스템 시간을 밤 9시로 변경하거나 스케줄 수동 실행
3. 어르신 기기에서 알림 확인

```bash
# Docker에서 수동 실행
docker-compose exec celery_worker python -c "from app.tasks.todo_scheduler import check_overdue_todos; check_overdue_todos()"
```

---

## 📊 알림 우선순위

모든 알림은 **일반 우선순위(default)**로 설정:
- 🔔 소리 + 알림 표시
- 📱 배너 표시
- ⚡ 진동

---

## 🔧 사용자 설정 API

### 설정 조회
```http
GET /api/users/settings
Authorization: Bearer {token}
```

### 설정 업데이트
```http
PUT /api/users/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "push_notification_enabled": true,
  "push_todo_reminder_enabled": true,
  "push_todo_incomplete_enabled": false,
  "push_todo_created_enabled": true,
  "push_diary_enabled": true,
  "push_call_enabled": true,
  "push_connection_enabled": true
}
```

### 푸시 토큰 업데이트
```http
PUT /api/users/push-token
Authorization: Bearer {token}
Content-Type: application/json

{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

---

## 📝 주의사항

1. **실제 기기 필요**: 시뮬레이터/에뮬레이터에서는 푸시 알림 작동 안 함
2. **EAS Build 필수**: `app.json`에 `expo-notifications` 플러그인 추가 후 빌드 필요
3. **푸시 토큰 갱신**: 앱 시작 시마다 토큰을 백엔드로 전송
4. **Celery 실행**: 알림이 작동하려면 Celery Worker + Beat 실행 필수
5. **DB 마이그레이션**: 배포 전 반드시 마이그레이션 실행

---

## 🎉 구현 완료 체크리스트

- [x] UserSettings 모델에 알림 종류별 on/off 컬럼 추가
- [x] 푸시 알림 서비스 생성 (NotificationService)
- [x] notification_sender.py 완전 구현
- [x] todo_scheduler.py TODO 리마인더 구현 (10분 전)
- [x] 각 라우터에서 알림 트리거 추가
- [x] Celery Beat 스케줄 업데이트 (10분마다 체크)
- [x] requirements.txt 패키지 확인 (httpx 있음)
- [x] DB 마이그레이션 파일 생성
- [x] 푸시 토큰 업데이트 API 추가
- [x] 사용자 설정 조회/업데이트 API 추가

---

## 📞 문제 해결

### 알림이 오지 않는 경우

1. **푸시 토큰 확인**
   ```sql
   SELECT user_id, push_token, push_token_updated_at 
   FROM users 
   WHERE user_id = 'xxx';
   ```

2. **사용자 설정 확인**
   ```sql
   SELECT * FROM user_settings WHERE user_id = 'xxx';
   ```

3. **Celery 로그 확인**
   ```bash
   # Worker 로그
   docker-compose logs -f celery_worker
   
   # Beat 로그
   docker-compose logs -f celery_beat
   
   # 실시간 로그 (전체)
   docker-compose logs -f
   ```

4. **알림 히스토리 확인**
   ```sql
   SELECT * FROM notifications 
   WHERE user_id = 'xxx' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

---

## 🔗 관련 문서

- [Expo Notifications 공식 문서](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notifications 가이드](https://docs.expo.dev/push-notifications/overview/)
- [Celery Beat 공식 문서](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html)

---

**작성자**: AI Assistant  
**작성일**: 2025-10-23

