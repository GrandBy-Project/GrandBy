"""
LLM (Large Language Model) 서비스
OpenAI GPT-4 API 사용
"""

from openai import OpenAI
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class LLMService:
    """대화 생성 및 텍스트 처리 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
    
    def generate_response(self, conversation_history: list, system_prompt: str = None):
        """
        대화 응답 생성
        
        Args:
            conversation_history: 대화 기록 [{"role": "user", "content": "..."}]
            system_prompt: 시스템 프롬프트
        
        Returns:
            str: AI 응답
        """
        try:
            messages = []
            
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            messages.extend(conversation_history)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=settings.MAX_PROMPT_TOKENS,
                temperature=0.7,
            )
            
            ai_response = response.choices[0].message.content
            logger.info(f"Generated response: {ai_response[:50]}...")
            return ai_response
        except Exception as e:
            logger.error(f"Failed to generate response: {e}")
            raise
    
    def summarize_conversation_to_diary(self, conversation_text: str):
        """
        통화 내용을 1인칭 일기로 변환
        
        Args:
            conversation_text: 전체 통화 내용
        
        Returns:
            str: 1인칭 일기
        """
        try:
            prompt = f"""
다음은 어르신과 AI 비서의 통화 내용입니다. 
이 대화를 바탕으로 어르신의 1인칭 시점에서 자연스러운 일기를 작성해주세요.
일기는 따뜻하고 친근한 말투로, 하루의 주요 내용과 감정을 담아주세요.

통화 내용:
{conversation_text}

일기 (1인칭):
"""
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.8,
            )
            
            diary = response.choices[0].message.content
            logger.info("Generated diary from conversation")
            return diary
        except Exception as e:
            logger.error(f"Failed to generate diary: {e}")
            raise
    
    def extract_schedule_from_conversation(self, conversation_text: str):
        """
        통화 내용에서 일정 정보 추출
        
        Args:
            conversation_text: 전체 통화 내용
        
        Returns:
            list: 추출된 일정 정보 [{"title": "...", "date": "...", "time": "..."}]
        """
        try:
            prompt = f"""
다음 대화에서 일정과 관련된 정보를 추출해주세요.
"내일 병원 가야해", "모레 약 타러 가야지" 같은 표현을 찾아서 JSON 형식으로 반환해주세요.

대화:
{conversation_text}

JSON 형식:
[{{"title": "병원 가기", "date": "2025-10-11", "time": "15:00"}}]

만약 일정이 없다면 빈 배열 []을 반환해주세요.
"""
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.3,
                response_format={"type": "json_object"}  # JSON 모드
            )
            
            schedule = response.choices[0].message.content
            logger.info(f"Extracted schedule: {schedule}")
            return schedule
        except Exception as e:
            logger.error(f"Failed to extract schedule: {e}")
            raise

