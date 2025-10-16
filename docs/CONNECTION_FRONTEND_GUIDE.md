# 🎨 연결 기능 프론트엔드 구현 가이드

> GuardianHomeScreen과 ElderlyHomeScreen 연결 기능 추가

---

## 📋 구현 현황

### ✅ 완료
- [x] 백엔드 API 7개 (검색, 생성, 조회, 수락, 거절, 취소, 해제)
- [x] 백엔드 알림 API 3개
- [x] 프론트 API 클라이언트 (`src/api/connections.ts`, `src/api/notifications.ts`)
- [x] import 추가 (`GuardianHomeScreen.tsx`)
- [x] state 추가 (모달, 검색 관련)
- [x] 버튼 동작 변경 (Alert → 모달 오픈)

### 🔄 진행 중
- [ ] 어르신 검색/추가 모달 컴포넌트
- [ ] 연결 목록 API 연동
- [ ] 어르신 홈 화면 알림 배너

---

## 🛠️ GuardianHomeScreen 수정 사항

### **1. State 추가** ✅

```typescript
// 이미 추가됨
const [showAddElderlyModal, setShowAddElderlyModal] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<connectionsApi.ElderlySearchResult[]>([]);
const [isSearching, setIsSearching] = useState(false);
const [isConnecting, setIsConnecting] = useState(false);
```

### **2. 검색 함수 추가 필요**

`loadTodosForElderly` 함수 다음에 추가:

```typescript
// 어르신 검색
const handleSearchElderly = async () => {
  if (!searchQuery.trim()) {
    Alert.alert('알림', '이메일 또는 전화번호를 입력해주세요.');
    return;
  }

  setIsSearching(true);
  try {
    const results = await connectionsApi.searchElderly(searchQuery);
    setSearchResults(results);
    
    if (results.length === 0) {
      Alert.alert('알림', '검색 결과가 없습니다.');
    }
  } catch (error: any) {
    console.error('검색 실패:', error);
    Alert.alert('오류', error.response?.data?.detail || '검색에 실패했습니다.');
  } finally {
    setIsSearching(false);
  }
};

// 연결 요청 전송
const handleSendConnectionRequest = async (elderly: connectionsApi.ElderlySearchResult) => {
  // 이미 연결된 경우
  if (elderly.is_already_connected) {
    const statusText = 
      elderly.connection_status === 'active' ? '이미 연결되어 있습니다.' :
      elderly.connection_status === 'pending' ? '연결 수락 대기 중입니다.' :
      '연결 요청이 거절되었습니다.';
    
    Alert.alert('알림', statusText);
    return;
  }

  Alert.alert(
    '연결 요청',
    `${elderly.name}님에게 연결 요청을 보내시겠습니까?`,
    [
      { text: '취소', style: 'cancel' },
      {
        text: '요청',
        onPress: async () => {
          setIsConnecting(true);
          try {
            await connectionsApi.createConnection(elderly.email);
            
            Alert.alert(
              '성공',
              `${elderly.name}님에게 연결 요청을 보냈습니다.\n어르신이 수락하면 연결됩니다.`,
              [
                {
                  text: '확인',
                  onPress: () => {
                    setShowAddElderlyModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }
                }
              ]
            );
          } catch (error: any) {
            console.error('연결 요청 실패:', error);
            Alert.alert('오류', error.response?.data?.detail || '연결 요청에 실패했습니다.');
          } finally {
            setIsConnecting(false);
          }
        }
      }
    ]
  );
};
```

### **3. 모달 컴포넌트 추가 필요**

`return` 문 끝 부분 (TODO 수정 모달 다음)에 추가:

```tsx
{/* 어르신 추가 모달 */}
<Modal
  visible={showAddElderlyModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowAddElderlyModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.editModalContent}>
      {/* 헤더 */}
      <View style={styles.editModalHeader}>
        <Text style={styles.editModalTitle}>어르신 추가하기</Text>
        <TouchableOpacity onPress={() => {
          setShowAddElderlyModal(false);
          setSearchQuery('');
          setSearchResults([]);
        }}>
          <Text style={styles.closeButton}>×</Text>
        </TouchableOpacity>
      </View>

      {/* 검색 입력 */}
      <View style={styles.editModalBody}>
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>이메일 또는 전화번호</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="예: elderly@example.com 또는 010-1234-5678"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[styles.modalActionButton, styles.editButton, { flex: 0, paddingHorizontal: 20 }]}
              onPress={handleSearchElderly}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.editButtonText}>검색</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <ScrollView style={{ maxHeight: 300 }}>
            {searchResults.map((elderly) => (
              <View
                key={elderly.user_id}
                style={{
                  backgroundColor: '#F8F9FA',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: elderly.is_already_connected ? '#E0E0E0' : '#34B79F',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 4 }}>
                      👵 {elderly.name}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 2 }}>
                      📧 {elderly.email}
                    </Text>
                    {elderly.phone_number && (
                      <Text style={{ fontSize: 14, color: '#666' }}>
                        📞 {elderly.phone_number}
                      </Text>
                    )}
                  </View>

                  {/* 연결 버튼 */}
                  <TouchableOpacity
                    style={[
                      styles.modalActionButton,
                      elderly.is_already_connected ? styles.cancelButton : styles.editButton,
                      { paddingHorizontal: 16, paddingVertical: 10 }
                    ]}
                    onPress={() => handleSendConnectionRequest(elderly)}
                    disabled={isConnecting || (elderly.is_already_connected && elderly.connection_status !== 'rejected')}
                  >
                    <Text style={elderly.is_already_connected ? styles.cancelButtonText : styles.editButtonText}>
                      {elderly.is_already_connected
                        ? (elderly.connection_status === 'active' ? '연결됨' :
                           elderly.connection_status === 'pending' ? '대기중' : '거절됨')
                        : '연결 요청'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 안내 문구 */}
        {!isSearching && searchResults.length === 0 && searchQuery.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#999', textAlign: 'center', lineHeight: 24 }}>
              어르신의 이메일 또는 전화번호를{'\n'}
              입력하고 검색해주세요
            </Text>
          </View>
        )}
      </View>
    </View>
  </View>
</Modal>
```

### **4. 버튼 위치**

- **237줄**: "어르신 추가하기" 버튼 ✅ (수정 완료)
- **254줄**: 연결된 어르신 없을 때 카드 ✅ (수정 완료)

---

## 🎯 ElderlyHomeScreen 알림 배너

### **추가할 위치**

`ElderlyHomeScreen.tsx`의 Header 바로 아래

### **구현 내용**

```typescript
// State 추가
const [notifications, setNotifications] = useState<Notification[]>([]);
const [pendingConnections, setPendingConnections] = useState<any[]>([]);

// 알림 로드
useEffect(() => {
  loadNotifications();
}, []);

const loadNotifications = async () => {
  try {
    const data = await notificationsApi.getNotifications();
    const connectionRequests = data.filter(
      n => n.type === 'CONNECTION_REQUEST' && !n.is_read
    );
    setNotifications(connectionRequests);
    
    // 연결 요청 정보도 가져오기
    const connections = await connectionsApi.getConnections();
    setPendingConnections(connections.pending);
  } catch (error) {
    console.error('알림 로드 실패:', error);
  }
};

// 알림 배너 컴포넌트
{pendingConnections.length > 0 && (
  <TouchableOpacity
    style={styles.notificationBanner}
    onPress={() => setShowConnectionRequestModal(true)}
  >
    <View style={styles.bannerContent}>
      <Text style={styles.bannerIcon}>🔔</Text>
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>
          새로운 연결 요청 ({pendingConnections.length})
        </Text>
        <Text style={styles.bannerSubtitle}>
          {pendingConnections[0].name}님이 연결을 요청했습니다
        </Text>
      </View>
      <Text style={styles.bannerArrow}>›</Text>
    </View>
  </TouchableOpacity>
)}
```

### **스타일 추가**

```typescript
notificationBanner: {
  backgroundColor: '#FFF4E6',
  borderRadius: 12,
  padding: 16,
  marginHorizontal: 20,
  marginTop: 16,
  marginBottom: 8,
  borderLeftWidth: 4,
  borderLeftColor: '#FF9500',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
},
bannerContent: {
  flexDirection: 'row',
  alignItems: 'center',
},
bannerIcon: {
  fontSize: 24,
  marginRight: 12,
},
bannerText: {
  flex: 1,
},
bannerTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  marginBottom: 4,
},
bannerSubtitle: {
  fontSize: 14,
  color: '#666',
},
bannerArrow: {
  fontSize: 24,
  color: '#999',
},
```

---

## 📝 구현 단계

### **Phase 1: 백엔드 테스트** (현재 가능)

```bash
# 1. 시드 데이터 확인
docker exec grandby_postgres psql -U grandby -d grandby_db -c "SELECT * FROM user_connections;"
docker exec grandby_postgres psql -U grandby -d grandby_db -c "SELECT * FROM notifications WHERE type='CONNECTION_REQUEST';"

# 2. Swagger UI에서 API 테스트
http://localhost:8000/docs

# 테스트 순서:
1. POST /api/auth/login (보호자: test2@test.com)
2. GET /api/users/search?query=test1@test.com
3. POST /api/users/connections ({"elderly_phone_or_email": "test1@test.com"})
4. POST /api/auth/login (어르신: test1@test.com)
5. GET /api/users/connections (pending에 요청 보임)
6. PATCH /api/users/connections/{id}/accept
7. POST /api/auth/login (보호자 다시)
8. GET /api/notifications/ (수락 알림 확인)
```

### **Phase 2: 프론트엔드 작업**

#### **GuardianHomeScreen.tsx 수정**

**위치**: 569줄 `loadTodosForElderly` 함수 다음

**추가할 함수**:
```typescript
// 어르신 검색 함수
const handleSearchElderly = async () => { ... }

// 연결 요청 전송 함수
const handleSendConnectionRequest = async (elderly) => { ... }
```

**위치**: return 문 끝 (TODO 수정 모달 다음)

**추가할 모달**:
```tsx
{/* 어르신 추가 모달 */}
<Modal visible={showAddElderlyModal} ...>
  ...
</Modal>
```

#### **ElderlyHomeScreen.tsx 수정**

**위치**: Header 바로 아래

**추가할 배너**:
```tsx
{pendingConnections.length > 0 && (
  <TouchableOpacity style={styles.notificationBanner} ...>
    ...
  </TouchableOpacity>
)}
```

**추가할 모달**:
```tsx
{/* 연결 요청 수락/거절 모달 */}
<Modal visible={showConnectionRequestModal} ...>
  ...
</Modal>
```

---

## 🎨 디자인 시스템 (기존 스타일 활용)

### **색상**
- 메인: `#34B79F` (초록)
- 배경: `#F8F9FA`
- 텍스트: `#333333`, `#666666`, `#999999`
- 경고/삭제: `#FF3B30`
- 알림: `#FF9500` (주황)

### **공통 스타일**
- Card: `borderRadius: 16`, `padding: 20`
- 버튼: `borderRadius: 8`, `padding: 14`
- 모달: `modalOverlay`, `editModalContent`

---

## 📱 완성된 화면 구성

### **보호자 - 어르신 추가 모달**

```
┌────────────────────────────────────┐
│ 어르신 추가하기              [×]   │
├────────────────────────────────────┤
│                                    │
│ 이메일 또는 전화번호               │
│ ┌──────────────────┐  ┌────────┐  │
│ │ test1@test.com   │  │ 검색   │  │
│ └──────────────────┘  └────────┘  │
│                                    │
│ 검색 결과:                         │
│ ┌────────────────────────────────┐ │
│ │ 👵 테르신                      │ │
│ │ 📧 test1@test.com             │ │
│ │ 📞 010-1234-5678              │ │
│ │                   [연결 요청]  │ │
│ └────────────────────────────────┘ │
│                                    │
└────────────────────────────────────┘
```

### **어르신 - 연결 요청 알림 배너**

```
┌────────────────────────────────────┐
│ Header                             │
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │ 🔔 새로운 연결 요청 (1)        │ │
│ │ 테호자님이 연결을 요청했습니다  │ │
│ │                              › │ │
│ └────────────────────────────────┘ │
│                                    │
│ 오늘 할 일 ...                     │
└────────────────────────────────────┘
```

### **어르신 - 연결 요청 수락 모달**

```
┌────────────────────────────────────┐
│ 연결 요청                    [×]   │
├────────────────────────────────────┤
│                                    │
│        👨‍💼                          │
│      테호자님이                     │
│    연결을 요청했습니다              │
│                                    │
│ 📧 test2@test.com                 │
│ 📞 010-8765-4321                  │
│                                    │
│ ℹ️ 연결하시면 다음을 공유합니다:    │
│ • 할일 관리                        │
│ • 일기 열람                        │
│ • 건강 정보                        │
│                                    │
│ ┌──────────┐  ┌──────────┐        │
│ │   수락   │  │   거절   │        │
│ └──────────┘  └──────────┘        │
└────────────────────────────────────┘
```

---

## 🚀 다음 단계

1. ✅ 백엔드 API 완료 및 푸시
2. 🔄 프론트엔드 함수 추가 (가이드 참조)
3. 🔄 모달 컴포넌트 추가 (가이드 참조)
4. ⏳ 통합 테스트
5. ⏳ PR 생성

---

## 💡 빠른 테스트 방법

### **Swagger UI로 먼저 테스트**

http://localhost:8000/docs

1. `/api/auth/login` - test2@test.com (보호자)
2. Authorize 버튼 클릭 → 받은 access_token 입력
3. `/api/users/search?query=test1` - 어르신 검색
4. `/api/users/connections` - 연결 요청
5. 로그아웃 → test1@test.com (어르신) 로그인
6. `/api/users/connections` - pending 확인
7. `/api/users/connections/{id}/accept` - 수락

### **완성 후 프론트에서 테스트**

앱에서 직접 테스트하면 됩니다!

---

**작성일**: 2025-10-17
**백엔드**: 완료 ✅
**프론트**: 진행 중 🔄



