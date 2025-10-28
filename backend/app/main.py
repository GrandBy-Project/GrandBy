"""
Grandby FastAPI Application
메인 애플리케이션 진입점
"""

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Form, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from pydantic import BaseModel
from contextlib import asynccontextmanager
import logging
import json
import base64
import asyncio
import os
import tempfile
from typing import Dict, Optional
import audioop
from datetime import datetime
from sqlalchemy.orm import Session
import time

from twilio.twiml.voice_response import VoiceResponse, Connect, Stream

from app.routers import auth, users, calls, diaries, todos, notifications, dashboard
from app.config import settings, is_development
from app.database import test_db_connection, get_db
from app.services.ai_call.stt_service import STTService
from app.services.ai_call.tts_service import TTSService
from app.services.ai_call.cartesia_tts_service import cartesia_tts_service
from app.services.ai_call.llm_service import LLMService
from app.services.ai_call.twilio_service import TwilioService
from app.services.ai_call.rtzr_stt_realtime import RTZRRealtimeSTT, LLMPartialCollector

# 로거 설정 (시간 포함)
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# OpenAI 클라이언트 및 서비스 초기화
stt_service = STTService()
tts_service = TTSService()
llm_service = LLMService()

# WebSocket 연결 및 대화 세션 관리
active_connections: Dict[str, WebSocket] = {}
conversation_sessions: Dict[str, list] = {}
saved_calls: set = set()  # 중복 저장 방지용 플래그


# ==================== 통화 세션 관리 클래스 ====================

class CallSession:
    """통화 세션 관리 클래스 - Cartesia WebSocket 연결 재사용"""
    
    def __init__(self, call_sid: str, stream_sid: str):
        self.call_sid = call_sid
        self.stream_sid = stream_sid
        self.cartesia_ws = None
        self.context_id = None
        self.is_connected = False
        self.connection_task = None
        
    async def initialize_cartesia_connection(self):
        """통화 시작 시 Cartesia WebSocket 연결 생성"""
        try:
            access_token = await cartesia_tts_service._get_access_token()
            ws_url = f"wss://api.cartesia.ai/tts/websocket?api_key={access_token}&cartesia_version=2025-04-16"
            
            import websockets
            self.cartesia_ws = await websockets.connect(
                ws_url,
                ping_interval=20,
                ping_timeout=10
            )
            self.context_id = f"ctx_{self.stream_sid}_{int(time.time() * 1000)}"
            self.is_connected = True
            
            # 연결 상태 모니터링 백그라운드 태스크 시작
            self.connection_task = asyncio.create_task(self._monitor_connection())
            
            logger.info(f"✅ Cartesia WebSocket 연결 생성 완료: {self.call_sid}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Cartesia WebSocket 연결 실패: {e}")
            self.is_connected = False
            return False
    
    async def _monitor_connection(self):
        """WebSocket 연결 상태 모니터링"""
        try:
            while self.is_connected:
                await asyncio.sleep(30)  # 30초마다 확인
                if self.cartesia_ws:
                    await self.cartesia_ws.ping()
        except Exception as e:
            logger.warning(f"⚠️ WebSocket 연결 모니터링 실패: {e}")
            self.is_connected = False
    
    async def close(self):
        """통화 종료 시 연결 정리"""
        self.is_connected = False
        if self.connection_task:
            self.connection_task.cancel()
        if self.cartesia_ws:
            await self.cartesia_ws.close()
        logger.info(f"🔄 Cartesia WebSocket 연결 종료: {self.call_sid}")

# 전역 세션 관리
call_sessions: Dict[str, CallSession] = {}


# ==================== 대화 내용 DB 저장 함수 ====================

async def save_conversation_to_db(call_sid: str, conversation: list):
    """
    대화 내용을 DB에 저장하는 공통 함수
    
    Args:
        call_sid: Twilio Call SID
        conversation: 대화 내용 리스트 [{"role": "user", "content": "..."}, ...]
    """
    # 이미 저장되었으면 스킵 (중복 방지)
    if call_sid in saved_calls:
        logger.info(f"⏭️  이미 저장된 통화: {call_sid}")
        return
    
    # 저장할 내용이 없으면 스킵
    if not conversation or len(conversation) == 0:
        logger.warning(f"⚠️  저장할 대화 내용이 없음: {call_sid}")
        return
    
    logger.info(f"💾 대화 기록 저장 시작: {len(conversation)}개 메시지")
    
    try:
        from app.models.call import CallLog, CallTranscript, CallStatus
        db = next(get_db())
        
        # 1. CallLog 업데이트 (대화 요약)
        call_log_db = db.query(CallLog).filter(CallLog.call_id == call_sid).first()
        
        if call_log_db:
            # LLM 요약 생성 (대화가 있는 경우에만)
            if len(conversation) > 0:
                logger.info("🤖 LLM으로 통화 요약 생성 중...")
                summary = llm_service.summarize_call_conversation(conversation)
                call_log_db.conversation_summary = summary
                logger.info(f"✅ 요약 생성 완료: {summary[:100]}...")
            
            db.commit()
            logger.info(f"✅ CallLog 업데이트 완료")
        else:
            logger.warning(f"⚠️  CallLog를 찾을 수 없음: {call_sid}")
        
        # 2. CallTranscript 저장 (화자별 대화 내용)
        for idx, message in enumerate(conversation):
            speaker = "ELDERLY" if message["role"] == "user" else "AI"
            
            transcript = CallTranscript(
                call_id=call_sid,
                speaker=speaker,
                text=message["content"],
                timestamp=idx * 10.0,  # 대략적인 타임스탬프 (10초 간격)
                created_at=datetime.utcnow()
            )
            db.add(transcript)
        
        db.commit()
        logger.info(f"✅ 대화 내용 {len(conversation)}개 저장 완료")
        
        # 저장 성공 플래그 설정
        saved_calls.add(call_sid)
        
        # # ✅ 일기 자동 생성 트리거
        # try:
        #     from app.tasks.diary_generator import generate_diary_from_call
        #     generate_diary_from_call.delay(call_sid)
        #     logger.info(f"📝 일기 자동 생성 작업 예약: {call_sid}")
        # except Exception as e:
        #     logger.error(f"❌ 일기 생성 작업 예약 실패: {e}")
        
        db.close()
        
    except Exception as e:
        logger.error(f"❌ DB 저장 실패: {e}")
        import traceback
        logger.error(traceback.format_exc())
        if 'db' in locals():
            db.rollback()
            db.close()


# ==================== AudioProcessor ====================

class AudioProcessor:
    """
    오디오 처리 클래스 - 실시간 오디오 버퍼링 및 침묵 감지 (동적 임계값)
    
    Twilio에서 수신한 mulaw 오디오를 버퍼링하고,
    침묵을 감지하여 STT 처리 시점을 결정합니다.
    
    배경 소음 레벨을 자동으로 측정하여 임계값을 동적으로 조정합니다.
    """
    
    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.audio_buffer = []  # 오디오 청크 버퍼 (이제 PCM 데이터 저장)
        self.transcript_buffer = []  # 실시간 STT 결과 버퍼
        self.is_speaking = False  # 사용자가 말하고 있는지 여부
        
        # ========== PCM 기반 동적 임계값 설정 ==========
        # PCM RMS 값은 μ-law보다 훨씬 큼 (16-bit vs 8-bit)
        self.base_silence_threshold = 1000  # 기본 임계값 (PCM 16-bit 기준)
        self.silence_threshold = 1000  # 현재 임계값 (동적으로 변경됨)
        
        # 배경 소음 측정
        self.noise_samples = []  # 배경 소음 RMS 샘플
        self.noise_calibration_chunks = 50  # 처음 1초(50*20ms) 동안 배경 소음 측정
        self.is_calibrated = False  # 보정 완료 여부
        self.background_noise_level = 0  # 측정된 배경 소음 레벨
        
        # 적응형 조정 설정 (PCM 값에 맞게 조정)
        self.noise_margin = 200  # 배경 소음 + 마진 = 임계값 (PCM 기준)
        self.min_threshold = 500  # 최소 임계값 (PCM 기준)
        self.max_threshold = 5000  # 최대 임계값 (PCM 기준)
        # ======================================
        
        self.silence_duration = 0  # 현재 침묵 지속 시간
        self.max_silence = 0.5  # ⭐ 1.5초 침묵 후 STT 처리 (충분한 발화 수집)

        # 초기 노이즈 필터링
        self.warmup_chunks = 0  # 받은 청크 수
        self.warmup_threshold = 25  # 처음 0.5초 무시
        
        # 연속 음성 감지
        self.voice_chunks = 0  # 연속 음성 감지 카운터
        self.voice_threshold = 3  # 최소 3번 연속 감지
        
        # TTS 재생 상태 (에코 방지)
        self.is_bot_speaking = False
        self.bot_silence_delay = 0
        
        # 통계 정보 (디버깅용)
        self.rms_history = []  # 최근 RMS 기록
        self.max_rms_history = 100  # 최근 100개만 유지
    
    def _calibrate_noise_level(self, rms: float):
        """
        배경 소음 레벨 자동 보정 (PCM 기준)
        
        통화 시작 후 처음 1초 동안 수신한 RMS 값들의 평균을 
        배경 소음 레벨로 설정합니다.
        
        Args:
            rms: 현재 청크의 RMS 값 (PCM 16-bit)
        """
        if not self.is_calibrated:
            # 비정상적으로 큰 값은 제외 (연결음 등) - PCM 기준으로 조정
            if rms < 10000:  # PCM 16-bit 기준으로 조정
                self.noise_samples.append(rms)
            
            # 충분한 샘플이 모이면 평균 계산
            if len(self.noise_samples) >= self.noise_calibration_chunks:
                self.background_noise_level = sum(self.noise_samples) / len(self.noise_samples)
                
                # 동적 임계값 설정: 배경 소음 + 마진
                calculated_threshold = self.background_noise_level + self.noise_margin
                
                # 최소/최대 범위 내로 제한
                self.silence_threshold = max(
                    self.min_threshold,
                    min(self.max_threshold, calculated_threshold)
                )
                
                self.is_calibrated = True
                
                logger.info(f"🎚️  [배경 소음 보정 완료]")
                logger.info(f"   📊 배경 소음 레벨: {self.background_noise_level:.1f}")
                logger.info(f"   🎯 조정된 임계값: {self.silence_threshold:.1f} (기본: {self.base_silence_threshold})")
                logger.info(f"   📈 샘플 수: {len(self.noise_samples)}개")
    
    def _update_threshold_adaptive(self, rms: float):
        """
        실시간 적응형 임계값 조정 (PCM 기준)
        
        대화 중에도 RMS 통계를 기반으로 임계값을 미세 조정합니다.
        배경 소음이 변화하는 환경(예: 이동 중 통화)에 유용합니다.
        
        Args:
            rms: 현재 청크의 RMS 값 (PCM 16-bit)
        """
        # RMS 기록 저장
        self.rms_history.append(rms)
        if len(self.rms_history) > self.max_rms_history:
            self.rms_history.pop(0)
        
        # 100개 샘플마다 재조정 (약 2초마다)
        if len(self.rms_history) >= self.max_rms_history and len(self.rms_history) % 50 == 0:
            # 하위 30% 값들의 평균 (배경 소음으로 추정)
            sorted_rms = sorted(self.rms_history)
            lower_30_percent = sorted_rms[:30]
            estimated_noise = sum(lower_30_percent) / len(lower_30_percent)
            
            # 임계값 재조정 (서서히 적응)
            new_threshold = estimated_noise + self.noise_margin
            new_threshold = max(self.min_threshold, min(self.max_threshold, new_threshold))
            
            # 큰 변화가 있을 때만 업데이트 (±500 이상) - PCM 기준으로 조정
            if abs(new_threshold - self.silence_threshold) > 500:
                old_threshold = self.silence_threshold
                self.silence_threshold = new_threshold
                logger.info(f"🔄 임계값 적응: {old_threshold:.1f} → {new_threshold:.1f} (추정 소음: {estimated_noise:.1f})")
    
    def get_calibration_status(self) -> dict:
        """
        보정 상태 정보 반환 (디버깅/모니터링용)
        
        Returns:
            dict: 보정 관련 통계 정보
        """
        return {
            "is_calibrated": self.is_calibrated,
            "background_noise_level": round(self.background_noise_level, 2),
            "current_threshold": round(self.silence_threshold, 2),
            "base_threshold": self.base_silence_threshold,
            "samples_collected": len(self.noise_samples),
            "rms_history_size": len(self.rms_history)
        }

    def add_audio_chunk(self, audio_data: bytes):
        """오디오 청크 추가 및 음성 활동 감지 (PCM 기반 동적 임계값 적용)"""
        # μ-law → PCM 변환 (실시간)
        try:
            pcm_data = audioop.ulaw2lin(audio_data, 2)  # 16-bit PCM으로 변환
            self.audio_buffer.append(pcm_data)
        except Exception as e:
            logger.error(f"❌ μ-law → PCM 변환 실패: {e}")
            return
        
        # 워밍업: 초기 청크 무시 (연결 노이즈 방지)
        self.warmup_chunks += 1
        if self.warmup_chunks <= self.warmup_threshold:
            if self.warmup_chunks == 1:
                logger.info("⏳ 오디오 초기화 및 배경 소음 측정 중...")
            return
        
        # AI가 말하는 동안 + 종료 후 1초간 사용자 입력 무시 (에코 방지)
        if self.is_bot_speaking or self.bot_silence_delay > 0:
            if self.bot_silence_delay > 0:
                self.bot_silence_delay -= 1
                if self.bot_silence_delay == 0:
                    logger.info("✅ AI 응답 종료 후 대기 완료, 사용자 입력 재개")
            return
        
        # RMS 계산 (PCM 16-bit 기준)
        rms = audioop.rms(pcm_data, 2)  # 2바이트 샘플 폭
        
        # ========== 동적 임계값 기능 ==========
        # 1. 배경 소음 보정 (처음 1초)
        if not self.is_calibrated:
            self._calibrate_noise_level(rms)
            return  # 보정 완료 전까지는 음성 감지 안함
        
        # 2. 실시간 적응형 조정 (선택적, 주석 해제하여 활성화)
        # self._update_threshold_adaptive(rms)
        # ======================================
        
        # 비정상적으로 큰 RMS 값 필터링 (PCM 기준으로 조정)
        if rms > 20000:  # PCM 16-bit 기준으로 조정
            logger.warning(f"⚠️  비정상적인 RMS 무시: {rms}")
            self.voice_chunks = 0
            return
        
        # 음성 활동 감지 (동적 임계값 사용)
        if rms > self.silence_threshold:
            self.voice_chunks += 1
            
            # 연속으로 여러 번 감지되어야 음성으로 인정
            if self.voice_chunks >= self.voice_threshold:
                if not self.is_speaking:
                    logger.info(f"🎤 [음성 감지] 말하기 시작 (RMS: {rms:.1f}, 임계값: {self.silence_threshold:.1f})")
                self.is_speaking = True
                self.silence_duration = 0
        else:
            # 조용하면 음성 카운터 리셋
            self.voice_chunks = 0
            
            # 이전에 말하고 있었다면 침묵 카운터 증가
            if self.is_speaking:
                if self.silence_duration == 0:
                    logger.info(f"🔇 [침묵 감지] 말을 멈춤 (RMS: {rms:.1f})")
                
                self.silence_duration += 0.02  # 20ms per chunk
                
                # 침묵 진행 상황 (0.5초마다)
                if int(self.silence_duration * 10) % 5 == 0:
                    logger.debug(f"⏱️  침묵: {self.silence_duration:.1f}초 / {self.max_silence}초")
                
    def should_process(self) -> bool:
        """오디오 처리가 필요한지 확인 (사용자가 말을 멈췄는지)"""
        return (self.is_speaking and
                self.silence_duration >= self.max_silence and 
                len(self.audio_buffer) > 0)
    
    def get_audio(self) -> bytes:
        """
        버퍼링된 오디오 가져오기 및 초기화
        
        Returns:
            bytes: 병합된 오디오 데이터 (PCM 포맷)
        """
        audio = b''.join(self.audio_buffer)
        self.audio_buffer = []
        self.is_speaking = False
        self.silence_duration = 0
        return audio
    
    def add_transcript(self, text: str):
        """
        실시간 변환된 텍스트를 버퍼에 추가
        
        Args:
            text: 변환된 텍스트
        """
        if text and text.strip():
            self.transcript_buffer.append(text)
            logger.debug(f"📝 텍스트 버퍼 추가: {len(self.transcript_buffer)}개 문장")
    
    def get_full_transcript(self) -> str:
        """
        전체 대화 내용 가져오기
        
        Returns:
            str: 공백으로 결합된 전체 대화 텍스트
        """
        return " ".join(self.transcript_buffer)
    
    def start_bot_speaking(self):
        """AI 응답 시작 - 사용자 입력 차단 (에코 방지)"""
        logger.info("🤖 [에코 방지] AI 응답 중 - 사용자 입력 차단")
        self.is_bot_speaking = True
        # 기존 상태 초기화
        self.is_speaking = False
        self.voice_chunks = 0
        self.silence_duration = 0
    
    def stop_bot_speaking(self):
        """AI 응답 종료 - 1초 대기 후 사용자 입력 재개"""
        self.bot_silence_delay = 50  # 50개 청크 = 1초 대기
        self.is_bot_speaking = False
        logger.info("🤖 [에코 방지] AI 응답 종료 - 1초 후 사용자 입력 재개")
    
    def remove_silence(self, audio_data: bytes) -> bytes:
        """
        오디오 데이터에서 무음 구간 제거 (PCM 기준)
        
        Args:
            audio_data: PCM 포맷 오디오 데이터
        
        Returns:
            bytes: 무음이 제거된 오디오 데이터
        """
        try:
            # 청크 크기 (20ms = 320 bytes at 8kHz PCM 16-bit)
            chunk_size = 320  # 8kHz * 20ms * 2 bytes
            voice_chunks = []
            
            # 동적 임계값 사용 (calibration 완료 후)
            threshold = self.silence_threshold if self.is_calibrated else self.base_silence_threshold
            
            # 청크 단위로 RMS 계산하여 음성 구간만 추출
            for i in range(0, len(audio_data), chunk_size):
                chunk = audio_data[i:i + chunk_size]
                
                # 마지막 청크가 작을 수 있으므로 체크
                if len(chunk) < chunk_size:
                    break
                
                # RMS 계산 (PCM 16-bit)
                try:
                    rms = audioop.rms(chunk, 2)  # 2바이트 샘플 폭
                    
                    # 임계값보다 큰 경우에만 포함 (음성 구간)
                    if rms > threshold:
                        voice_chunks.append(chunk)
                except Exception as e:
                    logger.debug(f"RMS 계산 오류, 청크 건너뜀: {e}")
                    continue
            
            if not voice_chunks:
                logger.warning("⚠️  무음 제거 후 남은 오디오 없음")
                return audio_data  # 원본 반환
            
            # 음성 청크들을 결합
            cleaned_audio = b''.join(voice_chunks)
            
            reduction_percent = (1 - len(cleaned_audio) / len(audio_data)) * 100
            logger.info(f"🎚️  무음 제거: {len(audio_data)} → {len(cleaned_audio)} bytes ({reduction_percent:.1f}% 감소)")
            
            return cleaned_audio
            
        except Exception as e:
            logger.error(f"❌ 무음 제거 중 오류: {e}")
            return audio_data  # 오류 시 원본 반환


# ==================== Helper Functions ====================

async def transcribe_audio_realtime(audio_data: bytes, audio_processor=None) -> tuple[str, float]:
    """
    실시간 오디오를 텍스트로 변환 (PCM 기반)
    
    이제 audio_data는 이미 PCM 포맷이므로 추가 변환 불필요
    
    Args:
        audio_data: PCM 오디오 데이터 (16-bit)
        audio_processor: AudioProcessor 인스턴스 (무음 제거용)
    
    Returns:
        tuple: (변환된 텍스트, 실행 시간)
    """
    try:
        import wave
        import io
        
        # ✅ 무음 제거 (AudioProcessor가 제공된 경우)
        if audio_processor:
            # audio_data = audio_processor.remove_silence(audio_data)
            
            # 무음 제거 후 데이터가 너무 짧으면 스킵
            if len(audio_data) < 1600:  # 최소 0.1초 (320 bytes * 5)
                logger.debug("⏭️  오디오 데이터가 너무 짧음, STT 스킵")
                return "", 0
        
        # PCM 데이터를 WAV 포맷으로 변환 (메모리 내)
        logger.info(f"🔍 [STT 디버그] PCM 데이터 크기: {len(audio_data)} bytes")
        
        try:
            wav_io = io.BytesIO()
            
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)      # Mono
                wav_file.setsampwidth(2)      # 16-bit (2 bytes)
                wav_file.setframerate(8000)   # 8kHz
                wav_file.writeframes(audio_data)  # 이미 PCM 데이터
            
            wav_data = wav_io.getvalue()
            logger.info(f"✅ [STT 디버그] WAV 변환 완료: {len(wav_data)} bytes")
            
        except Exception as wav_error:
            logger.error(f"❌ [STT 디버그] WAV 변환 실패: {wav_error}")
            logger.error(f"   - PCM 데이터 크기: {len(audio_data)}")
            logger.error(f"   - PCM 데이터 타입: {type(audio_data)}")
            return "", 0
        
        # 실시간 STT 변환 (비동기 처리)
        logger.info(f"🎤 [STT 디버그] STT 서비스 호출 시작...")
        try:
            transcript, stt_time = await stt_service.transcribe_audio_chunk(
                wav_data,
                language="ko"
            )
            logger.info(f"✅ [STT 디버그] STT 서비스 응답 완료: '{transcript[:50]}...' ({stt_time:.2f}초)")
        except Exception as stt_error:
            logger.error(f"❌ [STT 디버그] STT 서비스 호출 실패: {stt_error}")
            logger.error(f"   - WAV 데이터 크기: {len(wav_data)}")
            import traceback
            logger.error(f"   - 상세 오류: {traceback.format_exc()}")
            return "", 0
        
        return transcript, stt_time
        
    except Exception as e:
        logger.error(f"❌ 실시간 음성 인식 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return "", 0


async def convert_and_send_audio(websocket: WebSocket, stream_sid: str, text: str) -> float:
    """
    단일 문장을 TTS 변환하고 Twilio로 즉시 전송 (병렬 처리용)
    
    이 함수는 LLM 스트리밍 중 문장이 완성될 때마다 호출됩니다.
    사용자는 AI가 말하는 것을 거의 실시간으로 들을 수 있습니다.
    
    처리 플로우:
    1. 문장 TTS 변환 (비동기)
    2. WAV → mulaw 변환
    3. Base64 인코딩
    4. Twilio WebSocket으로 전송
    
    Args:
        websocket: Twilio WebSocket 연결
        stream_sid: Twilio Stream SID
        text: 변환할 문장
    
    Returns:
        float: 이 문장의 예상 재생 시간 (초)
    """
    try:
        import wave
        import io
        
        # 1. TTS 변환 (문장 단위, 비동기)
        audio_data, tts_time = await cartesia_tts_service.text_to_speech_sentence(text)
        
        if not audio_data:
            logger.warning(f"⚠️ TTS 변환 실패, 건너뜀: {text[:30]}...")
            return 0.0
        
        # 2. WAV → mulaw 변환 (Twilio 호환)
        wav_io = io.BytesIO(audio_data)
        with wave.open(wav_io, 'rb') as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            framerate = wav_file.getframerate()
            pcm_data = wav_file.readframes(wav_file.getnframes())
        
        # Stereo → Mono 변환 (필요 시)
        if channels == 2:
            pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)
        
        # 샘플레이트 변환: Twilio는 8kHz 요구
        if framerate != 8000:
            pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, 8000, None)
        
        # PCM → mulaw 변환
        mulaw_data = audioop.lin2ulaw(pcm_data, 2)
        
        # ⭐ 재생 시간 계산 (mulaw 8kHz: 1초 = 8000 bytes)
        playback_duration = len(mulaw_data) / 8000.0
        
        # 3. Base64 인코딩
        audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
        
        # 4. Twilio로 청크 단위 전송
        chunk_size = 8000  # 8KB 청크
        for i in range(0, len(audio_base64), chunk_size):
            chunk = audio_base64[i:i + chunk_size]
            
            message = {
                "event": "media",
                "streamSid": stream_sid,
                "media": {
                    "payload": chunk
                }
            }
            
            await websocket.send_text(json.dumps(message))
            await asyncio.sleep(0.02)  # 부드러운 재생을 위한 작은 지연
        
        logger.info(f"✅ 문장 전송 완료 ({tts_time:.2f}초, 재생: {playback_duration:.2f}초): {text[:30]}...")
        
        return playback_duration  # 재생 시간 반환
        
    except Exception as e:
        logger.error(f"❌ 오디오 변환/전송 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0.0


async def process_fallback_response(
    websocket: WebSocket,
    stream_sid: str,
    user_text: str,
    audio_processor=None
) -> str:
    """폴백 모드 - 기존 방식으로 처리"""
    logger.warning("🔄 폴백 모드: 기존 방식으로 처리")
    
    try:
        # 기존의 단순한 TTS 방식 사용
        response_text = await llm_service.generate_response(user_text, [])
        
        if response_text:
            await send_audio_to_twilio_with_tts(websocket, stream_sid, response_text, audio_processor)
            return response_text
        
        return ""
    except Exception as e:
        logger.error(f"❌ 폴백 모드 처리 실패: {e}")
        return ""

async def process_streaming_response(
    websocket: WebSocket,
    stream_sid: str,
    user_text: str,
    conversation_history: list,
    audio_processor=None
) -> str:
    """
    최적화된 스트리밍 응답 처리 - 사전 연결된 WebSocket 사용
    
    핵심 개선:
    - 사전 연결된 Cartesia WebSocket 재사용
    - LLM 스트림을 두 갈래로 분리 (텍스트 수집 + TTS)
    """
    import audioop
    
    if audio_processor:
        audio_processor.start_bot_speaking()
    
    try:
        pipeline_start = time.time()
        full_response = []
        logger.info("=" * 60)
        logger.info("🚀 실시간 스트리밍 파이프라인 시작")
        logger.info("=" * 60)

        # call_sid 찾기 (stream_sid로부터)
        call_sid = None
        for cid, session in call_sessions.items():
            if session.stream_sid == stream_sid:
                call_sid = cid
                break
        
        if not call_sid or call_sid not in call_sessions:
            logger.error("❌ 통화 세션을 찾을 수 없음 - 폴백 모드 사용")
            return await process_fallback_response(websocket, stream_sid, user_text, audio_processor)
        
        session = call_sessions[call_sid]
        
        # WebSocket 연결 상태 확인
        if not session.is_connected or session.cartesia_ws is None:
            logger.warning("⚠️ WebSocket 연결이 끊어짐 - 재연결 시도")
            connection_success = await session.initialize_cartesia_connection()
            if not connection_success:
                logger.error("❌ WebSocket 재연결 실패 - 폴백 모드 사용")
                return await process_fallback_response(websocket, stream_sid, user_text, audio_processor)
        
        logger.info("🚀 실시간 스트리밍 파이프라인 시작 (사전 연결된 WebSocket 사용)")
        
        # 사전 연결된 WebSocket 사용
        cartesia_ws = session.cartesia_ws
        
        # 병렬 태스크 생성
        # 1. LLM 텍스트 생성 + Cartesia 전송
        # 2. Cartesia 음성 수신 + Twilio 전송
        
        send_task = asyncio.create_task(
            llm_to_cartesia_sender(
                cartesia_ws,
                user_text,
                conversation_history,
                session.context_id,
                full_response,
                pipeline_start
            )
        )
        
        receive_task = asyncio.create_task(
            cartesia_to_twilio_forwarder(
                cartesia_ws,
                websocket,
                stream_sid,
                pipeline_start
            )
        )
        
        # 두 태스크 완료 대기
        send_result = await send_task
        playback_duration = await receive_task
        
        pipeline_time = time.time() - pipeline_start
        
        logger.info("=" * 60)
        logger.info(f"✅ 전체 파이프라인 완료: {pipeline_time:.2f}초")
        logger.info(f"   예상 재생 시간: {playback_duration:.2f}초")
        logger.info("=" * 60)
        
        # 재생 완료 대기
        if playback_duration > 0:
            await asyncio.sleep(playback_duration * 1.1)
        
        return "".join(full_response)
        
    except Exception as e:
        logger.error(f"❌ 실시간 스트리밍 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return ""
    finally:
        if audio_processor:
            audio_processor.stop_bot_speaking()

async def llm_to_cartesia_sender(
    cartesia_ws,
    user_text: str,
    conversation_history: list,
    context_id: str,
    full_response: list,
    pipeline_start: float
):
    """
    LLM 텍스트 생성 → Cartesia WebSocket 전송
    
    핵심: 문장이 완성되는 즉시 전송 (대기 없음)
    """
    import re

    llm_service = LLMService()
    
    try:
        sentence_buffer = ""
        chunk_count = 0
        sentence_count = 0
        first_sentence_sent = False
        
        logger.info("🤖 [LLM] 스트리밍 시작")
        
        async for chunk in llm_service.generate_response_streaming(user_text, conversation_history):
            chunk_count += 1
            sentence_buffer += chunk
            full_response.append(chunk)  # 전체 텍스트 수집
            
            # 문장 종료 감지
            should_send = False
            
            # 1. 명확한 문장 종료 (마침표, 느낌표, 물음표)
            if re.search(r'[.!?\n。！？]', chunk):
                should_send = True
            
            # 2. 쉼표로 자연스럽게 끊기 (긴 문장 방지)
            elif len(sentence_buffer) > 40 and re.search(r'[,，]', sentence_buffer[-5:]):
                should_send = True
            
            # 3. 너무 긴 문장 강제 분할 (80자 이상)
            elif len(sentence_buffer) > 80:
                should_send = True
            
            if should_send and sentence_buffer.strip():
                sentence = sentence_buffer.strip()
                sentence_count += 1
                
                elapsed = time.time() - pipeline_start
                
                if not first_sentence_sent:
                    logger.info(f"⚡ [첫 문장] +{elapsed:.2f}초에 생성 완료!")
                    first_sentence_sent = True
                
                logger.info(f"📤 [문장 {sentence_count}] 전송: {sentence[:40]}...")
                
                # Cartesia로 즉시 전송
                await cartesia_tts_service._send_text_chunk(
                    cartesia_ws,
                    sentence,
                    context_id,
                    continue_=True
                )
                
                sentence_buffer = ""
        
        # 마지막 문장 처리
        if sentence_buffer.strip():
            sentence_count += 1
            logger.info(f"📤 [마지막 문장 {sentence_count}] 전송: {sentence_buffer[:40]}...")
            
            await cartesia_tts_service._send_text_chunk(
                cartesia_ws,
                sentence_buffer.strip(),
                context_id,
                continue_=False  # 마지막 신호
            )
        
        logger.info(f"✅ [LLM] 총 {sentence_count}개 문장 전송 완료")
        
    except Exception as e:
        logger.error(f"❌ LLM → Cartesia 전송 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())

async def cartesia_to_twilio_forwarder(
    cartesia_ws,
    twilio_ws: WebSocket,
    stream_sid: str,
    pipeline_start: float
) -> float:
    """
    Cartesia 음성 수신 → Twilio 즉시 전송
    
    핵심: 청크 받는 즉시 전송 (버퍼링 없음)
    
    Returns:
        float: 총 재생 시간
    """
    import audioop
    import base64
    
    try:
        chunk_count = 0
        total_audio_bytes = 0
        first_audio_received = False
        
        logger.info("📡 [수신] Cartesia 음성 청크 대기 중...")
        
        async for message in cartesia_ws:
            try:
                data = json.loads(message)
                
                # 오디오 청크 수신
                if "data" in data:
                    chunk_count += 1
                    
                    elapsed = time.time() - pipeline_start
                    
                    if not first_audio_received:
                        logger.info(f"⚡ [첫 음성] +{elapsed:.2f}초에 수신 시작!")
                        first_audio_received = True
                    
                    # Base64 디코딩 (Cartesia는 PCM 24kHz 반환)
                    audio_chunk = base64.b64decode(data["data"])
                    total_audio_bytes += len(audio_chunk)
                    
                    # PCM 24kHz → 8kHz 변환 (Twilio 요구사항)
                    resampled_pcm, _ = audioop.ratecv(
                        audio_chunk, 2, 1, 24000, 8000, None
                    )
                    
                    # PCM → mulaw 변환
                    mulaw_data = audioop.lin2ulaw(resampled_pcm, 2)
                    
                    # Base64 인코딩
                    audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
                    
                    # Twilio로 즉시 전송
                    message = {
                        "event": "media",
                        "streamSid": stream_sid,
                        "media": {"payload": audio_base64}
                    }
                    
                    await twilio_ws.send_text(json.dumps(message))
                    
                    if chunk_count % 10 == 0:
                        logger.debug(f"📤 [청크 {chunk_count}] Twilio 전송 완료")
                
                # 완료 신호
                elif data.get("done"):
                    logger.info(f"✅ [수신] Cartesia 음성 생성 완료 ({chunk_count}개 청크)")
                    break
                
                # 에러 처리
                elif "error" in data:
                    logger.error(f"❌ Cartesia 오류: {data['error']}")
                    break
                    
            except json.JSONDecodeError:
                logger.warning("⚠️ JSON 파싱 실패, 건너뜀")
                continue
        
        # 재생 시간 계산 (24kHz, 16-bit)
        playback_duration = total_audio_bytes / (24000 * 2)
        
        logger.info(f"✅ [전송] Twilio 전송 완료: {chunk_count}개 청크, {playback_duration:.2f}초")
        
        return playback_duration
        
    except Exception as e:
        logger.error(f"❌ Cartesia → Twilio 전송 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0.0


async def process_tts_and_send(
    websocket: WebSocket,
    stream_sid: str,
    index: int,
    sentence: str,
    completed_audio: dict,
    next_send_index: list,
    send_lock: asyncio.Lock,
    pipeline_start: float
) -> float:
    """
    TTS 변환 및 전송 (오디오 변환 병렬화)
    """
    try:
        tts_start = time.time()
        elapsed_start = tts_start - pipeline_start
        logger.info(f"🔊 [TTS] 문장[{index}] 변환 시작: {sentence[:30]}...")
        logger.info(f"⏰ [TTS] 문장[{index}] 실제 TTS 함수 진입 시간: +{elapsed_start:.2f}초")
        
        # TTS 변환 (타임아웃 10초)
        try:
            audio_data, tts_time = await asyncio.wait_for(
                cartesia_tts_service.text_to_speech_sentence(sentence),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            logger.error(f"문장[{index}] TTS 타임아웃")
            return 0.0
        
        # 🔑 추가: audio_data 유효성 검증 강화
        if not audio_data or not isinstance(audio_data, bytes) or len(audio_data) == 0:
            logger.warning(f"⚠️ 문장[{index}] TTS 실패 또는 빈 응답")
            logger.warning(f"    - audio_data 타입: {type(audio_data)}")
            logger.warning(f"    - audio_data 길이: {len(audio_data) if audio_data else 0}")
            return 0.0
        
        elapsed_tts_done = time.time() - pipeline_start
        logger.info(f"[+{elapsed_tts_done:.2f}초] 문장[{index}] TTS 완료 ({tts_time:.2f}초)")
        
        # 최적화: 오디오 변환을 별도 스레드로 처리 (CPU 집약적 작업)
        if len(audio_data) > 100000:
            loop = asyncio.get_event_loop()
            mulaw_data, playback_duration = await loop.run_in_executor(
                None,  # 기본 ThreadPoolExecutor 사용
                convert_to_mulaw_optimized,
                audio_data
            )
        else:
            mulaw_data, playback_duration = convert_to_mulaw_optimized(audio_data)
        
        # 완료된 오디오 저장
        completed_audio[index] = (mulaw_data, playback_duration)
        
        # 순서에 맞춰 전송
        await try_send_in_order(
            websocket, stream_sid,
            completed_audio, next_send_index, send_lock,
            pipeline_start
        )
        
        return playback_duration
        
    except Exception as e:
        logger.error(f"문장[{index}] 처리 오류: {e}")
        return 0.0


def convert_to_mulaw_optimized(audio_data: bytes) -> tuple[bytes, float]:
    """
    오디오 변환 최적화
    
    최적화 포인트:
    1. ✅ ThreadPool로 병렬 처리 (속도 향상)
    2. ✅ audioop 사용 유지 (음질 보장)
    """
    import wave
    import io
    import audioop
    
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
    
    if sample_width != 2:
        pcm_data = audioop.lin2lin(pcm_data, sample_width, 2)
        sample_width = 2
        logger.info(f"16-bit 변환 완료")
    
    if framerate != 8000:
        logger.info(f"샘플레이트 변환: {framerate}Hz → 8000Hz")
        pcm_data, _ = audioop.ratecv(
            pcm_data, sample_width, 1, framerate, 8000, None
        )
        logger.info(f"샘플레이트 변환 완료")

    mulaw_data = audioop.lin2ulaw(pcm_data, 2)
    playback_duration = len(mulaw_data) / 8000.0
    
    return mulaw_data, playback_duration


async def try_send_in_order(
    websocket: WebSocket,
    stream_sid: str,
    completed_audio: dict,
    next_send_index: list,
    send_lock: asyncio.Lock,
    pipeline_start: float
):
    """
    다음 순서의 오디오가 준비되면 전송
    
    핵심: 순서를 건너뛰지 않고 차례대로만 전송
    예: 1번 완료 → 전송, 3번 완료 → 대기, 2번 완료 → 2,3 연속 전송
    """
    async with send_lock:  # 동시 전송 방지
        # 다음 순서가 준비될 때까지 계속 전송
        while next_send_index[0] in completed_audio:
            index = next_send_index[0]
            mulaw_data, playback_duration = completed_audio[index]
            
            send_start = time.time()
            elapsed_send_start = send_start - pipeline_start
            logger.info(f"📤 [AUDIO] 문장[{index}] 음성 전송 시작")
            
            # Base64 인코딩 및 청크 단위 전송
            audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
            
            chunk_size = 8000  # 8KB 청크
            for i in range(0, len(audio_base64), chunk_size):
                chunk = audio_base64[i:i + chunk_size]
                
                message = {
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {"payload": chunk}
                }
                
                await websocket.send_text(json.dumps(message))
                await asyncio.sleep(0.02)  # 부드러운 재생
            
            elapsed_send_done = time.time() - pipeline_start
            logger.info(f"✅ [AUDIO] 문장[{index}] 음성 출력 종료 (재생: {playback_duration:.2f}초)")
            
            # 정리 및 다음 순서로 이동
            del completed_audio[index]
            next_send_index[0] += 1


async def _generate_welcome_audio_async(text: str) -> bytes:
    """환영 메시지 오디오를 미리 생성"""
    try:
        start_time = time.time()
        
        # 이미 준비된 토큰 사용
        access_token = await cartesia_tts_service._get_access_token()
        
        # 최적화된 HTTP 클라이언트 사용
        client = await cartesia_tts_service._get_http_client()
        
        response = await client.post(
            "https://api.cartesia.ai/tts/bytes",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cartesia-Version": "2025-04-16",
            },
            json={
                "model_id": cartesia_tts_service.model,
                "transcript": text,
                "voice": {
                    "mode": "id",
                    "id": cartesia_tts_service.voice
                },
                "language": "ko",
                "output_format": {
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": 24000
                }
            }
        )
        
        response.raise_for_status()
        pcm_data = response.content
        
        # 오디오 변환 (μ-law 변환은 필수이므로 유지)
        resampled_pcm, _ = audioop.ratecv(
            pcm_data, 2, 1, 24000, 8000, None
        )
        mulaw_data = audioop.lin2ulaw(resampled_pcm, 2)
        
        tts_time = time.time() - start_time
        logger.info(f"✅ [환영] 사전 생성 완료 ({tts_time:.2f}초)")
        
        return mulaw_data
        
    except Exception as e:
        logger.error(f"❌ 환영 메시지 사전 생성 실패: {e}")
        return None

async def _send_prepared_audio_to_twilio(
    websocket: WebSocket, 
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
        
        # Base64 인코딩 및 전송
        audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
        
        logger.info(f"📤 [환영] 즉시 전송: {len(mulaw_data)} bytes")
        
        # 청크 단위 전송 (지연 시간 단축)
        chunk_size = 8000
        for i in range(0, len(audio_base64), chunk_size):
            chunk = audio_base64[i:i + chunk_size]
            
            message = {
                "event": "media",
                "streamSid": stream_sid,
                "media": {"payload": chunk}
            }
            
            await websocket.send_text(json.dumps(message))
            await asyncio.sleep(0.01)  # 0.02초 → 0.01초로 단축
        
        logger.info(f"✅ [환영] 즉시 전송 완료")
        
    except Exception as e:
        logger.error(f"❌ 준비된 오디오 전송 실패: {e}")
    finally:
        if audio_processor:
            audio_processor.stop_bot_speaking()


async def send_audio_to_twilio_with_tts(websocket: WebSocket, stream_sid: str, text: str, audio_processor=None):
    """
    TTS Service를 사용하여 텍스트를 음성으로 변환 후 Twilio WebSocket으로 전송
    WAV → mulaw 변환 포함
    
    Args:
        websocket: Twilio WebSocket 연결
        stream_sid: Twilio Stream SID
        text: 변환할 텍스트
        audio_processor: AudioProcessor 인스턴스 (에코 방지용)
    """
    import httpx
    
    if audio_processor:
        audio_processor.start_bot_speaking()
    
    logger.info(f"🎙️ [환영] 빠른 음성 생성: {text}")
    
    try:
        start_time = time.time()
        
        # Cartesia HTTP API 직접 호출 (최적화된 클라이언트 사용)
        access_token = await cartesia_tts_service._get_access_token()
        client = await cartesia_tts_service._get_http_client()
        
        try:
            response = await client.post(
                "https://api.cartesia.ai/tts/bytes",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "Cartesia-Version": "2025-04-16",
                },
                json={
                    "model_id": cartesia_tts_service.model,
                    "transcript": text,
                    "voice": {
                        "mode": "id",
                        "id": cartesia_tts_service.voice
                    },
                    "language": "ko",
                    "output_format": {
                        "container": "raw",
                        "encoding": "pcm_s16le",
                        "sample_rate": 24000
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
            resampled_pcm, _ = audioop.ratecv(
                pcm_data, 2, 1, 24000, 8000, None
            )
            mulaw_data = audioop.lin2ulaw(resampled_pcm, 2)
            
            # Base64 인코딩 및 전송
            audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
            
            logger.info(f"📤 [환영] 음성 전송 시작: {len(mulaw_data)} bytes")
            
            # 청크 단위 전송
            chunk_size = 8000
            for i in range(0, len(audio_base64), chunk_size):
                chunk = audio_base64[i:i + chunk_size]
                
                message = {
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {"payload": chunk}
                }
                
                await websocket.send_text(json.dumps(message))
                # await asyncio.sleep(0.02)
            
            total_time = time.time() - start_time
            logger.info(f"✅ [환영] 전송 완료 (총 {total_time:.2f}초)")
            
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ Cartesia API 오류: {e.response.status_code}")
            logger.error(f"응답: {e.response.text}")
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

# Lifespan 이벤트 (startup/shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 이벤트"""
    # Startup
    logger.info("🚀 Starting Grandby API Server...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug Mode: {settings.DEBUG}")
    
    # DB 연결 테스트
    if test_db_connection():
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")
    
    # Sentry 초기화 (프로덕션 환경)
    if settings.SENTRY_DSN and not is_development():
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,
        )
        logger.info("✅ Sentry initialized")
    
    # Cartesia TTS 서비스 초기화
    try:
        await cartesia_tts_service.ensure_token_ready()
        logger.info("🚀 Cartesia TTS 서비스 초기화 완료")
    except Exception as e:
        logger.error(f"❌ Cartesia 서비스 초기화 실패: {e}")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Grandby API Server...")
    
    # Cartesia 서비스 정리
    try:
        await cartesia_tts_service.close()
        logger.info("🔄 Cartesia TTS 서비스 정리 완료")
    except Exception as e:
        logger.error(f"❌ Cartesia 서비스 정리 실패: {e}")


# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 기반 어르신 케어 플랫폼 Backend API",
    version=settings.APP_VERSION,
    docs_url="/docs" if is_development() else None,  # 프로덕션에서는 Swagger 비활성화
    redoc_url="/redoc" if is_development() else None,
    lifespan=lifespan,
)


# ==================== Middleware ====================

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 요청 로깅 Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """모든 HTTP 요청 로깅"""
    logger.info(f"📥 {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"📤 {request.method} {request.url.path} - {response.status_code}")
    return response


# ==================== Exception Handlers ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """422 Validation Error 상세 정보 로깅"""
    logger.error(f"❌ 422 Validation Error:")
    logger.error(f"❌ URL: {request.url}")
    logger.error(f"❌ Method: {request.method}")
    logger.error(f"❌ Body: {exc.body}")
    logger.error(f"❌ Errors: {exc.errors()}")
    
    # 상세 에러 정보를 JSON으로 반환
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation Error",
            "errors": exc.errors(),
            "body": exc.body if isinstance(exc.body, dict) else (exc.body.decode() if exc.body else None)
        }
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """404 에러 핸들러"""
    return JSONResponse(
        status_code=404,
        content={
            "detail": "요청하신 리소스를 찾을 수 없습니다.",
            "path": str(request.url.path)
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """500 에러 핸들러"""
    logger.error(f"Internal Server Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "서버 내부 오류가 발생했습니다.",
            "error": str(exc) if is_development() else "Internal Server Error"
        }
    )


# ==================== Root Endpoints ====================

@app.get("/", tags=["Root"])
async def root():
    """루트 엔드포인트"""
    return {
        "message": "🏠 Welcome to Grandby API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if is_development() else "disabled",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """헬스 체크 엔드포인트 (Docker, Kubernetes용)"""
    db_status = "healthy" if test_db_connection() else "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }


# ==================== API Routers ====================

# 인증
app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"]
)

# 사용자 관리
app.include_router(
    users.router,
    prefix="/api/users",
    tags=["Users"]
)

# AI 통화
app.include_router(
    calls.router,
    prefix="/api/calls",
    tags=["AI Calls"]
)

# 다이어리
app.include_router(
    diaries.router,
    prefix="/api/diaries",
    tags=["Diaries"]
)

# TODO 관리
app.include_router(
    todos.router,
    prefix="/api/todos",
    tags=["TODOs"]
)

# 알림
app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["Notifications"]
)

# 보호자 대시보드
app.include_router(
    dashboard.router,
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

# ==================== Twilio WebSocket Endpoints ====================

class RealtimeCallRequest(BaseModel):
    """실시간 AI 대화 통화 요청"""
    to_number: str  # 전화번호 (+821012345678 형식)
    user_id: str = "test-user"  # 사용자 ID (선택)


class RealtimeCallResponse(BaseModel):
    """실시간 AI 대화 통화 응답"""
    success: bool
    call_sid: str
    to_number: str
    status: str
    message: str
    voice_url: str
    timestamp: str


@app.post("/api/twilio/call", response_model=RealtimeCallResponse, tags=["Twilio"])
async def initiate_realtime_call(
    request: RealtimeCallRequest,
    db: Session = Depends(get_db)
):
    """
    실시간 AI 대화 통화 발신 (WebSocket 기반)
    
    사용자가 입력한 전화번호로 전화를 걸고, WebSocket을 통해 실시간 AI 대화를 제공합니다.
    
    플로우:
    1. 앱에서 이 API 호출 (전화번호 전달)
    2. Twilio가 사용자 전화번호로 전화 발신
    3. 사용자가 전화 받음
    4. /api/twilio/voice 엔드포인트에서 WebSocket 연결 시작
    5. 실시간 음성 대화 (STT → LLM → TTS)
    """
    try:
        # API Base URL 확인
        if not settings.API_BASE_URL:
            raise HTTPException(
                status_code=400,
                detail="API_BASE_URL이 환경 변수에 설정되지 않았습니다. (ngrok 또는 도메인 필요)"
            )
        
        # Twilio 서비스 초기화
        twilio_service = TwilioService()
        
        # Callback URL 설정 (WebSocket 연결)
        api_base_url = settings.API_BASE_URL
        voice_url = f"https://{api_base_url}/api/twilio/voice"  # WebSocket 시작 엔드포인트
        status_callback_url = f"https://{api_base_url}/api/twilio/call-status"
        
        logger.info(f"📞 실시간 AI 대화 통화 발신 시작: {request.to_number}")
        logger.info(f"👤 사용자 ID: {request.user_id}")
        logger.info(f"🔗 Voice URL (WebSocket 시작): {voice_url}")
        
        # 전화 걸기
        call_sid = twilio_service.make_call(
            to_number=request.to_number,  # 사용자 입력 전화번호
            voice_url=voice_url,
            status_callback_url=status_callback_url
        )
        
        # 통화 기록 저장 (선택사항)
        try:
            from app.models.call import CallLog
            new_call = CallLog(
                call_id=call_sid,
                elderly_id=request.user_id,
                call_status="initiated",
                twilio_call_sid=call_sid,
                created_at=datetime.utcnow()
            )
            db.add(new_call)
            db.commit()
            logger.info(f"✅ 통화 기록 저장: {call_sid}")
        except Exception as e:
            logger.warning(f"⚠️ 통화 기록 저장 실패 (계속 진행): {str(e)}")
            db.rollback()
        
        logger.info(f"✅ 실시간 AI 대화 통화 발신 성공: {call_sid}")
        
        return RealtimeCallResponse(
            success=True,
            call_sid=call_sid,
            to_number=request.to_number,
            status="initiated",
            message=f"실시간 AI 대화 전화가 {request.to_number}로 발신되었습니다. 전화를 받으시면 AI와 대화하실 수 있습니다.",
            voice_url=voice_url,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 실시간 AI 대화 통화 발신 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"실시간 AI 대화 통화 발신 중 오류 발생: {str(e)}"
        )


@app.post("/api/twilio/voice", response_class=PlainTextResponse, tags=["Twilio"])
async def voice_handler():
    """
    Twilio 전화 연결 시 WebSocket 스트림 시작
    """
    response = VoiceResponse()
    
    # 환영 메시지
    # response.say(
    #     "안녕하세요. AI 어시스턴트에 연결되었습니다.",
    #     language='ko-KR'
    # )
    
    # WebSocket 스트림 연결 설정
    if not settings.API_BASE_URL:
        logger.error("⚠️ API_BASE_URL이 설정되지 않았습니다!")
        api_base_url = "your-domain.com"  # fallback (작동하지 않음)
    else:
        api_base_url = settings.API_BASE_URL
    
    websocket_url = f"wss://{api_base_url}/api/twilio/media-stream"
    
    connect = Connect()
    stream = Stream(url=websocket_url)
    connect.append(stream)
    response.append(connect)
    
    logger.info(f"🎙️ Twilio WebSocket 스트림 시작: {websocket_url}")
    return str(response)


@app.websocket("/api/twilio/media-stream")
async def media_stream_handler(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """
    Twilio Media Streams WebSocket 핸들러 (RTZR 실시간 STT 적용)
    
    실시간 오디오 데이터 양방향 처리 (RTZR 기반):
    1. RTZR 실시간 STT 스트리밍 시작
    2. 부분 인식 결과를 LLM에 백그라운드 전송 (대기 상태 유지)
    3. 최종 인식 결과(is_final: true) 감지
    4. 즉시 AI 응답 생성 및 TTS 재생
    5. 통화 종료 시 전체 대화 내용 저장
    
    RTZR 실시간 STT → LLM (백그라운드) → 최종 문장 → 즉시 응답
    """
    await websocket.accept()
    logger.info("📞 Twilio WebSocket 연결됨")
    
    call_sid = None
    stream_sid = None
    rtzr_stt = None  # RTZR 실시간 STT
    llm_collector = None  # LLM 부분 결과 수집기
    call_log = None  # DB에 저장할 CallLog 객체
    elderly_id = None  # 통화 대상 어르신 ID
    partial_response_context = ""  # 부분 결과 컨텍스트 (LLM 메모리)
    
    try:
        async for message in websocket.iter_text():
            data = json.loads(message)
            event_type = data.get('event')
            
            # ========== 1. 스트림 시작 ==========
            if event_type == 'start':
                call_sid = data['start']['callSid']
                stream_sid = data['start']['streamSid']
                
                # customParameters에서 elderly_id 추출 (Twilio 통화 시작 시 전달)
                custom_params = data['start'].get('customParameters', {})
                elderly_id = custom_params.get('elderly_id', 'unknown')
                
                active_connections[call_sid] = websocket
                
                # 대화 세션 초기화 (LLM 대화 히스토리 관리)
                if call_sid not in conversation_sessions:
                    conversation_sessions[call_sid] = []
                
                # RTZR 실시간 STT 초기화
                rtzr_stt = RTZRRealtimeSTT()
                
                # LLM 부분 결과 수집기 초기화 (백그라운드 전송)
                async def llm_partial_callback(partial_text: str):
                    """부분 인식 결과를 LLM에 백그라운드 전송"""
                    nonlocal partial_response_context, call_sid
                    # LLM이 미리 준비할 수 있도록 컨텍스트 업데이트
                    partial_response_context = partial_text
                    logger.debug(f"💭 [LLM 백그라운드] 부분 결과 업데이트: {partial_text}")
                
                llm_collector = LLMPartialCollector(llm_partial_callback)
                
                # DB에 통화 시작 기록 저장 (status: initiated만)
                try:
                    from app.models.call import CallLog, CallStatus
                    db = next(get_db())
                    
                    # 기존 CallLog가 있는지 확인
                    existing_call = db.query(CallLog).filter(CallLog.call_id == call_sid).first()
                    
                    if not existing_call:
                        call_log = CallLog(
                            call_id=call_sid,
                            elderly_id=elderly_id,
                            call_status=CallStatus.INITIATED,
                            twilio_call_sid=call_sid
                        )
                        db.add(call_log)
                        db.commit()
                        db.refresh(call_log)
                        logger.info(f"✅ DB에 통화 시작 기록 저장: {call_sid}")
                    else:
                        logger.info(f"⏭️  이미 존재하는 통화 기록: {call_sid}")
                    
                    db.close()
                except Exception as e:
                    logger.error(f"❌ 통화 시작 기록 저장 실패: {e}")
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ 🎙️  Twilio 통화 시작 (RTZR STT)                     │")
                logger.info(f"│ Call SID: {call_sid:43} │")
                logger.info(f"│ Stream SID: {stream_sid:41} │")
                logger.info(f"│ Elderly ID: {elderly_id:41} │")
                logger.info(f"└{'─'*58}┘")
                
                # 🚀 개선: 통화 세션 생성 및 Cartesia WebSocket 연결
                call_session = CallSession(call_sid, stream_sid)
                call_sessions[call_sid] = call_session
                
                # Cartesia WebSocket 연결을 백그라운드에서 시작
                connection_success = await call_session.initialize_cartesia_connection()
                
                if connection_success:
                    logger.info("🎉 Cartesia WebSocket 연결 준비 완료 - 즉시 응답 가능!")
                else:
                    logger.warning("⚠️ Cartesia WebSocket 연결 실패 - 폴백 모드 사용")
                
                # 🚀 개선: 토큰과 환영 메시지를 병렬로 준비
                welcome_text = "안녕하세요! 무엇을 도와드릴까요?"
                
                # 토큰 미리 준비 (백그라운드)
                token_task = asyncio.create_task(
                    cartesia_tts_service._get_access_token()
                )
                
                # 환영 메시지 TTS 미리 생성 (병렬 처리)
                welcome_audio_task = asyncio.create_task(
                    _generate_welcome_audio_async(welcome_text)
                )
                
                # 모든 준비 작업 완료 대기
                await asyncio.gather(token_task, welcome_audio_task)
                
                # 준비된 오디오로 즉시 전송
                await _send_prepared_audio_to_twilio(
                    websocket, stream_sid, welcome_audio_task.result(), None
                )
                
                # ========== RTZR 스트리밍 시작 ==========
                logger.info("🎤 RTZR 실시간 STT 스트리밍 시작")
                
                # STT 응답 속도 측정 변수
                last_partial_time = None
                
                async def process_rtzr_results():
                    """RTZR 인식 결과 처리"""
                    nonlocal last_partial_time, call_sid
                    stt_complete_time = None
                    try:
                        async for result in rtzr_stt.start_streaming():
                            # ✅ 통화 종료 체크
                            if call_sid not in conversation_sessions:
                                logger.info("⚠️ 통화 종료로 인한 RTZR 처리 중단")
                                break
                            
                            if not result or 'text' not in result:
                                continue
                            
                            text = result.get('text', '')
                            is_final = result.get('is_final', False)
                            partial_only = result.get('partial_only', False)
                            
                            current_time = time.time()
                            
                            # 부분 결과는 무시하되 시간 기록
                            if partial_only and text:
                                logger.debug(f"📝 [RTZR 부분 인식] {text}")
                                last_partial_time = current_time
                                continue
                            
                            # 최종 결과 처리
                            if is_final and text:
                                # ✅ 통화 종료 체크
                                if call_sid not in conversation_sessions:
                                    logger.info("⚠️ 통화 종료로 인한 최종 처리 중단")
                                    break
                                # STT 응답 속도 측정
                                # 말이 끝난 시점부터 최종 인식까지의 시간
                                if last_partial_time:
                                    speech_to_final_delay = current_time - last_partial_time
                                    logger.info(f"⏱️ [STT 지연] 말 끝 → 최종 인식: {speech_to_final_delay:.2f}초")
                                
                                # 최종 발화 완료
                                logger.info(f"✅ [RTZR 최종] {text}")
                                
                                # 최종 인식 시점 기록 (LLM 전달 전 시간 측정용)
                                stt_complete_time = current_time
                                
                                # 종료 키워드 확인
                                if '그랜비 통화를 종료합니다' in text:
                                    logger.info(f"🛑 종료 키워드 감지")
                                    
                                    # 대화 세션에 사용자 메시지 추가
                                    if call_sid not in conversation_sessions:
                                        conversation_sessions[call_sid] = []
                                    conversation_sessions[call_sid].append({"role": "user", "content": text})
                                    
                                    goodbye_text = "그랜비 통화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
                                    conversation_sessions[call_sid].append({"role": "assistant", "content": goodbye_text})
                                    
                                    logger.info("🔊 [TTS] 종료 메시지 전송")
                                    await send_audio_to_twilio_with_tts(websocket, stream_sid, goodbye_text, None)
                                    await asyncio.sleep(2)
                                    await websocket.close()
                                    return
                                
                                # 발화 처리 사이클
                                cycle_start = time.time()
                                logger.info(f"{'='*60}")
                                logger.info(f"🎯 발화 완료 → 즉시 응답 생성")
                                logger.info(f"{'='*60}")
                                
                                # 대화 세션에 사용자 메시지 추가
                                if call_sid not in conversation_sessions:
                                    conversation_sessions[call_sid] = []
                                conversation_sessions[call_sid].append({"role": "user", "content": text})
                                
                                conversation_history = conversation_sessions[call_sid]
                                
                                # LLM 전달까지의 시간 측정
                                llm_delivery_start = time.time()
                                if stt_complete_time:
                                    stt_to_llm_delay = llm_delivery_start - stt_complete_time
                                    logger.info(f"⏱️ [지연시간] 최종 인식 → LLM 전달: {stt_to_llm_delay:.2f}초")
                                
                                # ✅ AI 응답 시작 (사용자 입력 차단)
                                rtzr_stt.start_bot_speaking()
                                
                                # LLM 응답 생성
                                logger.info("🤖 [LLM] 응답 생성 시작")
                                llm_start_time = time.time()
                                ai_response = await process_streaming_response(
                                    websocket,
                                    stream_sid,
                                    text,
                                    conversation_history,
                                    None
                                )
                                llm_end_time = time.time()
                                llm_duration = llm_end_time - llm_start_time
                                
                                # ✅ AI 응답 종료 (1초 후 사용자 입력 재개)
                                rtzr_stt.stop_bot_speaking()
                                
                                logger.info("✅ [LLM] 응답 생성 완료")
                                
                                # 전체 처리 시간 로깅
                                if stt_complete_time:
                                    total_delay = llm_end_time - stt_complete_time
                                    logger.info(f"⏱️ [전체 지연] 최종 인식 → LLM 완료: {total_delay:.2f}초 (LLM 응답 생성: {llm_duration:.2f}초)")
                                
                                # AI 응답을 대화 세션에 추가 (안전하게)
                                try:
                                    if ai_response and ai_response.strip():
                                        # conversation_sessions에 여전히 존재하는지 확인
                                        if call_sid in conversation_sessions:
                                            conversation_sessions[call_sid].append({"role": "assistant", "content": ai_response})
                                        
                                        # 대화 히스토리 관리
                                        if call_sid in conversation_sessions and len(conversation_sessions[call_sid]) > 20:
                                            conversation_sessions[call_sid] = conversation_sessions[call_sid][-20:]
                                    
                                    total_cycle_time = time.time() - cycle_start
                                    logger.info(f"⏱️  전체 응답 사이클: {total_cycle_time:.2f}초")
                                    logger.info(f"{'='*60}\n\n")
                                except KeyError:
                                    # 세션이 이미 삭제된 경우 (통화 종료)
                                    logger.info("⚠️  세션이 이미 삭제됨 (통화 종료 중)")
                                    break
                                except Exception as e:
                                    logger.error(f"❌ 응답 저장 오류: {e}")
                                
                            elif text:
                                # 부분 결과를 LLM에 백그라운드 전송
                                llm_collector.add_partial(text)
                                logger.debug(f"📝 [RTZR 부분] {text}")
                    
                    except Exception as e:
                        logger.error(f"❌ RTZR 처리 오류: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                
                # RTZR 스트리밍 태스크 시작 (백그라운드)
                rtzr_task = asyncio.create_task(process_rtzr_results())
                
            # ========== 2. 오디오 데이터 수신 및 RTZR로 전송 ==========
            elif event_type == 'media':
                if rtzr_stt and rtzr_stt.is_active:
                    # ✅ AI 응답 중이면 오디오 무시 (에코 방지)
                    if rtzr_stt.is_bot_speaking:
                        continue
                    
                    # ✅ AI 응답 종료 후 1초 대기 중이면 무시
                    if rtzr_stt.bot_silence_delay > 0:
                        rtzr_stt.bot_silence_delay -= 1
                        continue
                    
                    # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                    audio_payload = base64.b64decode(data['media']['payload'])
                    
                    # RTZR로 오디오 청크 전송
                    await rtzr_stt.add_audio_chunk(audio_payload)
                        
            # ========== 3. 스트림 종료 ==========
            elif event_type == 'stop':
                logger.info(f"\n{'='*60}")
                logger.info(f"📞 Twilio 통화 종료 - Call: {call_sid}")
                logger.info(f"{'='*60}")
                
                # ✅ RTZR 백그라운드 태스크 취소
                if 'rtzr_task' in locals() and rtzr_task:
                    logger.info("🛑 RTZR 백그라운드 태스크 취소 중...")
                    rtzr_task.cancel()
                    try:
                        await asyncio.wait_for(rtzr_task, timeout=2.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        logger.info("✅ RTZR 백그라운드 태스크 종료 완료")
                
                # RTZR 스트리밍 종료
                if rtzr_stt:
                    await rtzr_stt.end_streaming()
                    logger.info("🛑 RTZR 스트리밍 종료")
                
                # ✅ 대화 세션을 DB에 저장 (함수 호출)
                if call_sid in conversation_sessions:
                    conversation = conversation_sessions[call_sid]
                    
                    # 대화 내용 출력
                    if conversation:
                        logger.info(f"\n📋 전체 대화 내용:")
                        logger.info(f"─" * 60)
                        for msg in conversation:
                            role = "👤 사용자" if msg['role'] == 'user' else "🤖 AI"
                            logger.info(f"{role}: {msg['content']}")
                        logger.info(f"─" * 60)
                    
                    await save_conversation_to_db(call_sid, conversation)
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ ✅ Twilio 통화 정리 완료                               │")
                logger.info(f"└{'─'*58}┘\n")
                break
                
    except WebSocketDisconnect:
        logger.info(f"📞 Twilio WebSocket 연결 해제 (Call: {call_sid})")
        # WebSocket 연결 해제 시에도 정리
        if call_sid and call_sid in call_sessions:
            await call_sessions[call_sid].close()
            del call_sessions[call_sid]
            logger.info("🔄 Cartesia WebSocket 연결 정리 완료 (연결 해제)")
    except Exception as e:
        logger.error(f"❌ Twilio WebSocket 오류: {str(e)}")
        # 오류 발생 시에도 정리
        if call_sid and call_sid in call_sessions:
            await call_sessions[call_sid].close()
            del call_sessions[call_sid]
            logger.info("🔄 Cartesia WebSocket 연결 정리 완료 (오류 발생)")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # ✅ 연결 종료 시 항상 DB 저장 (핵심!)
        # 사용자가 직접 전화를 끊어도 대화 내용 보존
        if call_sid and call_sid in conversation_sessions:
            try:
                conversation = conversation_sessions[call_sid]
                await save_conversation_to_db(call_sid, conversation)
                logger.info(f"🔄 Finally 블록에서 DB 저장 완료: {call_sid}")
            except Exception as e:
                logger.error(f"❌ Finally 블록 DB 저장 실패: {e}")
        
        # 정리 작업 (메모리에서 제거)
        if call_sid and call_sid in active_connections:
            del active_connections[call_sid]
        if call_sid and call_sid in conversation_sessions:
            del conversation_sessions[call_sid]
        
        logger.info(f"🧹 WebSocket 정리 완료: {call_sid}")


@app.post("/api/twilio/call-status", tags=["Twilio"])
async def call_status_handler(
    CallSid: str = Form(None),
    CallStatus: str = Form(None)
):
    """
    Twilio 통화 상태 업데이트 콜백
    통화 상태: initiated, ringing, answered, completed
    """
    logger.info(f"📞 통화 상태 업데이트: {CallSid} - {CallStatus}")
    
    # 통화 상태에 따른 DB 업데이트
    try:
        from app.models.call import CallLog, CallStatus as CallStatusEnum
        db = next(get_db())
        
        call_log = db.query(CallLog).filter(CallLog.call_id == CallSid).first()
        
        if call_log:
            if CallStatus == 'answered':
                # 통화 연결 시 시작 시간 설정
                if not call_log.call_start_time:
                    call_log.call_start_time = datetime.utcnow()
                    call_log.call_status = CallStatusEnum.ANSWERED
                    db.commit()
                    logger.info(f"✅ 통화 시작 시간 설정: {CallSid}")
            
            elif CallStatus == 'completed':
                # 통화 종료 시 종료 시간 설정
                call_log.call_end_time = datetime.utcnow()
                call_log.call_status = CallStatusEnum.COMPLETED
                
                # 통화 시간 계산
                if call_log.call_start_time:
                    duration = (call_log.call_end_time - call_log.call_start_time).total_seconds()
                    call_log.call_duration = int(duration)
                    logger.info(f"✅ 통화 종료 시간 설정: {CallSid}, 지속시간: {duration}초")
                
                db.commit()
                
                # ✅ 통화 종료 시 DB 저장 (백업용 - 중복 방지 로직 포함)
                if CallSid in conversation_sessions:
                    try:
                        conversation = conversation_sessions[CallSid]
                        await save_conversation_to_db(CallSid, conversation)
                        logger.info(f"💾 콜백에서 통화 기록 저장 완료: {CallSid}")
                    except Exception as e:
                        logger.error(f"❌ 콜백 DB 저장 실패: {e}")
                
                # 세션 정리
                if CallSid in conversation_sessions:
                    del conversation_sessions[CallSid]
                if CallSid in active_connections:
                    del active_connections[CallSid]
        
        db.close()
        
    except Exception as e:
        logger.error(f"❌ 통화 상태 업데이트 실패: {e}")
        if 'db' in locals():
            db.close()
    
    return {"status": "ok", "call_sid": CallSid, "call_status": CallStatus}


# ==================== Startup Message ====================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_development(),
        log_level=settings.LOG_LEVEL.lower(),
    )
