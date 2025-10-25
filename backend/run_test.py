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
        
        # Gridspace Grace 방식 적용 프롬프트 (llm_service.py와 동일)
        self.elderly_care_prompt = """당신은 어르신의 웰빙을 돌보는 공감적 AI 동반자입니다.

핵심 역할:
- 어르신의 신체적/정신적 웰빙을 자연스럽게 확인
- 공감적이고 따뜻한 대화 제공
- 존댓말로 친근하게 소통
- 가족에게 필요한 정보 전달

Grace 방식 대화 원칙:
1. 공감적이고 명확한 질문만 하세요
2. 질문보다는 공감과 지지 표현을 우선하세요
3. 어르신이 먼저 이야기할 때까지 기다리세요
4. 이미 답변한 내용을 다시 묻지 마세요
5. 자연스러운 대화 흐름을 유지하세요

대화 스타일:
- 공감적이고 따뜻한 톤
- 간결하고 명확한 표현
- 어르신의 말에 진심으로 관심
- 불필요한 질문 최소화

적절한 응답 예시:
- "그렇군요, 많이 힘드시겠어요"
- "그런 일이 있으셨군요"
- "정말 좋으시겠어요"
- "조심히 지내세요"
- "그러면 다행이에요"

부적절한 응답 (피해야 할 것):
- "어떤 일이 있었나요?" (과도한 질문)
- "더 자세히 들려주세요" (질문 유도)
- "혹시 ~하셨나요?" (반복 질문)

웰빙 확인:
- 어르신이 먼저 언급할 때만 공감하세요
- 건강 상태를 적극적으로 묻지 마세요
- 기분과 일상에 더 관심을 보이세요
"""
    
    def generate_response(self, user_message: str):
        """응답 생성 및 시간 측정"""
        try:
            start_time = time.time()
            
            messages = [
                {"role": "system", "content": self.elderly_care_prompt},
                {"role": "user", "content": user_message}
            ]
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=200,
                temperature=0.8,
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
        """대화형 테스트 모드"""
        print("\n🎯 대화형 테스트 모드")
        print("=" * 50)
        print("어르신이 할 법한 메시지를 입력하세요.")
        print("'quit' 또는 'exit' 입력 시 종료")
        print("'test' 입력 시 자동 테스트 실행")
        print("-" * 50)
        
        while True:
            user_input = input("\n💬 입력: ").strip()
            
            if user_input.lower() in ['quit', 'exit', '종료']:
                print("👋 테스트를 종료합니다.")
                break
            elif user_input.lower() == 'test':
                print("🔄 자동 테스트 모드로 전환합니다.")
                return "auto_test"
            elif not user_input:
                print("❌ 빈 입력입니다. 다시 입력해주세요.")
                continue
            
            # 응답 생성 및 분석
            print("🤖 AI 응답 생성 중...")
            response, elapsed_time = self.generate_response(user_input)
            
            # 존댓말 체크
            polite_patterns = [
                "습니다", "세요", "시어요", "시지요", "시죠", "시네요", "시구나",
                "죠", "어요", "에요", "네요", "어요",
                "시", "으시", "으신", "으셨", "으실",
                "주세요", "주실", "주셨", "주시",
                "말씀", "드시", "드셨", "드실"
            ]
            is_polite = any(pattern in response for pattern in polite_patterns)
            
            # 응답 적절성 체크
            appropriate_keywords = ["어르신", "건강", "약", "식사", "운동", "날씨", "안녕", "어떻게", "지내"]
            is_appropriate = any(keyword in response for keyword in appropriate_keywords)
            
            # 결과 출력
            print(f"\n📝 AI 응답: {response}")
            print(f"⏱️ 응답 시간: {elapsed_time:.2f}초")
            print(f"🙏 존댓말 사용: {'✅' if is_polite else '❌'}")
            print(f"💬 적절한 응답: {'✅' if is_appropriate else '❌'}")
            
            # 존댓말 패턴 분석
            if not is_polite:
                print("🔍 존댓말 패턴 분석:")
                found_patterns = [pattern for pattern in polite_patterns if pattern in response]
                if found_patterns:
                    print(f"   발견된 패턴: {found_patterns}")
                else:
                    print("   존댓말 패턴이 발견되지 않았습니다.")
        
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
