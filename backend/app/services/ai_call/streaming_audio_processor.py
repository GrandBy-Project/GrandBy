"""
Streaming Audio Processor
실시간 STT 스트리밍을 위한 완전히 새로운 오디오 처리기

기존 AudioProcessor와의 차이점:
- 버퍼링 최소화 (침묵 감지 불필요)
- 오디오를 즉시 STT 스트림에 전송
- TTS 재생 상태 관리 (에코 방지)
"""

import logging
import audioop
from typing import Optional
from app.services.ai_call.streaming_stt_manager import StreamingSTTSession

logger = logging.getLogger(__name__)


class StreamingAudioProcessor:
    """
    실시간 STT 스트리밍용 오디오 프로세서

    기존 방식 (chunk-based):
    - 오디오 버퍼링 → 침묵 감지 → 전체 전송 → STT

    새 방식 (streaming):
    - 오디오 수신 → 즉시 STT 스트림 전송 → 실시간 결과
    """

    def __init__(self, call_sid: str):
        self.call_sid = call_sid

        # STT 세션
        self.stt_session: Optional[StreamingSTTSession] = None

        # TTS 재생 상태 (에코 방지)
        self.is_bot_speaking = False
        self.bot_silence_delay = 0  # TTS 종료 후 대기 카운터

        # 초기화 대기
        self.warmup_chunks = 0
        self.warmup_threshold = 25  # 처음 0.5초(25*20ms) 무시

        # 통계
        self.total_chunks_received = 0
        self.total_chunks_processed = 0
        self.total_chunks_ignored = 0

        logger.info(f"🎙️ [StreamingAudioProcessor] 초기화 - Call: {call_sid}")

    async def initialize_stt(self):
        """STT 세션 초기화"""
        try:
            self.stt_session = StreamingSTTSession(self.call_sid)
            await self.stt_session.initialize()
            logger.info(f"✅ [StreamingAudioProcessor] STT 세션 초기화 완료")
        except Exception as e:
            logger.error(f"❌ [StreamingAudioProcessor] STT 초기화 실패: {e}")
            raise

    async def add_audio_chunk(self, audio_data: bytes):
        """
        Twilio에서 수신한 오디오 청크 처리

        Args:
            audio_data: mulaw 포맷 오디오 (Twilio, 20ms 청크)
        """
        self.total_chunks_received += 1

        # 1. 워밍업 단계 (초기 잡음 무시)
        self.warmup_chunks += 1
        if self.warmup_chunks <= self.warmup_threshold:
            if self.warmup_chunks == 1:
                logger.info("⏳ [StreamingAudioProcessor] 오디오 초기화 중...")
            self.total_chunks_ignored += 1
            return

        # 2. TTS 재생 중 에코 방지
        if self.is_bot_speaking or self.bot_silence_delay > 0:
            if self.bot_silence_delay > 0:
                self.bot_silence_delay -= 1
                if self.bot_silence_delay == 0:
                    logger.info("✅ [EchoProtection] AI 응답 종료 후 대기 완료")

            self.total_chunks_ignored += 1
            return

        # 3. STT 스트림에 즉시 전송
        if self.stt_session:
            await self.stt_session.add_audio(audio_data)
            self.total_chunks_processed += 1

            # 통계 로깅 (50개마다 = 1초마다)
            if self.total_chunks_processed % 50 == 0:
                logger.info(f"📊 [Audio] STT로 전달: {self.total_chunks_processed}개 "
                           f"({self.total_chunks_processed * 0.02:.1f}초)")

    def start_bot_speaking(self):
        """
        AI 응답 시작 - 사용자 입력 차단 (에코 방지)
        """
        logger.info("🤖 [EchoProtection] AI 응답 중 - 사용자 입력 차단")
        self.is_bot_speaking = True

    def stop_bot_speaking(self):
        """
        AI 응답 종료 - 1초 대기 후 사용자 입력 재개
        """
        self.is_bot_speaking = False
        self.bot_silence_delay = 50  # 50개 청크 = 1초
        logger.info("🤖 [EchoProtection] AI 응답 종료 - 1초 후 사용자 입력 재개")

    def get_full_transcript(self) -> str:
        """
        전체 대화 내용 가져오기

        Returns:
            str: 전체 대화 텍스트
        """
        if self.stt_session:
            return self.stt_session.get_full_transcript()
        return ""

    async def close(self):
        """세션 종료"""
        if self.stt_session:
            await self.stt_session.close()

        logger.info(f"🛑 [StreamingAudioProcessor] 종료 - "
                   f"수신: {self.total_chunks_received}개, "
                   f"처리: {self.total_chunks_processed}개, "
                   f"무시: {self.total_chunks_ignored}개")

    def get_stats(self) -> dict:
        """
        통계 정보 반환

        Returns:
            dict: 통계
        """
        stats = {
            'call_sid': self.call_sid,
            'is_bot_speaking': self.is_bot_speaking,
            'total_chunks_received': self.total_chunks_received,
            'total_chunks_processed': self.total_chunks_processed,
            'total_chunks_ignored': self.total_chunks_ignored,
            'processing_rate': round(self.total_chunks_processed / max(self.total_chunks_received, 1) * 100, 2)
        }

        if self.stt_session:
            stats.update(self.stt_session.get_stats())

        return stats
