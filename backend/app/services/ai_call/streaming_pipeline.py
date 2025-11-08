"""
실시간 스트리밍 파이프라인 (LLM → TTS → Twilio)
"""
import logging
import json
import base64
import asyncio
import time
import re
import wave
import io
import audioop

from fastapi import WebSocket
from app.services.ai_call.llm_service import LLMService
from app.core.state import active_tts_completions

logger = logging.getLogger(__name__)


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
                "media": {"payload": chunk}}
            
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

