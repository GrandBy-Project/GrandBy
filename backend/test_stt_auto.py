"""
자동으로 STT 테스트
컨테이너 내부의 파일을 사용하여 자동 테스트
"""

import asyncio
import time
import sys
import os
from pathlib import Path

sys.path.insert(0, '/app')


async def test_all_audio_files():
    """test_audio 디렉토리의 모든 파일로 테스트"""
    
    print("="*80)
    print("🎤 실제 음성 파일로 STT 테스트 (자동)")
    print("="*80)
    
    audio_dir = "/app/test_audio"
    
    # 파일 목록 확인
    if not os.path.exists(audio_dir):
        print(f"❌ 디렉토리를 찾을 수 없습니다: {audio_dir}")
        return
    
    files = [f for f in os.listdir(audio_dir) if f.endswith('.wav')]
    
    if not files:
        print(f"❌ 테스트 파일이 없습니다: {audio_dir}")
        return
    
    print(f"\n📁 발견된 파일: {len(files)}개")
    for f in files:
        print(f"   - {f}")
    
    # STT 서비스 초기화
    print(f"\n🔧 STT 서비스 초기화 중...")
    from app.services.ai_call.stt_service import STTService
    from app.config import settings
    
    stt_service = STTService()
    print(f"✅ STT 서비스 초기화 완료 ({stt_service.provider})")
    
    # 각 파일로 테스트
    print(f"\n📈 STT 테스트 시작...\n")
    print("="*80)
    
    all_results = []
    
    for idx, filename in enumerate(files, 1):
        filepath = os.path.join(audio_dir, filename)
        file_size = os.path.getsize(filepath)
        
        print(f"\n📝 테스트 {idx}/{len(files)}: {filename}")
        print(f"   파일 크기: {file_size:,} bytes ({file_size/1024:.2f} KB)")
        
        # 파일 읽기
        try:
            with open(filepath, 'rb') as f:
                audio_data = f.read()
        except Exception as e:
            print(f"   ❌ 파일 읽기 실패: {e}")
            continue
        
        # STT 호출 (2회)
        for attempt in range(2):
            try:
                start_time = time.time()
                
                transcript, stt_time = await stt_service.transcribe_audio_chunk(
                    audio_data,
                    language='ko'
                )
                
                total_time = time.time() - start_time
                
                print(f"   ⏱️  시도 {attempt+1}: 총 {total_time:.3f}초 (STT: {stt_time:.3f}초)")
                print(f"   📝 해석: '{transcript}'")
                
                all_results.append({
                    'file': filename,
                    'transcript': transcript,
                    'total_time': total_time,
                    'stt_time': stt_time,
                    'file_size': file_size
                })
                
                break  # 성공했으면 다음 파일로
                
            except Exception as e:
                print(f"   ❌ 오류 (시도 {attempt+1}): {e}")
                if attempt == 1:  # 마지막 시도 실패
                    all_results.append({
                        'file': filename,
                        'error': str(e)
                    })
        
        # 요청 간 대기
        if idx < len(files):
            await asyncio.sleep(1)
    
    # 최종 결과
    print("\n" + "="*80)
    print("📊 최종 결과 요약")
    print("="*80)
    
    successful = [r for r in all_results if 'transcript' in r]
    
    if successful:
        avg_total = sum(r['total_time'] for r in successful) / len(successful)
        avg_stt = sum(r['stt_time'] for r in successful) / len(successful)
        min_time = min(r['total_time'] for r in successful)
        max_time = max(r['total_time'] for r in successful)
        
        print(f"\n✅ 성공: {len(successful)}/{len(all_results)}")
        print(f"\n⏱️  응답 시간 통계:")
        print(f"   - 평균: {avg_total:.3f}초 ({avg_total*1000:.0f}ms)")
        print(f"   - 최소: {min_time:.3f}초 ({min_time*1000:.0f}ms)")
        print(f"   - 최대: {max_time:.3f}초 ({max_time*1000:.0f}ms)")
        
        print(f"\n📝 해석 결과:")
        for r in successful:
            print(f"   - {r['file']}: '{r['transcript']}' ({r['total_time']:.3f}초)")
        
        # 파일 크기별 분석
        print(f"\n📊 파일 크기별 성능:")
        size_groups = {}
        for r in successful:
            size_range = f"{r['file_size']//1000}KB"
            if size_range not in size_groups:
                size_groups[size_range] = []
            size_groups[size_range].append(r['total_time'])
        
        for size, times in sorted(size_groups.items()):
            avg_t = sum(times) / len(times)
            print(f"   - {size}: 평균 {avg_t:.3f}초 ({len(times)}회)")
    
    else:
        print("\n❌ 모든 테스트 실패")
    
    print("="*80)


if __name__ == "__main__":
    asyncio.run(test_all_audio_files())

