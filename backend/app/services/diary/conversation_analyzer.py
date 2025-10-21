"""
통화 내용 분석 서비스
대화에서 구조화된 정보를 추출 (활동, 건강, 감정, 일정 등)
"""

from openai import OpenAI
from app.config import settings
from app.models.call import CallTranscript
from sqlalchemy.orm import Session
import logging
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ConversationAnalyzer:
    """통화 내용을 구조화된 정보로 분석"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "gpt-4o-mini"
    
    def analyze_conversation(self, call_id: str, db: Session) -> Dict:
        """
        통화 내용을 분석하여 구조화된 정보 추출
        
        Args:
            call_id: 통화 ID
            db: DB 세션
        
        Returns:
            dict: 구조화된 정보
                - activities: 활동 내역
                - health: 건강 상태
                - emotions: 감정 상태
                - social: 사회적 교류
                - future_plans: 향후 일정
                - todos: 할 일 목록 (자동 감지)
                - concerns: 걱정/우려사항
        """
        try:
            # 1. CallTranscript 가져오기
            transcripts = db.query(CallTranscript).filter(
                CallTranscript.call_id == call_id
            ).order_by(CallTranscript.timestamp).all()
            
            if not transcripts:
                logger.warning(f"No transcripts found for call {call_id}")
                return self._empty_structure()
            
            # 2. 대화 텍스트 구성 (시간 정보 포함)
            conversation_text = "\n".join([
                f"[{int(t.timestamp)}초] {t.speaker}: {t.text}"
                for t in transcripts
            ])
            
            logger.info(f"📊 통화 내용 분석 시작 (총 {len(transcripts)}개 발화)")
            
            # 3. LLM으로 구조화된 정보 추출
            analysis_prompt = f"""
당신은 어르신과의 통화 내용을 분석하는 전문 분석가입니다.
다음 통화 내용에서 핵심 정보를 추출해주세요.

오늘 날짜: {datetime.now().strftime('%Y년 %m월 %d일 %A')}

통화 내용:
{conversation_text}

다음 카테고리별로 **대화에서 명확히 언급된 정보만** 추출해주세요:

1. activities (활동): 어르신이 실제로 언급한 활동만
   - 식사 (아침/점심/저녁 - 언급된 음식만)
   - 외출 (언급된 장소만)
   - 운동/산책 (언급된 경우만)
   - 취미 활동 (언급된 경우만)
   - 가사 활동 (언급된 경우만)

2. health (건강):
   - medication: 약 복용 여부와 상세 내용
   - pain: 통증 여부, 위치, 정도
   - sleep: 수면 상태
   - overall: 전반적 컨디션

3. emotions (감정): 통화 중 느껴지는 감정
   - 기쁨, 외로움, 걱정, 불안, 평온함 등
   - 각 감정의 원인과 강도 (1-10)

4. social (사회적 교류):
   - 가족, 친구, 이웃과의 만남/통화
   - 대화 내용 요약

5. future_plans (향후 일정):
   - "내일", "모레", "다음주", "~일", "~요일" 등 날짜 언급
   - 병원, 약국, 모임, 방문 등의 계획
   - 구체적인 날짜와 시간 추정

6. todos (할 일 - 자동 감지): ⭐ 중요!
   - "~해야 해", "~할 거야", "~가야 해", "~사야 해" 등의 표현
   - 날짜가 명확한 것 우선
   - 각 할 일의 제목, 날짜, 시간, 중요도

7. concerns (걱정/우려사항):
   - 건강, 가족, 경제적 문제 등

JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{
    "activities": [
        {{
            "time": "아침|점심|저녁|오전|오후",
            "category": "식사|외출|운동|취미|가사|기타",
            "activity": "활동명",
            "detail": "구체적인 설명",
            "people": ["함께한 사람들"]
        }}
    ],
    "health": {{
        "medication": {{
            "taken": true|false,
            "details": "어떤 약을 언제 복용했는지",
            "issues": "약 관련 문제점"
        }},
        "pain": {{
            "exists": true|false,
            "location": "통증 부위",
            "severity": 1-10,
            "description": "통증 설명"
        }},
        "sleep": {{
            "quality": "좋음|보통|나쁨",
            "hours": 수면시간,
            "issues": "수면 문제"
        }},
        "overall": "전반적 건강 상태 한 문장"
    }},
    "emotions": [
        {{
            "emotion": "감정 이름",
            "reason": "원인",
            "intensity": 1-10,
            "when": "언제 느꼈는지"
        }}
    ],
    "social": [
        {{
            "person": "사람 (관계)",
            "interaction": "만남|전화|문자",
            "topic": "대화 주제",
            "duration": "지속 시간"
        }}
    ],
    "future_plans": [
        {{
            "date": "YYYY-MM-DD 또는 '내일'/'모레' 등",
            "event": "일정 내용",
            "time": "시간 (HH:MM 또는 '오전'/'오후')",
            "location": "장소",
            "importance": "high|medium|low"
        }}
    ],
    "todos": [
        {{
            "title": "할 일 제목 (간단명료하게)",
            "description": "상세 설명",
            "due_date": "YYYY-MM-DD",
            "due_time": "HH:MM (시간 언급이 없으면 null)",
            "priority": "high|medium|low",
            "category": "건강|식사|외출|약속|기타",
            "mentioned_at": "대화의 몇 초에 언급되었는지"
        }}
    ],
    "concerns": [
        {{
            "category": "건강|가족|경제|기타",
            "concern": "걱정 내용",
            "severity": "high|medium|low"
        }}
    ],
    "weather_mentioned": true|false,
    "meal_details": {{
        "breakfast": "아침 식사 내용",
        "lunch": "점심 식사 내용",
        "dinner": "저녁 식사 내용"
    }},
    "conversation_tone": "밝음|평온함|우울함|불안함|혼합",
    "key_topics": ["주요 대화 주제 리스트"]
}}

⚠️ 중요한 주의사항:
- **대화에서 명확히 언급된 내용만 추출** (추측 금지)
- **언급되지 않은 정보는 빈 값으로 남겨두기** (null, "", [])
- 추측하지 말고 실제 대화 내용 기반으로만 작성
- 날짜 추정 시 오늘({datetime.now().strftime('%Y-%m-%d')})을 기준으로 계산
- todos는 명확한 행동이 필요한 것만 포함
- 짧은 대화면 간단하게, 긴 대화면 자세하게 추출
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": analysis_prompt}],
                temperature=0.2,  # 정확한 추출을 위해 더 낮게 (0.3 → 0.2)
                response_format={"type": "json_object"},
                max_tokens=1500  # 2000 → 1500으로 감소
            )
            
            structured_data = json.loads(response.choices[0].message.content)
            
            logger.info(f"✅ 통화 분석 완료:")
            logger.info(f"   - 활동: {len(structured_data.get('activities', []))}개")
            logger.info(f"   - 감정: {len(structured_data.get('emotions', []))}개")
            logger.info(f"   - 향후 일정: {len(structured_data.get('future_plans', []))}개")
            logger.info(f"   - 할 일(TODO): {len(structured_data.get('todos', []))}개")
            
            return structured_data
            
        except Exception as e:
            logger.error(f"❌ 통화 분석 실패: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return self._empty_structure()
    
    def _empty_structure(self) -> Dict:
        """빈 구조 반환"""
        return {
            "activities": [],
            "health": {
                "medication": {"taken": False, "details": "", "issues": ""},
                "pain": {"exists": False, "location": None, "severity": 0, "description": ""},
                "sleep": {"quality": "보통", "hours": 0, "issues": ""},
                "overall": "정보 없음"
            },
            "emotions": [],
            "social": [],
            "future_plans": [],
            "todos": [],
            "concerns": [],
            "weather_mentioned": False,
            "meal_details": {"breakfast": "", "lunch": "", "dinner": ""},
            "conversation_tone": "평온함",
            "key_topics": []
        }

