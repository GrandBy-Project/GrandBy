import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

interface ResponsiveSize {
  width: number;
  height: number;
  scale: number; // 기준 너비(375px) 대비 순수 비율
  heightScale: number; // 기준 높이(812px) 대비 순수 비율
}

/**
 * 화면 크기에 따라 반응형 값을 반환하는 hook
 * 순수 비율 기반 계산 (강제 제한 최소화)
 */
export const useResponsive = (): ResponsiveSize => {
  const [dimensions, setDimensions] = useState<ScaledSize>(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const width = dimensions.width;
  const height = dimensions.height;
  
  // 기준 디자인: iPhone X (375x812) 기준
  // 순수 비율 계산 (강제 제한 없음)
  const scale = width / 375;
  const heightScale = height / 812;

  return {
    width,
    height,
    scale,
    heightScale,
  };
};

/**
 * 화면 너비에 비례한 폰트 크기 계산
 * 최소 터치/가독성만 보장 (12px)
 */
export const getResponsiveFontSize = (
  baseSize: number,
  scale: number
): number => {
  const scaled = baseSize * scale;
  // 최소 가독성 보장 (12px)
  return Math.max(scaled, 12);
};

/**
 * 화면 너비에 비례한 크기 계산
 * 최소 터치 영역만 보장 (44x44)
 */
export const getResponsiveSize = (
  baseSize: number,
  scale: number,
  isTouchable: boolean = false
): number => {
  const scaled = baseSize * scale;
  // 터치 가능한 요소는 최소 44px 보장
  if (isTouchable) {
    return Math.max(scaled, 44);
  }
  return scaled;
};

/**
 * 화면 너비에 비례한 패딩 계산
 * 최소 4px 보장
 */
export const getResponsivePadding = (
  basePadding: number,
  scale: number
): number => {
  const scaled = basePadding * scale;
  return Math.max(scaled, 4);
};

