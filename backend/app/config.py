"""
환경 설정 관리
Pydantic Settings를 사용한 타입 안전 환경 변수 관리
"""

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
    
    # ==================== Twilio ====================
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_PHONE_NUMBER: str
    API_BASE_URL: str | None = None  # WebSocket용 공개 도메인 (예: your-domain.com)
    TEST_PHONE_NUMBER: str | None = None  # 테스트용 전화번호 (예: +821012345678)
    
    # Twilio Voice SDK (VoIP)
    TWILIO_API_KEY_SID: str | None = None  # Twilio API Key SID
    TWILIO_API_KEY_SECRET: str | None = None  # Twilio API Key Secret
    TWILIO_TWIML_APP_SID: str | None = None  # TwiML App SID
    
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