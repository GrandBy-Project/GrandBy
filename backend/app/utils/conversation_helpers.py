"""
대화 관련 Helper 함수들
"""
import logging
from datetime import datetime
from pytz import timezone
import random

from app.database import get_db
from app.services.ai_call.session_store import get_session_store
from app.services.ai_call.llm_service import LLMService
from app.core.state import saved_calls

logger = logging.getLogger(__name__)

# 한국 시간대 (KST, UTC+9)
KST = timezone('Asia/Seoul')

# 세션 스토어
session_store = get_session_store()


def get_time_based_welcome_message() -> str:
    """
    한국 시간대 기준으로 시간대별 환영 메시지 또는 기본 인사말 랜덤 선택
    
    Returns:
        str: 시간대에 맞는 환영 메시지 또는 기본 인사말
    """
    kst_now = datetime.now(KST)
    hour = kst_now.hour
    
    # 기본 인사말 (시간대에 상관없이 사용 가능, 절반에 '하루' 포함)
    default_messages = [
        "안녕하세요 어르신, 하루에요. 반가워요!",
        "어르신 안녕하세요. 하루입니다. 오늘 어떻게 지내세요?",
        "안녕하세요, 오늘도 좋은 하루 보내고 계신가요?",
        "안녕하세요 어르신! 저 하루예요. 기분은 어떠세요?",
        "어르신 안녕하세요. 하루에요. 건강은 어떠신가요?",
        "안녕하세요, 오늘 하루 잘 지내고 계세요?",
        "안녕하세요 어르신! 하루에요. 오늘은 어떻게 지내고 계세요?",
        "어르신 안녕하세요. 하루에요. 오늘은 어떠세요?",
        "안녕하세요, 기분 좋은 하루 보내고 계신가요?",
        "안녕하세요 어르신! 오늘 하루는 어떠세요?",
        "어르신 안녕하세요. 하루입니다. 오늘도 이렇게 뵙게 되어 기뻐요!",
        "어르신 안녕하세요. 오늘 하루는 어떠셨어요?",
        "안녕하세요, 건강하게 지내고 계신가요?",
        "안녕하세요 어르신! 하루에요. 오늘 컨디션 괜찮으신가요?",
        "어르신 안녕하세요. 오늘도 기운차게 보내고 계신가요?",
        "안녕하세요, 오늘 하루 어떠셨나요?",
        "안녕하세요 어르신! 하루입니다. 오늘도 별 탈 없이 잘 지내고 계신가요?",
        "안녕하세요, 오늘 하루 잘 지내셨나요?",
        "어르신 안녕하세요. 하루에요. 오늘 기분은 어떠세요?",
        "안녕하세요, 오늘 하루 잘 보내고 계신가요?",
        "어르신 안녕하세요. 하루입니다. 오늘도 힘차게 보내고 계신가요?",
        "안녕하세요, 오늘 하루 어떠셨는지 궁금해요.",
        "어르신 안녕하세요. 오늘 하루 잘 지내셨나요?"
    ]
    
    # 시간대별 인사말
    time_specific_messages = []
    
    if 0 <= hour < 6:
        # 새벽 (0-6시)
        time_specific_messages = [
            "안녕하세요 어르신, 저 하루에요. 새벽인데 잘 주무시고 계셨나요?",
            "안녕하세요, 하루입니다. 이 새벽에 뵙네요. 잘 주무시고 계셨나요?",
            "어르신, 새벽인데 건강은 어떠세요?",
            "안녕하세요, 새벽 시간에 깨어 계시네요. 편하게 주무시고 계셨나요?"
        ]
    elif 6 <= hour < 12:
        # 아침 (6-12시)
        time_specific_messages = [
            "아침부터 뵈니 정말 기뻐요! 저 하루에요!",
            "안녕하세요 어르신, 하루입니다. 좋은 아침이에요!",
            "아침부터 뵈니 반가워요. 하루예요. 잘 주무셨어요?",
            "안녕하세요, 좋은 아침이네요. 오늘 하루도 기운차게 시작하시는군요!",
            "어르신, 저 하루에요. 아침부터 뵈니 정말 기쁩니다!",
            "안녕하세요, 어젯 밤 잘 주무셨어요?",
            "좋은 아침이에요, 어르신! 하루입니다. 아침 식사는 하셨어요?",
            "안녕하세요, 아침부터 뵈니 정말 반가워요."
        ]
    elif 12 <= hour < 18:
        # 오후 (12-18시)
        time_specific_messages = [
            "안녕하세요 어르신, 하루에요. 좋은 오후네요!",
            "안녕하세요, 오후에 뵈니 반가워요.",
            "어르신, 저 하루입니다. 점심은 드셨어요? 좋은 오후 보내고 계신가요?",
            "안녕하세요, 하루에요. 오후 시간에 뵙네요. 어떻게 지내세요?",
            "좋은 오후예요, 어르신! 오늘 하루 잘 보내고 계세요?",
            "안녕하세요, 오후인데 오늘은 어떻게 지내셨어요?",
            "어르신, 하루예요. 오후에 뵈니 기뻐요. 건강은 어떠세요?",
            "안녕하세요, 좋은 오후네요. 오늘 하루 잘 지내고 계신가요?"
        ]
    elif 18 <= hour < 22:
        # 저녁 (18-22시)
        time_specific_messages = [
            "안녕하세요 어르신, 하루에요. 저녁인데 식사는 하셨어요?",
            "어르신, 저녁 시간에 뵈니 반가워요. 저녁 드셨어요?",
            "안녕하세요, 저 하루입니다. 저녁인데 오늘 하루 잘 보내셨어요?",
            "저녁인데 식사는 하셨나요, 어르신?",
            "안녕하세요, 하루예요. 좋은 저녁이에요. 저녁은 드셨어요?",
            "어르신, 저 하루에요. 저녁 시간에 뵙네요. 저녁 식사는 하셨어요?",
            "안녕하세요, 저녁인데 오늘 하루 어떠셨어요?",
            "저녁에 뵈니 기쁘네요. 하루입니다. 식사는 드셨나요?",
            "안녕하세요 어르신, 저녁 시간에 뵙네요. 저녁은 드셨어요?",
            "어르신, 하루에요. 저녁인데 건강은 어떠세요? 저녁 식사는 하셨어요?"
        ]
    else:
        # 밤 (22-24시)
        time_specific_messages = [
            "안녕하세요 어르신, 하루에요. 밤인데 아직 안 주무시나요?",
            "어르신, 밤 시간에 깨어 계시네요. 잘 주무시고 계셨나요?",
            "안녕하세요, 저 하루입니다. 밤인데 건강은 어떠세요?",
            "밤에 뵈니 반가워요. 오늘 하루 잘 보내셨어요?",
            "안녕하세요, 하루예요. 좋은 밤이네요. 내일도 좋은 하루 되세요.",
            "어르신, 밤인데 오늘 하루 어떠셨어요?",
            "밤 시간에 뵈니 기쁘네요. 하루에요. 편하게 주무시고 계셨나요?"
        ]
    
    # 기본 인사말과 시간대별 인사말을 합쳐서 랜덤 선택
    all_messages = default_messages + time_specific_messages
    
    # 랜덤으로 하나 선택
    return random.choice(all_messages)


async def save_conversation_to_db(call_sid: str, conversation: list):
    """
    대화 내용을 DB에 저장하는 공통 함수
    
    Args:
        call_sid: Twilio Call SID
        conversation: 대화 내용 리스트 [{"role": "user", "content": "..."}, ...]
    """
    # 이미 저장되었으면 스킵 (중복 방지)
    if session_store.is_saved(call_sid):
        logger.info(f"⏭️  이미 저장된 통화: {call_sid}")
        return
    
    # 저장할 내용이 없으면 스킵
    if not conversation or len(conversation) == 0:
        logger.warning(f"⚠️  저장할 대화 내용이 없음: {call_sid}")
        return
    
    logger.info(f"💾 대화 기록 저장 시작: {len(conversation)}개 메시지")
    
    try:
        from app.models.call import CallLog, CallTranscript, CallStatus
        db = next(get_db())
        
        # 1. CallLog 업데이트 (대화 요약)
        call_log_db = db.query(CallLog).filter(CallLog.call_id == call_sid).first()
        
        if call_log_db:
            # LLM 요약 생성 (대화가 있는 경우에만)
            if len(conversation) > 0:
                logger.info("🤖 LLM으로 통화 요약 생성 중...")
                # 각 통화마다 독립적인 LLM 서비스 인스턴스 생성 (동시 통화 충돌 방지)
                llm_service = LLMService()
                summary = llm_service.summarize_call_conversation(conversation)
                call_log_db.conversation_summary = summary
                logger.info(f"✅ 요약 생성 완료: {summary[:100]}...")
            
            db.commit()
            logger.info(f"✅ CallLog 업데이트 완료")
        else:
            logger.warning(f"⚠️  CallLog를 찾을 수 없음: {call_sid}")
        
        # 2. CallTranscript 저장 (화자별 대화 내용)
        for idx, message in enumerate(conversation):
            speaker = "ELDERLY" if message["role"] == "user" else "AI"
            
            transcript = CallTranscript(
                call_id=call_sid,
                speaker=speaker,
                text=message["content"],
                timestamp=idx * 10.0,  # 대략적인 타임스탬프 (10초 간격)
                created_at=datetime.utcnow()
            )
            db.add(transcript)
        
        db.commit()
        logger.info(f"✅ 대화 내용 {len(conversation)}개 저장 완료")
        
        # 저장 성공 플래그 설정
        session_store.mark_saved(call_sid)
        
        db.close()
        
    except Exception as e:
        logger.error(f"❌ DB 저장 실패: {e}")
        import traceback
        logger.error(traceback.format_exc())
        if 'db' in locals():
            db.rollback()
            db.close()

