"""
Naver Clova TTS 서비스
REST API를 통한 음성 합성 (비동기 최적화)
"""

import httpx
import logging
import time
import os
import asyncio
from pathlib import Path
from typing import Optional, Tuple
from app.config import settings

logger = logging.getLogger(__name__)


class NaverClovaTTSService:
    """Naver Clova TTS 서비스 (비동기 최적화)"""
    
    def __init__(self):
        self.client_id = settings.NAVER_CLOVA_CLIENT_ID
        self.client_secret = settings.NAVER_CLOVA_CLIENT_SECRET
        self.speaker = settings.NAVER_CLOVA_TTS_SPEAKER
        self.speed = settings.NAVER_CLOVA_TTS_SPEED
        self.pitch = settings.NAVER_CLOVA_TTS_PITCH
        self.volume = settings.NAVER_CLOVA_TTS_VOLUME
        self.alpha = settings.NAVER_CLOVA_TTS_ALPHA
        self.emotion = settings.NAVER_CLOVA_TTS_EMOTION

        self.api_url = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts"

        # 음성 파일 저장 디렉토리 설정
        self.audio_dir = Path(__file__).parent.parent.parent.parent / "audio_files" / "tts"
        self.audio_dir.mkdir(parents=True, exist_ok=True)

        # HTTP 클라이언트 (연결 재사용)
        self.client = httpx.AsyncClient(http2=True, timeout=10.0)
        self.sync_client = httpx.Client(http2=True, timeout=10.0)

        # 헤더를 요청마다 새로 설정 (매우 중요!)
        self.headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-NCP-APIGW-API-KEY-ID": self.client_id,
            "X-NCP-APIGW-API-KEY": self.client_secret,
        }

        logger.info(f"🔊 Naver Clova TTS 서비스 초기화 완료")
        logger.info(f"  - Speaker: {self.speaker}")
        logger.info(f"  - Speed: {self.speed}")
        logger.info(f"  - Pitch: {self.pitch}")
        logger.info(f"  - Volume: {self.volume}")
        logger.info(f"  - Alpha: {self.alpha}")
        logger.info(f"  - Emotion: {self.emotion}")
    
    async def text_to_speech_bytes(self, text: str) -> Tuple[Optional[bytes], float]:
        try:
            start_time = time.time()
            logger.info(f"🌐 Naver Clova TTS Client ID: {self.client_id[:10] if self.client_id else 'NOT SET'}")
            
            # 텍스트 검증
            if not text or len(text.strip()) < 1:
                logger.error("❌ 변환할 텍스트가 비어있습니다!")
                return None, 0
            
            # API 호출 데이터
            data = {
                "speaker": self.speaker,
                "speed": str(self.speed),
                "pitch": str(self.pitch),
                "volume": str(self.volume),
                "alpha": str(self.alpha),
                "emotion": str(self.emotion),
                "text": text,
                "format": "wav"
            }
            
            logger.info(f"🌐 Naver Clova TTS API 호출 중... (WAV 포맷)")
            logger.info(f"  - Speaker: {self.speaker}")
            logger.info(f"  - Text length: {len(text)}")
            
            # 비동기 HTTP 요청 실행
            response = await self.client.post(
                self.api_url,
                headers=self.headers,
                data=data,
                timeout=10.0
            )
            try:
                logger.info(f"🌐 [Clova TTS] Protocol negotiated: {response.http_version}  status={response.status_code}")
            except Exception:
                pass
            
            if response.status_code == 200:
                elapsed_time = time.time() - start_time
                logger.info(f"✅ Clova TTS 변환 완료: {len(response.content)} bytes ({elapsed_time:.2f}초)")
                return response.content, elapsed_time
            else:
                logger.error(f"❌ API 호출 실패: {response.status_code}")
                logger.error(f"  - 응답: {response.text}")
                return None, 0
                
        except Exception as e:
            logger.error(f"❌ TTS 변환 오류: {e}")
            return None, 0
    
    def text_to_speech(self, text: str, output_path: str = None) -> Tuple[Optional[str], float]:
        try:
            start_time = time.time()
            logger.info(f"🔊 Naver Clova TTS 변환 시작 (WAV 파일)")

            # 텍스트 검증
            if not text or len(text.strip()) < 1:
                logger.error("❌ 변환할 텍스트가 비어있습니다!")
                return None, 0

            # 출력 파일 경로 설정
            if output_path is None:
                timestamp = int(time.time() * 1000)
                filename = f"clova_tts_{timestamp}.wav"
                output_path = str(self.audio_dir / filename)

            # API 호출 데이터
            data = {
                "speaker": self.speaker,
                "speed": str(self.speed),
                "pitch": str(self.pitch),
                "volume": str(self.volume),
                "alpha": str(self.alpha),
                "emotion": str(self.emotion),
                "text": text,
                "format": "wav"
            }

            logger.info(f"🌐 Naver Clova TTS API 호출 중... (WAV 파일)")
            logger.info(f"  - Speaker: {self.speaker}")
            logger.info(f"  - Text length: {len(text)}")

            response = self.sync_client.post(
                self.api_url,
                headers=self.headers,
                data=data,
                timeout=10.0
            )
            try:
                logger.info(f"🌐 [Clova TTS] (sync) Protocol negotiated: {response.http_version}  status={response.status_code}")
            except Exception:
                pass
            
            # 응답 확인
            if response.status_code == 200:
                logger.info(f"📦 API 응답 받음: {len(response.content)} bytes")
                
                # WAV 파일로 직접 저장 (변환 과정 없음)
                logger.info(f"💾 WAV 파일 저장 중: {output_path}")
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                
                # 저장 확인
                if os.path.exists(output_path):
                    file_size = os.path.getsize(output_path)
                    elapsed_time = time.time() - start_time
                    
                    logger.info(f"✅ TTS 변환 완료!")
                    logger.info(f"  - 파일: {output_path}")
                    logger.info(f"  - 크기: {file_size} bytes")
                    logger.info(f"  - 시간: {elapsed_time:.2f}초")
                    
                    return output_path, elapsed_time
                else:
                    logger.error("❌ 파일 저장 실패!")
                    return None, 0
            else:
                logger.error(f"❌ API 호출 실패: {response.status_code}")
                logger.error(f"  - 응답: {response.text}")
                return None, 0
                
        except Exception as e:
            logger.error(f"❌ TTS 변환 오류: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None, 0
    
    async def close(self):
        """리소스 정리"""
        if self.sync_client:
            self.sync_client.close()
        if self.client:
            await self.client.aclose()
        logger.info("🔒 HTTP 클라이언트 정리 완료")


# 전역 인스턴스
naver_clova_tts_service = NaverClovaTTSService()
