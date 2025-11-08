"""
Twilio 관련 API 엔드포인트
"""
import logging
import json
import base64
import asyncio
import time
from datetime import datetime
from typing import Dict
from fastapi import APIRouter, WebSocket, Form, HTTPException, Depends, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream

from app.config import settings
from app.database import get_db
from app.services.ai_call.twilio_service import TwilioService
from app.services.ai_call.rtzr_stt_realtime import RTZRRealtimeSTT, LLMPartialCollector
from app.services.ai_call.naver_clova_tts_service import NaverClovaTTSService
from app.services.ai_call.streaming_pipeline import process_streaming_response, send_clova_audio_to_twilio
from app.utils.conversation_helpers import get_time_based_welcome_message, save_conversation_to_db
from app.utils.performance_metrics import PerformanceMetricsCollector
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
    stream = Stream(url=websocket_url)
    
    if elderly_id and elderly_id != "unknown":
        stream.parameter(name="elderly_id", value=elderly_id)
    
    connect.append(stream)
    response.append(connect)
    
    
    logger.info(f"🎙️ Twilio WebSocket 스트림 시작: {websocket_url}")
    return str(response)


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
                        logger.info(f"✅ DB에 통화 시작 기록 저장: {call_sid}")
                    else:
                        logger.info(f"⏭️  이미 존재하는 통화 기록: {call_sid}")
                    
                    db.close()
                except Exception as e:
                    logger.error(f"❌ 통화 시작 기록 저장 실패: {e}")
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ 🎙️  Twilio 통화 시작 (RTZR STT)                     │")
                logger.info(f"│ Call SID: {call_sid:43} │")
                logger.info(f"│ Stream SID: {stream_sid:41} │")
                logger.info(f"│ Elderly ID: {elderly_id:41} │")
                logger.info(f"└{'─'*58}┘")
                
                # 🚀 개선: 시간대별 환영 메시지 랜덤 선택
                welcome_text = get_time_based_welcome_message()
                logger.info(f"💬 환영 메시지: {welcome_text}")

                try:
                    # 에코 방지
                    if rtzr_stt:
                        rtzr_stt.start_bot_speaking()

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
                            await asyncio.sleep(playback_duration * 0.9)
                    else:
                        logger.warning(f" 환영 멘트 TTS 합성 실패, 건너뜀")
                except Exception as e:
                    logger.error(f"❌ 환영 멘트 TTS 합성 오류: {e}")
                finally:
                    if rtzr_stt:
                        rtzr_stt.stop_bot_speaking()
                
                # ========== RTZR 스트리밍 시작 ==========
                logger.info("🎤 RTZR 실시간 STT 스트리밍 시작")
                
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
                
                # ✅ 대화 세션을 DB에 저장 (함수 호출)
                if call_sid in conversation_sessions:
                    conversation = conversation_sessions[call_sid]
                    
                    # 대화 내용 출력
                    if conversation:
                        logger.info(f"\n📋 전체 대화 내용:")
                        logger.info(f"─" * 60)
                        for msg in conversation:
                            role = "👤 사용자" if msg['role'] == 'user' else "🤖 AI"
                            logger.info(f"{role}: {msg['content']}")
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
    logger.info(f"📞 통화 상태 업데이트 콜백 수신: CallSid={CallSid}, CallStatus={CallStatus}")
    
    # 통화 상태에 따른 DB 업데이트
    try:
        from app.models.call import CallLog, CallStatus as CallStatusEnum
        db = next(get_db())
        
        call_log = db.query(CallLog).filter(CallLog.call_id == CallSid).first()
        
        if not call_log:
            logger.warning(f"⚠️ CallLog를 찾을 수 없음: {CallSid} (상태: {CallStatus})")
            db.close()
            return {"status": "ok", "call_sid": CallSid, "call_status": CallStatus}
        
        logger.info(f"📋 CallLog 찾음: {CallSid} (현재 상태: {call_log.call_status}, 새 상태: {CallStatus})")
        
        # 통화 상태에 따른 처리
        if CallStatus == 'answered':
            # 통화 연결 시 시작 시간 설정
            logger.info(f"📞 [answered 상태 처리] 통화 연결됨: {CallSid}")
            if not call_log.call_start_time:
                call_log.call_start_time = datetime.utcnow()
                call_log.call_status = CallStatusEnum.ANSWERED
                db.commit()
                logger.info(f"✅ 통화 시작 시간 설정: {CallSid} (상태: ANSWERED로 변경)")
            else:
                logger.info(f"ℹ️ 통화 시작 시간이 이미 설정되어 있음: {CallSid}")
        
        elif CallStatus == 'completed':
            # 통화 종료 시 종료 시간 설정
            logger.info(f"✅ [completed 상태 처리] 통화 종료됨: {CallSid}")
            call_log.call_end_time = datetime.utcnow()
            call_log.call_status = CallStatusEnum.COMPLETED
            
            # 통화 시간 계산
            if call_log.call_start_time:
                duration = (call_log.call_end_time - call_log.call_start_time).total_seconds()
                call_log.call_duration = int(duration)
                logger.info(f"✅ 통화 종료 시간 설정: {CallSid}, 지속시간: {duration}초 (상태: COMPLETED로 변경)")
            
            db.commit()
            
            # ✅ 통화 종료 시 DB 저장 (백업용 - 중복 방지 로직 포함)
            if CallSid in conversation_sessions:
                try:
                    conversation = conversation_sessions[CallSid]
                    await save_conversation_to_db(CallSid, conversation)
                    logger.info(f"💾 콜백에서 통화 기록 저장 완료: {CallSid}")
                except Exception as e:
                    logger.error(f"❌ 콜백 DB 저장 실패: {e}")
            
            # 세션 정리
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
            logger.info(f"✅ [거절/실패 처리 완료] 통화 처리 완료: {CallSid} (상태: {status_name}로 변경)")
            
            # 세션 정리
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
            logger.info(f"✅ [거절/실패 처리 종료] 모든 처리가 완료되었습니다: {CallSid} (상태: {CallStatus})")
        
        db.close()
        logger.info(f"📞 통화 상태 업데이트 콜백 처리 완료: {CallSid} - {CallStatus}")
        
    except Exception as e:
        logger.error(f"❌ 통화 상태 업데이트 실패: {CallSid} - {CallStatus}, 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        if 'db' in locals():
            db.close()
    
    return {"status": "ok", "call_sid": CallSid, "call_status": CallStatus}

