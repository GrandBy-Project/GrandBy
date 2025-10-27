"""
실제 음성 파일로 STT 테스트
음성 파일을 읽어서 실제 응답 시간과 해석 정확도를 측정
"""

import asyncio
import time
import sys
import os
from pathlib import Path

sys.path.insert(0, '/app')


async def test_with_audio_file(file_path: str):
    """실제 음성 파일로 STT 테스트"""
    
    print("="*80)
    print(f"🎤 실제 음성 파일로 STT 테스트")
    print("="*80)
    
    # 파일 존재 확인
    if not os.path.exists(file_path):
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        return
    
    # 파일 정보
    file_size = os.path.getsize(file_path)
    file_ext = Path(file_path).suffix.lower()
    
    print(f"\n📋 파일 정보:")
    print(f"   - 경로: {file_path}")
    print(f"   - 크기: {file_size:,} bytes ({file_size/1024:.2f} KB)")
    print(f"   - 확장자: {file_ext}")
    
    # 파일 읽기
    print(f"\n📂 파일 읽는 중...")
    with open(file_path, 'rb') as f:
        audio_data = f.read()
    
    print(f"✅ 파일 읽기 완료: {len(audio_data)} bytes")
    
    # STT 서비스 초기화
    print(f"\n🔧 STT 서비스 초기화 중...")
    from app.services.ai_call.stt_service import STTService
    from app.config import settings
    
    print(f"   - Provider: {settings.STT_PROVIDER}")
    print(f"   - 모델: {settings.GOOGLE_STT_MODEL}")
    print(f"   - 언어: {settings.GOOGLE_STT_LANGUAGE_CODE}")
    
    stt_service = STTService()
    print(f"✅ STT 서비스 초기화 완료 ({stt_service.provider})")
    
    # STT 테스트 (3회 반복)
    print(f"\n📈 STT 응답 시간 측정 중 (3회 반복)...")
    print("─"*80)
    
    results = []
    
    for i in range(3):
        print(f"\n테스트 {i+1}/3 실행 중...")
        start_time = time.time()
        
        try:
            transcript, stt_time = await stt_service.transcribe_audio_chunk(
                audio_data,
                language='ko'
            )
            
            total_time = time.time() - start_time
            
            print(f"   ⏱️  총 소요 시간: {total_time:.3f}초 (STT: {stt_time:.3f}초)")
            print(f"   📝 해석된 텍스트: '{transcript}'")
            
            results.append({
                'transcript': transcript,
                'total_time': total_time,
                'stt_time': stt_time
            })
            
        except Exception as e:
            print(f"   ❌ 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            results.append({'error': str(e)})
        
        # 요청 간 대기 (Rate limit 방지)
        if i < 2:
            print(f"   ⏳ 1초 대기 중...")
            await asyncio.sleep(1)
    
    # 결과 요약
    successful = [r for r in results if 'transcript' in r]
    
    if successful:
        print("\n" + "="*80)
        print("📊 최종 결과")
        print("="*80)
        
        avg_total = sum(r['total_time'] for r in successful) / len(successful)
        avg_stt = sum(r['stt_time'] for r in successful) / len(successful)
        min_time = min(r['total_time'] for r in successful)
        max_time = max(r['total_time'] for r in successful)
        
        print(f"\n✅ 성공한 테스트: {len(successful)}/{len(results)}")
        print(f"\n⏱️  응답 시간:")
        print(f"   - 평균: {avg_total:.3f}초 ({avg_total*1000:.0f}ms)")
        print(f"   - 최소: {min_time:.3f}초 ({min_time*1000:.0f}ms)")
        print(f"   - 최대: {max_time:.3f}초 ({max_time*1000:.0f}ms)")
        
        print(f"\n📝 해석 결과:")
        transcripts = set(r['transcript'] for r in successful if r['transcript'].strip())
        for idx, txt in enumerate(transcripts, 1):
            print(f"   {idx}. '{txt}'")
        
        # 일관성 체크
        if len(transcripts) == 1:
            print(f"\n✅ 해석이 일관됩니다")
        else:
            print(f"\n⚠️  해석이 일관되지 않습니다 (확인 필요)")
        
        print("="*80)
    else:
        print("\n❌ 모든 테스트 실패")
        print(results)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='실제 음성 파일로 STT 테스트')
    parser.add_argument('file', help='테스트할 음성 파일 경로 (WAV, MP3, M4A 등)')
    
    args = parser.parse_args()
    
    asyncio.run(test_with_audio_file(args.file))


if __name__ == "__main__":
    main()

