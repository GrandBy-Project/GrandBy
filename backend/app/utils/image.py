"""
이미지 업로드 및 처리 유틸리티
"""

from PIL import Image
import io
import os
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.config import settings
from app.utils.s3 import upload_file_to_s3, delete_file_from_s3, get_s3_key_from_url
import uuid
import logging

logger = logging.getLogger(__name__)


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
    
    # 이미지를 메모리에 JPEG로 저장
    image_bytes = io.BytesIO()
    image.save(image_bytes, 'JPEG', quality=85, optimize=True)
    image_bytes.seek(0)
    file_data = image_bytes.read()
    
    # 고유 파일명 생성
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.jpg"
    s3_key = f"profiles/{filename}"
    
    # S3에 업로드
    try:
        s3_url = upload_file_to_s3(
            file_data=file_data,
            s3_key=s3_key,
            content_type="image/jpeg"
        )
        logger.info(f"✅ 프로필 이미지 S3 업로드 완료: {s3_url}")
        return s3_url
    except Exception as e:
        logger.error(f"❌ 프로필 이미지 S3 업로드 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"이미지 업로드 중 오류가 발생했습니다: {str(e)}"
        )


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


async def save_diary_image(file: UploadFile, diary_id: str, user_id: str) -> str:
    """
    일기 사진 저장 및 리사이징
    
    Args:
        file: 업로드된 파일
        diary_id: 일기 ID
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
        
        # 일기 사진은 최대 너비/높이 1920px로 리사이징 (비율 유지)
        max_size = (1920, 1920)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"이미지 처리 중 오류가 발생했습니다: {str(e)}"
        )
    
    # 이미지를 메모리에 JPEG로 저장
    image_bytes = io.BytesIO()
    image.save(image_bytes, 'JPEG', quality=90, optimize=True)
    image_bytes.seek(0)
    file_data = image_bytes.read()
    
    # 고유 파일명 생성
    filename = f"{diary_id}_{user_id}_{uuid.uuid4().hex[:8]}.jpg"
    s3_key = f"diaries/{filename}"
    
    # S3에 업로드
    try:
        s3_url = upload_file_to_s3(
            file_data=file_data,
            s3_key=s3_key,
            content_type="image/jpeg"
        )
        logger.info(f"✅ 일기 이미지 S3 업로드 완료: {s3_url}")
        return s3_url
    except Exception as e:
        logger.error(f"❌ 일기 이미지 S3 업로드 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"이미지 업로드 중 오류가 발생했습니다: {str(e)}"
        )


async def delete_profile_image(image_url: str) -> None:
    """
    프로필 이미지 파일 삭제 (S3 또는 로컬)
    
    Args:
        image_url: 삭제할 이미지 URL (S3 URL 또는 로컬 경로)
    """
    if not image_url:
        return
    
    try:
        # S3 URL인지 확인
        s3_key = get_s3_key_from_url(image_url)
        if s3_key:
            # S3에서 삭제
            delete_file_from_s3(s3_key)
            logger.info(f"✅ S3 프로필 이미지 삭제 완료: {s3_key}")
        else:
            # 로컬 파일 삭제 (하위 호환성)
            filename = os.path.basename(image_url)
            file_path = Path(settings.UPLOAD_DIR) / filename
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
                logger.info(f"✅ 로컬 프로필 이미지 삭제 완료: {filename}")
    except Exception as e:
        # 파일 삭제 실패해도 계속 진행 (로그만 남김)
        logger.warning(f"⚠️ 이미지 삭제 실패: {str(e)}")

