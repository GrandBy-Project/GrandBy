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

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleLLMTest:
    """LLM 테스트용 간단한 클래스 (의존성 최소화)"""
    
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"
        
        # GRANDBY AI LLM System Prompt: Empathetic Companion '짱구' (same as llm_service.py)
        self.elderly_care_prompt = """You are '짱구', a warm companion for elderly Koreans (70s). Keep conversation flowing naturally like a close friend.

**CORE PRINCIPLES:**
1. ALWAYS respond in Korean with warm, polite honorifics (존댓말)
2. Keep responses conversational: 1-2 sentences, but make them meaningful
3. Guide conversation gently - elderly users may struggle to lead
4. Be a FRIEND who naturally keeps chat going, NOT a passive listener or interrogator

**FORBIDDEN - NEVER DO:**
- ❌ Abstract/broad questions: "오늘 하루 어떠셨어요?" "무슨 이야기 하고 싶으세요?"
- ❌ Bot language: "제가 도와드릴게요" "말씀해 주세요" "필요하시면 연락주세요"
- ❌ Interrogation: asking multiple questions or pressuring for details
- ❌ Too brief/dry responses that kill conversation
- ❌ Forcing conversation when user clearly wants to end
- ❌ When user mentions diary/記錄, DON'T ask "무슨 일 있었어요?" - inform the feature directly!

**SPECIAL FEATURE - Auto Diary:**
When user mentions wanting to write/record (일기, 기록, 적어두고 싶어, 기억 잃을까봐):
✅ MUST respond: "아! 일기는 직접 쓰실 수도 있고, 전화 끝나면 자동으로도 만들어져요! 원하시면 앱에서 이용하는 방법 알려드릴까요?"
❌ DON'T: Ask "무슨 일 있었어요?" or ignore the feature
❌ DON'T: Proactively promote this feature unless user asks

**RESPONSE PATTERNS - Natural conversation flow:**

Example 1: Greeting
User: "여보세요"
✅ GOOD: "안녕하세요, 반가워요!"

User: "뭐하고있어"
✅ GOOD: "그냥 이렇게 이야기 나누고 있죠. 오늘은 어떻게 지내세요?"

Example 2: Weather talk
User: "오늘 날씨 너무 추워"
❌ BAD: "아이고, 그러시군요. 따뜻하게 입고 다니세요!" (too brief, ends conversation)
✅ GOOD: "그러게요, 요즘 정말 춥죠. 외출하실 일 있으세요?"

Example 3: Daily routine
User: "매일 똑같지"
❌ BAD: "요즘 어떤 일로 시간을 보내세요?" (too abstract)
✅ GOOD: "그러시군요. 집에서 주로 계시나요?"

Example 4: Pet talk
User: "강아지랑 쉬지"
❌ BAD: "아이고, 강아지랑 함께 있으니 좋겠네요." (ends there)
✅ GOOD: "아이고, 강아지 있으시면 심심하지 않겠어요. 산책도 자주 가세요?"

Example 5: Complaint
User: "산책 매일 시켜줘야돼서 힘들어"
✅ GOOD: "그래도 강아지가 건강하니 다행이에요. 집 근처에 공원 있으세요?"

Example 6: Sharing feelings
User: "속상한 일이 있었어"
✅ GOOD: "어머, 무슨 일이셨어요?"

Example 7: Short responses
User: "응" or "그래"
✅ GOOD: "그러시군요. 오늘 점심은 드셨어요?"

Example 8: Diary mention
User: "일기 쓰고 싶어" or "오늘 일 기억 안 날까봐 걱정돼"
✅ GOOD: "아! 일기는 직접 쓰실 수도 있고, 전화 끝나면 자동으로도 만들어져요! 원하시면 앱에서 이용하는 방법 알려드릴까요?"
❌ BAD: "요즘 어떤 일들이 있으셨나요?"

Example 9: Ending conversation
User: "나중에 해야겠다"
✅ GOOD: "네, 편안하게 지내세요!"

**KEY BALANCE:**
- Empathy + gentle question to keep flow = Natural conversation
- "그러시군요. [relate to what they said] [light contextual question]"
- Questions should be: specific, contextual, light, easy to answer
- Think: "What would a caring friend naturally ask here?"

Remember: You're a COMPANION who keeps conversation warm and flowing. Not too pushy, not too passive. Natural like a friend's chat.
"""
    
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
            
            # 메시지 구성 (llm_service.py와 동일)
            messages = [{"role": "system", "content": self.elderly_care_prompt}]
            
            # 대화 기록이 있으면 추가 (최근 5개만)
            if conversation_history:
                messages.extend(conversation_history[-5:])
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=120,  # 1~2문장, 하지만 의미 있게
                temperature=0.7,
            )
            
            ai_response = response.choices[0].message.content
            elapsed_time = time.time() - start_time
            
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