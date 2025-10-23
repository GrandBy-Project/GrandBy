# Simple LLM Prompt Test

## Quick Start

### Option 1: Test with Real Database Data
1. **Modify prompt** in `backend/app/services/ai_call/llm_service.py` (line 254-277)
2. **Run test**: `simple_llm_test.bat`
3. **Check result**: See the generated summary

### Option 2: Test with Sample Conversations
1. **Modify prompt** in `backend/app/services/ai_call/llm_service.py` (line 254-277)
2. **Run test**: `sample_llm_test.bat`
3. **Check result**: See summaries for 2 predefined conversations

### Option 3: Test Schedule Extraction
1. **Modify prompt** in `backend/app/services/ai_call/llm_service.py` (line 306-343)
2. **Run test**: `schedule_extraction_test.bat`
3. **Check result**: See extracted schedules from real DB + 2 sample conversations

## Files

- `backend/simple_llm_test.py` - Real DB test script
- `backend/sample_llm_test.py` - Sample conversation test script
- `backend/schedule_extraction_test.py` - Schedule extraction test script
- `simple_llm_test.bat` - Real DB test runner
- `sample_llm_test.bat` - Sample test runner
- `schedule_extraction_test.bat` - Schedule extraction test runner

## Sample Conversations

1. **Positive Day**: Good mood, park walk, daughter lunch plan
2. **Health Concern**: Tired, knee pain, hospital visit with son

## Test Types

- **Summary Generation**: Test conversation-to-diary conversion
- **Schedule Extraction**: Test future schedule detection from conversations

That's it! Simple and clean.
