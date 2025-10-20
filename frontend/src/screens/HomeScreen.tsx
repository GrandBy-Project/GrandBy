/**
 * 홈 화면 (로그인 후 메인 화면)
 * 어르신과 보호자 계정에 따라 다른 화면을 보여줍니다.
 */
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { ElderlyHomeScreen } from './ElderlyHomeScreen';
import { GuardianHomeScreen } from './GuardianHomeScreen';
import { UserRole } from '../types';

export const HomeScreen = () => {
  const { user } = useAuthStore();
  const router = useRouter();

  // 사용자가 로그인하지 않은 경우 로그인 화면으로 리다이렉트
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  // 사용자가 로그인하지 않은 경우 아무것도 렌더링하지 않음
  if (!user) {
    return null;
  }

  // 사용자 role에 따라 다른 화면 렌더링
  if (user.role === UserRole.ELDERLY) {
    return <ElderlyHomeScreen />;
  }

  return <GuardianHomeScreen />;
};

