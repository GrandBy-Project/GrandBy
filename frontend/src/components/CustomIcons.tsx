/**
 * 커스텀 아이콘 컴포넌트 모음
 * ElderlyHomeScreen에서 사용하는 아이콘들
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const CheckIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.8,
      height: size * 0.8,
      borderRadius: size * 0.1,
      borderWidth: size * 0.08,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ scaleX: -1 }]
    }}>
      <View style={{
        width: size * 0.3,
        height: size * 0.15,
        borderBottomWidth: size * 0.08,
        borderRightWidth: size * 0.08,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -size * 0.05,
      }} />
    </View>
  </View>
);

export const PhoneIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.7,
      height: size * 0.9,
      borderRadius: size * 0.15,
      borderWidth: size * 0.08,
      borderColor: color,
      backgroundColor: 'transparent',
    }} />
    <View style={{
      width: size * 0.3,
      height: size * 0.05,
      backgroundColor: color,
      borderRadius: size * 0.025,
      position: 'absolute',
      top: size * 0.2,
    }} />
    <View style={{
      width: size * 0.15,
      height: size * 0.15,
      backgroundColor: color,
      borderRadius: size * 0.075,
      position: 'absolute',
      bottom: size * 0.15,
    }} />
  </View>
);

export const DiaryIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.8,
      height: size * 0.9,
      borderRadius: size * 0.05,
      borderWidth: size * 0.08,
      borderColor: color,
      backgroundColor: 'transparent',
    }} />
    <View style={{
      width: size * 0.5,
      height: size * 0.08,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.25,
    }} />
    <View style={{
      width: size * 0.4,
      height: size * 0.08,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.4,
    }} />
    <View style={{
      width: size * 0.3,
      height: size * 0.08,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.55,
    }} />
  </View>
);

export const NotificationIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.6,
      height: size * 0.6,
      borderTopLeftRadius: size * 0.3,
      borderTopRightRadius: size * 0.3,
      borderWidth: size * 0.08,
      borderBottomWidth: 0,
      borderColor: color,
      backgroundColor: 'transparent',
    }} />
    <View style={{
      width: size * 0.8,
      height: size * 0.1,
      backgroundColor: color,
      borderRadius: size * 0.05,
      position: 'absolute',
      bottom: size * 0.25,
    }} />
    <View style={{
      width: size * 0.2,
      height: size * 0.15,
      borderTopLeftRadius: size * 0.1,
      borderTopRightRadius: size * 0.1,
      backgroundColor: color,
      position: 'absolute',
      bottom: size * 0.1,
    }} />
  </View>
);

export const PillIcon = ({ size = 24, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.8,
      height: size * 0.4,
      borderRadius: size * 0.2,
      backgroundColor: color,
      flexDirection: 'row',
    }}>
      <View style={{
        width: '50%',
        height: '100%',
        backgroundColor: color,
        borderTopLeftRadius: size * 0.2,
        borderBottomLeftRadius: size * 0.2,
      }} />
      <View style={{
        width: '50%',
        height: '100%',
        backgroundColor: 'rgba(52, 183, 159, 0.5)',
        borderTopRightRadius: size * 0.2,
        borderBottomRightRadius: size * 0.2,
      }} />
    </View>
  </View>
);

export const SunIcon = ({ size = 24, color = '#FFB800' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.5,
      height: size * 0.5,
      borderRadius: size * 0.25,
      backgroundColor: color,
    }} />
    {/* 태양 광선들 */}
    {Array.from({ length: 8 }).map((_, index) => {
      const angle = (index * 45) * (Math.PI / 180);
      const x = Math.cos(angle) * size * 0.35;
      const y = Math.sin(angle) * size * 0.35;
      return (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: size * 0.08,
            height: size * 0.2,
            backgroundColor: color,
            borderRadius: size * 0.04,
            transform: [
              { translateX: x },
              { translateY: y },
              { rotate: `${index * 45}deg` }
            ],
          }}
        />
      );
    })}
  </View>
);

export const ProfileIcon = ({ size = 36, color = '#34B79F' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{
      width: size * 0.4,
      height: size * 0.4,
      borderRadius: size * 0.2,
      backgroundColor: color,
      marginBottom: size * 0.1,
    }} />
    <View style={{
      width: size * 0.7,
      height: size * 0.35,
      backgroundColor: color,
      borderTopLeftRadius: size * 0.35,
      borderTopRightRadius: size * 0.35,
    }} />
  </View>
);

/**
 * OpenWeatherMap 아이콘 코드에 따라 날씨 아이콘을 반환하는 컴포넌트
 * @param iconCode OpenWeatherMap 아이콘 코드 (예: "01d", "02n")
 * @param size 아이콘 크기
 * @param color 아이콘 색상
 */
export const WeatherIcon = ({ 
  iconCode, 
  size = 24, 
  color = '#FFB800' 
}: { 
  iconCode?: string; 
  size?: number; 
  color?: string;
}) => {
  // OpenWeatherMap 아이콘 코드 매핑
  const getIconName = (code: string): string => {
    // 첫 두 자리 숫자로 날씨 상태 판단
    const prefix = code.substring(0, 2);
    
    switch (prefix) {
      case '01': // 맑음 (clear sky)
        return 'sunny';
      case '02': // 약간 흐림 (few clouds)
        return 'partly-sunny';
      case '03': // 흐림 (scattered clouds)
        return 'cloudy';
      case '04': // 매우 흐림 (broken clouds)
        return 'cloudy-outline';
      case '09': // 소나기 (shower rain)
        return 'rainy';
      case '10': // 비 (rain)
        return 'rainy';
      case '11': // 천둥번개 (thunderstorm)
        return 'thunderstorm';
      case '13': // 눈 (snow)
        return 'snow';
      case '50': // 안개 (mist)
        return 'cloudy-outline';
      default:
        return 'sunny'; // 기본값: 맑음
    }
  };

  // 아이콘 색상 매핑 (날씨 상태에 따라)
  const getIconColor = (code: string): string => {
    const prefix = code.substring(0, 2);
    
    switch (prefix) {
      case '01': // 맑음
        return '#FFB800'; // 노란색
      case '02': // 약간 흐림
        return '#FFA500'; // 주황색
      case '03': // 흐림
      case '04': // 매우 흐림
        return '#87CEEB'; // 하늘색
      case '09': // 소나기
      case '10': // 비
        return '#4682B4'; // 강철색
      case '11': // 천둥번개
        return '#FF6347'; // 토마토색
      case '13': // 눈
        return '#E0E0E0'; // 회색
      case '50': // 안개
        return '#D3D3D3'; // 연한 회색
      default:
        return color; // 기본 색상
    }
  };

  if (!iconCode) {
    return <SunIcon size={size} color={color} />;
  }

  const iconName = getIconName(iconCode);
  const iconColor = getIconColor(iconCode);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={iconName} size={size} color={iconColor} />
    </View>
  );
};

