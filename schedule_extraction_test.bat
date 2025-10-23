@echo off
REM Schedule Extraction Test Runner

echo 🚀 Schedule Extraction Test
echo ================================

REM Check if docker container is running
docker ps | findstr "grandby_api" >nul
if %errorlevel% neq 0 (
    echo ❌ grandby_api container is not running.
    echo    Please start containers with 'docker-compose up -d' first.
    pause
    exit /b 1
)

echo ✅ Docker container check completed

REM Copy script to docker container
echo 📁 Copying schedule extraction test script to container...
docker cp backend/schedule_extraction_test.py grandby_api:/app/schedule_extraction_test.py

REM Run script in docker container
echo 🧪 Running schedule extraction test...
echo ================================

docker exec grandby_api python /app/schedule_extraction_test.py

echo ================================
echo ✅ Schedule extraction test completed
pause
