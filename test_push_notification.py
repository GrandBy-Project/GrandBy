#!/usr/bin/env python3
import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append('/app')

from app.services.notification_service import NotificationService
from app.database import get_db
from app.models.notification import NotificationType

async def test_push_notification():
    """푸시 알림 테스트"""
    print("🚀 푸시 알림 테스트 시작...")
    
    try:
        # 데이터베이스 연결
        db = next(get_db())
        print("✅ 데이터베이스 연결 완료")
        
        # 푸시 알림 전송
        result = await NotificationService.create_and_send_notification(
            db=db,
            user_id='test1@test.com',
            notification_type=NotificationType.DIARY_CREATED,
            title='🔥 Firebase Admin SDK 테스트',
            message='Firebase Admin SDK로 푸시 알림이 전송되었습니다!',
            related_id='test123'
        )
        
        print("📤 푸시 알림 전송 결과:")
        print(f"   성공: {result}")
        
        # 추가로 직접 Firebase Admin SDK 테스트
        print("\n🔍 Firebase Admin SDK 직접 테스트...")
        
        # DB에서 실제 사용자의 푸시 토큰 가져오기
        from app.models.user import User
        user = db.query(User).filter(User.email == 'test1@test.com').first()
        if user and user.push_token:
            print(f"   사용자 푸시 토큰: {user.push_token[:20]}...")
            direct_result = await NotificationService.send_push_notification(
                push_tokens=[user.push_token],  # DB에서 가져온 실제 토큰 사용
                title='🔥 Firebase Admin SDK 직접 테스트',
                body='Firebase Admin SDK로 직접 전송된 메시지입니다!',
                data={'test': 'direct_api'}
            )
            print(f"   직접 API 결과: {direct_result}")
        else:
            print("   사용자 푸시 토큰을 찾을 수 없습니다.")
        
    except Exception as e:
        print(f"❌ 푸시 알림 테스트 실패: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_push_notification())