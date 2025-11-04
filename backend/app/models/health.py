"""
건강 관련 데이터베이스 모델
걸음 수, 거리 등
"""

from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class HealthData(Base):
    """건강 데이터 모델 (걸음 수, 거리 등)"""
    __tablename__ = "health_data"
    
    # Primary Key
    health_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Key
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    
    # 날짜 (하루 단위)
    date = Column(Date, nullable=False, index=True)
    
    # 걸음 수
    step_count = Column(Integer, default=0, nullable=False)
    
    # 거리 (미터 단위)
    distance = Column(Float, default=0.0, nullable=False)
    
    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="health_data")
    
    def __repr__(self):
        return f"<HealthData {self.user_id} on {self.date} ({self.step_count} steps)>"

