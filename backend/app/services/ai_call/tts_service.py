"""
TTS (Text-to-Speech) 서비스
OpenAI TTS API 사용 (gpt-4o-mini-tts)
"""

from openai import OpenAI
from app.config import settings
import logging
from pathlib import Path
import time
import tempfile
import os
import asyncio

logger = logging.getLogger(__name__)


class TTSService:
    """텍스트를 음성으로 변환하는 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # TTS 모델 (tts-1: 빠른 응답, tts-1-hd: 고품질)
        self.model = "tts-1"  # 실시간 대화에 최적화
        # 음성 선택: nova(여성, 따뜻함) - 어르신께 친근한 목소리
        self.voice = "nova"

        # === 추가: 음성 파일 저장 디렉토리 설정 ===
        # backend/audio_files/tts/ 경로 설정
        self.audio_dir = Path(__file__).parent.parent.parent.parent / "audio_files" / "tts"
        # 디렉토리가 없으면 자동 생성
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"🔊 TTS 음성 파일 저장 위치: {self.audio_dir}")
    
    def text_to_speech(self, text: str, output_path: str = None):
        """
        텍스트를 음성으로 변환 (실행 시간 측정 포함)
        
        Args:
            text: 변환할 텍스트
            output_path: 저장할 파일 경로 (None이면 임시 파일 생성)
        
        Returns:
            tuple: (저장된 파일 경로, 실행 시간)
        """
        try:
            start_time = time.time()  # 시작 시간 기록
            logger.info(f"🔊 TTS 변환 시작")
            logger.info(f"📝 변환 텍스트: {text[:100]}...")
            
            # 텍스트 검증
            if not text or len(text.strip()) < 1:
                logger.error("❌ 변환할 텍스트가 비어있습니다!")
                return None, 0
            
            # === 수정: 출력 파일 경로 설정 ===
            if output_path is None:
                # backend/audio_files/tts/ 폴더에 타임스탬프 파일명으로 저장
                timestamp = int(time.time() * 1000)
                filename = f"tts_{timestamp}.wav"
                output_path = str(self.audio_dir / filename)
            
            # TTS API 호출
            logger.info(f"🌐 OpenAI TTS API 호출 중...")
            logger.info(f"  - 모델: {self.model}")
            logger.info(f"  - 음성: {self.voice}")
            logger.info(f"  - 포맷: wav")
            
            response = self.client.audio.speech.create(
                model=self.model,
                voice=self.voice,
                input=text,
                response_format="wav"
            )
            
            # 응답 확인
            logger.info(f"📦 API 응답 받음")
            if hasattr(response, 'content'):
                content_size = len(response.content) if response.content else 0
                logger.info(f"  - Content 크기: {content_size} bytes")
                
                if content_size == 0:
                    logger.error("❌ TTS 응답이 비어있습니다!")
                    logger.error(f"  - 텍스트 길이: {len(text)}")
                    logger.error(f"  - 모델: {self.model}")
                    logger.error(f"  - 음성: {self.voice}")
                    return None, 0
            
            # 파일로 저장
            logger.info(f"💾 파일 저장 중: {output_path}")
            response.write_to_file(output_path)
            
            # 저장 확인
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                logger.info(f"✅ 파일 저장 완료:")
                logger.info(f"  - 경로: {output_path}")
                logger.info(f"  - 크기: {file_size} bytes")
                
                if file_size == 0:
                    logger.error("❌ 저장된 파일이 비어있습니다!")
                    return None, 0
            else:
                logger.error(f"❌ 파일 저장 실패: {output_path}")
                return None, 0
            
            elapsed_time = time.time() - start_time  # 소요 시간 계산
            logger.info(f"✅ TTS 변환 완료 (소요 시간: {elapsed_time:.2f}초)")
            
            return output_path, elapsed_time
        except Exception as e:
            logger.error(f"❌ TTS 변환 실패: {type(e).__name__}: {e}")
            import traceback
            logger.error(f"상세 오류:\n{traceback.format_exc()}")
            raise
    
    async def text_to_speech_sentence(self, text: str):
        """
        단일 문장을 빠르게 음성으로 변환 (스트리밍 최적화용)
        
        LLM이 문장 단위로 생성하면 즉시 TTS 변환하여
        사용자 대기 시간을 최소화합니다.
        
        OpenAI TTS API는 스트리밍을 지원하지 않으므로,
        짧은 문장 단위로 빠르게 변환하는 방식을 사용합니다.
        
        Args:
            text: 변환할 문장 (짧은 텍스트 권장)
        
        Returns:
            tuple: (음성 데이터 bytes, 실행 시간)
            - 실패 시 (None, 0) 반환
        
        Example:
            audio_data, tts_time = await tts_service.text_to_speech_sentence("안녕하세요")
            if audio_data:
                # Twilio로 전송
        """
        try:
            start_time = time.time()
            
            # 빈 문장 체크
            if not text or len(text.strip()) < 2:
                logger.debug("⏭️  빈 문장, TTS 건너뜀")
                return None, 0
            
            logger.info(f"🔊 TTS 문장 변환: {text[:50]}...")
            
            # 비동기로 TTS API 호출 (블로킹 방지)
            loop = asyncio.get_event_loop()
            audio_content = await loop.run_in_executor(
                None,
                self._tts_sync,
                text
            )
            
            elapsed_time = time.time() - start_time
            
            if audio_content:
                logger.info(f"✅ TTS 완료 ({elapsed_time:.2f}초, {len(audio_content)} bytes)")
                return audio_content, elapsed_time
            else:
                logger.error("❌ TTS 응답이 비어있습니다")
                return None, 0
            
        except Exception as e:
            logger.error(f"❌ TTS 변환 실패: {e}")
            return None, 0
    
    def _tts_sync(self, text: str) -> bytes:
        """
        동기 방식 TTS 변환 (executor에서 실행용)
        
        이 메서드는 직접 호출하지 마세요.
        text_to_speech_sentence()에서 내부적으로 사용됩니다.
        
        Args:
            text: 변환할 텍스트
        
        Returns:
            bytes: WAV 음성 데이터
        """
        response = self.client.audio.speech.create(
            model=self.model,
            voice=self.voice,
            input=text,
            response_format="wav"
        )
        return response.content
    
    def text_to_speech_streaming(self, text: str):
        """
        실시간 스트리밍 TTS
        (향후 구현 - Twilio와 통합)
        
        Args:
            text: 변환할 텍스트
        
        Returns:
            audio stream
        """
        # TODO: 실시간 스트리밍 구현
        pass

