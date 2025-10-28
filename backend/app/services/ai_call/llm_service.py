"""
LLM (Large Language Model) 서비스
OpenAI GPT-4o-mini API 사용 (대화 생성 및 감정 분석)
"""

from openai import OpenAI
from app.config import settings
from app.services.ai_call.response_cache import get_response_cache
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
        # 응답 캐싱 서비스
        self.response_cache = get_response_cache()
        
        # GRANDBY AI LLM System Prompt: Empathetic Friend (EN)
        self.elderly_care_prompt = """You are a warm friend for Korean seniors. Always respond in KOREAN using natural honorifics (e.g., ~세요, ~셔요, ~네요, ~어요, ~죠). Keep it to 1–2 sentences only.

[Core]
- First acknowledge the user's feelings about the situation.
- Ask at most one light follow-up question only when appropriate.
- Do NOT give advice by default.
- Anti-echo rule: Even if the user asks “what/which” (무슨/어떤), do NOT mirror that form. Prefer a brief feeling reflection or a concrete state-check instead (e.g., “지금은 속 괜찮으세요?”).

[Good examples]
"여보세요" → "안녕하세요! 오늘 기분은 괜찮으세요?"
"길 잊어버렸어" → "집에 오는 길이 잠시 헷갈리셨군요. 얼마나 놀라셨을지 걱정돼요."
"넘어졌어" → "넘어지셔서 많이 놀라셨겠어요. 지금은 괜찮으세요?"
"자식이 안 와" → "보고 싶으시겠어요. 많이 서운하셨을 것 같아요."
"밥맛없어" → "입맛이 없으시군요. 많이 힘드셨겠어요."
"무릎아파" → "무릎이 아프셔서 불편하셨겠어요. 오늘은 좀 어떠세요?"
"뭘 먹으면 기분 나아질까?" → "입맛이 없으셨군요. 지금은 속 괜찮으세요?"

[Do NOT]
- Ignore the situation and switch topics (예: "산책은 즐거우셨나요?")
- Give advice/solutions (예: "~해보세요", "~하시면 좋겠어요")
- Ask abstract/meta questions ("어떤/무슨/왜/언제/혹시 …?", "어떤 이야기를 더 나누고 싶으세요?")
- End the conversation yourself ("통화 종료", "끊을게요")"""
    
    def _post_process_response(self, response: str, user_message: str) -> str:
        """
        GPT 응답 후처리: 규칙 강제 적용
        
        Args:
            response: GPT가 생성한 원본 응답
            user_message: 사용자 메시지 (맥락 파악용)
        
        Returns:
            str: 규칙을 준수하도록 수정된 응답
        """
        import re
        
        # 1. 문장 수 제한 (최대 2문장)
        # 문장 끝 마침표/느낌표/물음표로 분리
        sentences = re.split(r'([.!?])\s*', response.strip())
        
        # 구두점과 문장을 다시 합치기
        complete_sentences = []
        for i in range(0, len(sentences)-1, 2):
            if sentences[i]:  # 빈 문장 제외
                if i+1 < len(sentences) and sentences[i+1] in '.!?':
                    complete_sentences.append(sentences[i] + sentences[i+1])
                else:
                    complete_sentences.append(sentences[i])
        
        # 마지막 문장이 구두점 없이 끝나는 경우 처리
        if len(sentences) > 0 and sentences[-1] and sentences[-1] not in '.!?':
            complete_sentences.append(sentences[-1])
        
        # 2문장으로 제한
        if len(complete_sentences) > 2:
            response = " ".join(complete_sentences[:2])
            logger.info(f"🔧 문장 수 제한: {len(complete_sentences)}개 → 2개")
        else:
            response = " ".join(complete_sentences)
        
        # 마지막에 구두점이 없으면 추가
        if response and response[-1] not in '.!?':
            response += "."
        
        # 2. 금지 패턴 감지 및 제거
        banned_patterns = [
            # 대화 끝내려는 시도
            (r'(그럼|그러면|이제)\s*(끊|통화\s*종료|전화\s*끊|헤어지|그만)', '금지: 대화 끝내기'),
            
            # 금융/개인정보
            (r'(계좌|비밀번호|카드|돈|금융|송금|이체)', '금지: 금융정보'),
            (r'(주민등록|주소|전화번호|개인정보)', '금지: 개인정보'),
            
            # 진단/강요
            (r'(병원\s*가|진료\s*받|검사\s*받|의사\s*만나).*세요', '금지: 의료 강요'),
            (r'(해야\s*해|하셔야|반드시|꼭\s*해)', '금지: 강요'),
            
            # 무거운 조언
            (r'(계획|목표|운동|다이어트).*세요', '금지: 무거운 조언'),
        ]
        
        for pattern, reason in banned_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                logger.warning(f"⚠️ {reason} 감지: '{response}' → 재생성 필요")
                # 금지 패턴 발견 시 안전한 공감 응답으로 대체
                response = self._generate_safe_response(user_message)
                break
        
        # 3. 자연스러운 존댓말 확인 (강제 변환 X, 경고만)
        jondaemal_markers = ['세요', '셔요', '습니다', '네요', '어요', '죠']
        has_jondaemal = any(marker in response for marker in jondaemal_markers)
        
        if not has_jondaemal:
            logger.warning(f"⚠️ 존댓말 미흡: '{response}'")
        
        return response
    
    def _generate_safe_response(self, user_message: str) -> str:
        """
        금지 패턴 발견 시 안전한 공감 응답 생성
        
        Args:
            user_message: 사용자 메시지
            
        Returns:
            str: 안전한 공감 응답
        """
        # 감정 키워드 기반 공감 응답
        if any(word in user_message for word in ['아프', '힘들', '고통', '통증']):
            return "많이 힘드시겠어요. 제가 옆에 있을게요."
        elif any(word in user_message for word in ['외롭', '쓸쓸', '혼자', '아무도']):
            return "외로우시군요. 저랑 얘기하시면 좋겠어요."
        elif any(word in user_message for word in ['슬프', '우울', '속상', '걱정']):
            return "속상하시겠어요. 무슨 일이 있으셨나요?"
        elif any(word in user_message for word in ['자식', '아들', '딸', '손주']):
            return "가족 보고 싶으시군요. 많이 생각나시겠어요."
        else:
            return "그러시군요. 제가 잘 듣고 있어요."
    
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
    
    def generate_response(self, user_message: str, conversation_history: list = None, today_schedule: list = None):
        """
        LLM 응답 생성 (실행 시간 측정 포함)
        
        Args:
            user_message: 사용자의 메시지
            conversation_history: 이전 대화 기록 (옵션)
            today_schedule: 어르신의 오늘 일정 리스트 (옵션)
                예: [{"task": "병원 검진", "time": "오전 10시"}, {"task": "약 먹기", "time": "오후 2시"}]
        
        Returns:
            tuple: (AI 응답, 실행 시간)
        """
        try:
            start_time = time.time()
            logger.info(f"🤖 LLM 응답 생성 시작")
            logger.info(f"📥 사용자 입력: {user_message}")
            
            # ⚡ 캐시 체크 (초고속 응답)
            cached_response = self.response_cache.get_cached_response(user_message)
            if cached_response:
                elapsed_time = time.time() - start_time
                logger.info(f"⚡ 캐시 적중! 즉시 응답 ({elapsed_time:.3f}초)")
                logger.info(f"📤 캐시된 응답: {cached_response}")
                return cached_response, elapsed_time
            
            # 메시지 구성
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 오늘 일정이 있으면 컨텍스트로 추가 (최대 2개, 더 간결하게)
            if today_schedule:
                schedule_items = []
                for item in today_schedule[:2]:  # 최대 2개만 (토큰 절약)
                    task = item.get('task') or item.get('title')
                    if task:
                        time_str = item.get('time', '')
                        schedule_items.append(f"{task}({time_str})" if time_str else task)
                
                if schedule_items:
                    # 더 간결한 컨텍스트
                    schedule_context = ", ".join(schedule_items)
                    messages.append({"role": "system", "content": f"일정:{schedule_context}"})
                    logger.info(f"📅 {schedule_context}")
            
            # 대화 기록이 있으면 추가 (최근 3턴 = 6개 메시지, 맥락 유지)
            if conversation_history:
                messages.extend(conversation_history[-6:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            # GPT-4o-mini로 응답 생성 (Speed Priority)
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=40,  # 2문장 충분 (더 빠름)
                temperature=0.5,  # 속도 우선 (0.3은 느림)
            )
            
            ai_response = response.choices[0].message.content
            
            # 후처리: 규칙 강제 적용
            ai_response = self._post_process_response(ai_response, user_message)
            
            elapsed_time = time.time() - start_time
            
            logger.info(f"✅ LLM 응답 생성 완료 (소요 시간: {elapsed_time:.2f}초)")
            logger.info(f"📤 AI 응답: {ai_response}")
            
            return ai_response, elapsed_time
        except Exception as e:
            logger.error(f"❌ LLM 응답 생성 실패: {e}")
            raise
    
    async def generate_response_streaming(self, user_message: str, conversation_history: list = None, today_schedule: list = None):
        """
        스트리밍 방식으로 LLM 응답 생성 (실시간 최적화)
        
        이 메서드는 OpenAI의 stream=True 옵션을 사용하여
        응답이 생성되는 즉시 yield로 반환합니다.
        사용자는 AI가 말하는 것을 거의 실시간으로 들을 수 있습니다.
        
        Args:
            user_message: 사용자(어르신)의 메시지
            conversation_history: 이전 대화 기록 (옵션)
            today_schedule: 어르신의 오늘 일정 리스트 (옵션)
                예: [{"task": "병원 검진", "time": "오전 10시"}, {"task": "약 먹기", "time": "오후 2시"}]
        
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
            
            # ⚡ 캐시 체크 (초고속 응답)
            cached_response = self.response_cache.get_cached_response(user_message)
            if cached_response:
                elapsed_time = time.time() - start_time
                logger.info(f"⚡ 캐시 적중! 즉시 응답 ({elapsed_time:.3f}초)")
                logger.info(f"📤 캐시된 응답: {cached_response}")
                yield cached_response
                return
            
            # 메시지 구성
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 오늘 일정이 있으면 컨텍스트로 추가 (최대 2개, 더 간결하게)
            if today_schedule:
                schedule_items = []
                for item in today_schedule[:2]:  # 최대 2개만 (토큰 절약)
                    task = item.get('task') or item.get('title')
                    if task:
                        time_str = item.get('time', '')
                        schedule_items.append(f"{task}({time_str})" if time_str else task)
                
                if schedule_items:
                    # 더 간결한 컨텍스트
                    schedule_context = ", ".join(schedule_items)
                    messages.append({"role": "system", "content": f"일정:{schedule_context}"})
                    logger.info(f"📅 {schedule_context}")
            
            # 대화 기록이 있으면 추가 (최근 3턴 = 6개 메시지, 맥락 유지)
            if conversation_history:
                messages.extend(conversation_history[-6:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            # 스트리밍 API 호출
            # stream=True로 설정하면 응답이 생성되는 즉시 받을 수 있습니다
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=40,  # 2문장 충분 (더 빠름)
                temperature=0.5,  # 속도 우선 (0.3은 느림)
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
            통화 내용에서 일정 정보 추출 (버전 7: 영어 프롬프트, 한국어 응답)
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
                
                # 현재 시간을 프롬프트에 제공하여 시간 해석 오류 최소화
                current_time = datetime.now().strftime('%H:%M') 
                
                prompt = f"""
    Extract confirmed future schedules from the following conversation and return them in JSON format. The response MUST be in KOREAN.
    Current Time: {today.strftime('%Y-%m-%d')} ({current_weekday}) {current_time}
    Tomorrow: {tomorrow.strftime('%Y-%m-%d')}
    
    Conversation:
    {conversation_text}
    
    Extraction Rules:
    1. Extract only **confirmed and specific future schedules**. (Exclude past events, completed actions, 'about to do' actions, and vague/uncertain expressions).
    2. Convert relative dates (e.g., 'tomorrow') to **absolute dates** (YYYY-MM-DD format).
    3. If time is specified, include it in due_time as **HH:MM 24-hour format**.
       - **Time Inference:** If AM/PM is missing, infer the time based on the schedule's nature (e.g., hospital, meal) and the current time (e.g., '7 o'clock' is inferred as 07:00 or 19:00 based on context).
       - If no time, use **null**.
    4. **Category:** Choose one of MEDICINE, HOSPITAL, EXERCISE, MEAL, OTHER.
    5. **Title/Description:** Use only information found in the conversation. Write in **concise noun phrases or action-oriented verb phrases**. DO NOT use narrative sentence endings (~했다, ~받는다, ~있어요, etc.) or hallucinations.
    6. Extract a maximum of 5 schedules (in order of importance).
    
    Respond in the following JSON format (use an empty array if no schedules are found):
    {{
      "schedules": [
        {{
          "title": "가족과의 저녁 식사",
          "description": "가족들과 함께 저녁 식사하기", 
          "category": "MEAL", 
          "due_date": "{tomorrow.strftime('%Y-%m-%d')}",
          "due_time": "18:30"
        }}
      ]
    }}
    
    Note: Put schedules inside the 'schedules' array. If no schedules, return {{"schedules": []}}.
    """
                
                # (나머지 실행 로직은 동일하게 유지)
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=800,
                    temperature=0.2, 
                    response_format={"type": "json_object"}
                )
                
                # 응답이 한국어로 오도록 프롬프트에 'The response MUST be in KOREAN.' 명시
                result = response.choices[0].message.content
                logger.info(f"✅ 일정 추출 완료 ")
                return result
                
            except Exception as e:
                logger.error(f"❌ 일정 추출 실패: {e}")
                return '{"schedules": []}'
    
    def test_conversation_quality(self, test_messages: list):
        """
        대화 품질 테스트 함수 (개선 전후 비교용)
        
        Args:
            test_messages: 테스트할 사용자 메시지 리스트
        
        Returns:
            dict: 테스트 결과 (존댓말 준수율, 응답 적절성, 응답 속도)
        """
        results = {
            "total_tests": len(test_messages),
            "polite_responses": 0,
            "appropriate_responses": 0,
            "response_times": [],
            "responses": []
        }
        
        for i, message in enumerate(test_messages):
            logger.info(f"🧪 테스트 {i+1}/{len(test_messages)}: {message}")
            
            # 응답 생성 및 시간 측정
            response, elapsed_time = self.generate_response(message)
            results["response_times"].append(elapsed_time)
            
            # 존댓말 체크 (한국어 존댓말 패턴)
            polite_patterns = ["습니다", "세요", "시어요", "시지요", "시죠", "세요", "시네요", "시구나"]
            is_polite = any(pattern in response for pattern in polite_patterns)
            if is_polite:
                results["polite_responses"] += 1
            
            # 응답 적절성 체크 (간단한 키워드 기반)
            appropriate_keywords = ["어르신", "건강", "약", "식사", "운동", "날씨", "안녕", "어떻게", "지내"]
            is_appropriate = any(keyword in response for keyword in appropriate_keywords)
            if is_appropriate:
                results["appropriate_responses"] += 1
            
            results["responses"].append({
                "input": message,
                "output": response,
                "is_polite": is_polite,
                "is_appropriate": is_appropriate,
                "response_time": elapsed_time
            })
            
            logger.info(f"📝 응답: {response}")
            logger.info(f"⏱️ 응답 시간: {elapsed_time:.2f}초")
            logger.info(f"🙏 존댓말 사용: {'✅' if is_polite else '❌'}")
            logger.info(f"💬 적절한 응답: {'✅' if is_appropriate else '❌'}")
            logger.info("-" * 50)
        
        # 최종 결과 계산
        results["polite_rate"] = (results["polite_responses"] / results["total_tests"]) * 100
        results["appropriate_rate"] = (results["appropriate_responses"] / results["total_tests"]) * 100
        results["avg_response_time"] = sum(results["response_times"]) / len(results["response_times"])
        
        logger.info(f"📊 테스트 결과 요약:")
        logger.info(f"   존댓말 준수율: {results['polite_rate']:.1f}%")
        logger.info(f"   응답 적절성: {results['appropriate_rate']:.1f}%")
        logger.info(f"   평균 응답 시간: {results['avg_response_time']:.2f}초")
        
        return results
