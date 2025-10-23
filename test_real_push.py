#!/usr/bin/env python3
"""
실제 Expo Push Token으로 푸시 알림 테스트
사용법: python test_real_push.py "ExponentPushToken[실제토큰]"
"""
import sys
import os
import asyncio
sys.path.append('/app')

from app.services.notification_service import NotificationService
from app.database import get_db
from app.models.user import User, UserSettings
from app.models.notification import NotificationType

async def test_real_push_token(push_token: str):
    db = next(get_db())
    
    # 사용자 찾기 또는 생성
    user = db.query(User).filter(User.push_token == push_token).first()
    
    if not user:
        print(f"토큰 {push_token}에 해당하는 사용자를 찾을 수 없습니다.")
        print("테스트용 사용자를 생성합니다...")
        
        # 테스트용 사용자 생성
        user = User(
            email=f"test_{push_token[:10]}@example.com",
            password_hash="test",
            name="테스트 사용자",
            role="elderly",
            push_token=push_token
        )
        db.add(user)
        db.flush()  # user_id 생성
        
        # 사용자 설정 생성
        settings = UserSettings(
            user_id=user.user_id,
            push_notification_enabled=True,
            push_todo_reminder_enabled=True,
            push_todo_incomplete_enabled=True,
            push_todo_created_enabled=True,
            push_diary_enabled=True,
            push_call_enabled=True,
            push_connection_enabled=True
        )
        db.add(settings)
        db.commit()
        
        print(f"테스트 사용자 생성 완료: {user.email}")
    
    print(f"테스트 사용자: {user.email}")
    print(f"푸시 토큰: {user.push_token}")
    
    # 푸시 알림 테스트
    result = await NotificationService.create_and_send_notification(
        db=db,
        user_id=user.user_id,
        title="🎉 푸시 알림 테스트",
        message="Dev Client에서 푸시 알림이 정상적으로 작동합니다!",
        notification_type=NotificationType.DIARY_CREATED
    )
    
    print(f"푸시 알림 전송 결과: {result}")
    
    if result:
        print("✅ 푸시 알림이 성공적으로 전송되었습니다!")
        print("📱 디바이스에서 알림을 확인해보세요.")
    else:
        print("❌ 푸시 알림 전송에 실패했습니다.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("사용법: python test_real_push.py \"ExponentPushToken[실제토큰]\"")
        sys.exit(1)
    
    push_token = sys.argv[1]
    asyncio.run(test_real_push_token(push_token))
