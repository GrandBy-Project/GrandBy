#!/usr/bin/env python3
import sys
sys.path.append('/app')

from app.database import get_db
from app.models.user import User, UserSettings

def check_user_settings():
    db = next(get_db())
    
    # test1 사용자 조회 (UUID로)
    user = db.query(User).filter(User.user_id == 'b8fb2216-fabe-45b3-8b69-148c15d1ba18').first()
    if not user:
        print("User not found!")
        return
    
    print(f"User: {user.email}")
    print(f"Push token: {user.push_token[:20] if user.push_token else None}...")
    
    # 사용자 설정 조회
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.user_id).first()
    print(f"Settings exist: {settings is not None}")
    
    if settings:
        print(f"Push notification enabled: {settings.push_notification_enabled}")
        print(f"TODO created enabled: {settings.push_todo_created_enabled}")
        print(f"Push diary enabled: {settings.push_diary_enabled}")
    else:
        print("No settings found!")

if __name__ == "__main__":
    check_user_settings()
