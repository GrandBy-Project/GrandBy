"""
알림 발송 작업
Celery 태스크를 통한 비동기 알림 전송
"""

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.services.notification_service import NotificationService
from app.models.notification import NotificationType
from sqlalchemy.orm import Session
import logging
import asyncio

logger = logging.getLogger(__name__)


def run_async(coro):
    """비동기 함수를 동기적으로 실행"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(name="app.tasks.notification_sender.check_emotion_alerts")
def check_emotion_alerts():
    """
    감정 상태 확인 후 보호자에게 알림
    
    NOTE: 현재는 감정 분석 기능이 구현되면 활성화
    """
    db: Session = SessionLocal()
    try:
        logger.info("📊 감정 경고 체크 시작...")
        
        # TODO: 감정 분석 기능 구현 후 활성화
        # 1. 최근 7일간 부정적 감정이 지속된 어르신 조회
        # 2. 보호자에게 푸시 알림 발송
        # 3. NOTIFICATION 테이블에 기록
        
        logger.info("✅ 감정 경고 체크 완료 (기능 미구현)")
        
        return {
            "status": "success",
            "message": "Emotion check completed (feature not implemented yet)"
        }
    
    except Exception as e:
        logger.error(f"❌ 감정 경고 체크 실패: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }
    
    finally:
        db.close()


@celery_app.task(name="app.tasks.notification_sender.send_push_notification_task")
def send_push_notification_task(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    related_id: str = None,
    notification_type_key: str = None
):
    """
    푸시 알림 비동기 전송 (Celery Task)
    
    Args:
        user_id: 사용자 ID
        notification_type: 알림 유형 (NotificationType enum value)
        title: 알림 제목
        message: 알림 내용
        related_id: 관련 리소스 ID
        notification_type_key: 알림 종류 키
    """
    db: Session = SessionLocal()
    try:
        logger.info(f"📤 푸시 알림 전송 시작: {user_id} - {title}")
        
        # NotificationType enum으로 변환
        try:
            notif_type = NotificationType(notification_type)
        except ValueError:
            logger.error(f"Invalid notification type: {notification_type}")
            return {"status": "error", "error": f"Invalid notification type: {notification_type}"}
        
        # 비동기 함수 실행
        success = run_async(
            NotificationService.create_and_send_notification(
                db=db,
                user_id=user_id,
                notification_type=notif_type,
                title=title,
                message=message,
                related_id=related_id,
                notification_type_key=notification_type_key
            )
        )
        
        if success:
            logger.info(f"✅ 푸시 알림 전송 완료: {user_id}")
            return {"status": "success", "user_id": user_id}
        else:
            logger.warning(f"⚠️ 푸시 알림 전송 실패: {user_id}")
            return {"status": "failed", "user_id": user_id}
    
    except Exception as e:
        logger.error(f"❌ 푸시 알림 전송 오류: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()


@celery_app.task(name="app.tasks.notification_sender.send_batch_notifications")
def send_batch_notifications(
    user_ids: list,
    notification_type: str,
    title: str,
    message: str,
    related_id: str = None,
    notification_type_key: str = None
):
    """
    여러 사용자에게 동일한 알림 전송
    
    Args:
        user_ids: 사용자 ID 리스트
        notification_type: 알림 유형
        title: 알림 제목
        message: 알림 내용
        related_id: 관련 리소스 ID
        notification_type_key: 알림 종류 키
    """
    db: Session = SessionLocal()
    try:
        logger.info(f"📤 배치 알림 전송 시작: {len(user_ids)}명")
        
        success_count = 0
        fail_count = 0
        
        # NotificationType enum으로 변환
        try:
            notif_type = NotificationType(notification_type)
        except ValueError:
            logger.error(f"Invalid notification type: {notification_type}")
            return {"status": "error", "error": f"Invalid notification type: {notification_type}"}
        
        for user_id in user_ids:
            try:
                success = run_async(
                    NotificationService.create_and_send_notification(
                        db=db,
                        user_id=user_id,
                        notification_type=notif_type,
                        title=title,
                        message=message,
                        related_id=related_id,
                        notification_type_key=notification_type_key
                    )
                )
                
                if success:
                    success_count += 1
                else:
                    fail_count += 1
            
            except Exception as e:
                logger.error(f"Failed to send notification to {user_id}: {str(e)}")
                fail_count += 1
        
        logger.info(f"✅ 배치 알림 전송 완료: 성공 {success_count}, 실패 {fail_count}")
        
        return {
            "status": "success",
            "total": len(user_ids),
            "success": success_count,
            "failed": fail_count
        }
    
    except Exception as e:
        logger.error(f"❌ 배치 알림 전송 오류: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()

