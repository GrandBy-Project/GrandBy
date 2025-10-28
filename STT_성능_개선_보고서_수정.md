# STT AI 전화 기능 성능 개선 보고서 (수정)

## 1️⃣ 기존 방식 상세 분석

### 1.1 기존 STT 처리 방식

#### **아키텍처**
```
사용자 음성 입력 (mulaw 8kHz)
    ↓
AudioProcessor 버퍼링 (mulaw → PCM 변환)
    ↓
침묵 감지 (0.5초 대기) ← 주요 지연 발생 지점
    ↓
STTService.transcribe_audio_chunk() 호출
    ↓ [Google Cloud 또는 OpenAI Whisper 선택]
Google: 0.3-0.5초 / OpenAI: 1.0-2.0초
    ↓
LLM 응답 생성
```

#### **코드 구조** (`backend/app/main.py`)

1. **AudioProcessor 클래스**
   ```python
   class AudioProcessor:
       def __init__(self, call_sid: str):
           self.max_silence = 0.5  # ⭐ 0.5초 침묵 후 STT 처리
           self.silence_duration = 0
           self.is_speaking = False
       
       def add_audio_chunk(self, audio_data: bytes):
           # mulaw → PCM 변환
           pcm_data = audioop.ulaw2lin(audio_data, 2)
           self.audio_buffer.append(pcm_data)
           
           # 침묵 감지 로직
           if self.is_speaking:
               self.silence_duration += 0.02  # 20ms per chunk
       
       def should_process(self) -> bool:
           return (self.is_speaking and
                   self.silence_duration >= self.max_silence and
                   len(self.audio_buffer) > 0)
   ```

2. **STT 처리 흐름** (`main.py`)
   ```python
   # audio_processor 초기화
   audio_processor = AudioProcessor(call_sid)
   
   # 오디오 청크 수신
   audio_processor.add_audio_chunk(audio_payload)
   
   # 침묵 감지 완료 후 처리
   if audio_processor.should_process():
       audio_data = audio_processor.get_audio()
       
       # STTService 호출
       transcript, stt_time = await transcribe_audio_realtime(audio_data)
       # → stt_service.transcribe_audio_chunk() 호출
   ```

3. **STTService 호출** (`stt_service.py`)
   ```python
   async def transcribe_audio_chunk(self, audio_chunk: bytes):
       if self.provider == "google":
           return await self._transcribe_google(audio_chunk)
       else:  # openai
           return await self._transcribe_openai(audio_chunk)
   ```

### 1.2 기존 방식의 지연 속도

#### **측정 결과**

| 단계 | 소요 시간 | 비고 |
|------|----------|------|
| 침묵 감지 대기 | **0.5초** | 고정 지연 시간 (max_silence = 0.5) |
| Google STT API | 0.3-0.5초 | API 응답 시간 |
| OpenAI Whisper | 1.0-2.0초 | API 응답 시간 |
| WAV 변환 | 0.05-0.1초 | 내부 처리 |
| **총 지연 시간** | **약 1.0-2.7초** | (Google 기준 약 1.0초, OpenAI 기준 약 2.7초) |

#### **실제 로그 분석**
```
[기존 방식 예시 - Google STT]
05:15:10.000 - 🎤 사용자: "안녕하세요"
05:15:10.500 - ⏱️ 침묵 감지 완료 (0.5초 대기)
05:15:11.000 - 🔄 STT Service 호출 시작
05:15:11.350 - ✅ STT 완료: "안녕하세요"
05:15:11.350 - 🤖 LLM 응답 생성 시작

총 지연: 1.35초
```

### 1.3 기존 방식의 문제점

#### **1. 고정된 침묵 시간으로 인한 지연**
- 문제: 말이 끝난 후 무조건 0.5초 대기
- 영향: 응답 지연 약 0.5초 증가
- 사용자 경험: 불필요한 대기 시간

#### **2. 전체 발화 버퍼링으로 인한 메모리 사용**
- 문제: 발화 전체를 버퍼에 저장
- 영향: 장발화 시 메모리 부하
- 제약: 장시간 발화 시 처리 지연

#### **3. HTTP API 호출 오버헤드**
- 문제: 매번 API 호출 비용 및 시간 발생
- 영향: 비용 증가 및 응답 지연
- 한계: 일괄 처리 방식의 한계

#### **4. 발화 종료 판정 불정확성**
- 문제: 0.5초 침묵으로 발화 종료 판단
- 영향: 말하는 중간 종료 처리 발생 가능
- 오류: 긴 문장에서 단절 가능

#### **5. WAV 변환 오버헤드**
- 문제: PCM → WAV 변환 과정 필요
- 영향: 메모리 사용 및 처리 시간 증가
- 불필요: 실시간 처리에는 과도한 변환


