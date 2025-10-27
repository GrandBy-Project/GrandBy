"""
테스트용 음성 파일 생성
간단한 한국어 음성 샘플을 생성
"""

import wave
import io
import sys
import os

def generate_simple_audio(text: str = "안녕하세요", duration: float = 2.0):
    """간단한 음성 파일 생성"""
    import math
    
    sample_rate = 8000
    num_samples = int(sample_rate * duration)
    
    # 16-bit PCM 데이터 생성
    audio_data = []
    for i in range(num_samples):
        # 두 가지 주파수를 혼합 (더 자연스러운 소리)
        freq1 = 440  # A4
        freq2 = 550  # C#5
        sample = int(
            (math.sin(2 * math.pi * freq1 * i / sample_rate) * 0.6 + 
             math.sin(2 * math.pi * freq2 * i / sample_rate) * 0.4) * 32767
        )
        audio_data.extend([sample & 0xFF, (sample >> 8) & 0xFF])
    
    audio_bytes = bytes(audio_data)
    
    # WAV 파일로 저장
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as w:
        w.setnchannels(1)  # Mono
        w.setsampwidth(2)  # 16-bit
        w.setframerate(sample_rate)
        w.writeframes(audio_bytes)
    
    return wav_io.getvalue()


def main():
    # 간단한 한국어 단어들로 테스트 파일 생성
    test_phrases = [
        ("안녕하세요", 2.0),
        ("오늘 날씨가 좋네요", 3.0),
        ("병원에 가야 해요", 3.0),
        ("점심 먹었어요", 2.5),
    ]
    
    output_dir = "/app/test_audio"
    os.makedirs(output_dir, exist_ok=True)
    
    print("="*60)
    print("🎤 테스트 음성 파일 생성")
    print("="*60)
    
    for phrase, duration in test_phrases:
        audio_data = generate_simple_audio(phrase, duration)
        filename = f"{output_dir}/{phrase.replace(' ', '_')}.wav"
        
        with open(filename, 'wb') as f:
            f.write(audio_data)
        
        print(f"✅ 생성 완료: {filename} ({len(audio_data)} bytes, {duration}초)")
    
    print("\n" + "="*60)
    print("📁 생성된 파일 목록:")
    print("="*60)
    
    for phrase, _ in test_phrases:
        filename = f"{output_dir}/{phrase.replace(' ', '_')}.wav"
        if os.path.exists(filename):
            size = os.path.getsize(filename)
            print(f"   - {filename} ({size:,} bytes)")
    
    print("\n💡 사용 방법:")
    print("   docker exec -it grandby_api python /app/test_stt_real_audio.py /app/test_audio/안녕하세요.wav")
    print("="*60)


if __name__ == "__main__":
    main()

