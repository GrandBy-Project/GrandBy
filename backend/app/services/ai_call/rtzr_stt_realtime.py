"""
RTZR 실시간 STT 통합 서비스
Twilio WebSocket과 통합하여 실시간 음성 인식 수행
"""

import asyncio
import logging
import time
from typing import Optional, AsyncGenerator, Callable
from app.services.ai_call.end_decision import (
    # EndDecisionEngine,
    EndDecisionSignals,
    check_timeout,
    is_short_ack,
)
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
        self.last_partial_time: Optional[float] = None  # 마지막 부분 결과 시간 (사용자 발화 중 체크용)
        
        # ✅ AI 응답 중 사용자 입력 차단 플래그
        self.is_bot_speaking = False
        self.bot_silence_delay = 0  # AI 응답 종료 후 1초 대기
        
        # ⏱️ 타임아웃 체크용 신호
        self._signals = EndDecisionSignals(call_start_time=time.time())
        self._timeout_task: Optional[asyncio.Task] = None

        # logger.info("✅ RTZR 실시간 STT 초기화 완료")
    
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
    
    def is_user_speaking(self, threshold_seconds: float = 1.5) -> bool:
        """
        사용자가 현재 발화 중인지 확인
        
        Args:
            threshold_seconds: 마지막 부분 결과 이후 경과 시간 임계값 (초)
            
        Returns:
            bool: 사용자가 발화 중이면 True
        """
        if self.last_partial_time is None:
            return False
        
        # 최근 부분 결과가 threshold_seconds 이내에 있었으면 발화 중
        elapsed = time.time() - self.last_partial_time
        return elapsed < threshold_seconds
    
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

        # ⏱️ 타임아웃 체크 태스크 (1초 간격)
        async def _timeout_check_loop():
            """타임아웃만 체크하는 루프"""
            # logger.info("⏱️ [타임아웃 체크 루프 시작]")
            try:
                while self.is_active:
                    await asyncio.sleep(1.0)
                    
                    # 타임아웃 체크만 수행
                    event_type, breakdown = check_timeout(self._signals)
                    
                    if event_type == "max_time_warning":
                        if breakdown.get("max_time_exceeded"):
                            logger.info(f"🔴 [타임아웃] 통화 시간 초과 ({breakdown.get('call_duration_sec', 0)}초) - 종료")
                        else:
                            logger.info(f"⚠️ [타임아웃] 통화 시간 임박 - 경고 전송 ({breakdown.get('max_time_warning', '')})")
                        
                        await self.results_queue.put({"event": "max_time_warning"})
                        if breakdown.get("max_time_exceeded"):
                            return
            except Exception as e:
                logger.error(f"❌ 타임아웃 체크 루프 오류: {e}")
                import traceback
                logger.error(f"상세 오류: {traceback.format_exc()}")

        self._timeout_task = asyncio.create_task(_timeout_check_loop())
        # logger.info("✅ [타임아웃 체크 태스크 생성 완료]")

        # logger.info("🎤 RTZR 실시간 스트리밍 시작")
        
        try:
            # RTZR 스트리밍 태스크 생성
            rtzr_stream_task = asyncio.create_task(
                self._consume_rtzr_stream()
            )
            
            # 통합된 결과 스트림 처리 (STT 결과 + 종료 판단 이벤트)
            while self.is_active:
                try:
                    # results_queue에서 이벤트 대기 (0.1초 타임아웃)
                    result = await asyncio.wait_for(
                        self.results_queue.get(),
                        timeout=0.1
                    )
                    
                    if result:
                        yield result
                        
                except asyncio.TimeoutError:
                    # 타임아웃은 정상 (큐가 비어있을 때)
                    continue
                except Exception as e:
                    logger.error(f"❌ 결과 큐 처리 오류: {e}")
                    break
        
        except Exception as e:
            logger.error(f"❌ RTZR 스트리밍 오류: {e}")
        finally:
            self.is_active = False
            if rtzr_stream_task and not rtzr_stream_task.done():
                rtzr_stream_task.cancel()
            if self._timeout_task:
                try:
                    self._timeout_task.cancel()
                except Exception:
                    pass
            # logger.info("🛑 RTZR 실시간 스트리밍 종료")
    
    async def _consume_rtzr_stream(self):
        """RTZR STT 결과를 소비해서 results_queue에 넣기"""
        try:
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

                        # ✅ 리셋 전에 사용자 발화 시작 시간 저장 (메트릭 수집용)
                        saved_streaming_start_time = self.streaming_start_time
                        
                        # # 🔔 종료 판단 신호 업데이트
                        # current_time = time.time()
                        # self._signals.last_user_speech_time = current_time
                        # self._signals.last_utterance_time = current_time  # 발화 시각 기록 (키워드 시효 판단용)
                        # self._signals.last_user_utterance = text
                        # if is_short_ack(text):
                        #     self._signals.short_ack_count += 1
                        # else:
                        #     self._signals.short_ack_count = 0
                        
                        await self.results_queue.put({
                            'text': text,
                            'is_final': True,
                            'partial_only': False,
                            'user_speech_start_time': saved_streaming_start_time  # 사용자 발화 시작 시간 포함
                        })
                        
                        # 발화 완료 - 버퍼 초기화 및 시간 리셋
                        self.partial_buffer.reset()
                        self.streaming_start_time = None
                        self.first_partial_time = None
                        self.last_partial_time = None
                    else:
                        # 부분 결과 - 첫 부분 인식 시 발화 시작 시간 기록
                        current_time = time.time()
                        if not self.streaming_start_time:
                            self.streaming_start_time = current_time
                            # logger.info(f"🎤 [발화 시작] 첫 부분 인식: {text}")
                        
                        # 마지막 부분 결과 시간 업데이트 (사용자 발화 중 체크용)
                        self.last_partial_time = current_time
                        
                        self.partial_buffer.add_partial(text)
                        
                        await self.results_queue.put({
                            'text': text,
                            'is_final': False,
                            'partial_only': True
                        })
        
        except Exception as e:
            logger.error(f"❌ RTZR 스트림 소비 오류: {e}")
    
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

    # # ===== 종료 판단 신호 업데이트용 헬퍼 =====
    # def update_conversation_history(self, conversation_history: list):
    #     """
    #     외부에서 대화 기록 업데이트 (LLM 종료 판단용)
        
    #     Args:
    #         conversation_history: 대화 기록 리스트
    #     """
    #     self._conversation_history = conversation_history


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
