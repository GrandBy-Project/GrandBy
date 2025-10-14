"""
인증 API 라우터
회원가입, 로그인, 토큰 갱신, 이메일 인증, 카카오 로그인
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import (
    UserCreate, UserLogin, Token, UserResponse,
    KakaoCallbackRequest, KakaoUserInfo, KakaoRegisterRequest
)
from app.models.user import User, UserSettings, UserRole, AuthProvider
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.config import settings
from pydantic import BaseModel, EmailStr
import uuid
import random
import string
from app.utils.email import send_verification_email
from app.utils.kakao import kakao_api
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()

# 비밀번호 해싱 (bcrypt는 자동으로 72바이트로 truncate)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
    bcrypt__truncate_error=False
)


def create_access_token(data: dict):
    """Access Token 생성"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict):
    """Refresh Token 생성"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    회원가입
    
    - **email**: 이메일 주소 (중복 불가)
    - **password**: 비밀번호
    - **name**: 이름
    - **role**: elderly (어르신) 또는 caregiver (보호자)
    """
    # 이메일 중복 체크
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다."
        )
    
    # 비밀번호 길이 체크 및 해싱 (bcrypt는 72바이트 제한)
    password_bytes = user_data.password.encode('utf-8')
    if len(password_bytes) > 72:
        password_to_hash = password_bytes[:72].decode('utf-8', errors='ignore')
    else:
        password_to_hash = user_data.password
    
    hashed_password = pwd_context.hash(password_to_hash)
    
    # 사용자 생성
    new_user = User(
        user_id=str(uuid.uuid4()),
        email=user_data.email,
        password_hash=hashed_password,
        name=user_data.name,
        role=user_data.role,
        phone_number=user_data.phone_number,
        auth_provider=user_data.auth_provider,
        is_active=True,
        is_verified=False,
    )
    db.add(new_user)
    
    # 사용자 설정 생성
    user_settings = UserSettings(
        setting_id=str(uuid.uuid4()),
        user_id=new_user.user_id,
    )
    db.add(user_settings)
    
    db.commit()
    db.refresh(new_user)
    
    # JWT 토큰 생성
    access_token = create_access_token({"sub": new_user.user_id, "role": new_user.role.value})
    refresh_token = create_refresh_token({"sub": new_user.user_id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(new_user)
    }


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    로그인
    
    - **email**: 이메일
    - **password**: 비밀번호
    
    보안:
    - 10회 실패 시 15분 잠금
    """
    email = user_data.email.lower()
    
    # 로그인 실패 횟수 확인
    attempt_data = login_attempts.get(email)
    if attempt_data:
        # 잠금 시간 확인
        if attempt_data.get("locked_until") and datetime.utcnow() < attempt_data["locked_until"]:
            remaining = (attempt_data["locked_until"] - datetime.utcnow()).seconds // 60
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"로그인 시도 횟수를 초과했습니다. {remaining}분 후 다시 시도해주세요."
            )
        
        # 잠금 시간이 지났으면 초기화
        if attempt_data.get("locked_until") and datetime.utcnow() >= attempt_data["locked_until"]:
            del login_attempts[email]
            attempt_data = None
    
    # 사용자 조회
    user = db.query(User).filter(User.email == email).first()
    
    # 비밀번호 확인
    if not user or not pwd_context.verify(user_data.password, user.password_hash):
        # 실패 횟수 증가
        if not attempt_data:
            login_attempts[email] = {
                "attempts": 1,
                "first_attempt": datetime.utcnow()
            }
        else:
            attempt_data["attempts"] += 1
            
            # 10회 실패 시 15분 잠금
            if attempt_data["attempts"] >= 10:
                attempt_data["locked_until"] = datetime.utcnow() + timedelta(minutes=15)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요."
                )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"이메일 또는 비밀번호가 잘못되었습니다. ({10 - login_attempts[email]['attempts']}회 남음)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다."
        )
    
    # 로그인 성공: 실패 기록 삭제
    if email in login_attempts:
        del login_attempts[email]
    
    # 마지막 로그인 시간 업데이트
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    # JWT 토큰 생성
    access_token = create_access_token({"sub": user.user_id, "role": user.role.value})
    refresh_token = create_refresh_token({"sub": user.user_id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """JWT 토큰에서 현재 사용자 추출"""
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 토큰입니다."
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰을 검증할 수 없습니다."
        )
    
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다."
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다."
        )
    
    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    현재 로그인한 사용자 정보 조회
    """
    return UserResponse.from_orm(current_user)


@router.get("/verify", response_model=UserResponse)
async def verify_token(
    current_user: User = Depends(get_current_user)
):
    """
    토큰 유효성 검증
    스플래쉬 스크린에서 자동 로그인 시 사용
    """
    return UserResponse.from_orm(current_user)


class RefreshTokenRequest(BaseModel):
    refresh_token: str
    device_id: str | None = None


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Access Token 갱신 (슬라이딩 윈도우 방식)
    Refresh Token의 만료 시간도 +7일 연장
    """
    try:
        payload = jwt.decode(
            request.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 Refresh Token입니다."
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh Token을 검증할 수 없습니다."
        )
    
    # 사용자 확인
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없거나 비활성화되었습니다."
        )
    
    # 새 토큰 발급 (슬라이딩: Refresh Token도 새로 발급)
    new_access_token = create_access_token({
        "sub": user.user_id,
        "role": user.role.value
    })
    
    new_refresh_token = create_refresh_token({
        "sub": user.user_id
    })
    
    # 마지막 로그인 시간 업데이트
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }


class EmailCheckResponse(BaseModel):
    available: bool
    message: str


@router.get("/check-email", response_model=EmailCheckResponse)
async def check_email_availability(
    email: EmailStr,
    db: Session = Depends(get_db)
):
    """
    이메일 중복 확인
    """
    existing_user = db.query(User).filter(User.email == email).first()
    
    if existing_user:
        return {
            "available": False,
            "message": "이미 사용 중인 이메일입니다."
        }
    
    return {
        "available": True,
        "message": "사용 가능한 이메일입니다."
    }


# 이메일 인증 코드 저장소 (실제로는 Redis 사용 권장)
# 개발 중에는 메모리 딕셔너리 사용
verification_codes: dict[str, dict] = {}

# 로그인 실패 추적 (실제로는 Redis 사용 권장)
login_attempts: dict[str, dict] = {}


def generate_verification_code() -> str:
    """6자리 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=6))


class SendVerificationCodeRequest(BaseModel):
    email: EmailStr


class SendVerificationCodeResponse(BaseModel):
    success: bool
    message: str
    expires_in: int  # 초 단위


@router.post("/send-verification-code", response_model=SendVerificationCodeResponse)
async def send_verification_code(
    request: SendVerificationCodeRequest,
    db: Session = Depends(get_db)
):
    """
    이메일 인증 코드 발송
    SMTP를 사용한 실제 이메일 발송
    ENABLE_EMAIL=False인 경우 콘솔에 출력
    """
    # 이메일 중복 확인
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다."
        )
    
    # 인증 코드 생성
    code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    
    # 메모리에 저장 (프로덕션에서는 Redis 사용)
    verification_codes[request.email] = {
        "code": code,
        "expires_at": expires_at,
        "attempts": 0
    }
    
    # 실제 이메일 발송 (SMTP)
    email_sent = await send_verification_email(request.email, code)
    
    if not email_sent and settings.ENABLE_EMAIL:
        # 이메일 발송 실패 (SMTP 활성화 상태에서)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요."
        )
    
    # 성공 메시지
    message = "인증 코드가 이메일로 발송되었습니다."
    if not settings.ENABLE_EMAIL:
        message = "인증 코드가 발송되었습니다. (개발 모드: 백엔드 콘솔 확인)"
    
    return {
        "success": True,
        "message": message,
        "expires_in": 300  # 5분
    }


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class VerifyEmailResponse(BaseModel):
    success: bool
    message: str


@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(request: VerifyEmailRequest):
    """
    이메일 인증 코드 확인
    """
    # 인증 코드 확인
    stored = verification_codes.get(request.email)
    
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="인증 코드를 찾을 수 없습니다. 다시 발송해주세요."
        )
    
    # 만료 시간 확인
    if datetime.utcnow() > stored["expires_at"]:
        del verification_codes[request.email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="인증 코드가 만료되었습니다. 다시 발송해주세요."
        )
    
    # 시도 횟수 확인 (5회 제한)
    if stored["attempts"] >= 5:
        del verification_codes[request.email]
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="인증 시도 횟수를 초과했습니다. 다시 발송해주세요."
        )
    
    # 코드 확인
    if stored["code"] != request.code:
        stored["attempts"] += 1
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"인증 코드가 일치하지 않습니다. ({5 - stored['attempts']}회 남음)"
        )
    
    # 인증 성공
    del verification_codes[request.email]
    
    return {
        "success": True,
        "message": "이메일 인증이 완료되었습니다."
    }


# ==================== 카카오 로그인 ====================

@router.get("/kakao/login")
async def kakao_login():
    """
    카카오 로그인 시작
    카카오 인증 페이지로 리다이렉트
    """
    try:
        logger.info("🔵 카카오 로그인 요청 받음")
        authorization_url = kakao_api.get_authorization_url()
        logger.info(f"🔵 카카오 인증 URL 생성 완료: {authorization_url}")
        logger.info(f"🔵 Redirect URI: {settings.KAKAO_REDIRECT_URI}")
        return {
            "authorization_url": authorization_url
        }
    except Exception as e:
        logger.error(f"❌ 카카오 로그인 URL 생성 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="카카오 로그인 URL 생성에 실패했습니다."
        )


@router.post("/kakao/callback", response_model=Token | KakaoUserInfo)
async def kakao_callback(request: KakaoCallbackRequest, db: Session = Depends(get_db)):
    """
    카카오 로그인 콜백
    
    Flow:
    1. 인증 코드로 액세스 토큰 받기
    2. 액세스 토큰으로 사용자 정보 조회
    3. 기존 사용자면 로그인, 신규 사용자면 회원가입 필요 정보 반환
    """
    try:
        logger.info(f"🔵 카카오 콜백 받음 - code: {request.code[:10]}...")
        
        # 1. 액세스 토큰 받기
        logger.info("🔵 카카오 액세스 토큰 요청 중...")
        token_response = await kakao_api.get_access_token(request.code)
        access_token = token_response.get("access_token")
        refresh_token = token_response.get("refresh_token")
        
        if not access_token:
            logger.error("❌ 카카오 액세스 토큰을 받지 못함")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="카카오 액세스 토큰을 받지 못했습니다."
            )
        
        logger.info("✅ 카카오 액세스 토큰 받음")
        
        # 2. 사용자 정보 조회
        logger.info("🔵 카카오 사용자 정보 조회 중...")
        kakao_user_raw = await kakao_api.get_user_info(access_token)
        kakao_user = kakao_api.parse_user_info(kakao_user_raw)
        
        logger.info(f"✅ 카카오 사용자 정보 파싱 완료:")
        logger.info(f"   - kakao_id: {kakao_user['kakao_id']}")
        logger.info(f"   - email: {kakao_user.get('email')}")
        logger.info(f"   - name: {kakao_user.get('name')}")
        logger.info(f"   - phone_number: {kakao_user.get('phone_number')}")
        logger.info(f"   - birth_date: {kakao_user.get('birth_date')}")
        logger.info(f"   - gender: {kakao_user.get('gender')}")
        
        # 3. 기존 사용자 확인 (kakao_id로)
        existing_user = db.query(User).filter(
            User.kakao_id == kakao_user["kakao_id"]
        ).first()
        
        if existing_user:
            logger.info(f"✅ 기존 사용자 발견 - email: {existing_user.email}")
            # 기존 사용자 - 로그인 처리
            # 토큰 업데이트
            existing_user.kakao_access_token = access_token
            existing_user.kakao_refresh_token = refresh_token
            existing_user.last_login_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_user)
            
            # JWT 토큰 생성
            access_token_jwt = create_access_token({
                "sub": existing_user.user_id,
                "role": existing_user.role.value
            })
            refresh_token_jwt = create_refresh_token({
                "sub": existing_user.user_id
            })
            
            logger.info("✅ 기존 사용자 로그인 완료")
            
            return {
                "access_token": access_token_jwt,
                "refresh_token": refresh_token_jwt,
                "token_type": "bearer",
                "user": UserResponse.from_orm(existing_user)
            }
        
        # 4. 신규 사용자 - 회원가입 필요 정보 반환
        logger.info("🆕 신규 사용자 - 회원가입 필요")
        # 프론트엔드에서 추가 정보 입력 받아야 함
        kakao_user_info = KakaoUserInfo(
            kakao_id=kakao_user["kakao_id"],
            email=kakao_user.get("email"),
            name=kakao_user.get("name"),
            phone_number=kakao_user.get("phone_number"),
            birth_date=kakao_user.get("birth_date"),
            gender=kakao_user.get("gender"),
            profile_image=kakao_user.get("profile_image")
        )
        
        logger.info(f"📤 신규 사용자 정보 반환: {kakao_user_info.model_dump()}")
        return kakao_user_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 카카오 로그인 콜백 처리 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"카카오 로그인 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/kakao/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def kakao_register(user_data: KakaoRegisterRequest, db: Session = Depends(get_db)):
    """
    카카오 회원가입
    카카오 로그인 후 추가 정보 입력하여 회원가입
    """
    try:
        # 1. 이미 등록된 사용자인지 확인
        existing_user_by_kakao = db.query(User).filter(
            User.kakao_id == user_data.kakao_id
        ).first()
        
        if existing_user_by_kakao:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 가입된 카카오 계정입니다."
            )
        
        # 2. 이메일 중복 확인
        existing_user_by_email = db.query(User).filter(
            User.email == user_data.email
        ).first()
        
        if existing_user_by_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 사용 중인 이메일입니다."
            )
        
        # 3. 비밀번호 해싱
        password_bytes = user_data.password.encode('utf-8')
        if len(password_bytes) > 72:
            password_to_hash = password_bytes[:72].decode('utf-8', errors='ignore')
        else:
            password_to_hash = user_data.password
        
        hashed_password = pwd_context.hash(password_to_hash)
        
        # 4. 사용자 생성
        new_user = User(
            user_id=str(uuid.uuid4()),
            email=user_data.email,
            password_hash=hashed_password,
            name=user_data.name,
            phone_number=user_data.phone_number,
            role=user_data.role,
            auth_provider=AuthProvider.KAKAO,
            kakao_id=user_data.kakao_id,
            birth_date=user_data.birth_date,
            gender=user_data.gender,
            is_active=True,
            is_verified=True,  # 카카오 인증 완료로 간주
        )
        db.add(new_user)
        
        # 5. 사용자 설정 생성
        user_settings = UserSettings(
            setting_id=str(uuid.uuid4()),
            user_id=new_user.user_id,
        )
        db.add(user_settings)
        
        db.commit()
        db.refresh(new_user)
        
        # 6. JWT 토큰 생성
        access_token = create_access_token({
            "sub": new_user.user_id,
            "role": new_user.role.value
        })
        refresh_token = create_refresh_token({
            "sub": new_user.user_id
        })
        
        logger.info(f"카카오 회원가입 완료: {new_user.email}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(new_user)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"카카오 회원가입 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"카카오 회원가입 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/kakao/unlink")
async def kakao_unlink(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    카카오 연결 해제
    """
    try:
        # JWT 토큰으로 사용자 확인
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 토큰입니다."
            )
        
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user or user.auth_provider != AuthProvider.KAKAO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="카카오 로그인 사용자가 아닙니다."
            )
        
        # 카카오 연결 해제 API 호출
        if user.kakao_access_token:
            await kakao_api.unlink_user(user.kakao_access_token)
        
        # DB에서 카카오 정보 제거
        user.kakao_id = None
        user.kakao_access_token = None
        user.kakao_refresh_token = None
        db.commit()
        
        return {
            "success": True,
            "message": "카카오 연결이 해제되었습니다."
        }
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 검증에 실패했습니다."
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"카카오 연결 해제 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="카카오 연결 해제 중 오류가 발생했습니다."
        )

