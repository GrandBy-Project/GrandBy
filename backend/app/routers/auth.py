"""
인증 API 라우터
회원가입, 로그인, 토큰 갱신
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse
from app.models.user import User, UserSettings
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.config import settings
import uuid

router = APIRouter()

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
    """
    # 사용자 조회
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not pwd_context.verify(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 잘못되었습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다."
        )
    
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


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(db: Session = Depends(get_db)):
    """
    현재 로그인한 사용자 정보 조회
    (JWT 토큰 필요 - 향후 인증 미들웨어 구현)
    """
    # TODO: JWT 토큰에서 사용자 ID 추출 (인증 미들웨어 구현 필요)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="인증 미들웨어 구현 필요"
    )

