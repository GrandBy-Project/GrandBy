"""
전화번호 유틸리티
한국 전화번호 010 형식을 +82 국제 형식으로 변환
"""


def normalize_phone_number(phone: str | None) -> str | None:
    """
    한국 전화번호를 국제 형식으로 변환
    
    입력 형식: "01012345678" (11자리 숫자)
    출력 형식: "+821012345678"
    
    Examples:
        >>> normalize_phone_number("01012345678")
        '+821012345678'
        
        >>> normalize_phone_number(None)
        None
    
    Args:
        phone: 010으로 시작하는 11자리 전화번호
    
    Returns:
        +82로 시작하는 국제 형식 전화번호 또는 None
    """
    if not phone:
        return None
    
    phone = phone.strip()
    
    # 010으로 시작하면 0을 제거하고 +82 추가
    if phone.startswith('010'):
        return '+82' + phone[1:]
    
    # 이미 +82로 시작하면 그대로 반환
    if phone.startswith('+82'):
        return phone
    
    # 그 외는 그대로 반환
    return phone