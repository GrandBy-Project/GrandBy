# 📱 일기 TODO 추천 기능 사용 가이드

## ✨ 구현 완료 기능

### 1. **일기에서 TODO 자동 감지 및 추천**
- AI 통화 후 자동 생성된 일기에서 할 일 감지
- 일기 상세 화면에서 감지된 할 일 목록 표시
- 체크박스로 선택 후 할 일에 추가

### 2. **AI 생성 TODO 시각적 구분**
- AI가 자동으로 생성한 TODO는 **민트색 배경**으로 표시
- 우측 상단에 **"🤖 AI 자동 생성"** 배지 표시
- 보호자가 직접 추가한 TODO와 구분

---

## 📱 사용 방법

### 1단계: AI 전화 통화

```
1. 앱에서 "AI 전화" 버튼 클릭
2. 어르신과 AI가 대화
3. 대화 중 할 일 언급:
   "내일 병원 가야 해"
   "모레 약국에서 약 타러 가야지"
```

### 2단계: 자동 일기 생성

```
통화 종료
  ↓
백그라운드에서 자동으로 일기 생성
  ↓
일기 목록에 새 일기 표시 (AI 자동 생성 표시)
```

### 3단계: 일기 확인 및 TODO 추천

```
일기 목록 → 일기 클릭
  ↓
일기 내용 아래에 "📌 감지된 일정" 섹션 표시
  ↓
┌─────────────────────────────────────┐
│ 📌 감지된 일정                       │
│ 통화 중 언급된 할 일이 2개 발견됨    │
├─────────────────────────────────────┤
│ ☑ 병원 가기 [중요]                  │
│   📅 내일 14:00                     │
│   🏥 건강                           │
│                                     │
│ ☐ 약국에서 약 타오기                 │
│   📅 모레                           │
│   💊 건강                           │
├─────────────────────────────────────┤
│ [선택한 1개 할 일 추가]   👈 클릭   │
└─────────────────────────────────────┘
```

### 4단계: TODO 추가 완료

```
버튼 클릭
  ↓
✅ "1개의 할 일이 추가되었습니다" 알림
  ↓
할 일 화면으로 이동
  ↓
AI 생성 TODO 확인 (민트색 배경 + 배지)
```

---

## 🎨 UI 특징

### 감지된 TODO 카드

```
┌─────────────────────────────────────┐
│ [노란색 배경, 금색 테두리]            │
│                                     │
│ 📌 감지된 일정                       │
│ 통화 중 언급된 할 일이 N개 발견      │
│                                     │
│ ☑ TODO 항목 1 [우선순위 배지]       │
│   상세 설명                         │
│   📅 날짜  🏷️ 카테고리             │
│                                     │
│ ☐ TODO 항목 2                       │
│   ...                               │
│                                     │
│ [민트색 버튼: 선택한 N개 할 일 추가] │
└─────────────────────────────────────┘
```

### AI 생성 TODO (할 일 화면)

```
┌─────────────────────────────────────┐
│ [민트색 배경]          🤖 AI 자동 생성 │
│                                     │
│ 🏥  병원 가기                        │
│     내과 진료                        │
│     🕐 오후 2시                      │
│                                     │
│                          [완료] 버튼 │
└─────────────────────────────────────┘
```

### 보호자가 추가한 TODO

```
┌─────────────────────────────────────┐
│ [흰색 배경]                          │
│                                     │
│ 💊  약 복용하기                      │
│     아침 식사 후                     │
│     🕐 오전 9시                      │
│                                     │
│                          [완료] 버튼 │
└─────────────────────────────────────┘
```

---

## 🔧 구현된 파일

### 1. 타입 정의 (`src/types/index.ts`)

```typescript
export interface SuggestedTodo {
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'high' | 'medium' | 'low';
  category: string;
  elderly_id: string;
  creator_id: string;
  source: 'todo' | 'future_plan';
}
```

### 2. API 클라이언트 (`src/api/diary.ts`)

```typescript
// TODO 추천 조회
export const getSuggestedTodos = async (diaryId: string)

// TODO 등록
export const acceptSuggestedTodos = async (
  diaryId: string,
  selectedIndices: number[]
)
```

### 3. 컴포넌트 (`src/components/SuggestedTodoList.tsx`)

**기능:**
- TODO 추천 목록 로드
- 체크박스 선택/해제
- 등록 버튼 처리
- 로딩 상태 표시

**주요 기능:**
- 우선순위 배지 (높음=빨강, 보통=주황, 낮음=초록)
- 카테고리 이모지 자동 표시
- 날짜 포맷팅 (오늘, 내일, MM월 DD일)

### 4. 일기 상세 화면 (`src/screens/DiaryDetailScreen.tsx`)

**변경 사항:**
- `SuggestedTodoList` 컴포넌트 임포트
- AI 생성 일기인 경우에만 표시
- TODO 추가 완료 후 알림

### 5. TODO 목록 화면 (`src/screens/TodoListScreen.tsx`)

**변경 사항:**
- `creatorType` 필드 추가
- AI 생성 TODO 시각적 구분
  - 배경색: `#F0FFF8` (연한 민트)
  - 테두리: `#34B79F` (민트)
  - 배지: "🤖 AI 자동 생성"

---

## 🎨 색상 가이드

| 요소 | 색상 코드 | 설명 |
|------|----------|------|
| TODO 추천 배경 | `#FFF9E6` | 연한 노란색 |
| TODO 추천 테두리 | `#FFD700` | 금색 |
| 등록 버튼 | `#34B79F` | 민트색 |
| AI TODO 배경 | `#F0FFF8` | 연한 민트 |
| AI TODO 테두리 | `#34B79F` | 민트색 |
| AI 배지 배경 | `#34B79F` | 민트색 |
| 우선순위 높음 | `#FF5722` | 빨강 |
| 우선순위 보통 | `#FF9800` | 주황 |
| 우선순위 낮음 | `#4CAF50` | 초록 |

---

## 📱 테스트 시나리오

### 시나리오 1: 병원 예약

**통화:**
```
어르신: "내일 병원 가야 해. 오후 2시에 예약했어."
```

**예상 결과:**
```
일기 생성 → TODO 추천 표시
☑ 병원 가기
  📅 내일 14:00
  🏥 건강
  [중요] 배지
```

### 시나리오 2: 여러 일정

**통화:**
```
어르신: "내일 병원 가고, 모레는 약 타러 가야지. 
       다음주 월요일에 친구 만나기로 했어."
```

**예상 결과:**
```
일기 생성 → TODO 추천 3개 표시
☑ 병원 가기 (내일)
☐ 약국에서 약 타오기 (모레)
☐ 친구 만남 (다음주 월요일)
```

---

## 🐛 문제 해결

### 문제 1: TODO 추천이 표시되지 않음

**확인 사항:**
1. 일기가 AI 자동 생성인가? (`is_auto_generated: true`)
2. 통화 내용에 날짜 언급이 있었나?
3. 네트워크 연결 상태 확인
4. 백엔드 로그 확인 (Celery Worker)

**해결:**
```bash
# 백엔드 로그 확인
cd backend
celery -A app.tasks.celery_app worker --loglevel=info

# 로그에서 확인:
# "📋 TODO 감지: N개"
```

### 문제 2: AI 생성 TODO가 구분되지 않음

**확인 사항:**
1. `creator_type` 필드가 'ai'로 설정되었나?
2. 스타일이 제대로 적용되었나?

**디버깅:**
```typescript
// TodoListScreen.tsx에서
console.log('TODO:', todo);
console.log('creatorType:', todo.creatorType);
console.log('isAiGenerated:', todo.creatorType === 'ai');
```

### 문제 3: 등록 버튼을 눌러도 반응이 없음

**확인 사항:**
1. TODO가 선택되었나? (체크박스 체크)
2. 네트워크 요청이 성공했나?
3. 에러 로그 확인

**디버깅:**
```typescript
// SuggestedTodoList.tsx에서
console.log('Selected indices:', selectedIndices);
console.log('API Response:', response);
```

---

## 🚀 다음 단계

### Phase 1: 완료 ✅
- [x] TODO 추천 API 연동
- [x] SuggestedTodoList 컴포넌트
- [x] AI TODO 시각적 구분
- [x] 일기 상세 화면 통합

### Phase 2: 개선 (향후)
- [ ] TODO 수정 기능 (AI 생성 TODO도 수정 가능)
- [ ] TODO 삭제 확인 다이얼로그
- [ ] 보호자 화면에서도 AI TODO 확인
- [ ] 알림 기능 (TODO 추천 알림)

### Phase 3: 고도화 (향후)
- [ ] TODO 추천 거부 기능
- [ ] 추천 히스토리 관리
- [ ] 통계 (AI가 추천한 TODO 완료율 등)

---

## 📖 개발자 노트

### API 엔드포인트

```
GET  /api/diaries/{diary_id}/suggested-todos
POST /api/diaries/{diary_id}/accept-todos
```

### 컴포넌트 구조

```
DiaryDetailScreen
  └── SuggestedTodoList
        ├── loadSuggestedTodos() ← GET API
        ├── toggleTodo() ← 체크박스
        └── handleAccept() ← POST API
```

### 상태 관리

```typescript
const [todos, setTodos] = useState<SuggestedTodo[]>([]);
const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
const [accepting, setAccepting] = useState(false);
```

---

## 🎉 완성!

이제 다음 플로우가 완벽하게 작동합니다:

```
AI 통화
  ↓
자동 일기 생성
  ↓
TODO 자동 감지
  ↓
일기에서 TODO 추천
  ↓
사용자 선택
  ↓
할 일에 등록
  ↓
AI TODO 시각적 구분
```

**모든 기능이 앱에서 바로 테스트 가능합니다!** 🚀

