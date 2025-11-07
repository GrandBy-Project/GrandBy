"""
Grandby FastAPI Application
메인 애플리케이션 진입점
"""

from fastapi import FastAPI, Request, WebSocket, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, HTMLResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
import logging
import json
import base64
import asyncio
from typing import Dict
from datetime import datetime
from sqlalchemy.orm import Session
from pathlib import Path
import time
import random
from pytz import timezone

from twilio.twiml.voice_response import VoiceResponse, Connect, Stream

from app.routers import auth, users, calls, diaries, todos, notifications, dashboard
from app.config import settings, is_development
from app.database import test_db_connection, get_db
from app.services.ai_call.llm_service import LLMService
from app.services.ai_call.session_store import get_session_store
from app.services.ai_call.twilio_service import TwilioService
from app.services.ai_call.rtzr_stt_realtime import RTZRRealtimeSTT, LLMPartialCollector
from app.services.ai_call.naver_clova_tts_service import naver_clova_tts_service
from app.utils.performance_metrics import PerformanceMetricsCollector

# 로거 설정 (시간 포함)
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# WebSocket 연결 및 대화 세션 관리
# 주의: llm_service와 naver_clova_tts_service는 각 통화마다 독립적인 인스턴스를 생성하여 사용
# (동시 통화 시 충돌 방지를 위해 전역 인스턴스 사용하지 않음)
active_connections: Dict[str, WebSocket] = {}
conversation_sessions: Dict[str, list] = {}
saved_calls: set = set()  # 중복 저장 방지용 플래그

session_store = get_session_store()
# TTS 재생 완료 시간 추적 (call_sid -> (completion_time, total_playback_duration))
active_tts_completions: Dict[str, tuple[float, float]] = {}

# 성능 메트릭 수집기 관리 (call_sid -> PerformanceMetricsCollector)
performance_collectors: Dict[str, PerformanceMetricsCollector] = {}

# ==================== Helper Functions ====================

# 한국 시간대 (KST, UTC+9)
KST = timezone('Asia/Seoul')

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

# ==================== 대화 내용 DB 저장 함수 ====================

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

# ==================== Helper Functions ====================

async def process_streaming_response(
    websocket: WebSocket,
    stream_sid: str,
    user_text: str,
    conversation_history: list,
    rtzr_stt=None,
    call_sid=None,
    metrics_collector=None,
    turn_index=None,
    tts_service=None  # 각 통화마다 독립적인 TTS 서비스 인스턴스
) -> str:
    """
    최적화된 스트리밍 응답 처리 - 사전 연결된 WebSocket 사용
    
    핵심 개선:
    - LLM 스트림을 두 갈래로 분리 (텍스트 수집 + TTS)
    - 🚀 첫 TTS 재생 후 LLM 종료 판단 (사용자 경험 최적화)
    """
    import audioop
    
    try:
        pipeline_start = time.time()
        full_response = []
        logger.info("=" * 60)
        logger.info("🚀 실시간 스트리밍 파이프라인 시작 (Naver Clova TTS 사용)")
        logger.info("=" * 60)
        
        # Naver Clova TTS 스트리밍 파이프라인
        playback_duration = await llm_to_clova_tts_pipeline(
            websocket,
            stream_sid,
            user_text,
            conversation_history,
            full_response,
            pipeline_start,
            rtzr_stt=rtzr_stt,
            call_sid=call_sid,
            metrics_collector=metrics_collector,
            turn_index=turn_index,
            tts_service=tts_service  # 독립적인 TTS 서비스 인스턴스 전달
        )
        
        pipeline_time = time.time() - pipeline_start
        
        logger.info("=" * 60)
        logger.info(f"✅ 전체 파이프라인 완료: {pipeline_time:.2f}초")
        logger.info(f"   예상 재생 시간: {playback_duration:.2f}초")
        logger.info("=" * 60)
        
        # 재생 완료 대기
        if playback_duration > 0:
            await asyncio.sleep(playback_duration * 1.1)
        
        return "".join(full_response)
        
    except Exception as e:
        logger.error(f"❌ 실시간 스트리밍 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return ""


async def llm_to_clova_tts_pipeline(
    websocket: WebSocket,
    stream_sid: str,
    user_text: str,
    conversation_history: list,
    full_response: list,
    pipeline_start: float,
    rtzr_stt=None,
    call_sid=None,
    metrics_collector=None,
    turn_index=None,
    tts_service=None  # 각 통화마다 독립적인 TTS 서비스 인스턴스
) -> float:
    """
    LLM 텍스트 생성 → Naver Clova TTS → Twilio 전송 파이프라인
    
    핵심:
    - LLM이 문장을 생성하는 즉시 Clova TTS로 변환
    - 변환된 음성을 즉시 Twilio로 전송
    - 실시간 스트리밍 효과
    - 🚀 첫 TTS 재생 후 LLM 종료 판단 수행 (사용자 경험 최적화)
    """
    import re
    import base64
    import audioop

    llm_service = LLMService()
    
    try:
        sentence_buffer = ""
        sentence_count = 0
        first_audio_sent = False
        total_playback_duration = 0.0
        
        logger.info("🤖 [LLM] Naver Clova TTS 스트리밍 시작")
        
        first_token_time = None
        async for chunk in llm_service.generate_response_streaming(user_text, conversation_history):
            # 메트릭 수집: LLM 첫 토큰 시간
            if first_token_time is None and chunk.strip():
                first_token_time = time.time()
                if metrics_collector is not None and turn_index is not None:
                    metrics_collector.record_llm_first_token(turn_index, first_token_time)
                    logger.debug(f"📊 [메트릭] LLM 첫 토큰 시간 기록: {first_token_time:.3f}")
            
            sentence_buffer += chunk
            full_response.append(chunk)
            
            # 문장 종료 감지
            should_send = False
            
            # 1. 명확한 문장 종료
            if re.search(r'[.!?\n。！？]', chunk):
                should_send = True
            
            # 2. 쉼표로 자연스럽게 끊기
            elif len(sentence_buffer) > 40 and re.search(r'[,，]', sentence_buffer[-5:]):
                should_send = True
            
            # 3. 너무 긴 문장 강제 분할
            elif len(sentence_buffer) > 80:
                should_send = True
            
            if should_send and sentence_buffer.strip():
                sentence = sentence_buffer.strip()
                sentence_count += 1
                
                elapsed = time.time() - pipeline_start
                
                if not first_audio_sent:
                    logger.info(f"⚡ [첫 문장] +{elapsed:.2f}초에 생성 완료!")
                    first_audio_sent = True
                
                logger.info(f"🔊 [문장 {sentence_count}] TTS 변환 시작: {sentence[:40]}...")
                
                # 메트릭 수집: TTS 시작 시간 (첫 문장만)
                if sentence_count == 1 and metrics_collector is not None and turn_index is not None:
                    tts_start_time = time.time()
                    metrics_collector.record_tts_start(turn_index, tts_start_time)
                    logger.debug(f"📊 [메트릭] TTS 시작 시간 기록: {tts_start_time:.3f}")
                
                # ✅ 독립적인 TTS 서비스 인스턴스 사용 (동시 통화 충돌 방지)
                if tts_service is None:
                    # Fallback: 전역 인스턴스 사용 (하위 호환성)
                    from app.services.ai_call.naver_clova_tts_service import naver_clova_tts_service
                    audio_data, tts_time = await naver_clova_tts_service.text_to_speech_bytes(sentence)
                else:
                    audio_data, tts_time = await tts_service.text_to_speech_bytes(sentence)
                
                if audio_data:
                    elapsed_tts = time.time() - pipeline_start
                    logger.info(f"✅ [문장 {sentence_count}] TTS 완료 (+{elapsed_tts:.2f}초, {tts_time:.2f}초)")
                    
                    # 메트릭 수집: TTS 완료 시간 기록
                    tts_completion_time = time.time()
                    if metrics_collector is not None and turn_index is not None:
                        # 첫 문장의 TTS 완료 시간 (LLM 첫 토큰부터 첫 TTS 완료까지의 지연시간 계산용)
                        if sentence_count == 1:
                            # 첫 문장의 TTS 완료 시간을 정확히 기록
                            metrics_collector.record_tts_completion(turn_index, tts_completion_time, is_first_sentence=True)
                            logger.debug(
                                f"📊 [메트릭] 첫 문장 TTS 완료 시간 기록: {tts_completion_time:.6f} "
                                f"(LLM 첫 토큰 이후: {turn_index < len(metrics_collector.metrics['turns']) and metrics_collector.metrics['turns'][turn_index]['llm']['first_token_time'] is not None})"
                            )
                        else:
                            # 나머지 문장들은 완료 시간만 업데이트 (first_completion_time은 기록하지 않음)
                            metrics_collector.record_tts_completion(turn_index, tts_completion_time, is_first_sentence=False)
                            logger.debug(f"📊 [메트릭] 문장 {sentence_count} TTS 완료 시간 업데이트: {tts_completion_time:.3f}")
                    
                    # WAV → mulaw 변환 및 Twilio 전송
                    playback_duration = await send_clova_audio_to_twilio(
                        websocket,
                        stream_sid,
                        audio_data,
                        sentence_count,
                        pipeline_start
                    )
                    
                    total_playback_duration += playback_duration
                else:
                    logger.warning(f"⚠️ [문장 {sentence_count}] TTS 실패, 건너뜀")
                
                sentence_buffer = ""
        
        # 마지막 문장 처리
        if sentence_buffer.strip():
            sentence_count += 1
            logger.info(f"🔊 [마지막 문장] TTS 변환 시작: {sentence_buffer.strip()[:40]}...")
            
            # ✅ 독립적인 TTS 서비스 인스턴스 사용 (동시 통화 충돌 방지)
            if tts_service is None:
                # Fallback: 전역 인스턴스 사용 (하위 호환성)
                from app.services.ai_call.naver_clova_tts_service import naver_clova_tts_service
                audio_data, tts_time = await naver_clova_tts_service.text_to_speech_bytes(sentence_buffer.strip())
            else:
                audio_data, tts_time = await tts_service.text_to_speech_bytes(sentence_buffer.strip())
            
            if audio_data:
                # 마지막 문장의 TTS 완료 시간 기록 (first_completion_time은 기록하지 않음)
                tts_completion_time = time.time()
                if metrics_collector is not None and turn_index is not None:
                    metrics_collector.record_tts_completion(turn_index, tts_completion_time, is_first_sentence=False)
                    logger.debug(f"📊 [메트릭] 마지막 문장 TTS 완료 시간 업데이트: {tts_completion_time:.3f}")
                
                playback_duration = await send_clova_audio_to_twilio(
                    websocket,
                    stream_sid,
                    audio_data,
                    sentence_count,
                    pipeline_start
                )

                total_playback_duration += playback_duration
            else:
                logger.warning("⚠️ 마지막 문장 TTS 실패, 건너뜀")
        
        logger.info(f"✅ [전체] 총 {sentence_count}개 문장 처리 완료")
        
        # ✅ TTS 완료 시점과 재생 시간 기록
        if call_sid:
            completion_time = time.time()
            active_tts_completions[call_sid] = (completion_time, total_playback_duration)
            logger.info(f"📝 [TTS 추적] {call_sid}: 완료 시점={completion_time:.2f}, 재생 시간={total_playback_duration:.2f}초")
            
            # 마지막 TTS 완료 시간 업데이트 (first_completion_time은 이미 첫 문장에서 기록됨)
            if metrics_collector is not None and turn_index is not None:
                # 첫 문장이 아닌 경우에만 호출 (첫 문장은 이미 기록됨)
                # completion_time만 업데이트하고 first_completion_time은 건드리지 않음
                metrics_collector.record_tts_completion(turn_index, completion_time, is_first_sentence=False)
           
                
        return total_playback_duration  
        
    except Exception as e:
        logger.error(f"❌ Naver Clova TTS 파이프라인 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0.0


async def send_clova_audio_to_twilio(
    websocket: WebSocket,
    stream_sid: str,
    audio_data: bytes,
    sentence_index: int,
    pipeline_start: float
) -> float:
    """
    Clova TTS로 생성된 WAV 오디오를 Twilio로 전송
    
    Args:
        websocket: Twilio WebSocket
        stream_sid: Twilio Stream SID
        audio_data: WAV 오디오 데이터
        sentence_index: 문장 번호
        pipeline_start: 파이프라인 시작 시간
    
    Returns:
        float: 재생 시간
    """
    import wave
    import io
    import base64
    import audioop
    
    try:
        # WAV 파일 파싱
        wav_io = io.BytesIO(audio_data)
        with wave.open(wav_io, 'rb') as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            framerate = wav_file.getframerate()
            n_frames = wav_file.getnframes()
            pcm_data = wav_file.readframes(n_frames)
        
        logger.info(f"🎵 [문장 {sentence_index}] 원본: {framerate}Hz, {channels}ch")
        
        # Stereo → Mono 변환
        if channels == 2:
            pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)
        
        # 샘플레이트 변환: 8kHz (Twilio 요구사항)
        if framerate != 8000:
            pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, 8000, None)
        
        # PCM → mulaw 변환
        mulaw_data = audioop.lin2ulaw(pcm_data, 2)
        
        # 재생 시간 계산
        playback_duration = len(mulaw_data) / 8000.0
        
        # Base64 인코딩
        audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
        
        # Twilio로 청크 단위 전송
        chunk_size = 8000  # 8KB 청크
        chunk_count = 0
        
        for i in range(0, len(audio_base64), chunk_size):
            chunk = audio_base64[i:i + chunk_size]
            chunk_count += 1
            
            message = {
                "event": "media",
                "streamSid": stream_sid,
                "media": {"payload": chunk}
            }
            
            try:
                await websocket.send_text(json.dumps(message))
                logger.debug(f"📤 [문장 {sentence_index}] 청크 {chunk_count} 전송 완료 ({len(chunk)} bytes)")
                
                # 마지막 청크가 아니면 짧은 딜레이
                if i + chunk_size < len(audio_base64):
                    await asyncio.sleep(0.02)  # 20ms
                    
            except Exception as e:
                logger.error(f"❌ [문장 {sentence_index}] 청크 {chunk_count} 전송 실패: {e}")
                # 첫 번째 청크 실패 시 전체 중단
                if chunk_count == 1:
                    raise
                # 중간 청크 실패는 경고만
                logger.warning(f"⚠️ [문장 {sentence_index}] 청크 {chunk_count} 전송 실패, 계속 진행")
        
        elapsed = time.time() - pipeline_start
        logger.debug(f"📤 [문장 {sentence_index}] Twilio 전송 완료 ({chunk_count} 청크, +{elapsed:.2f}초)")
        
        return playback_duration
        
    except Exception as e:
        logger.error(f"❌ [문장 {sentence_index}] Twilio 전송 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0.0

# Lifespan 이벤트 (startup/shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 이벤트"""
    # Startup
    logger.info("🚀 Starting Grandby API Server...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug Mode: {settings.DEBUG}")
    
    # DB 연결 테스트
    if test_db_connection():
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")
    
    # Sentry 초기화 (프로덕션 환경)
    if settings.SENTRY_DSN and not is_development():
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,
        )
        logger.info("✅ Sentry initialized")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Grandby API Server...")


# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 기반 어르신 케어 플랫폼 Backend API",
    version=settings.APP_VERSION,
    docs_url="/docs" if is_development() else None,  # 프로덕션에서는 Swagger 비활성화
    redoc_url="/redoc" if is_development() else None,
    lifespan=lifespan,
)


# ==================== Middleware ====================

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 요청 로깅 Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """모든 HTTP 요청 로깅 (응답 크기 및 로딩 시간 포함)"""
    start_time = time.perf_counter()
    
    # 요청 시작 로깅
    logger.info(f"📥 {request.method} {request.url.path}")
    
    # 응답 처리
    response = await call_next(request)
    
    # 로딩 시간 계산 (밀리초)
    elapsed_time = (time.perf_counter() - start_time) * 1000
    
    # 응답 크기 측정
    response_size = None
    if "content-length" in response.headers:
        # Content-Length 헤더가 있으면 사용
        try:
            response_size = int(response.headers["content-length"])
        except (ValueError, TypeError):
            response_size = None
    else:
        # Content-Length 헤더가 없으면 응답 본문 읽기 (스트리밍 응답이 아닌 경우에만)
        try:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            response_size = len(body)
            
            # 응답 본문을 다시 스트림으로 변환
            from starlette.responses import Response
            response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=getattr(response, 'media_type', None) or response.headers.get('content-type', 'application/json')
            )
        except Exception as e:
            # 응답 본문 읽기 실패 시 크기 측정 건너뛰기
            logger.debug(f"⚠️ 응답 크기 측정 실패 (스트리밍 응답일 수 있음): {e}")
            response_size = None
    
    # 크기를 읽기 쉬운 형식으로 변환
    size_str = ""
    if response_size is not None:
        if response_size < 1024:
            size_str = f"{response_size}B"
        elif response_size < 1024 * 1024:
            size_str = f"{response_size / 1024:.2f}KB"
        else:
            size_str = f"{response_size / (1024 * 1024):.2f}MB"
    
    # 응답 로깅 (상태 코드, 크기, 시간)
    logger.info(
        f"📤 {request.method} {request.url.path} - "
        f"{response.status_code} | "
        f"{size_str} | "
        f"{elapsed_time:.2f}ms"
    )
    
    return response


# ==================== Exception Handlers ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """422 Validation Error 상세 정보 로깅"""
    logger.error(f"❌ 422 Validation Error:")
    logger.error(f"❌ URL: {request.url}")
    logger.error(f"❌ Method: {request.method}")
    logger.error(f"❌ Body: {exc.body}")
    logger.error(f"❌ Errors: {exc.errors()}")
    
    # 상세 에러 정보를 JSON으로 반환
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation Error",
            "errors": exc.errors(),
            "body": exc.body if isinstance(exc.body, dict) else (exc.body.decode() if exc.body else None)
        }
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """404 에러 핸들러"""
    return JSONResponse(
        status_code=404,
        content={
            "detail": "요청하신 리소스를 찾을 수 없습니다.",
            "path": str(request.url.path)
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """500 에러 핸들러"""
    logger.error(f"Internal Server Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "서버 내부 오류가 발생했습니다.",
            "error": str(exc) if is_development() else "Internal Server Error"
        }
    )


# ==================== Root Endpoints ====================

@app.get("/", tags=["Root"])
async def root():
    """루트 엔드포인트"""
    return {
        "message": "🏠 Welcome to Grandby API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if is_development() else "disabled",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """헬스 체크 엔드포인트 (Docker, Kubernetes용)"""
    db_status = "healthy" if test_db_connection() else "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }


@app.get("/privacy", response_class=HTMLResponse, tags=["Legal"])
@app.get("/privacy-policy", response_class=HTMLResponse, tags=["Legal"])
async def privacy_policy():
    """
    개인정보 처리방침 페이지 (구글 플레이 콘솔 제출용)
    
    URL: https://grandby-app.store/privacy
    또는: https://grandby-app.store/privacy-policy
    """
    html_content = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>그랜비 개인정보 처리방침</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
            line-height: 1.8;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 28px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 22px;
            padding-left: 10px;
            border-left: 4px solid #3498db;
        }
        h3 {
            color: #555;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 18px;
        }
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        ul, ol {
            margin-left: 30px;
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 8px;
        }
        .last-updated {
            color: #7f8c8d;
            font-size: 14px;
            margin-bottom: 30px;
            text-align: right;
        }
        .contact-info {
            background-color: #ecf0f1;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .contact-info h3 {
            margin-top: 0;
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 24px;
            }
            h2 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>개인정보 처리방침</h1>
        <p class="last-updated">최종 수정일: 2024년 1월 1일</p>
        
        <p>그랜비(이하 "회사")는 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보 보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.</p>
        
        <h2>제1조 (개인정보의 처리 목적)</h2>
        <p>그랜비(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
        
        <h3>1. 회원 관리</h3>
        <ul>
            <li>회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리</li>
            <li>각종 고지·통지, 고충처리, 분쟁 조정을 위한 기록 보존</li>
        </ul>
        
        <h3>2. 서비스 제공</h3>
        <ul>
            <li>일기장 서비스 제공, AI 전화 서비스 제공</li>
            <li>할 일 관리 서비스 제공, 보호자-어르신 연결 서비스 제공</li>
            <li>맞춤형 콘텐츠 제공 및 서비스 개선</li>
        </ul>
        
        <h3>3. 안전 및 보안 관리</h3>
        <ul>
            <li>이상 징후 탐지 및 보호자 알림</li>
            <li>부정 이용 방지 및 서비스 안정성 확보</li>
        </ul>
        
        <h2>제2조 (개인정보의 처리 및 보유기간)</h2>
        <p>1. 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
        <p>2. 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.</p>
        <ul>
            <li>회원 가입 및 관리: 회원 탈퇴 시까지 (단, 관계 법령 위반에 따른 수사·조사 등이 진행중인 경우에는 해당 수사·조사 종료 시까지)</li>
            <li>재화 또는 서비스 제공: 재화·서비스 공급완료 및 요금결제·정산 완료 시까지</li>
            <li>전화 상담 등 서비스 이용 기록: 3년 (통신비밀보호법)</li>
        </ul>
        
        <h2>제3조 (처리하는 개인정보의 항목)</h2>
        <p>회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
        <ol>
            <li><strong>필수항목:</strong> 이메일, 비밀번호, 이름, 전화번호, 생년월일, 성별, 사용자 유형(어르신/보호자)</li>
            <li><strong>선택항목:</strong> 프로필 사진, 알림 수신 설정</li>
            <li><strong>자동 수집항목:</strong> IP주소, 쿠키, 서비스 이용 기록, 접속 로그</li>
        </ol>
        
        <h2>제4조 (개인정보의 제3자 제공)</h2>
        <p>회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
        
        <h2>제5조 (개인정보처리의 위탁)</h2>
        <p>회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
        <ul>
            <li>클라우드 서비스 제공업체: 서버 운영 및 데이터 보관</li>
            <li>푸시 알림 서비스 제공업체: 알림 발송 서비스</li>
        </ul>
        
        <h2>제6조 (정보주체의 권리·의무 및 그 행사방법)</h2>
        <p>1. 정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
        <ul>
            <li>개인정보 처리정지 요구</li>
            <li>개인정보 열람요구</li>
            <li>개인정보 정정·삭제요구</li>
        </ul>
        <p>2. 제1항에 따른 권리 행사는 회사에 대해 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.</p>
        
        <h2>제7조 (개인정보의 파기)</h2>
        <p>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
        
        <h2>제8조 (개인정보 보호책임자)</h2>
        <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
        
        <div class="contact-info">
            <h3>개인정보 보호책임자</h3>
            <p><strong>이메일:</strong> privacy@grandby.kr</p>
            <p><strong>전화번호:</strong> 02-1234-5678</p>
        </div>
        
        <h2>제9조 (개인정보의 안전성 확보 조치)</h2>
        <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
        <ol>
            <li><strong>관리적 조치:</strong> 내부관리계획 수립·시행, 정기적 직원 교육 등</li>
            <li><strong>기술적 조치:</strong> 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치</li>
            <li><strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근통제</li>
        </ol>
        
        <h2>제10조 (디바이스 권한의 수집 및 이용)</h2>
        <p>회사는 서비스 제공을 위해 다음과 같은 디바이스 권한을 요청하며, 각 권한은 해당 기능 사용 시에만 요청됩니다.</p>
        
        <h3>1. 필수 권한</h3>
        <ul>
            <li><strong>알림 권한 (POST_NOTIFICATIONS):</strong> 푸시 알림을 통한 서비스 알림 수신을 위해 필요합니다. (거부 시 알림 수신 불가)</li>
            <li><strong>인터넷 접근 권한:</strong> 서비스 이용을 위한 기본 권한입니다.</li>
        </ul>
        
        <h3>2. 선택 권한</h3>
        <ul>
            <li><strong>카메라 권한 (CAMERA):</strong> 프로필 사진 촬영 시 사용됩니다. (거부 시 카메라 촬영 기능 사용 불가)</li>
            <li><strong>사진 라이브러리 접근 권한:</strong> 프로필 사진 및 다이어리 사진 선택 시 사용됩니다. (거부 시 사진 선택 기능 사용 불가)</li>
            <li><strong>위치 권한 (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION):</strong> 날씨 정보 제공을 위해 사용됩니다. (거부 시 날씨 정보 제공 불가)</li>
            <li><strong>오디오 녹음 권한 (RECORD_AUDIO):</strong> AI 전화 서비스 이용 시 음성 인식을 위해 사용됩니다. (거부 시 AI 전화 서비스 이용 불가)</li>
            <li><strong>연락처 접근 권한 (READ_CONTACTS, WRITE_CONTACTS):</strong> 연락처 기능 사용 시 필요합니다. (거부 시 연락처 기능 사용 불가)</li>
        </ul>
        
        <h3>3. 권한 이용 목적</h3>
        <ul>
            <li>카메라 및 사진 라이브러리: 프로필 사진 설정, 다이어리 사진 첨부</li>
            <li>위치 정보: 사용자 위치 기반 날씨 정보 제공</li>
            <li>오디오 녹음: AI 전화 서비스의 음성 인식 및 대화 처리</li>
            <li>연락처: 연락처 관리 기능 제공</li>
            <li>알림: 서비스 관련 알림 및 이상 징후 알림 전송</li>
        </ul>
        
        <h3>4. 권한 거부 시 영향</h3>
        <p>선택 권한의 경우 거부하셔도 서비스의 기본 기능은 이용하실 수 있습니다. 다만, 해당 권한이 필요한 기능은 이용하실 수 없습니다.</p>
        
        <h3>5. 권한 관리</h3>
        <p>사용자는 언제든지 디바이스 설정에서 권한을 변경하거나 철회할 수 있습니다. 권한을 변경하시면 앱을 재시작한 후 변경사항이 적용됩니다.</p>
        
        <h2>제11조 (개인정보 처리방침 변경)</h2>
        <p>이 개인정보 처리방침은 2024년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.</p>
    </div>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


@app.get("/account-deletion", response_class=HTMLResponse, tags=["Legal"])
async def account_deletion():
    """
    계정 및 데이터 삭제 안내 페이지 (구글 플레이 콘솔 제출용)
    
    URL: https://api.grandby-app.store/account-deletion
    """
    html_content = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>그랜비 계정 및 데이터 삭제 안내</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
            line-height: 1.8;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 28px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 22px;
            padding-left: 10px;
            border-left: 4px solid #3498db;
        }
        h3 {
            color: #555;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 18px;
        }
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        ul, ol {
            margin-left: 30px;
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 8px;
        }
        .app-name {
            color: #3498db;
            font-weight: bold;
            font-size: 24px;
        }
        .method-box {
            background-color: #ecf0f1;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #3498db;
        }
        .method-box h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .step {
            background-color: #fff;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
        .step-number {
            display: inline-block;
            background-color: #3498db;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            text-align: center;
            line-height: 30px;
            font-weight: bold;
            margin-right: 10px;
        }
        .contact-info {
            background-color: #ecf0f1;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .contact-info h3 {
            margin-top: 0;
        }
        .warning-box {
            background-color: #fff3cd;
            border: 2px solid #ffc107;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .warning-box h3 {
            color: #856404;
            margin-top: 0;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .data-table th {
            background-color: #3498db;
            color: white;
        }
        .data-table tr:hover {
            background-color: #f5f5f5;
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 24px;
            }
            h2 {
                font-size: 20px;
            }
            .data-table {
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>계정 및 데이터 삭제 안내</h1>
        <p class="app-name">그랜비 (Grandby)</p>
        <p>그랜비 앱에서 계정 및 관련 데이터를 삭제하는 방법을 안내합니다.</p>
        
        <h2>계정 삭제 방법</h2>
        <p>그랜비 앱에서 계정을 삭제하는 방법은 다음과 같습니다:</p>
        
        <div class="method-box">
            <h3>📱 방법 1: 앱 내에서 직접 삭제 (권장)</h3>
            <div class="step">
                <span class="step-number">1</span>
                <strong>앱 실행</strong> → 하단 메뉴에서 <strong>"마이페이지"</strong> 탭 선택
            </div>
            <div class="step">
                <span class="step-number">2</span>
                <strong>"계정 삭제"</strong> 또는 <strong>"회원 탈퇴"</strong> 메뉴 선택
            </div>
            <div class="step">
                <span class="step-number">3</span>
                <strong>비밀번호 확인</strong> (이메일 로그인 사용자의 경우)
            </div>
            <div class="step">
                <span class="step-number">4</span>
                <strong>삭제 확인</strong> → 계정 삭제 완료
            </div>
        </div>
        
        <div class="method-box">
            <h3>📧 방법 2: 이메일로 삭제 요청</h3>
            <p>앱 접근이 어려운 경우, 아래 이메일로 계정 삭제를 요청하실 수 있습니다.</p>
            <div class="step">
                <span class="step-number">1</span>
                <strong>이메일 작성</strong><br>
                받는 사람: <strong>privacy@grandby.kr</strong><br>
                제목: <strong>[계정 삭제 요청]</strong>
            </div>
            <div class="step">
                <span class="step-number">2</span>
                <strong>본인 확인 정보 포함</strong><br>
                - 가입 시 사용한 이메일 주소<br>
                - 가입 시 사용한 전화번호 (선택사항)<br>
                - 계정 삭제 사유 (선택사항)
            </div>
            <div class="step">
                <span class="step-number">3</span>
                <strong>이메일 발송</strong> → 영업일 기준 7일 이내 처리
            </div>
        </div>
        
        <div class="warning-box">
            <h3>⚠️ 계정 삭제 시 주의사항</h3>
            <ul>
                <li><strong>복구 불가:</strong> 계정 삭제 후 30일 이내에 다시 로그인하시면 계정을 복구할 수 있습니다. 30일이 지나면 모든 데이터가 영구적으로 삭제되며 복구가 불가능합니다.</li>
                <li><strong>연결 해제:</strong> 보호자-어르신 연결 관계가 자동으로 해제됩니다.</li>
                <li><strong>서비스 이용 불가:</strong> 계정 삭제 후 앱의 모든 기능을 이용하실 수 없습니다.</li>
            </ul>
        </div>
        
        <h2>삭제되는 데이터</h2>
        <p>계정 삭제 시 다음 데이터가 삭제됩니다:</p>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th>데이터 유형</th>
                    <th>삭제 시점</th>
                    <th>비고</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>계정 정보</strong><br>(이메일, 이름, 전화번호, 생년월일, 성별)</td>
                    <td>즉시 삭제</td>
                    <td>익명화 처리</td>
                </tr>
                <tr>
                    <td><strong>프로필 이미지</strong></td>
                    <td>즉시 삭제</td>
                    <td>서버에서 완전 삭제</td>
                </tr>
                <tr>
                    <td><strong>다이어리</strong><br>(일기 내용, 사진)</td>
                    <td>즉시 삭제</td>
                    <td>복구 불가</td>
                </tr>
                <tr>
                    <td><strong>할 일 (TODO)</strong></td>
                    <td>즉시 삭제</td>
                    <td>복구 불가</td>
                </tr>
                <tr>
                    <td><strong>AI 통화 기록</strong><br>(통화 내용, 녹음 파일)</td>
                    <td>즉시 삭제</td>
                    <td>복구 불가</td>
                </tr>
                <tr>
                    <td><strong>알림 설정</strong></td>
                    <td>즉시 삭제</td>
                    <td>-</td>
                </tr>
                <tr>
                    <td><strong>보호자-어르신 연결 정보</strong></td>
                    <td>즉시 삭제</td>
                    <td>연결 관계 해제</td>
                </tr>
            </tbody>
        </table>
        
        <h2>보관되는 데이터</h2>
        <p>법령에 따라 다음 데이터는 일정 기간 보관 후 삭제됩니다:</p>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th>데이터 유형</th>
                    <th>보관 기간</th>
                    <th>법적 근거</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>서비스 이용 기록</strong><br>(접속 로그, IP 주소)</td>
                    <td>3개월</td>
                    <td>통신비밀보호법</td>
                </tr>
                <tr>
                    <td><strong>계약 또는 청약철회 등에 관한 기록</strong></td>
                    <td>5년</td>
                    <td>전자상거래법</td>
                </tr>
                <tr>
                    <td><strong>대금결제 및 재화의 공급에 관한 기록</strong></td>
                    <td>5년</td>
                    <td>전자상거래법</td>
                </tr>
                <tr>
                    <td><strong>소비자 불만 또는 분쟁 처리에 관한 기록</strong></td>
                    <td>3년</td>
                    <td>전자상거래법</td>
                </tr>
            </tbody>
        </table>
        
        <h2>데이터 삭제 처리 기간</h2>
        <ul>
            <li><strong>앱 내 삭제:</strong> 즉시 처리 (30일 유예 기간 후 완전 삭제)</li>
            <li><strong>이메일 요청:</strong> 영업일 기준 최대 7일 이내 처리</li>
            <li><strong>법령에 따른 보관 데이터:</strong> 보관 기간 경과 후 자동 삭제</li>
        </ul>
        
        <h2>문의처</h2>
        <div class="contact-info">
            <h3>개인정보 보호책임자</h3>
            <p><strong>이메일:</strong> privacy@grandby.kr</p>
            <p><strong>전화번호:</strong> 02-1234-5678</p>
            <p><strong>처리 시간:</strong> 평일 09:00 ~ 18:00 (주말 및 공휴일 제외)</p>
        </div>
        
        <div class="warning-box" style="margin-top: 30px;">
            <h3>📌 중요 안내</h3>
            <p>계정 삭제 전에 다음 사항을 확인해주세요:</p>
            <ul>
                <li>보관하고 싶은 다이어리나 할 일이 있다면 미리 백업하세요.</li>
                <li>연결된 보호자 또는 어르신에게 계정 삭제 사실을 알려주세요.</li>
                <li>30일 이내에 다시 로그인하시면 계정을 복구할 수 있습니다.</li>
            </ul>
        </div>
        
        <p style="margin-top: 30px; color: #7f8c8d; font-size: 14px; text-align: right;">
            최종 수정일: 2024년 1월 1일
        </p>
    </div>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


# ==================== Static Files (이미지 업로드) ====================
# 업로드 디렉토리 생성
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)

# 정적 파일 마운트
try:
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")
    logger.info(f"✅ 정적 파일 서빙 활성화: /uploads -> {upload_dir}")
except Exception as e:
    logger.warning(f"⚠️ 정적 파일 마운트 실패: {e}")

# ==================== API Routers ====================

# 인증
app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"]
)

# 사용자 관리
app.include_router(
    users.router,
    prefix="/api/users",
    tags=["Users"]
)

# AI 통화
app.include_router(
    calls.router,
    prefix="/api/calls",
    tags=["AI Calls"]
)

# 다이어리
app.include_router(
    diaries.router,
    prefix="/api/diaries",
    tags=["Diaries"]
)

# TODO 관리
app.include_router(
    todos.router,
    prefix="/api/todos",
    tags=["TODOs"]
)

# 알림
app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["Notifications"]
)

# 보호자 대시보드
app.include_router(
    dashboard.router,
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

# ==================== Twilio WebSocket Endpoints ====================

class RealtimeCallRequest(BaseModel):
    """실시간 AI 대화 통화 요청"""
    to_number: str  # 전화번호 (+821012345678 형식)
    user_id: str = "test-user"  # 사용자 ID (선택)


class RealtimeCallResponse(BaseModel):
    """실시간 AI 대화 통화 응답"""
    success: bool
    call_sid: str
    to_number: str
    status: str
    message: str
    voice_url: str
    timestamp: str


@app.post("/api/twilio/call", response_model=RealtimeCallResponse, tags=["Twilio"])
async def initiate_realtime_call(
    request: RealtimeCallRequest,
    db: Session = Depends(get_db)
):
    """
    실시간 AI 대화 통화 발신 (WebSocket 기반)
    
    사용자가 입력한 전화번호로 전화를 걸고, WebSocket을 통해 실시간 AI 대화를 제공합니다.
    
    플로우:
    1. 앱에서 이 API 호출 (전화번호 전달)
    2. Twilio가 사용자 전화번호로 전화 발신
    3. 사용자가 전화 받음
    4. /api/twilio/voice 엔드포인트에서 WebSocket 연결 시작
    5. 실시간 음성 대화 (STT → LLM → TTS)
    """
    try:
        # API Base URL 확인
        if not settings.API_BASE_URL:
            raise HTTPException(
                status_code=400,
                detail="API_BASE_URL이 환경 변수에 설정되지 않았습니다. (ngrok 또는 도메인 필요)"
            )
        
        # Twilio 서비스 초기화
        twilio_service = TwilioService()
        
        # Callback URL 설정 (WebSocket 연결)
        api_base_url = settings.API_BASE_URL
        voice_url = f"https://{api_base_url}/api/twilio/voice?elderly_id={request.user_id}"  # WebSocket 시작 엔드포인트
        status_callback_url = f"https://{api_base_url}/api/twilio/call-status"
        
        logger.info(f"📞 실시간 AI 대화 통화 발신 시작: {request.to_number}")
        logger.info(f"👤 사용자 ID: {request.user_id}")
        logger.info(f"🔗 Voice URL (WebSocket 시작): {voice_url}")
        
        # 전화 걸기
        call_sid = twilio_service.make_call(
            to_number=request.to_number,  # 사용자 입력 전화번호
            voice_url=voice_url,
            status_callback_url=status_callback_url
        )
        
        # 통화 기록 저장 (선택사항)
        try:
            from app.models.call import CallLog
            new_call = CallLog(
                call_id=call_sid,
                elderly_id=request.user_id,
                call_status="initiated",
                twilio_call_sid=call_sid,
                created_at=datetime.utcnow()
            )
            db.add(new_call)
            db.commit()
            logger.info(f"✅ 통화 기록 저장: {call_sid}")
        except Exception as e:
            logger.warning(f"⚠️ 통화 기록 저장 실패 (계속 진행): {str(e)}")
            db.rollback()
        
        logger.info(f"✅ 실시간 AI 대화 통화 발신 성공: {call_sid}")
        
        return RealtimeCallResponse(
            success=True,
            call_sid=call_sid,
            to_number=request.to_number,
            status="initiated",
            message=f"실시간 AI 대화 전화가 {request.to_number}로 발신되었습니다. 전화를 받으시면 AI와 대화하실 수 있습니다.",
            voice_url=voice_url,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 실시간 AI 대화 통화 발신 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"실시간 AI 대화 통화 발신 중 오류 발생: {str(e)}"
        )


@app.post("/api/twilio/voice", response_class=PlainTextResponse, tags=["Twilio"])
async def voice_handler(request: Request):
    """
    Twilio 전화 연결 시 WebSocket 스트림 시작
    """
    response = VoiceResponse()
    elderly_id = request.query_params.get("elderly_id", "unknown")
    
    # WebSocket 스트림 연결 설정
    if not settings.API_BASE_URL:
        logger.error("⚠️ API_BASE_URL이 설정되지 않았습니다!")
        api_base_url = "your-domain.com"  # fallback (작동하지 않음)
    else:
        api_base_url = settings.API_BASE_URL
    
    websocket_url = f"wss://{api_base_url}/api/twilio/media-stream"
    
    connect = Connect()
    stream = Stream(url=websocket_url)
    
    if elderly_id and elderly_id != "unknown":
        stream.parameter(name="elderly_id", value=elderly_id)
    
    connect.append(stream)
    response.append(connect)
    
    
    logger.info(f"🎙️ Twilio WebSocket 스트림 시작: {websocket_url}")
    return str(response)


@app.websocket("/api/twilio/media-stream")
async def media_stream_handler(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """
    Twilio Media Streams WebSocket 핸들러 (RTZR 실시간 STT 적용)
    
    실시간 오디오 데이터 양방향 처리 (RTZR 기반):
    1. RTZR 실시간 STT 스트리밍 시작
    2. 부분 인식 결과를 LLM에 백그라운드 전송 (대기 상태 유지)
    3. 최종 인식 결과(is_final: true) 감지
    4. 즉시 AI 응답 생성 및 TTS 재생
    5. 통화 종료 시 전체 대화 내용 저장
    
    RTZR 실시간 STT → LLM (백그라운드) → 최종 문장 → 즉시 응답
    """
    await websocket.accept()
    logger.info("📞 Twilio WebSocket 연결됨")
    
    call_sid = None
    stream_sid = None
    rtzr_stt = None  # RTZR 실시간 STT
    llm_collector = None  # LLM 부분 결과 수집기
    elderly_id = None  # 통화 대상 어르신 ID
    tts_service = None  # 각 통화마다 독립적인 TTS 서비스 인스턴스 (동시 통화 충돌 방지)
    
    try:
        async for message in websocket.iter_text():
            data = json.loads(message)
            event_type = data.get('event')
            
            # ========== 1. 스트림 시작 ==========
            if event_type == 'start':
                call_sid = data['start']['callSid']
                stream_sid = data['start']['streamSid']
                
                # customParameters에서 elderly_id 추출 (Twilio 통화 시작 시 전달)
                custom_params = data['start'].get('customParameters', {})
                elderly_id = custom_params.get('elderly_id', 'unknown')
                log_prefix = f"[call={call_sid} stream={stream_sid} elderly={elderly_id}]"
                
                def lp(msg: str):
                    logger.info(f"{log_prefix} {msg}")
                
                active_connections[call_sid] = websocket
                
                # 대화 세션 초기화 (LLM 대화 히스토리 관리)
                if call_sid not in conversation_sessions:
                    conversation_sessions[call_sid] = []
                
                # RTZR 실시간 STT 초기화
                rtzr_stt = RTZRRealtimeSTT()
                
                # ✅ 각 통화마다 독립적인 TTS 서비스 인스턴스 생성 (동시 통화 충돌 방지)
                from app.services.ai_call.naver_clova_tts_service import NaverClovaTTSService
                tts_service = NaverClovaTTSService()
                logger.info(f"🔊 독립적인 TTS 서비스 인스턴스 생성 완료: {call_sid}")

                # LLM 부분 결과 수집기 초기화 (백그라운드 전송)
                async def llm_partial_callback(partial_text: str):
                    """부분 인식 결과를 LLM에 백그라운드 전송"""
                    nonlocal call_sid
                    logger.debug(f"💭 [LLM 백그라운드] 부분 결과 업데이트: {partial_text}")
                
                llm_collector = LLMPartialCollector(llm_partial_callback)
                
                # 성능 메트릭 수집기 초기화
                metrics_collector = PerformanceMetricsCollector(call_sid)
                performance_collectors[call_sid] = metrics_collector
                lp("📊 성능 메트릭 수집 시작")
                
                # DB에 통화 시작 기록 저장 (status: initiated만)
                try:
                    from app.models.call import CallLog, CallStatus
                    db = next(get_db())
                    
                    # 기존 CallLog가 있는지 확인
                    existing_call = db.query(CallLog).filter(CallLog.call_id == call_sid).first()
                    
                    if not existing_call:
                        call_log = CallLog(
                            call_id=call_sid,
                            elderly_id=elderly_id,
                            call_status=CallStatus.INITIATED,
                            twilio_call_sid=call_sid
                        )
                        db.add(call_log)
                        db.commit()
                        db.refresh(call_log)
                        lp("✅ DB에 통화 시작 기록 저장")
                    else:
                        lp("⏭️  이미 존재하는 통화 기록")
                    
                    db.close()
                except Exception as e:
                    logger.error(f"❌ 통화 시작 기록 저장 실패: {e}")
                
                logger.info(f"┌{'─'*58}┐")
                lp("│ 🎙️  Twilio 통화 시작 (RTZR STT)                     │")
                lp(f"│ Call SID: {call_sid:43} │")
                lp(f"│ Stream SID: {stream_sid:41} │")
                lp(f"│ Elderly ID: {elderly_id:41} │")
                logger.info(f"└{'─'*58}┘")
                
                # 🚀 개선: 시간대별 환영 메시지 랜덤 선택
                welcome_text = get_time_based_welcome_message()
                lp(f"💬 환영 메시지: {welcome_text}")

                # TTS 재생 완료를 기다리는 태스크 (타임아웃 포함)
                async def wait_for_tts_completion():
                    """TTS 재생 완료 대기 (타임아웃 포함)"""
                    # 에코 방지
                    if rtzr_stt:
                        rtzr_stt.start_bot_speaking()

                    try:
                        # ✅ 독립적인 TTS 서비스 인스턴스 사용
                        audio_data, tts_time = await tts_service.text_to_speech_bytes(welcome_text)

                        if audio_data:
                            playback_duration = await send_clova_audio_to_twilio(
                                websocket=websocket,
                                stream_sid=stream_sid,
                                audio_data=audio_data,
                                sentence_index=0,
                                pipeline_start=time.time()
                            )

                            if playback_duration > 0:
                                # 정상적인 재생 시간이 계산된 경우
                                wait_time = playback_duration * 0.9
                                lp(f"🔊 TTS 전송 완료, 재생 대기: {wait_time:.2f}초 (예상 재생: {playback_duration:.2f}초)")
                                await asyncio.sleep(wait_time)
                                return True
                            else:
                                # 재생 시간이 0인 경우 (Twilio 재생 실패 가능성)
                                logger.warning(f"⚠️ TTS 전송은 성공했지만 재생 시간이 0입니다. 최소 대기 후 진행")
                                await asyncio.sleep(2.0)  # 최소 2초 대기
                                return False
                        else:
                            logger.warning(f"⚠️ 환영 멘트 TTS 합성 실패, 건너뜀")
                            await asyncio.sleep(1.0)  # 짧은 대기 후 진행
                            return False
                    except Exception as e:
                        logger.error(f"❌ 환영 멘트 TTS 처리 오류: {e}")
                        await asyncio.sleep(1.0)  # 오류 시 짧은 대기 후 진행
                        return False

                # ✅ 타임아웃 기반 예외 처리: 최대 10초 대기 후 STT 활성화
                try:
                    tts_success = await asyncio.wait_for(
                        wait_for_tts_completion(),
                        timeout=5.0  # 최대 5초 대기
                    )
                    # 정상 완료 시 STT 활성화
                    if rtzr_stt:
                        rtzr_stt.stop_bot_speaking()
                    if tts_success:
                        lp(f"✅ TTS 재생 완료, STT 활성화")
                    else:
                        lp(f"⚠️ TTS 재생 불확실하지만 타임아웃 전에 완료, STT 활성화")
                except asyncio.TimeoutError:
                    # 타임아웃 발생 시 STT 강제 활성화
                    logger.warning(f"⏱️ TTS 재생 대기 타임아웃 (10초 초과), STT 강제 활성화")
                    if rtzr_stt:
                        rtzr_stt.stop_bot_speaking()
                    lp(f"✅ 타임아웃 후 STT 활성화 (통화 계속 진행)")
                
                # ========== RTZR 스트리밍 시작 ==========
                lp("🎤 RTZR 실시간 STT 스트리밍 시작")
                
                # STT 응답 속도 측정 변수
                last_partial_time = None
                
                async def process_rtzr_results():
                    """RTZR 인식 결과 처리"""
                    nonlocal last_partial_time, call_sid
                    stt_complete_time = None
                    try:
                        logger.info("🔄 [process_rtzr_results 시작] 결과 처리 루프 가동")
                        async for result in rtzr_stt.start_streaming():
                            # ✅ 통화 종료 체크
                            if call_sid not in conversation_sessions:
                                logger.info("⚠️ 통화 종료로 인한 RTZR 처리 중단")
                                break
                            
                            if not result:
                                logger.debug("⚪ [빈 결과] result가 None 또는 빈 값")
                                continue

                            # ====== 종료 판단 이벤트 처리 ======
                            event_name = result.get('event')
                            logger.debug(f"🔍 [결과 수신] event={event_name}, keys={list(result.keys())}")
                            
                            
                            if event_name == 'max_time_warning':
                                logger.info("⚠️ [MAX TIME WARNING] 최대 통화 시간 임박 감지")
                                
                                # 1. AI TTS 출력 중인지 체크
                                if rtzr_stt.is_bot_speaking:
                                    logger.info("⏳ [MAX TIME WARNING] AI 응답 중 - 완료까지 대기")
                                    while rtzr_stt.is_bot_speaking:
                                        await asyncio.sleep(0.1)
                                    # AI 응답 완료 후 추가 대기 (사용자가 응답할 시간)
                                    await asyncio.sleep(2.0)
                                
                                # 2. 사용자 발화 중인지 체크
                                if rtzr_stt.is_user_speaking():
                                    logger.info("⏳ [MAX TIME WARNING] 사용자 발화 중 - 완료까지 대기")
                                    while rtzr_stt.is_user_speaking():
                                        await asyncio.sleep(0.1)
                                    # 사용자 발화 완료 후 추가 대기
                                    await asyncio.sleep(0.5)
                                
                                # 종료 안내 멘트
                                warning_message = "오늘 대화 시간이 다 되었어요. 잠시 후 통화가 마무리됩니다."
                                
                                # 대화 세션에 추가 (스토어)
                                session_store.append_message(call_sid, "assistant", warning_message)
                                
                                logger.info(f"🔊 [TTS] 종료 안내 메시지 전송: {warning_message}")
                                
                                # ✅ 독립적인 TTS 서비스 인스턴스 사용
                                audio_data, tts_time = await tts_service.text_to_speech_bytes(warning_message)
                                if audio_data:
                                    playback_duration = await send_clova_audio_to_twilio(
                                        websocket,
                                        stream_sid,
                                        audio_data,
                                        0,
                                        time.time()
                                    )
                                    
                                    # TTS 완료 시간 기록
                                    completion_time = time.time()
                                    active_tts_completions[call_sid] = (completion_time, playback_duration)
                                    logger.info(f"📝 [TTS 추적] 종료 안내 완료: {playback_duration:.2f}초")
                                    
                                    # 재생 완료까지 대기 (20% 여유)
                                    await asyncio.sleep(playback_duration * 1.2)
                                    logger.info("✅ [MAX TIME WARNING] 종료 안내 재생 완료")
                                    
                                    # 종료 안내 후 1초 추가 대기 (사용자가 인지할 시간)
                                    await asyncio.sleep(1.0)
                                    logger.info(f"{log_prefix} ⏳ [MAX TIME WARNING] 종료 안내 후 대기 완료, 통화 종료 진행")
                                else:
                                    logger.error("❌ [MAX TIME WARNING] TTS 변환 실패")
                                    await asyncio.sleep(1.0)
                                
                                # 종료 안내 후 즉시 통화 종료
                                try:
                                    await websocket.close()
                                    logger.info(f"{log_prefix} ✅ [MAX TIME WARNING] 통화 종료 완료")
                                except Exception as e:
                                    logger.error(f"❌ [MAX TIME WARNING] 통화 종료 오류: {e}")
                                break

                            # ====== 일반 STT 처리 ======
                            if 'text' not in result:
                                continue
                            
                            text = result.get('text', '')
                            is_final = result.get('is_final', False)
                            partial_only = result.get('partial_only', False)
                            
                            current_time = time.time()
                            
                            # 부분 결과는 무시하되 시간 기록
                            if partial_only and text:
                                logger.debug(f"📝 [RTZR 부분 인식] {text}")
                                last_partial_time = current_time
                                
                                # 메트릭 수집: STT 부분 인식
                                # 현재 턴이 있으면 기록하고, 없으면 다음 턴에서 기록됨
                                if call_sid in performance_collectors and rtzr_stt:
                                    metrics_collector = performance_collectors[call_sid]
                                    if metrics_collector.metrics["turns"]:
                                        turn_index = len(metrics_collector.metrics["turns"]) - 1
                                        turn = metrics_collector.metrics["turns"][turn_index]
                                        
                                        # 사용자 발화 시작 시간 가져오기 (RTZR에서)
                                        speech_start_time = None
                                        if hasattr(rtzr_stt, 'streaming_start_time') and rtzr_stt.streaming_start_time:
                                            speech_start_time = rtzr_stt.streaming_start_time
                                        
                                        metrics_collector.record_stt_partial(turn_index, current_time, speech_start_time)
                                continue
                            
                            # 최종 결과 처리
                            if is_final and text:
                                # ✅ 통화 종료 체크
                                if call_sid not in conversation_sessions:
                                    logger.info("⚠️ 통화 종료로 인한 최종 처리 중단")
                                    break
                                
                                # ✅ RTZR 결과에서 사용자 발화 시작 시간 가져오기 (리셋 전에 저장된 값)
                                user_speech_start_time = result.get('user_speech_start_time')
                                
                                # STT 응답 속도 측정
                                # 말이 끝난 시점부터 최종 인식까지의 시간
                                if last_partial_time:
                                    speech_to_final_delay = current_time - last_partial_time
                                    logger.info(f"⏱️ [STT 지연] 말 끝 → 최종 인식: {speech_to_final_delay:.2f}초")
                                
                                # 최종 발화 완료
                                logger.info(f"✅ [RTZR 최종] {text}")
                                
                                # ✅ 턴 시작 시간을 STT 최종 인식 시점으로 설정 (동기화)
                                turn_start_time = current_time
                                stt_complete_time = current_time  # 동일한 시간 사용
                                
                                # 종료 키워드 확인
                                if '그랜비 통화를 종료합니다' in text:
                                    logger.info(f"🛑 종료 키워드 감지")
                                    
                                    # 대화 세션에 사용자/AI 메시지 추가 (스토어)
                                    session_store.append_message(call_sid, "user", text)
                                    goodbye_text = "그랜비 통화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
                                    session_store.append_message(call_sid, "assistant", goodbye_text)
                                    
                                    logger.info("🔊 [TTS] 종료 메시지 전송")
                                    await asyncio.sleep(2)
                                    await websocket.close()
                                    return
                                
                                # 발화 처리 사이클
                                logger.info(f"{'='*60}")
                                logger.info(f"🎯 발화 완료 → 즉시 응답 생성")
                                logger.info(f"{'='*60}")
                                
                                # 메트릭 수집: 새로운 턴 시작 (STT 최종 인식 시점 = 턴 시작 시점)
                                turn_index = None
                                if call_sid in performance_collectors:
                                    metrics_collector = performance_collectors[call_sid]
                                    
                                    turn_metrics = metrics_collector.start_turn(text, turn_start_time)
                                    turn_index = turn_metrics["turn_number"] - 1
                                    
                                    # 사용자 발화 시작 시간 기록 (RTZR 결과에서 가져온 값)
                                    if user_speech_start_time:
                                        metrics_collector.record_user_speech_start(turn_index, user_speech_start_time)
                                        logger.debug(f"📊 [메트릭] 사용자 발화 시작 시간 기록: {user_speech_start_time:.3f}")
                                    else:
                                        logger.warning(f"⚠️ [메트릭] 사용자 발화 시작 시간을 가져올 수 없음")
                                    
                                    # STT 최종 인식 시간 기록
                                    metrics_collector.record_stt_final(turn_index, stt_complete_time)
                                
                                # 대화 세션에 사용자 메시지 추가
                                session_store.append_message(call_sid, "user", text)
                                
                                conversation_history = session_store.get_conversation(call_sid)
                                
                                # LLM 전달까지의 시간 측정
                                llm_delivery_start = time.time()
                                if stt_complete_time:
                                    stt_to_llm_delay = llm_delivery_start - stt_complete_time
                                    logger.info(f"⏱️ [지연시간] 최종 인식 → LLM 전달: {stt_to_llm_delay:.2f}초")
                                
                                # ✅ AI 응답 시작 (사용자 입력 차단)
                                rtzr_stt.start_bot_speaking()
                                
                                # LLM 응답 생성 (메트릭 수집을 위해 수정된 함수 사용)
                                logger.info("🤖 [LLM] 응답 생성 시작")
                                llm_start_time = time.time()
                                ai_response = await process_streaming_response(
                                    websocket,
                                    stream_sid,
                                    text,
                                    conversation_history,
                                    rtzr_stt=rtzr_stt,
                                    call_sid=call_sid,
                                    metrics_collector=performance_collectors.get(call_sid),
                                    turn_index=turn_index,
                                    tts_service=tts_service  # 독립적인 TTS 서비스 인스턴스 전달
                                )
                                llm_end_time = time.time()
                                llm_duration = llm_end_time - llm_start_time
                                
                                # ✅ AI 응답 종료 (1초 후 사용자 입력 재개)
                                rtzr_stt.stop_bot_speaking()
                                
                                logger.info("✅ [LLM] 응답 생성 완료")
                                
                                # 메트릭 수집: LLM 완료 및 턴 종료
                                if call_sid in performance_collectors and turn_index is not None:
                                    metrics_collector = performance_collectors[call_sid]
                                    metrics_collector.record_llm_completion(turn_index, llm_end_time, ai_response)
                                    metrics_collector.record_turn_end(turn_index, llm_end_time)
                                
                                # 전체 처리 시간 로깅
                                if stt_complete_time:
                                    total_delay = llm_end_time - stt_complete_time
                                    logger.info(f"⏱️ [전체 지연] 최종 인식 → LLM 완료: {total_delay:.2f}초 (LLM 응답 생성: {llm_duration:.2f}초)")
                                
                                # AI 응답을 대화 세션에 추가 (안전하게)
                                try:
                                    if ai_response and ai_response.strip():
                                        session_store.append_message(call_sid, "assistant", ai_response)
                                    
                                    total_cycle_time = time.time() - turn_start_time
                                    logger.info(f"⏱️  전체 응답 사이클: {total_cycle_time:.2f}초")
                                    logger.info(f"{'='*60}\n\n")
                                except KeyError:
                                    # 세션이 이미 삭제된 경우 (통화 종료)
                                    logger.info("⚠️  세션이 이미 삭제됨 (통화 종료 중)")
                                    break
                                except Exception as e:
                                    logger.error(f"❌ 응답 저장 오류: {e}")
                                
                            elif text:
                                # 부분 결과를 LLM에 백그라운드 전송
                                llm_collector.add_partial(text)
                                logger.debug(f"📝 [RTZR 부분] {text}")
                    
                    except Exception as e:
                        logger.error(f"❌ RTZR 처리 오류: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                
                # RTZR 스트리밍 태스크 시작 (백그라운드)
                rtzr_task = asyncio.create_task(process_rtzr_results())
                
            # ========== 2. 오디오 데이터 수신 및 RTZR로 전송 ==========
            elif event_type == 'media':
                if rtzr_stt and rtzr_stt.is_active:
                    # ✅ AI 응답 중이면 오디오 무시 (에코 방지)
                    if rtzr_stt.is_bot_speaking:
                        continue
                    
                    # ✅ AI 응답 종료 후 1초 대기 중이면 무시
                    if rtzr_stt.bot_silence_delay > 0:
                        rtzr_stt.bot_silence_delay -= 1
                        continue
                    
                    # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                    audio_payload = base64.b64decode(data['media']['payload'])
                    
                    # RTZR로 오디오 청크 전송
                    await rtzr_stt.add_audio_chunk(audio_payload)
                        
            # ========== 3. 스트림 종료 ==========
            elif event_type == 'stop':
                logger.info(f"\n{'='*60}")
                logger.info(f"📞 Twilio 통화 종료 - Call: {call_sid}")
                logger.info(f"{'='*60}")
                
                # ✅ RTZR 백그라운드 태스크 취소
                if 'rtzr_task' in locals() and rtzr_task:
                    logger.info("🛑 RTZR 백그라운드 태스크 취소 중...")
                    rtzr_task.cancel()
                    try:
                        await asyncio.wait_for(rtzr_task, timeout=2.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        logger.info("✅ RTZR 백그라운드 태스크 종료 완료")
                
                # RTZR 스트리밍 종료
                if rtzr_stt:
                    await rtzr_stt.end_streaming()
                    logger.info("🛑 RTZR 스트리밍 종료")
                
                # ✅ 성능 메트릭 최종 저장
                if call_sid in performance_collectors:
                    metrics_collector = performance_collectors[call_sid]
                    metrics_file = metrics_collector.finalize()
                    logger.info(f"📊 성능 메트릭 최종 저장 완료: {metrics_file}")
                    del performance_collectors[call_sid]
                
                # ✅ 멱등/락: 통화 종료 처리 (DB 저장 + 세션 정리)
                if session_store.acquire_finalize_lock(call_sid):
                    try:
                        if not session_store.is_finalized(call_sid):
                            conversation = session_store.get_conversation(call_sid)

                            # 대화 내용 출력
                            if conversation:
                                logger.info(f"\n📋 전체 대화 내용:")
                                logger.info(f"─" * 60)
                                for msg in conversation:
                                    role = "👤 사용자" if msg['role'] == 'user' else "🤖 AI"
                                    logger.info(f"{role}: {msg['content']}")
                                logger.info(f"─" * 60)

                            await save_conversation_to_db(call_sid, conversation)
                            session_store.mark_finalized(call_sid)
                        # 항상 세션 정리 시도 (멱등)
                        session_store.clear_session(call_sid)
                    finally:
                        session_store.release_finalize_lock(call_sid)
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ ✅ Twilio 통화 정리 완료                               │")
                logger.info(f"└{'─'*58}┘\n")
                break
                
    except Exception as e:
        logger.error(f"❌ Twilio WebSocket 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # ✅ 연결 종료 시 멱등/락으로 최종 처리 보장
        if call_sid:
            if session_store.acquire_finalize_lock(call_sid):
                try:
                    if not session_store.is_finalized(call_sid):
                        conversation = session_store.get_conversation(call_sid)
                        await save_conversation_to_db(call_sid, conversation)
                        session_store.mark_finalized(call_sid)
                        logger.info(f"🔄 Finally 블록에서 최종 저장 완료: {call_sid}")
                    session_store.clear_session(call_sid)
                except Exception as e:
                    logger.error(f"❌ Finally 블록 최종 처리 실패: {e}")
                finally:
                    session_store.release_finalize_lock(call_sid)
        
        # ✅ TTS 서비스 리소스 정리
        if tts_service:
            try:
                await tts_service.close()
                logger.debug(f"🔒 TTS 서비스 리소스 정리 완료: {call_sid}")
            except Exception as e:
                logger.warning(f"⚠️ TTS 서비스 정리 중 오류 (무시): {e}")
        
        # 정리 작업 (메모리에서 제거)
        if call_sid and call_sid in active_connections:
            del active_connections[call_sid]
        if call_sid and call_sid in active_tts_completions:
            del active_tts_completions[call_sid]
            logger.debug(f"🗑️ TTS 추적 정보 삭제: {call_sid}")
        if call_sid:
            session_store.clear_session(call_sid)
        if call_sid and call_sid in performance_collectors:
            # 최종 저장 (예외 발생 시에도)
            try:
                metrics_collector = performance_collectors[call_sid]
                metrics_file = metrics_collector.finalize()
                logger.info(f"📊 [Finally] 성능 메트릭 저장: {metrics_file}")
            except Exception as e:
                logger.error(f"❌ [Finally] 메트릭 저장 실패: {e}")
            del performance_collectors[call_sid]
        
        logger.info(f"🧹 WebSocket 정리 완료: {call_sid}")


@app.post("/api/twilio/call-status", tags=["Twilio"])
async def call_status_handler(
    CallSid: str = Form(None),
    CallStatus: str = Form(None)
):
    """
    Twilio 통화 상태 업데이트 콜백
    통화 상태: initiated, ringing, answered, completed, no-answer, busy, failed, canceled
    """
    log_prefix = f"[call={CallSid}]"
    logger.info(f"{log_prefix} 📞 통화 상태 업데이트 콜백 수신: CallStatus={CallStatus}")
    
    # 통화 상태에 따른 DB 업데이트
    try:
        from app.models.call import CallLog, CallStatus as CallStatusEnum
        db = next(get_db())
        
        call_log = db.query(CallLog).filter(CallLog.call_id == CallSid).first()
        
        if not call_log:
            logger.warning(f"⚠️ CallLog를 찾을 수 없음: {CallSid} (상태: {CallStatus})")
            db.close()
            return {"status": "ok", "call_sid": CallSid, "call_status": CallStatus}
        
        logger.info(f"{log_prefix} 📋 CallLog 찾음: 현재 상태={call_log.call_status}, 새 상태={CallStatus}")
        
        # 통화 상태에 따른 처리
        if CallStatus == 'answered':
            # 통화 연결 시 시작 시간 설정
            logger.info(f"{log_prefix} 📞 [answered 상태 처리] 통화 연결됨")
            if not call_log.call_start_time:
                call_log.call_start_time = datetime.utcnow()
                call_log.call_status = CallStatusEnum.ANSWERED
                db.commit()
                logger.info(f"{log_prefix} ✅ 통화 시작 시간 설정 (상태: ANSWERED로 변경)")
            else:
                logger.info(f"ℹ️ 통화 시작 시간이 이미 설정되어 있음: {CallSid}")
        
        elif CallStatus == 'completed':
            # 통화 종료 시 종료 시간 설정
            logger.info(f"{log_prefix} ✅ [completed 상태 처리] 통화 종료됨")
            call_log.call_end_time = datetime.utcnow()
            call_log.call_status = CallStatusEnum.COMPLETED
            
            # 통화 시간 계산
            if call_log.call_start_time:
                duration = (call_log.call_end_time - call_log.call_start_time).total_seconds()
                call_log.call_duration = int(duration)
                logger.info(f"{log_prefix} ✅ 통화 종료 시간 설정, 지속시간: {duration}초 (상태: COMPLETED)")
            
            db.commit()
            
            # ✅ 통화 종료 시 멱등/락으로 한 번만 처리
            if session_store.acquire_finalize_lock(CallSid):
                try:
                    if not session_store.is_finalized(CallSid):
                        conversation = session_store.get_conversation(CallSid)
                        await save_conversation_to_db(CallSid, conversation)
                        session_store.mark_finalized(CallSid)
                    logger.info(f"{log_prefix} 💾 콜백에서 통화 기록 저장 완료")
                    session_store.clear_session(CallSid)
                except Exception as e:
                    logger.error(f"❌ 콜백 최종 처리 실패: {e}")
                finally:
                    session_store.release_finalize_lock(CallSid)
            
            # 세션 정리
            session_cleaned = False
            # 세션 스토어 정리
            session_store.clear_session(CallSid)
            session_cleaned = True
            logger.info(f"{log_prefix} 🧹 세션 스토어에서 제거")
            if CallSid in active_connections:
                del active_connections[CallSid]
                session_cleaned = True
                logger.info(f"🧹 active_connections에서 제거: {CallSid}")
            
            if not session_cleaned:
                logger.info(f"ℹ️ 세션 정리 불필요 (세션에 없음): {CallSid}")
            logger.info(f"{log_prefix} ✅ [completed 상태 처리 종료] 모든 처리 완료")
        
        # ✅ 통화 거절/부재중/실패 처리 추가
        elif CallStatus in ['busy', 'canceled', 'failed', 'no-answer']:
            # 상태별 메시지 및 DB 상태 설정
            status_messages = {
                'busy': ('📴 [거절/실패 처리] 사용자 직접 거절 감지', CallStatusEnum.REJECTED, 'REJECTED'),
                'canceled': ('🚫 [거절/실패 처리] 통화 취소 감지', CallStatusEnum.REJECTED, 'REJECTED'),
                'failed': ('❌ [거절/실패 처리] 통화 실패 감지', CallStatusEnum.FAILED, 'FAILED'),
                'no-answer': ('📵 [거절/실패 처리] 통화 부재중 감지', CallStatusEnum.MISSED, 'MISSED')
            }
            
            message, db_status, status_name = status_messages[CallStatus]
            logger.info(f"{message}: {CallSid}")
            
            call_log.call_status = db_status
            call_log.call_end_time = datetime.utcnow()
            db.commit()
            logger.info(f"{log_prefix} ✅ [거절/실패 처리 완료] 통화 처리 완료 (상태: {status_name}로 변경)")
            
            # 세션 정리
            session_cleaned = False
            session_store.clear_session(CallSid)
            session_cleaned = True
            logger.info(f"{log_prefix} 🧹 세션 스토어에서 제거")
            if CallSid in active_connections:
                del active_connections[CallSid]
                session_cleaned = True
                logger.info(f"🧹 active_connections에서 제거: {CallSid}")
            
            if not session_cleaned:
                logger.info(f"ℹ️ 세션 정리 불필요 (세션에 없음): {CallSid}")
            logger.info(f"{log_prefix} ✅ [거절/실패 처리 종료] 모든 처리 완료 (상태: {CallStatus})")
        
        db.close()
        logger.info(f"{log_prefix} 📞 통화 상태 업데이트 콜백 처리 완료: {CallStatus}")
        
    except Exception as e:
        logger.error(f"❌ 통화 상태 업데이트 실패: {CallSid} - {CallStatus}, 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        if 'db' in locals():
            db.close()
    
    return {"status": "ok", "call_sid": CallSid, "call_status": CallStatus}


# ==================== Startup Message ====================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_development(),
        log_level=settings.LOG_LEVEL.lower(),
    )
