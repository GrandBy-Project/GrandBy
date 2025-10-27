"""RTZR 초기화 테스트"""
import sys
import os
sys.path.insert(0, '/app')

async def test():
    from app.services.ai_call.stt_service import STTService
    from app.config import settings
    
    print("=== RTZR 초기화 테스트 ===")
    print(f"STT_PROVIDER: {settings.STT_PROVIDER}")
    print(f"RTZR_CLIENT_ID: {settings.RTZR_CLIENT_ID[:10]}...")
    
    try:
        stt = STTService()
        print(f"✅ STT 서비스 초기화 성공")
        print(f"사용 중인 Provider: {stt.provider}")
        
        if stt.provider == "rtzr":
            print("✅ RTZR이 활성화되었습니다!")
        else:
            print(f"⚠️ RTZR이 아닌 {stt.provider}가 활성화되었습니다")
            
    except Exception as e:
        print(f"❌ 초기화 실패: {e}")
        import traceback
        traceback.print_exc()

import asyncio
asyncio.run(test())

