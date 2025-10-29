"""
오디오 변환 공통 서비스
TTS 변환 및 오디오 포맷 변환 로직을 통합
"""

import asyncio
import base64
import json
import logging
import time
import wave
import io
import audioop
from typing import Optional, Tuple, Dict, Any
from app.config.audio_config import AudioConfig

logger = logging.getLogger(__name__)


class AudioConverter:
    """오디오 변환 공통 서비스 클래스"""
    
    def __init__(self, cartesia_tts_service):
        self.cartesia_tts_service = cartesia_tts_service
    
    async def convert_and_send_audio(
        self, 
        websocket, 
        stream_sid: str, 
        text: str
    ) -> float:
        """
        단일 문장을 TTS 변환하고 Twilio로 즉시 전송 (병렬 처리용)
        
        Args:
            websocket: Twilio WebSocket 연결
            stream_sid: Twilio Stream SID
            text: 변환할 문장
        
        Returns:
            float: 이 문장의 예상 재생 시간 (초)
        """
        try:
            # 1. TTS 변환 (문장 단위, 비동기)
            audio_data, tts_time = await self.cartesia_tts_service.text_to_speech_sentence(text)
            
            if not audio_data:
                logger.warning(f"⚠️ TTS 변환 실패, 건너뜀: {text[:30]}...")
                return 0.0
            
            # 2. WAV → mulaw 변환 (Twilio 호환)
            mulaw_data, playback_duration = self._convert_wav_to_mulaw(audio_data)
            
            # 3. Twilio로 전송
            await self._send_audio_to_twilio(websocket, stream_sid, mulaw_data)
            
            logger.info(f"✅ 문장 전송 완료 ({tts_time:.2f}초, 재생: {playback_duration:.2f}초): {text[:30]}...")
            
            return playback_duration
            
        except Exception as e:
            logger.error(f"❌ 오디오 변환/전송 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return 0.0
    
    async def send_audio_to_twilio_with_tts(
        self, 
        websocket, 
        stream_sid: str, 
        text: str, 
        audio_processor=None
    ):
        """
        TTS Service를 사용하여 텍스트를 음성으로 변환 후 Twilio WebSocket으로 전송
        
        Args:
            websocket: Twilio WebSocket 연결
            stream_sid: Twilio Stream SID
            text: 변환할 텍스트
            audio_processor: AudioProcessor 인스턴스 (에코 방지용)
        """
        if audio_processor:
            audio_processor.start_bot_speaking()
        
        logger.info(f"🎙️ [환영] 빠른 음성 생성: {text}")
        
        try:
            start_time = time.time()
            
            # Cartesia HTTP API 직접 호출
            access_token = await self.cartesia_tts_service._get_access_token()
            client = await self.cartesia_tts_service._get_http_client()
            
            try:
                response = await client.post(
                    "https://api.cartesia.ai/tts/bytes",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "Cartesia-Version": "2025-04-16",
                    },
                    json={
                        "model_id": self.cartesia_tts_service.model,
                        "transcript": text,
                        "voice": {
                            "mode": "id",
                            "id": self.cartesia_tts_service.voice
                        },
                        "language": "ko",
                        "output_format": {
                            "container": "raw",
                            "encoding": "pcm_s16le",
                            "sample_rate": AudioConfig.CARTESIA_SAMPLE_RATE
                        }
                    }
                )
                
                response.raise_for_status()
                pcm_data = response.content
                
                tts_time = time.time() - start_time
                logger.info(f"✅ [환영] TTS 완료 ({tts_time:.2f}초)")
                
                if not pcm_data or len(pcm_data) == 0:
                    logger.error("❌ 음성 데이터 없음")
                    return
                
                # PCM 24kHz → 8kHz mulaw (Twilio)
                mulaw_data = self._convert_pcm_to_mulaw(pcm_data)
                
                # Twilio로 전송
                await self._send_audio_to_twilio(websocket, stream_sid, mulaw_data)
                
                total_time = time.time() - start_time
                logger.info(f"✅ [환영] 전송 완료 (총 {total_time:.2f}초)")
                
            except Exception as e:
                logger.error(f"❌ 환영 메시지 전송 오류: {e}")
                import traceback
                logger.error(traceback.format_exc())
        except Exception as e:
            logger.error(f"❌ 전체 환영 메시지 처리 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            if audio_processor:
                audio_processor.stop_bot_speaking()
    
    async def generate_welcome_audio_async(self, text: str) -> bytes:
        """환영 메시지 오디오를 미리 생성"""
        try:
            start_time = time.time()
            
            # 이미 준비된 토큰 사용
            access_token = await self.cartesia_tts_service._get_access_token()
            
            # 최적화된 HTTP 클라이언트 사용
            client = await self.cartesia_tts_service._get_http_client()
            
            response = await client.post(
                "https://api.cartesia.ai/tts/bytes",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "Cartesia-Version": "2025-04-16",
                },
                json={
                    "model_id": self.cartesia_tts_service.model,
                    "transcript": text,
                    "voice": {
                        "mode": "id",
                        "id": self.cartesia_tts_service.voice
                    },
                    "language": "ko",
                    "output_format": {
                        "container": "raw",
                        "encoding": "pcm_s16le",
                        "sample_rate": AudioConfig.CARTESIA_SAMPLE_RATE
                    }
                }
            )
            
            response.raise_for_status()
            pcm_data = response.content
            
            # 오디오 변환 (μ-law 변환은 필수이므로 유지)
            mulaw_data = self._convert_pcm_to_mulaw(pcm_data)
            
            tts_time = time.time() - start_time
            logger.info(f"✅ [환영] 사전 생성 완료 ({tts_time:.2f}초)")
            
            return mulaw_data
            
        except Exception as e:
            logger.error(f"❌ 환영 메시지 사전 생성 실패: {e}")
            return None
    
    async def send_prepared_audio_to_twilio(
        self, 
        websocket, 
        stream_sid: str, 
        mulaw_data: bytes, 
        audio_processor=None
    ):
        """준비된 오디오를 Twilio로 전송"""
        if not mulaw_data:
            return
        
        try:
            if audio_processor:
                audio_processor.start_bot_speaking()
            
            # Twilio로 전송
            await self._send_audio_to_twilio(websocket, stream_sid, mulaw_data)
            
            logger.info(f"✅ [환영] 즉시 전송 완료")
            
        except Exception as e:
            logger.error(f"❌ 준비된 오디오 전송 실패: {e}")
        finally:
            if audio_processor:
                audio_processor.stop_bot_speaking()
    
    def _convert_wav_to_mulaw(self, wav_data: bytes) -> Tuple[bytes, float]:
        """
        WAV 데이터를 mulaw로 변환
        
        Args:
            wav_data: WAV 포맷 오디오 데이터
        
        Returns:
            tuple: (mulaw_data, playback_duration)
        """
        try:
            wav_io = io.BytesIO(wav_data)
            with wave.open(wav_io, 'rb') as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                pcm_data = wav_file.readframes(wav_file.getnframes())
            
            # Stereo → Mono 변환 (필요 시)
            if channels == 2:
                pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)
            
            # 샘플레이트 변환: Twilio는 8kHz 요구
            if framerate != AudioConfig.SAMPLE_RATE:
                pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, AudioConfig.SAMPLE_RATE, None)
            
            # PCM → mulaw 변환
            mulaw_data = audioop.lin2ulaw(pcm_data, AudioConfig.SAMPLE_WIDTH)
            
            # 재생 시간 계산 (mulaw 8kHz: 1초 = 8000 bytes)
            playback_duration = len(mulaw_data) / AudioConfig.SAMPLE_RATE
            
            return mulaw_data, playback_duration
            
        except Exception as e:
            logger.error(f"❌ WAV → mulaw 변환 실패: {e}")
            return b"", 0.0
    
    def _convert_pcm_to_mulaw(self, pcm_data: bytes) -> bytes:
        """
        PCM 데이터를 mulaw로 변환
        
        Args:
            pcm_data: PCM 오디오 데이터 (24kHz)
        
        Returns:
            bytes: mulaw 오디오 데이터
        """
        try:
            # PCM 24kHz → 8kHz 변환
            resampled_pcm, _ = audioop.ratecv(
                pcm_data, AudioConfig.CARTESIA_SAMPLE_WIDTH, 1, 
                AudioConfig.CARTESIA_SAMPLE_RATE, AudioConfig.SAMPLE_RATE, None
            )
            
            # PCM → mulaw 변환
            mulaw_data = audioop.lin2ulaw(resampled_pcm, AudioConfig.SAMPLE_WIDTH)
            
            return mulaw_data
            
        except Exception as e:
            logger.error(f"❌ PCM → mulaw 변환 실패: {e}")
            return b""
    
    async def _send_audio_to_twilio(self, websocket, stream_sid: str, mulaw_data: bytes):
        """
        mulaw 오디오 데이터를 Twilio로 전송
        
        Args:
            websocket: Twilio WebSocket 연결
            stream_sid: Twilio Stream SID
            mulaw_data: mulaw 오디오 데이터
        """
        try:
            # Base64 인코딩
            audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
            
            logger.info(f"📤 [AUDIO] 음성 전송 시작: {len(mulaw_data)} bytes")
            
            # 청크 단위 전송
            for i in range(0, len(audio_base64), AudioConfig.CHUNK_SIZE):
                chunk = audio_base64[i:i + AudioConfig.CHUNK_SIZE]
                
                message = {
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {"payload": chunk}
                }
                
                await websocket.send_text(json.dumps(message))
                await asyncio.sleep(AudioConfig.AUDIO_CHUNK_DELAY)
            
            logger.info(f"✅ [AUDIO] 음성 전송 완료")
            
        except Exception as e:
            logger.error(f"❌ Twilio 오디오 전송 실패: {e}")
            raise
    
    def convert_to_mulaw_optimized(self, audio_data: bytes) -> Tuple[bytes, float]:
        """
        오디오 변환 최적화 (ThreadPool용)
        
        Args:
            audio_data: WAV 오디오 데이터
        
        Returns:
            tuple: (mulaw_data, playback_duration)
        """
        try:
            # WAV 파일 읽기
            wav_io = io.BytesIO(audio_data)
            with wave.open(wav_io, 'rb') as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                n_frames = wav_file.getnframes()
                pcm_data = wav_file.readframes(n_frames)
            
            logger.info(f"원본 오디오: {framerate}Hz, {channels}ch, {sample_width}바이트, {n_frames}프레임")
            
            # Stereo → Mono (평균)
            if channels == 2:
                pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)
                logger.info(f"Mono 변환 완료")
            
            if sample_width != AudioConfig.SAMPLE_WIDTH:
                pcm_data = audioop.lin2lin(pcm_data, sample_width, AudioConfig.SAMPLE_WIDTH)
                sample_width = AudioConfig.SAMPLE_WIDTH
                logger.info(f"16-bit 변환 완료")
            
            if framerate != AudioConfig.SAMPLE_RATE:
                logger.info(f"샘플레이트 변환: {framerate}Hz → {AudioConfig.SAMPLE_RATE}Hz")
                pcm_data, _ = audioop.ratecv(
                    pcm_data, sample_width, 1, framerate, AudioConfig.SAMPLE_RATE, None
                )
                logger.info(f"샘플레이트 변환 완료")

            mulaw_data = audioop.lin2ulaw(pcm_data, AudioConfig.SAMPLE_WIDTH)
            playback_duration = len(mulaw_data) / AudioConfig.SAMPLE_RATE
            
            return mulaw_data, playback_duration
            
        except Exception as e:
            logger.error(f"❌ 오디오 변환 최적화 실패: {e}")
            return b"", 0.0
