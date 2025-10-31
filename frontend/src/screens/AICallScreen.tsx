/**
 * AI 통화 화면
 * REST API를 통한 전화 발신 + 자동 통화 스케줄 설정
 */
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { makeRealtimeAICall, getCallSchedule, updateCallSchedule, CallSchedule, getCallStatus } from '../api/call';
import { useAuthStore } from '../store/authStore';
import { BottomNavigationBar, TimePicker } from '../components';

// 통화 상태 타입
type CallStatus = 'idle' | 'calling' | 'in_progress' | 'completed' | 'error';


export const AICallScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  // 상태 관리
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [callSid, setCallSid] = useState<string>('');
  
  // 자동 통화 스케줄 설정
  const [autoCallEnabled, setAutoCallEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('14:00');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  
  /**
   * 초기 설정 로드
   */
  useEffect(() => {
    loadCallSchedule();
  }, []);
  
  /**
   * 통화 상태 폴링 (통화 완료 감지)
   */
  useEffect(() => {
    if (callStatus === 'in_progress' && callSid) {
      let checkCount = 0;
      const maxChecks = 60; // 최대 5분 (5초 * 60)
      
      // 5초마다 통화 상태 확인
      const intervalId = setInterval(async () => {
        try {
          checkCount++;
          
          // 최대 체크 횟수 초과 시 중단
          if (checkCount > maxChecks) {
            clearInterval(intervalId);
            console.warn('통화 상태 폴링 타임아웃');
            return;
          }
          
          // 백엔드에서 통화 상태 확인
          const statusData = await getCallStatus(callSid);
          console.log(`통화 상태 확인 (${checkCount}회):`, statusData);
          console.log(`call_status 값: "${statusData.call_status}" (타입: ${typeof statusData.call_status})`);
          
          // 통화가 완료되었으면 바로 다이어리 작성 페이지로 이동
          // 소문자와 대문자 모두 체크
          const status = String(statusData.call_status).toLowerCase();
          console.log(`변환된 status: "${status}"`);
          
          if (status === 'completed') {
            clearInterval(intervalId);
            console.log('✅ 통화 완료 감지 - 다이어리 작성 페이지로 이동');
            
            // 다이어리 작성 페이지로 바로 이동
            router.push({
              pathname: '/diary-write',
              params: {
                fromCall: 'true',
                callSid: callSid,
              },
            });
          }
          
        } catch (error) {
          console.error('통화 상태 확인 실패:', error);
          // 에러가 발생해도 계속 시도
        }
      }, 5000); // 5초마다 체크
      
      return () => clearInterval(intervalId);
    }
  }, [callStatus, callSid, router]);
  /**
   * 자동 통화 스케줄 설정 로드
   */
  const loadCallSchedule = async () => {
    try {
      const schedule = await getCallSchedule();
      setAutoCallEnabled(schedule.is_active);
      
      // call_time이 문자열 또는 객체일 수 있으므로 처리
      let timeString: string | null = null;
      if (schedule.call_time) {
        if (typeof schedule.call_time === 'string') {
          timeString = schedule.call_time;
        } else if (typeof schedule.call_time === 'object') {
          // Time 객체인 경우 (예: "14:30:00" 형식일 수 있음)
          timeString = String(schedule.call_time).substring(0, 5); // HH:MM만 추출
        }
      }
      
      if (timeString) {
        setScheduledTime(timeString);
      }
    } catch (error: any) {
      console.error('자동 통화 스케줄 로드 실패:', error);
      // 로드 실패는 조용히 무시
    }
  };
  
  /**
   * 자동 통화 스케줄 설정 업데이트
   */
  const updateSchedule = async (enabled: boolean, time: string) => {
    try {
      setScheduleLoading(true);
      
      const schedule: CallSchedule = {
        is_active: enabled,
        call_time: enabled ? time : null,
      };
      
      await updateCallSchedule(schedule);
    } catch (error: any) {
      console.error('자동 통화 스케줄 업데이트 실패:', error);
      Alert.alert(
        '오류',
        error.response?.data?.detail || '설정 저장에 실패했습니다.',
        [{ text: '확인' }]
      );
      await loadCallSchedule();
    } finally {
      setScheduleLoading(false);
    }
  };
  
  /**
   * 자동 통화 토글 변경
   */
  const handleToggleAutoCall = async (value: boolean) => {
    setAutoCallEnabled(value);
    await updateSchedule(value, scheduledTime);
  };
  
  /**
   * 시간 변경
   */
  const handleTimeChange = async (newTime: string) => {
    setScheduledTime(newTime);
    if (autoCallEnabled) {
      await updateSchedule(true, newTime);
    }
  };
  
  /**
   * 시간 수정 시작
   */
  const startEditingTime = () => {
    setIsEditingTime(true);
  };

  /**
   * TimePicker에서 시간 변경 핸들러
   */
  const handleTimePickerChange = (time: string) => {
    setScheduledTime(time);
  };
  
  /**
   * 시간 수정 저장
   */
  const saveTimeChange = async () => {
    setIsEditingTime(false);
    await handleTimeChange(scheduledTime);
  };
  
  /**
   * 시간 수정 취소
   */
  const cancelTimeEdit = () => {
    setIsEditingTime(false);
  };
  
  /**
   * AI 통화 시작
   */
  const startAICall = async () => {
    // 전화번호 검증
    if (!phoneNumber || phoneNumber.trim() === '') {
      Alert.alert('알림', '전화번호를 입력해주세요.');
      return;
    }
    
    // 한국 전화번호 형식으로 변환 (+82로 시작)
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
      // 백엔드 API 호출 (실시간 AI 대화)
      const userId = user?.user_id?.toString() || 'anonymous';
      const response = await makeRealtimeAICall(formattedNumber, userId);
  
      setCallSid(response.call_sid);
      
      // ✅ 통화 진행중 상태로 변경
      setCallStatus('in_progress');
      
      // ✅ 통화 진행중 화면으로 자동 전환 (Alert 제거)
      
    } catch (error: any) {
      console.error('❌ 전화 발신 실패:', error);
      setCallStatus('error');
      setErrorMessage(
        error.response?.data?.detail ||
        error.message ||
        '전화 연결에 실패했습니다. 다시 시도해주세요.'
      );
      
      Alert.alert(
        '오류',
        `전화 연결에 실패했습니다.\n\n${errorMessage}`,
        [{ text: '확인' }]
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 상태에 따른 메시지 표시
   */
  const getStatusMessage = () => {
    switch (callStatus) {
      case 'idle':
        return 'AI 비서와 통화하기';
      case 'calling':
        return '전화 연결 중...';
      case 'in_progress':
        return '전화가 걸려갑니다!\n전화를 받아주세요';
      case 'completed':
        return '통화가 완료되었습니다';
      case 'error':
        return '오류 발생';
      default:
        return '';
    }
  };
  
  /**
   * 상태에 따른 아이콘 정보 반환
   */
  const getStatusIconInfo = (): { name: string; family: 'Ionicons' | 'MaterialCommunityIcons'; color: string } => {
    switch (callStatus) {
      case 'calling':
        return { name: 'call', family: 'Ionicons', color: '#34B79F' };
      case 'in_progress':
        return { name: 'mic', family: 'Ionicons', color: '#FF6B6B' };
      case 'completed':
        return { name: 'checkmark-circle', family: 'Ionicons', color: '#4CAF50' };
      case 'error':
        return { name: 'close-circle', family: 'Ionicons', color: '#F44336' };
      default:
        return { name: 'robot', family: 'MaterialCommunityIcons', color: '#34B79F' };
    }
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>AI 통화</Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* 메인 컨텐츠 - ScrollView로 변경 */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        {/* 상태 아이콘 */}
        <View style={styles.iconContainer}>
          {getStatusIconInfo().family === 'MaterialCommunityIcons' ? (
            <MaterialCommunityIcons 
              name={getStatusIconInfo().name as any} 
              size={64} 
              color={getStatusIconInfo().color} 
            />
          ) : (
            <Ionicons 
              name={getStatusIconInfo().name as any} 
              size={64} 
              color={getStatusIconInfo().color} 
            />
          )}
        </View>
        
        {/* 상태 메시지 */}
        <Text style={styles.statusMessage}>{getStatusMessage()}</Text>
        
         {callStatus === 'idle' && (
           <Text style={styles.description}>
             버튼을 누르면 AI 비서가 전화를 걸어드립니다.{'\n'}
             전화를 받으시면 실시간으로 AI와 자유롭게 대화하실 수 있습니다.
           </Text>
         )}
        
        {callStatus === 'in_progress' && (
          <View style={styles.inProgressContainer}>
            <Text style={styles.description}>
              지금 그랜비와 대화 중입니다.{'\n'}
              통화가 끝나면 자동으로 다이어리 작성 화면으로 이동합니다.
            </Text>
            <ActivityIndicator size="large" color="#34B79F" style={{ marginTop: 20 }} />
          </View>
        )}
        
        {/* 에러 메시지 */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        
        {/* 전화번호 입력 */}
        {callStatus === 'idle' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>전화번호</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="010-1234-5678"
              keyboardType="phone-pad"
              editable={!isLoading}
            />
            <Text style={styles.inputHint}>
              ※ 등록된 전화번호로 자동 입력됩니다
            </Text>
          </View>
        )}
        
        {/* Call SID 표시 (디버깅용) */}
        {callSid && __DEV__ && (
          <Text style={styles.debugText}>Call SID: {callSid}</Text>
        )}
        
        {/* 통화 버튼 */}
        {callStatus === 'idle' && (
          <TouchableOpacity
            style={[
              styles.callButton,
              isLoading && styles.callButtonDisabled,
            ]}
            onPress={startAICall}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <>
                <Ionicons name="call" size={28} color="#FFFFFF" style={{ marginRight: 12 }} />
                <Text style={styles.callButtonText}>AI 비서 호출하기</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {/* 재시도 버튼 */}
        {callStatus === 'error' && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setCallStatus('idle');
              setErrorMessage('');
              setCallSid('');
            }}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
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
      </View>
      
      {/* 자동 통화 스케줄 설정 */}
      {callStatus === 'idle' && (
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleSectionHeader}>
            <View style={styles.scheduleTitleContainer}>
              <Ionicons name="alarm" size={20} color="#333333" style={{ marginRight: 8 }} />
              <Text style={styles.scheduleSectionTitle}>자동 통화 예약</Text>
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
          
          {autoCallEnabled && (
            <View style={styles.timePickerContainer}>
              <Text style={styles.timeLabel}>통화 시간</Text>
              
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
                <TouchableOpacity
                  style={styles.timePicker}
                  onPress={startEditingTime}
                >
                  <View style={styles.timePickerContent}>
                    <Ionicons name="time" size={24} color="#34B79F" style={{ marginRight: 8 }} />
                    <Text style={styles.timePickerText}>{scheduledTime}</Text>
                  </View>
                  <Text style={styles.timePickerHint}>매일 이 시간에 전화가 걸립니다</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
      
         {/* 하단 안내 */}
         {callStatus === 'idle' && (
           <View style={[
             styles.footer,
             { paddingBottom: Math.max(insets.bottom + 16, 24) }  // ← 안드로이드 네비게이션 바 고려
           ]}>
             <View style={styles.footerItem}>
               <MaterialCommunityIcons name="robot" size={18} color="#666666" style={{ marginRight: 8 }} />
               <Text style={styles.footerText}>실시간 AI 대화 기능</Text>
             </View>
             <View style={styles.footerItem}>
               <Ionicons name="bulb" size={18} color="#666666" style={{ marginRight: 8 }} />
               <Text style={styles.footerText}>AI 비서는 한국어로 대화합니다</Text>
             </View>
             <View style={styles.footerItem}>
               <Ionicons name="call" size={18} color="#666666" style={{ marginRight: 8 }} />
               <Text style={styles.footerText}>전화를 받으면 자유롭게 대화하세요!</Text>
             </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F9F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
    backgroundColor: '#CCCCCC',
  },
  callButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  retryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  debugText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 8,
  },
  footer: {
    padding: 24,
    backgroundColor: '#F8F8F8',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
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
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  scheduleSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePickerContainer: {
    marginTop: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  timePicker: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34B79F',
  },
  timePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timePickerText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#34B79F',
  },
  timePickerHint: {
    fontSize: 13,
    color: '#999999',
  },
  timeEditContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34B79F',
  },
  timeEditButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  timeEditButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
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
});
