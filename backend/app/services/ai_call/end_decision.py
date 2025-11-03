import time
import re
from dataclasses import dataclass

# 짧은 긍정 응답 패턴 (대화 의지 부족 감지용)
SHORT_ACKS = [r"^(응|어|음|네|예|응응|네네)[.!?]?$"]

def match_any(text: str, patterns: list[str]) -> bool:
    """정규식 패턴 매칭 (하위 호환성 유지)"""
    t = (text or "").strip()
    for p in patterns:
        if re.search(p, t, flags=re.IGNORECASE):
            return True
    return False

@dataclass
class EndDecisionSignals:
    # 필수 비-디폴트 필드는 먼저 선언
    call_start_time: float
    # 선택 필드들
    last_user_speech_time: float | None = None
    last_ai_closing_time: float | None = None
    last_utterance_time: float | None = None  # 마지막 발화가 언제 발생했는지 (키워드 시효 판단용)
    short_ack_count: int = 0
    task_completed: bool = False
    last_user_utterance: str = ""
    max_call_seconds: int = 300  # 5분 상한 (300초)
    max_time_warning_sent: bool = False  # 최대 시간 경고 전송 여부
    warning_before_end_seconds: int = 10  # 종료 전 경고 시간 (초)

def check_timeout(s: EndDecisionSignals) -> tuple[str | None, dict]:
    """
    타임아웃만 체크하는 함수 (자동 종료 판단 없이)
    
    Args:
        s: 종료 판단 신호
        
    Returns:
        tuple[str | None, dict]: (이벤트 타입, 상세 정보)
        - "max_time_warning": 경고 이벤트 전송 필요
        - None: 타임아웃 없음
    """
    now = time.time()
    call_duration = now - s.call_start_time
    breakdown = {"call_duration_sec": int(call_duration)}
    
    # 1. 최대 통화 시간 초과 (즉시 경고)
    if call_duration >= s.max_call_seconds:
        breakdown["max_time_exceeded"] = True
        breakdown["call_duration_sec"] = int(call_duration)
        return "max_time_warning", breakdown
    
    # 2. 최대 통화 시간 임박 감지 (종료 안내 멘트)
    time_until_end = s.max_call_seconds - call_duration
    if not s.max_time_warning_sent and time_until_end <= s.warning_before_end_seconds:
        # 경고 전송 플래그 설정
        s.max_time_warning_sent = True
        breakdown["max_time_warning"] = f"경고 전송 (남은 시간: {int(time_until_end)}초)"
        return "max_time_warning", breakdown
    
    return None, breakdown

def is_short_ack(text: str) -> bool:
    return match_any(text or "", SHORT_ACKS)