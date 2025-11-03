"""
Celery 비동기 작업
"""

from app.tasks.celery_app import celery_app
from app.tasks.call_scheduler import check_and_make_calls, process_call_result
from app.tasks.diary_generator import generate_diary_from_call
# 명시적 임포트로 태스크 등록 보장
from app.tasks import todo_scheduler  # noqa: F401 - 모듈 임포트 목적
from app.tasks import notification_sender  # noqa: F401 - 모듈 임포트 목적

__all__ = [
    "celery_app",
    "check_and_make_calls",
    "process_call_result",
    "generate_diary_from_call",
    # 모듈 단위로 내보내지는 않지만, 등록 보장을 위해 참고로 기재
    "todo_scheduler",
    "notification_sender",
]

