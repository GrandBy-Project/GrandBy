/**
 * Root Layout - Expo Router
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '../src/api/auth';
import { useAuthStore } from '../src/store/authStore';
import { GlobalAlertProvider } from '../src/components/GlobalAlertProvider';

// 푸시 알림 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const { loadUser, user } = useAuthStore();

  useEffect(() => {
    // 앱 시작 시 저장된 사용자 정보 로드
    loadUser();
  }, []);

  useEffect(() => {
    // 사용자가 로그인되어 있을 때만 푸시 토큰 등록
    if (user) {
      registerForPushNotifications();
    }
  }, [user]);

  const registerForPushNotifications = async () => {
    try {
      // 권한 요청
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('푸시 알림 권한이 거부되었습니다.');
        return;
      }

      // FCM 토큰 직접 가져오기 (Firebase Admin SDK용)
      const fcmToken = await Notifications.getDevicePushTokenAsync();
      console.log('FCM Token:', fcmToken.data);
      
      // Expo Push Token도 가져오기 (Expo Push API용)
      const expoToken = await Notifications.getExpoPushTokenAsync({
        projectId: '8c549577-e069-461c-807f-3f64d823fe74',
      });
      console.log('Expo Push Token:', expoToken.data);
      
      // 서버에 FCM 토큰 등록 (Firebase Admin SDK용)
      await registerPushToken(fcmToken.data);
      console.log('FCM 토큰이 서버에 등록되었습니다.');
      
    } catch (error) {
      console.error('푸시 알림 등록 실패:', error);
    }
  };

  return (
    <GlobalAlertProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade', // 페이드 전환으로 더 깔끔한 페이지 전환
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="home" />
        <Stack.Screen name="mypage" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="todos" />
        <Stack.Screen name="todo-detail" />
        <Stack.Screen name="todo-write" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="ai-call" />
      </Stack>
    </GlobalAlertProvider>
  );
}

