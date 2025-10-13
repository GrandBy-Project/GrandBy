# 자동 로그인 정책

## 🔐 토큰 관리 전략

### 1. 슬라이딩 윈도우 방식 (Sliding Window)

사용자가 로그아웃하지 않는 한 **무기한 로그인 유지**를 위해 슬라이딩 윈도우 방식을 사용합니다.

```
[일반적인 고정 만료 방식] ❌
로그인 ──────────────────────────> 7일 후 강제 로그아웃
        (7일 고정)

[슬라이딩 윈도우 방식] ✅
로그인 ──> 앱 실행 ──> 앱 실행 ──> 앱 실행 ──> 계속 유지
        +7일     +7일     +7일     +7일
```

### 2. 토큰 구조

#### Access Token (짧은 수명)
- **만료 시간**: 30분
- **용도**: API 요청 인증
- **저장 위치**: AsyncStorage (메모리)
- **갱신**: Refresh Token으로 자동 갱신

#### Refresh Token (긴 수명 + 슬라이딩)
- **만료 시간**: 7일 (초기)
- **슬라이딩**: 앱 실행 시마다 +7일 연장
- **최대 만료**: 없음 (사용자가 로그아웃할 때까지)
- **저장 위치**: AsyncStorage (암호화)

#### Device ID
- **만료 시간**: 영구
- **용도**: 기기 식별, 보안 검증
- **저장 위치**: AsyncStorage

---

## 🔄 자동 로그인 플로우

### 1. 앱 시작 시 (스플래쉬 스크린)

```typescript
async function autoLogin() {
  // 1. AsyncStorage에서 토큰 읽기
  const tokens = await AsyncStorage.getItem('auth_tokens');
  
  if (!tokens) {
    // 토큰 없음 → 로그인 페이지
    return { success: false };
  }
  
  // 2. Access Token 만료 확인
  const now = Date.now();
  if (tokens.access_expires_at > now) {
    // Access Token 유효 → 사용자 정보 로드
    const user = await api.get('/auth/me');
    return { success: true, user };
  }
  
  // 3. Access Token 만료 → Refresh Token으로 갱신
  if (tokens.refresh_expires_at > now) {
    try {
      // 새로운 토큰 발급 (슬라이딩 적용)
      const newTokens = await api.post('/auth/refresh', {
        refresh_token: tokens.refresh_token
      });
      
      // 4. 새 토큰 저장 (Refresh Token 만료 시간 +7일 연장)
      await AsyncStorage.setItem('auth_tokens', {
        access_token: newTokens.access_token,
        access_expires_at: Date.now() + 30 * 60 * 1000, // +30분
        refresh_token: newTokens.refresh_token,
        refresh_expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // +7일
      });
      
      // 5. 사용자 정보 로드
      const user = await api.get('/auth/me');
      return { success: true, user };
    } catch (error) {
      // 갱신 실패 → 로그아웃
      await AsyncStorage.clear();
      return { success: false };
    }
  }
  
  // 6. Refresh Token도 만료 → 로그아웃
  await AsyncStorage.clear();
  return { success: false };
}
```

### 2. API 요청 시 (자동 갱신)

```typescript
// Axios 인터셉터
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 401 에러 (토큰 만료)
    if (error.response?.status === 401) {
      const originalRequest = error.config;
      
      // 재시도 플래그 확인 (무한 루프 방지)
      if (originalRequest._retry) {
        // 로그아웃 처리
        await AsyncStorage.clear();
        throw error;
      }
      
      originalRequest._retry = true;
      
      // Refresh Token으로 갱신
      const tokens = await AsyncStorage.getItem('auth_tokens');
      const newTokens = await api.post('/auth/refresh', {
        refresh_token: tokens.refresh_token
      });
      
      // 새 토큰 저장 (슬라이딩)
      await AsyncStorage.setItem('auth_tokens', {
        ...newTokens,
        refresh_expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000
      });
      
      // 원래 요청 재시도
      originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
      return apiClient(originalRequest);
    }
    
    throw error;
  }
);
```

---

## 🛡️ 보안 고려사항

### 1. Refresh Token 보안

```typescript
// AsyncStorage에 암호화하여 저장
import * as SecureStore from 'expo-secure-store';

// 저장
await SecureStore.setItemAsync('refresh_token', token);

// 읽기
const token = await SecureStore.getItemAsync('refresh_token');
```

### 2. Device ID 검증

```typescript
// 백엔드에서 Device ID 검증
async function verifyDevice(userId: string, deviceId: string) {
  // Redis에 저장된 기기 목록 확인
  const devices = await redis.get(`user:${userId}:devices`);
  
  if (!devices.includes(deviceId)) {
    // 새 기기 → 알림 발송 + 인증 필요
    throw new Error('새로운 기기에서 로그인 시도');
  }
}
```

### 3. 동시 로그인 제한

```typescript
// 한 계정당 최대 3개 기기
const MAX_DEVICES = 3;

if (devices.length >= MAX_DEVICES) {
  // 가장 오래된 기기 로그아웃
  const oldestDevice = devices[0];
  await redis.del(`device:${oldestDevice}:tokens`);
}
```

---

## 📊 시나리오별 동작

### 시나리오 1: 매일 앱 사용
```
Day 1: 로그인 (Refresh Token 만료: Day 8)
Day 2: 앱 실행 (Refresh Token 만료: Day 9로 연장)
Day 3: 앱 실행 (Refresh Token 만료: Day 10으로 연장)
Day 4: 앱 실행 (Refresh Token 만료: Day 11로 연장)
...
Day 100: 앱 실행 (여전히 로그인 상태 유지)
```

### 시나리오 2: 7일 이상 미사용
```
Day 1: 로그인 (Refresh Token 만료: Day 8)
Day 2-7: 앱 미사용
Day 8: 앱 실행 → Refresh Token 만료 → 자동 로그아웃
```

### 시나리오 3: 사용자가 직접 로그아웃
```
Day 1: 로그인
Day 3: 로그아웃 버튼 클릭
→ 모든 토큰 삭제
→ 로그인 페이지로 이동
```

### 시나리오 4: 다른 기기에서 로그인
```
Device A: 로그인 중
Device B: 로그인 시도
→ Device A에 알림: "새 기기에서 로그인됨"
→ 둘 다 로그인 유지 (최대 3개 기기)
```

---

## 🔧 백엔드 구현

### 1. Refresh Token 엔드포인트

```python
@router.post("/auth/refresh")
async def refresh_token(
    refresh_token: str,
    device_id: str,
    db: Session = Depends(get_db)
):
    # 1. Refresh Token 검증
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(401, "Invalid refresh token")
    
    # 2. 사용자 확인
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    
    # 3. Device ID 검증 (선택)
    await verify_device(user_id, device_id)
    
    # 4. 새 토큰 발급 (슬라이딩)
    new_access_token = create_access_token({
        "sub": user_id,
        "role": user.role
    })
    
    new_refresh_token = create_refresh_token({
        "sub": user_id
    })
    
    # 5. 마지막 활동 시간 업데이트
    await redis.set(f"user:{user_id}:last_active", datetime.now())
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "expires_in": 1800  # 30분
    }
```

---

## 🎯 요약

| 항목 | 값 |
|------|-----|
| **Access Token 만료** | 30분 (고정) |
| **Refresh Token 초기 만료** | 7일 |
| **슬라이딩 방식** | 앱 실행 시마다 +7일 |
| **최대 로그인 유지** | 무제한 (사용자가 로그아웃할 때까지) |
| **7일 미사용 시** | 자동 로그아웃 |
| **최대 동시 기기** | 3개 |
| **로그인 실패 제한** | 10회 / 15분 잠금 |

**결론**: 사용자가 정기적으로 앱을 사용하는 한 **영구적으로 로그인 상태 유지**됩니다! ✅

