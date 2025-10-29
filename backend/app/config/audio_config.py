"""
오디오 처리 관련 설정 상수
"""

class AudioConfig:
    """오디오 처리 관련 설정 상수 클래스"""
    
    # ========== 오디오 처리 기본 설정 ==========
    CHUNK_SIZE = 8000  # Base64 청크 크기 (8KB)
    SAMPLE_RATE = 8000  # Twilio 요구 샘플레이트
    SAMPLE_WIDTH = 2  # 16-bit (2 bytes)
    CHANNELS = 1  # Mono
    
    # ========== 침묵 감지 설정 ==========
    WARMUP_THRESHOLD = 25  # 처음 0.5초 무시 (25 * 20ms)
    MAX_SILENCE = 0.5  # 1.5초 침묵 후 STT 처리
    VOICE_THRESHOLD = 3  # 최소 3번 연속 감지
    
    # ========== PCM 기반 동적 임계값 설정 ==========
    BASE_SILENCE_THRESHOLD = 1000  # 기본 임계값 (PCM 16-bit 기준)
    NOISE_MARGIN = 200  # 배경 소음 + 마진 = 임계값
    MIN_THRESHOLD = 500  # 최소 임계값 (PCM 기준)
    MAX_THRESHOLD = 5000  # 최대 임계값 (PCM 기준)
    NOISE_CALIBRATION_CHUNKS = 50  # 처음 1초(50*20ms) 동안 배경 소음 측정
    
    # ========== 오디오 변환 설정 ==========
    CARTESIA_SAMPLE_RATE = 24000  # Cartesia TTS 샘플레이트
    CARTESIA_SAMPLE_WIDTH = 2  # 16-bit
    CARTESIA_CHANNELS = 1  # Mono
    
    # ========== TTS 처리 설정 ==========
    TTS_TIMEOUT = 10.0  # TTS 변환 타임아웃 (초)
    AUDIO_CHUNK_DELAY = 0.02  # 부드러운 재생을 위한 지연 (초)
    WELCOME_AUDIO_DELAY = 0.01  # 환영 메시지 전송 지연 (초)
    
    # ========== WebSocket 설정 ==========
    WEBSOCKET_PING_INTERVAL = 20  # WebSocket ping 간격 (초)
    WEBSOCKET_PING_TIMEOUT = 10  # WebSocket ping 타임아웃 (초)
    
    # ========== 에코 방지 설정 ==========
    BOT_SILENCE_DELAY = 5  # AI 응답 종료 후 대기 시간 (청크 단위)
    
    # ========== 오디오 품질 설정 ==========
    MIN_AUDIO_LENGTH = 1600  # 최소 오디오 길이 (0.1초 = 320 bytes * 5)
    MAX_RMS_VALUE = 20000  # 비정상적으로 큰 RMS 값 필터링 (PCM 기준)
    MAX_RMS_HISTORY = 100  # RMS 기록 최대 개수
    
    # ========== 문장 분할 설정 ==========
    SENTENCE_MIN_LENGTH = 40  # 쉼표로 분할할 최소 문장 길이
    SENTENCE_MAX_LENGTH = 80  # 강제 분할할 최대 문장 길이
    SENTENCE_END_PATTERNS = ['.', '!', '?', '\n', '。', '！', '？']
    SENTENCE_PAUSE_PATTERNS = [',', '，']
