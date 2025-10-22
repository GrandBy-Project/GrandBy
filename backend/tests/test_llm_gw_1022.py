import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json

# 프로젝트 루트 경로 설정
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 환경 변수 로드
load_dotenv(project_root / '.env')

# 프로젝트 모듈 import
from app.database import get_db
from app.models.call import CallLog, CallTranscript, CallStatus

# LLMService 직접 import (Google Cloud 의존성 회피)
import importlib.util
spec = importlib.util.spec_from_file_location("llm_service", project_root / "app" / "services" / "ai_call" / "llm_service.py")
llm_service_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(llm_service_module)
LLMService = llm_service_module.LLMService

class RealDBTestSimulator:
    def __init__(self):
        self.llm_service = LLMService()
    
    def create_mock_call_data(self, conversation_data):
        """실제 CallTranscript와 동일한 구조로 테스트 데이터 생성 (메모리에서)"""
        # 실제 DB 없이 메모리에서 시뮬레이션
        call_id = "test-call-001"
        
        # CallTranscript 객체들을 메모리에서 생성
        transcripts = []
        timestamp = 0.0
        
        for speaker, text in conversation_data:
            # 실제 CallTranscript 객체와 동일한 구조로 생성
            transcript = type('CallTranscript', (), {
                'call_id': call_id,
                'speaker': speaker,  # 'AI' or 'ELDERLY'
                'text': text,
                'timestamp': timestamp
            })()
            transcripts.append(transcript)
            timestamp += 5.0  # 5초 간격으로 가정
        
        return call_id, transcripts
    
    def test_todo_extraction_real_format(self, conversation_data):
        """실제 DB 형식으로 TODO 추출 테스트"""
        print("=== 실제 DB 형식 TODO 추출 테스트 ===")
        
        # 1. 테스트 데이터 생성 (메모리에서)
        call_id, transcripts = self.create_mock_call_data(conversation_data)
        print(f"생성된 Call ID: {call_id}")
        
        # 2. 실제 라우터와 동일한 방식으로 데이터 처리
        # 실제 calls.py의 get_extracted_todos와 동일한 로직
        transcripts_from_db = sorted(transcripts, key=lambda x: x.timestamp)
        
        # 3. 대화 텍스트 조합 (실제와 동일)
        conversation_text = "\n".join([
            f"{t.speaker}: {t.text}" for t in transcripts_from_db
        ])
        
        print(f"DB에서 조회된 대화 내용:")
        print(conversation_text)
        print(f"대화 길이: {len(conversation_text)} characters")
        
        # 4. LLM으로 TODO 추출 (실제와 동일)
        extracted_json = self.llm_service.extract_schedule_from_conversation(conversation_text)
        
        # 5. JSON 파싱 및 결과 검증 (실제와 동일)
        result = json.loads(extracted_json)
        todos = []
        if isinstance(result, dict) and "schedules" in result:
            todos = result["schedules"]
        elif isinstance(result, list):
            todos = result
        
        print(f"\n추출된 TODO 개수: {len(todos)}")
        for i, todo in enumerate(todos, 1):
            print(f"{i}. {todo}")
        
        return todos
    
    def test_diary_generation_real_format(self, conversation_data):
        """실제 DB 형식으로 일기 생성 테스트"""
        print("\n=== 실제 DB 형식 일기 생성 테스트 ===")
        
        # 1. 테스트 데이터 생성 (메모리에서)
        call_id, transcripts = self.create_mock_call_data(conversation_data)
        
        # 2. 실제 라우터와 동일한 방식으로 데이터 처리
        transcripts_from_db = sorted(transcripts, key=lambda x: x.timestamp)
        
        # 3. 대화 기록을 conversation_history 형식으로 변환
        conversation_history = []
        for transcript in transcripts_from_db:
            role = "user" if transcript.speaker == "ELDERLY" else "assistant"
            conversation_history.append({
                "role": role,
                "content": transcript.text
            })
        
        print(f"변환된 대화 기록:")
        for msg in conversation_history:
            speaker = "어르신" if msg["role"] == "user" else "AI"
            print(f"{speaker}: {msg['content']}")
        
        # 4. LLM으로 일기 생성 (실제와 동일)
        diary = self.llm_service.summarize_call_conversation(conversation_history)
        
        print(f"\n생성된 일기:")
        print(diary)
        
        return diary

# 테스트 실행
if __name__ == "__main__":
    simulator = RealDBTestSimulator()
    
    # 실제 통화 시나리오 시뮬레이션
    test_conversations = [
        {
            "name": "구체적 날짜 있는 일정",
            "data": [
                ("AI", "안녕하세요! 오늘은 어떻게 지내셨어요?"),
                ("ELDERLY", "안녕하세요. 내일 병원에 가야 해요"),
                ("AI", "병원이요? 어떤 진료를 받으시나요?"),
                ("ELDERLY", "정형외과에서 무릎 검사 받을 예정이에요"),
                ("AI", "몇 시에 예약되어 있나요?"),
                ("ELDERLY", "오후 3시입니다"),
                ("AI", "그렇군요. 조심히 다녀오세요!")
            ]
        },
        {
            "name": "막연한 계획 (날짜 없음)",
            "data": [
                ("AI", "안녕하세요! 오늘은 어떻게 지내셨어요?"),
                ("ELDERLY", "그냥 평범하게 지냈어요"),
                ("AI", "혹시 산책은 하셨나요?"),
                ("ELDERLY", "손자랑 산책을 가기로 했어"),
                ("AI", "산책이 좋죠! 언제 가실 예정이신가요?"),
                ("ELDERLY", "아직 정하지 않았어요"),
                ("AI", "그렇군요. 날씨가 좋을 때 가시면 좋겠어요!")
            ]
        },
        {
            "name": "약 복용 언급 없는 대화",
            "data": [
                ("AI", "안녕하세요! 오늘은 어떻게 지내셨어요?"),
                ("ELDERLY", "오늘 날씨가 좋아서 산책했어요"),
                ("AI", "산책이 좋죠! 기분이 어떠셨어요?"),
                ("ELDERLY", "정말 상쾌했어요"),
                ("AI", "좋으시겠어요! 내일도 좋은 하루 되세요!"),
                ("ELDERLY", "네, 감사합니다")
            ]
        }
    ]
    
    for test_case in test_conversations:
        print(f"\n{'='*60}")
        print(f"테스트 케이스: {test_case['name']}")
        print(f"{'='*60}")
        
        # TODO 추출 테스트
        todos = simulator.test_todo_extraction_real_format(test_case['data'])
        
        # 일기 생성 테스트
        diary = simulator.test_diary_generation_real_format(test_case['data'])
        
        print(f"\n결과 요약:")
        print(f"- 추출된 TODO: {len(todos)}개")
        print(f"- 일기 생성: {'성공' if diary else '실패'}")