/**
 * 보호자용 AI 통화 설정 화면
 * 어르신의 자동 통화 스케줄 설정
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Animated,
  Switch,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getElderlyCallSchedule, updateElderlyCallSchedule, CallSchedule } from '../api/call';
import { getConnectedElderly } from '../api/connections';
import { useAuthStore } from '../store/authStore';
import { BottomNavigationBar, TimePicker, Header } from '../components';
import { useAlert } from '../components/GlobalAlertProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ElderlyUser {
  user_id: string;
  name: string;
  email: string;
  phone_number?: string;
}

export const GuardianAICallScreen = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { show } = useAlert();
  
  // 상태 관리
  const [connectedElderly, setConnectedElderly] = useState<ElderlyUser[]>([]);
  const [selectedElderlyId, setSelectedElderlyId] = useState<string | null>(null);
  const [isLoadingElderly, setIsLoadingElderly] = useState(false);
  
  // 자동 통화 스케줄 설정
  const [autoCallEnabled, setAutoCallEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('14:00');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [originalTime, setOriginalTime] = useState('14:00');
  
  // 애니메이션 관련
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const [timePickerContainerHeight, setTimePickerContainerHeight] = useState(0);
  
  /**
   * 연결된 어르신 목록 불러오기
   */
  const loadConnectedElderly = useCallback(async () => {
    setIsLoadingElderly(true);
    try {
      const elderly = await getConnectedElderly();
      setConnectedElderly(elderly);
      
      // 첫 번째 어르신이 있으면 자동 선택
      if (elderly.length > 0 && !selectedElderlyId) {
        setSelectedElderlyId(elderly[0].user_id);
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('연결된 어르신 목록 로드 실패:', error);
      }
      show('오류', '연결된 어르신 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingElderly(false);
    }
  }, [selectedElderlyId]);
  
  /**
   * 초기 설정 로드
   */
  useEffect(() => {
    loadConnectedElderly();
  }, [loadConnectedElderly]);
  
  /**
   * 어르신 선택 시 스케줄 로드
   */
  const loadCallSchedule = useCallback(async (elderlyId: string) => {
    if (!elderlyId) return;
    
    try {
      const schedule = await getElderlyCallSchedule(elderlyId);
      setAutoCallEnabled(schedule.is_active);
      
      let timeString: string | null = null;
      if (schedule.call_time) {
        if (typeof schedule.call_time === 'string') {
          timeString = schedule.call_time;
        } else if (typeof schedule.call_time === 'object') {
          timeString = String(schedule.call_time).substring(0, 5);
        }
      }
      
      if (timeString) {
        setScheduledTime(timeString);
      } else {
        setScheduledTime('14:00');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('자동 통화 스케줄 로드 실패:', error);
      }
      // 에러 시 기본값 설정
      setAutoCallEnabled(false);
      setScheduledTime('14:00');
    }
  }, []);
  
  /**
   * 선택된 어르신 변경 시 스케줄 로드
   */
  useEffect(() => {
    if (selectedElderlyId) {
      loadCallSchedule(selectedElderlyId);
    }
  }, [selectedElderlyId, loadCallSchedule]);
  
  /**
   * 애니메이션 초기화 (높이 측정 후)
   */
  useEffect(() => {
    if (timePickerContainerHeight === 0) return;
    
    if (autoCallEnabled) {
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [autoCallEnabled, timePickerContainerHeight, animatedHeight]);
  
  /**
   * 초기 높이 측정 후 애니메이션 값 설정
   */
  useEffect(() => {
    if (timePickerContainerHeight > 0 && autoCallEnabled) {
      animatedHeight.setValue(1);
    }
  }, [timePickerContainerHeight, autoCallEnabled, animatedHeight]);
  
  /**
   * 자동 통화 스케줄 설정 업데이트
   */
  const updateSchedule = useCallback(async (enabled: boolean, time: string) => {
    if (!selectedElderlyId) {
      show('알림', '어르신을 선택해주세요.');
      return;
    }
    
    try {
      setScheduleLoading(true);
      
      const schedule: CallSchedule = {
        is_active: enabled,
        call_time: enabled ? time : null,
      };
      
      await updateElderlyCallSchedule(selectedElderlyId, schedule);
      
      // 성공 메시지
      if (enabled) {
        show('설정 완료', '자동 통화 스케줄이 설정되었습니다.\n어르신에게 알림이 전송됩니다.');
      } else {
        show('설정 완료', '자동 통화가 비활성화되었습니다.\n어르신에게 알림이 전송됩니다.');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('자동 통화 스케줄 업데이트 실패:', error);
      }
      show('오류', error.response?.data?.detail || '설정 저장에 실패했습니다.');
      await loadCallSchedule(selectedElderlyId);
    } finally {
      setScheduleLoading(false);
    }
  }, [selectedElderlyId, loadCallSchedule, show]);
  
  /**
   * 자동 통화 토글 변경
   */
  const handleToggleAutoCall = useCallback(async (value: boolean) => {
    setAutoCallEnabled(value);
    await updateSchedule(value, scheduledTime);
  }, [scheduledTime, updateSchedule]);
  
  /**
   * 시간 변경
   */
  const handleTimeChange = useCallback(async (newTime: string) => {
    setScheduledTime(newTime);
    if (autoCallEnabled && selectedElderlyId) {
      await updateSchedule(true, newTime);
    }
  }, [autoCallEnabled, selectedElderlyId, updateSchedule]);
  
  /**
   * 시간 수정 시작
   */
  const startEditingTime = useCallback(() => {
    setOriginalTime(scheduledTime);
    setIsEditingTime(true);
  }, [scheduledTime]);

  /**
   * TimePicker에서 시간 변경 핸들러
   */
  const handleTimePickerChange = useCallback((time: string) => {
    setScheduledTime(time);
  }, []);
  
  /**
   * 시간 수정 저장
   */
  const saveTimeChange = useCallback(async () => {
    setIsEditingTime(false);
    await handleTimeChange(scheduledTime);
  }, [scheduledTime, handleTimeChange]);
  
  /**
   * 시간 수정 취소
   */
  const cancelTimeEdit = useCallback(() => {
    setScheduledTime(originalTime);
    setIsEditingTime(false);
  }, [originalTime]);
  
  /**
   * 선택된 어르신 정보
   */
  const selectedElderly = connectedElderly.find(e => e.user_id === selectedElderlyId);
  
  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Header 
        title="AI 통화 설정"
        showMenuButton={true}
      />
      
      {/* 메인 컨텐츠 - ScrollView로 변경 */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* 상태 아이콘 */}
          <View style={styles.iconContainer}>
            <Image 
              source={require('../../assets/haru-character.png')}
              style={styles.haruImage}
              resizeMode="contain"
            />
          </View>
          
          {/* 설명 */}
          <Text style={styles.description}>
            설정한 시간에 하루가 어르신께{'\n'} 자동으로 안부전화를 드립니다.
          </Text>
          
          {/* 어르신 선택 */}
          {isLoadingElderly ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#34B79F" />
              <Text style={styles.loadingText}>어르신 목록을 불러오는 중...</Text>
            </View>
          ) : connectedElderly.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>연결된 어르신이 없습니다.</Text>
              <Text style={styles.emptySubText}>
                홈 화면에서 어르신을 추가해주세요.
              </Text>
            </View>
          ) : (
            <>
              {/* 어르신 선택 드롭다운 */}
              <View style={styles.elderlySelectorContainer}>
                <Text style={styles.elderlySelectorLabel}>어르신 선택</Text>
                <View style={styles.elderlySelector}>
                  {connectedElderly.map((elderly) => (
                    <TouchableOpacity
                      key={elderly.user_id}
                      style={[
                        styles.elderlyOption,
                        selectedElderlyId === elderly.user_id && styles.elderlyOptionSelected
                      ]}
                      onPress={() => setSelectedElderlyId(elderly.user_id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.elderlyOptionContent}>
                        <Ionicons 
                          name="person-circle" 
                          size={24} 
                          color={selectedElderlyId === elderly.user_id ? "#FFFFFF" : "#666666"} 
                        />
                        <Text style={[
                          styles.elderlyOptionText,
                          selectedElderlyId === elderly.user_id && styles.elderlyOptionTextSelected
                        ]}>
                          {elderly.name}
                        </Text>
                      </View>
                      {selectedElderlyId === elderly.user_id && (
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* 선택된 어르신 정보 */}
              {selectedElderly && (
                <View style={styles.elderlyInfoCard}>
                  <View style={styles.elderlyInfoHeader}>
                    <Ionicons name="person" size={20} color="#34B79F" />
                    <Text style={styles.elderlyInfoTitle}>{selectedElderly.name}님의 설정</Text>
                  </View>
                  {selectedElderly.phone_number && (
                    <Text style={styles.elderlyInfoText}>
                      전화번호: {selectedElderly.phone_number}
                    </Text>
                  )}
                </View>
              )}
              
              {/* 자동 통화 스케줄 설정 */}
              {selectedElderlyId && (
                <View style={styles.scheduleSection}>
                  <View style={styles.scheduleSectionHeader}>
                    <View style={styles.scheduleTitleContainer}>
                      <Ionicons name="alarm" size={20} color="#333333" style={{ marginRight: 8 }} />
                      <Text style={styles.scheduleSectionTitle}>자동 전화 예약</Text>
                    </View>
                    <View style={styles.switchContainer}>
                      {scheduleLoading && (
                        <ActivityIndicator size="small" color="#34B79F" style={{ marginRight: 8 }} />
                      )}
                      <Switch
                        value={autoCallEnabled}
                        onValueChange={handleToggleAutoCall}
                        trackColor={{ false: '#E0E0E0', true: '#34B79F' }}
                        thumbColor={autoCallEnabled ? '#FFFFFF' : '#F4F4F4'}
                        disabled={scheduleLoading}
                      />
                    </View>
                  </View>
                  
                  <Text style={styles.scheduleDescription}>
                    매일 설정한 시간에 하루가 전화를 걸어드립니다.
                  </Text>
                  
                  <Animated.View
                    style={{
                      height: timePickerContainerHeight > 0
                        ? animatedHeight.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, timePickerContainerHeight],
                          })
                        : 0,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={styles.timePickerContainer}
                      onLayout={(event) => {
                        const { height } = event.nativeEvent.layout;
                        const measuredHeight = height + 20;
                        if (measuredHeight > 0 && (timePickerContainerHeight === 0 || Math.abs(timePickerContainerHeight - measuredHeight) > 10)) {
                          setTimePickerContainerHeight(measuredHeight);
                        }
                      }}
                    >
                      <View style={styles.timeLabelContainer}>
                        <Ionicons name="time" size={20} color="#666666" style={{ marginRight: 8 }} />
                        <Text style={styles.timeLabel}>전화 시간</Text>
                      </View>
                      
                      {isEditingTime ? (
                        <View style={styles.timeEditContainer}>
                          {/* 시간 선택기 */}
                          <TimePicker
                            value={scheduledTime}
                            onChange={handleTimePickerChange}
                          />
                          
                          {/* 버튼 */}
                          <View style={styles.timeEditButtons}>
                            <TouchableOpacity
                              style={[styles.timeEditButton, styles.cancelButton]}
                              onPress={cancelTimeEdit}
                            >
                              <Text style={styles.cancelButtonText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.timeEditButton, styles.saveButton]}
                              onPress={saveTimeChange}
                            >
                              <Text style={styles.saveButtonText}>저장</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.timeDisplayContainer}>
                          <View style={styles.timeDisplayBox}>
                            <Ionicons name="time-outline" size={24} color="#34B79F" style={{ marginRight: 12 }} />
                            <Text style={styles.timeDisplayText}>{scheduledTime}</Text>
                          </View>
                          
                          <TouchableOpacity
                            style={styles.changeTimeButton}
                            onPress={startEditingTime}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="create-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.changeTimeButtonText}>시간 변경</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      
      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: Math.max(16, SCREEN_WIDTH * 0.06),
    paddingTop: 16,
    paddingBottom: 24,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  iconContainer: {
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Math.max(16, SCREEN_WIDTH * 0.04),
  },
  haruImage: {
    width: Math.min(120, SCREEN_WIDTH * 0.3),
    height: Math.min(120, SCREEN_WIDTH * 0.3),
  },
  description: {
    fontSize: Math.max(14, SCREEN_WIDTH * 0.04),
    color: '#666666',
    textAlign: 'center',
    lineHeight: Math.max(20, SCREEN_WIDTH * 0.05),
    marginBottom: Math.max(24, SCREEN_WIDTH * 0.06),
    paddingHorizontal: 8,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999999',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
    textAlign: 'center',
  },
  elderlySelectorContainer: {
    width: '100%',
    marginBottom: Math.max(20, SCREEN_WIDTH * 0.05),
  },
  elderlySelectorLabel: {
    fontSize: Math.max(15, SCREEN_WIDTH * 0.04),
    fontWeight: '600',
    color: '#333333',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  elderlySelector: {
    width: '100%',
  },
  elderlyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Math.max(14, SCREEN_WIDTH * 0.035),
    paddingHorizontal: Math.max(14, SCREEN_WIDTH * 0.035),
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    minHeight: 56,
  },
  elderlyOptionSelected: {
    backgroundColor: '#34B79F',
    borderColor: '#34B79F',
  },
  elderlyOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  elderlyOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginLeft: 12,
  },
  elderlyOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  elderlyInfoCard: {
    width: '100%',
    backgroundColor: '#F0F9F7',
    borderRadius: 12,
    padding: Math.max(14, SCREEN_WIDTH * 0.035),
    marginBottom: Math.max(20, SCREEN_WIDTH * 0.05),
    borderWidth: 1,
    borderColor: '#E0F0ED',
  },
  elderlyInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  elderlyInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34B79F',
    marginLeft: 8,
  },
  elderlyInfoText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  scheduleSection: {
    backgroundColor: '#F8F9FA',
    width: '100%',
    marginTop: Math.max(20, SCREEN_WIDTH * 0.05),
    marginBottom: Math.max(20, SCREEN_WIDTH * 0.05),
    padding: Math.max(16, SCREEN_WIDTH * 0.04),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  scheduleSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduleTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleSectionTitle: {
    fontSize: Math.max(16, SCREEN_WIDTH * 0.045),
    fontWeight: '600',
    color: '#333333',
  },
  scheduleDescription: {
    fontSize: Math.max(13, SCREEN_WIDTH * 0.037),
    color: '#666666',
    lineHeight: Math.max(18, SCREEN_WIDTH * 0.05),
    marginBottom: Math.max(14, SCREEN_WIDTH * 0.035),
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePickerContainer: {
    marginTop: 16,
  },
  timeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  timeDisplayContainer: {
    width: '100%',
    paddingBottom: 8,
  },
  timeDisplayBox: {
    backgroundColor: '#F0F9F7',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0F0ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  timeDisplayText: {
    fontSize: Math.max(28, SCREEN_WIDTH * 0.08),
    fontWeight: '700',
    color: '#34B79F',
    letterSpacing: 2,
  },
  changeTimeButton: {
    backgroundColor: '#34B79F',
    paddingVertical: Math.max(12, SCREEN_WIDTH * 0.03),
    paddingHorizontal: Math.max(20, SCREEN_WIDTH * 0.05),
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 48,
  },
  changeTimeButtonText: {
    fontSize: Math.max(14, SCREEN_WIDTH * 0.04),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeEditContainer: {
    backgroundColor: '#FFFFFF',
    padding: Math.max(16, SCREEN_WIDTH * 0.04),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#34B79F',
  },
  timeEditButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  timeEditButton: {
    flex: 1,
    height: Math.max(46, SCREEN_WIDTH * 0.115),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  saveButton: {
    backgroundColor: '#34B79F',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
