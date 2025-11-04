#!/bin/bash
# ============================================
# Grandby Frontend 배포 스크립트
# EAS Build를 사용한 프로덕션 빌드
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# ============================================
# 배포 전 확인
# ============================================
log_info "🚀 Grandby Frontend 배포 시작..."

# 프론트엔드 디렉토리로 이동
cd "$(dirname "$0")/../frontend" || exit 1

# 필수 파일 확인
if [ ! -f "app.json" ]; then
    log_error "app.json 파일을 찾을 수 없습니다."
    exit 1
fi

if [ ! -f "eas.json" ]; then
    log_error "eas.json 파일을 찾을 수 없습니다."
    exit 1
fi

# EAS CLI 설치 확인
if ! command -v eas &> /dev/null; then
    log_error "EAS CLI가 설치되어 있지 않습니다."
    log_info "다음 명령어로 설치하세요: npm install -g eas-cli"
    exit 1
fi

# EAS 로그인 확인
log_step "1. EAS 로그인 확인..."
if ! eas whoami &> /dev/null; then
    log_warn "EAS에 로그인되어 있지 않습니다."
    log_info "로그인 중..."
    eas login
fi

# ============================================
# 환경 변수 확인
# ============================================
log_step "2. 환경 변수 확인..."
if [ ! -f ".env" ]; then
    log_warn ".env 파일이 없습니다."
    if [ -f "env.example" ]; then
        log_info "env.example 파일을 참고하여 .env 파일을 생성하세요."
    fi
else
    if grep -q "EXPO_PUBLIC_API_BASE_URL" .env; then
        API_URL=$(grep "EXPO_PUBLIC_API_BASE_URL" .env | cut -d '=' -f2)
        log_info "API URL: $API_URL"
    else
        log_warn "EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다."
    fi
fi

# ============================================
# Git 상태 확인
# ============================================
log_step "3. Git 상태 확인..."
if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current)
    log_info "현재 브랜치: $CURRENT_BRANCH"
    
    if [ -n "$(git status --porcelain)" ]; then
        log_warn "커밋되지 않은 변경사항이 있습니다."
        read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# ============================================
# 빌드 프로필 선택
# ============================================
log_step "4. 빌드 프로필 선택..."
echo "빌드 프로필을 선택하세요:"
echo "  1) development - 개발용 빌드"
echo "  2) preview - 내부 테스트용"
echo "  3) production - 프로덕션 배포용"
read -p "선택 (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        PROFILE="development"
        BUILD_TYPE="apk"
        ;;
    2)
        PROFILE="preview"
        BUILD_TYPE="apk"
        ;;
    3)
        PROFILE="production"
        BUILD_TYPE="app-bundle"
        log_warn "⚠️  프로덕션 빌드는 플레이스토어 제출용입니다."
        ;;
    *)
        log_error "잘못된 선택입니다."
        exit 1
        ;;
esac

log_info "선택된 프로필: $PROFILE"
log_info "빌드 타입: $BUILD_TYPE"

# ============================================
# 플랫폼 선택
# ============================================
log_step "5. 플랫폼 선택..."
echo "플랫폼을 선택하세요:"
echo "  1) android"
echo "  2) ios"
echo "  3) both"
read -p "선택 (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        PLATFORM="android"
        ;;
    2)
        PLATFORM="ios"
        ;;
    3)
        PLATFORM="all"
        ;;
    *)
        log_error "잘못된 선택입니다."
        exit 1
        ;;
esac

log_info "선택된 플랫폼: $PLATFORM"

# ============================================
# 최종 확인
# ============================================
log_step "6. 최종 확인..."
log_info "빌드 정보:"
log_info "  프로필: $PROFILE"
log_info "  플랫폼: $PLATFORM"
log_info "  타입: $BUILD_TYPE"
echo ""
read -p "빌드를 시작하시겠습니까? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "빌드를 취소했습니다."
    exit 0
fi

# ============================================
# 빌드 실행
# ============================================
log_step "7. 빌드 실행..."
log_info "빌드가 시작됩니다. 완료까지 시간이 걸릴 수 있습니다..."

if [ "$PLATFORM" = "all" ]; then
    # Android 빌드
    log_info "📱 Android 빌드 시작..."
    if [ "$PROFILE" = "production" ]; then
        eas build --platform android --profile "$PROFILE" --type "$BUILD_TYPE" --non-interactive
    else
        eas build --platform android --profile "$PROFILE" --non-interactive
    fi
    
    # iOS 빌드
    log_info "🍎 iOS 빌드 시작..."
    eas build --platform ios --profile "$PROFILE" --non-interactive
else
    if [ "$PROFILE" = "production" ] && [ "$PLATFORM" = "android" ]; then
        eas build --platform "$PLATFORM" --profile "$PROFILE" --type "$BUILD_TYPE" --non-interactive
    else
        eas build --platform "$PLATFORM" --profile "$PROFILE" --non-interactive
    fi
fi

# ============================================
# 빌드 완료
# ============================================
log_info ""
log_info "🎉 빌드 완료!"
log_info ""
log_info "📝 다음 단계:"
log_info "   1. 빌드 상태 확인: eas build:list"
log_info "   2. 빌드 다운로드: EAS 대시보드에서 다운로드"
if [ "$PROFILE" = "production" ]; then
    log_info "   3. 플레이스토어 제출: eas submit --platform android"
fi
log_info ""
log_info "🔗 EAS 대시보드: https://expo.dev/accounts/parad327/projects/frontend/builds"

