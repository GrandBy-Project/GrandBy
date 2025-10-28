
"""
Cartesia Streaming TTS 서비스
WebSocket을 통한 실시간 음성 스트리밍
"""

import asyncio
import websockets
import json
import logging
import time
import base64
from typing import AsyncIterator, Optional, Tuple
from app.config import settings

logger = logging.getLogger(__name__)


class CartesiaStreamingTTSService:
    """Cartesia API를 사용한 TTS 서비스"""
    
    def __init__(self):
        # 환경 변수 직접 확인 및 폴백 설정
        import os
        
        self.api_key = os.environ.get("CARTESIA_API_KEY") or settings.CARTESIA_API_KEY
        self.model = os.environ.get("CARTESIA_TTS_MODEL") or settings.CARTESIA_TTS_MODEL
        self.voice = os.environ.get("CARTESIA_TTS_VOICE") or settings.CARTESIA_TTS_VOICE
        self.access_token_expires_in = int(os.environ.get("CARTESIA_ACCESS_TOKEN_EXPIRES_IN", settings.CARTESIA_ACCESS_TOKEN_EXPIRES_IN))
        
        self.ws_url = "wss://api.cartesia.ai/tts/websocket"
        # Access Token 캐시
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[float] = None
        
        # 토큰 갱신을 위한 백그라운드 태스크
        self._token_refresh_task = None
        self._token_lock = asyncio.Lock()
        
        # HTTP 클라이언트 연결 풀
        self._http_client = None
        self._client_lock = asyncio.Lock()
        
        logger.info(f"🔊 Cartesia TTS 서비스 초기화 완료")
    
    async def _get_access_token(self) -> str:
        """
        개선된 Access Token 관리 - 백그라운드 갱신
        
        Returns:
            str: 유효한 Access Token
        """
        async with self._token_lock:
            # 토큰이 아직 유효한지 확인 (30초 여유로 증가)
            if (self._access_token and 
                self._token_expires_at and 
                time.time() < self._token_expires_at - 30):
                return self._access_token
            
            # 토큰이 곧 만료되면 백그라운드에서 갱신 시작
            if (self._access_token and 
                self._token_expires_at and 
                time.time() < self._token_expires_at - 60):
                if not self._token_refresh_task or self._token_refresh_task.done():
                    self._token_refresh_task = asyncio.create_task(self._refresh_token_background())
                return self._access_token
            
            # 즉시 토큰 발급
            return await self._refresh_token_immediate()
    
    async def _refresh_token_immediate(self) -> str:
        """즉시 토큰 발급"""
        import httpx
        
        async with httpx.AsyncClient(timeout=15.0) as client:  # 타임아웃 단축
            response = await client.post(
                "https://api.cartesia.ai/access-token",
                headers={
                    "Content-Type": "application/json",
                    "Cartesia-Version": "2025-04-16",
                    "Authorization": f"Bearer {self.api_key}",
                },
                json={
                    "grants": {"tts": True},
                    "expires_in": 3600,
                }
            )
            response.raise_for_status()
            data = response.json()
            
            self._access_token = data["token"]
            self._token_expires_at = time.time() + 3600
            
            return self._access_token
    
    async def _refresh_token_background(self):
        """백그라운드에서 토큰 갱신"""
        try:
            await self._refresh_token_immediate()
            logger.info("🔄 Access Token 백그라운드 갱신 완료")
        except Exception as e:
            logger.error(f"❌ 백그라운드 토큰 갱신 실패: {e}")
    
    async def ensure_token_ready(self):
        """서비스 시작 시 토큰 미리 준비"""
        try:
            await self._get_access_token()
            logger.info("✅ Cartesia Access Token 준비 완료")
        except Exception as e:
            logger.error(f"❌ 토큰 준비 실패: {e}")
    
    async def _get_http_client(self):
        """연결 풀을 사용한 HTTP 클라이언트"""
        if self._http_client is None:
            async with self._client_lock:
                if self._http_client is None:
                    import httpx
                    # 연결 풀 설정으로 성능 최적화
                    limits = httpx.Limits(
                        max_keepalive_connections=5,
                        max_connections=10,
                        keepalive_expiry=30.0
                    )
                    timeout = httpx.Timeout(
                        connect=5.0,  # 연결 타임아웃 단축
                        read=15.0,    # 읽기 타임아웃 단축
                        write=5.0,   # 쓰기 타임아웃 단축
                        pool=5.0     # 풀 타임아웃 추가
                    )
                    self._http_client = httpx.AsyncClient(
                        limits=limits,
                        timeout=timeout,
                    )
        return self._http_client
    
    async def close(self):
        """리소스 정리"""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
            
    async def stream_tts_chunks(
        self,
        text_iterator: AsyncIterator[str],
        context_id: str = None
    ) -> AsyncIterator[bytes]:
        """
        텍스트 스트림을 받아 실시간으로 음성 청크를 생성
        
        핵심 최적화:
        - LLM이 청크를 생성하는 즉시 Cartesia로 전송
        - Cartesia가 즉시 음성 청크 반환
        - 버퍼링 없이 실시간 스트리밍
        
        Args:
            text_iterator: LLM 텍스트 스트림 (문장 단위)
            context_id: 대화 컨텍스트 ID (옵션)
        
        Yields:
            bytes: PCM 오디오 청크 (16-bit, 24kHz)
        """
        try:
            access_token = await self._get_access_token()
            
            # WebSocket 연결 (헤더에 토큰 포함)
            headers = {
                "Cartesia-Version": "2025-04-16",
            }
            
            # WebSocket URL에 토큰 포함
            ws_url = f"{self.ws_url}?api_key={access_token}&cartesia_version=2025-04-16"
            
            async with websockets.connect(
                ws_url,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=10
            ) as websocket:
                
                logger.info("✅ Cartesia WebSocket 연결 성공")
                
                # 초기 설정 메시지 전송
                context_id = context_id or f"ctx_{int(time.time() * 1000)}"
                
                # 수신 태스크 생성 (음성 청크 받기)
                receive_task = asyncio.create_task(
                    self._receive_audio_chunks(websocket)
                )
                
                # 텍스트 스트림 처리
                sentence_buffer = ""
                chunk_count = 0
                
                async for text_chunk in text_iterator:
                    chunk_count += 1
                    sentence_buffer += text_chunk
                    
                    # 문장 구분자 감지 (실시간 전송)
                    if any(p in text_chunk for p in ['.', '!', '?', '\n', '。', '！', '？']):
                        if sentence_buffer.strip():
                            # Cartesia로 즉시 전송
                            await self._send_text_chunk(
                                websocket,
                                sentence_buffer.strip(),
                                context_id,
                                continue_=True
                            )
                            
                            logger.debug(f"📤 문장 전송 [{chunk_count}]: {sentence_buffer[:30]}...")
                            sentence_buffer = ""
                    
                    # 긴 문장은 쉼표에서도 분할 (자연스러운 끊기)
                    elif len(sentence_buffer) > 50 and ',' in sentence_buffer:
                        if sentence_buffer.strip():
                            await self._send_text_chunk(
                                websocket,
                                sentence_buffer.strip(),
                                context_id,
                                continue_=True
                            )
                            sentence_buffer = ""
                
                # 마지막 문장 처리
                if sentence_buffer.strip():
                    await self._send_text_chunk(
                        websocket,
                        sentence_buffer.strip(),
                        context_id,
                        continue_=False  # 마지막 문장
                    )
                    logger.debug(f"📤 마지막 문장 전송: {sentence_buffer[:30]}...")
                
                # 음성 청크 수신 완료 대기
                audio_chunks = await receive_task
                
                # 청크 단위로 yield
                for chunk in audio_chunks:
                    yield chunk
                
                logger.info(f"✅ 스트리밍 완료: {len(audio_chunks)}개 청크 생성")
                
        except websockets.exceptions.WebSocketException as e:
            logger.error(f"❌ WebSocket 오류: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ 스트리밍 TTS 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise
 
    
    async def _send_text_chunk(
        self,
        websocket,
        text: str,
        context_id: str,
        continue_: bool = True
    ):
        """
        Cartesia WebSocket으로 텍스트 청크 전송
        
        Args:
            websocket: WebSocket 연결
            text: 변환할 텍스트
            context_id: 컨텍스트 ID
            continue_: 계속 이어질지 여부 (False면 마지막)
        """
        message = {
            "context_id": context_id,
            "model_id": self.model,
            "transcript": text,
            "continue": continue_,
            "voice": {
                "mode": "id",
                "id": self.voice
            },
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": 24000
            },
            "language": "ko"
        }
        
        await websocket.send(json.dumps(message))
    
    async def _receive_audio_chunks(self, websocket) -> list:
        """
        Cartesia WebSocket에서 음성 청크 수신
        
        Returns:
            list: PCM 오디오 청크 리스트
        """
        audio_chunks = []
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    # 오디오 청크 수신
                    if "data" in data:
                        # Base64 디코딩
                        audio_chunk = base64.b64decode(data["data"])
                        audio_chunks.append(audio_chunk)
                        
                        logger.debug(f"📥 오디오 청크 수신: {len(audio_chunk)} bytes")
                    
                    # 완료 신호
                    elif data.get("done"):
                        logger.info("✅ 음성 생성 완료")
                        break
                    
                    # 에러 처리
                    elif "error" in data:
                        logger.error(f"❌ Cartesia 오류: {data['error']}")
                        break
                        
                except json.JSONDecodeError:
                    logger.warning("⚠️ JSON 파싱 실패")
                    continue
                    
        except Exception as e:
            logger.error(f"❌ 음성 수신 오류: {e}")
        
        return audio_chunks


    async def stream_tts_sentence(
        self,
        text: str
    ) -> Tuple[Optional[bytes], float]:
        """
        단일 문장을 빠르게 스트리밍 변환 (기존 호환용)
        
        Args:
            text: 변환할 문장
        
        Returns:
            tuple: (음성 데이터, 실행 시간)
        """
        try:
            start_time = time.time()
            
            if not text or len(text.strip()) < 2:
                return None, 0
            
            # 단일 문장용 이터레이터 생성
            async def single_text():
                yield text
            
            # 스트리밍 처리
            audio_data = b""
            async for chunk in self.stream_tts_chunks(single_text()):
                audio_data += chunk
            
            elapsed_time = time.time() - start_time
            
            return audio_data if audio_data else None, elapsed_time
            
        except Exception as e:
            logger.error(f"❌ 문장 변환 실패: {e}")
            return None, 0

    async def text_to_speech(self, text: str, output_path: Optional[str] = None) -> Tuple[Optional[str], float]:
        """
        기존 호환성을 위한 배치 방식 TTS (파일 저장)
        
        Args:
            text: 변환할 텍스트
            output_path: 저장할 파일 경로
        
        Returns:
            tuple: (파일 경로, 실행 시간)
        """
        try:
            import tempfile
            from pathlib import Path
            
            start_time = time.time()
            
            # 스트리밍으로 음성 데이터 생성
            async def single_text():
                yield text
            
            audio_data = b""
            async for chunk in self.stream_tts_chunks(single_text()):
                audio_data += chunk
            
            if not audio_data:
                return None, 0
            
            # WAV 파일로 저장
            if output_path is None:
                temp_dir = Path(__file__).parent.parent.parent.parent / "audio_files" / "tts"
                temp_dir.mkdir(parents=True, exist_ok=True)
                timestamp = int(time.time() * 1000)
                output_path = str(temp_dir / f"cartesia_tts_{timestamp}.wav")
            
            # PCM 데이터를 WAV 파일로 저장
            import wave
            with wave.open(output_path, 'wb') as wav_file:
                wav_file.setnchannels(1)      # Mono
                wav_file.setsampwidth(2)      # 16-bit
                wav_file.setframerate(24000)  # 24kHz
                wav_file.writeframes(audio_data)
            
            elapsed_time = time.time() - start_time
            return output_path, elapsed_time
            
        except Exception as e:
            logger.error(f"❌ TTS 변환 실패: {e}")
            return None, 0
    
    async def text_to_speech_sentence(self, text: str) -> Tuple[Optional[bytes], float]:
        """
        기존 호환성을 위한 단일 문장 변환 (메모리 반환)
        
        Args:
            text: 변환할 문장
        
        Returns:
            tuple: (음성 데이터 bytes, 실행 시간)
        """
        return await self.stream_tts_sentence(text)
# 전역 인스턴스
cartesia_tts_service = CartesiaStreamingTTSService()
