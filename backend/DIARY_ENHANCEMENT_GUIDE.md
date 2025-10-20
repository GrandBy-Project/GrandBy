# 📝 일기 생성 고도화 & TODO 자동 추천 가이드

## 🎯 구현된 기능

### 1. **고도화된 일기 생성**
- ✅ 통화 내용을 구조화하여 분석 (활동, 건강, 감정, 사회적 교류 등)
- ✅ 어르신의 최근 일기 스타일 학습
- ✅ 개인화된 자연스러운 일기 자동 생성
- ✅ 실제로 어르신이 직접 쓴 것처럼 자연스러운 문체

### 2. **TODO 자동 감지 및 추천**
- ✅ 통화 중 "~해야 해", "~가야 해" 등의 할 일 표현 감지
- ✅ 날짜 언급 자동 파싱 (내일, 모레, 월요일 등)
- ✅ 감지된 TODO를 사용자에게 추천
- ✅ 사용자 선택 후 실제 TODO 등록

---

## 📦 백엔드 구조

### 새로 추가된 파일

```
backend/app/services/diary/
├── __init__.py
├── conversation_analyzer.py      # 통화 내용 구조화 분석
├── personalized_diary_generator.py  # 개인화된 일기 생성
└── todo_extractor.py             # TODO 자동 감지 및 추출
```

### 수정된 파일

```
backend/app/tasks/diary_generator.py  # 전체 파이프라인 통합
backend/app/routers/diaries.py        # TODO 추천 API 엔드포인트 추가
```

---

## 🔄 데이터 플로우

```
1. AI 전화 통화
   ↓
2. CallTranscript 저장 (대화 내용)
   ↓
3. 통화 종료 후 Celery Task 실행
   ↓
4. ConversationAnalyzer: 통화 내용 구조화
   {
     activities: [...],
     health: {...},
     emotions: [...],
     future_plans: [...],
     todos: [...]  ⭐
   }
   ↓
5. PersonalizedDiaryGenerator: 일기 생성
   - 최근 일기 스타일 학습
   - 개인 정보 반영
   - 자연스러운 문체로 작성
   ↓
6. TodoExtractor: TODO 추출
   - future_plans + todos 통합
   - 날짜 파싱 및 우선순위 설정
   ↓
7. DB 저장
   - Diary 테이블에 일기 저장
   - TODO는 추천만 (실제 등록 X)
   ↓
8. 프론트엔드에서 TODO 추천 조회
   GET /api/diaries/{diary_id}/suggested-todos
   ↓
9. 사용자가 TODO 선택
   POST /api/diaries/{diary_id}/accept-todos
   ↓
10. Todo 테이블에 실제 등록
```

---

## 🔌 API 엔드포인트

### 1. 일기에서 감지된 TODO 추천 조회

```http
GET /api/diaries/{diary_id}/suggested-todos
Authorization: Bearer {token}
```

**Response:**
```json
{
  "diary_id": "uuid",
  "diary_date": "2025-10-20",
  "suggested_todos": [
    {
      "title": "병원 가기",
      "description": "내과 진료 예약",
      "due_date": "2025-10-21",
      "due_time": "14:00",
      "priority": "high",
      "category": "건강",
      "elderly_id": "uuid",
      "elderly_name": "홍길동"
    },
    {
      "title": "약국에서 약 타오기",
      "description": "고혈압 약",
      "due_date": "2025-10-22",
      "due_time": null,
      "priority": "medium",
      "category": "건강"
    }
  ]
}
```

### 2. TODO 추천 수락 및 등록

```http
POST /api/diaries/{diary_id}/accept-todos
Authorization: Bearer {token}
Content-Type: application/json

[0, 2]  # 0번, 2번 TODO 선택
```

**Response:**
```json
{
  "success": true,
  "created_todos_count": 2,
  "created_todos": [
    {
      "todo_id": "uuid",
      "title": "병원 가기",
      "due_date": "2025-10-21",
      "priority": "high"
    },
    {
      "todo_id": "uuid",
      "title": "약국에서 약 타오기",
      "due_date": "2025-10-22",
      "priority": "medium"
    }
  ]
}
```

---

## 💻 프론트엔드 구현 가이드

### TypeScript 타입 정의

```typescript
// src/types/diary.ts

export interface SuggestedTodo {
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'high' | 'medium' | 'low';
  category: string;
  elderly_id: string;
  elderly_name?: string;
  source: 'todo' | 'future_plan';
}

export interface SuggestedTodosResponse {
  diary_id: string;
  diary_date: string;
  suggested_todos: SuggestedTodo[];
}

export interface AcceptTodosRequest {
  selected_indices: number[];
}

export interface AcceptTodosResponse {
  success: boolean;
  created_todos_count: number;
  created_todos: {
    todo_id: string;
    title: string;
    due_date: string | null;
    priority: string;
  }[];
}
```

### API 클라이언트 함수

```typescript
// src/api/diary.ts

import { apiClient } from './client';
import { SuggestedTodosResponse, AcceptTodosResponse } from '../types/diary';

/**
 * 일기에서 감지된 TODO 추천 조회
 */
export const getSuggestedTodos = async (
  diaryId: string
): Promise<SuggestedTodosResponse> => {
  const response = await apiClient.get(`/diaries/${diaryId}/suggested-todos`);
  return response.data;
};

/**
 * TODO 추천 수락 및 등록
 */
export const acceptSuggestedTodos = async (
  diaryId: string,
  selectedIndices: number[]
): Promise<AcceptTodosResponse> => {
  const response = await apiClient.post(
    `/diaries/${diaryId}/accept-todos`,
    selectedIndices
  );
  return response.data;
};
```

### React Native 컴포넌트 예시

```tsx
// src/components/SuggestedTodoList.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getSuggestedTodos, acceptSuggestedTodos } from '../api/diary';
import { SuggestedTodo } from '../types/diary';

interface Props {
  diaryId: string;
  onTodosAccepted?: () => void;
}

export const SuggestedTodoList: React.FC<Props> = ({ diaryId, onTodosAccepted }) => {
  const [todos, setTodos] = useState<SuggestedTodo[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSuggestedTodos();
  }, [diaryId]);

  const loadSuggestedTodos = async () => {
    try {
      const response = await getSuggestedTodos(diaryId);
      setTodos(response.suggested_todos);
    } catch (error) {
      console.error('Failed to load suggested todos:', error);
    }
  };

  const toggleTodo = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleAccept = async () => {
    if (selectedIndices.length === 0) {
      Alert.alert('알림', '추가할 할 일을 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await acceptSuggestedTodos(diaryId, selectedIndices);
      
      Alert.alert(
        '성공',
        `${response.created_todos_count}개의 할 일이 추가되었습니다.`,
        [
          {
            text: '확인',
            onPress: () => {
              setTodos([]);
              setSelectedIndices([]);
              onTodosAccepted?.();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('오류', '할 일 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (todos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📌 감지된 일정</Text>
        <Text style={styles.subtitle}>
          통화 중 언급된 할 일이 {todos.length}개 발견되었습니다.
        </Text>
      </View>

      {todos.map((todo, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.todoItem,
            selectedIndices.includes(index) && styles.todoItemSelected
          ]}
          onPress={() => toggleTodo(index)}
        >
          <View style={styles.checkbox}>
            {selectedIndices.includes(index) && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>
          
          <View style={styles.todoContent}>
            <Text style={styles.todoTitle}>
              {todo.title}
              {todo.priority === 'high' && (
                <Text style={styles.priorityBadge}> 중요</Text>
              )}
            </Text>
            
            {todo.description && (
              <Text style={styles.todoDescription}>{todo.description}</Text>
            )}
            
            <View style={styles.todoMeta}>
              {todo.due_date && (
                <Text style={styles.todoDate}>
                  📅 {new Date(todo.due_date).toLocaleDateString('ko-KR')}
                  {todo.due_time && ` ${todo.due_time}`}
                </Text>
              )}
              <Text style={styles.todoCategory}>🏷️ {todo.category}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAccept}
          disabled={loading || selectedIndices.length === 0}
        >
          <Text style={styles.acceptButtonText}>
            {selectedIndices.length > 0
              ? `선택한 ${selectedIndices.length}개 할 일 추가`
              : '할 일을 선택해주세요'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  todoItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  todoItemSelected: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#F1F8F4',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#4CAF50',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  priorityBadge: {
    color: '#FF5722',
    fontSize: 12,
    fontWeight: 'bold',
  },
  todoDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  todoMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  todoDate: {
    fontSize: 12,
    color: '#2196F3',
  },
  todoCategory: {
    fontSize: 12,
    color: '#9C27B0',
  },
  actions: {
    marginTop: 12,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### 일기 상세 화면에 통합

```tsx
// src/screens/DiaryDetailScreen.tsx

import { SuggestedTodoList } from '../components/SuggestedTodoList';

export const DiaryDetailScreen = ({ route }) => {
  const { diaryId } = route.params;
  const [diary, setDiary] = useState(null);

  // ... 기존 코드 ...

  return (
    <ScrollView>
      {/* 기존 일기 내용 */}
      <View style={styles.diaryContent}>
        <Text>{diary.content}</Text>
      </View>

      {/* TODO 추천 컴포넌트 추가 */}
      {diary.is_auto_generated && (
        <SuggestedTodoList
          diaryId={diaryId}
          onTodosAccepted={() => {
            // TODO 추가 완료 후 처리
            Alert.alert('할 일이 추가되었습니다!');
            // TODO 화면으로 이동하거나 새로고침
          }}
        />
      )}
    </ScrollView>
  );
};
```

---

## 🧪 테스트 방법

### 1. 백엔드 테스트

```bash
# 1. Celery Worker 실행
cd backend
celery -A app.tasks.celery_app worker --loglevel=info

# 2. AI 전화 테스트
# - Twilio로 전화 걸기
# - 통화 중 "내일 병원 가야 해", "모레 약 사러 가야지" 등 언급

# 3. 통화 종료 후 일기 생성 확인
# 로그에서 다음 내용 확인:
# - 📊 통화 내용 분석 시작
# - ✅ 통화 분석 완료
# - 📝 개인화된 일기 생성 시작
# - ✅ 일기 생성 완료
# - 📋 TODO 감지: N개
```

### 2. API 테스트 (Swagger 또는 curl)

```bash
# 1. 일기 목록 조회
curl -X GET "http://localhost:8000/api/diaries" \
  -H "Authorization: Bearer {token}"

# 2. TODO 추천 조회
curl -X GET "http://localhost:8000/api/diaries/{diary_id}/suggested-todos" \
  -H "Authorization: Bearer {token}"

# 3. TODO 추가
curl -X POST "http://localhost:8000/api/diaries/{diary_id}/accept-todos" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d "[0, 1, 2]"
```

---

## 📊 프롬프트 예시

### 통화 내용 분석 프롬프트

```
당신은 어르신과의 통화 내용을 분석하는 전문 분석가입니다.
다음 통화 내용에서 핵심 정보를 추출해주세요.

통화 내용:
[0초] AI: 안녕하세요! 오늘 어떻게 지내셨어요?
[5초] ELDERLY: 잘 지냈어. 아침에 산책도 하고 왔어.
[10초] AI: 아침 산책 좋으시네요! 아침은 드셨나요?
[15초] ELDERLY: 응, 미역국이랑 밥 먹었어. 딸이 끓여줬거든.
[20초] AI: 따님이 오셨군요. 반가우셨겠어요.
[25초] ELDERLY: 그럼, 한 시간 있다 갔어. 내일 병원 같이 간대.
...

=> JSON 형식으로 추출:
{
  "activities": [
    {"time": "아침", "activity": "산책", "detail": "아침에 산책"}
  ],
  "meal_details": {
    "breakfast": "미역국, 밥"
  },
  "social": [
    {"person": "딸", "interaction": "방문", "duration": "한 시간"}
  ],
  "future_plans": [
    {"date": "내일", "event": "병원 가기", "location": "병원"}
  ],
  "todos": [
    {
      "title": "병원 가기",
      "due_date": "2025-10-21",
      "priority": "medium",
      "category": "건강"
    }
  ]
}
```

### 일기 생성 프롬프트 (고도화)

```
당신은 75세 여성 어르신의 관점에서 일기를 대신 작성하는 작가입니다.

어르신 정보:
- 이름: 김영희
- 나이: 75세
- 성별: 여성

오늘 날짜: 2025년 10월 20일 일요일

최근 일기 작성 스타일:
짧은 문장을 선호하며, "~했다", "~더라" 같은 반말 일기체를 사용합니다.
감정 표현이 풍부하고, 가족에 대한 이야기를 자주 합니다.

오늘 통화에서 추출한 정보:
- 아침에 공원 산책 (30분)
- 아침 식사: 미역국, 밥 (딸이 만들어줌)
- 딸 방문 (1시간)
- 내일 병원 예정

=> 생성된 일기:

오늘은 날씨가 좋아서 아침 일찍 공원에 다녀왔다. 
요즘 걷기 운동을 하니까 다리가 좀 나아진 것 같다.

집에 오니 딸애가 와 있더라. 미역국을 끓여놨길래 
맛있게 먹었다. 역시 딸이 해준 밥이 제일 맛있어.

딸이 내일 병원에 같이 가자고 했다. 무릎 검진 받아야 하는데 
혼자 가기 귀찮았는데 다행이다.

오늘은 딸아이 얼굴도 보고 참 좋은 하루였다.
```

---

## 🚀 다음 단계

1. **알림 시스템 통합**
   - 일기 생성 완료 알림
   - TODO 추천 알림

2. **보호자 기능**
   - 보호자도 어르신의 TODO 추천 확인
   - 보호자가 직접 TODO 추가 가능

3. **분석 대시보드**
   - 어르신의 활동 패턴 분석
   - 건강 상태 트렌드
   - 감정 변화 그래프

4. **프롬프트 최적화**
   - A/B 테스트
   - 사용자 피드백 수집
   - 프롬프트 지속 개선

