"""
AI 통화 API 라우터
통화 기록, 통화 설정, 트랜스크립트 조회
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import time as dt_time, datetime, date
from app.database import get_db
from app.schemas.call import (
    CallLogResponse, 
    CallSettingsCreate,
    CallSettingsUpdate, 
    CallSettingsResponse,
    CallTranscriptResponse
)
from app.models.call import CallSettings, CallLog, CallTranscript, CallFrequency, CallStatus
from app.models.user import User
from app.models.diary import Diary, DiaryStatus
from app.routers.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[CallLogResponse])
async def get_call_logs(
    limit: int = 10,
    elderly_id: str = None,  # TODO: JWT 토큰에서 가져오도록 수정
    db: Session = Depends(get_db)
):
    """
    통화 기록 목록 조회
    
    Query Parameters:
    - limit: 조회할 최대 개수 (기본값: 10)
    - elderly_id: 어르신 사용자 ID (선택사항)
    """
    try:
        # 기본적으로 모든 통화 기록 조회 (최신순)
        query = db.query(CallLog).order_by(CallLog.created_at.desc())
        
        # 특정 사용자의 통화 기록만 조회하는 경우
        if elderly_id:
            query = query.filter(CallLog.elderly_id == elderly_id)
        
        # 개수 제한
        call_logs = query.limit(limit).all()
        
        logger.info(f"📞 통화 기록 조회: {len(call_logs)}건 (limit: {limit})")
        return call_logs
        
    except Exception as e:
        logger.error(f"❌ 통화 기록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/diary-reminder")
async def check_diary_reminder(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 작성 안내 배너 표시 여부 확인
    - 오늘 완료된 통화가 있고, 오늘 다이어리가 없으면 배너 표시
    """
    try:
        today = date.today()
        
        # 오늘 완료된 통화 확인
        today_calls = db.query(CallLog).filter(
            CallLog.elderly_id == current_user.user_id,
            CallLog.call_status == CallStatus.COMPLETED,
            func.date(CallLog.created_at) == today
        ).count()
        
        # 오늘 발행된 다이어리 확인
        today_diary = db.query(Diary).filter(
            Diary.user_id == current_user.user_id,
            Diary.date == today,
            Diary.status == DiaryStatus.PUBLISHED
        ).first()
        
        # 오늘 통화가 있고 오늘 다이어리가 없으면 배너 표시
        should_show_banner = today_calls > 0 and today_diary is None
        
        logger.info(f"📝 다이어리 안내 배너 확인: {should_show_banner} (통화: {today_calls}건, 다이어리: {'있음' if today_diary else '없음'})")
        
        return {
            "should_show_banner": should_show_banner
        }
        
    except Exception as e:
        logger.error(f"❌ 다이어리 안내 배너 확인 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{call_id}", response_model=CallLogResponse)
async def get_call_log(call_id: str, db: Session = Depends(get_db)):
    """
    통화 상세 정보 조회 (요약 포함)
    """
    call_log = db.query(CallLog).filter(CallLog.call_id == call_id).first()
    
    if not call_log:
        raise HTTPException(status_code=404, detail="Call log not found")
    
    return call_log


@router.get("/{call_id}/transcript", response_model=List[CallTranscriptResponse])
async def get_call_transcript(call_id: str, db: Session = Depends(get_db)):
    """
    통화 텍스트 변환 내용 조회 (전체 대화 내용)
    """
    transcripts = db.query(CallTranscript).filter(
        CallTranscript.call_id == call_id
    ).order_by(CallTranscript.timestamp).all()
    
    if not transcripts:
        raise HTTPException(status_code=404, detail="No transcripts found for this call")
    
    return transcripts


@router.post("/settings", response_model=CallSettingsResponse)
async def create_or_update_call_settings(
    settings_data: CallSettingsCreate,
    elderly_id: str,  # TODO: JWT 토큰에서 가져오도록 수정
    db: Session = Depends(get_db)
):
    """
    전화 시간 설정 (생성 또는 수정)
    
    Request Body:
    {
        "call_time": "09:30",  # HH:MM 형식
        "frequency": "daily",   # daily, weekly, monthly
        "is_active": true
    }
    
    Query Parameter:
    - elderly_id: 어르신 사용자 ID
    """
    try:
        # 시간 파싱 (HH:MM → time 객체)
        try:
            hour, minute = map(int, settings_data.call_time.split(":"))
            call_time_obj = dt_time(hour=hour, minute=minute)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid time format. Use HH:MM (e.g., 09:30)"
            )
        
        # 사용자 존재 확인
        user = db.query(User).filter(User.user_id == elderly_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 기존 설정 확인
        existing_setting = db.query(CallSettings).filter(
            CallSettings.elderly_id == elderly_id
        ).first()
        
        if existing_setting:
            # 기존 설정 업데이트
            existing_setting.call_time = call_time_obj
            existing_setting.frequency = settings_data.frequency
            existing_setting.is_active = settings_data.is_active
            existing_setting.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(existing_setting)
            
            logger.info(f"✅ 전화 시간 업데이트: {elderly_id} - {settings_data.call_time}")
            return existing_setting
        else:
            # 새 설정 생성
            new_setting = CallSettings(
                elderly_id=elderly_id,
                call_time=call_time_obj,
                frequency=settings_data.frequency,
                is_active=settings_data.is_active,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(new_setting)
            db.commit()
            db.refresh(new_setting)
            
            logger.info(f"✅ 전화 시간 생성: {elderly_id} - {settings_data.call_time}")
            return new_setting
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 전화 설정 실패: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings", response_model=Optional[CallSettingsResponse])
async def get_call_settings(
    elderly_id: str,  # TODO: JWT 토큰에서 가져오도록 수정
    db: Session = Depends(get_db)
):
    """
    현재 전화 시간 설정 조회
    
    Query Parameter:
    - elderly_id: 어르신 사용자 ID
    """
    setting = db.query(CallSettings).filter(
        CallSettings.elderly_id == elderly_id
    ).first()
    
    if not setting:
        raise HTTPException(status_code=404, detail="Call settings not found")
    
    return setting


@router.delete("/settings", response_model=dict)
async def delete_call_settings(
    elderly_id: str,  # TODO: JWT 토큰에서 가져오도록 수정
    db: Session = Depends(get_db)
):
    """
    전화 시간 설정 삭제 (비활성화)
    
    Query Parameter:
    - elderly_id: 어르신 사용자 ID
    """
    setting = db.query(CallSettings).filter(
        CallSettings.elderly_id == elderly_id
    ).first()
    
    if not setting:
        raise HTTPException(status_code=404, detail="Call settings not found")
    
    # 완전 삭제 대신 비활성화
    setting.is_active = False
    setting.updated_at = datetime.utcnow()
    db.commit()
    
    logger.info(f"🔕 전화 설정 비활성화: {elderly_id}")
    
    return {
        "success": True,
        "message": "Call settings deactivated",
        "elderly_id": elderly_id
    }


@router.get("/{call_id}/extracted-todos")
async def get_extracted_todos(call_id: str, db: Session = Depends(get_db)):
    """
    통화 내용에서 TODO 자동 추출
    
    Args:
        call_id: 통화 ID (call_sid)
    
    Returns:
        {
          "todos": [
            {
              "title": "병원 가기",
              "description": "정형외과 무릎 검사",
              "category": "HOSPITAL",
              "due_date": "2025-10-22",
              "due_time": "15:00"
            }
          ]
        }
    """
    from app.services.ai_call.llm_service import LLMService
    import json
    
    logger.info(f"📋 TODO 추출 시작: {call_id}")
    
    # 1. call_transcripts에서 대화 전문 조회
    transcripts = db.query(CallTranscript).filter(
        CallTranscript.call_id == call_id
    ).order_by(CallTranscript.timestamp).all()
    
    if not transcripts:
        logger.warning(f"⚠️ 대화 내용 없음: {call_id}")
        return {"todos": []}
    
    # 2. 대화 텍스트 조합
    conversation_text = "\n".join([
        f"{t.speaker}: {t.text}" for t in transcripts
    ])
    
    logger.info(f"📝 대화 길이: {len(conversation_text)} characters")
    
    # 3. LLM으로 TODO 추출
    llm_service = LLMService()
    try:
        extracted_json = llm_service.extract_schedule_from_conversation(conversation_text)
        
        # 4. JSON 파싱
        result = json.loads(extracted_json)
        
        # 5. 결과 검증 및 정제
        todos = []
        if isinstance(result, dict) and "schedules" in result:
            todos = result["schedules"]
        elif isinstance(result, list):
            todos = result
        
        logger.info(f"✅ TODO {len(todos)}개 추출 완료")
        return {"todos": todos}
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON 파싱 실패: {e}")
        return {"todos": []}
    except Exception as e:
        logger.error(f"❌ TODO 추출 실패: {e}")
        return {"todos": []}
