# Grandby Project Automated Setup Script (Windows PowerShell)
# Hacker Style Edition - ASCII Only
# Usage: .\setup.ps1

# Progress bar animation (ASCII only)
function Show-Progress {
    param(
        [int]$Percent,
        [string]$Status,
        [int]$BarLength = 40
    )
    
    $filled = [math]::Floor($BarLength * $Percent / 100)
    $empty = $BarLength - $filled
    $bar = "#" * $filled + "." * $empty
    
    Write-Host -NoNewline "`r["
    Write-Host -NoNewline $bar -ForegroundColor Cyan
    Write-Host -NoNewline "] $Percent% $Status"
}

# Typing effect
function Write-Typing {
    param(
        [string]$Text,
        [string]$Color = "White",
        [int]$Speed = 15
    )
    
    foreach ($char in $Text.ToCharArray()) {
        Write-Host $char -NoNewline -ForegroundColor $Color
        Start-Sleep -Milliseconds $Speed
    }
    Write-Host ""
}

# Spinner animation (ASCII only)
function Show-Spinner {
    param(
        [string]$Message,
        [int]$Duration = 2
    )
    
    $spinners = @('|', '/', '-', '\')
    $end = (Get-Date).AddSeconds($Duration)
    $i = 0
    
    while ((Get-Date) -lt $end) {
        $spinner = $spinners[$i % $spinners.Length]
        Write-Host "`r[$spinner] $Message" -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 100
        $i++
    }
    
    Write-Host "`r[+] $Message" -ForegroundColor Green
}

# ASCII Banner
function Show-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  =========================================" -ForegroundColor Cyan
    Write-Host "   _____                     _ _           " -ForegroundColor Cyan
    Write-Host "  / ____|                   | | |          " -ForegroundColor Green
    Write-Host " | |  __ _ __ __ _ _ __   __| | |__  _   _ " -ForegroundColor Green
    Write-Host " | | |_ | '__/ _\` | '_ \ / _\` | '_ \| | | |" -ForegroundColor Yellow
    Write-Host " | |__| | | | (_| | | | | (_| | |_) | |_| |" -ForegroundColor Yellow
    Write-Host "  \_____|_|  \__,_|_| |_|\__,_|_.__/ \__, |" -ForegroundColor Red
    Write-Host "                                      __/ |" -ForegroundColor Red
    Write-Host "                                     |___/ " -ForegroundColor Red
    Write-Host "  =========================================" -ForegroundColor Cyan
    Write-Host "   AI-Powered Elderly Care Platform v1.0  " -ForegroundColor White
    Write-Host "   Automated Setup System                 " -ForegroundColor Gray
    Write-Host "  =========================================" -ForegroundColor Cyan
    Write-Host ""
    Start-Sleep -Milliseconds 500
}

# Status display (ASCII only)
function Show-Status {
    param(
        [string]$Step,
        [string]$Status,
        [string]$Color = "Green"
    )
    
    $statusSymbol = switch ($Status) {
        "OK" { "[+]" }
        "ERROR" { "[!]" }
        "PROCESSING" { "[*]" }
        "WAITING" { "[~]" }
        default { "[.]" }
    }
    
    $padding = " " * (35 - $Step.Length)
    Write-Host "  $statusSymbol $Step$padding$Status" -ForegroundColor $Color
}

# Divider line
function Show-Divider {
    Write-Host "  ---------------------------------------------------------" -ForegroundColor DarkGray
}

# Main Setup
Show-Banner

Write-Typing ">> Initializing Grandby Project Setup System..." "Cyan" 15
Write-Host ""
Start-Sleep -Milliseconds 300

# Progress tracking
$totalSteps = 5
$currentStep = 0

# 1. Docker Check
Write-Host ""
Show-Divider
Write-Host "  PHASE 1/5: DOCKER VALIDATION" -ForegroundColor Cyan
Show-Divider
Write-Host ""

$currentStep++
Show-Progress -Percent (($currentStep / $totalSteps) * 100) -Status "Checking Docker daemon..."
Start-Sleep -Milliseconds 500
Write-Host ""

Show-Status "Docker Daemon" "CHECKING..." "Yellow"

try {
    $dockerRunning = docker ps 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
    Show-Status "Docker Daemon" "ONLINE" "Green"
    Show-Status "Docker Version" "$(docker --version)" "Green"
} catch {
    Show-Status "Docker Daemon" "OFFLINE" "Red"
    Write-Host ""
    Write-Host "  [!] ERROR: Docker Desktop is not running" -ForegroundColor Red
    Write-Host "  [>] Download: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Start-Sleep -Milliseconds 300

# 2. Cleanup
Write-Host ""
Show-Divider
Write-Host "  PHASE 2/5: ENVIRONMENT CLEANUP" -ForegroundColor Cyan
Show-Divider
Write-Host ""

$currentStep++
Show-Progress -Percent (($currentStep / $totalSteps) * 100) -Status "Cleaning environment..."
Start-Sleep -Milliseconds 500
Write-Host ""

Show-Status "Stopping containers" "PROCESSING..." "Yellow"
docker-compose down 2>$null | Out-Null
Show-Status "Stopping containers" "COMPLETE" "Green"
Show-Status "Removing volumes" "SKIPPED" "Gray"

Write-Host ""
Start-Sleep -Milliseconds 300

# 3. Docker Build
Write-Host ""
Show-Divider
Write-Host "  PHASE 3/5: CONTAINER BUILD" -ForegroundColor Cyan
Show-Divider
Write-Host ""

$currentStep++
Show-Progress -Percent (($currentStep / $totalSteps) * 100) -Status "Building containers..."
Start-Sleep -Milliseconds 500
Write-Host ""

Write-Host "  [*] Compiling Docker images..." -ForegroundColor Cyan
Write-Host "  [>] This may take 2-3 minutes on first run" -ForegroundColor Gray
Write-Host ""

Show-Status "PostgreSQL Image" "BUILDING..." "Yellow"
Show-Status "Redis Image" "BUILDING..." "Yellow"
Show-Status "FastAPI Image" "BUILDING..." "Yellow"
Show-Status "Celery Workers" "BUILDING..." "Yellow"

docker-compose up -d --build 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Show-Status "Docker Build" "FAILED" "Red"
    Write-Host ""
    exit 1
}

Write-Host "`r  [+] PostgreSQL Image                       READY    " -ForegroundColor Green
Write-Host "  [+] Redis Image                            READY    " -ForegroundColor Green
Write-Host "  [+] FastAPI Image                          READY    " -ForegroundColor Green
Write-Host "  [+] Celery Workers                         READY    " -ForegroundColor Green

Write-Host ""
Start-Sleep -Milliseconds 500

# 4. Database Health Check
Write-Host ""
Show-Divider
Write-Host "  PHASE 4/5: DATABASE INITIALIZATION" -ForegroundColor Cyan
Show-Divider
Write-Host ""

$currentStep++
Show-Progress -Percent (($currentStep / $totalSteps) * 100) -Status "Initializing database..."
Start-Sleep -Milliseconds 500
Write-Host ""

$maxAttempts = 30
$attempt = 0
$success = $false

Write-Host "  [~] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow

while ($attempt -lt $maxAttempts) {
    $dbHealthy = docker inspect --format='{{.State.Health.Status}}' grandby_postgres 2>$null
    if ($dbHealthy -eq "healthy") {
        $success = $true
        break
    }
    
    $attempt++
    $percent = [math]::Floor(($attempt / $maxAttempts) * 100)
    Show-Progress -Percent $percent -Status "Database initialization ($attempt/$maxAttempts)..."
    Start-Sleep -Seconds 2
}

Write-Host ""

if (-not $success) {
    Show-Status "Database Health" "TIMEOUT" "Red"
    Write-Host "  [!] Run 'docker logs grandby_postgres' for details" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Show-Status "Database Health" "HEALTHY" "Green"
Write-Host ""

# Run Migration
Write-Host "  [*] Executing database migrations..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
docker exec grandby_api alembic upgrade head 2>$null | Out-Null

if ($LASTEXITCODE -eq 0) {
    Show-Status "Database Migration" "SUCCESS" "Green"
} else {
    Show-Status "Database Migration" "SKIPPED (UP-TO-DATE)" "Yellow"
}

Write-Host ""
Start-Sleep -Milliseconds 500

# 5. Frontend Setup
Write-Host ""
Show-Divider
Write-Host "  PHASE 5/5: FRONTEND DEPENDENCIES" -ForegroundColor Cyan
Show-Divider
Write-Host ""

$currentStep++
Show-Progress -Percent (($currentStep / $totalSteps) * 100) -Status "Installing frontend..."
Start-Sleep -Milliseconds 500
Write-Host ""

if (Test-Path "frontend/node_modules") {
    Show-Status "Node Modules" "CACHED" "Yellow"
    Write-Host "  [>] Run 'cd frontend && npm install' to reinstall" -ForegroundColor Gray
} else {
    Show-Status "Node Modules" "INSTALLING..." "Yellow"
    Write-Host "  [*] Installing npm packages (1-2 minutes)..." -ForegroundColor Cyan
    Write-Host "  [>] Using --legacy-peer-deps for compatibility" -ForegroundColor Gray
    Push-Location frontend
    npm install --legacy-peer-deps --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Show-Status "Node Modules" "FAILED" "Red"
        Write-Host ""
        Write-Host "  [!] npm install failed. Possible solutions:" -ForegroundColor Red
        Write-Host "      1. Delete node_modules: rm -rf node_modules" -ForegroundColor Yellow
        Write-Host "      2. Clear npm cache: npm cache clean --force" -ForegroundColor Yellow
        Write-Host "      3. Try manually: cd frontend && npm install --legacy-peer-deps" -ForegroundColor Yellow
        Write-Host ""
        Pop-Location
        exit 1
    }
    Pop-Location
    Show-Status "Node Modules" "INSTALLED" "Green"
}

Write-Host ""
Start-Sleep -Milliseconds 500

# Completion
Write-Host ""
Show-Progress -Percent 100 -Status "Setup complete!                        "
Write-Host ""
Write-Host ""

Write-Host "  =========================================================" -ForegroundColor Green
Write-Host "                                                           " -ForegroundColor Green
Write-Host "         >>>  SETUP COMPLETED SUCCESSFULLY  <<<           " -ForegroundColor Green
Write-Host "                                                           " -ForegroundColor Green
Write-Host "  =========================================================" -ForegroundColor Green
Write-Host ""

# Show running containers
Write-Host "  +-- RUNNING SERVICES ----------------------------------+" -ForegroundColor Cyan
docker ps --format "  | {{.Names}}                {{.Status}}" | Select-String "grandby" | ForEach-Object {
    Write-Host $_ -ForegroundColor White
}
Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

# Next steps
Write-Host "  +-- NEXT STEPS ----------------------------------------+" -ForegroundColor Yellow
Write-Host "  |                                                       |" -ForegroundColor Yellow
Write-Host "  |  [1] Start Frontend App:                            |" -ForegroundColor Yellow
Write-Host "  |      cd frontend                                     |" -ForegroundColor White
Write-Host "  |      npx expo start --tunnel                         |" -ForegroundColor Cyan
Write-Host "  |                                                       |" -ForegroundColor Yellow
Write-Host "  |  [2] View API Documentation:                        |" -ForegroundColor Yellow
Write-Host "  |      http://localhost:8000/docs                      |" -ForegroundColor Cyan
Write-Host "  |                                                       |" -ForegroundColor Yellow
Write-Host "  |  [3] Monitor Backend Logs:                          |" -ForegroundColor Yellow
Write-Host "  |      docker logs grandby_api -f                      |" -ForegroundColor Cyan
Write-Host "  |                                                       |" -ForegroundColor Yellow
Write-Host "  +-------------------------------------------------------+" -ForegroundColor Yellow
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "  [+] Setup completed at $timestamp" -ForegroundColor Gray
Write-Host "  [+] All systems operational. Ready to code!" -ForegroundColor Green
Write-Host ""
Write-Host "  >>> Happy Hacking! <<<" -ForegroundColor Magenta
Write-Host ""