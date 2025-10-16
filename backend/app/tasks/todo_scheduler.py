"""
TODO 반복 일정 자동 생성 작업
Celery Beat에서 매일 자정에 실행
"""

from celery import shared_task
from datetime import date, datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.todo.todo_service import TodoService
import logging

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.todo_scheduler.generate_daily_recurring_todos")
def generate_daily_recurring_todos():
    """
    매일 자정에 실행되어 오늘의 반복 TODO 생성
    
    Returns:
        생성된 TODO 수
    """
    db: Session = SessionLocal()
    try:
        today = date.today()
        logger.info(f"📅 반복 TODO 생성 시작: {today}")
        
        created_count = TodoService.generate_recurring_todos(
            db=db,
            target_date=today
        )
        
        logger.info(f"✅ 반복 TODO {created_count}개 생성 완료")
        
        return {
            "date": str(today),
            "created_count": created_count,
            "status": "success"
        }
    
    except Exception as e:
        logger.error(f"❌ 반복 TODO 생성 실패: {str(e)}")
        return {
            "date": str(date.today()),
            "created_count": 0,
            "status": "error",
            "error": str(e)
        }
    
    finally:
        db.close()


@shared_task(name="app.tasks.todo_scheduler.send_todo_reminders")
def send_todo_reminders():
    """
    다가오는 TODO 리마인더 알림 전송 (30분 전)
    매 30분마다 실행
    
    TODO: 알림 시스템 구현 후 활성화
    """
    db: Session = SessionLocal()
    try:
        logger.info("⏰ TODO 리마인더 체크 시작")
        
        # TODO: NotificationService 구현 후 추가
        # - 현재 시간 + 30분 이내의 TODO 조회
        # - 해당 어르신에게 푸시 알림 전송
        
        logger.info("✅ TODO 리마인더 체크 완료")
        
        return {"status": "success", "message": "리마인더 전송 완료"}
    
    except Exception as e:
        logger.error(f"❌ TODO 리마인더 실패: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()


@shared_task(name="app.tasks.todo_scheduler.check_overdue_todos")
def check_overdue_todos():
    """
    미완료 TODO 체크 및 알림 전송
    매일 밤 9시 실행
    
    TODO: 알림 시스템 구현 후 활성화
    """
    db: Session = SessionLocal()
    try:
        today = date.today()
        logger.info(f"🔔 미완료 TODO 체크 시작: {today}")
        
        # TODO: NotificationService 구현 후 추가
        # - 오늘 날짜의 PENDING 상태 TODO 조회
        # - 보호자에게 알림 전송
        
        logger.info("✅ 미완료 TODO 체크 완료")
        
        return {"status": "success", "message": "미완료 체크 완료"}
    
    except Exception as e:
        logger.error(f"❌ 미완료 TODO 체크 실패: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()


@shared_task(name="app.tasks.todo_scheduler.cleanup_old_todos")
def cleanup_old_todos():
    """
    오래된 TODO 정리 (완료된 TODO 1개월 이상)
    매주 일요일 자정 실행
    
    TODO: 데이터 보관 정책 구현
    """
    db: Session = SessionLocal()
    try:
        logger.info("🗑️ 오래된 TODO 정리 시작")
        
        # TODO: 1개월 이상 지난 COMPLETED TODO 소프트 삭제 또는 아카이빙
        
        logger.info("✅ 오래된 TODO 정리 완료")
        
        return {"status": "success", "message": "정리 완료"}
    
    except Exception as e:
        logger.error(f"❌ 오래된 TODO 정리 실패: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()

