"""
시간 관련 유틸리티 함수
모든 모델에서 한국 시간(KST)을 사용하도록 통일
"""
from datetime import datetime
from pytz import timezone, UTC

# 한국 시간대 (KST, UTC+9)
KST = timezone('Asia/Seoul')

def kst_now():
    """
    현재 한국 시간(KST)을 반환 (naive datetime)
    UTC 시간을 가져온 후 KST로 변환하여 시스템 시간대와 무관하게 작동
    SQLAlchemy의 DateTime 컬럼에서 사용
    
    Returns:
        datetime: 한국 시간으로 변환된 naive datetime 객체
    """
    # UTC 시간을 가져온 후 KST로 변환 (시스템 시간대와 무관)
    utc_now = datetime.now(UTC)
    kst_time = utc_now.astimezone(KST)
    # naive datetime으로 반환 (SQLAlchemy용)
    return kst_time.replace(tzinfo=None)

