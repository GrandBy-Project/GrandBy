# Grandby 프로젝트 자동 셋업 스크립트 (Windows PowerShell)
# 사용법: .\setup.ps1

Write-Host "========================================" -ForegroundColor Green
Write-Host "🚀 Grandby 프로젝트 셋업 시작" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 1. Docker 실행 확인
Write-Host "📦 Step 1/5: Docker 상태 확인..." -ForegroundColor Cyan
try {
    $dockerRunning = docker ps 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
    Write-Host "✅ Docker 실행 중" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker가 실행 중이지 않습니다. Docker Desktop을 실행해주세요." -ForegroundColor Red
    Write-Host ""
    Write-Host "Docker Desktop 다운로드: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 2. 기존 컨테이너 정리
Write-Host "🧹 Step 2/5: 기존 컨테이너 정리..." -ForegroundColor Cyan
docker-compose down 2>$null | Out-Null
Write-Host "✅ 정리 완료" -ForegroundColor Green
Write-Host ""

# 3. Backend Docker 컨테이너 시작
Write-Host "🐳 Step 3/5: Backend Docker 컨테이너 빌드 및 시작..." -ForegroundColor Cyan
Write-Host "  (최초 실행 시 2-3분 소요될 수 있습니다)" -ForegroundColor Yellow
docker-compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker Compose 실행 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend 컨테이너 시작 완료" -ForegroundColor Green
Write-Host ""

# 4. DB 헬스체크 대기
Write-Host "⏳ Step 4/5: 데이터베이스 준비 대기 중..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0
$success = $false

while ($attempt -lt $maxAttempts) {
    try {
        $dbHealthy = docker inspect --format='{{.State.Health.Status}}' grandby_postgres 2>$null
        if ($dbHealthy -eq "healthy") {
            Write-Host "✅ PostgreSQL 준비 완료" -ForegroundColor Green
            $success = $true
            break
        }
    } catch {
        # 계속 시도
    }
    
    $attempt++
    $dots = "." * ($attempt % 4)
    Write-Host "  대기 중$dots ($attempt/$maxAttempts)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if (-not $success) {
    Write-Host "❌ DB 헬스체크 타임아웃" -ForegroundColor Red
    Write-Host "  docker logs grandby_postgres 명령으로 로그를 확인하세요." -ForegroundColor Yellow
    exit 1
}

# 5. DB 마이그레이션 실행
Write-Host ""
Write-Host "🗄️  데이터베이스 마이그레이션 실행..." -ForegroundColor Cyan
Start-Sleep -Seconds 3  # API 컨테이너 완전 시작 대기

docker exec grandby_api alembic upgrade head 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ DB 마이그레이션 완료" -ForegroundColor Green
} else {
    Write-Host "⚠️  마이그레이션 실패 (이미 완료되었거나 초기 상태일 수 있습니다)" -ForegroundColor Yellow
}
Write-Host ""

# 6. Frontend 의존성 설치
Write-Host "📱 Step 5/5: Frontend 의존성 설치..." -ForegroundColor Cyan
if (Test-Path "frontend/node_modules") {
    Write-Host "  기존 node_modules 발견됨 (설치 스킵)" -ForegroundColor Yellow
    Write-Host "  재설치가 필요하면 'cd frontend && npm install' 실행" -ForegroundColor Yellow
} else {
    Write-Host "  npm install 실행 중... (1-2분 소요)" -ForegroundColor Yellow
    Push-Location frontend
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install 실패" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "✅ Frontend 의존성 설치 완료" -ForegroundColor Green
}
Write-Host ""

# 7. 셋업 완료 메시지
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 셋업 완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 8. Docker 컨테이너 상태 출력
Write-Host "📊 실행 중인 컨테이너:" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | Select-String "grandby"
Write-Host ""

# 9. 다음 단계 안내
Write-Host "📋 다음 명령어로 앱을 실행하세요:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "  │  Frontend 실행 (모바일 앱)                    │" -ForegroundColor White
Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor White
Write-Host "    cd frontend" -ForegroundColor Yellow
Write-Host "    npx expo start --tunnel" -ForegroundColor Yellow
Write-Host "    " -ForegroundColor White
Write-Host "    ※ QR 코드를 핸드폰 Expo Go 앱으로 스캔하세요!" -ForegroundColor Magenta
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "  │  Backend API 문서 (Swagger UI)              │" -ForegroundColor White
Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor White
Write-Host "    http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "  │  유용한 명령어                               │" -ForegroundColor White
Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor White
Write-Host "    docker logs grandby_api -f        # Backend 로그 확인" -ForegroundColor Yellow
Write-Host "    docker logs grandby_postgres -f   # DB 로그 확인" -ForegroundColor Yellow
Write-Host "    docker-compose restart            # 컨테이너 재시작" -ForegroundColor Yellow
Write-Host "    docker-compose down               # 컨테이너 중지" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎊 즐거운 개발 되세요! Happy Coding!" -ForegroundColor Green
Write-Host ""

