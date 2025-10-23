#!/usr/bin/env python3
"""
Schedule Extraction Test Script
Test the schedule extraction prompt with real DB and sample conversations
"""

import os
import sys
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
sys.path.append('/app')

from app.database import get_db
from app.services.ai_call.llm_service import LLMService
from sqlalchemy.orm import Session
from sqlalchemy import text

def get_latest_conversation():
    """Get the latest conversation data from database."""
    db = next(get_db())
    
    try:
        # 가장 최신 통화 로그 조회
        call_query = text("""
            SELECT call_id, elderly_id, created_at
            FROM call_logs 
            ORDER BY created_at DESC 
            LIMIT 1
        """)
        
        call_result = db.execute(call_query).fetchone()
        
        if not call_result:
            print("❌ No call data found.")
            return None
        
        # 해당 통화의 전사본 조회
        transcript_query = text("""
            SELECT speaker, text, timestamp
            FROM call_transcripts 
            WHERE call_id = :call_id 
            ORDER BY timestamp
        """)
        
        transcript_results = db.execute(transcript_query, {'call_id': call_result.call_id}).fetchall()
        
        # 사용자 정보 조회
        user_query = text("""
            SELECT name FROM users WHERE user_id = :elderly_id
        """)
        user_result = db.execute(user_query, {'elderly_id': call_result.elderly_id}).fetchone()
        
        return {
            'call_id': call_result.call_id,
            'user_name': user_result.name if user_result else 'Unknown',
            'created_at': call_result.created_at,
            'transcripts': [
                {'speaker': t.speaker, 'text': t.text, 'timestamp': t.timestamp}
                for t in transcript_results
            ]
        }
        
    except Exception as e:
        print(f"❌ Database query error: {e}")
        return None

def get_sample_conversations():
    """Get predefined sample conversations for testing."""
    
    # Sample Conversation 1: Positive mood, daily activities
    conversation_1 = [
        {"role": "user", "content": "안녕하세요. 오늘 기분이 좋아요."},
        {"role": "assistant", "content": "안녕하세요! 기분이 좋으시다니 저도 기쁩니다. 오늘은 어떤 일이 있으셨나요?"},
        {"role": "user", "content": "아침에 산책을 했어요. 날씨가 정말 좋았어요."},
        {"role": "assistant", "content": "산책하셨군요! 좋은 날씨에 산책하시면 기분이 더 좋아지시겠어요. 어디로 산책하셨나요?"},
        {"role": "user", "content": "공원에 갔어요. 꽃도 피어있고 새소리도 들려서 정말 좋았어요."},
        {"role": "assistant", "content": "공원에서 자연을 만끽하셨군요! 그런 환경에서 산책하시면 마음도 편안해지시겠어요."},
        {"role": "user", "content": "네, 그리고 내일은 딸이랑 점심을 먹기로 했어요."},
        {"role": "assistant", "content": "딸님과 점심 약속이 있으시군요! 어떤 음식을 드실 예정인가요?"},
        {"role": "user", "content": "딸이 좋아하는 한식집에 갈 거예요. 벌써부터 기대돼요."}
    ]
    
    # Sample Conversation 2: Health concerns, family
    conversation_2 = [
        {"role": "user", "content": "안녕하세요. 오늘 좀 피곤해요."},
        {"role": "assistant", "content": "안녕하세요! 피곤하시군요. 혹시 몸이 아프신가요?"},
        {"role": "user", "content": "어제 밤에 잠을 잘 못 잤어요. 무릎이 아파서요."},
        {"role": "assistant", "content": "무릎이 아프시군요. 많이 불편하셨을 것 같아요. 약은 드셨나요?"},
        {"role": "user", "content": "아침에 진통제를 먹었어요. 그래도 아직 좀 아파요."},
        {"role": "assistant", "content": "진통제를 드셨군요. 무릎이 아프면 움직이기도 힘드실 것 같아요. 오늘은 푹 쉬시는 게 좋겠어요."},
        {"role": "user", "content": "네, 오늘은 집에서 쉬려고 해요. 아들이 전화해서 내일 병원에 같이 가자고 했어요."},
        {"role": "assistant", "content": "아드님이 병원에 같이 가자고 하셨군요! 정말 다행이에요. 무릎 검사를 받으실 건가요?"},
        {"role": "user", "content": "네, 정형외과에 가서 무릎을 봐달라고 할 거예요. 아들이 있어서 마음이 든든해요."}
    ]
    
    return [
        {
            "name": "Sample 1: Positive Day",
            "description": "Good mood, park walk, daughter lunch plan",
            "conversation": conversation_1
        },
        {
            "name": "Sample 2: Health Concern", 
            "description": "Tired, knee pain, hospital visit with son",
            "conversation": conversation_2
        }
    ]

def format_conversation_for_extraction(conversation_history):
    """Convert conversation history to text format for schedule extraction."""
    return "\n".join([
        f"{'어르신' if msg['role'] == 'user' else 'AI'}: {msg['content']}"
        for msg in conversation_history
    ])

def test_schedule_extraction(conversation_data, llm_service, is_real_db=False):
    """Test schedule extraction for a single conversation."""
    if is_real_db:
        print(f"\n📞 Testing Real DB: {conversation_data['user_name']}'s call")
        print(f"📅 Call Time: {conversation_data['created_at']}")
        print(f"💬 Conversation Turns: {len(conversation_data['transcripts'])}")
        
        # Convert DB transcripts to conversation format
        conversation_history = []
        for transcript in conversation_data['transcripts']:
            role = "user" if transcript['speaker'] == "ELDERLY" else "assistant"
            conversation_history.append({
                "role": role,
                "content": transcript['text']
            })
        
        # Display conversation content
        print(f"\n💬 Conversation Content:")
        print("-" * 30)
        for i, transcript in enumerate(conversation_data['transcripts'], 1):
            speaker = "Elderly" if transcript['speaker'] == "ELDERLY" else "AI"
            print(f"{i}. {speaker}: {transcript['text']}")
        print("-" * 30)
        
    else:
        print(f"\n📞 Testing: {conversation_data['name']}")
        print(f"📝 Description: {conversation_data['description']}")
        
        # Display conversation content
        print(f"\n💬 Conversation Content:")
        print("-" * 30)
        for i, msg in enumerate(conversation_data['conversation'], 1):
            speaker = "Elderly" if msg['role'] == "user" else "AI"
            print(f"{i}. {speaker}: {msg['content']}")
        print("-" * 30)
        
        conversation_history = conversation_data['conversation']
    
    # Generate schedule extraction
    print(f"\n📅 Extracting Schedules...")
    print("=" * 40)
    
    try:
        conversation_text = format_conversation_for_extraction(conversation_history)
        schedules_json = llm_service.extract_schedule_from_conversation(conversation_text)
        
        print(f"✅ Schedule Extraction Completed!")
        print(f"\n📋 Extracted Schedules (JSON):")
        print("-" * 30)
        print(schedules_json)
        print("-" * 30)
        
        # Try to parse and display formatted results
        try:
            import json
            schedules_data = json.loads(schedules_json)
            schedules = schedules_data.get('schedules', [])
            
            if schedules:
                print(f"\n📅 Formatted Schedule List:")
                print("-" * 30)
                for i, schedule in enumerate(schedules, 1):
                    print(f"{i}. {schedule.get('title', 'No title')}")
                    print(f"   Description: {schedule.get('description', 'No description')}")
                    print(f"   Category: {schedule.get('category', 'No category')}")
                    print(f"   Date: {schedule.get('due_date', 'No date')}")
                    print(f"   Time: {schedule.get('due_time', 'No time')}")
                    print()
            else:
                print(f"\n📅 No schedules found in this conversation.")
                
        except json.JSONDecodeError:
            print(f"\n⚠️ Could not parse JSON result. Raw output shown above.")
        
        return schedules_json
        
    except Exception as e:
        print(f"❌ Schedule Extraction Failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Main function"""
    print("🚀 Schedule Extraction Test")
    print("=" * 50)
    
    # Initialize LLM service
    try:
        llm_service = LLMService()
        print("✅ LLM Service initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize LLM service: {e}")
        print("Make sure OPENAI_API_KEY is set in docker environment")
        return
    
    results = []
    
    # Test with real DB data
    print(f"\n🧪 Testing with Real Database Data...")
    print("=" * 50)
    
    conversation_data = get_latest_conversation()
    if conversation_data:
        result = test_schedule_extraction(conversation_data, llm_service, is_real_db=True)
        results.append({
            'name': f"Real DB: {conversation_data['user_name']}",
            'result': result
        })
    else:
        print("❌ No real DB data available for testing")
    
    # Test with sample conversations
    print(f"\n🧪 Testing with Sample Conversations...")
    print("=" * 50)
    
    sample_conversations = get_sample_conversations()
    
    for conv_data in sample_conversations:
        result = test_schedule_extraction(conv_data, llm_service, is_real_db=False)
        results.append({
            'name': conv_data['name'],
            'result': result
        })
    
    # Summary of results
    print(f"\n📊 Test Results Summary:")
    print("=" * 50)
    for i, result in enumerate(results, 1):
        print(f"\n{i}. {result['name']}")
        if result['result']:
            print(f"   ✅ Success - Extracted schedule data")
            try:
                import json
                schedules_data = json.loads(result['result'])
                schedule_count = len(schedules_data.get('schedules', []))
                print(f"   📅 Found {schedule_count} schedule(s)")
            except:
                print(f"   ⚠️ Result format unclear")
        else:
            print(f"   ❌ Failed")

if __name__ == "__main__":
    main()
