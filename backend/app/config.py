"""
환경 설정 관리
Pydantic Settings를 사용한 타입 안전 환경 변수 관리
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # ==================== App Settings ====================
    APP_NAME: str = "Grandby"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # ==================== Database ====================
    DATABASE_URL: str
    DB_ECHO: bool = False
    
    # ==================== Redis ====================
    REDIS_URL: str = "redis://redis:6379/0"
    
    # ==================== JWT ====================
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # ==================== OpenAI ====================
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_WHISPER_MODEL: str = "whisper-1"
    OPENAI_TTS_MODEL: str = "tts-1"
    OPENAI_TTS_VOICE: str = "nova"
    
    # ==================== Cartesia TTS ====================
    CARTESIA_API_KEY: str | None = None
    CARTESIA_TTS_MODEL: str = "sonic-2"  # 공식 문서 기준 sonic-2 사용
    CARTESIA_TTS_VOICE: str = "304fdbd8-65e6-40d6-ab78-f9d18b9efdf9"  # Jihyun - Anchorwoman
    CARTESIA_ACCESS_TOKEN_EXPIRES_IN: int = 60  # Access Token 만료 시간 (초)
    
    # ==================== Speech-to-Text ====================
    # STT 제공자 선택: "google", "openai", "rtzr"
    STT_PROVIDER: str = "rtzr"
    
    # Google Cloud STT 설정
    GOOGLE_APPLICATION_CREDENTIALS: str = "credentials/google-cloud-stt.json"
    GOOGLE_STT_LANGUAGE_CODE: str = "ko-KR"
    GOOGLE_STT_MODEL: str = "latest_short"  # phone_call, latest_short, latest_long
    
    # ==================== RTZR STT (Korean Speech Recognition) ====================
    RTZR_CLIENT_ID: str = ""
    RTZR_CLIENT_SECRET: str = ""
    RTZR_API_HOST: str = "openapi.vito.ai"
    RTZR_SAMPLE_RATE: int = 8000
    RTZR_ENCODING: str = "LINEAR16"
    
    # ==================== Twilio ====================
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_PHONE_NUMBER: str
    API_BASE_URL: str | None = None  # WebSocket용 공개 도메인 (예: your-domain.com)
    TEST_PHONE_NUMBER: str | None = None  # 테스트용 전화번호 (예: +821012345678)
    
    # ==================== AWS S3 ====================
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "ap-northeast-2"
    S3_BUCKET_NAME: str
    
    # ==================== CORS ====================
    CORS_ORIGINS: str = "http://localhost:19000,http://localhost:19006"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """CORS origins를 리스트로 변환"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # ==================== Email (SMTP) ====================
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "그랜비 Grandby"
    ENABLE_EMAIL: bool = True  # 개발 중에는 False, 실제 발송 시 True
    
    # ==================== Logging ====================
    LOG_LEVEL: str = "INFO"
    
    # ==================== Sentry ====================
    SENTRY_DSN: str | None = None
    
    # ==================== Celery ====================
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None
    
    # ==================== AI Call Settings ====================
    DEFAULT_CALL_TIME: str = "20:00"
    MAX_CALL_DURATION: int = 10  # minutes
    MAX_PROMPT_TOKENS: int = 4000
    
    # ==================== Feature Flags ====================
    ENABLE_AUTO_DIARY: bool = True
    ENABLE_TODO_EXTRACTION: bool = True
    ENABLE_EMOTION_ANALYSIS: bool = True
    ENABLE_NOTIFICATIONS: bool = True
    
    # ==================== Image Upload Settings ====================
    UPLOAD_DIR: str = "uploads/profiles"
    MAX_IMAGE_SIZE: int = 5 * 1024 * 1024  # 5MB
    PROFILE_IMAGE_SIZE: tuple = (512, 512)  # 리사이징 크기
    
    # ==================== Naver Clova TTS ====================
    NAVER_CLOVA_CLIENT_ID: str
    NAVER_CLOVA_CLIENT_SECRET: str
    NAVER_CLOVA_TTS_SPEAKER: str = "nara"  # mijin, jinho, clara, matt, shinji, meimei
    NAVER_CLOVA_TTS_SPEED: int = -1  # -5 ~ 5
    NAVER_CLOVA_TTS_PITCH: int = +1  # -5 ~ 5
    NAVER_CLOVA_TTS_ALPHA: int = -1  # 0 ~ 2
    NAVER_CLOVA_TTS_VOLUME: int = 0  # -5 ~ 5
    NAVER_CLOVA_TTS_EMOTION: int = 2  # 0 ~ 2 (감정 강도)
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


# 전역 설정 인스턴스
settings = Settings()


# 개발 환경 체크 함수
def is_development() -> bool:
    """개발 환경 여부 확인"""
    return settings.ENVIRONMENT == "development"


def is_production() -> bool:
    """프로덕션 환경 여부 확인"""
    return settings.ENVIRONMENT == "production"
