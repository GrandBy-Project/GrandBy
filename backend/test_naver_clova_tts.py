"""
Naver Clova TTS 테스트 스크립트 (비동기 최적화)
"""

import asyncio
from app.services.ai_call.naver_clova_tts_service import naver_clova_tts_service


async def test_naver_clova_tts():
    """Naver Clova TTS 기본 테스트 (비동기)"""
    
    test_texts = [
        "안녕하세요, 네이버 클로바 TTS 테스트입니다.",
        "오늘 날씨가 정말 좋네요.",
        "그랜비 AI 어시스턴트가 도와드리겠습니다."
    ]
    
    print("🔊 Naver Clova TTS 테스트 시작 (비동기 최적화)...")
    
    for i, text in enumerate(test_texts, 1):
        print(f"\n--- 테스트 {i} ---")
        print(f"텍스트: {text}")
        
        # 파일로 저장 테스트
        audio_path, elapsed_time = naver_clova_tts_service.text_to_speech(text)
        
        if audio_path:
            print(f"✅ 파일 저장 성공: {audio_path} ({elapsed_time:.2f}초)")
        else:
            print("❌ 파일 저장 실패")
        
        # 비동기 bytes 반환 테스트
        audio_bytes, elapsed_time = await naver_clova_tts_service.text_to_speech_bytes(text)
        
        if audio_bytes:
            print(f"✅ 비동기 Bytes 성공: {len(audio_bytes)} bytes ({elapsed_time:.2f}초)")
        else:
            print("❌ 비동기 Bytes 실패")
    
    # 리소스 정리
    await naver_clova_tts_service.close()
    print("\n🔒 리소스 정리 완료")


if __name__ == "__main__":
    asyncio.run(test_naver_clova_tts())
