/**
 * 스플래쉬 스크린
 * 자동 로그인 검증 및 초기 라우팅
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { TokenManager } from '../api/client';
import * as authApi from '../api/auth';
import { useAuthStore } from '../store/authStore';

export const SplashScreen = () => {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [statusMessage, setStatusMessage] = useState('반갑습니다. 그랜비입니다.');
  

  useEffect(() => {
    checkAutoLogin();
  }, []);

  

  const checkAutoLogin = async () => {
    try {
      setStatusMessage('반갑습니다. 그랜비입니다.');
      
      // 1. 토큰 확인
      const tokens = await TokenManager.getTokens();
      
      if (!tokens) {
        // 토큰 없음 → 로그인 페이지
        setTimeout(() => {
          router.replace('/login');
        }, 1000);
        return;
      }

      // 2. Access Token 유효성 확인
      if (await TokenManager.isAccessTokenValid()) {
        // Access Token 유효 → 사용자 정보 가져오기
        try {
          setStatusMessage('반갑습니다. 그랜비입니다.');
          const user = await authApi.verifyToken();
          
          // 사용자 정보 저장
          setUser(user);
          
          // 메인 페이지로 이동
          setTimeout(() => {
            router.replace('/home');
          }, 500);
          return;
        } catch (error) {
          // Access Token이 유효하지 않거나 검증 실패
          console.log('Access Token 검증 실패');
        }
      }

      // 3. Refresh Token으로 갱신 시도
      if (await TokenManager.isRefreshTokenValid()) {
        try {
          setStatusMessage('반갑습니다. 그랜비입니다.');
          const response = await authApi.refreshToken(tokens.refresh_token);
          
          // 사용자 정보 저장
          setUser(response.user);
          
          // 메인 페이지로 이동
          setTimeout(() => {
            router.replace('/home');
          }, 500);
          return;
        } catch (error) {
          console.log('Refresh Token 갱신 실패:', error);
        }
      }

      // 4. 모든 토큰 무효 → 로그아웃 처리
      await TokenManager.clearTokens();
      setStatusMessage('로그인이 만료되었습니다');
      
      setTimeout(() => {
        router.replace('/login');
      }, 1000);
      
    } catch (error) {
      console.error('자동 로그인 오류:', error);
      setStatusMessage('오류가 발생했습니다');
      
      // 오류 발생 시 로그인 페이지로
      setTimeout(() => {
        router.replace('/login');
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      {/* 로고 이미지 */}
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../assets/GrandByLogo.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* 상태 메시지 */}
      <Text style={styles.statusMessage}>{statusMessage}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // 흰색 배경
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoImage: {
    width: 400,
    height: 400,
  },
  statusMessage: {
    fontSize: 14,
    color: '#666666', // 회색
    textAlign: 'center',
  },
});

