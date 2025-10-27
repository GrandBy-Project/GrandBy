"""
Google Cloud Speech-to-Text Streaming Manager
실시간 STT 스트리밍을 위한 완전히 새로운 구현

Features:
- 진정한 비동기 스트리밍 (asyncio 기반)
- 중간 결과 + 최종 결과 실시간 수신
- 자동 세션 재시작 (Google 305초 제한 대응)
- 발화 단위 자동 감지
- 에러 처리 및 자동 복구
"""

from google.cloud import speech_v1p1beta1 as speech
from google.api_core import exceptions as google_exceptions
import asyncio
import logging
from typing import AsyncGenerator, Optional, Dict
import time
import os
import queue
import threading
from app.config import settings

logger = logging.getLogger(__name__)


class StreamingSTTManager:
    """
    Google Cloud STT 실시간 스트리밍 관리자

    Architecture:
    - Producer: add_audio() → audio_queue (asyncio.Queue)
    - Transfer Thread: asyncio.Queue → sync_queue (queue.Queue)
    - Consumer: _request_generator() → Google Cloud API
    - Results: Threading으로 결과 수신 → result_queue → start_streaming()
    """

    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.is_active = False
        self.audio_queue: asyncio.Queue = asyncio.Queue()

        # Google Cloud Speech Client 초기화
        self._init_google_client()

        # 스트리밍 설정
        self.config = self._create_recognition_config()
        self.streaming_config = self._create_streaming_config()

        # 세션 관리
        self.session_start_time = 0
        # 테스트용: 30초 (실제 운영: 300초)
        # Google Cloud 제한: 305초이지만, 테스트를 위해 짧게 설정
        self.max_session_duration = 30  # 30초 (테스트용) / 실제: 300초
        self.total_audio_duration = 0  # 전송된 오디오 총 시간

        # 통계
        self.interim_count = 0
        self.final_count = 0
        self.error_count = 0

        logger.info(f"🎙️ [StreamingSTT] 초기화 완료 - Call: {call_sid}")

    def _init_google_client(self):
        """Google Cloud Speech Client 초기화"""
        try:
            # 환경 변수에서 인증 정보 설정
            credentials_path = settings.GOOGLE_APPLICATION_CREDENTIALS
            if os.path.exists(credentials_path):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
                logger.info(f"✅ Google Cloud 인증: {credentials_path}")
            else:
                raise FileNotFoundError(f"인증 파일 없음: {credentials_path}")

            self.client = speech.SpeechClient()
            logger.info("✅ Google Cloud Speech Client 초기화 성공")

        except Exception as e:
            logger.error(f"❌ Google Cloud Client 초기화 실패: {e}")
            raise

    def _create_recognition_config(self) -> speech.RecognitionConfig:
        """STT 인식 설정 생성"""
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.MULAW,  # Twilio mulaw
            sample_rate_hertz=8000,  # Twilio 8kHz
            language_code=settings.GOOGLE_STT_LANGUAGE_CODE,
            model=settings.GOOGLE_STT_MODEL,  # phone_call

            # 품질 향상 옵션
            enable_automatic_punctuation=True,
            use_enhanced=True,

            # 상세 정보
            max_alternatives=settings.GOOGLE_STT_MAX_ALTERNATIVES,
            profanity_filter=False,
            enable_word_time_offsets=False,  # Streaming에서는 불필요
        )

        logger.info(f"🔧 [StreamingSTT] 인식 설정:")
        logger.info(f"   - 언어: {config.language_code}")
        logger.info(f"   - 모델: {config.model}")
        logger.info(f"   - 샘플레이트: {config.sample_rate_hertz}Hz")
        logger.info(f"   - 인코딩: MULAW")

        return config

    def _create_streaming_config(self) -> speech.StreamingRecognitionConfig:
        """스트리밍 설정 생성"""
        streaming_config = speech.StreamingRecognitionConfig(
            config=self.config,
            interim_results=settings.GOOGLE_STT_INTERIM_RESULTS,  # True
            single_utterance=settings.GOOGLE_STT_SINGLE_UTTERANCE,  # False
        )

        logger.info(f"🔧 [StreamingSTT] 스트리밍 설정:")
        logger.info(f"   - 중간 결과: {streaming_config.interim_results}")
        logger.info(f"   - 단일 발화: {streaming_config.single_utterance}")

        return streaming_config

    async def add_audio(self, audio_data: bytes):
        """
        오디오 청크를 스트림에 추가

        Args:
            audio_data: mulaw 포맷 오디오 (Twilio에서 전송, 20ms 청크)
        """
        if not self.is_active:
            logger.warning(f"⚠️ [StreamingSTT] 비활성 상태 - 오디오 무시")
            return

        # 오디오 큐에 추가 (시간 제한 체크 제거 - 재시작 메커니즘이 처리)
        await self.audio_queue.put(audio_data)

        # 통계 업데이트 (20ms per chunk)
        self.total_audio_duration += 0.02

    def _request_generator(self, sync_queue: queue.Queue):
        """
        스트리밍 요청 생성기 (동기 generator)

        Args:
            sync_queue: 동기 큐 (오디오 데이터 수신용)

        Yields:
            StreamingRecognizeRequest (오디오만, config는 API 호출 시 전달)
        """
        # 첫 요청부터 오디오 데이터만 전송 (config는 streaming_recognize()에 이미 전달됨)
        logger.info(f"📤 [StreamingSTT] 오디오 스트리밍 시작")
        chunk_count = 0

        while self.is_active:
            try:
                # 동기 큐에서 가져오기 (타임아웃 0.1초)
                audio_data = sync_queue.get(timeout=0.1)

                chunk_count += 1

                # 오디오 전송 로그 (50개마다 = 1초마다)
                if chunk_count % 50 == 0:
                    logger.info(f"📤 [Audio] 전송 중: {chunk_count}개 청크 ({chunk_count * 0.02:.1f}초)")

                # 오디오 데이터만 요청 생성 (config 제외!)
                yield speech.StreamingRecognizeRequest(audio_content=audio_data)

            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"❌ [StreamingSTT] 요청 생성 오류: {e}")
                break

        logger.info(f"🛑 [StreamingSTT] 요청 생성기 종료 - 총 {chunk_count}개 청크 전송")

    async def start_streaming(self) -> AsyncGenerator[Dict, None]:
        """
        스트리밍 시작 및 결과 반환

        Yields:
            {
                'text': str,
                'is_final': bool,
                'confidence': float,
                'stability': float
            }
        """
        self.is_active = True
        self.session_start_time = time.time()
        self.interim_count = 0
        self.final_count = 0

        logger.info(f"🎬 [StreamingSTT] 스트리밍 시작 - Call: {self.call_sid}")

        # 동기 큐 (asyncio.Queue → queue.Queue 브리지)
        sync_queue = queue.Queue()
        result_queue = queue.Queue()

        def audio_transfer_thread():
            """asyncio.Queue에서 queue.Queue로 오디오 전달"""
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def transfer():
                while self.is_active:
                    try:
                        audio_data = await asyncio.wait_for(
                            self.audio_queue.get(),
                            timeout=0.1
                        )
                        sync_queue.put(audio_data)
                    except asyncio.TimeoutError:
                        continue
                    except Exception as e:
                        logger.error(f"❌ [StreamingSTT] 오디오 전달 오류: {e}")
                        break

            loop.run_until_complete(transfer())

        def streaming_thread():
            """별도 스레드에서 Google Cloud Streaming 실행"""
            try:
                logger.info(f"🌐 [StreamingSTT Thread] Google Cloud API 호출 시작")

                # Google Cloud API 호출 (동기)
                responses = self.client.streaming_recognize(
                    config=self.streaming_config,
                    requests=self._request_generator(sync_queue)
                )

                logger.info(f"✅ [StreamingSTT Thread] API 연결 성공 - 결과 수신 시작")

                # 결과 처리
                response_count = 0
                for response in responses:
                    if not self.is_active:
                        logger.info(f"🛑 [StreamingSTT Thread] is_active=False, 종료")
                        break

                    response_count += 1

                    if not response.results:
                        continue

                    result = response.results[0]
                    if not result.alternatives:
                        continue

                    alternative = result.alternatives[0]
                    transcript = alternative.transcript
                    is_final = result.is_final

                    if not transcript or not transcript.strip():
                        continue

                    # 모든 결과 로깅 (interim + final)
                    if is_final:
                        logger.info(f"📝 [STT] FINAL: '{transcript}' (신뢰도: {getattr(alternative, 'confidence', 0.0):.2f})")
                    else:
                        logger.info(f"⏳ [STT] INTERIM: '{transcript}' (안정성: {getattr(result, 'stability', 0.0):.2f})")

                    # 결과 딕셔너리
                    result_dict = {
                        'text': transcript,
                        'is_final': is_final,
                        'confidence': getattr(alternative, 'confidence', 0.0) if is_final else 0.0,
                        'stability': getattr(result, 'stability', 0.0) if not is_final else 0.0
                    }

                    result_queue.put(result_dict)

                    # Google Cloud는 single_utterance=False 설정으로
                    # final result 후에도 계속 대기하도록 함
                    # 스트림이 자연스럽게 끊길 때까지 계속 수신
                    # (Google Cloud 305초 제한 또는 네트워크 종료 시까지)

                logger.info(f"🏁 [StreamingSTT Thread] Google Cloud 스트림 종료됨 (총 {response_count}개 응답)")
                # 종료 시그널
                result_queue.put(None)

            except Exception as e:
                logger.error(f"❌ [StreamingSTT Thread] 오류: {e}")
                import traceback
                logger.error(traceback.format_exc())
                result_queue.put(None)

        # 스레드 시작
        audio_thread = threading.Thread(target=audio_transfer_thread, daemon=True)
        stream_thread = threading.Thread(target=streaming_thread, daemon=True)

        audio_thread.start()
        stream_thread.start()

        logger.info(f"🚀 [StreamingSTT] 백그라운드 스레드 시작됨")

        try:
            # 결과 큐에서 읽기
            while self.is_active:
                await asyncio.sleep(0.05)  # 50ms마다 체크

                try:
                    result_dict = result_queue.get_nowait()
                except queue.Empty:
                    continue

                # 종료 시그널
                if result_dict is None:
                    logger.info(f"🏁 [StreamingSTT] 스트림 종료 신호 받음")
                    break

                # 통계
                if result_dict['is_final']:
                    self.final_count += 1
                    logger.info(f"✅ [STT Final #{self.final_count}] {result_dict['text'][:50]}... "
                               f"(신뢰도: {result_dict['confidence']:.2f})")
                else:
                    self.interim_count += 1
                    logger.debug(f"⏳ [STT Interim #{self.interim_count}] {result_dict['text'][:30]}... "
                                f"(안정성: {result_dict['stability']:.2f})")

                yield result_dict

            logger.info(f"🏁 [StreamingSTT] 스트리밍 정상 종료 - "
                       f"최종: {self.final_count}개, 중간: {self.interim_count}개")
            # 제너레이터가 여기서 완전히 종료됨 → process_results()의 재시작 로직 실행

        except Exception as e:
            self.error_count += 1
            logger.error(f"❌ [StreamingSTT] 스트리밍 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())

        finally:
            # is_active는 여기서 False로 설정하지 않음!
            # stop() 메서드를 통해서만 is_active를 False로 설정
            session_duration = time.time() - self.session_start_time
            logger.info(f"🛑 [StreamingSTT] 세션 정리 완료 - "
                       f"시간: {session_duration:.1f}초, "
                       f"오디오: {self.total_audio_duration:.1f}초, "
                       f"최종: {self.final_count}개, "
                       f"오류: {self.error_count}개")

    async def stop(self):
        """스트리밍 중지"""
        logger.info(f"🛑 [StreamingSTT] 중지 요청 - Call: {self.call_sid}")
        self.is_active = False

        # 큐 비우기
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

    def get_stats(self) -> Dict:
        """스트리밍 통계 반환"""
        return {
            'call_sid': self.call_sid,
            'is_active': self.is_active,
            'interim_count': self.interim_count,
            'final_count': self.final_count,
            'error_count': self.error_count,
            'total_audio_duration': round(self.total_audio_duration, 2),
            'session_duration': round(time.time() - self.session_start_time, 2) if self.is_active else 0,
            'queue_size': self.audio_queue.qsize()
        }


class StreamingSTTSession:
    """단일 통화를 위한 STT 세션 관리자"""

    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.manager: Optional[StreamingSTTManager] = None
        self.is_running = False
        self.utterance_buffer = []

        logger.info(f"📞 [STTSession] 생성 - Call: {call_sid}")

    async def initialize(self):
        """세션 초기화"""
        try:
            self.manager = StreamingSTTManager(self.call_sid)
            self.is_running = True
            logger.info(f"✅ [STTSession] 초기화 완료 - Call: {self.call_sid}")
        except Exception as e:
            logger.error(f"❌ [STTSession] 초기화 실패: {e}")
            raise

    async def add_audio(self, audio_data: bytes):
        """
        오디오 추가 (재시작 중에도 안전하게 처리)

        Args:
            audio_data: mulaw 포맷 오디오 (Twilio, 20ms 청크)
        """
        if self.manager and self.is_running:
            try:
                await self.manager.add_audio(audio_data)
            except Exception as e:
                # 재시작 중 일시적 오류는 무시
                logger.debug(f"⚠️ [STTSession] 오디오 추가 중 오류 (재시작 중일 수 있음): {e}")

    async def process_results(self) -> AsyncGenerator[str, None]:
        """
        STT 결과 처리 및 최종 발화 반환 (자동 재시작 지원)

        Google Cloud Streaming API는 일정 시간 후 스트림을 종료하므로
        자동으로 재시작하여 연속적인 인식을 제공합니다.
        """
        if not self.manager:
            return

        restart_count = 0
        max_restarts = 100  # 최대 재시작 횟수 (안전장치)

        while self.is_running and restart_count < max_restarts:
            try:
                if restart_count > 0:
                    logger.info(f"🔄 [STTSession] 스트림 자동 재시작 #{restart_count}")
                    # 새 매니저 생성 (기존 세션은 종료됨)
                    self.manager = StreamingSTTManager(self.call_sid)
                    await asyncio.sleep(0.1)  # 짧은 대기

                # 스트리밍 시작 및 결과 처리
                async for result in self.manager.start_streaming():
                    if result['is_final']:
                        final_text = result['text'].strip()
                        if final_text:
                            self.utterance_buffer.append(final_text)
                            logger.info(f"🎤 [발화 완료 #{len(self.utterance_buffer)}] {final_text}")
                            yield final_text

                # 스트림이 정상 종료됨 (Google Cloud가 끊음)
                if self.is_running:
                    logger.info(f"🔄 [STTSession] 스트림 종료됨, 재시작 준비... (재시작 횟수: {restart_count + 1})")
                    restart_count += 1
                else:
                    logger.info(f"🛑 [STTSession] 정상 종료 요청됨")
                    break

            except Exception as e:
                logger.error(f"❌ [STTSession] 결과 처리 오류: {e}")
                import traceback
                logger.error(traceback.format_exc())

                # 오류 발생 시에도 재시작 시도
                if self.is_running:
                    restart_count += 1
                    logger.warning(f"⚠️ [STTSession] 오류 후 재시작 시도 #{restart_count}")
                    await asyncio.sleep(0.5)  # 오류 후에는 조금 더 대기
                else:
                    break

        if restart_count >= max_restarts:
            logger.error(f"❌ [STTSession] 최대 재시작 횟수({max_restarts}) 초과")

    def get_full_transcript(self) -> str:
        """전체 대화 내용 반환"""
        return " ".join(self.utterance_buffer)

    async def close(self):
        """세션 종료"""
        if self.manager:
            await self.manager.stop()
        self.is_running = False

        logger.info(f"🛑 [STTSession] 종료 - Call: {self.call_sid}, "
                   f"발화: {len(self.utterance_buffer)}개")

    def get_stats(self) -> Dict:
        """통계 반환"""
        base_stats = {
            'utterance_count': len(self.utterance_buffer),
            'is_running': self.is_running
        }

        if self.manager:
            base_stats.update(self.manager.get_stats())

        return base_stats
