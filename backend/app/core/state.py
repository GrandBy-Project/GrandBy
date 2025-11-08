"""
전역 상태 관리
"""
from typing import Dict
from fastapi import WebSocket
from app.utils.performance_metrics import PerformanceMetricsCollector
from app.services.ai_call.session_store import get_session_store

# WebSocket 연결 및 대화 세션 관리
# 주의: llm_service와 naver_clova_tts_service는 각 통화마다 독립적인 인스턴스를 생성하여 사용
# (동시 통화 시 충돌 방지를 위해 전역 인스턴스 사용하지 않음)
active_connections: Dict[str, WebSocket] = {}
conversation_sessions: Dict[str, list] = {}
saved_calls: set = set()  # 중복 저장 방지용 플래그

# 세션 스토어
session_store = get_session_store()

# TTS 재생 완료 시간 추적 (call_sid -> (completion_time, total_playback_duration))
active_tts_completions: Dict[str, tuple[float, float]] = {}

# 성능 메트릭 수집기 관리 (call_sid -> PerformanceMetricsCollector)
performance_collectors: Dict[str, PerformanceMetricsCollector] = {}

