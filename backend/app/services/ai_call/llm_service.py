"""
LLM (Large Language Model) 서비스
OpenAI GPT-4o 사용 (대화 생성 및 감정 분석)
"""

from openai import OpenAI
from app.config import settings
import logging
import time
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class LLMService:
    """대화 생성 및 텍스트 처리 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # GPT-4o-mini 모델 사용 (빠르고 경제적)
        self.model = "gpt-4o"
        
        # GRANDBY AI LLM System Prompt: Warm Neighbor Friend Character
        self.elderly_care_prompt = """You are a warm neighbor friend to Korean seniors. You talk with them regularly, so conversations feel comfortable and familiar.

⚠️ CRITICAL: Keep responses SHORT - Maximum 30 characters or 1 short sentence. Be concise and brief.

[Character - Warm Neighbor Friend]
- Chat casually and warmly like a friend who meets regularly with the elderly
- Use respectful Korean (존댓말) naturally but not formally
- Remember and mention the elderly's daily life, interests, and family stories
- Show genuine care and empathy for even small daily events

[First Greeting - Warm Familiarity]
"여보세요" → "여보세요~! 통화 괜찮으신가요? / 어르신~ 궁금해서 전화드렸어요!"
- Greet warmly with the feeling of someone who calls regularly
- Instead of just "네, 여보세요", add warm, simple questions like "~괜찮으신가요?"

[Time Awareness - Natural Context Recognition]
- Recognize the time of day during conversation and mention it naturally
- "오후니까 낮잠도 생각해봐요" / "점심 시간이네요"
- "저녁 다 드셨어요?" / "아침인데 일찍 오셨네요"
- Naturally bring up interests appropriate for the time

[Personalization - Remember the Elderly's Conversations]
- Appropriately mention family, hobbies, and interests from previous chats
- "그 아이들이~" (if family was mentioned before)
- "난초 물 주시는 거 왠지 힘드실 것 같아요" (if mentioned before)
- Remember the elderly's lifestyle and continue conversations together

[Natural Empathy - Like a Friend]
"TV 고장났어" → "아이고, TV 고장났어요? 큰일이네요."
"대청소 했어" → "대청소 하셨어요? 수고 많으셨어요~"
"외롭네요" → "외로우시겠어요. 제가 들어드릴게요."
"손자가 와요" → "손자분 오시는군요! 반가우실 것 같아요."

[Ask Questions Only with Context]
"어떤 약 먹어야 해?" → "약은 병원 선생님께 여쭤보는 게 좋을 것 같은데요."
"뭘 해야 할까?" → "지금 어떻게 되셨어요?"

[Absolutely Forbidden - AI Bot-like Expressions]
❌ "도와드릴게요", "필요하시면 말씀해 주세요"
❌ "~드릴 수 있습니다", "확인해 드리겠습니다"
❌ "이해했습니다", "확인했습니다"
❌ "전화 끊겠습니다"

[Abstract Questions Absolutely Forbidden]
❌ "어떻게 지내세요?" / "어떠세요?" / "어떤 기분이세요?"
❌ "무엇이 궁금하신가요?" / "왜 그러세요?"
- Only react to specific situations

[Natural Sentence Endings - Friendly Honorifics]
✅ Good: "~어요", "~네요", "~구나", "~죠"
✅ Good: "~세요", "~셔요", "~지요"
⚠️ Avoid: "~습니다" (too formal)
❌ Forbidden: Informal speech (반말)

[Conversation Flow]
1. Listen to the elderly and empathize sincerely
2. React naturally like a friend ("그러게요", "아이고", "그렇구나")
3. Naturally bring up time or situation-appropriate comments
4. React personally while remembering previous conversations
5. Never end the conversation yourself"""
    
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
        
        # 1. 문장 수 제한 (최대 1문장) - 강제 적용 (통화 중 끊김 방지)
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
        
        # 1문장으로 제한 (강제) - 통화 중 끊김 방지
        if len(complete_sentences) > 1:
            response = complete_sentences[0]  # 첫 번째 문장만 사용
            logger.info(f"🔧 문장 수 제한: {len(complete_sentences)}개 → 1개 (통화 끊김 방지)")
        else:
            response = " ".join(complete_sentences)
        
        # 마지막에 구두점이 없으면 추가
        if response and response[-1] not in '.!?':
            response += "."
        
        # 2. 금지 패턴 감지 및 제거 (AI 봇 표현 + 대화 품질 문제)
        banned_patterns = [
            # AI 봇처럼 들리는 표현 (최우선 차단)
            (r'도와드릴', '금지: AI 봇 표현'),
            (r'필요하시면.*말씀', '금지: AI 봇 표현'),
            (r'알려드릴', '금지: AI 봇 표현'),
            (r'확인해.*드리', '금지: AI 봇 표현'),
            (r'해드릴.*수', '금지: AI 봇 표현'),
            (r'할.*수.*있습니다', '금지: AI 봇 표현'),
            (r'통화.*종료|전화.*끊겠', '금지: AI 봇 표현'),
            
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
            
            # 금지 키워드: 추상적 질문 (대화 품질 저하)
            (r'어떤.*물어보', '금지: 추상적 질문'),
            (r'무슨.*궁금', '금지: 추상적 질문'),
            (r'어떤 기분인지', '금지: 추상적 질문'),
            (r'어떻게.*되셨는지', '금지: 추상적 질문'),
            (r'왜.*그런지', '금지: 원인 추궁'),
            (r'언제.*되셨는지', '금지: 시간 추궁'),
            (r'어떤.*보고.*신가요', '금지: 추상적 질문'),
            (r'어떤.*프로그램.*봐', '금지: 추상적 질문'),
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
        금지 패턴 발견 시 안전한 공감 응답 생성 (더 자연스럽게)
        
        Args:
            user_message: 사용자 메시지
            
        Returns:
            str: 안전한 공감 응답
        """
        # 감정 키워드 기반 자연스러운 공감 응답
        if any(word in user_message for word in ['아프', '힘들', '고통', '통증']):
            return "아이고, 많이 힘드시겠어요. 괜찮으신가요?"
        elif any(word in user_message for word in ['외롭', '쓸쓸', '혼자', '아무도']):
            return "외로우시겠어요. 저도 그래서 할 말 있어요."
        elif any(word in user_message for word in ['슬프', '우울', '속상', '걱정']):
            return "속상하시겠어요. 무슨 일 있으셨나요?"
        elif any(word in user_message for word in ['자식', '아들', '딸', '손주']):
            return "가족분들 생각나시겠어요. 많이 보고 싶으시겠어요."
        elif any(word in user_message for word in ['기쁨', '좋아', '즐거', '행복']):
            return "좋으시네요. 기분이 좋아 보이세요."
        else:
            return "그러시구나. 잘 듣고 있어요."
    
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
    
    def extract_contextual_info(self, user_message: str, conversation_history: list = None) -> dict:
        """
        대화에서 핵심 정보 추출 (가족, 취미, 건강, 일상 패턴 등)
        
        Args:
            user_message: 사용자 메시지
            conversation_history: 이전 대화 기록
            
        Returns:
            dict: 추출된 핵심 정보
        """
        try:
            # 전체 대화 텍스트 구성
            full_conversation = ""
            if conversation_history:
                for msg in conversation_history[-10:]:  # 최근 10개 메시지만
                    role = "사용자" if msg['role'] == 'user' else "AI"
                    full_conversation += f"{role}: {msg['content']}\n"
            full_conversation += f"사용자: {user_message}"
            
            prompt = f"""다음 대화에서 어르신의 핵심 정보를 추출해주세요.

대화 내용:
{full_conversation}

추출할 정보:
1. 가족 관계 (아들, 딸, 손자, 며느리 등)
2. 취미/관심사 (TV, 독서, 산책, 요리 등)
3. 건강 상태 (약, 병원, 증상 등)
4. 일상 패턴 (시간대별 활동, 습관 등)
5. 거주지/환경 (집, 동네, 시설 등)

JSON 형식으로 응답:
{{
    "family": ["가족 관계 정보"],
    "hobbies": ["취미/관심사"],
    "health": ["건강 관련 정보"],
    "daily_patterns": ["일상 패턴"],
    "location": ["거주지/환경"],
    "keywords": ["주요 키워드"]
}}

정보가 없으면 빈 배열로 표시하세요."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            logger.info(f"📝 맥락 정보 추출 완료: {len(result.get('keywords', []))}개 키워드")
            return result
            
        except Exception as e:
            logger.error(f"❌ 맥락 정보 추출 실패: {e}")
            return {
                "family": [],
                "hobbies": [],
                "health": [],
                "daily_patterns": [],
                "location": [],
                "keywords": []
            }
    
    def _get_emotion_based_tone(self, emotion_context: dict) -> str:
        """
        감정 분석 결과에 따른 응답 톤 조정
        
        Args:
            emotion_context: 감정 분석 결과
            
        Returns:
            str: 감정에 맞는 응답 톤 지시사항
        """
        emotion = emotion_context.get('emotion', 'neutral')
        urgency = emotion_context.get('urgency', 'low')
        keywords = emotion_context.get('keywords', [])
        
        tone_guidelines = {
            'negative': {
                'low': "어르신이 부정적인 기분일 때는 더 따뜻하고 위로하는 톤으로 응답하세요. '아이고', '많이 힘드셨겠어요' 같은 표현을 사용하세요.",
                'medium': "어르신이 걱정스러워할 때는 안심시키는 톤으로 응답하세요. '괜찮을 거예요', '걱정하지 마세요' 같은 표현을 사용하세요.",
                'high': "긴급하거나 심각한 상황일 때는 신중하고 도움이 되는 톤으로 응답하세요. '병원에 가보시는 게 좋을 것 같아요' 같은 조언을 하세요."
            },
            'concerned': {
                'low': "걱정스러워하는 어르신에게는 안심시키는 톤으로 응답하세요. '괜찮을 거예요', '걱정하지 마세요' 같은 표현을 사용하세요.",
                'medium': "중간 정도 걱정일 때는 현실적이면서도 위로하는 톤으로 응답하세요.",
                'high': "심각한 걱정일 때는 신중하고 도움이 되는 톤으로 응답하세요."
            },
            'positive': {
                'low': "긍정적인 기분일 때는 함께 기뻐하는 톤으로 응답하세요. '좋으시네요', '기분이 좋아 보이세요' 같은 표현을 사용하세요.",
                'medium': "기쁜 일이 있을 때는 더 활기차게 응답하세요.",
                'high': "매우 기쁜 일일 때는 함께 축하하는 톤으로 응답하세요."
            },
            'neutral': {
                'low': "평범한 대화일 때는 자연스럽고 친근한 톤으로 응답하세요.",
                'medium': "일반적인 대화일 때는 편안한 톤으로 응답하세요.",
                'high': "중요한 내용일 때는 진지하면서도 친근한 톤으로 응답하세요."
            }
        }
        
        return tone_guidelines.get(emotion, {}).get(urgency, "자연스럽고 친근한 톤으로 응답하세요.")
    
    def _build_personalization_context(self, contextual_info: dict) -> str:
        """
        맥락 정보를 기반으로 개인화된 응답 컨텍스트 구성
        
        Args:
            contextual_info: 추출된 맥락 정보
            
        Returns:
            str: 개인화된 응답 지시사항
        """
        context_parts = []
        
        # 가족 관계
        if contextual_info.get('family'):
            family_info = ", ".join(contextual_info['family'])
            context_parts.append(f"가족: {family_info} - 가족 얘기할 때 자연스럽게 언급하세요")
        
        # 취미/관심사
        if contextual_info.get('hobbies'):
            hobbies_info = ", ".join(contextual_info['hobbies'])
            context_parts.append(f"취미: {hobbies_info} - 관심사에 대해 물어보거나 언급하세요")
        
        # 건강 상태
        if contextual_info.get('health'):
            health_info = ", ".join(contextual_info['health'])
            context_parts.append(f"건강: {health_info} - 건강 상태를 염려하며 물어보세요")
        
        # 일상 패턴
        if contextual_info.get('daily_patterns'):
            patterns_info = ", ".join(contextual_info['daily_patterns'])
            context_parts.append(f"일상: {patterns_info} - 일상 패턴을 기억하고 언급하세요")
        
        # 거주지/환경
        if contextual_info.get('location'):
            location_info = ", ".join(contextual_info['location'])
            context_parts.append(f"환경: {location_info} - 거주지나 환경에 대해 언급하세요")
        
        if context_parts:
            return " | ".join(context_parts)
        return ""
    
    def _get_time_based_context(self, current_time: datetime = None) -> str:
        """
        현재 시간을 기반으로 시간대별 맞춤 응답 컨텍스트 생성
        
        Args:
            current_time: 현재 시간 (기본값: 현재 시간)
            
        Returns:
            str: 시간대별 응답 지시사항
        """
        if not current_time:
            current_time = datetime.now()
        
        hour = current_time.hour
        weekday = current_time.weekday()  # 0=월요일, 6=일요일
        
        # 시간대별 응답 패턴
        time_patterns = {
            'morning': {
                'hours': range(6, 12),
                'context': "아침 시간입니다. '아침 드셨어요?', '오늘 아침은 어떠세요?' 같은 아침 인사를 자연스럽게 하세요.",
                'topics': ["아침 식사", "날씨", "오늘 계획", "잠자리"]
            },
            'afternoon': {
                'hours': range(12, 18),
                'context': "오후 시간입니다. '점심 드셨어요?', '오후에 뭐 하세요?' 같은 오후 대화를 자연스럽게 하세요.",
                'topics': ["점심", "낮잠", "TV", "산책", "손자"]
            },
            'evening': {
                'hours': range(18, 22),
                'context': "저녁 시간입니다. '저녁 준비하세요?', '오늘 하루는 어떠셨어요?' 같은 저녁 대화를 자연스럽게 하세요.",
                'topics': ["저녁 식사", "하루 정리", "가족", "TV 프로그램"]
            },
            'night': {
                'hours': range(22, 24),
                'context': "밤 시간입니다. '늦으셨네요', '피곤하실 것 같아요' 같은 배려하는 말을 자연스럽게 하세요.",
                'topics': ["잠자리", "피로", "내일 계획"]
            },
            'late_night': {
                'hours': range(0, 6),
                'context': "새벽 시간입니다. '일찍 오셨네요', '잠 못 주무셨나요?' 같은 걱정하는 말을 자연스럽게 하세요.",
                'topics': ["잠", "건강", "걱정"]
            }
        }
        
        # 요일별 특별한 맥락
        weekday_context = {
            0: "월요일이네요. 새로운 한 주 시작이에요.",
            1: "화요일이네요. 한 주가 잘 흘러가고 있어요.",
            2: "수요일이네요. 한 주의 중간이에요.",
            3: "목요일이네요. 주말이 다가오고 있어요.",
            4: "금요일이네요. 주말이 기다려지시겠어요.",
            5: "토요일이네요. 주말 잘 보내세요.",
            6: "일요일이네요. 휴일 잘 보내세요."
        }
        
        # 시간대 찾기
        current_pattern = None
        for pattern_name, pattern_info in time_patterns.items():
            if hour in pattern_info['hours']:
                current_pattern = pattern_info
                break
        
        if not current_pattern:
            current_pattern = time_patterns['morning']  # 기본값
        
        # 시간대별 컨텍스트 구성
        time_context = current_pattern['context']
        
        # 요일 컨텍스트 추가
        weekday_info = weekday_context.get(weekday, "")
        if weekday_info:
            time_context += f" {weekday_info}"
        
        # 구체적인 시간 언급
        if hour < 12:
            time_context += f" 현재 {hour}시입니다."
        elif hour < 18:
            time_context += f" 현재 오후 {hour-12}시입니다."
        elif hour < 22:
            time_context += f" 현재 저녁 {hour-12}시입니다."
        else:
            time_context += f" 현재 밤 {hour-12}시입니다."
        
        return time_context
    
    def generate_response(self, user_message: str, conversation_history: list = None, today_schedule: list = None, emotion_context: dict = None, contextual_info: dict = None):
        """
        LLM 응답 생성 (실행 시간 측정 포함)
        
        Args:
            user_message: 사용자의 메시지
            conversation_history: 이전 대화 기록 (옵션)
            today_schedule: 어르신의 오늘 일정 리스트 (옵션)
                예: [{"task": "병원 검진", "time": "오전 10시"}, {"task": "약 먹기", "time": "오후 2시"}]
            emotion_context: 감정 분석 결과 (옵션)
                예: {"emotion": "negative", "urgency": "medium", "keywords": ["아프", "힘들"]}
            contextual_info: 맥락 정보 (옵션)
                예: {"family": ["아들", "손자"], "hobbies": ["TV", "산책"]}
        
        Returns:
            tuple: (AI 응답, 실행 시간)
        """
        try:
            start_time = time.time()
            logger.info(f"🤖 LLM 응답 생성 시작")
            logger.info(f"📥 사용자 입력: {user_message}")
            
            # ⚡ 캐시 체크 제거 (불필요한 오버헤드)
            # 현재 캐시는 매우 제한적이며 실제 대화에서는 거의 작동하지 않음
            # 캐시 체크 로직 제거로 오버헤드 감소
            
            # 메시지 구성
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 감정 기반 응답 톤 조정
            if emotion_context:
                emotion_tone = self._get_emotion_based_tone(emotion_context)
                if emotion_tone:
                    messages.append({"role": "system", "content": f"[감정 기반 응답 톤] {emotion_tone}"})
                    logger.info(f"😊 감정 기반 톤 적용: {emotion_context.get('emotion', 'unknown')}")
            
            # 맥락 정보 기반 개인화 응답
            if contextual_info:
                personalization_context = self._build_personalization_context(contextual_info)
                if personalization_context:
                    messages.append({"role": "system", "content": f"[개인화 맥락] {personalization_context}"})
                    logger.info(f"👤 개인화 맥락 적용: {len(contextual_info.get('keywords', []))}개 키워드")
            
            # 시간대별 맞춤 응답 컨텍스트
            time_context = self._get_time_based_context()
            if time_context:
                messages.append({"role": "system", "content": f"[시간대별 컨텍스트] {time_context}"})
                logger.info(f"🕐 시간대별 컨텍스트 적용")
            
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
            
            # 대화 기록이 있으면 추가 (최근 4턴 = 8개 메시지, 맥락 유지)
            if conversation_history:
                messages.extend(conversation_history[-8:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            # GPT-4o-mini로 응답 생성 (Speed Priority)
            api_start_time = time.time()
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=25,  # 짧고 간결하게 (1문장 권장)
                temperature=0.5,  # 속도 우선 (0.3은 느림)
            )
            
            # TTFT 측정 (Time To First Token)
            ttft = time.time() - api_start_time
            
            ai_response = response.choices[0].message.content
            
            # 후처리: 규칙 강제 적용
            ai_response = self._post_process_response(ai_response, user_message)
            
            elapsed_time = time.time() - start_time
            
            logger.info(f"✅ LLM 응답 생성 완료")
            logger.info(f"⏱️ 전체 소요 시간: {elapsed_time:.2f}초 | TTFT: {ttft:.2f}초")
            logger.info(f"📤 AI 응답: {ai_response}")
            
            return ai_response, elapsed_time
        except Exception as e:
            logger.error(f"❌ LLM 응답 생성 실패: {e}")
            raise
    
    async def generate_response_streaming(self, user_message: str, conversation_history: list = None, today_schedule: list = None, emotion_context: dict = None, contextual_info: dict = None):
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
            emotion_context: 감정 분석 결과 (옵션)
                예: {"emotion": "negative", "urgency": "medium", "keywords": ["아프", "힘들"]}
            contextual_info: 맥락 정보 (옵션)
                예: {"family": ["아들", "손자"], "hobbies": ["TV", "산책"]}
        
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
            
            # ⚡ 캐시 체크 제거 (불필요한 오버헤드)
            # 현재 캐시는 매우 제한적이며 실제 대화에서는 거의 작동하지 않음
            # 캐시 체크 로직 제거로 오버헤드 감소
            
            # 메시지 구성
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 감정 기반 응답 톤 조정
            if emotion_context:
                emotion_tone = self._get_emotion_based_tone(emotion_context)
                if emotion_tone:
                    messages.append({"role": "system", "content": f"[감정 기반 응답 톤] {emotion_tone}"})
                    logger.info(f"😊 감정 기반 톤 적용: {emotion_context.get('emotion', 'unknown')}")
            
            # 맥락 정보 기반 개인화 응답
            if contextual_info:
                personalization_context = self._build_personalization_context(contextual_info)
                if personalization_context:
                    messages.append({"role": "system", "content": f"[개인화 맥락] {personalization_context}"})
                    logger.info(f"👤 개인화 맥락 적용: {len(contextual_info.get('keywords', []))}개 키워드")
            
            # 시간대별 맞춤 응답 컨텍스트
            time_context = self._get_time_based_context()
            if time_context:
                messages.append({"role": "system", "content": f"[시간대별 컨텍스트] {time_context}"})
                logger.info(f"🕐 시간대별 컨텍스트 적용")
            
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
            
            # 대화 기록이 있으면 추가 (최근 4턴 = 8개 메시지, 맥락 유지)
            if conversation_history:
                messages.extend(conversation_history[-8:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            # 스트리밍 API 호출
            # stream=True로 설정하면 응답이 생성되는 즉시 받을 수 있습니다
            api_start_time = time.time()
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=25,  # 짧고 간결하게 (1문장 권장)
                temperature=0.5,  # 속도 우선 (0.3은 느림)
                stream=True  # ⭐ 핵심: 스트리밍 활성화
            )
            
            full_response = []  # 전체 응답 저장용
            ttft = None  # TTFT 측정용
            
            # 스트리밍으로 받은 청크를 즉시 yield
            for chunk in stream:
                # delta.content가 있으면 생성된 텍스트 조각입니다
                if chunk.choices[0].delta.content:
                    # TTFT 측정 (첫 토큰 수신 시점)
                    if ttft is None:
                        ttft = time.time() - api_start_time
                        logger.info(f"⚡ 첫 토큰 수신! TTFT: {ttft:.2f}초")
                    
                    content = chunk.choices[0].delta.content
                    full_response.append(content)
                    yield content  # 즉시 반환 (TTS가 바로 처리 가능)
            
            elapsed_time = time.time() - start_time
            final_text = "".join(full_response)
            
            logger.info(f"✅ LLM 스트리밍 완료")
            logger.info(f"⏱️ 전체 소요 시간: {elapsed_time:.2f}초 | TTFT: {ttft:.2f}초" if ttft else f"⏱️ 전체 소요 시간: {elapsed_time:.2f}초")
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
