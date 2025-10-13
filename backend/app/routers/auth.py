"""
인증 API 라우터
회원가입, 로그인, 토큰 갱신, 이메일 인증
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse
from app.models.user import User, UserSettings
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.config import settings
from pydantic import BaseModel, EmailStr
import uuid
import random
import string

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
    개발 중에는 코드를 콘솔에 출력
    프로덕션에서는 실제 이메일 발송
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
    
    # TODO: 실제 이메일 발송 (SMTP)
    # 개발 중에는 콘솔 출력
    print(f"\n{'='*50}")
    print(f"📧 이메일 인증 코드")
    print(f"{'='*50}")
    print(f"이메일: {request.email}")
    print(f"인증 코드: {code}")
    print(f"만료 시간: {expires_at}")
    print(f"{'='*50}\n")
    
    return {
        "success": True,
        "message": "인증 코드가 발송되었습니다. (개발 중: 콘솔 확인)",
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

