"""
개인화된 일기 생성 서비스
어르신의 스타일로 자연스러운 일기 작성
"""

from openai import OpenAI
from app.config import settings
from app.models.user import User, Gender
from app.models.diary import Diary
from sqlalchemy.orm import Session
import logging
import json
from typing import Dict, List
from datetime import datetime, date

logger = logging.getLogger(__name__)


class PersonalizedDiaryGenerator:
    """개인 정보를 반영한 자연스러운 일기 생성"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # 더 높은 품질을 위해 gpt-4o-mini 사용 (또는 gpt-4o)
        self.model = "gpt-4o-mini"
    
    def generate_diary(
        self,
        user: User,
        structured_data: Dict,
        recent_diaries: List[Diary],
        db: Session,
        conversation_length: int = 0  # 대화 발화 수
    ) -> str:
        """
        개인화된 일기 생성
        
        Args:
            user: 어르신 사용자 정보
            structured_data: 통화에서 추출한 구조화된 정보
            recent_diaries: 최근 일기 목록 (스타일 학습용)
            db: DB 세션
        
        Returns:
            str: 생성된 일기 내용
        """
        try:
            # 1. 사용자 프로필 구성
            user_age = self._calculate_age(user.birth_date) if user.birth_date else "알 수 없음"
            user_gender = "남성" if user.gender == Gender.MALE else "여성" if user.gender == Gender.FEMALE else "알 수 없음"
            
            user_profile = f"""
어르신 정보:
- 이름: {user.name}
- 나이: {user_age}세
- 성별: {user_gender}
"""
            
            # 2. 최근 일기 스타일 분석 (초기에는 생략 - 속도 개선)
            diary_style_context = ""
            # if recent_diaries:
            #     diary_style_context = self._analyze_diary_style(recent_diaries)
            
            # 3. 구조화된 데이터를 읽기 쉽게 정리
            structured_summary = self._format_structured_data(structured_data)
            
            # 4. 고도화된 일기 생성 프롬프트
            today = datetime.now()
            weekday_kr = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"][today.weekday()]
            
            diary_prompt = f"""
당신은 {user_age}세 {user_gender} 어르신의 관점에서 일기를 대신 작성하는 작가입니다.

{user_profile}

오늘 날짜: {today.strftime('%Y년 %m월 %d일')} {weekday_kr}

{'='*60}
최근 일기 작성 스타일 분석:
{'='*60}
{diary_style_context if diary_style_context else "이전 일기가 없으므로 자연스럽고 따뜻한 일기체로 작성하세요."}

{'='*60}
오늘 통화에서 추출한 정보:
{'='*60}
{structured_summary}

{'='*60}
일기 작성 지침:
{'='*60}
⭐⭐⭐ **절대 규칙**: 
    1. 위 정보에 **명확히 적힌 내용만** 작성
    2. "평온한", "기분 좋다", "건강을 위해" 같은 일반적 표현 금지
    3. 추측, 상상, 감정 해석 일절 금지
    4. 대화가 짧으면 1-2문장만 작성 (억지로 늘리지 마세요)
    5. 예시:
       - 대화 "내일 산책 가야 해" → 일기 "내일 산책 가기로 했다."
       - 대화 "콩나물 볶밥 먹었어" → 일기 "오늘 점심에 콩나물 볶밥을 먹었다."

1. **1인칭 시점**: "나는", "내가" 등 본인의 시점으로 작성
2. **언급된 내용만**: 
   - 먹은 음식이 언급되었으면 → 그 음식만
   - 만난 사람이 언급되었으면 → 그 사람만
   - 갔던 장소가 언급되었으면 → 그 장소만
   - 언급 안된 것은 쓰지 않기
3. **자연스러운 말투**: 
   - "~했다", "~였다", "~더라" 등 반말 일기체
   - 짧고 간단한 문장
4. **길이 조절**: 
   - 대화가 짧음 (1-2분) → 50-150자 (2-3문장)
   - 대화가 보통 (3-5분) → 150-250자 (1-2문단)
   - 대화가 김 (5분+) → 250-350자 (2-3문단)
5. **미래 계획**: 언급된 경우에만 간단히 추가

⚠️ 절대 하지 말 것:
- AI와의 통화라는 사실 언급 금지
- 언급 안된 감정, 날씨, 디테일 추가 금지
- 과도한 문학적 표현 금지 (→ 간결하게)
- 없는 대화 내용 만들어내기 금지

이제 위 정보를 바탕으로 어르신의 입장에서 오늘의 일기를 작성해주세요:

일기:
"""
            
            # 대화 길이에 따른 max_tokens 동적 조절
            if conversation_length == 0:
                # 구조화된 데이터의 활동 수로 추정
                conversation_length = len(structured_data.get('activities', [])) * 3
            
            # 대화 길이에 비례한 토큰 수 계산
            if conversation_length <= 5:  # 매우 짧은 대화 (1-2분)
                max_tokens = 150  # 30-100자 (200 → 150)
            elif conversation_length <= 15:  # 보통 대화 (3-5분)
                max_tokens = 300  # 100-200자 (350 → 300)
            else:  # 긴 대화 (5분+)
                max_tokens = 450  # 200-300자 (500 → 450)
            
            logger.info(f"📝 개인화된 일기 생성 시작 (사용자: {user.name}, 대화길이: {conversation_length}발화, max_tokens: {max_tokens})")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": diary_prompt}],
                temperature=0.5,  # 0.7 → 0.5 (할루시네이션 강력 방지)
                max_tokens=max_tokens  # 동적 조절
            )
            
            diary_content = response.choices[0].message.content.strip()
            
            logger.info(f"✅ 일기 생성 완료 ({len(diary_content)}자)")
            
            return diary_content
            
        except Exception as e:
            logger.error(f"❌ 일기 생성 실패: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # 폴백: 간단한 요약
            return self._generate_simple_fallback(structured_data)
    
    def _calculate_age(self, birth_date: date) -> int:
        """나이 계산"""
        if not birth_date:
            return 0
        today = date.today()
        age = today.year - birth_date.year
        if (today.month, today.day) < (birth_date.month, birth_date.day):
            age -= 1
        return age
    
    def _analyze_diary_style(self, recent_diaries: List[Diary]) -> str:
        """
        최근 일기에서 작성 스타일 추출
        
        Args:
            recent_diaries: 최근 작성된 일기 목록
        
        Returns:
            str: 스타일 분석 결과
        """
        if not recent_diaries:
            return ""
        
        try:
            # AI가 쓴 일기는 제외하고 사람이 쓴 일기만 분석
            human_diaries = [d for d in recent_diaries if not d.is_auto_generated]
            
            if not human_diaries:
                # AI 일기라도 최근 3개 참고
                human_diaries = recent_diaries[:3]
            else:
                human_diaries = human_diaries[:3]
            
            # 최근 일기 샘플
            samples = "\n\n---\n\n".join([
                f"[{d.date.strftime('%Y-%m-%d')}]\n{d.content}"
                for d in human_diaries
            ])
            
            style_prompt = f"""
다음은 어르신이 작성한 최근 일기입니다:

{samples}

이 일기들의 작성 스타일을 분석해주세요:
1. 문장 길이와 구조
2. 말투 특징 (반말/존댓말, 종결어미)
3. 자주 사용하는 표현이나 단어
4. 감정 표현 방식
5. 문단 구성 방식

분석 결과를 50-100자로 간단히 요약:
"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": style_prompt}],
                temperature=0.5,
                max_tokens=200
            )
            
            style_analysis = response.choices[0].message.content.strip()
            
            logger.info(f"📊 일기 스타일 분석 완료")
            
            return f"{style_analysis}\n\n최근 일기 예시:\n{samples[:300]}..."
            
        except Exception as e:
            logger.error(f"⚠️ 일기 스타일 분석 실패: {e}")
            return ""
    
    def _format_structured_data(self, data: Dict) -> str:
        """구조화된 데이터를 읽기 쉽게 포맷"""
        
        formatted = []
        
        # 1. 활동
        if data.get('activities'):
            formatted.append("【 오늘의 활동 】")
            for act in data['activities']:
                formatted.append(f"  • [{act.get('time', '시간미상')}] {act.get('activity', '')}: {act.get('detail', '')}")
        
        # 2. 식사
        meals = data.get('meal_details', {})
        if any(meals.values()):
            formatted.append("\n【 식사 】")
            if meals.get('breakfast'):
                formatted.append(f"  • 아침: {meals['breakfast']}")
            if meals.get('lunch'):
                formatted.append(f"  • 점심: {meals['lunch']}")
            if meals.get('dinner'):
                formatted.append(f"  • 저녁: {meals['dinner']}")
        
        # 3. 건강
        health = data.get('health', {})
        if health:
            formatted.append("\n【 건강 상태 】")
            formatted.append(f"  • 전반적 상태: {health.get('overall', '정보 없음')}")
            
            medication = health.get('medication', {})
            if medication.get('taken'):
                formatted.append(f"  • 약 복용: {medication.get('details', 'O')}")
            
            pain = health.get('pain', {})
            if pain.get('exists'):
                formatted.append(f"  • 통증: {pain.get('location', '')} ({pain.get('description', '')})")
        
        # 4. 감정
        if data.get('emotions'):
            formatted.append("\n【 감정 상태 】")
            for emo in data['emotions']:
                formatted.append(f"  • {emo.get('emotion', '')}: {emo.get('reason', '')} (강도: {emo.get('intensity', 0)}/10)")
        
        # 5. 사회적 교류
        if data.get('social'):
            formatted.append("\n【 만남/대화 】")
            for soc in data['social']:
                formatted.append(f"  • {soc.get('person', '')}: {soc.get('interaction', '')} - {soc.get('topic', '')}")
        
        # 6. 향후 일정
        if data.get('future_plans'):
            formatted.append("\n【 앞으로의 계획 】")
            for plan in data['future_plans']:
                formatted.append(f"  • {plan.get('date', '')}: {plan.get('event', '')} ({plan.get('time', '')})")
        
        # 7. 걱정사항
        if data.get('concerns'):
            formatted.append("\n【 걱정/우려사항 】")
            for concern in data['concerns']:
                formatted.append(f"  • [{concern.get('category', '')}] {concern.get('concern', '')}")
        
        # 8. 대화 분위기
        formatted.append(f"\n【 전체적인 분위기 】")
        formatted.append(f"  {data.get('conversation_tone', '평온함')}")
        
        if data.get('key_topics'):
            formatted.append(f"\n【 주요 대화 주제 】")
            formatted.append(f"  {', '.join(data.get('key_topics', []))}")
        
        return "\n".join(formatted)
    
    def _generate_simple_fallback(self, structured_data: Dict) -> str:
        """간단한 폴백 일기 생성"""
        today = datetime.now().strftime('%Y년 %m월 %d일')
        
        content_parts = [f"오늘은 {today}이다."]
        
        # 활동
        if structured_data.get('activities'):
            activities = [a.get('activity', '') for a in structured_data['activities'][:3]]
            content_parts.append(f"오늘은 {', '.join(activities)} 등을 했다.")
        
        # 건강
        health = structured_data.get('health', {})
        if health.get('overall'):
            content_parts.append(f"몸 상태는 {health['overall']}.")
        
        # 감정
        if structured_data.get('emotions'):
            emotion = structured_data['emotions'][0].get('emotion', '')
            content_parts.append(f"기분은 {emotion} 느낌이었다.")
        
        content_parts.append("내일도 좋은 하루가 되길 바란다.")
        
        return " ".join(content_parts)

