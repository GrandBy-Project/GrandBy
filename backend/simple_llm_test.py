#!/usr/bin/env python3
"""
Simple LLM Prompt Test Script
Test the prompt after modifying it in llm_service.py
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

def main():
    """Main function"""
    print("🚀 LLM Prompt Test")
    print("=" * 40)
    
    # Get latest conversation data
    conversation_data = get_latest_conversation()
    
    if not conversation_data:
        return
    
    print(f"📞 Test Target: {conversation_data['user_name']}'s call")
    print(f"📅 Call Time: {conversation_data['created_at']}")
    print(f"💬 Conversation Turns: {len(conversation_data['transcripts'])}")
    
    # Display conversation content
    print(f"\n💬 Conversation Content:")
    print("-" * 30)
    for i, transcript in enumerate(conversation_data['transcripts'], 1):
        speaker = "Elderly" if transcript['speaker'] == "ELDERLY" else "AI"
        print(f"{i}. {speaker}: {transcript['text']}")
    print("-" * 30)
    
    # Initialize LLM service
    llm_service = LLMService()
    
    # Convert conversation to LLM input format
    conversation_history = []
    for transcript in conversation_data['transcripts']:
        role = "user" if transcript['speaker'] == "ELDERLY" else "assistant"
        conversation_history.append({
            "role": role,
            "content": transcript['text']
        })
    
    # Generate LLM summary (using current prompt from llm_service.py)
    print(f"\n🤖 Generating LLM Summary...")
    print("=" * 40)
    
    try:
        summary = llm_service.summarize_call_conversation(conversation_history)
        
        print(f"✅ Summary Generated Successfully!")
        print(f"\n📝 Generated Summary:")
        print("-" * 30)
        print(summary)
        print("-" * 30)
        
    except Exception as e:
        print(f"❌ Summary Generation Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
