#!/usr/bin/env python3
import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append('/app')

import firebase_admin
from firebase_admin import credentials, messaging

async def test_firebase_direct():
    """Firebase Admin SDK 직접 테스트"""
    print("🔥 Firebase Admin SDK 직접 테스트 시작...")
    
    try:
        # 서비스 계정 키 파일 확인
        cred_path = "/app/credentials/firebase-admin-key.json"
        print(f"📁 서비스 계정 키 파일 경로: {cred_path}")
        
        if not os.path.exists(cred_path):
            print(f"❌ 서비스 계정 키 파일이 존재하지 않습니다: {cred_path}")
            return
        
        # 서비스 계정 키 파일 내용 확인
        import json
        with open(cred_path, 'r') as f:
            cred_data = json.load(f)
            print(f"📋 프로젝트 ID: {cred_data.get('project_id', 'N/A')}")
            print(f"📋 클라이언트 이메일: {cred_data.get('client_email', 'N/A')}")
        
        # Firebase Admin SDK 초기화
        cred = credentials.Certificate(cred_path)
        app = firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK 초기화 성공")
        
        # FCM 토큰으로 직접 메시지 전송 테스트
        fcm_token = "1X5NEvNNXOJFdCsT5tBSmS"  # 실제 디바이스의 FCM 토큰
        
        message = messaging.Message(
            notification=messaging.Notification(
                title="🔥 Firebase 직접 테스트",
                body="Firebase Admin SDK로 직접 전송된 메시지입니다!"
            ),
            token=fcm_token,
            android=messaging.AndroidConfig(
                priority="high"
            )
        )
        
        print(f"📤 FCM 토큰으로 메시지 전송 시도: {fcm_token}")
        response = messaging.send(message)
        print(f"✅ 메시지 전송 성공! Message ID: {response}")
        
    except Exception as e:
        print(f"❌ Firebase 직접 테스트 실패: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_firebase_direct())
