"""
데이터베이스 연결 및 세션 관리
SQLAlchemy를 사용한 PostgreSQL 연결
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import settings

# SQLAlchemy Engine 생성
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,  # SQL 쿼리 로깅
    pool_pre_ping=True,     # 연결 유효성 검사
    pool_size=10,           # 커넥션 풀 크기
    max_overflow=20,        # 최대 오버플로우
)

# Session Local 생성
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base 모델 (모든 DB 모델의 부모 클래스)
Base = declarative_base()


# 데이터베이스 세션 의존성
def get_db() -> Generator[Session, None, None]:
    """
    FastAPI 의존성으로 사용되는 DB 세션 생성 함수
    
    Yields:
        Session: 데이터베이스 세션
    
    Example:
        @router.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 데이터베이스 초기화 함수
def init_db() -> None:
    """
    데이터베이스 테이블 생성
    Alembic 마이그레이션 사용 시 필요 없음
    """
    Base.metadata.create_all(bind=engine)


# 데이터베이스 연결 테스트
def test_db_connection() -> bool:
    """
    데이터베이스 연결 테스트
    
    Returns:
        bool: 연결 성공 여부
    """
    try:
        with engine.connect() as connection:
            from sqlalchemy import text
            connection.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

