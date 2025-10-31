/**
 * 수직 스크롤 가능한 시간 선택기 컴포넌트
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface TimePickerProps {
  value: string; // "HH:mm" 형식
  onChange: (time: string) => void; // "HH:mm" 형식으로 반환
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const CONTAINER_HEIGHT = 180;
const ITEM_HEIGHT = 50;
const PADDING_TOP = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
  const [selectedHour, setSelectedHour] = useState('00');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // 초기값 설정 및 value 변경 시 업데이트
  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':');
      setSelectedHour(h || '00');
      setSelectedMinute(m || '00');
    } else {
      // value가 없으면 현재 시간으로 설정
      const now = new Date();
      const hour = now.getHours().toString().padStart(2, '0');
      const minute = now.getMinutes().toString().padStart(2, '0');
      setSelectedHour(hour);
      setSelectedMinute(minute);
      onChange(`${hour}:${minute}`);
    }
  }, [value]);

  // 초기 스크롤 위치 설정
  useEffect(() => {
    const hourIndex = parseInt(selectedHour);
    const minuteIndex = parseInt(selectedMinute);
    
    // ITEM_HEIGHT를 사용하여 일관성 유지
    const hourScrollY = calculateScrollPosition(hourIndex, ITEM_HEIGHT);
    const minuteScrollY = calculateScrollPosition(minuteIndex, ITEM_HEIGHT);
    
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
  }, [selectedHour, selectedMinute]);

  // 스크롤 위치에서 가운데 항목 인덱스 계산
  const calculateCenterIndex = (scrollY: number, itemHeight: number): number => {
    // scrollY는 contentContainer 시작점(paddingTop 포함)부터의 오프셋
    // 뷰포트의 중심은 CONTAINER_HEIGHT / 2
    // 실제 중앙에 있는 항목의 위치 = scrollY + (CONTAINER_HEIGHT / 2)
    
    // paddingTop을 빼면 첫 번째 아이템(index 0)의 top이 0이 됨
    // 여기에 itemHeight로 나누면 인덱스 계산 가능
    const viewportCenter = CONTAINER_HEIGHT / 2;
    const centerPositionInContent = scrollY + viewportCenter;
    const centerPositionInItems = centerPositionInContent - PADDING_TOP;
    
    // 아이템 인덱스 계산 (반올림으로 가장 가까운 아이템 선택)
    const index = Math.round(centerPositionInItems / itemHeight);
    
    return Math.max(0, index);
  };

  // 인덱스에서 스크롤 위치 계산
  const calculateScrollPosition = (index: number, itemHeight: number): number => {
    // 목표: index 항목의 중심이 뷰포트 중심에 오도록 스크롤
    
    // 1. index 항목의 중심 Y 좌표 (contentContainer 기준)
    //    - paddingTop: 상단 패딩
    //    - index * itemHeight: 해당 항목까지의 높이
    //    - itemHeight / 2: 항목 중심까지의 오프셋
    const itemCenterY = PADDING_TOP + (index * itemHeight) + (itemHeight / 2);
    
    // 2. 뷰포트의 중심
    const viewportCenter = CONTAINER_HEIGHT / 2;
    
    // 3. 항목 중심을 뷰포트 중심에 맞추기 위한 스크롤 위치
    //    itemCenterY = scrollY + viewportCenter
    //    따라서, scrollY = itemCenterY - viewportCenter
    return itemCenterY - viewportCenter;
  };

  // 시간 스크롤 종료 처리
  const handleHourScrollEnd = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const centerIndex = calculateCenterIndex(scrollY, ITEM_HEIGHT);
    const clampedIndex = Math.min(Math.max(centerIndex, 0), HOURS.length - 1);
    const newHour = HOURS[clampedIndex];
    
    // snapToInterval이 이미 스냅 처리를 하므로, scrollTo 호출 제거
    // 선택된 값만 업데이트
    setSelectedHour(newHour);
    onChange(`${newHour}:${selectedMinute}`);
  };

  // 분 스크롤 종료 처리
  const handleMinuteScrollEnd = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const centerIndex = calculateCenterIndex(scrollY, ITEM_HEIGHT);
    const clampedIndex = Math.min(Math.max(centerIndex, 0), MINUTES.length - 1);
    const newMinute = MINUTES[clampedIndex];
    
    // snapToInterval이 이미 스냅 처리를 하므로, scrollTo 호출 제거
    // 선택된 값만 업데이트
    setSelectedMinute(newMinute);
    onChange(`${selectedHour}:${newMinute}`);
  };


  return (
    <View style={styles.container}>
      {/* 선택된 시간 표시 */}
      <View style={styles.timeDisplay}>
        <Text style={styles.timeDisplayText}>
          {selectedHour}:{selectedMinute}
        </Text>
      </View>

      {/* 시간 선택기 */}
      <View style={styles.pickerContainer}>
        {/* 시간 선택 */}
        <View style={styles.pickerColumn}>
          <ScrollView
            ref={hourScrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            onMomentumScrollEnd={handleHourScrollEnd}
            // onScrollEndDrag={handleHourScrollEnd}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
          >
            {HOURS.map((hour, index) => (
              <TouchableOpacity
                key={hour}
                style={[
                  styles.timeItem,
                  selectedHour === hour && styles.timeItemSelected,
                ]}
                activeOpacity={1}
              >
                <Text
                  style={[
                    styles.timeItemText,
                    selectedHour === hour && styles.timeItemTextSelected,
                  ]}
                >
                  {hour}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.separator}>:</Text>

        {/* 분 선택 */}
        <View style={styles.pickerColumn}>
          <ScrollView
            ref={minuteScrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            onMomentumScrollEnd={handleMinuteScrollEnd}
            onScrollEndDrag={handleMinuteScrollEnd}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
          >
            {MINUTES.map((minute, index) => (
              <TouchableOpacity
                key={minute}
                style={[
                  styles.timeItem,
                  selectedMinute === minute && styles.timeItemSelected,
                ]}
                activeOpacity={1}
              >
                <Text
                  style={[
                    styles.timeItemText,
                    selectedMinute === minute && styles.timeItemTextSelected,
                  ]}
                >
                  {minute}
                </Text>
              </TouchableOpacity>
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
    paddingVertical: 12,
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
  },
  scrollView: {
    width: '100%',
    height: CONTAINER_HEIGHT,
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
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
  },
  timeItemSelected: {
    backgroundColor: Colors.primary,
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
    marginTop: -24, // 중앙 정렬 보정
  },
});

