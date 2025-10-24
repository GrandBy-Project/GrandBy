#!/usr/bin/env python3
"""
푸시 알림 테스트 스크립트
"""
import sys
import os
import asyncio
sys.path.append('/app')

from app.services.notification_service import NotificationService
from app.database import get_db
from app.models.user import User
from app.models.notification import NotificationType

async def test_notification():
    db = next(get_db())
    user = db.query(User).filter(User.push_token.isnot(None)).first()
    
    if not user:
        print("푸시 토큰이 있는 사용자를 찾을 수 없습니다.")
        return
    
    print(f"테스트 사용자: {user.email}")
    print(f"푸시 토큰: {user.push_token}")
    
    # NotificationService 테스트
    result = await NotificationService.create_and_send_notification(
        db=db,
        user_id=user.user_id,
        title="테스트 알림",
        message="이것은 푸시 알림 테스트입니다.",
        notification_type=NotificationType.DIARY_CREATED
    )
    
    print(f"알림 생성 결과: {result}")

if __name__ == "__main__":
    asyncio.run(test_notification())
