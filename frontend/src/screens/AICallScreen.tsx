/**
 * AI 통화 화면
 * REST API를 통한 전화 발신 + 자동 통화 스케줄 설정
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { makeRealtimeAICall, getCallSchedule, updateCallSchedule, CallSchedule, getCallStatus } from '../api/call';
import { useAuthStore } from '../store/authStore';
import { BottomNavigationBar, TimePicker, Header } from '../components';

// 통화 상태 타입
type CallStatus = 'idle' | 'calling' | 'in_progress' | 'completed' | 'error';


export const AICallScreen = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  
  // 상태 관리
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const phoneNumber = user?.phone_number || '';
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [callSid, setCallSid] = useState<string>('');
  
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
   * 자동 통화 스케줄 설정 로드
   */
  const loadCallSchedule = useCallback(async () => {
    try {
      const schedule = await getCallSchedule();
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
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('자동 통화 스케줄 로드 실패:', error);
      }
    }
  }, []);
  
  /**
   * 초기 설정 로드
   */
  useEffect(() => {
    loadCallSchedule();
  }, [loadCallSchedule]);
  
  /**
   * 통화 상태 폴링 훅
   */
  const useCallStatusPolling = (callStatus: CallStatus, callSid: string, router: any, setCallStatus: any, setErrorMessage: any) => {
    useEffect(() => {
      if (callStatus !== 'in_progress' || !callSid) return;
      
      let checkCount = 0;
      const maxChecks = 60;
      
      const intervalId = setInterval(async () => {
        try {
          checkCount++;
          
          if (checkCount > maxChecks) {
            clearInterval(intervalId);
            if (__DEV__) {
              console.warn('통화 상태 폴링 타임아웃');
            }
            return;
          }
          
          const statusData = await getCallStatus(callSid);
          const status = String(statusData.call_status).toLowerCase();
          
          // 통화 완료 시 다이어리 작성 화면으로 이동
          if (status === 'completed') {
            clearInterval(intervalId);
            router.push({
              pathname: '/diary-write',
              params: {
                fromCall: 'true',
                callSid: callSid,
              },
            });
          }
          // 통화 실패/거절/부재중 상태 감지 (백엔드: busy, canceled, failed, no-answer → DB: rejected, missed, failed)
          else if (status === 'rejected' || status === 'missed' || status === 'failed') {
            clearInterval(intervalId);
            let errorMessage = '통화 연결에 실패했습니다.';
            
            if (status === 'rejected') {
              errorMessage = '통화가 거절되었습니다.';
            } else if (status === 'missed') {
              errorMessage = '통화를 받지 못했습니다.';
            } else if (status === 'failed') {
              errorMessage = '통화 연결에 실패했습니다.';
            }
            
            setCallStatus('error');
            setErrorMessage(errorMessage);
          }
        } catch (error) {
          if (__DEV__) {
            console.error('통화 상태 확인 실패:', error);
          }
        }
      }, 5000);
      
      return () => clearInterval(intervalId);
    }, [callStatus, callSid, router, setCallStatus, setErrorMessage]);
  };
  
  // 통화 상태 폴링 사용
  useCallStatusPolling(callStatus, callSid, router, setCallStatus, setErrorMessage);
  
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
    try {
      setScheduleLoading(true);
      
      const schedule: CallSchedule = {
        is_active: enabled,
        call_time: enabled ? time : null,
      };
      
      await updateCallSchedule(schedule);
    } catch (error: any) {
      if (__DEV__) {
        console.error('자동 통화 스케줄 업데이트 실패:', error);
      }
      Alert.alert(
        '오류',
        error.response?.data?.detail || '설정 저장에 실패했습니다.',
        [{ text: '확인' }]
      );
      await loadCallSchedule();
    } finally {
      setScheduleLoading(false);
    }
  }, [loadCallSchedule]);
  
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
    if (autoCallEnabled) {
      await updateSchedule(true, newTime);
    }
  }, [autoCallEnabled, updateSchedule]);
  
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
   * 전화번호 포맷팅 (000-0000-0000 형식)
   */
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    
    // 숫자만 추출
    const numbers = phone.replace(/[^\d]/g, '');
    
    // 11자리 번호 (010-1234-5678)
    if (numbers.length === 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
    
    return numbers;
  };
  
  /**
   * AI 통화 시작
   */
  const startAICall = useCallback(async () => {
    if (!phoneNumber || phoneNumber.trim() === '') {
      Alert.alert('알림', '전화번호를 입력해주세요.');
      return;
    }
    
    let formattedNumber = phoneNumber.trim();
    if (formattedNumber.startsWith('010')) {
      formattedNumber = '+82' + formattedNumber.substring(1);
    } else if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+82' + formattedNumber;
    }
    
    try {
      setIsLoading(true);
      setCallStatus('calling');
      setErrorMessage('');
      
      const userId = user?.user_id?.toString() || 'anonymous';
      const response = await makeRealtimeAICall(formattedNumber, userId);
  
      setCallSid(response.call_sid);
      setCallStatus('in_progress');
    } catch (error: any) {
      if (__DEV__) {
        console.error('전화 발신 실패:', error);
      }
      const errorMsg = error.response?.data?.detail ||
        error.message ||
        '전화 연결에 실패했습니다. 다시 시도해주세요.';
      setCallStatus('error');
      setErrorMessage(errorMsg);
      
      Alert.alert('오류', `전화 연결에 실패했습니다.\n\n${errorMsg}`, [{ text: '확인' }]);
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, user]);
  
  /**
   * 상태에 따른 메시지 표시
   */
  const statusMessage = useMemo(() => {
    switch (callStatus) {
      case 'idle':
        return '하루와 대화하기';
      case 'calling':
        return '하루와 연결 중...';
      case 'in_progress':
        return '하루가 전화를 겁니다!\n전화를 받아주세요';
      case 'completed':
        return '하루와의 대화가 끝났습니다';
      case 'error':
        return '오류 발생';
      default:
        return '';
    }
  }, [callStatus]);
  
  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <Header 
        title="하루와 대화"
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
        {callStatus !== 'error' && (
          <View style={styles.iconContainer}>
            <Image 
              source={require('../../assets/haru-character.png')}
              style={styles.haruImage}
              resizeMode="contain"
            />
          </View>
        )}
        
        {/* 통화 실패 화면 */}
        {callStatus === 'error' && (
          <View style={styles.errorScreenContainer}>
            <View style={styles.errorIconContainer}>
              <Image 
                source={require('../../assets/haru_call_failed.png')}
                style={styles.errorImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.errorTitle}>통화 연결 실패</Text>
            <Text style={styles.errorDescription}>
              하루와의 통화 연결에 실패했습니다.{'\n'}
              잠시 후 다시 시도해주세요.
            </Text>
            {errorMessage && (
              <View style={styles.errorMessageContainer}>
                <Text style={styles.errorMessageText}>{errorMessage}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* 상태 메시지 */}
        {callStatus !== 'error' && (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        )}
        
         {callStatus === 'idle' && (
           <Text style={styles.description}>
             버튼을 누르면 하루가 전화를 걸어드립니다.{'\n'}
             전화를 받으면 하루와 자유롭게 대화할 수 있습니다.
           </Text>
         )}
        
        {callStatus === 'in_progress' && (
          <View style={styles.inProgressContainer}>
            <Text style={styles.description}>
              지금 하루와 대화 중입니다.{'\n'}
              대화가 끝나면 자동으로 다이어리 작성 화면으로 이동합니다.
            </Text>
            <ActivityIndicator size="large" color="#34B79F" style={{ marginTop: 20 }} />
          </View>
        )}
        
        {/* 전화번호 입력 */}
        {callStatus === 'idle' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>전화번호</Text>
            <TextInput
              style={[styles.input, styles.inputReadonly]}
              value={formatPhoneNumber(phoneNumber)}
              placeholder="010-1234-5678"
              keyboardType="phone-pad"
              editable={false}
              textAlign="center"
            />
            <Text style={styles.inputHint}>
              ※ 등록된 전화번호로 자동 입력됩니다
            </Text>
          </View>
        )}
        
        
        {/* 통화 실패 화면 버튼 */}
        {callStatus === 'error' && (
          <View style={styles.errorButtonsContainer}>
            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => {
                router.replace('/home');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="home" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.homeButtonText}>메인 화면으로 돌아가기</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* 완료 후 다이어리 작성 버튼 */}
        {callStatus === 'completed' && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => {
              router.push({
                pathname: '/diary-write',
                params: {
                  fromCall: 'true',
                  callSid: callSid,
                },
              });
            }}
          >
            <View style={styles.doneButtonContent}>
              <Ionicons name="create" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.doneButtonText}>다이어리 작성하기</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {/* 통화 버튼 */}
        {callStatus === 'idle' && (
          <>
            <TouchableOpacity
              style={[
                styles.callButton,
                (isLoading || autoCallEnabled) && styles.callButtonDisabled,
              ]}
              onPress={startAICall}
              disabled={isLoading || autoCallEnabled}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <>
                  <Ionicons 
                    name="call" 
                    size={28} 
                    color="#FFFFFF" 
                    style={{ marginRight: 12 }} 
                  />
                  <Text style={styles.callButtonText}>
                    하루와 대화하기
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {autoCallEnabled && (
              <Text style={styles.callButtonHint}>
                자동 전화 예약이 활성화되어 있습니다
              </Text>
            )}
          </>
        )}
      </View>
      
      {/* 자동 통화 스케줄 설정 */}
      {callStatus === 'idle' && (
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    paddingTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  haruImage: {
    width: 120,
    height: 120,
  },
  statusMessage: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 2,
    borderColor: '#34B79F',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#333333',
  },
  inputReadonly: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    color: '#666666',
  },
  inputHint: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
  },
  callButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#34B79F',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  callButtonDisabled: {
    backgroundColor: '#2A9D87',
    opacity: 0.6,
  },
  callButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  callButtonHint: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#34B79F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#34B79F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    width: '100%',
    padding: 16,
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scheduleSection: {
    backgroundColor: '#F8F9FA',
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 24,
    padding: 20,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  scheduleDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
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
    fontSize: 32,
    fontWeight: '700',
    color: '#34B79F',
    letterSpacing: 2,
  },
  changeTimeButton: {
    backgroundColor: '#34B79F',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  changeTimeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeEditContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
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
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  inProgressContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  // 통화 실패 화면 스타일
  errorScreenContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  errorIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorImage: {
    width: 200,
    height: 200,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  errorMessageContainer: {
    width: '100%',
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  errorMessageText: {
    fontSize: 14,
    color: '#F57C00',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorButtonsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  homeButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#34B79F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  homeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
