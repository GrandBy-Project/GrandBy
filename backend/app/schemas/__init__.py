"""
Pydantic 스키마 (DTO)
API 요청/응답 데이터 검증
"""

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    ConnectionCreate,
    ConnectionResponse,
)
from app.schemas.call import (
    CallLogResponse,
    CallSettingsUpdate,
    CallTranscriptResponse,
)
from app.schemas.diary import (
    DiaryCreate,
    DiaryUpdate,
    DiaryResponse,
    DiaryCommentCreate,
)
from app.schemas.todo import (
    TodoCreate,
    TodoUpdate,
    TodoResponse,
)
from app.schemas.notification import (
    NotificationResponse,
)
from app.schemas.health import (
    HealthDataCreate,
    HealthDataUpdate,
    HealthDataResponse,
    HealthDataStatsResponse,
    HealthDataRangeResponse,
)

__all__ = [
    "UserBase",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "Token",
    "ConnectionCreate",
    "ConnectionResponse",
    "CallLogResponse",
    "CallSettingsUpdate",
    "CallTranscriptResponse",
    "DiaryCreate",
    "DiaryUpdate",
    "DiaryResponse",
    "DiaryCommentCreate",
    "TodoCreate",
    "TodoUpdate",
    "TodoResponse",
    "NotificationResponse",
    "HealthDataCreate",
    "HealthDataUpdate",
    "HealthDataResponse",
    "HealthDataStatsResponse",
    "HealthDataRangeResponse",
]

