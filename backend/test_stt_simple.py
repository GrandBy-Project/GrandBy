"""
간단한 STT 성능 테스트
"""
import asyncio
import time
import io
import wave
import math
import sys
import os

sys.path.insert(0, '/app')

async def main():
    print("="*60)
    print("🎤 STT 성능 테스트 시작")
    print("="*60)
    
    # STT 서비스 초기화
    from app.services.ai_call.stt_service import STTService
    from app.config import settings
    
    print(f"\n📋 현재 설정:")
    print(f"   - STT Provider: {settings.STT_PROVIDER}")
    print(f"   - Google 모델: {settings.GOOGLE_STT_MODEL}")
    print(f"   - 언어: {settings.GOOGLE_STT_LANGUAGE_CODE}")
    
    stt_service = STTService()
    print(f"\n✅ STT 서비스 초기화 완료 ({stt_service.provider})")
    
    # 테스트 오디오 생성 (간단한 사인파)
    import math
    sample_rate = 8000
    duration = 2.0
    num_samples = int(sample_rate * duration)
    
    # 16-bit PCM 데이터 생성
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
    
    wav_data = wav_io.getvalue()
    print(f"\n📊 테스트 오디오 생성: {len(wav_data)} bytes ({duration}초)")
    
    # STT 테스트 (5회 반복)
    print("\n📈 STT 응답 시간 측정 중...")
    times = []
    
    for i in range(5):
        start_time = time.time()
        result = await stt_service.transcribe_audio_chunk(wav_data, 'ko')
        elapsed = time.time() - start_time
        stt_time = result[1]
        transcript = result[0]
        
        times.append({'elapsed': elapsed, 'stt_time': stt_time})
        print(f"   테스트 {i+1}/5: 총 {elapsed:.3f}초 (STT: {stt_time:.3f}초) - '{transcript}'")
        
        if i < 4:  # 마지막 제외
            await asyncio.sleep(1)
    
    # 결과 요약
    print("\n" + "="*60)
    print("📊 결과 요약")
    print("="*60)
    avg_elapsed = sum(t['elapsed'] for t in times) / len(times)
    avg_stt = sum(t['stt_time'] for t in times) / len(times)
    min_time = min(t['stt_time'] for t in times)
    max_time = max(t['stt_time'] for t in times)
    
    print(f"\n⏱️  평균 응답 시간: {avg_elapsed:.3f}초")
    print(f"⏱️  평균 STT 시간: {avg_stt:.3f}초")
    print(f"⏱️  최소 시간: {min_time:.3f}초")
    print(f"⏱️  최대 시간: {max_time:.3f}초")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())

