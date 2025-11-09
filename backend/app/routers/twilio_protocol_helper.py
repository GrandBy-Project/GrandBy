"""
Twilio Media Streams 프로토콜 헬퍼 함수
"""
import logging
import json
import asyncio
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class MessageBuffer:
    """sequenceNumber 기반 메시지 버퍼"""
    
    def __init__(self):
        self.buffer: List[Dict] = []
        self.next_expected_seq = 0
    
    def add_message(self, message: Dict, sequence_number: int):
        """메시지를 버퍼에 추가"""
        self.buffer.append({
            'message': message,
            'sequence': sequence_number
        })
        # sequenceNumber 순으로 정렬
        self.buffer.sort(key=lambda x: x['sequence'])
    
    def get_ready_messages(self) -> List[Dict]:
        """순서대로 처리할 수 있는 메시지들을 반환"""
        ready = []
        while self.buffer and self.buffer[0]['sequence'] == self.next_expected_seq:
            ready.append(self.buffer.pop(0)['message'])
            self.next_expected_seq += 1
        return ready
    
    def has_gap(self) -> bool:
        """순서가 맞지 않는 메시지가 있는지 확인"""
        if not self.buffer:
            return False
        return self.buffer[0]['sequence'] != self.next_expected_seq


async def wait_for_mark_response(
    pending_mark_responses: Dict[str, asyncio.Event],
    mark_name: str,
    timeout: float = 5.0
) -> bool:
    """
    mark 응답을 기다림
    
    Args:
        pending_mark_responses: mark 응답 대기 딕셔너리
        mark_name: mark 이름
        timeout: 타임아웃 시간 (초)
    
    Returns:
        bool: 응답을 받았으면 True, 타임아웃이면 False
    """
    if mark_name not in pending_mark_responses:
        pending_mark_responses[mark_name] = asyncio.Event()
    
    try:
        await asyncio.wait_for(
            pending_mark_responses[mark_name].wait(),
            timeout=timeout
        )
        return True
    except asyncio.TimeoutError:
        logger.warning(f"⚠️ [Mark 응답] 타임아웃: {mark_name}")
        return False


def send_mark(websocket, stream_sid: str, mark_name: str) -> None:
    """
    mark 이벤트 전송
    
    Args:
        websocket: WebSocket 연결
        stream_sid: Stream SID
        mark_name: mark 이름
    """
    mark_message = {
        "event": "mark",
        "streamSid": stream_sid,
        "mark": {
            "name": mark_name
        }
    }
    logger.info(f"📤 [Mark 전송] name={mark_name}")
    return json.dumps(mark_message)


