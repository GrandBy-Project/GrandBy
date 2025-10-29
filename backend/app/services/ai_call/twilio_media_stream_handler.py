"""
Twilio Media Stream WebSocket 핸들러
실시간 음성 대화 처리 로직을 담당하는 클래스
"""

import asyncio
import base64
import json
import logging
import time
from datetime import datetime
from typing import Dict, Optional, Any
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.config.audio_config import AudioConfig
from app.services.ai_call.audio_converter import AudioConverter
from app.services.ai_call.rtzr_stt_realtime import RTZRRealtimeSTT, LLMPartialCollector
from app.services.ai_call.llm_service import LLMService
from app.database import get_db

logger = logging.getLogger(__name__)


class TwilioMediaStreamHandler:
    """Twilio Media Stream WebSocket 핸들러 클래스"""
    
    def __init__(self, websocket: WebSocket, db: Session, audio_converter: AudioConverter):
        self.websocket = websocket
        self.db = db
        self.audio_converter = audio_converter
        
        # 통화 세션 정보
        self.call_sid: Optional[str] = None
        self.stream_sid: Optional[str] = None
        self.elderly_id: Optional[str] = None
        
        # STT 및 대화 관리
        self.rtzr_stt: Optional[RTZRRealtimeSTT] = None
        self.llm_collector: Optional[LLMPartialCollector] = None
        self.conversation_history: list = []
        self.partial_response_context: str = ""
        
        # RTZR 태스크
        self.rtzr_task: Optional[asyncio.Task] = None
    
    async def handle_stream(self):
        """메인 스트림 처리 로직"""
        await self.websocket.accept()
        logger.info("📞 Twilio WebSocket 연결됨")
        
        try:
            async for message in self.websocket.iter_text():
                data = json.loads(message)
                event_type = data.get('event')
                
                if event_type == 'start':
                    await self._handle_stream_start(data)
                elif event_type == 'media':
                    await self._handle_media_data(data)
                elif event_type == 'stop':
                    await self._handle_stream_stop()
                    break
                    
        except Exception as e:
            logger.error(f"❌ Twilio WebSocket 오류: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            await self._cleanup()
    
    async def _handle_stream_start(self, data: Dict[str, Any]):
        """스트림 시작 처리"""
        self.call_sid = data['start']['callSid']
        self.stream_sid = data['start']['streamSid']
        
        # customParameters에서 elderly_id 추출
        custom_params = data['start'].get('customParameters', {})
        self.elderly_id = custom_params.get('elderly_id', 'unknown')
        
            # CallSession 객체 생성 및 저장
        from app.main import CallSession, call_sessions
        session = CallSession(self.call_sid, self.stream_sid)
        call_sessions[self.call_sid] = session
        
        # 대화 세션 초기화
        self.conversation_history = []
        
        # RTZR 실시간 STT 초기화
        self.rtzr_stt = RTZRRealtimeSTT()
        
        # LLM 부분 결과 수집기 초기화
        async def llm_partial_callback(partial_text: str):
            """부분 인식 결과를 LLM에 백그라운드 전송"""
            self.partial_response_context = partial_text
            logger.debug(f"💭 [LLM 백그라운드] 부분 결과 업데이트: {partial_text}")
        
        self.llm_collector = LLMPartialCollector(llm_partial_callback)
        
        # DB에 통화 시작 기록 저장
        await self._save_call_start_to_db()
        
        logger.info(f"┌{'─'*58}┐")
        logger.info(f"│ 🎙️  Twilio 통화 시작 (RTZR STT)                     │")
        logger.info(f"│ Call SID: {self.call_sid:43} │")
        logger.info(f"│ Stream SID: {self.stream_sid:41} │")
        logger.info(f"│ Elderly ID: {self.elderly_id:41} │")
        logger.info(f"└{'─'*58}┘")
        
        # 환영 메시지 준비 및 전송
        await self._send_welcome_message()
        
        # RTZR 스트리밍 시작
        await self._start_rtzr_streaming()
    
    async def _handle_media_data(self, data: Dict[str, Any]):
        """오디오 데이터 처리"""
        if not self.rtzr_stt or not self.rtzr_stt.is_active:
            return
        
        # AI 응답 중이면 오디오 무시 (에코 방지)
        if self.rtzr_stt.is_bot_speaking:
            return
        
        # AI 응답 종료 후 대기 중이면 무시
        if self.rtzr_stt.bot_silence_delay > 0:
            self.rtzr_stt.bot_silence_delay -= 1
            return
        
        # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
        audio_payload = base64.b64decode(data['media']['payload'])
        
        # RTZR로 오디오 청크 전송
        await self.rtzr_stt.add_audio_chunk(audio_payload)
    
    async def _handle_stream_stop(self):
        """스트림 종료 처리"""
        logger.info(f"\n{'='*60}")
        logger.info(f"📞 Twilio 통화 종료 - Call: {self.call_sid}")
        logger.info(f"{'='*60}")
        
        # RTZR 백그라운드 태스크 취소
        if self.rtzr_task:
            logger.info("🛑 RTZR 백그라운드 태스크 취소 중...")
            self.rtzr_task.cancel()
            try:
                await asyncio.wait_for(self.rtzr_task, timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                logger.info("✅ RTZR 백그라운드 태스크 종료 완료")
        
        # RTZR 스트리밍 종료
        if self.rtzr_stt:
            await self.rtzr_stt.end_streaming()
            logger.info("🛑 RTZR 스트리밍 종료")
        
        # 대화 내용을 DB에 저장
        await self._save_conversation_to_db()
        
        logger.info(f"┌{'─'*58}┐")
        logger.info(f"│ ✅ Twilio 통화 정리 완료                               │")
        logger.info(f"└{'─'*58}┘\n")
    
    async def _send_welcome_message(self):
        """환영 메시지 전송"""
        welcome_text = "안녕하세요! 무엇을 도와드릴까요?"
        
        # 환영 메시지 TTS 미리 생성
        welcome_audio = await self.audio_converter.generate_welcome_audio_async(welcome_text)
        
        # 준비된 오디오로 즉시 전송
        await self.audio_converter.send_prepared_audio_to_twilio(
            self.websocket, self.stream_sid, welcome_audio, None
        )
    
    async def _start_rtzr_streaming(self):
        """RTZR 스트리밍 시작"""
        logger.info("🎤 RTZR 실시간 STT 스트리밍 시작")
        
        # STT 응답 속도 측정 변수
        last_partial_time = None
        
        async def process_rtzr_results():
            """RTZR 인식 결과 처리"""
            nonlocal last_partial_time
            stt_complete_time = None
            
            try:
                async for result in self.rtzr_stt.start_streaming():
                    if not result or 'text' not in result:
                        continue
                    
                    text = result.get('text', '')
                    is_final = result.get('is_final', False)
                    partial_only = result.get('partial_only', False)
                    
                    current_time = time.time()
                    
                    # 부분 결과는 무시하되 시간 기록
                    if partial_only and text:
                        logger.debug(f"📝 [RTZR 부분 인식] {text}")
                        last_partial_time = current_time
                        continue
                    
                    # 최종 결과 처리
                    if is_final and text:
                        # STT 응답 속도 측정
                        if last_partial_time:
                            speech_to_final_delay = current_time - last_partial_time
                            logger.info(f"⏱️ [STT 지연] 말 끝 → 최종 인식: {speech_to_final_delay:.2f}초")
                        
                        # 최종 발화 완료
                        logger.info(f"✅ [RTZR 최종] {text}")
                        stt_complete_time = current_time
                        
                        # 종료 키워드 확인
                        if '그랜비 통화를 종료합니다' in text:
                            await self._handle_call_termination(text)
                            return
                        
                        # 발화 처리 사이클
                        await self._process_user_speech(text, stt_complete_time)
                    
                    elif text:
                        # 부분 결과를 LLM에 백그라운드 전송
                        self.llm_collector.add_partial(text)
                        logger.debug(f"📝 [RTZR 부분] {text}")
            
            except Exception as e:
                logger.error(f"❌ RTZR 처리 오류: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        # RTZR 스트리밍 태스크 시작 (백그라운드)
        self.rtzr_task = asyncio.create_task(process_rtzr_results())
    
    async def _handle_call_termination(self, text: str):
        """통화 종료 처리"""
        logger.info(f"🛑 종료 키워드 감지")
        
        # 대화 세션에 사용자 메시지 추가
        self.conversation_history.append({"role": "user", "content": text})
        
        goodbye_text = "그랜비 통화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
        self.conversation_history.append({"role": "assistant", "content": goodbye_text})
        
        logger.info("🔊 [TTS] 종료 메시지 전송")
        await self.audio_converter.send_audio_to_twilio_with_tts(
            self.websocket, self.stream_sid, goodbye_text, None
        )
        await asyncio.sleep(2)
        await self.websocket.close()
    
    async def _process_user_speech(self, text: str, stt_complete_time: float):
        """사용자 발화 처리"""
        cycle_start = time.time()
        logger.info(f"{'='*60}")
        logger.info(f"🎯 발화 완료 → 즉시 응답 생성")
        logger.info(f"{'='*60}")
        
        # 대화 세션에 사용자 메시지 추가
        self.conversation_history.append({"role": "user", "content": text})
        
        # LLM 전달까지의 시간 측정
        llm_delivery_start = time.time()
        if stt_complete_time:
            stt_to_llm_delay = llm_delivery_start - stt_complete_time
            logger.info(f"⏱️ [지연시간] 최종 인식 → LLM 전달: {stt_to_llm_delay:.2f}초")
        
        # AI 응답 시작 (사용자 입력 차단)
        self.rtzr_stt.start_bot_speaking()
        
        # LLM 응답 생성
        logger.info("🤖 [LLM] 응답 생성 시작")
        llm_start_time = time.time()
        
        # process_streaming_response를 사용하여 스트리밍 응답 생성
        from app.main import process_streaming_response
        ai_response = await process_streaming_response(
            self.websocket,
            self.stream_sid,
            text,
            self.conversation_history,
            self.audio_converter,
            None
        )
        
        llm_end_time = time.time()
        llm_duration = llm_end_time - llm_start_time
        
        # AI 응답 종료 (1초 후 사용자 입력 재개)
        self.rtzr_stt.stop_bot_speaking()
        
        logger.info("✅ [LLM] 응답 생성 완료")
        
        # 전체 처리 시간 로깅
        if stt_complete_time:
            total_delay = llm_end_time - stt_complete_time
            logger.info(f"⏱️ [전체 지연] 최종 인식 → LLM 완료: {total_delay:.2f}초 (LLM 응답 생성: {llm_duration:.2f}초)")
        
        # AI 응답을 대화 세션에 추가
        if ai_response and ai_response.strip():
            self.conversation_history.append({"role": "assistant", "content": ai_response})
            
            # 대화 히스토리 관리 (최근 20개만 유지)
            if len(self.conversation_history) > 20:
                self.conversation_history = self.conversation_history[-20:]
        
        total_cycle_time = time.time() - cycle_start
        logger.info(f"⏱️  전체 응답 사이클: {total_cycle_time:.2f}초")
        logger.info(f"{'='*60}\n\n")
    
# _generate_ai_response 메서드는 process_streaming_response로 대체됨
    
    async def _save_call_start_to_db(self):
        """통화 시작을 DB에 저장"""
        try:
            from app.models.call import CallLog, CallStatus
            
            # 기존 CallLog가 있는지 확인
            existing_call = self.db.query(CallLog).filter(CallLog.call_id == self.call_sid).first()
            
            if not existing_call:
                call_log = CallLog(
                    call_id=self.call_sid,
                    elderly_id=self.elderly_id,
                    call_status=CallStatus.INITIATED,
                    twilio_call_sid=self.call_sid
                )
                self.db.add(call_log)
                self.db.commit()
                self.db.refresh(call_log)
                logger.info(f"✅ DB에 통화 시작 기록 저장: {self.call_sid}")
            else:
                logger.info(f"⏭️  이미 존재하는 통화 기록: {self.call_sid}")
                
        except Exception as e:
            logger.error(f"❌ 통화 시작 기록 저장 실패: {e}")
            self.db.rollback()
    
    async def _save_conversation_to_db(self):
        """대화 내용을 DB에 저장"""
        if not self.conversation_history:
            logger.warning(f"⚠️  저장할 대화 내용이 없음: {self.call_sid}")
            return
        
        logger.info(f"💾 대화 기록 저장 시작: {len(self.conversation_history)}개 메시지")
        
        try:
            from app.models.call import CallLog, CallTranscript, CallStatus
            from app.services.ai_call.llm_service import LLMService
            
            # 1. CallLog 업데이트 (대화 요약)
            call_log_db = self.db.query(CallLog).filter(CallLog.call_id == self.call_sid).first()
            
            if call_log_db:
                # LLM 요약 생성 (대화가 있는 경우에만)
                if len(self.conversation_history) > 0:
                    logger.info("🤖 LLM으로 통화 요약 생성 중...")
                    llm_service = LLMService()
                    summary = llm_service.summarize_call_conversation(self.conversation_history)
                    call_log_db.conversation_summary = summary
                    logger.info(f"✅ 요약 생성 완료: {summary[:100]}...")
                
                self.db.commit()
                logger.info(f"✅ CallLog 업데이트 완료")
            else:
                logger.warning(f"⚠️  CallLog를 찾을 수 없음: {self.call_sid}")
            
            # 2. CallTranscript 저장 (화자별 대화 내용)
            for idx, message in enumerate(self.conversation_history):
                speaker = "ELDERLY" if message["role"] == "user" else "AI"
                
                transcript = CallTranscript(
                    call_id=self.call_sid,
                    speaker=speaker,
                    text=message["content"],
                    timestamp=idx * 10.0,  # 대략적인 타임스탬프 (10초 간격)
                    created_at=datetime.utcnow()
                )
                self.db.add(transcript)
            
            self.db.commit()
            logger.info(f"✅ 대화 내용 {len(self.conversation_history)}개 저장 완료")
            
        except Exception as e:
            logger.error(f"❌ DB 저장 실패: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.db.rollback()
    
    async def _cleanup(self):
        """리소스 정리"""
        # RTZR 태스크 정리
        if self.rtzr_task and not self.rtzr_task.done():
            self.rtzr_task.cancel()
            try:
                await asyncio.wait_for(self.rtzr_task, timeout=1.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        
        # RTZR 스트리밍 정리
        if self.rtzr_stt:
            try:
                await self.rtzr_stt.end_streaming()
            except Exception as e:
                logger.warning(f"RTZR 정리 중 오류: {e}")
        
        # DB 연결 정리
        if self.db:
            self.db.close()
        
        logger.info(f"🧹 WebSocket 정리 완료: {self.call_sid}")
