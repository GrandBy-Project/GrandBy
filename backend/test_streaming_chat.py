#!/usr/bin/env python3
"""
스트리밍 방식 텍스트 → LLM → TTS 테스트 스크립트

사용법:
    python test_streaming_chat.py
"""

import requests
import json
import base64
import io
import sys

try:
    from pydub import AudioSegment
    from pydub.playback import play
    AUDIO_AVAILABLE = True
except ImportError:
    print("⚠️  경고: pydub가 설치되지 않아 음성 재생을 건너뜁니다.")
    print("   설치: pip install pydub")
    AUDIO_AVAILABLE = False


def test_streaming_chat(message: str, base_url: str = "http://localhost:8000"):
    """
    스트리밍 방식 챗봇 테스트
    
    Args:
        message: 전송할 메시지
        base_url: 서버 URL
    """
    url = f"{base_url}/api/test/text-tts-chat-streaming"
    
    print(f"\n{'='*60}")
    print(f"🔥 스트리밍 테스트 시작")
    print(f"{'='*60}")
    print(f"💬 사용자 입력: {message}\n")
    print(f"🤖 AI 응답: ", end='', flush=True)
    
    try:
        response = requests.post(
            url,
            json={"message": message},
            stream=True,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"\n❌ 오류: HTTP {response.status_code}")
            print(response.text)
            return
        
        full_text = ""
        sentence_count = 0
        
        # SSE 스트림 파싱
        for line in response.iter_lines():
            if not line:
                continue
                
            line_str = line.decode('utf-8')
            
            # 이벤트 타입 파싱
            if line_str.startswith('event: '):
                event_type = line_str[7:]
                continue
            
            # 데이터 파싱
            if line_str.startswith('data: '):
                try:
                    data = json.loads(line_str[6:])
                    
                    if data.get('type') == 'text':
                        # 텍스트 실시간 출력
                        content = data['content']
                        print(content, end='', flush=True)
                        full_text += content
                        
                    elif data.get('type') == 'audio':
                        # 오디오 수신
                        sentence_count += 1
                        sentence = data.get('sentence', '')
                        tts_time = data.get('tts_time', 0)
                        
                        print(f"\n   └─ 🔊 문장 #{sentence_count} TTS 완료 ({tts_time:.2f}초): \"{sentence}\"")
                        
                        # 오디오 재생 (가능한 경우)
                        if AUDIO_AVAILABLE:
                            try:
                                audio_base64 = data['content']
                                audio_bytes = base64.b64decode(audio_base64)
                                audio = AudioSegment.from_wav(io.BytesIO(audio_bytes))
                                play(audio)
                                print(f"   └─ ✅ 재생 완료")
                            except Exception as e:
                                print(f"   └─ ⚠️  재생 실패: {e}")
                        
                    elif data.get('type') == 'done':
                        # 완료 정보
                        timing = data.get('timing', {})
                        
                        print(f"\n\n{'='*60}")
                        print(f"✅ 처리 완료")
                        print(f"{'='*60}")
                        print(f"📊 성능 측정:")
                        print(f"   - LLM 스트리밍: {timing.get('llm_streaming_time', 0)}초")
                        print(f"   - TTS 총 시간: {timing.get('total_tts_time', 0)}초")
                        print(f"   - TTS 평균: {timing.get('avg_tts_time', 0)}초")
                        print(f"   - 문장 개수: {timing.get('sentence_count', 0)}개")
                        print(f"   - 전체 시간: {timing.get('total_time', 0)}초")
                        print(f"{'='*60}\n")
                        
                    elif data.get('error'):
                        # 오류
                        print(f"\n❌ 오류: {data['error']}")
                        
                except json.JSONDecodeError as e:
                    print(f"\n⚠️  JSON 파싱 오류: {e}")
                    print(f"   원본 데이터: {line_str}")
                    
    except requests.exceptions.RequestException as e:
        print(f"\n❌ 네트워크 오류: {e}")
    except KeyboardInterrupt:
        print(f"\n\n⚠️  사용자 중단")
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()


def interactive_mode(base_url: str = "http://localhost:8000"):
    """대화형 모드"""
    print("""
╔══════════════════════════════════════════════════════════╗
║       🔥 스트리밍 AI 챗봇 테스트 (대화형 모드)        ║
╚══════════════════════════════════════════════════════════╝

명령어:
  - 메시지 입력: 일반 텍스트 입력
  - 'exit' 또는 'quit': 종료
  - 'clear': 화면 지우기
""")
    
    while True:
        try:
            user_input = input("\n💬 입력: ").strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['exit', 'quit', 'q']:
                print("\n👋 종료합니다.")
                break
                
            if user_input.lower() == 'clear':
                import os
                os.system('cls' if os.name == 'nt' else 'clear')
                continue
            
            test_streaming_chat(user_input, base_url)
            
        except KeyboardInterrupt:
            print("\n\n👋 종료합니다.")
            break
        except EOFError:
            break


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="스트리밍 방식 AI 챗봇 테스트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예제:
  # 단일 메시지 테스트
  python test_streaming_chat.py -m "오늘 날씨 어때요?"
  
  # 대화형 모드
  python test_streaming_chat.py -i
  
  # 커스텀 서버 URL
  python test_streaming_chat.py -u http://example.com:8000 -m "안녕하세요"
"""
    )
    
    parser.add_argument(
        '-m', '--message',
        type=str,
        help='전송할 메시지'
    )
    parser.add_argument(
        '-i', '--interactive',
        action='store_true',
        help='대화형 모드 실행'
    )
    parser.add_argument(
        '-u', '--url',
        type=str,
        default='http://localhost:8000',
        help='서버 URL (기본: http://localhost:8000)'
    )
    
    args = parser.parse_args()
    
    # 서버 연결 테스트
    try:
        response = requests.get(f"{args.url}/health", timeout=5)
        if response.status_code != 200:
            print(f"⚠️  경고: 서버가 응답하지 않습니다 ({args.url})")
            print(f"   백엔드 서버를 실행했는지 확인하세요:")
            print(f"   cd backend && uvicorn app.main:app --reload")
    except requests.exceptions.RequestException:
        print(f"❌ 서버에 연결할 수 없습니다: {args.url}")
        print(f"   백엔드 서버를 실행했는지 확인하세요:")
        print(f"   cd backend && uvicorn app.main:app --reload")
        sys.exit(1)
    
    # 모드 선택
    if args.interactive:
        interactive_mode(args.url)
    elif args.message:
        test_streaming_chat(args.message, args.url)
    else:
        # 기본: 샘플 메시지로 테스트
        print("ℹ️  '-m' 또는 '-i' 옵션을 지정하세요.")
        print("   예: python test_streaming_chat.py -i")
        print("\n기본 샘플 메시지로 테스트를 실행합니다...\n")
        test_streaming_chat("오늘 날씨 어때요?", args.url)


if __name__ == "__main__":
    main()

