"""
RTZR 실시간 STT 통합 서비스
Twilio WebSocket과 통합하여 실시간 음성 인식 수행
"""

import asyncio
import logging
import time
from typing import Optional, AsyncGenerator, Callable
from app.services.ai_call.rtzr_stt_service import RTZRSTTService, PartialResultBuffer

logger = logging.getLogger(__name__)


class RTZRRealtimeSTT:
    """
    RTZR 실시간 STT 통합 클래스
    
    Twilio WebSocket의 오디오 스트림을 RTZR로 전송하고,
    실시간으로 부분/최종 인식 결과를 반환합니다.
    
    기능:
    - 실시간 음성 스트리밍 인식
    - 부분 결과를 LLM에 백그라운드 전송
    - 최종 결과 반환 (is_final 감지)
    - AI 응답 중 사용자 입력 차단 (에코 방지)
    """
    
    def __init__(self):
        self.rtzr_service = RTZRSTTService()
        self.audio_queue: Optional[asyncio.Queue] = None
        self.streaming_task: Optional[asyncio.Task] = None
        self.results_queue: Optional[asyncio.Queue] = None
        self.is_active = False
        
        # 부분 결과 관리
        self.partial_buffer = PartialResultBuffer()
        
        # 발화 시작 시간 트래킹
        self.streaming_start_time: Optional[float] = None
        self.first_partial_time: Optional[float] = None
        
        # ✅ AI 응답 중 사용자 입력 차단 플래그
        self.is_bot_speaking = False
        self.bot_silence_delay = 0  # AI 응답 종료 후 1초 대기
        
        logger.info("✅ RTZR 실시간 STT 초기화 완료")
    
    def start_bot_speaking(self):
        """AI 응답 시작 - 사용자 입력 차단"""
        self.is_bot_speaking = True
        self.bot_silence_delay = 0
        logger.debug("🤖 [에코 방지] AI 응답 중 - 사용자 입력 차단")
    
    def stop_bot_speaking(self):
        """AI 응답 종료 - 1초 후 사용자 입력 재개"""
        self.is_bot_speaking = False
        self.bot_silence_delay = 50  # 5개 청크 = 0.1초 대기
        logger.debug("🤖 [에코 방지] AI 응답 종료 - 1초 후 사용자 입력 재개")
    
    async def start_streaming(self) -> AsyncGenerator[dict, None]:
        """
        실시간 스트리밍 시작
        
        Yields:
            dict: 인식 결과 {
                'text': str,           # 인식된 텍스트
                'is_final': bool,      # 최종 결과 여부
                'partial_only': bool   # 부분 결과만 있는지 여부
            }
        """
        self.is_active = True
        self.audio_queue = asyncio.Queue()
        self.results_queue = asyncio.Queue()
        
        logger.info("🎤 RTZR 실시간 스트리밍 시작")
        
        try:
            # RTZR 스트리밍 시작 (AsyncGenerator)
            async for result in self.rtzr_service.transcribe_streaming(self.audio_queue):
                # ✅ AI 응답 중이면 사용자 입력 무시
                if self.is_bot_speaking:
                    continue
                
                # ✅ AI 응답 종료 후 1초 대기 중이면 무시
                if self.bot_silence_delay > 0:
                    self.bot_silence_delay -= 1
                    continue
                
                if result and 'text' in result and result['text']:
                    text = result['text']
                    is_final = result.get('is_final', False)
                    
                    if is_final:
                        # 최종 결과
                        self.partial_buffer.set_final(text)
                        
                        yield {
                            'text': text,
                            'is_final': True,
                            'partial_only': False
                        }
                        
                        # 발화 완료 - 버퍼 초기화 및 시간 리셋
                        self.partial_buffer.reset()
                        self.streaming_start_time = None
                        self.first_partial_time = None
                    else:
                        # 부분 결과 - 첫 부분 인식 시 발화 시작 시간 기록
                        if not self.streaming_start_time:
                            self.streaming_start_time = time.time()
                            logger.info(f"🎤 [발화 시작] 첫 부분 인식: {text}")
                        
                        self.partial_buffer.add_partial(text)
                        
                        yield {
                            'text': text,
                            'is_final': False,
                            'partial_only': True
                        }
        
        except Exception as e:
            logger.error(f"❌ RTZR 스트리밍 오류: {e}")
        finally:
            self.is_active = False
            logger.info("🛑 RTZR 실시간 스트리밍 종료")
    
    async def add_audio_chunk(self, audio_data: bytes):
        """
        오디오 청크 추가 (Twilio에서 수신한 mulaw 데이터)
        
        Args:
            audio_data: mulaw 포맷 오디오 (Twilio 8kHz)
        """
        if self.is_active and self.audio_queue:
            try:
                # mulaw → PCM 변환 (RTZR 요구사항)
                import audioop
                pcm_data = audioop.ulaw2lin(audio_data, 2)  # 16-bit PCM으로 변환
                
                # PCM 데이터 전송
                await self.audio_queue.put(pcm_data)
                
            except Exception as e:
                logger.error(f"❌ 오디오 청크 추가 오류: {e}")
    
    async def end_streaming(self):
        """스트리밍 종료"""
        if self.audio_queue:
            await self.audio_queue.put(None)  # EOS 신호
        self.is_active = False


class LLMPartialCollector:
    """
    부분 인식 결과를 수집하여 LLM에 백그라운드로 전송
    
    기능:
    - 부분 인식 결과 수집
    - 문장 완성 추정
    - 발화 종료 대기
    - LLM 백그라운드 전송
    """
    
    def __init__(self, llm_callback: Callable[[str], None]):
        """
        Args:
            llm_callback: 부분 결과를 받아 처리하는 콜백 함수
        """
        self.llm_callback = llm_callback
        self.partial_texts = []
        self.last_partial_time = time.time()
        self.is_collecting = False
        
        logger.info("✅ LLM 부분 결과 수집기 초기화")
    
    def add_partial(self, text: str):
        """
        부분 인식 결과 추가
        
        Args:
            text: 부분 인식된 텍스트
        """
        if text and text.strip():
            self.partial_texts.append(text.strip())
            self.last_partial_time = time.time()
            self.is_collecting = True
            
            # 최신 부분 결과를 즉시 LLM에 전송
            self.llm_callback(text.strip())
            logger.debug(f"📝 [LLM 백그라운드] 부분 결과 전송: {text.strip()}")
    
    def get_final(self) -> str:
        """
        최종 문장 반환 및 초기화
        
        Returns:
            str: 최종 인식된 문장
        """
        if not self.partial_texts:
            return ""
        
        # 가장 최신 결과 반환
        final_text = self.partial_texts[-1]
        
        # 초기화
        self.partial_texts = []
        self.is_collecting = False
        logger.debug(f"✅ [최종 발화] {final_text}")
        
        return final_text
    
    def reset(self):
        """수집기 초기화"""
        self.partial_texts = []
        self.is_collecting = False
        logger.debug("🔄 LLM 수집기 초기화")
