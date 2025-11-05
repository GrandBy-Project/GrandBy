"""
성능 메트릭 수집 및 분석 모듈
전화 통화 중 STT/LLM/TTS/E2E 성능 지표 수집 및 JSON 저장
"""

import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import statistics

logger = logging.getLogger(__name__)


def format_timestamp(ts: float, call_start_time: float) -> str:
    """
    Unix timestamp를 시:분:초.밀리초 형식으로 변환
    
    Args:
        ts: Unix timestamp (초)
        call_start_time: 통화 시작 시간 (기준 시각)
    
    Returns:
        str: "HH:MM:SS.mmm" 형식의 문자열
    """
    if ts is None:
        return None
    
    # 통화 시작 시간 기준으로 상대 시간 계산
    relative_time = ts - call_start_time
    
    # 시간, 분, 초, 밀리초 계산
    hours = int(relative_time // 3600)
    minutes = int((relative_time % 3600) // 60)
    seconds = int(relative_time % 60)
    milliseconds = int((relative_time % 1) * 1000)
    
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


class PerformanceMetricsCollector:
    """통화 성능 메트릭 수집기"""
    
    def __init__(self, call_sid: str, output_dir: str = "backend/performance_metrics"):
        """
        Args:
            call_sid: 통화 ID
            output_dir: 메트릭 저장 디렉토리
        """
        self.call_sid = call_sid
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 통화 시작 시간
        self.call_start_time = time.time()
        self.call_start_datetime = datetime.now()
        self.call_start_timestamp = self.call_start_datetime.strftime("%Y%m%d_%H%M%S")
        
        # JSON 파일 경로 (통화 시작 시각을 파일명으로)
        self.metrics_file = self.output_dir / f"call_metrics_{self.call_start_timestamp}_{call_sid[:8]}.json"
        
        # 메트릭 데이터 구조
        self.metrics = {
            "call_sid": call_sid,
            "call_start_time": self.call_start_timestamp,
            "call_start_datetime": self.call_start_datetime.strftime("%Y-%m-%d %H:%M:%S"),
            "turns": [],  # 각 대화 턴별 메트릭
            "summary": {}  # 통화 종료 시 전체 통계
        }
        
        # 누적 데이터 (통계 계산용)
        self._stt_latencies: List[float] = []
        self._stt_partial_latencies: List[float] = []
        self._llm_first_token_latencies: List[float] = []
        self._llm_completion_latencies: List[float] = []
        self._tts_latencies: List[float] = []
        self._first_token_to_first_tts_completion_latencies: List[float] = []  # LLM 첫 토큰 → 첫 TTS 완료
        self._stt_to_first_audio_latencies: List[float] = []  # STT 완료 → 첫 음성 출력
        self._e2e_latencies: List[float] = []
        
        logger.info(f"📊 성능 메트릭 수집기 초기화: {self.metrics_file}")
    
    def start_turn(self, user_utterance: str, turn_start_time: float) -> Dict:
        """
        새로운 대화 턴 시작
        
        Args:
            user_utterance: 사용자 발화 문장
            turn_start_time: 턴 시작 시간
            
        Returns:
            turn_metrics: 턴 메트릭 딕셔너리
        """
        turn_metrics = {
            "turn_number": len(self.metrics["turns"]) + 1,
            "user_utterance": user_utterance,
            "ai_response": "",
            "turn_start_time": turn_start_time,
            "stt": {
                "user_speech_start_time": None,  # 사용자가 실제로 말하기 시작한 시점
                "first_partial_time": None,  # STT 첫 부분 인식 시간
                "final_recognition_time": None,  # STT 최종 인식 시간
                "latency": None,  # user_speech_start_time → final_recognition_time
                "partial_latency": None  # user_speech_start_time → first_partial_time
            },
            "llm": {
                "first_token_time": None,
                "completion_time": None,
                "first_token_latency": None,
                "completion_latency": None
            },
            "tts": {
                "start_time": None,
                "completion_time": None,
                "first_completion_time": None,
                "latency": None,
                "first_token_to_first_tts_completion_latency": None
            },
            "e2e": {
                "turn_end_time": None,
                "latency": None
            },
            "stt_to_first_audio": {
                "latency": None  # STT 완료 → 첫 음성 출력까지의 시간
            },
            "statistics": {}  # 현재까지의 통계 (p50, p95, p99)
        }
        
        self.metrics["turns"].append(turn_metrics)
        return turn_metrics
    
    def record_user_speech_start(self, turn_index: int, speech_start_time: float):
        """사용자 발화 시작 시간 기록 (STT 첫 부분 인식 시점)"""
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            if turn["stt"]["user_speech_start_time"] is None:
                turn["stt"]["user_speech_start_time"] = speech_start_time
    
    def record_stt_partial(self, turn_index: int, partial_time: float, speech_start_time: float = None):
        """
        STT 부분 인식 시간 기록
        
        Args:
            turn_index: 턴 인덱스
            partial_time: 부분 인식 시간
            speech_start_time: 사용자 발화 시작 시간 (있는 경우)
        """
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            
            # 사용자 발화 시작 시간이 제공되면 기록
            if speech_start_time is not None and turn["stt"]["user_speech_start_time"] is None:
                turn["stt"]["user_speech_start_time"] = speech_start_time
            
            # 첫 부분 인식 시간 기록
            if turn["stt"]["first_partial_time"] is None:
                turn["stt"]["first_partial_time"] = partial_time
                
                # 부분 지연시간 계산: 사용자 발화 시작 → 첫 부분 인식
                reference_time = turn["stt"]["user_speech_start_time"] or turn["turn_start_time"]
                if reference_time:
                    turn["stt"]["partial_latency"] = partial_time - reference_time
                    self._stt_partial_latencies.append(turn["stt"]["partial_latency"])
    
    def record_stt_final(self, turn_index: int, final_time: float):
        """
        STT 최종 인식 시간 기록
        
        Args:
            turn_index: 턴 인덱스
            final_time: 최종 인식 시간
        """
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            turn["stt"]["final_recognition_time"] = final_time
            
            # STT 지연시간 계산: 사용자 발화 시작 → 최종 인식
            reference_time = turn["stt"]["user_speech_start_time"] or turn["turn_start_time"]
            if reference_time:
                turn["stt"]["latency"] = final_time - reference_time
                self._stt_latencies.append(turn["stt"]["latency"])
    
    def record_llm_first_token(self, turn_index: int, first_token_time: float):
        """LLM 첫 토큰 생성 시간 기록"""
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            turn["llm"]["first_token_time"] = first_token_time
            if turn["stt"]["final_recognition_time"]:
                turn["llm"]["first_token_latency"] = first_token_time - turn["stt"]["final_recognition_time"]
                self._llm_first_token_latencies.append(turn["llm"]["first_token_latency"])
    
    def record_llm_completion(self, turn_index: int, completion_time: float, ai_response: str):
        """LLM 완료 시간 기록"""
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            turn["ai_response"] = ai_response
            turn["llm"]["completion_time"] = completion_time
            if turn["llm"]["first_token_time"]:
                turn["llm"]["completion_latency"] = completion_time - turn["llm"]["first_token_time"]
                self._llm_completion_latencies.append(turn["llm"]["completion_latency"])
    
    def record_tts_start(self, turn_index: int, tts_start_time: float):
        """TTS 시작 시간 기록"""
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            turn["tts"]["start_time"] = tts_start_time
    
    def record_tts_completion(self, turn_index: int, tts_completion_time: float, is_first_sentence: bool = False):
        """
        TTS 완료 시간 기록
        
        Args:
            turn_index: 턴 인덱스
            tts_completion_time: TTS 완료 시간
            is_first_sentence: 첫 번째 문장인지 여부 (첫 문장의 TTS 완료 시간만 정확히 기록)
        """
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            turn["tts"]["completion_time"] = tts_completion_time
            
            # 첫 TTS 완료 시간 기록 (첫 번째 문장의 TTS 완료 시간만 기록)
            # LLM 첫 토큰부터 첫 TTS 완료까지의 지연시간 계산용
            if is_first_sentence and turn["tts"]["first_completion_time"] is None:
                # 타임스탬프 검증: first_token_time보다 이후인지 확인
                if turn["llm"]["first_token_time"]:
                    if tts_completion_time < turn["llm"]["first_token_time"]:
                        # 음수값 방지: first_token_time을 기준으로 재계산
                        logger.warning(
                            f"⚠️ [메트릭] TTS 완료 시간이 LLM 첫 토큰 시간보다 빠름. "
                            f"first_token_time={turn['llm']['first_token_time']:.6f}, "
                            f"tts_completion_time={tts_completion_time:.6f}. "
                            f"first_token_time 기준으로 조정합니다."
                        )
                        # first_token_time 이후의 최소 시간으로 설정 (0.001초 후)
                        tts_completion_time = turn["llm"]["first_token_time"] + 0.001
                
                turn["tts"]["first_completion_time"] = tts_completion_time
                
                # LLM 첫 토큰부터 첫 TTS 완료까지의 지연시간 계산
                if turn["llm"]["first_token_time"]:
                    latency = tts_completion_time - turn["llm"]["first_token_time"]
                    # 음수값 방지 (타임스탬프 동기화 문제 대비)
                    if latency < 0:
                        logger.warning(
                            f"⚠️ [메트릭] first_token_to_first_tts_completion_latency가 음수입니다. "
                            f"latency={latency:.6f}. 0으로 설정합니다."
                        )
                        latency = 0.0
                    turn["tts"]["first_token_to_first_tts_completion_latency"] = latency
                    # 통계 계산용 리스트에 추가
                    self._first_token_to_first_tts_completion_latencies.append(latency)
                
                # STT 완료부터 첫 음성 출력까지의 지연시간 계산
                if turn["stt"]["final_recognition_time"]:
                    latency = tts_completion_time - turn["stt"]["final_recognition_time"]
                    # 음수값 방지
                    if latency < 0:
                        logger.warning(
                            f"⚠️ [메트릭] stt_to_first_audio_latency가 음수입니다. "
                            f"latency={latency:.6f}. 0으로 설정합니다."
                        )
                        latency = 0.0
                    turn["stt_to_first_audio"]["latency"] = latency
                    # 통계 계산용 리스트에 추가
                    self._stt_to_first_audio_latencies.append(latency)
            
            # TTS 지연시간 계산 (start_time 기준)
            if turn["tts"]["start_time"]:
                latency = tts_completion_time - turn["tts"]["start_time"]
                # 음수값 방지
                if latency < 0:
                    logger.warning(
                        f"⚠️ [메트릭] tts_latency가 음수입니다. "
                        f"latency={latency:.6f}. 0으로 설정합니다."
                    )
                    latency = 0.0
                turn["tts"]["latency"] = latency
                self._tts_latencies.append(latency)
    
    def record_turn_end(self, turn_index: int, turn_end_time: float):
        """턴 종료 시간 기록 및 통계 계산"""
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            turn["e2e"]["turn_end_time"] = turn_end_time
            if turn["turn_start_time"]:
                turn["e2e"]["latency"] = turn_end_time - turn["turn_start_time"]
                self._e2e_latencies.append(turn["e2e"]["latency"])
            
            # 현재까지의 통계 계산
            turn["statistics"] = self._calculate_current_statistics()
            
            # 시:분:초.밀리초 형식 추가 (읽기 쉬운 형식)
            self._add_formatted_times(turn_index)
            
            # 즉시 파일에 저장 (실시간 업데이트)
            self._save_metrics()
    
    def _add_formatted_times(self, turn_index: int):
        """각 시간 값에 시:분:초.밀리초 형식 추가"""
        if turn_index < len(self.metrics["turns"]):
            turn = self.metrics["turns"][turn_index]
            
            # STT 시간 포맷팅
            if turn["stt"]["user_speech_start_time"]:
                turn["stt"]["user_speech_start_time_formatted"] = format_timestamp(
                    turn["stt"]["user_speech_start_time"], self.call_start_time
                )
            if turn["stt"]["first_partial_time"]:
                turn["stt"]["first_partial_time_formatted"] = format_timestamp(
                    turn["stt"]["first_partial_time"], self.call_start_time
                )
            if turn["stt"]["final_recognition_time"]:
                turn["stt"]["final_recognition_time_formatted"] = format_timestamp(
                    turn["stt"]["final_recognition_time"], self.call_start_time
                )
            
            # LLM 시간 포맷팅
            if turn["llm"]["first_token_time"]:
                turn["llm"]["first_token_time_formatted"] = format_timestamp(
                    turn["llm"]["first_token_time"], self.call_start_time
                )
            if turn["llm"]["completion_time"]:
                turn["llm"]["completion_time_formatted"] = format_timestamp(
                    turn["llm"]["completion_time"], self.call_start_time
                )
            
            # TTS 시간 포맷팅
            if turn["tts"]["start_time"]:
                turn["tts"]["start_time_formatted"] = format_timestamp(
                    turn["tts"]["start_time"], self.call_start_time
                )
            if turn["tts"]["first_completion_time"]:
                turn["tts"]["first_completion_time_formatted"] = format_timestamp(
                    turn["tts"]["first_completion_time"], self.call_start_time
                )
            if turn["tts"]["completion_time"]:
                turn["tts"]["completion_time_formatted"] = format_timestamp(
                    turn["tts"]["completion_time"], self.call_start_time
                )
            
            # E2E 시간 포맷팅
            if turn["turn_start_time"]:
                turn["turn_start_time_formatted"] = format_timestamp(
                    turn["turn_start_time"], self.call_start_time
                )
            if turn["e2e"]["turn_end_time"]:
                turn["e2e"]["turn_end_time_formatted"] = format_timestamp(
                    turn["e2e"]["turn_end_time"], self.call_start_time
                )
    
    def _calculate_current_statistics(self) -> Dict:
        """현재까지 수집된 데이터의 통계 계산"""
        def percentile(data: List[float], p: float) -> Optional[float]:
            """퍼센타일 계산"""
            if not data:
                return None
            sorted_data = sorted(data)
            k = (len(sorted_data) - 1) * p
            f = int(k)
            c = k - f
            if f + 1 < len(sorted_data):
                return sorted_data[f] + c * (sorted_data[f + 1] - sorted_data[f])
            return sorted_data[f]
        
        def safe_stats(data: List[float], name: str) -> Dict:
            """안전한 통계 계산"""
            if not data:
                return {
                    "count": 0,
                    "avg": None,
                    "min": None,
                    "max": None,
                    "p50": None,
                    "p95": None,
                    "p99": None
                }
            
            return {
                "count": len(data),
                "avg": statistics.mean(data),
                "min": min(data),
                "max": max(data),
                "p50": percentile(data, 0.50),
                "p95": percentile(data, 0.95),
                "p99": percentile(data, 0.99)
            }
        
        return {
            "stt_latency": safe_stats(self._stt_latencies, "stt_latency"),
            "stt_partial_latency": safe_stats(self._stt_partial_latencies, "stt_partial_latency"),
            "llm_first_token_latency": safe_stats(self._llm_first_token_latencies, "llm_first_token_latency"),
            "llm_completion_latency": safe_stats(self._llm_completion_latencies, "llm_completion_latency"),
            "tts_latency": safe_stats(self._tts_latencies, "tts_latency"),
            "first_token_to_first_tts_completion_latency": safe_stats(
                self._first_token_to_first_tts_completion_latencies,
                "first_token_to_first_tts_completion_latency"
            ),
            "stt_to_first_audio_latency": safe_stats(
                self._stt_to_first_audio_latencies,
                "stt_to_first_audio_latency"
            ),
            "e2e_latency": safe_stats(self._e2e_latencies, "e2e_latency")
        }
    
    def _save_metrics(self):
        """메트릭을 JSON 파일에 저장"""
        try:
            with open(self.metrics_file, 'w', encoding='utf-8') as f:
                json.dump(self.metrics, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ 메트릭 저장 실패: {e}")
    
    def finalize(self):
        """통화 종료 시 최종 통계 계산 및 저장"""
        # 최종 통계 계산
        final_stats = self._calculate_current_statistics()
        
        # 추가 통계 (통화 전체)
        call_duration = time.time() - self.call_start_time
        
        self.metrics["summary"] = {
            "call_duration_seconds": call_duration,
            "total_turns": len(self.metrics["turns"]),
            "statistics": final_stats,
            "call_end_time": datetime.now().strftime("%Y%m%d_%H%M%S")
        }
        
        # 최종 저장
        self._save_metrics()
        
        logger.info(f"📊 최종 메트릭 저장 완료: {self.metrics_file}")
        logger.info(f"   총 턴 수: {len(self.metrics['turns'])}")
        logger.info(f"   통화 시간: {call_duration:.2f}초")
        
        return self.metrics_file

