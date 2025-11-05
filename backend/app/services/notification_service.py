"""
푸시 알림 서비스
Firebase Admin SDK를 사용한 푸시 알림 전송
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, messaging

from app.models.user import User, UserSettings, UserConnection, ConnectionStatus
from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)


class NotificationService:
    """알림 서비스"""
    
    _firebase_app = None
    
    @classmethod
    def _get_firebase_app(cls):
        """Firebase Admin SDK 앱 인스턴스 가져오기"""
        if cls._firebase_app is None:
            try:
                # 서비스 계정 키 파일 경로
                cred_path = "/app/credentials/firebase-admin-key.json"
                cred = credentials.Certificate(cred_path)
                cls._firebase_app = firebase_admin.initialize_app(cred)
                logger.info("✅ Firebase Admin SDK 초기화 완료")
            except Exception as e:
                logger.error(f"❌ Firebase Admin SDK 초기화 실패: {str(e)}")
                raise
        return cls._firebase_app
    
    @staticmethod
    def can_send_notification(user: User, db: Session, notification_type: str = None) -> bool:
        """
        사용자가 알림을 받을 수 있는지 확인
        
        Args:
            user: 사용자 객체
            db: DB 세션
            notification_type: 알림 종류 (todo_reminder, todo_incomplete, etc.)
        
        Returns:
            bool: 알림 전송 가능 여부
        """
        # 푸시 토큰 확인 (FCM 토큰 또는 Expo Push Token 모두 허용)
        if not user.push_token:
            logger.debug(f"User {user.user_id} has no push token")
            return False
        
        # FCM 토큰 또는 Expo Push Token 검증
        is_valid_token = (
            user.push_token.startswith('ExponentPushToken') or  # Expo Push Token
            len(user.push_token) > 50  # FCM 토큰 (긴 문자열)
        )
        
        if not is_valid_token:
            logger.debug(f"User {user.user_id} has no valid push token")
            return False
        
        # 사용자 설정 확인
        settings = db.query(UserSettings).filter(
            UserSettings.user_id == user.user_id
        ).first()
        
        if not settings:
            logger.warning(f"User {user.user_id} has no settings")
            return False
        
        # 전체 푸시 알림 비활성화
        if not settings.push_notification_enabled:
            logger.debug(f"User {user.user_id} has push notifications disabled")
            return False
        
        # 알림 종류별 확인
        if notification_type:
            type_mapping = {
                'todo_reminder': settings.push_todo_reminder_enabled,
                'todo_incomplete': settings.push_todo_incomplete_enabled,
                'todo_created': settings.push_todo_created_enabled,
                'diary_created': settings.push_diary_enabled,
                'call_completed': settings.push_call_enabled,
                'connection_request': settings.push_connection_enabled,
                'connection_accepted': settings.push_connection_enabled,
            }
            
            if notification_type in type_mapping and not type_mapping[notification_type]:
                logger.debug(f"User {user.user_id} has {notification_type} notifications disabled")
                return False
        
        return True
    
    @staticmethod
    async def send_push_notification(
        push_tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        priority: str = "default"
    ) -> Dict[str, Any]:
        """
        Firebase Admin SDK를 사용한 푸시 알림 전송 (HTTP v1 API)
        
        Args:
            push_tokens: FCM 토큰 리스트
            title: 알림 제목
            body: 알림 내용
            data: 추가 데이터
            priority: 우선순위 (default, normal, high)
        
        Returns:
            dict: 전송 결과
        """
        if not push_tokens:
            logger.warning("No push tokens provided")
            return {"success": False, "error": "No push tokens"}
        
        # 유효한 FCM 토큰 필터링
        valid_tokens = []
        for token in push_tokens:
            if token and len(token) > 10:  # FCM 토큰은 긴 문자열
                valid_tokens.append(token)
        
        if not valid_tokens:
            logger.warning(f"No valid FCM tokens: {push_tokens}")
            return {"success": False, "error": "No valid FCM tokens"}
        
        try:
            # Firebase Admin SDK 초기화
            NotificationService._get_firebase_app()
            
            # Firebase Admin SDK로 메시지 전송 (HTTP v1 API 자동 사용)
            success_count = 0
            failed_count = 0
            responses = []
            
            for fcm_token in valid_tokens:
                try:
                    # 메시지 구성
                    # data 값은 모두 문자열이어야 하며 None이 포함되면 안 됨
                    safe_data = {}
                    if data:
                        for k, v in data.items():
                            if v is None:
                                continue
                            # Firebase data payload는 문자열만 허용됨
                            safe_data[str(k)] = str(v)
                    message = messaging.Message(
                        notification=messaging.Notification(
                            title=title,
                            body=body
                        ),
                        data=safe_data,
                        token=fcm_token,
                        android=messaging.AndroidConfig(
                            priority="high" if priority == "high" else "normal"
                        )
                    )
                    
                    # 메시지 전송 (HTTP v1 API 자동 사용)
                    response = messaging.send(message)
                    success_count += 1
                    responses.append({
                        "success": True,
                        "message_id": response,
                        "token": fcm_token
                    })
                    logger.info(f"✅ Push notification sent to {fcm_token}: {title}")
                    
                except Exception as e:
                    failed_count += 1
                    responses.append({
                        "success": False,
                        "error": str(e),
                        "token": fcm_token
                    })
                    logger.error(f"❌ Failed to send to {fcm_token}: {str(e)}")
            
            logger.info(f"✅ Push notification batch completed: {success_count}/{len(valid_tokens)} sent")
            
            return {
                "success": success_count > 0,
                "sent_count": success_count,
                "failed_count": failed_count,
                "responses": responses
            }
        
        except Exception as e:
            logger.error(f"❌ Failed to send push notification: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def create_and_send_notification(
        db: Session,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        related_id: Optional[str] = None,
        notification_type_key: Optional[str] = None
    ) -> bool:
        """
        알림 생성 및 푸시 알림 전송
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            notification_type: 알림 유형
            title: 알림 제목
            message: 알림 내용
            related_id: 관련 리소스 ID
            notification_type_key: 알림 종류 키 (can_send_notification용)
        
        Returns:
            bool: 성공 여부
        """
        try:
            # 사용자 조회 (UUID 또는 email로 검색)
            user = None
            
            # 먼저 UUID로 검색 시도
            if len(user_id) == 36 and '-' in user_id:  # UUID 형식
                user = db.query(User).filter(User.user_id == user_id).first()
            
            # UUID로 찾지 못했으면 email로 검색
            if not user:
                user = db.query(User).filter(User.email == user_id).first()
            
            if not user:
                logger.error(f"User not found: {user_id}")
                return False
            
            # DB에 알림 저장
            notification = Notification(
                user_id=user.user_id,  # 실제 사용자의 UUID 사용
                type=notification_type,
                title=title,
                message=message,
                related_id=related_id,
                is_read=False,
                is_pushed=False
            )
            db.add(notification)
            db.commit()
            
            logger.info(f"📝 Notification created: {notification_type} for {user_id}")
            
            # 푸시 알림 전송 가능 여부 확인
            if not NotificationService.can_send_notification(user, db, notification_type_key):
                logger.info(f"Push notification disabled for user {user_id}")
                return True
            
            # 푸시 알림 전송
            result = await NotificationService.send_push_notification(
                push_tokens=[user.push_token],
                title=title,
                body=message,
                data={
                    'notification_id': notification.notification_id,
                    'type': notification_type.value,
                    'related_id': related_id
                },
                priority='default'
            )
            
            # 푸시 전송 상태 업데이트
            if result.get('success'):
                notification.is_pushed = True
                db.commit()
                logger.info(f"✅ Push notification sent to {user_id}")
            else:
                logger.warning(f"⚠️ Push notification failed for {user_id}: {result.get('error')}")
            
            return True
        
        except Exception as e:
            logger.error(f"❌ Failed to create and send notification: {str(e)}")
            db.rollback()
            return False
    
    @staticmethod
    async def notify_todo_reminder(
        db: Session,
        user_id: str,
        todo_title: str,
        todo_id: str,
        minutes_before: int = 10
    ) -> bool:
        """
        TODO 리마인더 알림 전송
        
        Args:
            db: DB 세션
            user_id: 어르신 ID
            todo_title: TODO 제목
            todo_id: TODO ID
            minutes_before: 몇 분 전인지
        """
        return await NotificationService.create_and_send_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.TODO_REMINDER,
            title=f"🔔 {minutes_before}분 후 일정이 있어요!",
            message=f"'{todo_title}' 일정이 곧 시작됩니다.",
            related_id=todo_id,
            notification_type_key='todo_reminder'
        )
    
    @staticmethod
    async def notify_todo_incomplete(
        db: Session,
        user_id: str,
        incomplete_count: int
    ) -> bool:
        """
        미완료 TODO 알림 전송
        
        Args:
            db: DB 세션
            user_id: 어르신 ID
            incomplete_count: 미완료 개수
        """
        return await NotificationService.create_and_send_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.TODO_REMINDER,
            title="📋 오늘의 할 일을 확인해주세요",
            message=f"아직 완료하지 못한 일정이 {incomplete_count}개 있어요.",
            notification_type_key='todo_incomplete'
        )
    
    @staticmethod
    async def notify_todo_created(
        db: Session,
        user_id: str,
        todo_title: str,
        todo_id: str,
        creator_name: str
    ) -> bool:
        """
        새로운 TODO 생성 알림 (보호자가 어르신에게 일정 추가 시)
        
        Args:
            db: DB 세션
            user_id: 어르신 ID
            todo_title: TODO 제목
            todo_id: TODO ID
            creator_name: 생성자 이름
        """
        return await NotificationService.create_and_send_notification(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.DIARY_CREATED,  # TODO_CREATED 타입이 없어서 임시로 사용
            title="✨ 새로운 일정이 추가되었어요",
            message=f"{creator_name}님이 '{todo_title}' 일정을 추가했습니다.",
            related_id=todo_id,
            notification_type_key='todo_created'
        )
    
    @staticmethod
    async def notify_todo_created_by_elderly(
        db: Session,
        elderly_id: str,
        todo_title: str,
        todo_id: str,
        elderly_name: str
    ) -> bool:
        """
        어르신이 직접 생성한 TODO 알림 (연결된 보호자들에게만 전송, 어르신 본인에게는 전송하지 않음)
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            todo_title: TODO 제목
            todo_id: TODO ID
            elderly_name: 어르신 이름
        """
        from app.models.user import UserConnection, ConnectionStatus
        
        # 연결된 보호자 목록 조회
        connections = db.query(UserConnection).filter(
            and_(
                UserConnection.elderly_id == elderly_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).all()
        
        if not connections:
            logger.info(f"연결된 보호자가 없어 알림을 전송하지 않습니다: {elderly_id}")
            return True
        
        # 보호자들에게만 알림 전송 (어르신 본인에게는 전송하지 않음)
        success = True
        for connection in connections:
            result = await NotificationService.create_and_send_notification(
                db=db,
                user_id=connection.caregiver_id,
                notification_type=NotificationType.DIARY_CREATED,  # TODO_CREATED 타입이 없어서 임시로 사용
                title="📝 새로운 일정이 추가되었어요",
                message=f"{elderly_name}님이 '{todo_title}' 일정을 추가했습니다.",
                related_id=todo_id,
                notification_type_key='todo_created'
            )
            if not result:
                success = False
        
        return success
    
    @staticmethod
    async def notify_diary_created(
        db: Session,
        caregiver_ids: List[str],
        elderly_name: str,
        diary_id: str
    ) -> bool:
        """
        다이어리 생성 알림 (보호자에게)
        
        Args:
            db: DB 세션
            caregiver_ids: 보호자 ID 리스트
            elderly_name: 어르신 이름
            diary_id: 다이어리 ID
        """
        success = True
        for caregiver_id in caregiver_ids:
            result = await NotificationService.create_and_send_notification(
                db=db,
                user_id=caregiver_id,
                notification_type=NotificationType.DIARY_CREATED,
                title="📖 새로운 일기가 작성되었어요",
                message=f"{elderly_name}님의 오늘 일기가 자동으로 작성되었습니다.",
                related_id=diary_id,
                notification_type_key='diary_created'
            )
            if not result:
                success = False
        
        return success
    
    @staticmethod
    async def notify_diary_comment_created(
        db: Session,
        diary_id: str,
        comment_author_id: str,
        comment_author_name: str,
        diary_title: Optional[str] = None
    ) -> bool:
        """
        일기 댓글 작성 알림 (본인을 제외한 연결 대상들에게 전송)
        
        Args:
            db: DB 세션
            diary_id: 일기 ID
            comment_author_id: 댓글 작성자 ID (알림 제외 대상)
            comment_author_name: 댓글 작성자 이름
            diary_title: 일기 제목 (선택사항)
        """
        from app.models.diary import Diary
        
        # 일기 정보 조회
        diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
        if not diary:
            logger.error(f"일기를 찾을 수 없습니다: {diary_id}")
            return False
        
        # 알림을 받을 대상 리스트 (댓글 작성자 제외)
        notification_targets = []
        
        # 1. 일기를 작성한 어르신 (댓글 작성자가 아닌 경우만)
        if diary.user_id != comment_author_id:
            notification_targets.append(diary.user_id)
        
        # 2. 연결된 보호자들 (댓글 작성자가 아닌 경우만)
        connections = db.query(UserConnection).filter(
            and_(
                UserConnection.elderly_id == diary.user_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).all()
        
        for connection in connections:
            if connection.caregiver_id != comment_author_id:
                notification_targets.append(connection.caregiver_id)
        
        if not notification_targets:
            logger.info(f"알림을 받을 대상이 없습니다 (댓글 작성자만 포함): {diary_id}")
            return True
        
        # 알림 전송
        diary_title_text = diary_title or diary.title or "일기"
        success = True
        for target_id in notification_targets:
            result = await NotificationService.create_and_send_notification(
                db=db,
                user_id=target_id,
                notification_type=NotificationType.DIARY_CREATED,  # TODO: DIARY_COMMENT 타입 추가 시 변경
                title="💬 새로운 댓글이 달렸어요",
                message=f"{comment_author_name}님이 '{diary_title_text}' 일기에 댓글을 남겼습니다.",
                related_id=diary_id,
                notification_type_key='diary_comment'
            )
            if not result:
                success = False
        
        return success
    
    @staticmethod
    async def notify_call_completed(
        db: Session,
        elderly_id: str,
        call_id: str
    ) -> bool:
        """
        AI 전화 완료 알림 (어르신에게)
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            call_id: 통화 ID
        """
        return await NotificationService.create_and_send_notification(
            db=db,
            user_id=elderly_id,
            notification_type=NotificationType.CALL_MISSED,
            title="📞 AI 전화가 완료되었어요",
            message="오늘의 AI 전화가 완료되었습니다.",
            related_id=call_id,
            notification_type_key='call_completed'
        )
    
    @staticmethod
    async def notify_connection_request(
        db: Session,
        elderly_id: str,
        caregiver_name: str,
        connection_id: str
    ) -> bool:
        """
        연결 요청 알림 (어르신에게)
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            caregiver_name: 보호자 이름
            connection_id: 연결 ID
        """
        return await NotificationService.create_and_send_notification(
            db=db,
            user_id=elderly_id,
            notification_type=NotificationType.CONNECTION_REQUEST,
            title="👥 새로운 연결 요청",
            message=f"{caregiver_name}님이 연결을 요청했습니다.",
            related_id=connection_id,
            notification_type_key='connection_request'
        )
    
    @staticmethod
    async def notify_connection_accepted(
        db: Session,
        caregiver_id: str,
        elderly_name: str,
        connection_id: str
    ) -> bool:
        """
        연결 수락 알림 (보호자에게)
        
        Args:
            db: DB 세션
            caregiver_id: 보호자 ID
            elderly_name: 어르신 이름
            connection_id: 연결 ID
        """
        return await NotificationService.create_and_send_notification(
            db=db,
            user_id=caregiver_id,
            notification_type=NotificationType.CONNECTION_ACCEPTED,
            title="✅ 연결 요청이 수락되었어요",
            message=f"{elderly_name}님이 연결 요청을 수락했습니다.",
            related_id=connection_id,
            notification_type_key='connection_accepted'
        )

