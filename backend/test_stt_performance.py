"""
STT 성능 테스트 스크립트
실제 응답 속도를 측정하기 위한 테스트 도구
"""

import asyncio
import time
import wave
import io
import sys
import os

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))

from app.services.ai_call.stt_service import STTService
from app.config import settings
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_test_audio(text: str = "안녕하세요", duration_sec: float = 2.0) -> bytes:
    """
    테스트용 오디오 생성 (메모리 내)
    
    Args:
        text: 텍스트 (정보용)
        duration_sec: 오디오 길이 (초)
    
    Returns:
        bytes: WAV 포맷 오디오 데이터
    """
    import numpy as np
    import struct
    
    # 8kHz, 16-bit, mono
    sample_rate = 8000
    num_samples = int(sample_rate * duration_sec)
    
    # 간단한 사인파 생성 (테스트용)
    t = np.linspace(0, duration_sec, num_samples)
    frequency = 440  # A4 노트
    audio_data = np.sin(2 * np.pi * frequency * t)
    
    # 정규화 및 16-bit PCM 변환
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # WAV 헤더 생성
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wav_file:
        wav_file.setnchannels(1)      # Mono
        wav_file.setsampwidth(2)      # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    wav_data = wav_io.getvalue()
    logger.info(f"📊 테스트 오디오 생성: {len(wav_data)} bytes ({duration_sec}초)")
    return wav_data


async def test_stt_latency():
    """STT 응답 속도 테스트"""
    
    print("\n" + "="*80)
    print("🎤 STT 성능 테스트 시작")
    print("="*80)
    
    # STT 서비스 초기화
    print(f"\n📋 현재 설정:")
    print(f"   - STT Provider: {settings.STT_PROVIDER}")
    print(f"   - Google STT 모델: {settings.GOOGLE_STT_MODEL}")
    print(f"   - Google STT 언어: {settings.GOOGLE_STT_LANGUAGE_CODE}")
    
    try:
        stt_service = STTService()
        print(f"\n✅ STT 서비스 초기화 완료 ({stt_service.provider})")
    except Exception as e:
        print(f"\n❌ STT 서비스 초기화 실패: {e}")
        return
    
    # 테스트 케이스
    test_cases = [
        {"text": "안녕하세요", "duration": 1.0},
        {"text": "오늘 날씨가 좋네요", "duration": 2.0},
        {"text": "오늘 기분이 어때요", "duration": 2.5},
        {"text": "병원에 가야 해요", "duration": 3.0},
        {"text": "점심 먹었어요", "duration": 1.5},
    ]
    
    results = []
    
    for idx, test_case in enumerate(test_cases, 1):
        print(f"\n{'─'*80}")
        print(f"📝 테스트 {idx}/{len(test_cases)}: \"{test_case['text']}\"")
        print(f"{'─'*80}")
        
        # 테스트 오디오 생성
        audio_data = generate_test_audio(test_case['text'], test_case['duration'])
        
        # STT 호출 및 시간 측정
        try:
            start_time = time.time()
            
            transcript, stt_time = await stt_service.transcribe_audio_chunk(
                audio_data,
                language="ko"
            )
            
            total_time = time.time() - start_time
            
            print(f"\n📊 결과:")
            print(f"   - 텍스트: '{transcript}'")
            print(f"   - STT 시간: {stt_time:.3f}초")
            print(f"   - 총 소요 시간: {total_time:.3f}초")
            
            results.append({
                "text": test_case['text'],
                "duration": test_case['duration'],
                "transcript": transcript,
                "stt_time": stt_time,
                "total_time": total_time
            })
            
        except Exception as e:
            print(f"\n❌ 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                "text": test_case['text'],
                "duration": test_case['duration'],
                "error": str(e)
            })
        
        # 요청 간 대기 (API 레이트 리밋 방지)
        if idx < len(test_cases):
            await asyncio.sleep(1)
    
    # 결과 요약
    print("\n\n" + "="*80)
    print("📊 테스트 결과 요약")
    print("="*80)
    
    successful_tests = [r for r in results if "stt_time" in r]
    
    if successful_tests:
        avg_stt_time = sum(r["stt_time"] for r in successful_tests) / len(successful_tests)
        avg_total_time = sum(r["total_time"] for r in successful_tests) / len(successful_tests)
        min_time = min(r["stt_time"] for r in successful_tests)
        max_time = max(r["stt_time"] for r in successful_tests)
        
        print(f"\n✅ 성공한 테스트: {len(successful_tests)}/{len(test_cases)}")
        print(f"\n⏱️  응답 시간 통계:")
        print(f"   - 평균 STT 시간: {avg_stt_time:.3f}초")
        print(f"   - 평균 총 시간: {avg_total_time:.3f}초")
        print(f"   - 최소 시간: {min_time:.3f}초")
        print(f"   - 최대 시간: {max_time:.3f}초")
        
        print(f"\n📈 상세 결과:")
        for r in successful_tests:
            print(f"   - \"{r['text']}\" ({r['duration']}초): {r['stt_time']:.3f}초")
    else:
        print("\n❌ 모든 테스트 실패")
    
    print("\n" + "="*80)
    print("테스트 완료")
    print("="*80)


async def test_real_audio_file(file_path: str):
    """실제 오디오 파일로 테스트"""
    
    print("\n" + "="*80)
    print(f"🎤 실제 오디오 파일 테스트: {file_path}")
    print("="*80)
    
    if not os.path.exists(file_path):
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        return
    
    # 파일 크기 확인
    file_size = os.path.getsize(file_path)
    print(f"📊 파일 크기: {file_size} bytes")
    
    # 오디오 파일 읽기
    with open(file_path, 'rb') as f:
        audio_data = f.read()
    
    # STT 서비스 초기화
    try:
        stt_service = STTService()
    except Exception as e:
        print(f"❌ STT 서비스 초기화 실패: {e}")
        return
    
    # STT 호출
    try:
        start_time = time.time()
        
        transcript, stt_time = await stt_service.transcribe_audio_chunk(
            audio_data,
            language="ko"
        )
        
        total_time = time.time() - start_time
        
        print(f"\n📊 결과:")
        print(f"   - 텍스트: '{transcript}'")
        print(f"   - STT 시간: {stt_time:.3f}초")
        print(f"   - 총 소요 시간: {total_time:.3f}초")
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='STT 성능 테스트')
    parser.add_argument(
        '--file', 
        type=str, 
        help='실제 오디오 파일 경로 (WAV 형식)'
    )
    parser.add_argument(
        '--synthetic', 
        action='store_true',
        help='합성 오디오로 테스트 (기본값)'
    )
    
    args = parser.parse_args()
    
    if args.file:
        # 실제 파일로 테스트
        asyncio.run(test_real_audio_file(args.file))
    else:
        # 합성 오디오로 테스트
        asyncio.run(test_stt_latency())


if __name__ == "__main__":
    main()

