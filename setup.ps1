# Grandby Project Automated Setup Script (Windows PowerShell)
# Usage: .\setup.ps1

Write-Host "========================================" -ForegroundColor Green
Write-Host " Grandby Project Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 1. Check Docker Status
Write-Host "[Step 1/5] Checking Docker..." -ForegroundColor Cyan
try {
    $dockerRunning = docker ps 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
    Write-Host "  > Docker is running" -ForegroundColor Green
} catch {
    Write-Host "  > ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Download: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 2. Clean up existing containers
Write-Host "[Step 2/5] Cleaning up existing containers..." -ForegroundColor Cyan
docker-compose down 2>$null | Out-Null
Write-Host "  > Cleanup complete" -ForegroundColor Green
Write-Host ""

# 3. Start Backend Docker containers
Write-Host "[Step 3/5] Building and starting Docker containers..." -ForegroundColor Cyan
Write-Host "  (This may take 2-3 minutes on first run)" -ForegroundColor Yellow
docker-compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  > ERROR: Docker Compose failed" -ForegroundColor Red
    exit 1
}
Write-Host "  > Backend containers started" -ForegroundColor Green
Write-Host ""

# 4. Wait for Database health check
Write-Host "[Step 4/5] Waiting for database to be ready..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0
$success = $false

while ($attempt -lt $maxAttempts) {
    try {
        $dbHealthy = docker inspect --format='{{.State.Health.Status}}' grandby_postgres 2>$null
        if ($dbHealthy -eq "healthy") {
            Write-Host "  > PostgreSQL is ready" -ForegroundColor Green
            $success = $true
            break
        }
    } catch {
        # Continue trying
    }
    
    $attempt++
    $dots = "." * ($attempt % 4)
    Write-Host "  Waiting$dots ($attempt/$maxAttempts)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if (-not $success) {
    Write-Host "  > ERROR: Database health check timeout" -ForegroundColor Red
    Write-Host "  Run 'docker logs grandby_postgres' to check logs" -ForegroundColor Yellow
    exit 1
}

# 5. Run Database Migration
Write-Host ""
Write-Host "[Step 4.5/5] Running database migration..." -ForegroundColor Cyan
Start-Sleep -Seconds 3  # Wait for API container to fully start

docker exec grandby_api alembic upgrade head 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  > Database migration complete" -ForegroundColor Green
} else {
    Write-Host "  > WARNING: Migration failed (may already be up to date)" -ForegroundColor Yellow
}
Write-Host ""

# 6. Install Frontend Dependencies
Write-Host "[Step 5/5] Installing frontend dependencies..." -ForegroundColor Cyan
if (Test-Path "frontend/node_modules") {
    Write-Host "  > node_modules found (skipping install)" -ForegroundColor Yellow
    Write-Host "  > Run 'cd frontend && npm install' to reinstall if needed" -ForegroundColor Yellow
} else {
    Write-Host "  > Running npm install (1-2 minutes)..." -ForegroundColor Yellow
    Push-Location frontend
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  > ERROR: npm install failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  > Frontend dependencies installed" -ForegroundColor Green
}
Write-Host ""

# 7. Setup Complete Message
Write-Host "========================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 8. Show Running Containers
Write-Host "Running Containers:" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | Select-String "grandby"
Write-Host ""

# 9. Next Steps
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  === Frontend (Mobile App) ===" -ForegroundColor White
Write-Host "    cd frontend" -ForegroundColor Yellow
Write-Host "    npx expo start --tunnel" -ForegroundColor Yellow
Write-Host "    " -ForegroundColor White
Write-Host "    >> Scan QR code with Expo Go app on your phone!" -ForegroundColor Magenta
Write-Host ""
Write-Host "  === Backend API Documentation ===" -ForegroundColor White
Write-Host "    http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "  === Useful Commands ===" -ForegroundColor White
Write-Host "    docker logs grandby_api -f        # View backend logs" -ForegroundColor Yellow
Write-Host "    docker logs grandby_postgres -f   # View database logs" -ForegroundColor Yellow
Write-Host "    docker-compose restart            # Restart containers" -ForegroundColor Yellow
Write-Host "    docker-compose down               # Stop containers" -ForegroundColor Yellow
Write-Host ""
Write-Host "Happy Coding!" -ForegroundColor Green
Write-Host ""
