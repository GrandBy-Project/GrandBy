"""
RTZR STT (Speech-to-Text) 서비스
실시간 스트리밍 음성 인식 - 한국어 특화
"""

import asyncio
import json
import logging
import time
from typing import AsyncGenerator, Optional
import websockets
import requests
from app.config import settings

logger = logging.getLogger(__name__)


class RTZRSTTService:
    """
    RTZR WebSocket 기반 실시간 스트리밍 STT 서비스
    
    기능:
    - 실시간 음성 스트리밍 인식
    - 부분 인식 결과 실시간 반환
    - 발화 종료 감지 (is_final 플래그)
    - 높은 정확도 한국어 음성 인식
    """
    
    def __init__(self):
        self.client_id = settings.RTZR_CLIENT_ID
        self.client_secret = settings.RTZR_CLIENT_SECRET
        self.api_host = settings.RTZR_API_HOST
        
        if not self.client_id or not self.client_secret:
            logger.error("❌ RTZR_CLIENT_ID 또는 RTZR_CLIENT_SECRET이 설정되지 않았습니다!")
            raise ValueError("RTZR credentials are required")
        
        # logger.info("✅ RTZR STT 서비스 초기화 완료")
    
    async def get_access_token(self) -> str:
        """
        RTZR 인증 토큰 발급
        
        Returns:
            str: Access token
        """
        try:
            response = requests.post(
                f"https://{self.api_host}/v1/authenticate",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
            )
            
            if response.status_code != 200:
                logger.error(f"❌ RTZR 인증 실패: {response.status_code}")
                raise Exception("RTZR authentication failed")
            
            result = response.json()
            token = result["access_token"]
            # logger.info("✅ RTZR 인증 토큰 발급 완료")
            return token
            
        except Exception as e:
            logger.error(f"❌ RTZR 인증 오류: {e}")
            raise
    
    async def transcribe_streaming(
        self,
        audio_queue: asyncio.Queue,
        sample_rate: int = 8000,
        encoding: str = "LINEAR16"
    ) -> AsyncGenerator[dict, None]:
        """
        실시간 음성 스트리밍 인식
        
        Args:
            audio_queue: 오디오 청크를 받는 큐
            sample_rate: 샘플레이트 (기본: 8000)
            encoding: 인코딩 포맷 (기본: LINEAR16)
        
        Yields:
            dict: 인식 결과 {
                'text': str,           # 인식된 텍스트
                'is_final': bool,      # 최종 결과 여부
                'confidence': float,   # 신뢰도
                'start_at': int,       # 발화 시작 시점
                'duration': int        # 발화 지속 시간
            }
        """
        try:
            # 1. 인증 토큰 발급
            token = await self.get_access_token()
            
            # 2. WebSocket URL 생성
            ws_url = f"wss://{self.api_host}/v1/transcribe:streaming"
            params = {
                "sample_rate": str(sample_rate),
                "encoding": encoding,
                "use_itn": "true",  # 영어 숫자 한국어로 변환
                "use_disfluency_filter": "true",  # 말더듬 필터
                "use_profanity_filter": "false"
            }
            
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            ws_url_with_params = f"{ws_url}?{query_string}"
            
            # logger.info(f"🎤 RTZR WebSocket 연결 시작")
            
            # 3. WebSocket 연결
            headers = {"Authorization": f"Bearer {token}"}
            
            async with websockets.connect(
                ws_url_with_params,
                extra_headers=headers
            ) as websocket:
                
                # logger.info("✅ RTZR WebSocket 연결 완료")
                
                # 오디오 전송을 위한 태스크 생성
                async def send_audio_loop():
                    """오디오를 지속적으로 전송"""
                    try:
                        while True:
                            try:
                                audio_chunk = await asyncio.wait_for(audio_queue.get(), timeout=1.0)
                                
                                if audio_chunk is None:  # 종료 신호
                                    await websocket.send("EOS")
                                    logger.info("📤 EOS 전송 완료")
                                    break
                                
                                # 바이너리 메시지로 전송
                                await websocket.send(audio_chunk)
                                
                            except asyncio.TimeoutError:
                                # 타임아웃은 정상 (청크 대기 중)
                                continue
                            except Exception as e:
                                logger.error(f"❌ 오디오 전송 오류: {e}")
                                break
                    except Exception as e:
                        logger.error(f"❌ 오디오 전송 루프 오류: {e}")
                
                # 백그라운드 오디오 전송 태스크
                send_task = asyncio.create_task(send_audio_loop())
                
                # 결과 수신 루프
                try:
                    while True:
                        try:
                            # 메시지 수신 (타임아웃 0.5초)
                            message = await asyncio.wait_for(websocket.recv(), timeout=0.5)
                            
                            if isinstance(message, str):
                                data = json.loads(message)
                                
                                alternatives = data.get('alternatives', [])
                                if alternatives and len(alternatives) > 0:
                                    result = alternatives[0]
                                    text = result.get('text', '')
                                    confidence = result.get('confidence', 0.0)
                                    is_final = data.get('final', False)
                                    
                                    if text:  # 텍스트가 있는 경우만 반환
                                        yield {
                                            'text': text,
                                            'is_final': is_final,
                                            'confidence': confidence,
                                            'start_at': data.get('start_at', 0),
                                            'duration': data.get('duration', 0)
                                        }
                                        
                                        if is_final:
                                            logger.info(f"✅ [RTZR 최종 인식] {text}")
                                        # else:
                                        #     logger.info(f"📝 [RTZR 부분 인식] {text}")
                        
                        except asyncio.TimeoutError:
                            # 타임아웃은 정상 (메시지 대기 중)
                            continue
                        except Exception as e:
                            logger.error(f"❌ 결과 수신 오류: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                            break
                    
                except Exception as e:
                    logger.error(f"❌ 스트리밍 루프 오류: {e}")
                finally:
                    # 오디오 전송 태스크 종료
                    await audio_queue.put(None)
                    
                    # 태스크 완료 대기
                    try:
                        await asyncio.wait_for(send_task, timeout=2.0)
                    except asyncio.TimeoutError:
                        logger.warning("⚠️ 오디오 전송 태스크 타임아웃")
                    
                    logger.info("🛑 RTZR 스트리밍 종료")
        
        except Exception as e:
            logger.error(f"❌ RTZR 스트리밍 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise


class PartialResultBuffer:
    """
    부분 인식 결과를 관리하고 누적하는 버퍼
    
    기능:
    - 부분 인식 결과 수집
    - 최신 인식 결과로 업데이트
    - 발화 종료 시 최종 문장 반환
    """
    
    def __init__(self):
        self.partial_texts = []  # 부분 인식 결과 리스트
        self.current_text = ""   # 현재 인식 중인 텍스트
        self.is_final = False    # 최종 결과 여부
        
    def add_partial(self, text: str):
        """
        부분 인식 결과 추가
        
        Args:
            text: 부분 인식 결과 텍스트
        """
        if text and text.strip():
            self.current_text = text.strip()
            self.partial_texts.append(text.strip())
            # logger.debug(f"📝 [부분 인식] {text.strip()}")
    
    def set_final(self, text: str):
        """
        최종 인식 결과 설정
        
        Args:
            text: 최종 인식 결과 텍스트
        """
        if text and text.strip():
            self.current_text = text.strip()
            self.is_final = True
            # logger.info(f"✅ [최종 인식] {text.strip()}")
    
    def get_current_text(self) -> str:
        """
        현재까지 인식된 텍스트 반환
        
        Returns:
            str: 현재 인식 텍스트
        """
        return self.current_text
    
    def reset(self):
        """버퍼 초기화"""
        self.partial_texts = []
        self.current_text = ""
        self.is_final = False
        logger.debug("🔄 버퍼 초기화")
    
    def is_complete(self) -> bool:
        """발화가 완료되었는지 여부"""
        return self.is_final and self.current_text != ""
