"""
카카오 API 유틸리티
카카오 OAuth 인증 및 사용자 정보 조회
"""
import httpx
from app.config import settings
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class KakaoAPI:
    """카카오 API 클라이언트"""
    
    # 카카오 API 엔드포인트
    KAKAO_AUTH_URL = "https://kauth.kakao.com"
    KAKAO_API_URL = "https://kapi.kakao.com"
    
    def __init__(self):
        self.rest_api_key = settings.KAKAO_REST_API_KEY
        self.redirect_uri = settings.KAKAO_REDIRECT_URI
        self.client_secret = settings.KAKAO_CLIENT_SECRET
    
    def get_authorization_url(self, state: str | None = None) -> str:
        """
        카카오 로그인 인증 URL 생성
        
        Args:
            state: CSRF 방지용 state 값
        
        Returns:
            인증 URL
        """
        params = {
            "client_id": self.rest_api_key,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
        }
        
        if state:
            params["state"] = state
        
        # 추가 scope (필요한 정보 요청)
        # ✅ 사업자 등록 없이 받을 수 있는 정보만 요청
        # profile_nickname: 카카오 닉네임
        # profile_image: 프로필 이미지
        # account_email: 이메일 (사용자 동의 필요)
        # ❌ phone_number, birthday, gender: 비즈니스 인증 필요
        params["scope"] = "profile_nickname,profile_image,account_email"
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.KAKAO_AUTH_URL}/oauth/authorize?{query_string}"
    
    async def get_access_token(self, code: str) -> Dict[str, Any]:
        """
        인증 코드로 액세스 토큰 발급
        
        Args:
            code: 카카오로부터 받은 인증 코드
        
        Returns:
            토큰 정보 (access_token, refresh_token, expires_in 등)
        """
        url = f"{self.KAKAO_AUTH_URL}/oauth/token"
        
        data = {
            "grant_type": "authorization_code",
            "client_id": self.rest_api_key,
            "redirect_uri": self.redirect_uri,
            "code": code,
        }
        
        if self.client_secret:
            data["client_secret"] = self.client_secret
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=data)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"카카오 액세스 토큰 발급 실패: {e}")
            raise
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        리프레시 토큰으로 액세스 토큰 갱신
        
        Args:
            refresh_token: 리프레시 토큰
        
        Returns:
            새로운 토큰 정보
        """
        url = f"{self.KAKAO_AUTH_URL}/oauth/token"
        
        data = {
            "grant_type": "refresh_token",
            "client_id": self.rest_api_key,
            "refresh_token": refresh_token,
        }
        
        if self.client_secret:
            data["client_secret"] = self.client_secret
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=data)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"카카오 토큰 갱신 실패: {e}")
            raise
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        액세스 토큰으로 사용자 정보 조회
        
        Args:
            access_token: 카카오 액세스 토큰
        
        Returns:
            사용자 정보
        """
        url = f"{self.KAKAO_API_URL}/v2/user/me"
        
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"카카오 사용자 정보 조회 실패: {e}")
            raise
    
    async def unlink_user(self, access_token: str) -> Dict[str, Any]:
        """
        카카오 계정 연결 해제
        
        Args:
            access_token: 카카오 액세스 토큰
        
        Returns:
            연결 해제 결과
        """
        url = f"{self.KAKAO_API_URL}/v1/user/unlink"
        
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"카카오 연결 해제 실패: {e}")
            raise
    
    def parse_user_info(self, kakao_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        카카오 사용자 정보를 우리 시스템 형식으로 파싱
        
        Args:
            kakao_user: 카카오 API로부터 받은 사용자 정보
        
        Returns:
            파싱된 사용자 정보
        """
        kakao_account = kakao_user.get("kakao_account", {})
        profile = kakao_account.get("profile", {})
        
        # 기본 정보 추출
        parsed_info = {
            "kakao_id": str(kakao_user.get("id")),
            "email": kakao_account.get("email"),
            "name": profile.get("nickname"),
            "profile_image": profile.get("profile_image_url"),
            "phone_number": None,
            "birth_date": None,
            "gender": None,
        }
        
        # 전화번호 파싱 (있는 경우)
        if kakao_account.get("phone_number"):
            # +82 10-1234-5678 형식을 01012345678로 변환
            phone = kakao_account["phone_number"].replace("+82 ", "0").replace("-", "")
            parsed_info["phone_number"] = phone
        
        # 생년월일 파싱 (있는 경우)
        if kakao_account.get("birthday") and kakao_account.get("birthyear"):
            # birthday: MMDD, birthyear: YYYY
            birth_year = kakao_account["birthyear"]
            birth_month_day = kakao_account["birthday"]
            parsed_info["birth_date"] = f"{birth_year}-{birth_month_day[:2]}-{birth_month_day[2:]}"
        
        # 성별 파싱 (있는 경우)
        if kakao_account.get("gender"):
            # male, female
            parsed_info["gender"] = kakao_account["gender"]
        
        logger.info(f"카카오 사용자 정보 파싱 완료: {parsed_info.get('email')}")
        return parsed_info


# 전역 인스턴스
kakao_api = KakaoAPI()

