/**
 * 커스텀 아이콘 컴포넌트 모음
 * ElderlyHomeScreen에서 사용하는 아이콘들
 */
import React from 'react';
import { View } from 'react-native';

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

