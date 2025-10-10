"""
알림 발송 작업
"""

from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notification_sender.check_emotion_alerts")
def check_emotion_alerts():
    """
    감정 상태 확인 후 보호자에게 알림
    """
    logger.info("Checking emotion alerts...")
    
    # TODO:
    # 1. 최근 7일간 부정적 감정이 지속된 어르신 조회
    # 2. 보호자에게 푸시 알림 발송
    # 3. NOTIFICATION 테이블에 기록
    
    pass


@celery_app.task(name="app.tasks.notification_sender.send_push_notification")
def send_push_notification(user_id: str, title: str, message: str):
    """
    푸시 알림 발송
    
    Args:
        user_id: 사용자 ID
        title: 알림 제목
        message: 알림 내용
    """
    logger.info(f"Sending push notification to {user_id}: {title}")
    
    # TODO: Firebase Cloud Messaging 연동
    
    pass

