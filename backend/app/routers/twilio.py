"""
Twilio 관련 API 엔드포인트
"""
import logging
import json
import base64
import asyncio
import time
from datetime import datetime
from typing import Dict, List, Tuple
from fastapi import APIRouter, WebSocket, Form, HTTPException, Depends, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import get_db, SessionLocal
from app.services.ai_call.twilio_service import TwilioService
from app.services.ai_call.rtzr_stt_realtime import RTZRRealtimeSTT, LLMPartialCollector
from app.services.ai_call.naver_clova_tts_service import NaverClovaTTSService
from app.services.ai_call.streaming_pipeline import process_streaming_response, send_clova_audio_to_twilio
from app.utils.conversation_helpers import get_time_based_welcome_message, save_conversation_to_db
from app.utils.performance_metrics import PerformanceMetricsCollector
from app.routers.twilio_protocol_helper import MessageBuffer, wait_for_mark_response, send_mark
from app.core.state import (
    active_connections,
    conversation_sessions,
    saved_calls,
    active_tts_completions,
    performance_collectors
)

logger = logging.getLogger(__name__)

router = APIRouter()


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

class TwilioService:
    def __init__(self):
        self.client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        self.from_number = settings.TWILIO_FROM_NUMBER

    def start_media_stream_on_live_call(self, call_sid: str, ws_url: str, elderly_id: str):
        # 라이브 콜에 Media Stream 부착 (브리지 완료 후 재시도용)
        # Streams API가 활성화된 계정/리전에서만 동작
        return self.client.calls(call_sid).streams.create(
            url=ws_url,
            track="both_tracks",
            name="fallback-restart",
            parameters={"elderly_id": elderly_id}
        )

def _save_call_start(call_sid: str, elderly_id: str) -> None:
    """동기 DB 세션으로 통화 시작 기록 저장"""
    from app.models.call import CallLog, CallStatus
    from sqlalchemy.exc import IntegrityError
    import logging
    
    # SQLAlchemy 및 psycopg2 에러 로깅 임시 억제
    sqlalchemy_logger = logging.getLogger('sqlalchemy.engine')
    psycopg_logger = logging.getLogger('psycopg2')
    original_sqlalchemy_level = sqlalchemy_logger.level
    original_psycopg_level = psycopg_logger.level
    
    db = SessionLocal()
    try:
        existing_call = db.query(CallLog).filter(CallLog.call_id == call_sid).first()

        if not existing_call:
            call_log = CallLog(
                call_id=call_sid,
                elderly_id=elderly_id,
                call_status=CallStatus.INITIATED,
                twilio_call_sid=call_sid
            )
            db.add(call_log)
            try:
                # 에러 로깅 레벨 임시 상향 (에러 숨김)
                sqlalchemy_logger.setLevel(logging.CRITICAL)
                psycopg_logger.setLevel(logging.CRITICAL)
                db.commit()
                db.refresh(call_log)
                logger.info(f"✅ DB에 통화 시작 기록 저장: {call_sid}")
            except IntegrityError:
                # ForeignKeyViolation 등 무시 가능한 에러는 조용히 처리
                db.rollback()
                # 에러 로그 출력 안 함
            finally:
                # 원래 로깅 레벨 복원
                sqlalchemy_logger.setLevel(original_sqlalchemy_level)
                psycopg_logger.setLevel(original_psycopg_level)
        else:
            logger.info(f"⏭️  이미 존재하는 통화 기록: {call_sid}")
    except Exception as e:
        # 예상치 못한 에러만 로깅
        logger.error(f"❌ 통화 시작 기록 저장 중 예상치 못한 오류: {e}")
        db.rollback()
        sqlalchemy_logger.setLevel(original_sqlalchemy_level)
        psycopg_logger.setLevel(original_psycopg_level)
    finally:
        db.close()


def _handle_call_status_update(call_sid: str, new_status: str) -> bool:
    """동기 DB 세션으로 통화 상태 업데이트"""
    from app.models.call import CallLog, CallStatus as CallStatusEnum

    db = SessionLocal()
    try:
        call_log = db.query(CallLog).filter(CallLog.call_id == call_sid).first()

        if not call_log:
            logger.warning(f"⚠️ CallLog를 찾을 수 없음: {call_sid} (상태: {new_status})")
            return False

        logger.info(f"📋 CallLog 찾음: {call_sid} (현재 상태: {call_log.call_status}, 새 상태: {new_status})")

        if new_status == 'in-progress':
            logger.info(f"📞 [answered 상태 처리] 통화 연결됨: {call_sid}")
            if not call_log.call_start_time:
                call_log.call_start_time = datetime.utcnow()
                call_log.call_status = CallStatusEnum.ANSWERED
                db.commit()
                logger.info(f"✅ 통화 시작 시간 설정: {call_sid} (상태: ANSWERED로 변경)")
            else:
                logger.info(f"ℹ️ 통화 시작 시간이 이미 설정되어 있음: {call_sid}")

        elif new_status == 'completed':
            logger.info(f"✅ [completed 상태 처리] 통화 종료됨: {call_sid}")
            call_log.call_end_time = datetime.utcnow()
            call_log.call_status = CallStatusEnum.COMPLETED

            if call_log.call_start_time:
                duration = (call_log.call_end_time - call_log.call_start_time).total_seconds()
                call_log.call_duration = int(duration)
                logger.info(f"✅ 통화 종료 시간 설정: {call_sid}, 지속시간: {duration}초 (상태: COMPLETED로 변경)")

            db.commit()

        logger.info(f"📞 통화 상태 업데이트 콜백 처리 완료(동기): {call_sid} - {new_status}")
        return True
    finally:
        db.close()
@router.post("/api/twilio/call", response_model=RealtimeCallResponse, tags=["Twilio"])
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
        # logger.info(f"👤 사용자 ID: {request.user_id}")
        # logger.info(f"🔗 Voice URL (WebSocket 시작): {voice_url}")
        
        # 전화 걸기
        call_sid = await run_in_threadpool(
            twilio_service.make_call,
            request.to_number,
            voice_url,
            status_callback_url
        )
        
        # 통화 기록 저장 (선택사항)
        # try:
        #     from app.models.call import CallLog
        #     new_call = CallLog(
        #         call_id=call_sid,
        #         elderly_id=request.user_id,
        #         call_status="initiated",
        #         twilio_call_sid=call_sid,
        #         created_at=datetime.utcnow()
        #     )
        #     db.add(new_call)
        #     db.commit()
        #     logger.info(f"✅ 통화 기록 저장: {call_sid}")
        # except Exception as e:
        #     logger.warning(f"⚠️ 통화 기록 저장 실패 (계속 진행): {str(e)}")
        #     db.rollback()
        
        # logger.info(f"✅ 실시간 AI 대화 통화 발신 성공: {call_sid}")
        
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


@router.post("/api/twilio/voice", response_class=PlainTextResponse, tags=["Twilio"])
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
    stream = Stream(
    url=websocket_url,
    track="inbound_track",
    status_callback=f"https://{api_base_url}/api/twilio/stream-status",
    status_callback_method="POST",
    )
    
    if elderly_id and elderly_id != "unknown":
        stream.parameter(name="elderly_id", value=elderly_id)
    
    connect.append(stream)
    response.append(connect)
    
    
    logger.info(
        f"🔄 [오디오 경로][1/3] Twilio <Stream> 응답 준비 완료 "
        f"(websocket_url={websocket_url}, elderly_id={elderly_id})"
    )
    logger.info(f"🎙️ Twilio WebSocket 스트림 시작: {websocket_url}")
    return str(response)

# 스트림 상태 콜백 엔드포인트 추가 (에러 원인 즉시 확인)
@router.post("/api/twilio/stream-status", tags=["Twilio"])
async def stream_status(request: Request):
    form = await request.form()
    logger.warning(
        f"[MediaStream status] event={form.get('StreamEvent')} "
        f"error={form.get('StreamError')} call={form.get('CallSid')} stream={form.get('StreamSid')}"
    )
    return PlainTextResponse("ok")

@router.websocket("/api/twilio/media-stream")
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
    logged_first_inbound = False  # 오디오 경로 단계 로그 제어
    first_inbound_media = asyncio.Event()
    inbound_monitor_task = None
    
    # ✅ Twilio Media Streams 프로토콜 준수
    start_event_received = False  # start 이벤트 수신 여부
    message_buffer = MessageBuffer()  # sequenceNumber 기반 메시지 버퍼
    pending_mark_responses = {}  # mark 응답 대기 딕셔너리 {mark_name: asyncio.Event}
    
    # ✅ A. 준비 조건 이벤트
    stream_started = asyncio.Event()  # start 이벤트 수신 시 set
    inbound_ready = asyncio.Event()  # 최초 inbound media 수신 시 set
    
    # ✅ 게이트 워치독용 변수
    gate_since = None  # 게이트가 켜진 시점 (monotonic time)

    pre_start_media: List[Tuple[int, Dict]] = []
    pre_start_media_no_seq: List[Dict] = []

    ws_send_lock = asyncio.Lock()

    # ws_send_lock이 확보되면 WebSocket 전송 진행
    async def ws_send(ws: WebSocket, payload: dict):
        async with ws_send_lock:
            await ws.send_text(json.dumps(payload))
    
    try:
        async for message in websocket.iter_text():
            data = json.loads(message)
            event_type = data.get('event')
            sequence_number_raw = data.get('sequenceNumber', -1)  # sequenceNumber 추출
            
            # ✅ sequenceNumber를 정수로 변환 (문자열일 수 있음)
            try:
                sequence_number = int(sequence_number_raw) if sequence_number_raw != -1 else -1
            except (ValueError, TypeError):
                sequence_number = -1  # 변환 실패 시 -1로 설정 (sequenceNumber 없음)
            
            if not start_event_received and event_type == 'media':
                track = data.get('media', {}).get('track', '')
                if track == 'inbound' and not inbound_ready.is_set():
                    inbound_ready.set()

                if sequence_number >= 0:
                    pre_start_media.append((sequence_number, data))
                else:
                    pre_start_media_no_seq.append(data)
                continue
            
            # ✅ sequenceNumber 기반 메시지 버퍼링 및 정렬
            messages_to_process = []
            event_type_check = data.get('event')
            
            # ✅ start, stop 이벤트는 sequenceNumber와 관계없이 즉시 처리
            if event_type_check in ['start', 'stop']:
                messages_to_process = [data]
            elif sequence_number >= 0:
                message_buffer.add_message(data, sequence_number)

                if not start_event_received:
                    continue

                messages_to_process = message_buffer.get_ready_messages()
                
                # 순서가 맞지 않는 메시지가 있으면 버퍼에 보관하고 계속
                if message_buffer.has_gap():
                    continue
            else:
                # sequenceNumber가 없는 메시지는 즉시 처리
                messages_to_process = [data]
            
            # 정렬된 메시지들 처리
            for msg in messages_to_process:
                event_type = msg.get('event')
                
                # ========== 1. 스트림 시작 ==========
                if event_type == 'start':
                    call_sid = msg['start']['callSid']
                    stream_sid = msg['start']['streamSid']
                    
                    # ✅ start.tracks 로깅
                    tracks = msg['start'].get('tracks', [])
                    start_seq = msg.get('sequenceNumber', 'N/A')
                    logger.info(f"📊 [Start 이벤트] tracks={tracks}, sequenceNumber={start_seq}")
                    
                    # ✅ Start 이벤트의 tracks에 'inbound'가 있으면 즉시 inbound_ready 설정
                    # if 'inbound' in tracks and not inbound_ready.is_set():
                    #     inbound_ready.set()
                    #     logger.info(f"✅ [준비 조건] inbound_ready 이벤트 설정 (Start 이벤트 tracks에 inbound 포함)")
                    
                    # ✅ start 이벤트 수신 후 버퍼 초기화 (start 이벤트의 sequenceNumber를 기준으로)
                    if start_seq != 'N/A':
                        try:
                            start_seq_int = int(start_seq)
                            message_buffer.next_expected_seq = start_seq_int + 1
                        except (ValueError, TypeError):
                            pass
                    
                    start_event_received = True  # start 이벤트 수신 완료
                    stream_started.set()  # ✅ A. 준비 조건: START 수신 완료
                    logger.info(
                        f"🔄 [오디오 경로][2/3] Twilio start 이벤트 처리 완료 "
                        f"(call_sid={call_sid}, stream_sid={stream_sid})"
                    )

                    async def monitor_first_inbound(timeout: float = 3.0):
                        try:
                            await asyncio.wait_for(first_inbound_media.wait(), timeout=timeout)
                        except asyncio.TimeoutError:
                            logger.warning(
                                f"⚠️ [오디오 경로][2/3] inbound media {timeout:.1f}초 동안 수신되지 않음 "
                                f"(call_sid={call_sid}, stream_sid={stream_sid})"
                            )
                            try:
                                if settings.API_BASE_URL:
                                    restream_url = f"wss://{settings.API_BASE_URL}/api/twilio/media-stream"
                                else:
                                    logger.warning("⚠️ API_BASE_URL 미설정 - Streams REST 재시도 불가")
                                    restream_url = None
                                if not restream_url:
                                    return
                                TwilioService().start_media_stream_on_live_call(
                                    call_sid, restream_url, elderly_id or "unknown"
                                )
                                logger.info("🔁 Streams REST 재시도 호출 완료")
                            except Exception as e:
                                logger.error(f"❌ Streams 재시도 실패: {e}")

                    if inbound_monitor_task:
                        inbound_monitor_task.cancel()
                    
                    inbound_monitor_task = asyncio.create_task(monitor_first_inbound())
                    

                    if pre_start_media or pre_start_media_no_seq:
                        pre_start_media.sort(key=lambda item: item[0])
                        for seq, buffered_msg in pre_start_media:
                            # ✅ 버퍼링된 media에서도 inbound_ready 설정 확인 (Start 이벤트에서 설정되지 않은 경우 대비)
                            if buffered_msg.get('event') == 'media':
                                track = buffered_msg.get('media', {}).get('track', '')
                                if track == 'inbound' and not inbound_ready.is_set():
                                    inbound_ready.set()
                            message_buffer.add_message(buffered_msg, seq)
                        pre_start_media.clear()

                        ready_after_start = message_buffer.get_ready_messages()
                        if pre_start_media_no_seq:
                            for buffered_msg in pre_start_media_no_seq:
                                if buffered_msg.get('event') == 'media':
                                    track = buffered_msg.get('media', {}).get('track', '')
                                    if track == 'inbound' and not inbound_ready.is_set():
                                        inbound_ready.set()
                            ready_after_start.extend(pre_start_media_no_seq)
                            pre_start_media_no_seq.clear()

                        if ready_after_start:
                            messages_to_process.extend(ready_after_start)
                    
                    # customParameters에서 elderly_id 추출 (Twilio 통화 시작 시 전달)
                    custom_params = msg['start'].get('customParameters', {})
                    elderly_id = custom_params.get('elderly_id', 'unknown')
                    
                    active_connections[call_sid] = websocket
                    
                    # 대화 세션 초기화 (LLM 대화 히스토리 관리)
                    if call_sid not in conversation_sessions:
                        conversation_sessions[call_sid] = []
                    
                    # RTZR 실시간 STT 초기화
                    rtzr_stt = RTZRRealtimeSTT()
                    
                    # ✅ 각 통화마다 독립적인 TTS 서비스 인스턴스 생성 (동시 통화 충돌 방지)
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
                    logger.info(f"📊 성능 메트릭 수집 시작: {call_sid}")
                    
                    # DB에 통화 시작 기록 저장 (status: initiated만)
                    # IntegrityError는 _save_call_start 내부에서 이미 조용히 처리됨
                    await run_in_threadpool(_save_call_start, call_sid, elderly_id)
                    
                    logger.info(f"┌{'─'*50}┐")
                    logger.info(f"│ 🎙️  Twilio 통화 시작 (RTZR STT)                        |")
                    logger.info(f"│ Call SID: {call_sid:43}                              |")
                    logger.info(f"│ Stream SID: {stream_sid:41}                  |")
                    logger.info(f"│ Elderly ID: {elderly_id:41}                  |")
                    logger.info(f"└{'─'*50}┘")
                    
                    # ✅ B. 전송 유틸: 오디오 전송 + mark + ACK 대기 + 타임아웃에 clear
                    def estimate_playback_seconds(audio_bytes: bytes) -> float:
                        """WAV 파일을 mulaw 변환 후 재생 시간 추정 (초)"""
                        import wave
                        import io
                        import audioop

                        try:
                            # WAV 파일 파싱
                            wav_io = io.BytesIO(audio_bytes)
                            with wave.open(wav_io, 'rb') as wav_file:
                                channels = wav_file.getnchannels()
                                sample_width = wav_file.getsampwidth()
                                framerate = wav_file.getframerate()
                                n_frames = wav_file.getnframes()
                                pcm_data = wav_file.readframes(n_frames)

                            # Stereo → Mono 변환
                            if channels == 2:
                                pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)

                            # 샘플레이트 변환: 8kHz (Twilio 요구사항)
                            if framerate != 8000:
                                pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, 8000, None)

                            # PCM → mulaw 변환
                            mulaw_data = audioop.lin2ulaw(pcm_data, 2)

                            # 재생 시간 계산 (mulaw 8kHz는 초당 8000 바이트)
                            return len(mulaw_data) / 8000.0
                        except Exception:
                            # 파싱 실패 시 원본 크기 기준으로 추정 (fallback)
                            return len(audio_bytes) / 8000.0
                    
                    async def send_mark_message(ws: WebSocket, stream_sid: str, name: str):
                        """마크 메시지 직접 전송"""
                        await ws_send(ws, {
                            "event": "mark",
                            "streamSid": stream_sid,
                            "mark": {"name": name}
                        })
                    
                    async def send_audio_with_ack(
                        websocket: WebSocket,
                        stream_sid: str,
                        raw_mulaw_bytes: bytes,
                        mark_name: str,
                        pending_mark_responses: Dict[str, asyncio.Event],
                        est_duration_sec: float,
                        ack_extra: float = 0.5,
                        ack_cap: float = 8.0
                    ) -> bool:
                        """
                        오디오 전송 + mark + ACK 대기 + 타임아웃에 clear
                        
                        Returns:
                            bool: ACK 수신 시 True, 타임아웃 시 False
                        """
                        # 1) 프레이밍/전송
                        await send_clova_audio_to_twilio(
                            websocket=websocket,
                            stream_sid=stream_sid,
                            audio_data=raw_mulaw_bytes,
                            sentence_index=0,
                            pipeline_start=time.time(),
                            pending_mark_responses=pending_mark_responses,
                            ws_send_lock=ws_send_lock
                        )
                        
                        # 2) mark 등록 및 ACK 이벤트 준비
                        evt = asyncio.Event()
                        pending_mark_responses[mark_name] = evt
                        
                        # 마크 직접 전송
                        await send_mark_message(websocket, stream_sid, mark_name)
                        logger.info(f"📤 [Mark] {mark_name} 전송 (call_sid={call_sid})")
                        
                        # 3) ACK 대기 (재생 예상시간 + 여유, 상한 cap)
                        timeout = min(est_duration_sec + ack_extra, ack_cap)
                        try:
                            await asyncio.wait_for(evt.wait(), timeout=timeout)
                            logger.info(f"✅ [Mark] {mark_name} ACK 수신 (call_sid={call_sid})")
                            return True
                        except asyncio.TimeoutError:
                            # 4) 재생 실패/버퍼 막힘 → clear로 비우고, 이후 진행 허용
                            await ws_send(websocket, {"event": "clear", "streamSid": stream_sid})
                            logger.warning(f"⚠️ [Mark] {mark_name} 타임아웃 → clear 전송 (call_sid={call_sid}, 경과={timeout:.1f}초)")
                            return False
                        finally:
                            pending_mark_responses.pop(mark_name, None)
                    
                    # ✅ 게이트 제어 함수
                    def gate_on():
                        """게이트 ON"""
                        nonlocal gate_since
                        if rtzr_stt:
                            rtzr_stt.start_bot_speaking()
                            gate_since = time.monotonic()
                            logger.info(f"🔒 [Gate ON] call_sid={call_sid}")
                    
                    def gate_off():
                        """게이트 OFF"""
                        nonlocal gate_since
                        if rtzr_stt:
                            rtzr_stt.stop_bot_speaking()
                            rtzr_stt.bot_silence_delay = 0
                            elapsed = time.monotonic() - gate_since if gate_since else 0
                            gate_since = None
                            logger.info(f"🔓 [Gate OFF] call_sid={call_sid}, 경과={elapsed:.1f}초")
                    
                    # ✅ D. 전역 워치독: 항상 게이트에 데드라인 부여
                    async def global_gate_watchdog():
                        """전역 게이트 워치독 (주기 체크)"""
                        while True:
                            await asyncio.sleep(0.5)
                            if rtzr_stt and rtzr_stt.is_bot_speaking and gate_since:
                                elapsed = time.monotonic() - gate_since
                                # 환영 메시지는 최대 10초까지 허용 (ACK 타임아웃 8초 + 여유)
                                if elapsed > 10.0:
                                    logger.warning(f"⚠️ [워치독] 10초 초과 게이트 해제 강제 수행 (call_sid={call_sid}, 경과={elapsed:.1f}초)")
                                    try:
                                        await ws_send(websocket, {"event": "clear", "streamSid": stream_sid})
                                    except Exception:
                                        pass
                                    gate_off()
                    
                    # 전역 워치독 시작
                    watchdog_task = asyncio.create_task(global_gate_watchdog())
                    
                    # ✅ C. "첫 인사" 경로를 조건 대기로 변경
                    async def send_welcome_message_with_conditions():
                        """환영 메시지를 조건 대기 후 전송"""
                        try:
                            # 1) 준비 조건: START 수신 + streamSid 설정
                            try:
                                await asyncio.wait_for(stream_started.wait(), timeout=2.0)
                                # logger.info(f"✅ [환영 메시지 준비] stream_started 확인 완료")
                            except asyncio.TimeoutError:
                                logger.warning(f"⚠️ [환영 메시지 준비] stream_started 타임아웃 (2초), 계속 진행")
                            
                            # 2) inbound_ready 또는 RTZR 활성화 대기 (하이브리드: inbound_ready는 이벤트, RTZR은 폴링)
                            initial_inbound_ready = inbound_ready.is_set()
                            initial_rtzr_active = rtzr_stt.is_active if rtzr_stt else False
                            # logger.info(f"⏳ [환영 메시지 준비] inbound_ready 또는 RTZR 활성화 대기 시작 (초기 상태: inbound_ready={initial_inbound_ready}, rtzr_active={initial_rtzr_active})")
                            
                            wait_start_time = time.monotonic()
                            timeout_seconds = 3.0
                            check_interval = 0.05  # 50ms 간격으로 RTZR 체크
                            
                            # 이미 조건이 만족되었는지 확인
                            if initial_inbound_ready or initial_rtzr_active:
                                # RTZR 활성화를 기다려야 하는 경우 (inbound_ready만 설정된 경우)
                                if initial_inbound_ready and not initial_rtzr_active:
                                    # RTZR 활성화를 짧게 기다림 (최대 1초)
                                    rtzr_wait_time = 0.0
                                    while rtzr_wait_time < 1.0:
                                        if rtzr_stt and rtzr_stt.is_active:
                                            logger.info(f"✅ [환영 메시지 준비] RTZR 활성화 확인 완료 (대기 시간: {rtzr_wait_time:.3f}초)")
                                            break
                                        await asyncio.sleep(check_interval)
                                        rtzr_wait_time += check_interval
                                    if not (rtzr_stt and rtzr_stt.is_active):
                                        logger.warning(f"⚠️ [환영 메시지 준비] RTZR 활성화 대기 타임아웃 (1초), 계속 진행")
                                elif initial_rtzr_active:
                                    logger.info(f"✅ [환영 메시지 준비] RTZR 활성화 확인 완료 (즉시)")
                            else:
                                # 조건 대기: inbound_ready 이벤트 또는 RTZR 활성화 폴링
                                try:
                                    # inbound_ready 이벤트 대기 태스크 생성
                                    inbound_wait_task = asyncio.create_task(inbound_ready.wait())
                                    
                                    # 타임아웃까지 RTZR 활성화 폴링하면서 inbound_ready도 체크
                                    condition_met = False
                                    while time.monotonic() - wait_start_time < timeout_seconds:
                                        # inbound_ready 체크 (이벤트 기반)
                                        if inbound_ready.is_set():
                                            elapsed = time.monotonic() - wait_start_time
                                            logger.info(f"✅ [환영 메시지 준비] inbound_ready 확인 완료 (대기 시간: {elapsed:.3f}초)")
                                            inbound_wait_task.cancel()
                                            try:
                                                await inbound_wait_task
                                            except asyncio.CancelledError:
                                                pass
                                            condition_met = True
                                            break
                                        
                                        # RTZR 활성화 체크 (폴링)
                                        if rtzr_stt and rtzr_stt.is_active:
                                            elapsed = time.monotonic() - wait_start_time
                                            logger.info(f"✅ [환영 메시지 준비] RTZR 활성화 확인 완료 (대기 시간: {elapsed:.3f}초)")
                                            inbound_wait_task.cancel()
                                            try:
                                                await inbound_wait_task
                                            except asyncio.CancelledError:
                                                pass
                                            condition_met = True
                                            break
                                        
                                        await asyncio.sleep(check_interval)
                                    
                                    if not condition_met:
                                        elapsed = time.monotonic() - wait_start_time
                                        inbound_wait_task.cancel()
                                        try:
                                            await inbound_wait_task
                                        except asyncio.CancelledError:
                                            pass
                                        logger.warning(f"⚠️ [환영 메시지 준비] inbound_ready/RTZR 활성화 타임아웃 ({timeout_seconds}초, 경과: {elapsed:.3f}초), 현재 상태: inbound_ready={inbound_ready.is_set()}, rtzr_active={rtzr_stt.is_active if rtzr_stt else False})")
                                        
                                except Exception as e:
                                    elapsed = time.monotonic() - wait_start_time
                                    logger.error(f"❌ [환영 메시지 준비] 조건 대기 중 오류: {e} (경과: {elapsed:.3f}초), 계속 진행")
                            
                            # 최종 상태 확인 및 로깅
                            final_inbound_ready = inbound_ready.is_set()
                            final_rtzr_active = rtzr_stt.is_active if rtzr_stt else False
                            final_elapsed = time.monotonic() - wait_start_time
                            # logger.info(f"📊 [환영 메시지 준비] 최종 준비 상태: inbound_ready={final_inbound_ready}, rtzr_active={final_rtzr_active} (총 대기 시간: {final_elapsed:.3f}초)")
                            
                            # 2) 에코 방지 게이트 ON
                            gate_on()
                            
                            try:
                                welcome_text = get_time_based_welcome_message()
                                logger.info(f"💬 [환영 메시지] 전송 시작: {welcome_text} (call_sid={call_sid})")
                                
                                audio_data, tts_time = await asyncio.wait_for(
                                    tts_service.text_to_speech_bytes(welcome_text),
                                    timeout=5.0
                                )
                                
                                if not audio_data:
                                    raise RuntimeError("TTS failed")
                                
                                # 3) 전송 + mark ACK 대기 (실패 시 clear)
                                est_duration = estimate_playback_seconds(audio_data)
                                logger.info(f"📤 [환영 메시지] 오디오 데이터 준비 완료, 예상 재생 시간: {est_duration:.2f}초, 데이터 크기: {len(audio_data)} bytes")
                                ok = await send_audio_with_ack(
                                    websocket=websocket,
                                    stream_sid=stream_sid,
                                    raw_mulaw_bytes=audio_data,
                                    mark_name="greeting_done",
                                    pending_mark_responses=pending_mark_responses,
                                    est_duration_sec=est_duration
                                )
                                
                                if ok:
                                    logger.info(f"✅ [환영 메시지] 전송 및 ACK 완료 (call_sid={call_sid})")
                                else:
                                    logger.warning(f"⚠️ [환영 메시지] ACK 타임아웃 - clear 전송됨 (call_sid={call_sid})")
                                
                                # (선택) ok일 때만 짧은 유예(수백 ms) 후 게이트 해제
                                if ok:
                                    await asyncio.sleep(0.3)
                                
                            except asyncio.TimeoutError:
                                logger.warning(f"⚠️ [환영 메시지] TTS 타임아웃 (call_sid={call_sid})")
                            except Exception as e:
                                logger.error(f"❌ [환영 메시지] 전송 오류: {e} (call_sid={call_sid})")
                                import traceback
                                logger.error(traceback.format_exc())
                            finally:
                                # 4) 어떤 경우에도 게이트 해제(워치독 성격)
                                gate_off()
                        except Exception as e:
                            logger.error(f"❌ [환영 메시지] 전체 프로세스 오류: {e} (call_sid={call_sid})")
                            import traceback
                            logger.error(traceback.format_exc())
                            # 최종 안전장치
                            gate_off()
                    
                    # ✅ 환영 메시지를 백그라운드 태스크로 시작
                    welcome_task = asyncio.create_task(send_welcome_message_with_conditions())
                    
                    # STT 응답 속도 측정 변수
                    last_partial_time = None
                    
                    async def process_rtzr_results():
                        """RTZR 인식 결과 처리"""
                        nonlocal last_partial_time, call_sid
                        stt_complete_time = None
                        try:
                            # logger.info("🔄 [process_rtzr_results 시작] 결과 처리 루프 가동")
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
                                    
                                    # 대화 세션에 추가
                                    if call_sid in conversation_sessions:
                                        conversation_sessions[call_sid].append({
                                            "role": "assistant",
                                            "content": warning_message
                                        })
                                    
                                    logger.info(f"🔊 [TTS] 종료 안내 메시지 전송: {warning_message}")
                                    
                                    # ✅ 독립적인 TTS 서비스 인스턴스 사용
                                    audio_data, tts_time = await tts_service.text_to_speech_bytes(warning_message)
                                    if audio_data:
                                        playback_duration = await send_clova_audio_to_twilio(
                                            websocket,
                                            stream_sid,
                                            audio_data,
                                            0,
                                            time.time(),
                                            pending_mark_responses=pending_mark_responses,
                                            ws_send_lock=ws_send_lock
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
                                        logger.info("⏳ [MAX TIME WARNING] 종료 안내 후 대기 완료, 통화 종료 진행")
                                    else:
                                        logger.error("❌ [MAX TIME WARNING] TTS 변환 실패")
                                        await asyncio.sleep(1.0)
                                    
                                    # 종료 안내 후 즉시 통화 종료
                                    try:
                                        await websocket.close()
                                        logger.info("✅ [MAX TIME WARNING] 통화 종료 완료")
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
                                        
                                        # 대화 세션에 사용자 메시지 추가
                                        if call_sid not in conversation_sessions:
                                            conversation_sessions[call_sid] = []
                                        conversation_sessions[call_sid].append({"role": "user", "content": text})
                                        
                                        goodbye_text = "그랜비 통화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
                                        conversation_sessions[call_sid].append({"role": "assistant", "content": goodbye_text})
                                        
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
                                    if call_sid not in conversation_sessions:
                                        conversation_sessions[call_sid] = []
                                    conversation_sessions[call_sid].append({"role": "user", "content": text})
                                    
                                    conversation_history = conversation_sessions[call_sid]
                                    
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
                                        tts_service=tts_service,  # 독립적인 TTS 서비스 인스턴스 전달
                                        pending_mark_responses=pending_mark_responses,  # mark 응답 대기 딕셔너리 전달
                                        ws_send_lock=ws_send_lock
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
                                            # conversation_sessions에 여전히 존재하는지 확인
                                            if call_sid in conversation_sessions:
                                                conversation_sessions[call_sid].append({"role": "assistant", "content": ai_response})
                                            
                                            # 대화 히스토리 관리
                                            if call_sid in conversation_sessions and len(conversation_sessions[call_sid]) > 20:
                                                conversation_sessions[call_sid] = conversation_sessions[call_sid][-20:]
                                        
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
                    
                    # ✅ RTZR 스트리밍 태스크 시작 (백그라운드)
                    rtzr_task = asyncio.create_task(process_rtzr_results())
                    logger.info(f"🎤 RTZR 실시간 STT 스트리밍 태스크 시작: {call_sid}")
                    
                    # ✅ 조건: RTZR 스트리밍이 활성화될 때까지 대기 (폴링 + 타임아웃)
                    async def wait_for_rtzr_active(timeout: float = 5.0):
                        """RTZR 스트리밍이 활성화될 때까지 조건 기반 대기"""
                        start_time = time.monotonic()
                        check_interval = 0.1  # 100ms 간격으로 확인
                        
                        while time.monotonic() - start_time < timeout:
                            if rtzr_stt and rtzr_stt.is_active:
                                return True
                            await asyncio.sleep(check_interval)
                        
                        return False
                    
                    rtzr_active = await wait_for_rtzr_active(timeout=5.0)
                    if rtzr_active:
                        logger.info(f"✅ [RTZR 스트리밍] 활성화 확인 완료")
                    else:
                        logger.warning(f"⚠️ [RTZR 스트리밍] 활성화 대기 타임아웃 (5초), 계속 진행")
                
                # ========== 2. 오디오 데이터 수신 및 RTZR로 전송 ==========
                elif event_type == 'media':
                    # ✅ media.track, media.chunk 로깅
                    track = msg.get('media', {}).get('track', 'N/A')
                    chunk = msg.get('media', {}).get('chunk', 'N/A')
                    sequence_number = msg.get('sequenceNumber', 'N/A')
                    logger.debug(f"📊 [Media 이벤트] track={track}, chunk={chunk}, sequenceNumber={sequence_number}")
                    
                    # ✅ A. 준비 조건: 최초 inbound media 수신 시 inbound_ready 설정 (Start 이벤트에서 설정되지 않은 경우 대비)
                    if track == "inbound" and not inbound_ready.is_set():
                        inbound_ready.set()
                    
                    # ✅ start 이벤트 수신 전에는 버퍼링되므로 도달하면 반복 진행
                    if not start_event_received:
                        if sequence_number >= 0:
                            message_buffer.add_message(msg, sequence_number)
                        else:
                            pre_start_media_no_seq.append(msg)
                        continue
                    
                    # ✅ RTZR이 초기화되지 않았으면 무시
                    if not rtzr_stt:
                        logger.warning(f"⚠️ [Media 이벤트] RTZR STT가 초기화되지 않음")
                        continue
                    
                    # ✅ RTZR이 활성화되지 않았으면 활성화 시도
                    if not rtzr_stt.is_active:
                        logger.warning(f"⚠️ [Media 이벤트] RTZR STT가 비활성화 상태, 무시")
                        continue
                    
                    # ✅ AI 응답 중이면 오디오 무시 (에코 방지)
                    if rtzr_stt.is_bot_speaking:
                        continue
                    
                    # ✅ AI 응답 종료 후 대기 중이면 무시
                    if rtzr_stt.bot_silence_delay > 0:
                        rtzr_stt.bot_silence_delay -= 1
                        continue
                    
                    # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                    audio_payload = base64.b64decode(msg['media']['payload'])

                    if track == "inbound" and not logged_first_inbound:
                        if not first_inbound_media.is_set():
                            first_inbound_media.set()
                            if inbound_monitor_task:
                                inbound_monitor_task.cancel()
                        logged_first_inbound = True
                        logger.info(
                            f"🔄 [오디오 경로][2/3] Inbound 오디오 프레임 수신 → STT 전달 시작 "
                            f"(call_sid={call_sid}, frame_size={len(audio_payload)} bytes)"
                        )
                    
                    # RTZR로 오디오 청크 전송
                    await rtzr_stt.add_audio_chunk(audio_payload)
                
                # ========== 3. Mark 이벤트 처리 ==========
                elif event_type == 'mark':
                    # ✅ mark.name 로깅
                    mark_name = msg.get('mark', {}).get('name', '')
                    sequence_number = msg.get('sequenceNumber', 'N/A')
                    logger.info(f"📊 [Mark 이벤트] name={mark_name}, sequenceNumber={sequence_number} (call_sid={call_sid})")
                    
                    # mark 응답 이벤트 설정
                    if mark_name in pending_mark_responses:
                        pending_mark_responses[mark_name].set()
                        logger.info(f"✅ [Mark 응답] {mark_name} 수신 완료 (call_sid={call_sid})")
                    
                
                # ========== 4. 스트림 종료 ==========
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
                    
                    # ✅ 대화 세션을 DB에 저장 (함수 호출)
                    if call_sid in conversation_sessions:
                        conversation = conversation_sessions[call_sid]
                        
                        # 대화 내용 출력
                        if conversation:
                            logger.info(f"\n📋 전체 대화 내용:")
                            logger.info(f"─" * 60)
                            for msg_item in conversation:
                                role = "👤 사용자" if msg_item['role'] == 'user' else "🤖 AI"
                                logger.info(f"{role}: {msg_item['content']}")
                            logger.info(f"─" * 60)
                        
                        await save_conversation_to_db(call_sid, conversation)
                    
                    logger.info(f"┌{'─'*58}┐")
                    logger.info(f"│ ✅ Twilio 통화 정리 완료                               │")
                    logger.info(f"└{'─'*58}┘\n")
                    break
                
    except Exception as e:
        logger.error(f"❌ Twilio WebSocket 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # ✅ 연결 종료 시 항상 DB 저장 (핵심!)
        # 사용자가 직접 전화를 끊어도 대화 내용 보존
        if call_sid and call_sid in conversation_sessions:
            try:
                conversation = conversation_sessions[call_sid]
                await save_conversation_to_db(call_sid, conversation)
                logger.info(f"🔄 Finally 블록에서 DB 저장 완료: {call_sid}")
            except Exception as e:
                logger.error(f"❌ Finally 블록 DB 저장 실패: {e}")
        
        # ✅ 게이트 워치독 정리
        if 'watchdog_task' in locals():
            watchdog_task.cancel()
            try:
                await asyncio.wait_for(watchdog_task, timeout=0.5)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        if inbound_monitor_task:
            inbound_monitor_task.cancel()
            try:
                await asyncio.wait_for(inbound_monitor_task, timeout=0.1)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        
        # ✅ 게이트 강제 해제 (최종 안전장치)
        if rtzr_stt and rtzr_stt.is_bot_speaking:
            if rtzr_stt:
                rtzr_stt.stop_bot_speaking()
                rtzr_stt.bot_silence_delay = 0
            logger.warning(f"⚠️ [Finally] 게이트 강제 해제 (call_sid={call_sid})")
        
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
        if call_sid and call_sid in conversation_sessions:
            del conversation_sessions[call_sid]
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


@router.post("/api/twilio/call-status", tags=["Twilio"])
async def call_status_handler(
    CallSid: str = Form(None),
    CallStatus: str = Form(None)
):
    """
    Twilio 통화 상태 업데이트 콜백
    통화 상태: initiated, ringing, answered, completed, no-answer, busy, failed, canceled
    """
    logger.info(f"📞CallSid={CallSid}, CallStatus={CallStatus}")
    
    # 통화 상태에 따른 DB 업데이트
    try:
        call_log_found = await run_in_threadpool(_handle_call_status_update, CallSid, CallStatus)
    except Exception as e:
        logger.error(f"❌ 통화 상태 업데이트 실패: {CallSid} - {CallStatus}, 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"status": "error", "call_sid": CallSid, "call_status": CallStatus}
    
    if not call_log_found:
        return {"status": "not_found", "call_sid": CallSid, "call_status": CallStatus}

    if CallStatus == 'completed' and CallSid in conversation_sessions:
        try:
            conversation = conversation_sessions[CallSid]
            await save_conversation_to_db(CallSid, conversation)
            logger.info(f"💾 콜백에서 통화 기록 저장 완료: {CallSid}")
        except Exception as e:
            logger.error(f"❌ 콜백 DB 저장 실패: {e}")
    
    if CallStatus == 'completed':
        session_cleaned = False
        if CallSid in conversation_sessions:
            del conversation_sessions[CallSid]
            session_cleaned = True
            logger.info(f"🧹 conversation_sessions에서 제거: {CallSid}")
        if CallSid in active_connections:
            del active_connections[CallSid]
            session_cleaned = True
            logger.info(f"🧹 active_connections에서 제거: {CallSid}")
        
        if not session_cleaned:
            logger.info(f"ℹ️ 세션 정리 불필요 (세션에 없음): {CallSid}")
        logger.info(f"✅ [completed 상태 처리 종료] 모든 처리가 완료되었습니다: {CallSid}")
    
    logger.info(f"📞 통화 상태 업데이트 콜백 처리 완료: {CallSid} - {CallStatus}")
    return {"status": "ok", "call_sid": CallSid, "call_status": CallStatus}

