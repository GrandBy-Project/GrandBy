"""
이미지 업로드 및 처리 유틸리티
"""

from PIL import Image
import io
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.config import settings
import uuid


# 허용된 이미지 확장자
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


async def save_profile_image(file: UploadFile, user_id: str) -> str:
    """
    프로필 이미지 저장 및 리사이징
    
    Args:
        file: 업로드된 파일
        user_id: 사용자 ID
    
    Returns:
        str: 저장된 이미지의 URL/경로
        
    Raises:
        HTTPException: 파일 검증 실패 또는 처리 중 오류
    """
    # 파일 확장자 검증
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 이미지 형식입니다. {', '.join(ALLOWED_EXTENSIONS)} 형식만 지원합니다"
        )
    
    # 파일 읽기
    contents = await file.read()
    
    # 파일 크기 검증
    if len(contents) > settings.MAX_IMAGE_SIZE:
        max_size_mb = settings.MAX_IMAGE_SIZE / (1024 * 1024)
        raise HTTPException(
            status_code=400,
            detail=f"이미지 크기는 {max_size_mb:.0f}MB를 초과할 수 없습니다"
        )
    
    # 이미지 열기 및 검증
    try:
        image = Image.open(io.BytesIO(contents))
        
        # EXIF 방향 정보 처리
        image = _correct_image_orientation(image)
        
        # RGB로 변환 (RGBA, P 등을 처리)
        if image.mode in ('RGBA', 'LA', 'P'):
            # 투명 배경을 흰색으로 변환
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            if 'transparency' in image.info:
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            else:
                background.paste(image)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 리사이징 (비율 유지하며 512x512에 맞춤)
        image.thumbnail(settings.PROFILE_IMAGE_SIZE, Image.Resampling.LANCZOS)
        
        # 정사각형으로 크롭 (중앙 기준)
        width, height = image.size
        if width != height:
            size = min(width, height)
            left = (width - size) // 2
            top = (height - size) // 2
            image = image.crop((left, top, left + size, top + size))
            image = image.resize(settings.PROFILE_IMAGE_SIZE, Image.Resampling.LANCZOS)
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"이미지 처리 중 오류가 발생했습니다: {str(e)}"
        )
    
    # 저장 디렉토리 생성
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # 고유 파일명 생성
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.jpg"
    file_path = upload_dir / filename
    
    # 이미지 저장 (JPEG, 품질 85)
    try:
        image.save(file_path, 'JPEG', quality=85, optimize=True)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"이미지 저장 중 오류가 발생했습니다: {str(e)}"
        )
    
    # URL 반환 (프론트엔드에서 접근 가능한 경로)
    return f"/uploads/profiles/{filename}"


def _correct_image_orientation(image: Image.Image) -> Image.Image:
    """
    EXIF 방향 정보에 따라 이미지 회전
    
    Args:
        image: PIL Image 객체
    
    Returns:
        Image.Image: 회전된 이미지
    """
    try:
        # EXIF 데이터 가져오기
        exif = image.getexif()
        if exif is not None:
            # Orientation 태그 (274)
            orientation = exif.get(274)
            
            # 방향에 따라 회전
            if orientation == 3:
                image = image.rotate(180, expand=True)
            elif orientation == 6:
                image = image.rotate(270, expand=True)
            elif orientation == 8:
                image = image.rotate(90, expand=True)
    except (AttributeError, KeyError, IndexError):
        # EXIF 데이터가 없거나 오류 발생 시 원본 반환
        pass
    
    return image


async def delete_profile_image(image_url: str) -> None:
    """
    프로필 이미지 파일 삭제
    
    Args:
        image_url: 삭제할 이미지 URL
    """
    if not image_url:
        return
    
    try:
        # URL에서 파일명 추출
        filename = os.path.basename(image_url)
        file_path = Path(settings.UPLOAD_DIR) / filename
        
        # 파일 존재 확인 후 삭제
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
    except Exception as e:
        # 파일 삭제 실패해도 계속 진행 (로그만 남김)
        print(f"이미지 삭제 실패: {str(e)}")

