"""
LLM (Large Language Model) 서비스
OpenAI GPT-4o-mini API 사용 (대화 생성 및 감정 분석)
"""

from openai import OpenAI
from app.config import settings
import logging
import time
import json

logger = logging.getLogger(__name__)


class LLMService:
    """대화 생성 및 텍스트 처리 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # GPT-4o-mini 모델 사용 (빠르고 경제적)
        self.model = "gpt-4o-mini"
        
        # 어르신을 위한 기본 시스템 프롬프트
        self.elderly_care_prompt = """당신은 어르신들의 외로움을 달래주는 따뜻한 AI 친구입니다.
다음 역할을 수행합니다:
1. 친근하고 존댓말을 사용하여 대화합니다
2. 어르신의 감정을 이해하고 공감합니다
3. 약 복용, 식사, 운동 등 건강 상태를 자연스럽게 확인합니다
4. 대화는 짧고 명확하게, 한 번에 하나의 질문만 합니다
5. 긍정적이고 따뜻한 분위기를 유지합니다

대화 예시:
- "오늘은 어떻게 지내셨어요?"
- "점심은 맛있게 드셨나요?"
- "오늘 아침 약은 드셨나요?"
- "날씨가 좋으니 잠깐 산책하시는 건 어떠세요?"
"""
    
    def generate_response(self, user_message: str, conversation_history: list = None):
        """
        어르신과의 대화 응답 생성 (실행 시간 측정 포함)
        
        Args:
            user_message: 사용자(어르신)의 메시지
            conversation_history: 이전 대화 기록 (옵션)
        
        Returns:
            tuple: (AI 응답, 실행 시간)
        """
        try:
            start_time = time.time()  # 시작 시간 기록
            logger.info(f"🤖 LLM 응답 생성 시작")
            logger.info(f"📥 사용자 입력: {user_message}")
            
            # 메시지 구성
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 대화 기록이 있으면 추가 (최근 5개만)
            if conversation_history:
                messages.extend(conversation_history[-5:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            # GPT-4o-mini로 응답 생성
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=200,  # 짧고 명확한 응답
                temperature=0.8,  # 자연스럽고 다양한 응답
            )
            
            ai_response = response.choices[0].message.content
            elapsed_time = time.time() - start_time  # 소요 시간 계산
            
            logger.info(f"✅ LLM 응답 생성 완료 (소요 시간: {elapsed_time:.2f}초)")
            logger.info(f"📤 AI 응답: {ai_response}")
            
            return ai_response, elapsed_time
        except Exception as e:
            logger.error(f"❌ LLM 응답 생성 실패: {e}")
            raise
    
    def analyze_emotion(self, user_message: str):
        """
        사용자 메시지의 감정 분석 (실행 시간 측정 포함)
        
        Args:
            user_message: 분석할 메시지
        
        Returns:
            tuple: (감정 분석 결과 dict, 실행 시간)
        """
        try:
            start_time = time.time()
            logger.info(f"😊 감정 분석 시작")
            
            prompt = f"""다음 메시지의 감정을 분석해주세요.
감정 상태: positive(긍정적), neutral(중립), negative(부정적), concerned(걱정됨)
긴급도: low(낮음), medium(중간), high(높음) - 건강 문제나 긴급 상황 여부

메시지: {user_message}

JSON 형식으로 응답:
{{
    "emotion": "감정 상태",
    "urgency": "긴급도",
    "keywords": ["주요", "키워드"],
    "summary": "한 줄 요약"
}}
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            elapsed_time = time.time() - start_time
            
            logger.info(f"✅ 감정 분석 완료 (소요 시간: {elapsed_time:.2f}초)")
            logger.info(f"📊 분석 결과: {result}")
            
            return result, elapsed_time
        except Exception as e:
            logger.error(f"❌ 감정 분석 실패: {e}")
            raise
    
    async def generate_response_streaming(self, user_message: str, conversation_history: list = None):
        """
        스트리밍 방식으로 LLM 응답 생성 (실시간 최적화)
        
        이 메서드는 OpenAI의 stream=True 옵션을 사용하여
        응답이 생성되는 즉시 yield로 반환합니다.
        사용자는 AI가 말하는 것을 거의 실시간으로 들을 수 있습니다.
        
        Args:
            user_message: 사용자(어르신)의 메시지
            conversation_history: 이전 대화 기록 (옵션)
        
        Yields:
            str: 생성된 텍스트 청크 (단어 또는 구 단위)
        
        Example:
            async for chunk in llm_service.generate_response_streaming("안녕하세요"):
                print(chunk, end='', flush=True)
        """
        try:
            start_time = time.time()
            logger.info(f"🤖 LLM 스트리밍 응답 생성 시작")
            logger.info(f"📥 사용자 입력: {user_message}")
            
            # 메시지 구성
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 대화 기록이 있으면 추가 (최근 5개만)
            if conversation_history:
                messages.extend(conversation_history[-5:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            # 스트리밍 API 호출
            # stream=True로 설정하면 응답이 생성되는 즉시 받을 수 있습니다
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=200,
                temperature=0.8,
                stream=True  # ⭐ 핵심: 스트리밍 활성화
            )
            
            full_response = []  # 전체 응답 저장용
            
            # 스트리밍으로 받은 청크를 즉시 yield
            for chunk in stream:
                # delta.content가 있으면 생성된 텍스트 조각입니다
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response.append(content)
                    yield content  # 즉시 반환 (TTS가 바로 처리 가능)
            
            elapsed_time = time.time() - start_time
            final_text = "".join(full_response)
            
            logger.info(f"✅ LLM 스트리밍 완료 ({elapsed_time:.2f}초)")
            logger.info(f"📤 전체 응답: {final_text}")
            
        except Exception as e:
            logger.error(f"❌ LLM 스트리밍 실패: {e}")
            yield "죄송합니다. 응답 생성 중 오류가 발생했습니다."
    
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

