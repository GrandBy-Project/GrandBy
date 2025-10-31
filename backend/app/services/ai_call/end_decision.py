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
    max_call_seconds: int = 300  # 5분 상한
    max_time_warning_sent: bool = False  # 최대 시간 경고 전송 여부
    warning_before_end_seconds: int = 10  # 종료 전 경고 시간 (초)

class EndDecisionEngine:
    def __init__(self, soft_threshold=70, use_llm=True):
        self.soft_threshold = soft_threshold
        self.use_llm = use_llm  # LLM 사용 여부
        self.llm_service = None  # 나중에 주입

    def set_llm_service(self, llm_service):
        """LLM 서비스 주입"""
        self.llm_service = llm_service

    def score(self, s: EndDecisionSignals) -> tuple[int, dict]:
        """
        폴백용 종료 판단 점수 계산 (LLM 미사용 시에만 사용)
        최소한의 로직만 유지
        
        Returns:
            tuple[int, dict]: (총점, 상세 내역)
        """
        now = time.time()
        score = 0
        breakdown = {}

        # ⏱️ 1. 최대 통화 시간 초과 (즉시 하드 종료)
        call_duration = now - s.call_start_time
        if call_duration >= s.max_call_seconds:
            breakdown["max_time_exceeded"] = 100
            breakdown["call_duration_sec"] = int(call_duration)
            return 100, breakdown
        
        breakdown["call_duration_sec"] = int(call_duration)

        # 🔄 2. 짧은 응답 반복
        if s.short_ack_count >= 3:
            score += 20
            breakdown["short_ack_repeat"] = f"+20 (count:{s.short_ack_count})"

        # 🔇 3. 사용자 침묵 시간 기반
        if s.last_user_speech_time is not None:
            silence = now - s.last_user_speech_time
            if silence >= 20:
                score = 70
                breakdown["silence_20s+"] = f"70 (소프트) - {int(silence)}초 침묵"
                breakdown["total_score"] = 70
                return 70, breakdown
            elif silence >= 15:
                score += 40
                breakdown["silence_15s+"] = f"+40 ({int(silence)}s)"
            elif silence >= 10:
                score += 25
                breakdown["silence_10s+"] = f"+25 ({int(silence)}s)"

        # 🕐 4. AI 클로징 이후 무응답
        if s.last_ai_closing_time:
            closing_elapsed = now - s.last_ai_closing_time
            user_responded_after_closing = (
                s.last_user_speech_time is not None and 
                s.last_user_speech_time > s.last_ai_closing_time
            )
            
            if not user_responded_after_closing:
                if closing_elapsed >= 10:
                    score = 100
                    breakdown["soft_closing_hard_timeout"] = f"100 (하드) - {int(closing_elapsed)}초 무응답"
                    breakdown["total_score"] = 100
                    return 100, breakdown
                elif closing_elapsed >= 5:
                    score += 30
                    breakdown["soft_closing_timeout"] = f"+30 ({int(closing_elapsed)}s)"
        
        final_score = max(0, min(score, 100))
        breakdown["total_score"] = final_score
        
        return final_score, breakdown

    def score_with_llm(self, s: EndDecisionSignals, conversation_history: list = None) -> tuple[int, dict]:
        """
        LLM 기반 종료 판단 점수 계산
        
        Args:
            s: 종료 판단 신호
            conversation_history: 대화 기록
            
        Returns:
            tuple[int, dict]: (총점, 상세 내역)
        """
        now = time.time()
        score = 0
        breakdown = {}
        
        # 기존 점수 계산 로직
        call_duration = now - s.call_start_time
        breakdown["call_duration_sec"] = int(call_duration)
        
        # ⏱️ 1. 최대 통화 시간 초과 (즉시 하드 종료)
        if call_duration >= s.max_call_seconds:
            breakdown["max_time_exceeded"] = 100
            return 100, breakdown
        
        # ⚠️ 1-1. 최대 통화 시간 임박 감지 (종료 안내 멘트)
        time_until_end = s.max_call_seconds - call_duration
        if not s.max_time_warning_sent and time_until_end <= s.warning_before_end_seconds:
            # 경고 전송 플래그 설정
            s.max_time_warning_sent = True
            breakdown["max_time_warning"] = f"경고 전송 (남은 시간: {int(time_until_end)}초)"
            breakdown["total_score"] = -1  # 특별 값: 경고 전송 필요
            return -1, breakdown
        
        # 🤖 2. LLM 기반 종료 의도 분석 (최우선)
        if self.use_llm and self.llm_service and s.last_user_utterance:
            try:
                llm_analysis = self.llm_service.analyze_call_ending_context(
                    s.last_user_utterance,
                    conversation_history
                )
                
                end_intent = llm_analysis.get("end_intent", "none")
                confidence = llm_analysis.get("confidence", 0.0)
                reason = llm_analysis.get("reason", "")
                
                breakdown["llm_analysis"] = {
                    "intent": end_intent,
                    "confidence": confidence,
                    "reason": reason
                }
                
                # LLM 분석 결과에 따른 점수 부여
                if end_intent == "explicit" and confidence >= 0.85:
                    # 명시적 종료 의도 → 즉시 하드 종료
                    score = 100
                    breakdown["llm_explicit_end"] = f"100 (하드 종료) - {reason}"
                    breakdown["total_score"] = 100
                    return 100, breakdown
                    
                # elif end_intent == "soft" and confidence >= 0.6:
                #     # 부드러운 종료 신호 → 소프트 클로징
                #     score = 70
                #     breakdown["llm_soft_end"] = f"70 (소프트 클로징) - {reason}"
                #     breakdown["total_score"] = 70
                #     return 70, breakdown
                    
                elif end_intent == "none":
                    # 종료 의도 없음 → 기존 점수 계산 로직 계속
                    breakdown["llm_no_end"] = f"계속 대화 - {reason}"
                
            except Exception as e:
                breakdown["llm_error"] = f"LLM 분석 실패: {str(e)}"
        
        # 🔄 3. 시간 기반 로직 (LLM 보조)
        # 짧은 응답 반복 (LLM이 놓칠 수 있는 패턴)
        if s.short_ack_count >= 3:
            score += 20
            breakdown["short_ack_repeat"] = f"+20 (count:{s.short_ack_count})"

        # 🔇 4. 사용자 침묵 시간 (시간 기반 판단) - 수정 필요할 수 있음
        if s.last_user_speech_time is not None:
            silence = now - s.last_user_speech_time
            if silence >= 20:
                score = 70
                breakdown["silence_20s+"] = f"70 (소프트) - {int(silence)}초 침묵"
                breakdown["total_score"] = 70
                return 70, breakdown
            elif silence >= 15:
                score += 40
                breakdown["silence_15s+"] = f"+40 ({int(silence)}s)"
            elif silence >= 10:
                score += 25
                breakdown["silence_10s+"] = f"+25 ({int(silence)}s)"

        # 🕐 5. AI 클로징 이후 무응답 (시간 기반 판단) - 수정 필요할 수 있음
        if s.last_ai_closing_time:
            closing_elapsed = now - s.last_ai_closing_time
            user_responded_after_closing = (
                s.last_user_speech_time is not None and 
                s.last_user_speech_time > s.last_ai_closing_time
            )
            
            if not user_responded_after_closing:
                if closing_elapsed >= 10:
                    score = 100
                    breakdown["soft_closing_hard_timeout"] = f"100 (하드) - {int(closing_elapsed)}초 무응답"
                    breakdown["total_score"] = 100
                    return 100, breakdown
                elif closing_elapsed >= 5:
                    score += 30
                    breakdown["soft_closing_timeout"] = f"+30 ({int(closing_elapsed)}s)"
        
        final_score = max(0, min(score, 100))
        breakdown["total_score"] = final_score
        
        return final_score, breakdown

    def decide(self, s: EndDecisionSignals) -> tuple[str, int, dict]:
        """
        종료 판단 및 점수/상세 내역 반환 (기존 방식 - 하위 호환성 유지)
        
        Returns:
            tuple[str, int, dict]: (판단 결과, 총점, 상세 내역)
        """
        sc, breakdown = self.score(s)
        if sc >= 100:
            decision = "hard_end"
        elif sc >= self.soft_threshold:
            decision = "soft_close"
        else:
            decision = "keep"
        
        return decision, sc, breakdown
    
    def should_analyze_with_llm(self, s: EndDecisionSignals) -> bool:
        """
        LLM 분석이 필요한 상황인지 판단
        
        Args:
            s: 종료 판단 신호
            
        Returns:
            bool: LLM 분석이 필요하면 True
        """
        # 최근 5초 이내 사용자 발화가 있었을 때만 LLM 사용
        if s.last_utterance_time:
            elapsed = time.time() - s.last_utterance_time
            return elapsed < 5.0
        return False
    
    def decide_smart(self, s: EndDecisionSignals, conversation_history: list = None) -> tuple[str, int, dict]:
        """
        🚀 스마트 종료 판단 (필요할 때만 LLM 사용 - 성능 최적화)
        
        사용자가 방금 발화했을 때만 LLM으로 맥락 분석하고,
        그 외에는 빠른 시간 기반 로직만 사용
        
        Args:
            s: 종료 판단 신호
            conversation_history: 대화 기록
            
        Returns:
            tuple[str, int, dict]: (판단 결과, 총점, 상세 내역)
        """
        # 사용자가 방금(5초 이내) 발화했으면 LLM 사용
        if self.should_analyze_with_llm(s):
            sc, breakdown = self.score_with_llm(s, conversation_history)
            breakdown["analysis_mode"] = "LLM (recent utterance)"
        else:
            # 시간 기반만 (빠름)
            sc, breakdown = self.score(s)
            breakdown["analysis_mode"] = "Time-based (fast)"
        
        if sc >= 100:
            decision = "hard_end"
        elif sc >= self.soft_threshold:
            decision = "soft_close"
        else:
            decision = "keep"
        
        return decision, sc, breakdown

def is_short_ack(text: str) -> bool:
    return match_any(text or "", SHORT_ACKS)