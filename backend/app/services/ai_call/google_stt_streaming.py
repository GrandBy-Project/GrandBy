"""
Google Cloud Speech-to-Text 스트리밍 서비스
실시간 음성 인식을 위한 스트리밍 API 구현
"""

from google.cloud import speech
from google.api_core import retry
from app.config import settings
import logging
import asyncio
import queue
import threading
from typing import Optional, AsyncGenerator
import time

logger = logging.getLogger(__name__)


class GoogleSTTStreaming:
    """
    Google Cloud STT 스트리밍 클라이언트
    
    Twilio에서 실시간으로 들어오는 오디오를 스트리밍 방식으로 처리하여
    사용자가 말하는 동안 계속 텍스트로 변환합니다.
    """
    
    def __init__(self):
        self.client = speech.SpeechClient()
        self.is_streaming = False
        self.audio_queue = queue.Queue()
        self.config = self._create_streaming_config()
        logger.info("🎤 Google STT 스트리밍 클라이언트 초기화 완료")
    
    def _create_streaming_config(self) -> speech.StreamingRecognitionConfig:
        """스트리밍 인식 설정 생성"""
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=8000,  # Twilio 8kHz
            language_code="ko-KR",
            model="phone_call",  # 전화 통화 최적화
            enable_automatic_punctuation=True,
            use_enhanced=True,
            audio_channel_count=1,
        )
        
        streaming_config = speech.StreamingRecognitionConfig(
            config=config,
            interim_results=True,  # 중간 결과 반환
            single_utterance=False,  # 연속 인식
        )
        
        return streaming_config
    
    def add_audio_chunk(self, audio_data: bytes):
        """
        오디오 청크를 큐에 추가
        
        Args:
            audio_data: mulaw 포맷 오디오 (Twilio에서 전송)
        """
        if self.is_streaming:
            self.audio_queue.put(audio_data)
    
    def _request_generator(self):
        """
        스트리밍 요청 생성기
        큐에서 오디오 데이터를 꺼내서 API에 전송
        """
        # 첫 요청: 설정 정보
        yield speech.StreamingRecognizeRequest(streaming_config=self.config)
        
        # 이후 요청: 오디오 데이터
        while self.is_streaming:
            try:
                # 타임아웃 설정 (0.1초마다 체크)
                audio_data = self.audio_queue.get(timeout=0.1)
                
                # mulaw를 LINEAR16으로 변환
                import audioop
                pcm_data = audioop.ulaw2lin(audio_data, 2)
                
                yield speech.StreamingRecognizeRequest(audio_content=pcm_data)
                
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"❌ 오디오 청크 처리 오류: {e}")
                break
    
    async def start_streaming(self) -> AsyncGenerator[str, None]:
        """
        스트리밍 시작 및 결과 반환
        
        Yields:
            str: 인식된 텍스트 (중간 결과 및 최종 결과)
        """
        self.is_streaming = True
        self.audio_queue = queue.Queue()  # 큐 초기화
        
        try:
            logger.info("🎙️ Google STT 스트리밍 시작")
            
            # 스트리밍 인식 실행 (동기 → 비동기 래핑)
            loop = asyncio.get_event_loop()
            
            # 별도 스레드에서 실행
            responses = await loop.run_in_executor(
                None,
                lambda: self.client.streaming_recognize(
                    self.config,
                    self._request_generator()
                )
            )
            
            # 결과 처리
            for response in responses:
                if not response.results:
                    continue
                
                result = response.results[0]
                if not result.alternatives:
                    continue
                
                transcript = result.alternatives[0].transcript
                is_final = result.is_final
                
                # 중간 결과 로깅
                if not is_final:
                    logger.debug(f"[중간] {transcript}")
                else:
                    logger.info(f"✅ [최종] {transcript}")
                    yield transcript
                    
        except Exception as e:
            logger.error(f"❌ 스트리밍 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            self.is_streaming = False
            logger.info("🛑 Google STT 스트리밍 종료")
    
    def stop_streaming(self):
        """스트리밍 중지"""
        self.is_streaming = False
        logger.info("🛑 스트리밍 중지 요청")


class GoogleSTTStreamingSession:
    """
    단일 통화 세션을 위한 STT 스트리밍 관리자
    
    각 Twilio 통화마다 독립적인 세션을 생성하여
    실시간으로 음성을 텍스트로 변환합니다.
    """
    
    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.streaming_client: Optional[GoogleSTTStreaming] = None
        self.transcript_buffer = []  # 변환된 텍스트 누적
        self.is_active = False
        
        # 발화 감지 설정
        self.last_speech_time = time.time()
        self.silence_threshold = 1.5  # 1.5초 침묵 후 발화 종료로 간주
        
        logger.info(f"📞 STT 세션 생성: {call_sid}")
    
    async def initialize(self):
        """세션 초기화"""
        try:
            self.streaming_client = GoogleSTTStreaming()
            self.is_active = True
            logger.info(f"✅ STT 세션 초기화 완료: {self.call_sid}")
        except Exception as e:
            logger.error(f"❌ STT 세션 초기화 실패: {e}")
            raise
    
    def add_audio_chunk(self, audio_data: bytes):
        """
        오디오 청크 추가
        
        Args:
            audio_data: mulaw 오디오 데이터
        """
        if self.streaming_client and self.is_active:
            self.streaming_client.add_audio_chunk(audio_data)
            self.last_speech_time = time.time()
    
    async def process_streaming(self) -> AsyncGenerator[str, None]:
        """
        스트리밍 처리 및 발화 단위로 텍스트 반환
        
        Yields:
            str: 완성된 발화 텍스트
        """
        if not self.streaming_client:
            return
        
        current_utterance = []
        
        try:
            async for transcript in self.streaming_client.start_streaming():
                current_utterance.append(transcript)
                self.last_speech_time = time.time()
                
                # 침묵 체크 (발화 종료 감지)
                await asyncio.sleep(0.1)
                silence_duration = time.time() - self.last_speech_time
                
                if silence_duration >= self.silence_threshold and current_utterance:
                    # 발화 완료
                    full_utterance = " ".join(current_utterance)
                    logger.info(f"🎤 [발화 완료] {full_utterance}")
                    
                    self.transcript_buffer.append(full_utterance)
                    yield full_utterance
                    
                    current_utterance = []
                    
        except Exception as e:
            logger.error(f"❌ 스트리밍 처리 오류: {e}")
    
    def get_full_transcript(self) -> str:
        """전체 대화 내용 반환"""
        return " ".join(self.transcript_buffer)
    
    async def close(self):
        """세션 종료"""
        if self.streaming_client:
            self.streaming_client.stop_streaming()
        self.is_active = False
        logger.info(f"🛑 STT 세션 종료: {self.call_sid}")

