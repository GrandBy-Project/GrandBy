/**
 * 수직 스크롤 가능한 시간 선택기 컴포넌트
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface TimePickerProps {
  value: string; // "HH:mm" 형식
  onChange: (time: string) => void; // "HH:mm" 형식으로 반환
  compact?: boolean; // 컴팩트 모드 (모달용)
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
// 5분 단위로 분 선택 
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

const CONTAINER_HEIGHT = 180;
const ITEM_HEIGHT = 50;
const PADDING_TOP = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

// 컴팩트 모드 상수
const COMPACT_CONTAINER_HEIGHT = 120;
const COMPACT_ITEM_HEIGHT = 36;
const COMPACT_PADDING_TOP = (COMPACT_CONTAINER_HEIGHT - COMPACT_ITEM_HEIGHT) / 2;

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, compact = false }) => {
  const [selectedHour, setSelectedHour] = useState('00');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [centerHour, setCenterHour] = useState('00'); // 스크롤 중 가운데 항목
  const [centerMinute, setCenterMinute] = useState('00'); // 스크롤 중 가운데 항목
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // 컴팩트 모드에 따른 상수 계산 (먼저 계산)
  const containerHeight = compact ? COMPACT_CONTAINER_HEIGHT : CONTAINER_HEIGHT;
  const itemHeight = compact ? COMPACT_ITEM_HEIGHT : ITEM_HEIGHT;
  const paddingTop = compact ? COMPACT_PADDING_TOP : PADDING_TOP;

  // 초기값 설정 및 value 변경 시 업데이트
  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':');
      const hour = h || '00';
      const minute = m || '00';
      setSelectedHour(hour);
      setSelectedMinute(minute);
      setCenterHour(hour);
      setCenterMinute(minute);
    }
  }, [value]);

  // 초기 스크롤 위치 설정
  useEffect(() => {
    const hourIndex = parseInt(selectedHour);
    // MINUTES 배열에서 해당 분의 인덱스 찾기
    const minuteIndex = MINUTES.findIndex(m => m === selectedMinute);
    
    // itemHeight를 사용하여 일관성 유지
    const hourScrollY = calculateScrollPosition(hourIndex, itemHeight, containerHeight, paddingTop);
    const minuteScrollY = calculateScrollPosition(minuteIndex >= 0 ? minuteIndex : 0, itemHeight, containerHeight, paddingTop);
    
    // 약간의 지연 후 스크롤 (레이아웃 완료 대기)
    setTimeout(() => {
      hourScrollRef.current?.scrollTo({
        y: Math.max(0, hourScrollY),
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: Math.max(0, minuteScrollY),
        animated: false,
      });
    }, 150);
  }, [selectedHour, selectedMinute, compact, itemHeight, containerHeight, paddingTop]);

  // 스크롤 위치에서 가운데 항목 인덱스 계산
  const calculateCenterIndex = (scrollY: number, itemHeight: number, containerHeight: number, paddingTop: number): number => {
    // 뷰포트의 중심 위치
    const viewportCenter = containerHeight / 2;
    
    // 스크롤된 위치에서 뷰포트 중심에 있는 항목의 절대 Y 좌표 (contentContainer 기준)
    const centerPositionInContent = scrollY + viewportCenter;
    
    // paddingTop을 제외한 실제 아이템 영역 기준 위치
    const centerPositionInItems = centerPositionInContent - paddingTop;
    
    // 아이템 인덱스 계산
    // 각 아이템의 중심 위치는: paddingTop + (index * itemHeight) + (itemHeight / 2)
    // 따라서 centerPositionInItems = (index * itemHeight) + (itemHeight / 2)일 때
    // index = (centerPositionInItems - itemHeight / 2) / itemHeight
    const index = Math.round((centerPositionInItems - itemHeight / 2) / itemHeight);
    
    return Math.max(0, index);
  };

  // 인덱스에서 스크롤 위치 계산
  const calculateScrollPosition = (index: number, itemHeight: number, containerHeight: number, paddingTop: number): number => {
    // 목표: index 항목의 중심이 뷰포트 중심에 오도록 스크롤
    
    // 1. index 항목의 중심 Y 좌표 (contentContainer 기준)
    const itemCenterY = paddingTop + (index * itemHeight) + (itemHeight / 2);
    
    // 2. 뷰포트의 중심
    const viewportCenter = containerHeight / 2;
    
    // 3. 항목 중심을 뷰포트 중심에 맞추기 위한 스크롤 위치
    return itemCenterY - viewportCenter;
  };

  // 시간 스크롤 중 처리 (가운데 항목 업데이트)
  const handleHourScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const centerIndex = calculateCenterIndex(scrollY, itemHeight, containerHeight, paddingTop);
    const clampedIndex = Math.min(Math.max(centerIndex, 0), HOURS.length - 1);
    const newHour = HOURS[clampedIndex];
    setCenterHour(newHour);
  };

  // 시간 스크롤 종료 처리
  const handleHourScrollEnd = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const centerIndex = calculateCenterIndex(scrollY, itemHeight, containerHeight, paddingTop);
    const clampedIndex = Math.min(Math.max(centerIndex, 0), HOURS.length - 1);
    const newHour = HOURS[clampedIndex];
    
    // snapToInterval이 이미 스냅 처리를 하므로, scrollTo 호출 제거
    // 선택된 값만 업데이트
    setSelectedHour(newHour);
    setCenterHour(newHour);
    onChange(`${newHour}:${selectedMinute}`);
  };

  // 분 스크롤 중 처리 (가운데 항목 업데이트)
  const handleMinuteScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const centerIndex = calculateCenterIndex(scrollY, itemHeight, containerHeight, paddingTop);
    const clampedIndex = Math.min(Math.max(centerIndex, 0), MINUTES.length - 1);
    const newMinute = MINUTES[clampedIndex];
    setCenterMinute(newMinute);
  };

  // 분 스크롤 종료 처리
  const handleMinuteScrollEnd = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const centerIndex = calculateCenterIndex(scrollY, itemHeight, containerHeight, paddingTop);
    const clampedIndex = Math.min(Math.max(centerIndex, 0), MINUTES.length - 1);
    const newMinute = MINUTES[clampedIndex];
    
    // snapToInterval이 이미 스냅 처리를 하므로, scrollTo 호출 제거
    // 선택된 값만 업데이트
    setSelectedMinute(newMinute);
    setCenterMinute(newMinute);
    onChange(`${selectedHour}:${newMinute}`);
  };


  return (
    <View style={styles.container}>
      {/* 선택된 시간 표시 (컴팩트 모드에서는 제거) */}
      {!compact && (
        <View style={styles.timeDisplay}>
          <Text style={styles.timeDisplayText}>
            {selectedHour}:{selectedMinute}
          </Text>
        </View>
      )}

      {/* 시간 선택기 */}
      <View style={[styles.pickerContainer, compact && styles.pickerContainerCompact]}>
        {/* 시간 선택 */}
        <View style={styles.pickerColumn}>
          {/* 고정된 선택 박스 (배경 역할) */}
          <View style={[styles.selectedBox, compact && styles.selectedBoxCompact]} />
          
          <ScrollView
            ref={hourScrollRef}
            style={[styles.scrollView, compact && { height: containerHeight }]}
            contentContainerStyle={[styles.scrollViewContent, compact && { paddingTop, paddingBottom: paddingTop }]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            onScroll={handleHourScroll}
            onMomentumScrollEnd={handleHourScrollEnd}
            snapToInterval={itemHeight}
            decelerationRate="fast"
            scrollEventThrottle={16}
          >
            {HOURS.map((hour, index) => (
              <View
                key={hour}
                style={[styles.timeItem, compact && { height: itemHeight }]}
              >
                <Text
                  style={[
                    styles.timeItemText,
                    compact && styles.timeItemTextCompact,
                    centerHour === hour && (compact ? styles.timeItemTextSelectedCompact : styles.timeItemTextSelected),
                  ]}
                >
                  {hour}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <Text style={[styles.separator, compact && styles.separatorCompact]}>:</Text>

        {/* 분 선택 */}
        <View style={styles.pickerColumn}>
          {/* 고정된 선택 박스 (배경 역할) */}
          <View style={[styles.selectedBox, compact && styles.selectedBoxCompact]} />
          
          <ScrollView
            ref={minuteScrollRef}
            style={[styles.scrollView, compact && { height: containerHeight }]}
            contentContainerStyle={[styles.scrollViewContent, compact && { paddingTop, paddingBottom: paddingTop }]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            onScroll={handleMinuteScroll}
            onMomentumScrollEnd={handleMinuteScrollEnd}
            onScrollEndDrag={handleMinuteScrollEnd}
            snapToInterval={itemHeight}
            decelerationRate="fast"
            scrollEventThrottle={16}
          >
            {MINUTES.map((minute, index) => (
              <View
                key={minute}
                style={[styles.timeItem, compact && { height: itemHeight }]}
              >
                <Text
                  style={[
                    styles.timeItemText,
                    compact && styles.timeItemTextCompact,
                    centerMinute === minute && (compact ? styles.timeItemTextSelectedCompact : styles.timeItemTextSelected),
                  ]}
                >
                  {minute}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  timeDisplay: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: Colors.primaryPale,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeDisplayText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: CONTAINER_HEIGHT,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  scrollView: {
    width: '100%',
    height: CONTAINER_HEIGHT,
    backgroundColor: 'transparent', // 투명 배경
  },
  // 고정된 선택 박스 (가운데 위치, 배경 역할)
  selectedBox: {
    position: 'absolute',
    top: PADDING_TOP - 1, // 약간 올려서 정렬
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    zIndex: 0, // 배경 레이어
    pointerEvents: 'none',
  },
  scrollViewContent: {
    paddingTop: PADDING_TOP,
    paddingBottom: PADDING_TOP,
  },
  timeItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  timeItemText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
  },
  timeItemTextSelected: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  separator: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.primary,
    marginHorizontal: 16,
    marginTop: -4, 
    lineHeight: ITEM_HEIGHT, // 정확한 수직 정렬을 위해
  },
  // 컴팩트 모드 스타일
  pickerContainerCompact: {
    height: COMPACT_CONTAINER_HEIGHT,
  },
  selectedBoxCompact: {
    top: COMPACT_PADDING_TOP - 1,
    height: COMPACT_ITEM_HEIGHT,
    backgroundColor: '#E6F7F4', // 더 부드러운 색상
    borderRadius: 6,
  },
  timeItemTextCompact: {
    fontSize: 15,
    fontWeight: '500',
  },
  timeItemTextSelectedCompact: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  separatorCompact: {
    fontSize: 24,
    marginHorizontal: 12,
    lineHeight: COMPACT_ITEM_HEIGHT,
  },
});

