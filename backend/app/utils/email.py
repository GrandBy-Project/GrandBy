"""
이메일 전송 유틸리티
SMTP를 사용한 이메일 발송
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings
import logging

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None
) -> bool:
    """
    이메일 발송
    
    Args:
        to_email: 받는 사람 이메일
        subject: 제목
        html_content: HTML 본문
        text_content: 텍스트 본문 (선택)
    
    Returns:
        성공 여부
    """
    # 이메일 기능이 비활성화되어 있으면 콘솔 출력
    if not settings.ENABLE_EMAIL:
        logger.info(f"\n{'='*50}")
        logger.info(f"📧 이메일 발송 (개발 모드 - 콘솔 출력)")
        logger.info(f"{'='*50}")
        logger.info(f"받는 사람: {to_email}")
        logger.info(f"제목: {subject}")
        logger.info(f"내용:\n{text_content or html_content}")
        logger.info(f"{'='*50}\n")
        return True
    
    try:
        # MIME 메시지 생성
        message = MIMEMultipart("alternative")
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject
        
        # 텍스트 버전 추가
        if text_content:
            part_text = MIMEText(text_content, "plain", "utf-8")
            message.attach(part_text)
        
        # HTML 버전 추가
        part_html = MIMEText(html_content, "html", "utf-8")
        message.attach(part_html)
        
        # SMTP 연결 및 전송
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,  # TLS 사용
        )
        
        logger.info(f"✅ 이메일 발송 성공: {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ 이메일 발송 실패: {to_email} - {str(e)}")
        return False


async def send_verification_email(to_email: str, code: str) -> bool:
    """
    이메일 인증 코드 발송
    
    Args:
        to_email: 받는 사람 이메일
        code: 6자리 인증 코드
    
    Returns:
        성공 여부
    """
    subject = "[그랜비] 이메일 인증 코드"
    
    # HTML 본문
    html_content = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #40B59F 0%, #359681 100%);
                padding: 40px 20px;
                text-align: center;
                color: white;
            }}
            .header h1 {{
                margin: 0;
                font-size: 32px;
                font-weight: bold;
            }}
            .header p {{
                margin: 10px 0 0;
                font-size: 16px;
                opacity: 0.9;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .greeting {{
                font-size: 18px;
                color: #333;
                margin-bottom: 20px;
            }}
            .code-box {{
                background-color: #E6F7F4;
                border: 2px solid #40B59F;
                border-radius: 8px;
                padding: 30px;
                text-align: center;
                margin: 30px 0;
            }}
            .code {{
                font-size: 48px;
                font-weight: bold;
                color: #40B59F;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
            }}
            .info {{
                font-size: 14px;
                color: #666;
                line-height: 1.6;
                margin: 20px 0;
            }}
            .warning {{
                background-color: #FFF4E6;
                border-left: 4px solid #FF9500;
                padding: 15px;
                margin: 20px 0;
                font-size: 14px;
                color: #666;
            }}
            .footer {{
                background-color: #f9f9f9;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e0e0e0;
            }}
            .footer p {{
                margin: 5px 0;
                font-size: 13px;
                color: #999;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>👴❤️ 그랜비</h1>
                <p>소중한 부모님 곁에 함께</p>
            </div>
            
            <div class="content">
                <p class="greeting">안녕하세요!</p>
                <p class="greeting">그랜비 회원가입을 위한 이메일 인증 코드입니다.</p>
                
                <div class="code-box">
                    <div style="font-size: 14px; color: #666; margin-bottom: 15px;">
                        인증 코드
                    </div>
                    <div class="code">{code}</div>
                    <div style="font-size: 12px; color: #999; margin-top: 15px;">
                        유효시간: 5분
                    </div>
                </div>
                
                <p class="info">
                    위 인증 코드를 회원가입 화면에 입력해주세요.<br>
                    인증 코드는 <strong>5분간 유효</strong>하며, 5회까지 입력하실 수 있습니다.
                </p>
                
                <div class="warning">
                    ⚠️ 본인이 요청하지 않은 인증 코드라면 이 이메일을 무시하셔도 됩니다.<br>
                    타인에게 인증 코드를 알려주지 마세요.
                </div>
            </div>
            
            <div class="footer">
                <p><strong>그랜비 | Grandby</strong></p>
                <p>AI 기반 어르신 케어 서비스</p>
                <p style="margin-top: 15px;">
                    이 이메일은 발신 전용입니다.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # 텍스트 버전 (HTML을 지원하지 않는 이메일 클라이언트용)
    text_content = f"""
[그랜비] 이메일 인증 코드

안녕하세요!
그랜비 회원가입을 위한 이메일 인증 코드입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
인증 코드: {code}
유효시간: 5분
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 인증 코드를 회원가입 화면에 입력해주세요.

⚠️ 본인이 요청하지 않은 인증 코드라면 이 이메일을 무시하셔도 됩니다.
타인에게 인증 코드를 알려주지 마세요.

───────────────────────────────
그랜비 | Grandby
AI 기반 어르신 케어 서비스
    """
    
    return await send_email(to_email, subject, html_content, text_content)

