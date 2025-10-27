"""
RTZR WebSocket STT 전체 테스트
실제 통화 환경을 시뮬레이션
"""
import asyncio
import time
import math
import io
import wave
import sys
import os

sys.path.insert(0, '/app')


def generate_audio(text, duration=2.0):
    """테스트용 오디오 생성"""
    sample_rate = 8000
    num_samples = int(sample_rate * duration)
    
    audio_data = []
    for i in range(num_samples):
        sample = int(math.sin(2 * math.pi * 440 * i / sample_rate) * 32767)
        audio_data.extend([sample & 0xFF, (sample >> 8) & 0xFF])
    
    audio_bytes = bytes(audio_data)
    
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(audio_bytes)
    
    return wav_io.getvalue()


async def test_full_rtzr_pipeline():
    """전체 RTZR 파이프라인 테스트"""
    print("="*80)
    print("🎤 RTZR WebSocket STT 전체 테스트")
    print("="*80)
    
    # STT 서비스 초기화
    from app.services.ai_call.stt_service import STTService
    from app.config import settings
    
    print(f"\n📋 현재 설정:")
    print(f"   - STT_PROVIDER: {settings.STT_PROVIDER}")
    print(f"   - RTZR API Base: {settings.RTZR_API_BASE}")
    print(f"   - RTZR Client ID: {settings.RTZR_CLIENT_ID[:10]}...")
    
    try:
        stt = STTService()
        print(f"\n✅ STT 서비스 초기화 성공")
        print(f"   - Provider: {stt.provider}")
        
        if stt.provider != "rtzr":
            print(f"⚠️ 경고: RTZR이 아닌 {stt.provider}가 활성화되었습니다")
            
    except Exception as e:
        print(f"\n❌ STT 서비스 초기화 실패: {e}")
        return
    
    # 테스트 오디오 생성
    print(f"\n📊 테스트 오디오 생성 중...")
    audio = generate_audio("테스트", 2.0)
    print(f"✅ 생성 완료: {len(audio)} bytes")
    
    # STT 호출 및 시간 측정
    print(f"\n📈 RTZR STT 호출 중...")
    
    times = []
    results = []
    
    for i in range(3):
        print(f"\n{'─'*80}")
        print(f"테스트 {i+1}/3")
        print(f"{'─'*80}")
        
        try:
            start_time = time.time()
            
            transcript, stt_time = await stt.transcribe_audio_chunk(audio, 'ko')
            
            total_time = time.time() - start_time
            
            print(f"   ⏱️  총 시간: {total_time:.3f}초")
            print(f"   ⏱️  STT 시간: {stt_time:.3f}초")
            print(f"   📝 결과: '{transcript}'")
            
            times.append(total_time)
            results.append(transcript)
            
        except Exception as e:
            print(f"   ❌ 오류: {e}")
        
        if i < 2:
            await asyncio.sleep(1)
    
    # 결과 요약
    if times:
        print(f"\n{'='*80}")
        print("📊 최종 결과")
        print(f"{'='*80}")
        print(f"\n⏱️  응답 시간:")
        print(f"   - 평균: {sum(times)/len(times):.3f}초 ({sum(times)/len(times)*1000:.0f}ms)")
        print(f"   - 최소: {min(times):.3f}초 ({min(times)*1000:.0f}ms)")
        print(f"   - 최대: {max(times):.3f}초 ({max(times)*1000:.0f}ms)")
        
        print(f"\n📝 결과:")
        unique_results = set(results)
        for idx, result in enumerate(unique_results, 1):
            print(f"   {idx}. '{result}'")
        
        if len(unique_results) == 1:
            print("\n✅ 모든 테스트에서 일관된 결과")
        else:
            print("\n⚠️ 결과가 일관되지 않습니다")
        
        print(f"{'='*80}")
    
    print(f"\n🎉 테스트 완료!")
    print(f"\n💡 실제 AI 통화 사용 가능 여부: {'✅ 가능' if stt.provider == 'rtzr' else '❌ 불가능'}")

if __name__ == "__main__":
    asyncio.run(test_full_rtzr_pipeline())

