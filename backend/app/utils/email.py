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
    
    # HTML 본문 (테이블 + 인라인 CSS, 이메일 클라이언트 호환성 강화)
    html_content = f"""
    <!DOCTYPE html>
    <html lang=\"ko\">
      <head>
        <meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">
        <meta name=\"x-apple-disable-message-reformatting\">
        <meta name=\"format-detection\" content=\"telephone=no,date=no,address=no,email=no,url=no\">
        <title>그랜비 이메일 인증</title>
      </head>
      <body style=\"margin:0;padding:0;background-color:#F5F7F8;\">
        <center style=\"width:100%;background-color:#F5F7F8;\">
          <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\" style=\"background-color:#F5F7F8;\">
            <tr>
              <td align=\"center\" style=\"padding:24px 12px;\">
                <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"600\" style=\"max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;\">
                  <tr>
                    <td style=\"background-color:#40B59F;border-top-left-radius:12px;border-top-right-radius:12px;padding:28px 24px;text-align:center;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:28px;line-height:34px;color:#FFFFFF;font-weight:700;\">그랜비</div>
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:20px;color:#E8FFFA;margin-top:6px;\">소중한 부모님 곁에 함께</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:28px 24px 8px 24px;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:18px;line-height:26px;color:#111827;font-weight:700;\">안녕하세요!</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:0 24px 20px 24px;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:15px;line-height:24px;color:#374151;\">그랜비 회원가입을 위한 이메일 인증 코드입니다.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:0 24px 20px 24px;\">
                      <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\" style=\"border:2px solid #40B59F;border-radius:12px;background-color:#F3FBF9;\">
                        <tr>
                          <td style=\"padding:18px 16px 6px 16px;text-align:center;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:20px;color:#6B7280;\">인증 코드</div>
                          </td>
                        </tr>
                        <tr>
                          <td style=\"padding:0 16px 6px 16px;text-align:center;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:44px;line-height:54px;color:#40B59F;letter-spacing:6px;font-weight:700;\">{code}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style=\"padding:0 16px 18px 16px;text-align:center;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:18px;color:#6B7280;\">유효시간: 5분</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:0 24px 8px 24px;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:22px;color:#374151;\">
                        위 인증 코드를 회원가입 화면에 입력해주세요. 인증 코드는 <strong>5분간 유효</strong>하며, <strong>5회</strong>까지 입력하실 수 있습니다.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:12px 24px 24px 24px;\">
                      <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\" style=\"background-color:#FFF7ED;border-left:4px solid #F59E0B;border-radius:6px;\">
                        <tr>
                          <td style=\"padding:12px 14px;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:20px;color:#7C2D12;\">본인이 요청하지 않은 인증 코드라면 이 이메일을 무시하셔도 됩니다. 타인에게 인증 코드를 알려주지 마세요.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:18px 24px 28px 24px;text-align:center;border-top:1px solid #E5E7EB;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;\">그랜비 | Grandby</div>
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:18px;color:#6B7280;margin-top:6px;\">AI 기반 어르신 케어 서비스<br>이 이메일은 발신 전용입니다.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
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


async def send_password_reset_email(to_email: str, code: str) -> bool:
    """
    비밀번호 재설정 코드 발송
    
    Args:
        to_email: 받는 사람 이메일
        code: 6자리 인증 코드
    
    Returns:
        성공 여부
    """
    subject = "[그랜비] 비밀번호 재설정 코드"
    
    # HTML 본문 (테이블 + 인라인 CSS로 호환성 강화)
    html_content = f"""
    <!DOCTYPE html>
    <html lang=\"ko\">
      <head>
        <meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">
        <meta name=\"x-apple-disable-message-reformatting\">
        <meta name=\"format-detection\" content=\"telephone=no,date=no,address=no,email=no,url=no\">
        <title>그랜비 비밀번호 재설정</title>
      </head>
      <body style=\"margin:0;padding:0;background-color:#F5F7F8;\">
        <center style=\"width:100%;background-color:#F5F7F8;\">
          <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\" style=\"background-color:#F5F7F8;\">
            <tr>
              <td align=\"center\" style=\"padding:24px 12px;\">
                <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"600\" style=\"max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;\">
                  <tr>
                    <td style=\"background-color:#40B59F;border-top-left-radius:12px;border-top-right-radius:12px;padding:28px 24px;text-align:center;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:28px;line-height:34px;color:#FFFFFF;font-weight:700;\">그랜비</div>
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:20px;color:#E8FFFA;margin-top:6px;\">소중한 부모님 곁에 함께</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:28px 24px 8px 24px;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:18px;line-height:26px;color:#111827;font-weight:700;\">안녕하세요!</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:0 24px 20px 24px;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:15px;line-height:24px;color:#374151;\">비밀번호 재설정을 위한 인증 코드입니다.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:0 24px 20px 24px;\">
                      <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\" style=\"border:2px solid #40B59F;border-radius:12px;background-color:#F3FBF9;\">
                        <tr>
                          <td style=\"padding:18px 16px 6px 16px;text-align:center;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:20px;color:#6B7280;\">인증 코드</div>
                          </td>
                        </tr>
                        <tr>
                          <td style=\"padding:0 16px 6px 16px;text-align:center;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:44px;line-height:54px;color:#40B59F;letter-spacing:6px;font-weight:700;\">{code}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style=\"padding:0 16px 18px 16px;text-align:center;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:18px;color:#6B7280;\">유효시간: 5분</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:0 24px 8px 24px;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:22px;color:#374151;\">위 인증 코드를 비밀번호 재설정 화면에 입력해주세요. 인증 코드는 <strong>5분간 유효</strong>하며, <strong>5회</strong>까지 입력하실 수 있습니다.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:12px 24px 24px 24px;\">
                      <table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\" style=\"background-color:#FFF7ED;border-left:4px solid #F59E0B;border-radius:6px;\">
                        <tr>
                          <td style=\"padding:12px 14px;\">
                            <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:20px;color:#7C2D12;\">본인이 요청하지 않은 인증 코드라면 이 이메일을 무시하셔도 됩니다. 타인에게 인증 코드를 절대 알려주지 마세요.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding:18px 24px 28px 24px;text-align:center;border-top:1px solid #E5E7EB;\">
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:20px;color:#111827;font-weight:700;\">그랜비 | Grandby</div>
                      <div style=\"font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:18px;color:#6B7280;margin-top:6px;\">AI 기반 어르신 케어 서비스<br>이 이메일은 발신 전용입니다.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>
    """
    
    # 텍스트 버전
    text_content = f"""
[그랜비] 비밀번호 재설정 코드

안녕하세요!
비밀번호 재설정을 위한 인증 코드입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
인증 코드: {code}
유효시간: 5분
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 인증 코드를 비밀번호 재설정 화면에 입력해주세요.

⚠️ 본인이 요청하지 않은 인증 코드라면 즉시 고객센터로 연락해주세요.
타인에게 인증 코드를 절대 알려주지 마세요.

───────────────────────────────
그랜비 | Grandby
AI 기반 어르신 케어 서비스
    """
    
    return await send_email(to_email, subject, html_content, text_content)

