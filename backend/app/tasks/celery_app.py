"""
Celery 애플리케이션 설정
비동기 작업 및 스케줄링
"""

from celery import Celery
from celery.schedules import crontab
from app.config import settings

# Celery 앱 생성
celery_app = Celery(
    "grandby",
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND or settings.REDIS_URL,
)

# Celery 설정
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30분
    task_soft_time_limit=25 * 60,  # 25분
)

# 자동으로 tasks 모듈에서 작업 발견
celery_app.autodiscover_tasks(["app.tasks"])

# 스케줄 설정 (Celery Beat)
celery_app.conf.beat_schedule = {
    # AI 자동 전화 스케줄링 (매 분마다 체크)
    "check-call-schedule": {
        "task": "app.tasks.call_scheduler.check_and_make_calls",
        "schedule": crontab(minute="*"),  # 매 분마다 체크 (정확도 향상)
    },
    # 감정 분석 알림 체크 (매일 오전 9시)
    "check-emotion-alerts": {
        "task": "app.tasks.notification_sender.check_emotion_alerts",
        "schedule": crontab(hour=9, minute=0),
    },
}


@celery_app.task(bind=True)
def debug_task(self):
    """디버그용 테스트 작업"""
    print(f"Request: {self.request!r}")

