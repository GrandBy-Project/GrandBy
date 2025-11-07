"""
AWS S3 파일 업로드/다운로드/삭제 유틸리티
"""

import boto3
import logging
from typing import Optional
from botocore.exceptions import ClientError, NoCredentialsError
from app.config import settings

logger = logging.getLogger(__name__)

# S3 클라이언트 초기화
s3_client = None


def get_s3_client():
    """S3 클라이언트 싱글톤 반환"""
    global s3_client
    if s3_client is None:
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            logger.info(f"✅ S3 클라이언트 초기화 완료 (버킷: {settings.S3_BUCKET_NAME})")
        except NoCredentialsError:
            logger.error("❌ AWS 자격 증명을 찾을 수 없습니다. 환경 변수를 확인하세요.")
            raise
        except Exception as e:
            logger.error(f"❌ S3 클라이언트 초기화 실패: {e}")
            raise
    
    return s3_client


def upload_file_to_s3(
    file_data: bytes,
    s3_key: str,
    content_type: str = "image/jpeg",
    bucket_name: Optional[str] = None
) -> str:
    """
    파일을 S3에 업로드
    
    Args:
        file_data: 업로드할 파일 데이터 (bytes)
        s3_key: S3에 저장할 키 (경로 포함)
        content_type: 파일의 MIME 타입
        bucket_name: 버킷 이름 (None이면 설정에서 가져옴)
    
    Returns:
        str: S3 URL (https://{bucket}.s3.{region}.amazonaws.com/{key})
        
    Raises:
        ClientError: S3 업로드 실패
    """
    if bucket_name is None:
        bucket_name = settings.S3_BUCKET_NAME
    
    try:
        client = get_s3_client()
        
        # S3에 업로드 (퍼블릭 읽기 권한 설정)
        try:
            # ACL 설정 시도 (버킷 정책이 ACL을 허용하는 경우)
            client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=file_data,
                ContentType=content_type,
                ACL='public-read'  # 퍼블릭 읽기 권한
            )
        except ClientError as acl_error:
            # ACL이 비활성화된 경우 ACL 없이 업로드
            logger.warning(f"⚠️ ACL 설정 실패, ACL 없이 업로드 시도: {acl_error}")
            client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=file_data,
                ContentType=content_type
            )
        
        # S3 URL 생성
        s3_url = f"https://{bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
        
        logger.info(f"✅ S3 업로드 완료: {s3_key} ({len(file_data)} bytes)")
        return s3_url
        
    except ClientError as e:
        logger.error(f"❌ S3 업로드 실패: {e}")
        raise
    except Exception as e:
        logger.error(f"❌ S3 업로드 중 예상치 못한 오류: {e}")
        raise


def delete_file_from_s3(
    s3_key: str,
    bucket_name: Optional[str] = None
) -> bool:
    """
    S3에서 파일 삭제
    
    Args:
        s3_key: 삭제할 파일의 S3 키 (경로 포함)
        bucket_name: 버킷 이름 (None이면 설정에서 가져옴)
    
    Returns:
        bool: 삭제 성공 여부
    """
    if bucket_name is None:
        bucket_name = settings.S3_BUCKET_NAME
    
    try:
        client = get_s3_client()
        
        # S3에서 삭제
        client.delete_object(
            Bucket=bucket_name,
            Key=s3_key
        )
        
        logger.info(f"✅ S3 파일 삭제 완료: {s3_key}")
        return True
        
    except ClientError as e:
        logger.error(f"❌ S3 파일 삭제 실패: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ S3 파일 삭제 중 예상치 못한 오류: {e}")
        return False


def get_s3_key_from_url(s3_url: str) -> Optional[str]:
    """
    S3 URL에서 키 추출
    
    Args:
        s3_url: S3 URL (https://{bucket}.s3.{region}.amazonaws.com/{key})
    
    Returns:
        str: S3 키 (경로 포함), URL 형식이 아니면 None
    """
    try:
        # S3 URL 형식: https://{bucket}.s3.{region}.amazonaws.com/{key}
        if ".s3." in s3_url and "amazonaws.com" in s3_url:
            # URL에서 키 추출
            key = s3_url.split(".amazonaws.com/")[-1]
            return key
        # 로컬 경로 형식 (/uploads/...)인 경우 None 반환
        return None
    except Exception as e:
        logger.warning(f"⚠️ S3 URL 파싱 실패: {e}")
        return None

