import time
import re
from dataclasses import dataclass

CLOSING_KEYWORDS = [
    r"그만(할게|할께|할까요)?",
    r"여기까(지)?",
    r"됐(어|습니다|어요|어요용)?",
    r"괜찮(아|습니다)?",
    r"고마(워|워요|웠어|했습니다)?",
    r"감사(합니다|했어요)?",
    r"다음에",
    r"나중에",
    r"이만 (끊자|끝내자|마무리하자)?",
    r"오늘은 여기까지",
    r"내일 또( 봬요| 통화해요)?"
]
SHORT_ACKS = [r"^(응|어|음|네|예|응응|네네)[.!?]?"]

def match_any(text: str, patterns: list[str]) -> bool:
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

class EndDecisionEngine:
    def __init__(self, soft_threshold=70):
        self.soft_threshold = soft_threshold

    def score(self, s: EndDecisionSignals) -> tuple[int, dict]:
        """
        종료 판단 점수 계산 및 상세 내역 반환
        
        Returns:
            tuple[int, dict]: (총점, 상세 내역)
        """
        now = time.time()
        score = 0
        breakdown = {}
        has_closing_keyword = False

        # ⏱️ 1. 최대 통화 시간 초과 (즉시 하드 종료)
        call_duration = now - s.call_start_time
        if call_duration >= s.max_call_seconds:
            breakdown["max_time_exceeded"] = 100
            breakdown["call_duration_sec"] = int(call_duration)
            return 100, breakdown
        
        breakdown["call_duration_sec"] = int(call_duration)

        # 💬 2. 종료 의도 키워드 감지 (최우선 - 즉시 소프트 클로징)
        # 단, 최근 5초 이내 발화에만 적용 (오래된 키워드로 계속 70점 고정 방지)
        if match_any(s.last_user_utterance, CLOSING_KEYWORDS):
            if s.last_utterance_time and (now - s.last_utterance_time) <= 5.0:
                has_closing_keyword = True
                # 종료 키워드 사용 시 즉시 70점으로 설정 (소프트 클로징 보장)
                score = 70
                breakdown["closing_keyword"] = "70 (즉시 소프트)"
                breakdown["total_score"] = 70
                return 70, breakdown
            else:
                # 5초 이상 경과한 종료 키워드는 무시하고 일반 점수 계산
                breakdown["closing_keyword_expired"] = f"무시 (경과: {int(now - s.last_utterance_time) if s.last_utterance_time else 0}초)"

        # ✅ 3. 태스크 완료 후 긍정 응답
        if s.task_completed:
            score += 40
            breakdown["task_completed"] = 40

        # 🔄 4. 짧은 응답 반복
        if s.short_ack_count >= 3:
            score += 20
            breakdown["short_ack_repeat"] = f"+20 (count:{s.short_ack_count})"

        # 🔇 5. 사용자 침묵 시간 기반
        if s.last_user_speech_time is not None:
            silence = now - s.last_user_speech_time
            if silence >= 15:
                score += 40
                breakdown["silence_15s+"] = f"+40 ({int(silence)}s)"
            elif silence >= 10:
                score += 25
                breakdown["silence_10s+"] = f"+25 ({int(silence)}s)"
            elif silence >= 5:
                score += 10
                breakdown["silence_5s+"] = f"+10 ({int(silence)}s)"
            else:
                breakdown["silence"] = f"{int(silence)}s (미적용)"

        # 🕐 6. AI 클로징 이후 무응답 (중복 방지)
        if s.last_ai_closing_time:
            closing_elapsed = now - s.last_ai_closing_time
            if 5 <= closing_elapsed < 10:
                score += 30
                breakdown["soft_closing_timeout"] = f"+30 ({int(closing_elapsed)}s)"
            else:
                breakdown["soft_closing_elapsed"] = f"{int(closing_elapsed)}s"

        # 회복 (감쇠) - 단, 종료 키워드가 있으면 적용하지 않음
        if not has_closing_keyword and s.last_user_speech_time is not None and (now - s.last_user_speech_time) < 5:
            # 최근에 대화 재개됨 → 감쇠
            score -= 10
            breakdown["recovery_penalty"] = "-10 (최근 대화)"
        
        final_score = max(0, min(score, 100))
        breakdown["total_score"] = final_score
        
        return final_score, breakdown

    def decide(self, s: EndDecisionSignals) -> tuple[str, int, dict]:
        """
        종료 판단 및 점수/상세 내역 반환
        
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

def is_short_ack(text: str) -> bool:
    return match_any(text or "", SHORT_ACKS)


def classify_soft_closing_response(text: str) -> str:
    """
    소프트 클로징 멘트 후 사용자 응답을 긍정(계속)/부정(종료)/불명으로 분류
    
    Args:
        text: 사용자 발화 텍스트
    
    Returns:
        str: "continue" (대화 계속), "end" (종료 의사), "unclear" (불명확)
    """
    normalized = (text or "").strip().lower()
    
    # 명확한 종료 의사
    end_patterns = [
        r"(됐|됐어|됐습니다|됐어요|괜찮아|괜찮습니다|괜찮아요|충분해|충분합니다)",
        r"(여기까지|이만|그만|끝|종료|마무리)",
        r"(안.*할래|안.*할게|이제.*그만|더.*이상.*안)",
        r"^(네|예|응|어)\.?\s*(됐|괜찮|충분|그만|끝)",
    ]
    
    for pattern in end_patterns:
        if re.search(pattern, normalized):
            return "end"
    
    # 명확한 계속 의사
    continue_patterns = [
        r"(더|조금.*더|좀.*더|계속|이어|아직)",
        r"(얘기.*나누|이야기.*나누|말.*하|이어.*가|계속.*해)",
        r"(아니|아니야|아니에요|아니요)",  # 종료 부정 = 계속
        r"(괜찮.*더|더.*괜찮)",
    ]
    
    for pattern in continue_patterns:
        if re.search(pattern, normalized):
            return "continue"
    
    # 불명확 (짧은 긍정 응답 등)
    return "unclear"