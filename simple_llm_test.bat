@echo off
REM Simple LLM Prompt Test Runner

echo 🚀 Simple LLM Prompt Test
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
echo 📁 Copying test script to container...
docker cp backend/simple_llm_test.py grandby_api:/app/simple_llm_test.py

REM Run script in docker container
echo 🧪 Running LLM prompt test...
echo ================================

docker exec grandby_api python /app/simple_llm_test.py

echo ================================
echo ✅ Test completed
pause
