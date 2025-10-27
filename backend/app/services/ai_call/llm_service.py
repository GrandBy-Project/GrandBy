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
                max_tokens=100,
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
    
    def summarize_call_conversation(self, conversation_history: list):
        """
        통화 내용을 어르신의 1인칭 일기로 변환 (자연스러움과 정확성 균형)
        
        Args:
            conversation_history: 대화 기록 [{"role": "user", "content": "..."}, ...]
        
        Returns:
            str: 1인칭 일기 형식의 내용
        """
        try:
            # 대화 기록을 텍스트로 변환
            conversation_text = "\n".join([
                f"{'어르신' if msg['role'] == 'user' else 'AI'}: {msg['content']}"
                for msg in conversation_history
            ])
            
            prompt = f"""
다음은 어르신과 AI 비서의 통화 내용입니다. 
이 대화를 바탕으로 어르신이 직접 쓴 것 같은 자연스러운 일기를 작성해주세요.

⚠️ 필수 준수사항:
- 대화에서 실제로 언급된 내용만 사용하세요 (추측, 가정, 창작 금지)
- 대화에 없는 행동, 감정, 계획을 추가하지 마세요
- AI의 질문이나 반응은 일기에 포함하지 마세요 (어르신의 말만 사용)

작성 가이드:
- "오늘은", "오늘" 등으로 자연스럽게 시작 ("안녕하세요" 금지)
- 1인칭 구어체 사용 ("~했어", "~거야", "~네" 등)
- 대화 순서대로 자연스럽게 연결
- 문장은 간결하게, 하지만 감정은 진솔하게
- 5-8문장 정도로 작성
- 마치 손으로 직접 쓴 일기처럼 자연스럽게

통화 내용:
{conversation_text}

일기:
"""
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=400, # 적정 길이로 조정
                temperature=0.5, # 자연스러움과 정확성의 균형
            )
            
            summary = response.choices[0].message.content
            logger.info(f"✅ 통화 일기기 생성 완료")
            return summary
        except Exception as e:
            logger.error(f"❌ 통화 일기 생성 실패: {e}")
            return "일기 생성 실패"
    
    def extract_schedule_from_conversation(self, conversation_text: str):
        """
        통화 내용에서 일정 정보 추출 (개선 버전)
        
        Args:
            conversation_text: 전체 통화 내용
        
        Returns:
            str: JSON 형식의 일정 목록
        """
        try:
            from datetime import datetime, timedelta
            
            # 오늘 날짜를 기준으로 상대 날짜 해석
            today = datetime.now()
            tomorrow = today + timedelta(days=1)
            day_after_tomorrow = today + timedelta(days=2)
            
            # 요일 계산
            weekdays_kr = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']
            current_weekday = weekdays_kr[today.weekday()]
            
            prompt = f"""
다음 대화에서 미래의 일정과 약속을 추출해주세요.

📅 오늘 날짜: {today.strftime('%Y년 %m월 %d일')} ({current_weekday})
📅 내일: {tomorrow.strftime('%Y-%m-%d')}
📅 모레: {day_after_tomorrow.strftime('%Y-%m-%d')}

대화:
{conversation_text}

추출 규칙:
1. 미래 일정만 추출 (과거나 완료된 것은 제외)
2. "내일", "모레", "다음주", "월요일" 등 상대 날짜를 절대 날짜로 변환
3. 시간이 명시되면 due_time에 포함 (HH:MM 24시간 형식)
4. 시간이 없으면 due_time은 null
5. 카테고리 자동 분류:
   - MEDICINE: 약, 복용, 약국
   - HOSPITAL: 병원, 진료, 검사, 치료
   - EXERCISE: 운동, 산책, 체조
   - MEAL: 식사, 밥, 약속, 만남
   - OTHER: 기타
6. 불확실하거나 막연한 표현은 제외 (예: "언젠가", "나중에")
7. 최대 5개까지만 추출 (중요도 높은 순서)

JSON 형식으로 응답 (일정 없으면 빈 배열):
{{
  "schedules": [
    {{
      "title": "병원 가기",
      "description": "정형외과 무릎 검사",
      "category": "HOSPITAL",
      "due_date": "{tomorrow.strftime('%Y-%m-%d')}",
      "due_time": "15:00"
    }}
  ]
}}

주의: schedules 배열 안에 일정을 넣어주세요. 일정이 없으면 {{"schedules": []}}를 반환하세요.
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800,  # 여러 일정 추출 가능하도록 증가
                temperature=0.2,  # 정확한 추출을 위해 낮게 설정
                response_format={"type": "json_object"}
            )
            
            result = response.choices[0].message.content
            logger.info(f"✅ 일정 추출 완료")
            return result
            
        except Exception as e:
            logger.error(f"❌ 일정 추출 실패: {e}")
            return '{"schedules": []}'

