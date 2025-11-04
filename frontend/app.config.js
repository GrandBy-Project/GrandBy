/**
 * Expo Configuration
 * minSdkVersion을 26으로 설정하기 위해 expo-build-properties 플러그인 사용
 * (Health Connect 라이브러리 요구사항)
 * 
 * 환경 변수 사용 예시:
 * - process.env.EXPO_PUBLIC_API_BASE_URL
 * - process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY
 */

module.exports = {
  expo: {
    name: "Grandby",
    slug: "frontend",
    version: "1.0.0",
    owner: "grandby2",
    orientation: "portrait",
    platforms: ["ios", "android"],
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/grandby-logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.parad327.grandby",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.parad327.grandby",
      googleServicesFile: "./google-services.json",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_CONTACTS",
        "android.permission.WRITE_CONTACTS",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.health.READ_STEPS",
        "android.permission.health.WRITE_STEPS",
      ],
    },
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 26, // Health Connect requires minSdk 26
          },
        },
      ],
      "expo-router",
      "expo-web-browser",
      "expo-secure-store",
      "expo-font",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "날씨 정보를 제공하기 위해 위치 권한이 필요합니다.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/haruPushLogo.png",
          color: "#ffffff",
          sounds: [],
          modes: ["production", "development"],
          notificationPermission: "알림을 받기 위해 권한이 필요합니다.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "프로필 사진 촬영을 위해 카메라 권한이 필요합니다.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "프로필 사진 선택을 위해 사진 접근 권한이 필요합니다.",
        },
      ],
      [
        "expo-contacts",
        {
          contactsPermission: "연락처 접근을 위해 권한이 필요합니다.",
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: "034ee5d2-677f-46a1-95f6-a022d63f5874",
      },
    },
  },
};

