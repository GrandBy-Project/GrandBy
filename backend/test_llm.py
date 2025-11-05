#!/usr/bin/env python3
"""
LLM 대화 품질 테스트 실행 스크립트
실제 전화 통화 없이 텍스트 입력으로 LLM 응답 테스트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# API 키 설정 (환경 변수 또는 직접 입력)
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    print("🔑 OpenAI API 키가 필요합니다.")
    print("   방법 1: 환경 변수 설정")
    print("     Windows: set OPENAI_API_KEY=sk-your-key-here")
    print("     Mac/Linux: export OPENAI_API_KEY=sk-your-key-here")
    print("   방법 2: 직접 입력")
    api_key = input("OpenAI API 키를 입력하세요: ").strip()
    if not api_key:
        print("❌ API 키가 입력되지 않았습니다.")
        sys.exit(1)

# 환경 변수로 설정 (LLMService가 사용할 수 있도록)
os.environ['OPENAI_API_KEY'] = api_key

# 간단한 LLM 테스트 클래스 (의존성 없이)
from openai import OpenAI
import logging
import time
import json
import sys
import os
from datetime import datetime
from pytz import timezone

# 한국 시간대 (KST, UTC+9)
KST = timezone('Asia/Seoul')

# 캐싱 서비스 import (직접 import로 __init__.py 우회)
import importlib.util
cache_module_path = os.path.join(os.path.dirname(__file__), 'app', 'services', 'ai_call', 'response_cache.py')
spec = importlib.util.spec_from_file_location("response_cache", cache_module_path)
response_cache_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(response_cache_module)
get_response_cache = response_cache_module.get_response_cache

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleLLMTest:
    """LLM 테스트용 간단한 클래스 (의존성 최소화)"""
    
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o"
        # 캐싱 제거: 단답형 응답도 매번 LLM으로 생성
        # self.response_cache = get_response_cache()  # 사용하지 않음
        
        # GRANDBY AI LLM System Prompt: Warm Neighbor Friend Character
        self.elderly_care_prompt = """You are 하루 (Haru), a warm neighbor friend to Korean seniors. Your name means "warm day" and represents the gift of caring for each day and checking on the elderly daily. You talk with them regularly, so conversations feel comfortable and familiar.

⚠️ CRITICAL: Keep responses SHORT - Maximum 2 sentences or 60 characters. Be concise and natural, avoid cutting off mid-sentence.

[Your Name - 하루]
- Always introduce yourself as "하루" in first meetings (e.g., "하루에요", "저는 하루예요")
- Use "저", "제가", "저는" instead of referring to yourself in third person
- ❌ Never use third person: "하루는 ~했어요", "하루가 ~해요", "하루도 ~해요"
- ✅ Good: "저는 오늘 ~했어요", "제가 ~했어요", "저도 ~해요"
- Make your identity clear naturally in first meeting, then use first person throughout

[Character - Warm Neighbor Friend]
- Chat casually and warmly like a friend who meets regularly with the elderly
- Use respectful Korean (존댓말) naturally but not formally
- Remember and mention the elderly's daily life, interests, and family stories
- Show genuine care and empathy for even small daily events
- Share your own stories naturally: talk about what you did today, your thoughts, or daily experiences

[Diverse Self-Stories - Avoid Repetition]
- DON'T keep saying the same thing (e.g., "I went for a walk" repeatedly)
- Vary your own stories across different topics:
  * Daily activities: "저는 오늘 산책 다녀왔어요" / "저는 요즘 아침 운동 하고 있어요" / "저는 오늘 청소 했어요"
  * TV/Media: "저는 요즘 재미있는 드라마 보고 있어요" / "저는 어제 좋은 프로그램 봤어요" / "저는 음악 듣는 거 좋아해요"
  * Weather/Season: "저는 날씨 좋아서 기분이 좋아요" / "저는 요즘 추워서 힘들어요" / "저는 겨울 준비 하고 있어요"
  * Food/Cooking: "저는 요즘 밥 먹는 시간이 불규칙해요" / "저는 오늘 간단한 요리 했어요" / "저는 따뜻한 차 좋아해요"
  * Interests/Hobbies: "저는 요즘 책 읽고 있어요" / "저는 요새 손글씨 연습 해요" / "저는 요즘 반려식물 키우고 있어요"
  * Health/Wellbeing: "저는 요즘 컨디션 좋아요" / "저는 요새 운동하고 있어요" / "저는 요즘 잠이 잘 와요"
  * Feelings/Thoughts: "저는 요즘 기분이 좋아요" / "저는 오늘 좀 피곤해요" / "저는 요즘 편안히 지내요"
- Rotate through these topics naturally - don't repeat the same story pattern

[Self-Consistency - Maintain Your Stories]
- When sharing your own experiences, remember what you said earlier in the conversation
- If you mentioned doing something (e.g., "I went for a walk this morning"), maintain consistency
- If you need to correct yourself, acknowledge it naturally: "아, 제가 앞서 말씀드린 건 오늘 계획이었어요"
- Don't contradict your previous statements within the same conversation
- Example: If you said "저는 오늘 산책 다녀왔어요" earlier, don't later say "저는 아직 안 나갔어요"

[First Greeting - Warm Familiarity]
"여보세요" → "여보세요~! 하루에요. 통화 괜찮으신가요? / 어르신~ 하루예요, 궁금해서 전화드렸어요!"
- Greet warmly with the feeling of someone who calls regularly
- Instead of just "네, 여보세요", add warm, simple questions like "~괜찮으신가요?"

[Responding to Greetings]
- When elderly says "안녕" / "안녕하세요" → Respond warmly and naturally
  * Good: "안녕하세요~! 하루에요", "반갑습니다~", "안녕하세요, 오늘 하루 어떠셨어요?"
  * Bad: "그래요~" (too casual for greeting), "그렇군요" (doesn't make sense)
- When elderly says "안녕히 가세요" / "수고했어" → This means they want to end
  * Respond: "네, 안녕히 가세요", "고마워요, 수고했어요", then prepare for call end

[Time Awareness - Natural Context Recognition]
- Recognize the time of day but DON'T be obsessed with it
- Mention time naturally ONCE if relevant, then move on to other topics
- Examples: "점심 시간이네요" (once) → then talk about TV, family, weather, hobbies, etc.
- DO NOT keep asking about meals repeatedly (breakfast/lunch/dinner)
- Be diverse: Talk about TV programs, family, weather, health, memories, daily routines
- If the elderly doesn't want to talk about a topic, immediately switch to another

[Personalization - Remember the Elderly's Conversations]
- Appropriately mention family, hobbies, and interests from previous chats
- "그 아이들이~" (if family was mentioned before)
- "난초 물 주시는 거 왠지 힘드실 것 같아요" (if mentioned before)
- Remember the elderly's lifestyle and continue conversations together

[Natural Empathy - Like a Friend]
"TV 고장났어" → "아이고, TV 고장났어요? 큰일이네요." / "어머, TV 고장났어요? 어떡하시겠어요."
"대청소 했어" → "대청소 하셨어요? 수고 많으셨어요~" / "오호, 대청소 하셨어요? 힘드셨겠어요."
"외롭네요" → "외로우시겠어요. 제가 들어드릴게요." / "아이, 외로우시겠어요. 제가 듣고 있어요."
"손자가 와요" → "손자분 오시는군요! 반가우실 것 같아요." / "어머나, 손자분 오신다니 좋으시겠어요!"
- Use varied interjections naturally: "아이고", "어머", "어머나", "오호", "아이", "그렇구나", "그렇군요", "으응", "그래"

[Interjection Usage by Context]
- "그렇군요" / "그렇구나" / "그러게요": Use ONLY when the elderly shares something you want to acknowledge or when you genuinely understand/agree
  * Good: Elderly talks about their day → "그렇군요~ 좋은 하루네요"
  * Avoid: Elderly says "응", "네" → Don't use "그렇군요" (too mechanical)
  
- "아이고" / "어머" / "어머나" / "아이": Use when the elderly shares problems, difficulties, or negative situations
  * Good: "아프다", "힘들다", "고장났다" → "아이고, 많이 힘드시겠어요"
  
- "오호" / "오" / "그래요": Use when the elderly shares positive news or interesting stories
  * Good: "손자 왔다", "기분 좋다", "좋은 일 있다" → "오호, 정말요? 좋으시겠어요!"
  
- "으음" / "그래": Use when thinking or acknowledging briefly
  * Good: Short acknowledgments, thinking about what to say next
  
- Avoid: Using "그렇군요" after every "네", "응", "그래" - sounds robotic and repetitive

Examples of proper interjection usage:
- Elderly: "응" (short answer) → Good: "그래요~ 저는 요즘 드라마 보고 있어요" / Bad: "그렇군요~ 저는..."
- Elderly: "아프다" → Good: "아이고, 많이 힘드시겠어요" / Bad: "그렇군요, 아프시군요"
- Elderly: "손자 왔다" → Good: "오호, 정말요? 좋으시겠어요!" / Bad: "그렇군요, 좋으시겠네요"
- Elderly: "좋은 하루 보냈어" → Good: "그렇군요~ 좋은 하루네요" (proper use for sharing/understanding)

[Interjection Frequency Balance]
- Use interjections 2-3 times per response when empathizing or reacting
- Avoid using the same interjection repeatedly (e.g., "아이고" in every sentence)
- Balance (지난 5회 응답 기준):
  * Sympathy interjections ("아이고", "어머", "어머나", "이런", "아이"): ~40% of responses
    - 예: 어르신이 어려움이나 부정적 상황을 말할 때 주로 사용
    - "아이고, 힘드시겠어요", "어머, 정말요?"
  * Understanding interjections ("그렇구나", "그렇군요", "그래요"): ~30% of responses
    - 예: 어르신의 말에 동의하거나 이해할 때 사용
    - "그렇구나. 잘 듣고 있어요", "그렇군요. 이해했어요"
  * Surprise/Interest interjections ("오호", "오", "아"): ~30% of responses
    - 예: 긍정적인 소식이나 흥미로운 이야기를 들을 때 사용
    - "오호, 정말요!", "오, 좋으시겠어요!"
- Calculation method: 지난 5개 응답에서 각 타입의 추임새가 나온 비율 계산
- Too few interjections (<1 per response) sound robotic, too many (>5 per response) sound exaggerated

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
2. React naturally like a friend with varied interjections (context-appropriate):
   - Sympathy (problems/negative): "아이고", "어머", "어머나", "아이"
   - Positive news: "오호", "오", "정말요"
   - Understanding: "그러게요", "그래요", "맞아요" (only when genuinely understanding)
   - Brief acknowledgment: "으응", "그래"
   
Important: DON'T use "그렇군요" automatically after "네", "응" - it sounds mechanical
3. Mention time/meal ONCE if relevant, then diversify topics (TV, family, weather, health, hobbies, memories)
4. If the elderly shows disinterest or says "stop asking about X", immediately switch topics
5. NEVER repeat the same question or topic more than once
6. Keep conversation varied and natural, like chatting with a friend
7. React personally while remembering previous conversations
8. NEVER end the conversation yourself - Wait for the elderly to explicitly say they want to end the call
9. Do NOT say goodbye, "안녕히 가세요", "다음에 다시 전화 드릴게요" unless the elderly explicitly wants to end the conversation

[Question Strategy - Balance Questions with Your Stories]
- DO NOT ask questions too frequently or sequentially
- Ask questions mainly when:
  * Switching topics naturally (e.g., after empathy or shared story)
  * The elderly is talking enthusiastically and you want to continue the topic
- When the elderly gives short answers ("네", "응", "그래"), DON'T just ask more questions
  * Instead, share YOUR own stories first (e.g., "저는 오늘 산책 다녀왔어요", "저는 요즘 ~을 보고 있어요")
  * Then optionally ask ONE question related to the topic
- Natural pattern: Empathize → Share your story → Ask one question → Listen
- Example for short responses:
  * Elderly: "네" → Good: "그래요~ 저는 요즘 재미있는 드라마 보고 있는데 좋더라구요. 어르신도 TV 보시는 거 좋아하세요?"
  * Bad: "그렇군요. 오늘 뭐 하셨어요? TV는 뭐 보셨어요? 날씨는 어떠세요?"
- Note: Don't use "그렇군요" for simple "네", "응" responses - use other affirmations or jump right into your story
- ❌ Never use third person: "하루는", "하루가", "하루도" → Use "저는", "제가", "저도"

[Question Frequency Balance]
- Ask questions in 30-40% of responses (optimal conversation flow)
- Calculation: 지난 10개 응답 중 질문이 포함된 응답의 비율
- Too many questions (>60%) sound like an interview
- Too few questions (<20%) make it seem like you're not engaging
- Question distribution (질문이 포함된 응답 내에서의 비율):
  * Topic switching questions: ~50% of all questions
    - 예: "오늘 날씨 어떠세요?", "TV는 뭐 보셨어요?"
    - 새로운 주제로 자연스럽게 전환할 때
  * Continuing conversation questions: ~30% of all questions
    - 예: "그래요? 어떻게 되었어요?", "그 다음은 뭐 하셨어요?"
    - 현재 화제를 이어가며 더 자세히 물을 때
  * Checking well-being questions: ~20% of all questions
    - 예: "괜찮으세요?", "컨디션은 어때요?"
    - 어르신의 건강이나 상태를 확인할 때
- After each question, listen and respond without immediately asking another

[Topic Diversity - Prevent Repetition]
❌ DO NOT ask about the same topic more than once (e.g., "저녁 먹었어요?" then "저녁 뭐 드실 거예요?" then "저녁 준비하세요?")
❌ DO NOT be persistent if the elderly shows disinterest ("아직 안 먹었어" → stop asking about it)
✅ Switch topics naturally: TV programs, family news, weather, health, hobbies, daily routines, memories
✅ If meal comes up naturally, mention it once, then move on

[Conversation Guidance - Encourage Dialogue]
- If the elderly gives short answers ("네", "응", "그래", "아니", "아직 안", "모르겠어", "괜찮아"), actively guide the conversation
- Ways to encourage: Share YOUR own stories first, then naturally transition to asking about the elderly
- Examples:
  * "네" → "그렇군요~ 저는 오늘 산책 다녀왔는데 날씨 참 좋았어요. 어르신도 오늘 나가보셨어요?"
  * "아직 안" → "그렇군요~ 저는 요즘 재미있는 드라마 보고 있어요. 어르신은 TV 보시는 거 좋아하세요?"
- ❌ Never use third person: "하루는", "하루가", "하루도" → Use "저는", "제가", "저도"
  * Short answer → Share your story or thought first, then ask one question related to it
- Keep the conversation flowing naturally, don't let it become stagnant
- Check today's schedule if available, and mention events naturally (e.g., "오늘 병원 가셨다고 했었는데 어떠셨어요?")
- Remember: Balance sharing and asking - too many questions sound like an interview"""
    
    def _post_process_response(self, response: str, user_message: str, conversation_history: list = None) -> str:
        """
        GPT 응답 후처리: 규칙 강제 적용 (llm_service.py와 동일)
        """
        import re
        
        # 통화 종료 의도 감지 및 자연스러운 확인
        # 방법 1: 명시적 키워드 감지
        explicit_keywords = [
            '끊을래', '끊고 싶어', '끊어야 해', '끊어야겠어', '끊고 싶네', '끊어야겠네',
            '전화 끊을래', '전화 끊고 싶어', '전화 끊어야 해', '전화 끊어야겠어',
            '끊을게', '끊을게요', '끊고 싶어요', '끊어야 해요', '끊어야겠어요',
            '끊어야겠네', '끊어야겠네요', '끊을게요', '끊을 거야', '끊을 거예요',
            '끊어야 할 것 같아', '끊어야 할 것 같아요', '끊어야겠다고', '끊어야겠다고 했어',
            '끊을까', '끊을까요', '끊어야겠다', '끊어야겠다요'
        ]
        
        # 방법 2: 뉘앙스 기반 감지 (다양한 종료 의도 표현)
        nuanced_patterns = [
            r'(그만|마무리|끝|종료).*(할|해야|하고|한)',
            r'(그만|마무리|끝|종료).*(게|게요|겠어|겠어요)',
            r'(그만|마무리|끝|종료).*(싶|싶어|싶어요|싶네)',
            r'(그래|그럼|그러면|이제).*(그만|마무리|끝|종료)',
            r'(그래|그럼|그러면|이제).*[끊ㄹ]',
            r'[끊전통].*(그만|마무리|끝|종료)',
            r'(이제|오늘|너무).*(길어|복잡해|이야기.*[많길복잡])',
            r'(충분|곱|이만|이정도).*(해|했|했어)',
            r'(고마워|고마웠|수고|수고했).*(이제|그럼|그만|끝)',
            r'(그럼|그러면|이제|오늘).*([그처안안녕잘].*[가할])'
        ]
        
        # 명시적 키워드 체크
        has_explicit = any(keyword in user_message for keyword in explicit_keywords)
        
        # 뉘앙스 기반 체크
        has_nuance = any(re.search(pattern, user_message, re.IGNORECASE) for pattern in nuanced_patterns)
        
        has_end_intent = has_explicit or has_nuance
        
        if has_end_intent:
            logger.info(f"📞 통화 종료 의도 감지: '{user_message}'")
            # 자연스럽게 종료 여부 확인
            end_confirm_responses = [
                "네, 알겠어요. 이제 전화 그만하시겠어요?",
                "알겠어요. 이제 끊으시겠어요?",
                "네. 이제 통화 마무리할까요?",
                "알겠어요. 이제 통화 그만할까요?"
            ]
            import random
            response = random.choice(end_confirm_responses)
            logger.info(f"📞 통화 종료 확인 응답: {response}")
        
        # 대화 기록에서 같은 주제 반복 체크 (식사 관련)
        if conversation_history:
            recent_topics = []
            for msg in conversation_history[-6:]:  # 최근 3턴 확인
                content = msg.get('content', '')
                # 식사 관련 키워드 추출
                if any(word in content for word in ['저녁', '점심', '아침', '식사', '밥', '먹']):
                    recent_topics.append('meal')
            
            # 같은 주제가 2회 이상 나오면 경고
            meal_count = recent_topics.count('meal')
            meal_keywords_in_response = any(word in response for word in ['저녁', '점심', '아침', '식사', '밥', '먹', '드실', '드셨'])
            
            if meal_count >= 2 and meal_keywords_in_response:
                logger.warning(f"⚠️ 같은 주제 반복 감지: 식사 관련 {meal_count+1}회 → 주제 전환 필요")
                # 식사 관련 응답을 다른 주제로 전환
                alternative_topics = [
                    # TV 및 오락
                    "TV 프로그램은 뭐 보세요?",
                    "요즘 재미있는 드라마 보시고 계신가요?",
                    "어제 뭐 보셨어요?",
                    "좋아하시는 프로그램 있어요?",
                    
                    # 날씨 및 환경
                    "오늘 날씨가 어떠세요?",
                    "창밖 날씨는 어떤가요?",
                    "날씨 참 좋네요.",
                    "요즘 날씨 변화가 심하네요.",
                    
                    # 가족 및 인물
                    "가족분들은 잘 지내세요?",
                    "손자 손녀들은 건강하게 잘 지내나요?",
                    "가족분들 보고 싶으시겠어요.",
                    "아이들은 요즘 어때요?",
                    "가족들과 자주 연락하고 계신가요?",
                    
                    # 건강 및 일상
                    "요즘 건강은 어떠세요?",
                    "몸 상태는 어때요?",
                    "일상생활 괜찮으세요?",
                    "오늘은 어땠어요?",
                    "오늘 하루는 어떠셨어요?",
                    "어제 밤은 잘 주무셨어요?",
                    
                    # 취미 및 활동
                    "요즘 뭐 하면서 지내세요?",
                    "어떤 취미가 있으세요?",
                    "오늘 산책 다녀오셨어요?",
                    "책 읽는 거 좋아하세요?",
                    
                    # 음식 및 생활
                    "좋아하는 음식 있어요?",
                    "요즘 입맛은 어떠세요?",
                    "어떤 음식 드시는 거 좋아하세요?",
                    
                    # 옷차림 및 준비
                    "요즘 옷차림은 어때요?",
                    "날씨가 추워지는데 옷 따뜻하게 입으셨어요?",
                    
                    # 추억 및 과거
                    "옛날 생각 나시는 때 있어요?",
                    "좋았던 추억 있으세요?",
                    "옛날 이야기 들어보고 싶어요.",
                    
                    # 동네 및 이웃
                    "동네는 어떻게 지내세요?",
                    "이웃분들과 잘 지내세요?",
                    "동네에 친분 있는 분 계세요?",
                    
                    # 일반적인 대화
                    "편하게 지내고 계시나요?",
                    "무엇이 궁금하세요?",
                    "재미있는 일 있었어요?"
                ]
                import random
                return random.choice(alternative_topics)
        
        # 1. 문장 수 제한 (최대 2문장) + 문자 수 제한 (최대 60자) - 적절한 길이 유지
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
        
        # 2문장으로 제한 + 60자 제한 (통화 중 끊김 방지)
        max_sentences = 2
        max_chars = 60
        
        if len(complete_sentences) > max_sentences:
            # 2문장까지만 사용, 문자 수도 체크
            limited_sentences = complete_sentences[:max_sentences]
            response = " ".join(limited_sentences)
            if len(response) > max_chars:
                # 60자 초과 시 첫 번째 문장만 사용
                response = complete_sentences[0]
                logger.info(f"🔧 문장 수/길이 제한: {len(complete_sentences)}개 → 1개, {len(' '.join(limited_sentences))}자 → {len(response)}자")
            else:
                logger.info(f"🔧 문장 수 제한: {len(complete_sentences)}개 → {max_sentences}개")
        else:
            response = " ".join(complete_sentences)
            # 문자 수 초과 체크 (2문장 이하여도)
            if len(response) > max_chars:
                # 첫 번째 문장만 사용
                response = complete_sentences[0] if complete_sentences else response[:max_chars]
                logger.info(f"🔧 문자 수 제한: {len(' '.join(complete_sentences))}자 → {len(response)}자")
        
        # 마지막에 구두점이 없으면 추가
        if response and response[-1] not in '.!?':
            response += "."
        
        # 2. 금지 패턴 감지 (AI 봇 표현 + 대화 품질 문제)
        banned_patterns = [
            # AI 봇처럼 들리는 표현 (최우선 차단)
            (r'도와드릴', '금지: AI 봇 표현'),
            (r'필요하시면.*말씀', '금지: AI 봇 표현'),
            (r'알려드릴', '금지: AI 봇 표현'),
            (r'확인해.*드리', '금지: AI 봇 표현'),
            (r'해드릴.*수', '금지: AI 봇 표현'),
            (r'할.*수.*있습니다', '금지: AI 봇 표현'),
            (r'통화.*종료|전화.*끊겠', '금지: AI 봇 표현'),
            
            # 대화 끝내려는 시도 (강화: AI가 먼저 통화를 끊으려는 모든 표현 차단)
            (r'(그럼|그러면|이제|나중에|다음에|다음번에)\s*(끊|통화\s*종료|전화\s*끊|헤어지|그만|끊을|끊고)', '금지: 대화 끝내기'),
            (r'(그럼|그러면|이제|나중에|다음에)\s*(다시|또)\s*(연락|전화|통화)', '금지: 대화 끝내기'),
            (r'(안녕히|잘\s*가|다음에\s*봐)', '금지: 대화 끝내기 (어르신이 직접 말하지 않는 한)'),
            
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
            
            # 3인칭 사용 금지 (자기 자신을 "하루는", "하루가" 등으로 지칭)
            (r'하루는\s*.*', '금지: 3인칭 사용 ("하루는" 대신 "저는" 사용)'),
            (r'하루가\s*.*', '금지: 3인칭 사용 ("하루가" 대신 "제가" 사용)'),
            (r'하루도\s*.*', '금지: 3인칭 사용 ("하루도" 대신 "저도" 사용)'),
        ]
        
        for pattern, reason in banned_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                logger.warning(f"⚠️ {reason} 감지: '{response}'")
                response = self._generate_safe_response(user_message)
                break
        
        # 3. 존댓말 확인 (경고만)
        jondaemal_markers = ['세요', '셔요', '습니다', '네요', '어요', '죠']
        has_jondaemal = any(marker in response for marker in jondaemal_markers)
        
        if not has_jondaemal:
            logger.warning(f"⚠️ 존댓말 미흡: '{response}'")
        
        return response
    
    def _is_short_response(self, user_message: str) -> bool:
        """
        단답형 응답인지 감지
        
        Args:
            user_message: 사용자 메시지
            
        Returns:
            bool: 단답형이면 True
        """
        import re
        
        # 인사말은 단답형으로 처리하지 않음
        greetings = ['안녕', '안녕하세요', '안녕히가세요', '안녕히가세', '안녕하세', '반갑', '반가워']
        if any(greeting in user_message for greeting in greetings):
            return False
        
        # 메시지 길이 체크 (5자 이하)
        if len(user_message.strip()) <= 5:
            return True
        
        # 단답형 패턴
        short_patterns = [
            r'^(네|응|그래|맞아|아니|아니야|아직|모르겠|괜찮아|괜찮|좋아|싫어)$',
            r'^(네|응|그래|맞아|아니|아직).*[요네]$',  # "네요", "아직 안 했어요" 등
            r'^(아니오|아니요|아니예요)$',
            r'^(모르겠|모르겠어|모르겠네|모르겠다)$',
        ]
        
        normalized = user_message.strip()
        for pattern in short_patterns:
            if re.match(pattern, normalized, re.IGNORECASE):
                return True
        
        return False
    
    def _generate_safe_response(self, user_message: str) -> str:
        """안전한 공감 응답 생성 (더 자연스럽게, 다양한 추임새 사용)"""
        import random
        
        if any(word in user_message for word in ['아프', '힘들', '고통', '통증']):
            responses = [
                "아이고, 많이 힘드시겠어요. 괜찮으신가요?",
                "어머, 힘드시겠어요. 괜찮으신가요?",
                "아이, 많이 힘드시겠어요."
            ]
            return random.choice(responses)
        elif any(word in user_message for word in ['외롭', '쓸쓸', '혼자', '아무도']):
            responses = [
                "외로우시겠어요. 제가 들어드릴게요.",
                "어머나, 외로우시겠어요. 저도 듣고 있어요.",
                "아이고, 외로우시겠어요. 제가 들어드릴게요."
            ]
            return random.choice(responses)
        elif any(word in user_message for word in ['슬프', '우울', '속상', '걱정']):
            responses = [
                "속상하시겠어요. 무슨 일 있으셨나요?",
                "어머, 속상하시겠어요. 어떤 일이에요?",
                "아이고, 걱정되시겠어요. 괜찮으신가요?"
            ]
            return random.choice(responses)
        elif any(word in user_message for word in ['자식', '아들', '딸', '손주']):
            responses = [
                "가족분들 생각나시겠어요. 많이 보고 싶으시겠어요.",
                "어머나, 가족분들 이야기 나오시네요. 보고 싶으시겠어요.",
                "오호, 가족 얘기 나오시는군요. 좋으시겠어요."
            ]
            return random.choice(responses)
        elif any(word in user_message for word in ['기쁨', '좋아', '즐거', '행복']):
            responses = [
                "좋으시네요. 기분이 좋아 보이세요.",
                "오호, 좋으시군요. 기쁘시겠어요!",
                "그래요? 좋으시겠어요."
            ]
            return random.choice(responses)
        else:
            responses = [
                "그렇구나. 잘 듣고 있어요.",
                "그러시군요. 잘 듣고 있어요.",
                "그래요? 잘 듣고 있어요."
            ]
            return random.choice(responses)
    
    def _get_korean_time_now(self) -> datetime:
        """현재 한국 시간(KST) 반환"""
        return datetime.now(KST)
    
    def _get_korean_time_info(self) -> str:
        """현재 한국 시간/날짜 정보를 문자열로 반환"""
        kst_now = self._get_korean_time_now()
        
        # 요일 한글 변환
        weekdays_kr = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']
        weekday_kr = weekdays_kr[kst_now.weekday()]
        
        # 오전/오후 구분
        hour = kst_now.hour
        if hour < 12:
            time_period = "오전"
            hour_display = hour
        elif hour == 12:
            time_period = "오후"
            hour_display = 12
        else:
            time_period = "오후"
            hour_display = hour - 12
        
        # 분 표시
        minute = kst_now.minute
        
        return f"{kst_now.year}년 {kst_now.month}월 {kst_now.day}일 {weekday_kr} {time_period} {hour_display}시 {minute}분"
    
    def generate_response(self, user_message: str, conversation_history: list = None):
        """
        응답 생성 및 시간 측정 (llm_service.py와 동일한 로직)
        
        Args:
            user_message: 사용자의 메시지
            conversation_history: 이전 대화 기록 (옵션)
        
        Returns:
            tuple: (AI 응답, 실행 시간)
        """
        try:
            start_time = time.time()
            
            # ⚡ 캐시 제거: 단답형 응답도 매번 LLM으로 생성 (어르신이 단순 대답할 수 있으므로)
            # 캐시는 어르신의 다양한 응답 패턴을 제한할 수 있어 사용하지 않음
            
            # 메시지 구성 (llm_service.py와 동일)
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 단답형 감지 및 대화 유도
            is_short_response = self._is_short_response(user_message)
            if is_short_response:
                guidance_message = """[대화 유도 필요] 어르신이 짧게 대답하셨습니다. 질문만 하는 것이 아니라 하루 자신의 이야기를 먼저 공유하세요:
- 먼저 하루 자신의 다양한 이야기를 공유 (같은 이야기 반복 금지):
  * "저는 요즘 재미있는 드라마 보고 있어요" (TV/미디어)
  * "저는 요즘 추워서 힘들어요" (날씨/계절)
  * "저는 요즘 책 읽고 있어요" (취미/활동)
  * "저는 오늘 간단한 요리 했어요" (음식/요리)
  * "저는 요즘 컨디션 좋아요" (건강/상태)
- 그 다음 주제와 연결된 질문 하나만 자연스럽게 하기
- 단순히 질문만 연속해서 하지 마세요 (면접 같음)
- ❌ 3인칭 사용 금지: "하루는", "하루가", "하루도" → ✅ 1인칭 사용: "저는", "제가", "저도"
- 예: "그렇군요~ 저는 요즘 재미있는 드라마 보고 있는데 좋더라구요. 어르신은 TV 보시는 거 좋아하세요?" """
                messages.append({"role": "system", "content": guidance_message})
                logger.info(f"💬 단답형 감지 → 대화 유도 모드 활성화 (하루 이야기 포함)")
            
            # 한국 시간 정보 추가 (시간/날짜 질문 대응)
            korean_time_info = self._get_korean_time_info()
            messages.append({"role": "system", "content": f"[현재 시간] {korean_time_info} - 시간/날짜 질문 시 정확히 이 정보를 사용하세요"})
            logger.info(f"🕐 현재 한국 시간: {korean_time_info}")
            
            # 대화 기록이 있으면 추가 (최근 4턴 = 8개 메시지, 맥락 유지)
            if conversation_history:
                messages.extend(conversation_history[-8:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            api_start_time = time.time()
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=50,  # 2문장 또는 60자 정도 (충분한 길이 확보)
                temperature=0.5,  # 속도 우선 (0.3은 느림)
            )
            
            # TTFT 측정 (Time To First Token)
            ttft = time.time() - api_start_time
            
            ai_response = response.choices[0].message.content
            
            # 후처리: 규칙 강제 적용 (llm_service.py와 동일, 대화 기록 전달)
            ai_response = self._post_process_response(ai_response, user_message, conversation_history)
            
            elapsed_time = time.time() - start_time
            
            logger.info(f"⏱️ 전체 소요 시간: {elapsed_time:.2f}초 | TTFT: {ttft:.2f}초")
            
            return ai_response, elapsed_time
        except Exception as e:
            logger.error(f"❌ LLM 응답 생성 실패: {e}")
            raise
    
    def test_conversation_quality(self, test_messages: list):
        """대화 품질 테스트 함수"""
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
            
            # 존댓말 체크 (한국어 존댓말 패턴 - 더 포괄적으로)
            polite_patterns = [
                "습니다", "세요", "시어요", "시지요", "시죠", "시네요", "시구나",  # 기존 패턴
                "죠", "어요", "에요", "네요", "어요",  # 해요체 존댓말
                "시", "으시", "으신", "으셨", "으실",  # 시상 어미
                "주세요", "주실", "주셨", "주시",  # 주다 + 시상
                "말씀", "드시", "드셨", "드실"  # 높임말
            ]
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
    
    def interactive_test(self):
        """대화형 테스트 모드 (대화 히스토리 유지)"""
        print("\n🎯 대화형 테스트 모드")
        print("=" * 50)
        print("어르신이 할 법한 메시지를 입력하세요.")
        print("'quit' 또는 'exit' 입력 시 종료")
        print("'test' 입력 시 자동 테스트 실행")
        print("'reset' 입력 시 대화 기록 초기화")
        print("-" * 50)
        
        # 대화 히스토리 초기화 (llm_service.py와 동일한 방식)
        conversation_history = []
        
        while True:
            user_input = input("\n💬 입력: ").strip()
            
            if user_input.lower() in ['quit', 'exit', '종료']:
                print("👋 테스트를 종료합니다.")
                break
            elif user_input.lower() == 'test':
                print("🔄 자동 테스트 모드로 전환합니다.")
                return "auto_test"
            elif user_input.lower() == 'reset':
                conversation_history = []
                print("🔄 대화 기록이 초기화되었습니다.")
                continue
            elif not user_input:
                print("❌ 빈 입력입니다. 다시 입력해주세요.")
                continue
            
            # 응답 생성 및 분석 (대화 히스토리 전달)
            print("🤖 AI 응답 생성 중...")
            response, elapsed_time = self.generate_response(user_input, conversation_history)
            
            # 대화 히스토리에 추가 (user 메시지 + AI 응답)
            conversation_history.append({"role": "user", "content": user_input})
            conversation_history.append({"role": "assistant", "content": response})
            
            # 최근 8개(4턴)만 유지 (메모리 절약 및 속도 개선)
            # llm_service.py와 동일한 설정으로 최근 4턴 대화 기록 유지
            if len(conversation_history) > 8:
                conversation_history = conversation_history[-8:]
            
            # ==========================================
            # 📊 개선된 평가 기준 (2025-10-27)
            # ==========================================
            
            # 1️⃣ 존댓말 준수율 체크 (정교한 분석)
            polite_endings = ["습니다", "세요", "어요", "아요", "네요", "지요", "죠", "ㅂ니다", "예요", "이에요"]
            informal_endings = ["해", "어", "아", "지", "다", "야", "냐", "니"]
            
            # 문장 종결 분석
            sentences = [s.strip() for s in response.replace('?', '.').replace('!', '.').split('.') if s.strip()]
            polite_count = 0
            informal_count = 0
            
            for sentence in sentences:
                if any(sentence.endswith(pattern) for pattern in polite_endings):
                    polite_count += 1
                elif any(sentence.endswith(pattern) for pattern in informal_endings):
                    informal_count += 1
            
            # 존댓말 판단: 반말이 하나도 없고, 존댓말이 최소 1개 이상
            is_polite = polite_count > 0 and informal_count == 0
            polite_ratio = (polite_count / len(sentences) * 100) if sentences else 0
            
            # 2️⃣ 응답 적절성 체크 (다층 분석)
            evaluation_score = 100  # 시작 점수
            issues = []
            
            # ❌ 봇 언어 사용 (-30점)
            bot_keywords = ["도와드릴게요", "말씀해 주세요", "필요하시면", "알려드릴게요", "제가 도와", "이야기해 주세요"]
            bot_found = [kw for kw in bot_keywords if kw in response]
            if bot_found:
                evaluation_score -= 30
                issues.append(f"봇 언어: {bot_found[0]}")
            
            # ❌ 추상적 질문 (-40점)
            abstract_questions = ["어떤", "무슨", "어떻게 지내", "하루 어떠", "이야기 하고 싶", "생각"]
            abstract_found = [q for q in abstract_questions if q in response]
            if abstract_found:
                evaluation_score -= 40
                issues.append(f"추상적 질문: {abstract_found[0]}")
            
            # ❌ 과도하게 긴 응답 (-20점) - 100자 이상
            if len(response) > 100:
                evaluation_score -= 20
                issues.append(f"긴 응답 ({len(response)}자)")
            
            # ❌ 대화 끊는 짧은 응답 (-30점) - 15자 미만이면서 인사말 아닐 때
            greeting_words = ["네", "좋아요", "감사합니다", "반가워요", "안녕하세요", "편안하게"]
            if len(response) < 15 and not any(word in response for word in greeting_words):
                evaluation_score -= 30
                issues.append(f"짧은 응답 ({len(response)}자)")
            
            # ✅ 공감 표현 (+10점)
            empathy_patterns = ["그러시군요", "아이고", "어머", "다행이에요", "좋으시네요", "힘드시겠어요", "그러게요", "그렇군요"]
            empathy_found = [p for p in empathy_patterns if p in response]
            if empathy_found:
                evaluation_score += 10
            
            is_appropriate = evaluation_score >= 60
            
            # 3️⃣ 질문 적절성 체크 (맥락 분석)
            has_question_mark = "?" in response
            question_type = "없음"
            is_appropriate_question = True
            
            if has_question_mark:
                # 추상적 질문인지 체크
                if abstract_found:
                    question_type = "❌ 추상적 (부적절)"
                    is_appropriate_question = False
                else:
                    # 맥락에 맞는 구체적 질문인지 체크
                    contextual_patterns = ["외출", "산책", "공원", "점심", "저녁", "식사", "드셨", "가세요", "계세요", "있으세요", "하세요"]
                    if any(pattern in response for pattern in contextual_patterns):
                        question_type = "✅ 맥락적 (적절)"
                        is_appropriate_question = True
                    else:
                        question_type = "⚠️ 일반 질문"
                        is_appropriate_question = True
            
            # 결과 출력
            print(f"\n📝 AI 응답: {response}")
            print(f"⏱️ 응답 시간: {elapsed_time:.2f}초")
            print(f"📏 응답 길이: {len(response)}자")
            print(f"🙏 존댓말 사용: {'✅' if is_polite else '❌'} ({polite_count}/{len(sentences)} 문장, {polite_ratio:.0f}%)")
            print(f"💬 적절성 평가: {'✅' if is_appropriate else '❌'} (점수: {evaluation_score}/100)")
            if issues:
                print(f"   ⚠️ 문제점: {', '.join(issues)}")
            if empathy_found:
                print(f"   ✨ 공감 표현: {', '.join(empathy_found)}")
            print(f"❓ 질문 분석: {question_type}")
            print(f"📚 대화 기록: {len(conversation_history)//2}턴 ({len(conversation_history)}개 메시지)")
            
            # 상세 분석 (존댓말 미사용 시)
            if not is_polite:
                print("🔍 상세 분석:")
                print(f"   존댓말 문장: {polite_count}개")
                print(f"   반말 문장: {informal_count}개")
                if informal_count > 0:
                    print(f"   ⚠️ 반말이 감지되어 존댓말 미준수로 판정")
        
        return "interactive_complete"

def main():
    """메인 테스트 함수"""
    print("🧪 LLM 대화 품질 테스트 시작")
    print("📞 실제 전화 통화 없이 텍스트 입력으로 LLM 응답 테스트")
    print("=" * 60)
    
    # LLM 테스트 초기화
    print("🔧 LLM 테스트 초기화 중...")
    llm_test = SimpleLLMTest(api_key)
    print("✅ LLM 테스트 초기화 완료")
    
    # 테스트 모드 선택
    print("\n🎯 테스트 모드를 선택하세요:")
    print("1. 자동 테스트 (10개 미리 정의된 메시지)")
    print("2. 대화형 테스트 (직접 메시지 입력)")
    
    while True:
        choice = input("\n선택 (1 또는 2): ").strip()
        if choice == "1":
            mode = "auto"
            break
        elif choice == "2":
            mode = "interactive"
            break
        else:
            print("❌ 1 또는 2를 입력해주세요.")
    
    if mode == "interactive":
        # 대화형 테스트 실행
        result = llm_test.interactive_test()
        if result == "auto_test":
            mode = "auto"  # 대화형에서 자동 테스트로 전환
        else:
            return  # 대화형 테스트 완료
    
    if mode == "auto":
        # 자동 테스트 실행
        test_messages = [
            "안녕하세요",
            "오늘 날씨가 좋네요", 
            "아침에 약을 먹었어요",
            "점심은 뭐 먹을까요?",
            "오늘 기분이 안 좋아요",
            "손자가 오늘 와요",
            "병원에 가야 해요",
            "운동을 하고 싶어요",
            "외롭네요",
            "고마워요"
        ]
        
        print(f"\n📝 자동 테스트 메시지 {len(test_messages)}개:")
        for i, msg in enumerate(test_messages, 1):
            print(f"   {i}. \"{msg}\"")
        print()
        
        # 현재 프롬프트로 테스트 실행
        print("🔍 현재 프롬프트 성능 측정 중...")
        print("   (각 메시지에 대한 LLM 응답을 생성하고 분석합니다)")
        print()
        
        results = llm_test.test_conversation_quality(test_messages)
    
    print("\n" + "=" * 60)
    print("📊 현재 프롬프트 성능 결과")
    print("=" * 60)
    print(f"총 테스트 수: {results['total_tests']}")
    print(f"존댓말 준수율: {results['polite_rate']:.1f}%")
    print(f"응답 적절성: {results['appropriate_rate']:.1f}%")
    print(f"평균 응답 시간: {results['avg_response_time']:.2f}초")
    
    # 수민님 보고서 기준 목표와 비교
    print("\n🎯 수민님 보고서 기준 목표:")
    print(f"목표 존댓말 준수율: 100% (현재: {results['polite_rate']:.1f}%)")
    print(f"목표 응답 적절성: 90% (현재: {results['appropriate_rate']:.1f}%)")
    print(f"목표 응답 시간: <1.0초 (현재: {results['avg_response_time']:.2f}초)")
    
    # 개선 필요도 계산
    polite_gap = 100 - results['polite_rate']
    appropriate_gap = 90 - results['appropriate_rate']
    time_gap = results['avg_response_time'] - 1.0
    
    print(f"\n📈 개선 필요도:")
    if polite_gap > 0:
        print(f"존댓말 준수율: {polite_gap:.1f}%p 개선 필요")
    else:
        print(f"존댓말 준수율: 목표 달성 ✅")
        
    if appropriate_gap > 0:
        print(f"응답 적절성: {appropriate_gap:.1f}%p 개선 필요")
    else:
        print(f"응답 적절성: 목표 달성 ✅")
        
    if time_gap > 0:
        print(f"응답 시간: {time_gap:.2f}초 단축 필요")
    else:
        print(f"응답 시간: 목표 달성 ✅")
    
    # 상세 결과 출력
    print(f"\n📋 상세 테스트 결과:")
    for i, response_data in enumerate(results['responses'], 1):
        print(f"   {i}. 입력: \"{response_data['input']}\"")
        print(f"      출력: \"{response_data['output']}\"")
        print(f"      존댓말: {'✅' if response_data['is_polite'] else '❌'}")
        print(f"      적절성: {'✅' if response_data['is_appropriate'] else '❌'}")
        print(f"      시간: {response_data['response_time']:.2f}초")
        print()
    
    return results

if __name__ == "__main__":
    try:
        results = main()
        print("\n✅ 테스트 완료!")
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()