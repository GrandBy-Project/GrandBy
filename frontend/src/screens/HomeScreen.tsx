/**
 * 홈 화면 (로그인 후 메인 화면)
 * 어르신과 보호자 계정에 따라 다른 화면을 보여줍니다.
 */
import React from 'react';
import { useAuthStore } from '../store/authStore';
import { ElderlyHomeScreen } from './ElderlyHomeScreen';
import { GuardianHomeScreen } from './GuardianHomeScreen';
import { UserRole } from '../types';

export const HomeScreen = () => {
  const { user } = useAuthStore();

  // 사용자 role에 따라 다른 화면 렌더링
  if (user?.role === UserRole.ELDERLY) {
    return <ElderlyHomeScreen />;
  }

  return <GuardianHomeScreen />;
};

