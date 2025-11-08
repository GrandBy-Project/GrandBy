"""
법적 페이지 라우터 (개인정보 처리방침, 계정 삭제 안내)
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()


@router.get("/privacy", response_class=HTMLResponse, tags=["Legal"])
@router.get("/privacy-policy", response_class=HTMLResponse, tags=["Legal"])
async def privacy_policy():
    """
    개인정보 처리방침 페이지 (구글 플레이 콘솔 제출용)
    
    URL: https://grandby-app.store/privacy
    또는: https://grandby-app.store/privacy-policy
    """
    html_content = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>그랜비 개인정보 처리방침</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
            line-height: 1.8;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 28px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 22px;
            padding-left: 10px;
            border-left: 4px solid #3498db;
        }
        h3 {
            color: #555;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 18px;
        }
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        ul, ol {
            margin-left: 30px;
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 8px;
        }
        .last-updated {
            color: #7f8c8d;
            font-size: 14px;
            margin-bottom: 30px;
            text-align: right;
        }
        .contact-info {
            background-color: #ecf0f1;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .contact-info h3 {
            margin-top: 0;
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 24px;
            }
            h2 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>개인정보 처리방침</h1>
        <p class="last-updated">최종 수정일: 2024년 1월 1일</p>
        
        <p>그랜비(이하 "회사")는 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보 보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.</p>
        
        <h2>제1조 (개인정보의 처리 목적)</h2>
        <p>그랜비(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
        
        <h3>1. 회원 관리</h3>
        <ul>
            <li>회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리</li>
            <li>각종 고지·통지, 고충처리, 분쟁 조정을 위한 기록 보존</li>
        </ul>
        
        <h3>2. 서비스 제공</h3>
        <ul>
            <li>일기장 서비스 제공, AI 전화 서비스 제공</li>
            <li>할 일 관리 서비스 제공, 보호자-어르신 연결 서비스 제공</li>
            <li>맞춤형 콘텐츠 제공 및 서비스 개선</li>
        </ul>
        
        <h3>3. 안전 및 보안 관리</h3>
        <ul>
            <li>이상 징후 탐지 및 보호자 알림</li>
            <li>부정 이용 방지 및 서비스 안정성 확보</li>
        </ul>
        
        <h2>제2조 (개인정보의 처리 및 보유기간)</h2>
        <p>1. 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
        <p>2. 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.</p>
        <ul>
            <li>회원 가입 및 관리: 회원 탈퇴 시까지 (단, 관계 법령 위반에 따른 수사·조사 등이 진행중인 경우에는 해당 수사·조사 종료 시까지)</li>
            <li>재화 또는 서비스 제공: 재화·서비스 공급완료 및 요금결제·정산 완료 시까지</li>
            <li>전화 상담 등 서비스 이용 기록: 3년 (통신비밀보호법)</li>
        </ul>
        
        <h2>제3조 (처리하는 개인정보의 항목)</h2>
        <p>회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
        <ol>
            <li><strong>필수항목:</strong> 이메일, 비밀번호, 이름, 전화번호, 생년월일, 성별, 사용자 유형(어르신/보호자)</li>
            <li><strong>선택항목:</strong> 프로필 사진, 알림 수신 설정</li>
            <li><strong>자동 수집항목:</strong> IP주소, 쿠키, 서비스 이용 기록, 접속 로그</li>
        </ol>
        
        <h2>제4조 (개인정보의 제3자 제공)</h2>
        <p>회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
        
        <h2>제5조 (개인정보처리의 위탁)</h2>
        <p>회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
        <ul>
            <li>클라우드 서비스 제공업체: 서버 운영 및 데이터 보관</li>
            <li>푸시 알림 서비스 제공업체: 알림 발송 서비스</li>
        </ul>
        
        <h2>제6조 (정보주체의 권리·의무 및 그 행사방법)</h2>
        <p>1. 정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
        <ul>
            <li>개인정보 처리정지 요구</li>
            <li>개인정보 열람요구</li>
            <li>개인정보 정정·삭제요구</li>
        </ul>
        <p>2. 제1항에 따른 권리 행사는 회사에 대해 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.</p>
        
        <h2>제7조 (개인정보의 파기)</h2>
        <p>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
        
        <h2>제8조 (개인정보 보호책임자)</h2>
        <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
        
        <div class="contact-info">
            <h3>개인정보 보호책임자</h3>
            <p><strong>이메일:</strong> privacy@grandby.kr</p>
            <p><strong>전화번호:</strong> 02-1234-5678</p>
        </div>
        
        <h2>제9조 (개인정보의 안전성 확보 조치)</h2>
        <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
        <ol>
            <li><strong>관리적 조치:</strong> 내부관리계획 수립·시행, 정기적 직원 교육 등</li>
            <li><strong>기술적 조치:</strong> 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치</li>
            <li><strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근통제</li>
        </ol>
        
        <h2>제10조 (디바이스 권한의 수집 및 이용)</h2>
        <p>회사는 서비스 제공을 위해 다음과 같은 디바이스 권한을 요청하며, 각 권한은 해당 기능 사용 시에만 요청됩니다.</p>
        
        <h3>1. 필수 권한</h3>
        <ul>
            <li><strong>알림 권한 (POST_NOTIFICATIONS):</strong> 푸시 알림을 통한 서비스 알림 수신을 위해 필요합니다. (거부 시 알림 수신 불가)</li>
            <li><strong>인터넷 접근 권한:</strong> 서비스 이용을 위한 기본 권한입니다.</li>
        </ul>
        
        <h3>2. 선택 권한</h3>
        <ul>
            <li><strong>카메라 권한 (CAMERA):</strong> 프로필 사진 촬영 시 사용됩니다. (거부 시 카메라 촬영 기능 사용 불가)</li>
            <li><strong>사진 라이브러리 접근 권한:</strong> 프로필 사진 및 다이어리 사진 선택 시 사용됩니다. (거부 시 사진 선택 기능 사용 불가)</li>
            <li><strong>위치 권한 (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION):</strong> 날씨 정보 제공을 위해 사용됩니다. (거부 시 날씨 정보 제공 불가)</li>
            <li><strong>오디오 녹음 권한 (RECORD_AUDIO):</strong> AI 전화 서비스 이용 시 음성 인식을 위해 사용됩니다. (거부 시 AI 전화 서비스 이용 불가)</li>
            <li><strong>연락처 접근 권한 (READ_CONTACTS, WRITE_CONTACTS):</strong> 연락처 기능 사용 시 필요합니다. (거부 시 연락처 기능 사용 불가)</li>
        </ul>
        
        <h3>3. 권한 이용 목적</h3>
        <ul>
            <li>카메라 및 사진 라이브러리: 프로필 사진 설정, 다이어리 사진 첨부</li>
            <li>위치 정보: 사용자 위치 기반 날씨 정보 제공</li>
            <li>오디오 녹음: AI 전화 서비스의 음성 인식 및 대화 처리</li>
            <li>연락처: 연락처 관리 기능 제공</li>
            <li>알림: 서비스 관련 알림 및 이상 징후 알림 전송</li>
        </ul>
        
        <h3>4. 권한 거부 시 영향</h3>
        <p>선택 권한의 경우 거부하셔도 서비스의 기본 기능은 이용하실 수 있습니다. 다만, 해당 권한이 필요한 기능은 이용하실 수 없습니다.</p>
        
        <h3>5. 권한 관리</h3>
        <p>사용자는 언제든지 디바이스 설정에서 권한을 변경하거나 철회할 수 있습니다. 권한을 변경하시면 앱을 재시작한 후 변경사항이 적용됩니다.</p>
        
        <h2>제11조 (개인정보 처리방침 변경)</h2>
        <p>이 개인정보 처리방침은 2024년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.</p>
    </div>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


@router.get("/account-deletion", response_class=HTMLResponse, tags=["Legal"])
async def account_deletion():
    """
    계정 및 데이터 삭제 안내 페이지 (구글 플레이 콘솔 제출용)
    
    URL: https://api.grandby-app.store/account-deletion
    """
    html_content = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>그랜비 계정 및 데이터 삭제 안내</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
            line-height: 1.8;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 28px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 22px;
            padding-left: 10px;
            border-left: 4px solid #3498db;
        }
        h3 {
            color: #555;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 18px;
        }
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        ul, ol {
            margin-left: 30px;
            margin-bottom: 15px;
        }
        li {
            margin-bottom: 8px;
        }
        .app-name {
            color: #3498db;
            font-weight: bold;
            font-size: 24px;
        }
        .method-box {
            background-color: #ecf0f1;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #3498db;
        }
        .method-box h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .step {
            background-color: #fff;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
        .step-number {
            display: inline-block;
            background-color: #3498db;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            text-align: center;
            line-height: 30px;
            font-weight: bold;
            margin-right: 10px;
        }
        .contact-info {
            background-color: #ecf0f1;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .contact-info h3 {
            margin-top: 0;
        }
        .warning-box {
            background-color: #fff3cd;
            border: 2px solid #ffc107;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .warning-box h3 {
            color: #856404;
            margin-top: 0;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .data-table th {
            background-color: #3498db;
            color: white;
        }
        .data-table tr:hover {
            background-color: #f5f5f5;
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 24px;
            }
            h2 {
                font-size: 20px;
            }
            .data-table {
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>계정 및 데이터 삭제 안내</h1>
        <p class="app-name">그랜비 (Grandby)</p>
        <p>그랜비 앱에서 계정 및 관련 데이터를 삭제하는 방법을 안내합니다.</p>
        
        <h2>계정 삭제 방법</h2>
        <p>그랜비 앱에서 계정을 삭제하는 방법은 다음과 같습니다:</p>
        
        <div class="method-box">
            <h3>📱 방법 1: 앱 내에서 직접 삭제 (권장)</h3>
            <div class="step">
                <span class="step-number">1</span>
                <strong>앱 실행</strong> → 하단 메뉴에서 <strong>"마이페이지"</strong> 탭 선택
            </div>
            <div class="step">
                <span class="step-number">2</span>
                <strong>"계정 삭제"</strong> 또는 <strong>"회원 탈퇴"</strong> 메뉴 선택
            </div>
            <div class="step">
                <span class="step-number">3</span>
                <strong>비밀번호 확인</strong> (이메일 로그인 사용자의 경우)
            </div>
            <div class="step">
                <span class="step-number">4</span>
                <strong>삭제 확인</strong> → 계정 삭제 완료
            </div>
        </div>
        
        <div class="method-box">
            <h3>📧 방법 2: 이메일로 삭제 요청</h3>
            <p>앱 접근이 어려운 경우, 아래 이메일로 계정 삭제를 요청하실 수 있습니다.</p>
            <div class="step">
                <span class="step-number">1</span>
                <strong>이메일 작성</strong><br>
                받는 사람: <strong>privacy@grandby.kr</strong><br>
                제목: <strong>[계정 삭제 요청]</strong>
            </div>
            <div class="step">
                <span class="step-number">2</span>
                <strong>본인 확인 정보 포함</strong><br>
                - 가입 시 사용한 이메일 주소<br>
                - 가입 시 사용한 전화번호 (선택사항)<br>
                - 계정 삭제 사유 (선택사항)
            </div>
            <div class="step">
                <span class="step-number">3</span>
                <strong>이메일 발송</strong> → 영업일 기준 7일 이내 처리
            </div>
        </div>
        
        <div class="warning-box">
            <h3>⚠️ 계정 삭제 시 주의사항</h3>
            <ul>
                <li><strong>복구 불가:</strong> 계정 삭제 후 30일 이내에 다시 로그인하시면 계정을 복구할 수 있습니다. 30일이 지나면 모든 데이터가 영구적으로 삭제되며 복구가 불가능합니다.</li>
                <li><strong>연결 해제:</strong> 보호자-어르신 연결 관계가 자동으로 해제됩니다.</li>
                <li><strong>서비스 이용 불가:</strong> 계정 삭제 후 앱의 모든 기능을 이용하실 수 없습니다.</li>
            </ul>
        </div>
        
        <h2>삭제되는 데이터</h2>
        <p>계정 삭제 시 다음 데이터가 삭제됩니다:</p>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th>데이터 유형</th>
                    <th>삭제 시점</th>
                    <th>비고</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>계정 정보</strong><br>(이메일, 이름, 전화번호, 생년월일, 성별)</td>
                    <td>즉시 삭제</td>
                    <td>익명화 처리</td>
                </tr>
                <tr>
                    <td><strong>프로필 이미지</strong></td>
                    <td>즉시 삭제</td>
                    <td>서버에서 완전 삭제</td>
                </tr>
                <tr>
                    <td><strong>다이어리</strong><br>(일기 내용, 사진)</td>
                    <td>즉시 삭제</td>
                    <td>복구 불가</td>
                </tr>
                <tr>
                    <td><strong>할 일 (TODO)</strong></td>
                    <td>즉시 삭제</td>
                    <td>복구 불가</td>
                </tr>
                <tr>
                    <td><strong>AI 통화 기록</strong><br>(통화 내용, 녹음 파일)</td>
                    <td>즉시 삭제</td>
                    <td>복구 불가</td>
                </tr>
                <tr>
                    <td><strong>알림 설정</strong></td>
                    <td>즉시 삭제</td>
                    <td>-</td>
                </tr>
                <tr>
                    <td><strong>보호자-어르신 연결 정보</strong></td>
                    <td>즉시 삭제</td>
                    <td>연결 관계 해제</td>
                </tr>
            </tbody>
        </table>
        
        <h2>보관되는 데이터</h2>
        <p>법령에 따라 다음 데이터는 일정 기간 보관 후 삭제됩니다:</p>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th>데이터 유형</th>
                    <th>보관 기간</th>
                    <th>법적 근거</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>서비스 이용 기록</strong><br>(접속 로그, IP 주소)</td>
                    <td>3개월</td>
                    <td>통신비밀보호법</td>
                </tr>
                <tr>
                    <td><strong>계약 또는 청약철회 등에 관한 기록</strong></td>
                    <td>5년</td>
                    <td>전자상거래법</td>
                </tr>
                <tr>
                    <td><strong>대금결제 및 재화의 공급에 관한 기록</strong></td>
                    <td>5년</td>
                    <td>전자상거래법</td>
                </tr>
                <tr>
                    <td><strong>소비자 불만 또는 분쟁 처리에 관한 기록</strong></td>
                    <td>3년</td>
                    <td>전자상거래법</td>
                </tr>
            </tbody>
        </table>
        
        <h2>데이터 삭제 처리 기간</h2>
        <ul>
            <li><strong>앱 내 삭제:</strong> 즉시 처리 (30일 유예 기간 후 완전 삭제)</li>
            <li><strong>이메일 요청:</strong> 영업일 기준 최대 7일 이내 처리</li>
            <li><strong>법령에 따른 보관 데이터:</strong> 보관 기간 경과 후 자동 삭제</li>
        </ul>
        
        <h2>문의처</h2>
        <div class="contact-info">
            <h3>개인정보 보호책임자</h3>
            <p><strong>이메일:</strong> privacy@grandby.kr</p>
            <p><strong>전화번호:</strong> 02-1234-5678</p>
            <p><strong>처리 시간:</strong> 평일 09:00 ~ 18:00 (주말 및 공휴일 제외)</p>
        </div>
        
        <div class="warning-box" style="margin-top: 30px;">
            <h3>📌 중요 안내</h3>
            <p>계정 삭제 전에 다음 사항을 확인해주세요:</p>
            <ul>
                <li>보관하고 싶은 다이어리나 할 일이 있다면 미리 백업하세요.</li>
                <li>연결된 보호자 또는 어르신에게 계정 삭제 사실을 알려주세요.</li>
                <li>30일 이내에 다시 로그인하시면 계정을 복구할 수 있습니다.</li>
            </ul>
        </div>
        
        <p style="margin-top: 30px; color: #7f8c8d; font-size: 14px; text-align: right;">
            최종 수정일: 2024년 1월 1일
        </p>
    </div>
</body>
</html>
    """
    return HTMLResponse(content=html_content)
