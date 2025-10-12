/**
 * Root Layout - Expo Router
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function RootLayout() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    // 앱 시작 시 저장된 사용자 정보 로드
    loadUser();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="home" />
      <Stack.Screen name="mypage" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

