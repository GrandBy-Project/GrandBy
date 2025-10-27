"""
LLM 응답 캐싱 서비스
자주 사용되는 패턴은 LLM 호출 없이 즉시 응답
"""

import re
import random
from typing import Optional

class ResponseCache:
    """스마트 응답 캐싱"""
    
    def __init__(self):
        # 🚫 캐싱 비활성화 (대화 품질 우선)
        # 이유: 단순 캐시 응답이 맥락을 무시하고 대화 흐름을 방해함
        # 어르신과의 대화는 상황에 맞는 응답이 중요하므로
        # LLM이 매번 적절한 응답을 생성하도록 함
        
        # 빈 패턴 (모든 캐시 비활성화)
        self.all_patterns = []
    
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

