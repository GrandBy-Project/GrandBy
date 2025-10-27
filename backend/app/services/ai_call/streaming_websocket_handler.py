"""
Streaming WebSocket Handler
Google Cloud Streaming STT를 위한 완전히 새로운 WebSocket 핸들러

기존 방식과의 차이점:
- 침묵 감지 불필요 (STT가 자동으로 발화 단위 감지)
- 실시간 STT 결과 수신 (중간 결과 + 최종 결과)
- 백그라운드 Task로 STT 결과 처리
"""

import logging
import json
import base64
import asyncio
import time
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict, Optional

from app.database import get_db
from app.services.ai_call.streaming_audio_processor import StreamingAudioProcessor
from app.services.ai_call.tts_service import TTSService
from app.services.ai_call.llm_service import LLMService

logger = logging.getLogger(__name__)


class StreamingWebSocketHandler:
    """
    Streaming STT용 WebSocket 핸들러

    Architecture:
    1. Main Task: WebSocket 메시지 수신 → 오디오 전송
    2. Background Task: STT 결과 수신 → LLM → TTS
    """

    def __init__(
        self,
        tts_service: TTSService,
        llm_service: LLMService,
        active_connections: Dict,
        conversation_sessions: Dict,
        saved_calls: set
    ):
        self.tts_service = tts_service
        self.llm_service = llm_service
        self.active_connections = active_connections
        self.conversation_sessions = conversation_sessions
        self.saved_calls = saved_calls

    async def handle_connection(self, websocket: WebSocket, db: Session):
        """
        WebSocket 연결 처리 (Streaming STT 방식)

        Args:
            websocket: Twilio WebSocket 연결
            db: Database 세션
        """
        await websocket.accept()
        logger.info("📞 [Streaming] Twilio WebSocket 연결됨")

        call_sid = None
        stream_sid = None
        audio_processor: Optional[StreamingAudioProcessor] = None
        stt_task = None
        elderly_id = None

        try:
            async for message in websocket.iter_text():
                data = json.loads(message)
                event_type = data.get('event')

                # ========== 1. 스트림 시작 ==========
                if event_type == 'start':
                    call_sid = data['start']['callSid']
                    stream_sid = data['start']['streamSid']

                    # customParameters에서 elderly_id 추출
                    custom_params = data['start'].get('customParameters', {})
                    elderly_id = custom_params.get('elderly_id', 'unknown')

                    # Streaming Audio Processor 초기화
                    audio_processor = StreamingAudioProcessor(call_sid)
                    await audio_processor.initialize_stt()

                    self.active_connections[call_sid] = websocket

                    # 대화 세션 초기화
                    if call_sid not in self.conversation_sessions:
                        self.conversation_sessions[call_sid] = []

                    # DB에 통화 시작 기록
                    await self._save_call_start(call_sid, elderly_id, db)

                    logger.info(f"┌{'─'*58}┐")
                    logger.info(f"│ 🎙️  [Streaming] Twilio 통화 시작                      │")
                    logger.info(f"│ Call SID: {call_sid:43} │")
                    logger.info(f"│ Stream SID: {stream_sid:41} │")
                    logger.info(f"│ Elderly ID: {elderly_id:41} │")
                    logger.info(f"└{'─'*58}┘")

                    # 백그라운드 Task: STT 결과 처리
                    stt_task = asyncio.create_task(
                        self._process_stt_results(
                            audio_processor,
                            websocket,
                            stream_sid,
                            call_sid
                        )
                    )
                    logger.info("🚀 [Streaming] STT 결과 처리 Task 시작")

                    # 시작 안내 메시지
                    welcome_text = "안녕하세요! 무엇을 도와드릴까요?"
                    await self._send_tts_audio(websocket, stream_sid, welcome_text, audio_processor)

                # ========== 2. 오디오 데이터 수신 ==========
                elif event_type == 'media':
                    if audio_processor:
                        # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                        audio_payload = base64.b64decode(data['media']['payload'])

                        # 즉시 STT 스트림에 전송
                        await audio_processor.add_audio_chunk(audio_payload)

                # ========== 3. 스트림 종료 ==========
                elif event_type == 'stop':
                    logger.info(f"\n{'='*60}")
                    logger.info(f"📞 [Streaming] Twilio 통화 종료 - Call: {call_sid}")
                    logger.info(f"{'='*60}")

                    # 전체 대화 내용 확인
                    if audio_processor:
                        full_transcript = audio_processor.get_full_transcript()
                        if full_transcript:
                            logger.info(f"\n📋 전체 대화 내용:")
                            logger.info(f"─" * 60)
                            logger.info(f"{full_transcript}")
                            logger.info(f"─" * 60)

                    # 대화 세션을 DB에 저장
                    if call_sid in self.conversation_sessions:
                        conversation = self.conversation_sessions[call_sid]
                        await self._save_conversation_to_db(call_sid, conversation, db)

                    logger.info(f"┌{'─'*58}┐")
                    logger.info(f"│ ✅ [Streaming] Twilio 통화 정리 완료                   │")
                    logger.info(f"└{'─'*58}┘\n")
                    break

        except WebSocketDisconnect:
            logger.info(f"📞 [Streaming] WebSocket 연결 해제 (Call: {call_sid})")
        except Exception as e:
            logger.error(f"❌ [Streaming] WebSocket 오류: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            # STT Task 정리
            if stt_task and not stt_task.done():
                stt_task.cancel()
                try:
                    await stt_task
                except asyncio.CancelledError:
                    logger.info("🛑 [Streaming] STT Task 취소됨")

            # Audio Processor 정리
            if audio_processor:
                await audio_processor.close()

            # 연결 종료 시 항상 DB 저장
            if call_sid and call_sid in self.conversation_sessions:
                try:
                    conversation = self.conversation_sessions[call_sid]
                    await self._save_conversation_to_db(call_sid, conversation, db)
                    logger.info(f"🔄 [Streaming] Finally 블록에서 DB 저장 완료: {call_sid}")
                except Exception as e:
                    logger.error(f"❌ [Streaming] Finally 블록 DB 저장 실패: {e}")

            # 정리 작업
            if call_sid and call_sid in self.active_connections:
                del self.active_connections[call_sid]
            if call_sid and call_sid in self.conversation_sessions:
                del self.conversation_sessions[call_sid]

            logger.info(f"🧹 [Streaming] WebSocket 정리 완료: {call_sid}")

    async def _process_stt_results(
        self,
        audio_processor: StreamingAudioProcessor,
        websocket: WebSocket,
        stream_sid: str,
        call_sid: str
    ):
        """
        STT 결과 처리 백그라운드 Task

        Args:
            audio_processor: Streaming Audio Processor
            websocket: Twilio WebSocket
            stream_sid: Stream SID
            call_sid: Call SID
        """
        logger.info(f"🎬 [STT Results] 결과 처리 시작 - Call: {call_sid}")

        try:
            # STT 세션에서 발화 결과 수신 (비동기 generator)
            async for utterance in audio_processor.stt_session.process_results():
                cycle_start = time.time()

                logger.info(f"{'='*60}")
                logger.info(f"🎯 [발화 감지] {utterance}")
                logger.info(f"{'='*60}")

                # 종료 키워드 확인
                if '그랜비 통화를 종료합니다' in utterance:
                    logger.info(f"🛑 종료 키워드 감지: '{utterance}'")

                    # 대화 세션에 사용자 메시지 추가
                    if call_sid not in self.conversation_sessions:
                        self.conversation_sessions[call_sid] = []
                    self.conversation_sessions[call_sid].append({"role": "user", "content": utterance})

                    goodbye_text = "그랜비 통화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"

                    # 대화 세션에 AI 응답 추가
                    self.conversation_sessions[call_sid].append({"role": "assistant", "content": goodbye_text})

                    logger.info("🔊 [TTS] 종료 메시지 변환 시작")
                    await self._send_tts_audio(websocket, stream_sid, goodbye_text, audio_processor)
                    logger.info("✅ [TTS] 종료 메시지 변환 완료")
                    await asyncio.sleep(2)
                    await websocket.close()
                    break

                # 대화 세션 초기화 및 사용자 메시지 추가
                if call_sid not in self.conversation_sessions:
                    self.conversation_sessions[call_sid] = []

                self.conversation_sessions[call_sid].append({"role": "user", "content": utterance})

                conversation_history = self.conversation_sessions[call_sid]

                # LLM 응답 생성 + TTS 스트리밍
                logger.info("🤖 [LLM] 생성 시작")
                ai_response = await self._process_streaming_response(
                    websocket,
                    stream_sid,
                    utterance,
                    conversation_history,
                    audio_processor
                )
                logger.info("✅ [LLM] 생성 완료")

                # AI 응답을 대화 세션에 추가
                if ai_response and ai_response.strip():
                    self.conversation_sessions[call_sid].append({"role": "assistant", "content": ai_response})
                    logger.info(f"💾 대화 세션 업데이트: {len(self.conversation_sessions[call_sid])}개 메시지")

                # 대화 히스토리 관리 (최근 20개 메시지 유지)
                if len(self.conversation_sessions[call_sid]) > 20:
                    self.conversation_sessions[call_sid] = self.conversation_sessions[call_sid][-20:]
                    logger.info(f"🔄 대화 히스토리 정리: 최근 20개 메시지 유지")

                total_cycle_time = time.time() - cycle_start
                logger.info(f"⏱️  전체 응답 사이클: {total_cycle_time:.2f}초")
                logger.info(f"{'='*60}\n\n")

        except asyncio.CancelledError:
            logger.info(f"🛑 [STT Results] Task 취소됨 - Call: {call_sid}")
        except Exception as e:
            logger.error(f"❌ [STT Results] 처리 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def _process_streaming_response(
        self,
        websocket: WebSocket,
        stream_sid: str,
        user_message: str,
        conversation_history: list,
        audio_processor: StreamingAudioProcessor
    ) -> str:
        """
        LLM 스트리밍 응답 + TTS 병렬 처리

        Args:
            websocket: WebSocket 연결
            stream_sid: Stream SID
            user_message: 사용자 메시지
            conversation_history: 대화 히스토리
            audio_processor: Audio Processor (에코 방지)

        Returns:
            str: AI 응답 전체 텍스트
        """
        pipeline_start = time.time()

        # 에코 방지 시작
        if audio_processor:
            audio_processor.start_bot_speaking()

        try:
            # LLM 스트리밍 시작
            full_response = []
            sentence_buffer = ""
            sentence_index = [0]  # 문장 순서
            tts_tasks = []

            # 순차 전송을 위한 동기화
            completed_audio = {}
            next_send_index = [0]
            send_lock = asyncio.Lock()

            async for chunk in self.llm_service.generate_response_streaming(
                user_message,
                conversation_history
            ):
                full_response.append(chunk)
                sentence_buffer += chunk

                # 문장 종료 감지
                if any(end in chunk for end in ['. ', '! ', '? ', '\n']):
                    current_idx = sentence_index[0]
                    sentence = sentence_buffer.strip()

                    if sentence:
                        logger.info(f"[문장{current_idx}] {sentence[:40]}...")

                        # TTS Task 생성 (병렬 실행)
                        task = asyncio.create_task(
                            self._process_tts_and_send(
                                websocket, stream_sid,
                                current_idx, sentence,
                                completed_audio, next_send_index, send_lock,
                                pipeline_start
                            )
                        )
                        tts_tasks.append(task)

                        sentence_buffer = ""
                        sentence_index[0] += 1

            # 마지막 문장 처리
            if sentence_buffer.strip():
                current_idx = sentence_index[0]
                task = asyncio.create_task(
                    self._process_tts_and_send(
                        websocket, stream_sid,
                        current_idx, sentence_buffer.strip(),
                        completed_audio, next_send_index, send_lock,
                        pipeline_start
                    )
                )
                tts_tasks.append(task)

            # 모든 TTS 완료 대기
            await asyncio.gather(*tts_tasks, return_exceptions=True)

            final_text = "".join(full_response)
            logger.info(f"✅ [응답 완료] {final_text[:50]}...")

            return final_text

        except Exception as e:
            logger.error(f"❌ [Streaming Response] 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return ""
        finally:
            if audio_processor:
                audio_processor.stop_bot_speaking()

    async def _process_tts_and_send(
        self,
        websocket: WebSocket,
        stream_sid: str,
        index: int,
        sentence: str,
        completed_audio: dict,
        next_send_index: list,
        send_lock: asyncio.Lock,
        pipeline_start: float
    ) -> float:
        """
        단일 문장 TTS 변환 및 순차 전송

        Returns:
            float: 재생 시간
        """
        try:
            import wave
            import io
            import audioop

            # TTS 변환
            logger.info(f"🔊 [TTS] 문장[{index}] 변환 시작: {sentence[:30]}...")
            audio_data, tts_time = await self.tts_service.text_to_speech_sentence(sentence)

            if not audio_data or len(audio_data) < 44:
                logger.warning(f"⚠️ 문장[{index}] TTS 실패")
                return 0.0

            # WAV → mulaw 변환
            wav_io = io.BytesIO(audio_data)
            with wave.open(wav_io, 'rb') as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                pcm_data = wav_file.readframes(wav_file.getnframes())

            # Stereo → Mono
            if channels == 2:
                pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)

            # 샘플레이트 변환 (Twilio는 8kHz 요구)
            if framerate != 8000:
                pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, 8000, None)

            # PCM → mulaw
            mulaw_data = audioop.lin2ulaw(pcm_data, 2)
            playback_duration = len(mulaw_data) / 8000.0

            # 완료된 오디오 저장
            completed_audio[index] = (mulaw_data, playback_duration)

            # 순차 전송
            await self._try_send_in_order(
                websocket, stream_sid,
                completed_audio, next_send_index, send_lock
            )

            return playback_duration

        except Exception as e:
            logger.error(f"❌ 문장[{index}] 처리 오류: {e}")
            return 0.0

    async def _try_send_in_order(
        self,
        websocket: WebSocket,
        stream_sid: str,
        completed_audio: dict,
        next_send_index: list,
        send_lock: asyncio.Lock
    ):
        """순서에 맞춰 오디오 전송"""
        async with send_lock:
            while next_send_index[0] in completed_audio:
                index = next_send_index[0]
                mulaw_data, playback_duration = completed_audio[index]

                logger.info(f"📤 [AUDIO] 문장[{index}] 전송 시작")

                # Base64 인코딩 및 전송
                audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')

                chunk_size = 8000
                for i in range(0, len(audio_base64), chunk_size):
                    chunk = audio_base64[i:i + chunk_size]

                    message = {
                        "event": "media",
                        "streamSid": stream_sid,
                        "media": {"payload": chunk}
                    }

                    await websocket.send_text(json.dumps(message))
                    await asyncio.sleep(0.02)

                logger.info(f"✅ [AUDIO] 문장[{index}] 전송 완료 (재생: {playback_duration:.2f}초)")

                del completed_audio[index]
                next_send_index[0] += 1

    async def _send_tts_audio(
        self,
        websocket: WebSocket,
        stream_sid: str,
        text: str,
        audio_processor: Optional[StreamingAudioProcessor]
    ):
        """단순 TTS 전송 (환영 메시지 등)"""
        if audio_processor:
            audio_processor.start_bot_speaking()

        try:
            # 간단한 TTS 처리 (순차 전송 불필요)
            await self._process_tts_and_send(
                websocket, stream_sid,
                0, text,
                {}, [0], asyncio.Lock(),
                time.time()
            )
        finally:
            if audio_processor:
                audio_processor.stop_bot_speaking()

    async def _save_call_start(self, call_sid: str, elderly_id: str, db: Session):
        """통화 시작 기록 저장"""
        try:
            from app.models.call import CallLog, CallStatus

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
                logger.info(f"✅ [DB] 통화 시작 기록 저장: {call_sid}")
            else:
                logger.info(f"⏭️  [DB] 이미 존재하는 통화 기록: {call_sid}")

        except Exception as e:
            logger.error(f"❌ [DB] 통화 시작 기록 저장 실패: {e}")

    async def _save_conversation_to_db(self, call_sid: str, conversation: list, db: Session):
        """대화 내용 DB 저장"""
        # 이미 저장되었으면 스킵
        if call_sid in self.saved_calls:
            logger.info(f"⏭️  [DB] 이미 저장된 통화: {call_sid}")
            return

        if not conversation or len(conversation) == 0:
            logger.warning(f"⚠️  [DB] 저장할 대화 내용이 없음: {call_sid}")
            return

        logger.info(f"💾 [DB] 대화 기록 저장 시작: {len(conversation)}개 메시지")

        try:
            from app.models.call import CallLog, CallTranscript

            # CallLog 업데이트 (대화 요약)
            call_log_db = db.query(CallLog).filter(CallLog.call_id == call_sid).first()

            if call_log_db and len(conversation) > 0:
                logger.info("🤖 [LLM] 통화 요약 생성 중...")
                summary = self.llm_service.summarize_call_conversation(conversation)
                call_log_db.conversation_summary = summary
                logger.info(f"✅ [DB] 요약 생성 완료: {summary[:100]}...")

                db.commit()
                logger.info(f"✅ [DB] CallLog 업데이트 완료")

            # CallTranscript 저장
            for idx, message in enumerate(conversation):
                speaker = "ELDERLY" if message["role"] == "user" else "AI"

                transcript = CallTranscript(
                    call_id=call_sid,
                    speaker=speaker,
                    text=message["content"],
                    timestamp=idx * 10.0,
                    created_at=datetime.utcnow()
                )
                db.add(transcript)

            db.commit()
            logger.info(f"✅ [DB] 대화 내용 {len(conversation)}개 저장 완료")

            self.saved_calls.add(call_sid)

        except Exception as e:
            logger.error(f"❌ [DB] 저장 실패: {e}")
            import traceback
            logger.error(traceback.format_exc())
            db.rollback()
