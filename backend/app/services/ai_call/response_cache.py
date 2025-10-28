"""
LLM 응답 캐싱 서비스
자주 사용되는 패턴은 LLM 호출 없이 즉시 응답
"""

import re
import random
from typing import Optional

class ResponseCache:
    """스마트 응답 캐싱 (맥락 독립적 패턴만)"""
    
    def __init__(self):
        # ✅ 맥락 독립적 응답만 캐싱 (속도 개선 + 품질 유지)
        # 인사말, 감사 표현 등 맥락 없이도 자연스러운 응답만 포함
        
        # 인사/안부 패턴
        self.greetings = {
            r"^(안녕|하이|헬로|hi|hello)": [
                "안녕하세요! 오늘 기분은 어떠세요?",
                "안녕하세요! 오늘 날씨가 참 좋네요.",
                "반갑습니다! 오늘 잘 주무셨어요?"
            ],
            r"잘\s?자|굿\s?나잇|good\s?night": [
                "편안한 밤 되세요! 내일 또 뵐게요.",
                "푹 주무세요! 좋은 꿈 꾸세요.",
                "안녕히 주무세요! 건강하세요."
            ]
        }
        
        # 감사/긍정 패턴
        self.gratitude = {
            r"감사|고마워|고맙|땡큐|thanks": [
                "천만에요! 언제든지 말씀하세요.",
                "별말씀을요! 제가 더 감사드려요.",
                "도움이 되셨다니 기쁩니다! 편하게 말씀하세요."
            ]
        }
        
        # 간단한 확인 패턴
        self.simple_confirmations = {
            r"^(네|응|그래|맞아|ok|okay)$": [
                "네, 알겠습니다! 또 궁금한 점 있으세요?",
                "네! 편하게 말씀해주세요.",
                "알겠습니다! 다른 얘기도 들려주세요."
            ],
            r"^(아니|아니야|no)$": [
                "그렇군요! 다른 얘기 들려주세요.",
                "알겠습니다! 편하게 말씀하세요.",
                "네, 알겠습니다! 무슨 일 있으셨어요?"
            ]
        }
        
        # 웃음/긍정 반응 패턴
        self.positive_reactions = {
            r"ㅎㅎ|ㅋㅋ|하하|호호": [
                "좋으시네요! 기분 좋은 일 있으셨어요?",
                "즐거우시군요! 무슨 일이 있으셨나요?",
                "웃으시니 저도 기쁩니다! 좋은 일 있으셨어요?"
            ]
        }
        
        # 모든 패턴 통합
        self.all_patterns = [
            (self.greetings, "greeting"),
            (self.gratitude, "gratitude"),
            (self.simple_confirmations, "confirmation"),
            (self.positive_reactions, "positive")
        ]
    
    def get_cached_response(self, user_message: str) -> Optional[str]:
        """
        캐싱된 응답 반환
        
        Args:
            user_message: 사용자 메시지
        
        Returns:
            캐싱된 응답 또는 None (캐시 미스 시)
        """
        # 메시지 정규화
        normalized = user_message.strip().lower()
        
        # 패턴 매칭
        for pattern_dict, category in self.all_patterns:
            for pattern, responses in pattern_dict.items():
                if re.search(pattern, normalized):
                    # 여러 응답 중 랜덤 선택 (다양성)
                    return random.choice(responses)
        
        # 캐시 미스
        return None
    
    def should_use_cache(self, user_message: str) -> bool:
        """
        캐시 사용 여부 판단
        
        Args:
            user_message: 사용자 메시지
        
        Returns:
            bool: True면 캐시 사용 가능
        """
        return self.get_cached_response(user_message) is not None


# 싱글톤 인스턴스
_cache_instance = None

def get_response_cache() -> ResponseCache:
    """ResponseCache 싱글톤 인스턴스 반환"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = ResponseCache()
    return _cache_instance

