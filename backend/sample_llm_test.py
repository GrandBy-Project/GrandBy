#!/usr/bin/env python3
"""
Simple LLM Test with Sample Conversations
Test LLM prompts with predefined sample conversations
"""

import os
import sys
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
sys.path.append('/app')

from app.services.ai_call.llm_service import LLMService

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

def test_conversation(conversation_data, llm_service):
    """Test a single conversation with LLM."""
    print(f"\n📞 Testing: {conversation_data['name']}")
    print(f"📝 Description: {conversation_data['description']}")
    print("=" * 50)
    
    # Display conversation content
    print(f"\n💬 Conversation Content:")
    print("-" * 30)
    for i, msg in enumerate(conversation_data['conversation'], 1):
        speaker = "Elderly" if msg['role'] == "user" else "AI"
        print(f"{i}. {speaker}: {msg['content']}")
    print("-" * 30)
    
    # Generate LLM summary
    print(f"\n🤖 Generating LLM Summary...")
    print("=" * 40)
    
    try:
        summary = llm_service.summarize_call_conversation(conversation_data['conversation'])
        
        print(f"✅ Summary Generated Successfully!")
        print(f"\n📝 Generated Summary:")
        print("-" * 30)
        print(summary)
        print("-" * 30)
        
        return summary
        
    except Exception as e:
        print(f"❌ Summary Generation Failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Main function"""
    print("🚀 LLM Prompt Test with Sample Conversations")
    print("=" * 50)
    
    # Initialize LLM service
    try:
        llm_service = LLMService()
        print("✅ LLM Service initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize LLM service: {e}")
        print("Make sure OPENAI_API_KEY is set in docker environment")
        return
    
    # Get sample conversations
    sample_conversations = get_sample_conversations()
    
    print(f"\n📋 Available Sample Conversations:")
    for i, conv in enumerate(sample_conversations, 1):
        print(f"{i}. {conv['name']} - {conv['description']}")
    
    # Test all conversations
    print(f"\n🧪 Testing all sample conversations...")
    print("=" * 50)
    
    results = []
    for conv_data in sample_conversations:
        result = test_conversation(conv_data, llm_service)
        results.append({
            'name': conv_data['name'],
            'summary': result
        })
    
    # Summary of results
    print(f"\n📊 Test Results Summary:")
    print("=" * 50)
    for i, result in enumerate(results, 1):
        print(f"\n{i}. {result['name']}")
        if result['summary']:
            print(f"   ✅ Success - Generated {len(result['summary'])} characters")
        else:
            print(f"   ❌ Failed")

if __name__ == "__main__":
    main()
