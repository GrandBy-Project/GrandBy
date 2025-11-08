/**
 * 어르신 전용 홈 화면
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Animated,
  Linking,
  RefreshControl,
  BackHandler,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { BottomNavigationBar, Header, CheckIcon, PhoneIcon, DiaryIcon, NotificationIcon, PillIcon, SunIcon, ProfileIcon, QuickActionGrid, type QuickAction } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as todoApi from '../api/todo';
import { Colors } from '../constants/Colors';
import * as connectionsApi from '../api/connections';
import { Modal } from 'react-native';
import * as weatherApi from '../api/weather';
import { getDiaries } from '../api/diary';
import { useResponsive, getResponsiveFontSize, getResponsiveSize } from '../hooks/useResponsive';
import { useFontSizeStore } from '../store/fontSizeStore';
import { useWeatherStore } from '../store/weatherStore';
import { elderlyHomeStyles } from './ElderlyHomeScreen.styles';
import { useAlert } from '../components/GlobalAlertProvider';
import { useToast } from '../components/ToastProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatPhoneNumber } from '../utils/validation';
import { TutorialModal } from '../components';
import { API_BASE_URL } from '../api/client';

export const ElderlyHomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { scale } = useResponsive();
  const { width: screenWidth } = useWindowDimensions();
  const guidelineBaseWidth = 375;
  const scalePx = (size: number) => (screenWidth / guidelineBaseWidth) * size;
  const moderateScale = (size: number, factor = 0.5) => size + (scalePx(size) - size) * factor;
  // 전역 폰트 크기 상태 사용 (로컬 state 제거)
  const { fontSizeLevel, toggleFontSize, getFontSizeText } = useFontSizeStore();
  // 날씨 정보 전역 상태 사용
  const { weather, isLoading: isLoadingWeather, setWeather, setLoading: setIsLoadingWeather, isCachedWeatherValid, hasWeather } = useWeatherStore();
  const { show } = useAlert();
  const { showToast } = useToast();
  
  const [todayTodos, setTodayTodos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDayTab, setSelectedDayTab] = useState<'today' | 'tomorrow'>('today'); // 오늘/내일 탭
  const [selectedTodo, setSelectedTodo] = useState<any | null>(null);
  const [showTodoModal, setShowTodoModal] = useState(false);

  // 연결 요청 알림 관련 state
  const [pendingConnections, setPendingConnections] = useState<connectionsApi.ConnectionWithUserInfo[]>([]);
  const [activeConnections, setActiveConnections] = useState<connectionsApi.ConnectionWithUserInfo[]>([]);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<connectionsApi.ConnectionWithUserInfo | null>(null);

  // 자동 전화 통화기록 확인용 state
  const [hasRecentCall, setHasRecentCall] = useState(false);

  // 가장 가까운 일정 state
  const [upcomingTodo, setUpcomingTodo] = useState<any | null>(null);

  // 튜토리얼 관련 state
  const [showTutorial, setShowTutorial] = useState(false);
  const aiCallButtonRef = useRef<View>(null);
  const lastBackPressRef = useRef(0);

  // 연결 애니메이션
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showTodoModal) {
          setShowTodoModal(false);
          return true;
        }

        if (showConnectionModal) {
          setShowConnectionModal(false);
          return true;
        }

        if (showTutorial) {
          setShowTutorial(false);
          return true;
        }

        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          BackHandler.exitApp();
        } else {
          lastBackPressRef.current = now;
          showToast('한 번 더 누르면 앱이 종료됩니다.');
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [showTodoModal, showConnectionModal, showTutorial, showToast])
  );

  // 맥박 애니메이션 시작
  useEffect(() => {
    if (activeConnections.length > 0) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      
      pulseAnimation.start();
      
      return () => {
        pulseAnimation.stop();
      };
    }
  }, [activeConnections.length, pulseAnim]);

  // 프로필 이미지 URL 가져오기
  const getProfileImageUrl = () => {
    if (!user?.profile_image_url) return null;
    // 이미 전체 URL인 경우
    if (user.profile_image_url.startsWith('http')) {
      return user.profile_image_url;
    }
    // 상대 경로인 경우
    return `${API_BASE_URL}/${user.profile_image_url}`;
  };

  // 새로고침 핸들러
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadTodayTodos(),
        loadWeather(), // 캐시 확인 후 필요시만 새로고침
        loadPendingConnections(),
        loadActiveConnections(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const weatherIconSize = fontSizeLevel >= 1 ? 32 : 24;
  const weatherIconUrl = weather?.icon ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png` : null;

  const loadTodayTodos = async () => {
    if (!user) {
      console.warn('⚠️ 어르신: user가 없어서 TODO 로딩 스킵');
      return;
    }
    
    setIsLoading(true);
    try {
      // 선택된 탭에 따라 날짜 필터 결정
      const dateFilter = selectedDayTab === 'today' ? 'today' : 'tomorrow';
      console.log(`📥 어르신: ${selectedDayTab === 'today' ? '오늘' : '내일'} TODO 로딩 시작 - user_id:`, user.user_id);
      
      const todos = await todoApi.getTodos(dateFilter);
      console.log(`✅ 어르신: TODO 로딩 성공 - ${todos.length}개 (${selectedDayTab === 'today' ? '오늘' : '내일'})`);
      console.log('📊 전체 TODO 목록:', todos.map(t => ({
        id: t.todo_id,
        title: t.title,
        date: t.due_date,
        is_recurring: t.is_recurring,
        is_shared: t.is_shared_with_caregiver
      })));
      
      setTodayTodos(todos);

      // 가장 가까운 미완료 일정 찾기
      const now = new Date();
      const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      const normalizeTime = (time: string | null | undefined) =>
        time ? time.substring(0, 5) : null;

      const pendingTodos = todos.filter(
        (todo: any) => todo.status !== 'COMPLETED' && todo.status !== 'completed'
      );

      const upcomingCandidates =
        selectedDayTab === 'today'
          ? pendingTodos.filter((todo: any) => {
              const todoTime = normalizeTime(todo.due_time);
              if (!todoTime) {
                return true;
              }
              return todoTime >= currentTimeString;
            })
          : pendingTodos;

      // 시간 순으로 정렬하여 가장 가까운 일정 선택
      const sortedTodos = [...upcomingCandidates].sort((a: any, b: any) => {
        const aTime = normalizeTime(a.due_time);
        const bTime = normalizeTime(b.due_time);

        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return aTime.localeCompare(bTime);
      });

      setUpcomingTodo(sortedTodos[0] || null);
    } catch (error: any) {
      console.error('❌ 오늘 할 일 불러오기 실패:', error);
      console.error('❌ 에러 상세:', error.response?.data || error.message);
      setTodayTodos([]); // 에러 시 빈 배열로 설정
    } finally {
      setIsLoading(false);
    }
  };

  // 날씨 정보 불러오기 (실제 기기 + Emulator 지원, 캐싱 지원)
  const loadWeather = useCallback(async (forceRefresh: boolean = false) => {
    console.log('🌤️ loadWeather 시작...', forceRefresh ? '(강제 새로고침)' : '(캐시 확인)');
    
    // 강제 새로고침이 아니고, 캐시가 유효하면 API 호출 안 함
    if (!forceRefresh && isCachedWeatherValid()) {
      console.log('✅ 캐시된 날씨 정보 사용 (만료 전)');
      return;
    }
    
    setIsLoadingWeather(true);
    try {
      // GPS 위치 기반 날씨 정보 가져오기
      console.log('🌤️ getLocationBasedWeather 호출 중...');
      const weatherData = await weatherApi.getLocationBasedWeather();
      
      if (weatherData) {
        setWeather(weatherData);
        console.log('✅ 날씨 로딩 성공:', weatherData);
      } else {
        console.log('⚠️ 날씨 정보를 가져올 수 없습니다 (위치 권한 또는 GPS 오류)');
        // 에러 상태에서도 로딩 종료 (권한 없음으로 표시)
        setWeather({ description: '위치 정보를 가져올 수 없습니다', hasPermission: false });
      }
    } catch (error) {
      console.error('❌ 날씨 정보 불러오기 실패:', error);
      // 에러 발생 시에도 UI 업데이트 (권한 없음으로 표시)
      setWeather({ description: '날씨 정보를 불러올 수 없습니다', hasPermission: false });
    } finally {
      console.log('🌤️ loadWeather 완료 (로딩 종료)');
      setIsLoadingWeather(false);
    }
  }, [isCachedWeatherValid, setIsLoadingWeather, setWeather]);

  // 대기 중인 연결 요청 불러오기
  const loadPendingConnections = async () => {
    try {
      const connections = await connectionsApi.getConnections();
      setPendingConnections(connections.pending);
    } catch (error) {
      console.error('연결 요청 불러오기 실패:', error);
    }
  };

  // 연결된 보호자 목록 불러오기
  const loadActiveConnections = async () => {
    try {
      const connections = await connectionsApi.getConnections();
      setActiveConnections(connections.active);
    } catch (error) {
      console.error('연결된 보호자 목록 불러오기 실패:', error);
    }
  };

  // ✅ 최근 통화 기록 확인 함수 (백엔드에서 처리)
  const checkRecentCalls = async () => {
    try {
      // AsyncStorage에서 오늘 배너를 닫았는지 확인
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const dismissedDate = await AsyncStorage.getItem('diaryBannerDismissed');
      
      if (dismissedDate === today) {
        console.log(`📞 다이어리 안내 배너: 오늘 이미 닫았음 - 표시 안함`);
        setHasRecentCall(false);
        return false;
      }
      
      const { checkDiaryReminder } = await import('../api/call');
      const { should_show_banner } = await checkDiaryReminder();
      setHasRecentCall(should_show_banner);
      
      console.log(`📞 다이어리 안내 배너: ${should_show_banner ? '표시' : '숨김'} - 사용자: ${user?.user_id}`);
      return should_show_banner;
    } catch (error) {
      console.error('다이어리 안내 배너 확인 실패:', error);
      setHasRecentCall(false);
      return false;
    }
  };

  // ✅ 배너 닫기 핸들러
  const handleDismissBanner = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      await AsyncStorage.setItem('diaryBannerDismissed', today);
      setHasRecentCall(false);
      console.log(`📞 다이어리 안내 배너 닫음 - 오늘(${today}) 더 이상 표시 안함`);
    } catch (error) {
      console.error('배너 닫기 실패:', error);
    }
  };

  // 연결 요청 수락
  const handleAcceptConnection = async () => {
    if (!selectedConnection) return;

    try {
      await connectionsApi.acceptConnection(selectedConnection.connection_id);
      show(
        '연결 완료',
        `${selectedConnection.name}님과 연결되었습니다!`,
        [
          {
            text: '확인',
            onPress: () => {
              setShowConnectionModal(false);
              setSelectedConnection(null);
              loadPendingConnections(); // 목록 새로고침
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('연결 수락 실패:', error);
      show('오류', error.message || '연결 수락에 실패했습니다.');
    }
  };

  // 연결 요청 거절
  const handleRejectConnection = async () => {
    if (!selectedConnection) return;

    show(
      '연결 거절',
      `${selectedConnection.name}님의 연결 요청을 거절하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '거절',
          style: 'destructive',
          onPress: async () => {
            try {
              await connectionsApi.rejectConnection(selectedConnection.connection_id);
              show(
                '거절 완료',
                '연결 요청을 거절했습니다.',
                [
                  {
                    text: '확인',
                    onPress: () => {
                      setShowConnectionModal(false);
                      setSelectedConnection(null);
                      loadPendingConnections(); // 목록 새로고침
                    }
                  }
                ]
              );
            } catch (error: any) {
              console.error('연결 거절 실패:', error);
              show('오류', error.message || '연결 거절에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  // 카테고리 한글 이름 변환
  const getCategoryName = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'MEDICINE': '복약',
      'medicine': '복약',
      'HOSPITAL': '병원',
      'hospital': '병원',
      'EXERCISE': '운동',
      'exercise': '운동',
      'MEAL': '식사',
      'meal': '식사',
      'OTHER': '기타',
      'other': '기타',
    };
    return categoryMap[category] || '기타';
  };

  // 카테고리 아이콘 매핑 (Ionicons 사용)
  const getCategoryIcon = (category: string | null) => {
    const iconMap: Record<string, any> = {
      'medicine': 'medical',
      'MEDICINE': 'medical',
      'exercise': 'fitness',
      'EXERCISE': 'fitness',
      'meal': 'restaurant',
      'MEAL': 'restaurant',
      'hospital': 'medical-outline',
      'HOSPITAL': 'medical-outline',
      'other': 'list',
      'OTHER': 'list',
    };
    return iconMap[category || 'other'] || 'list';
  };

  // 시간 포맷 변환 (HH:MM -> 오전/오후 X시)
  const formatTimeToDisplay = (time24: string | null): string => {
    if (!time24) return '';
    const [hour] = time24.split(':').map(Number);
    if (hour === 0) return '오전 12시';
    if (hour < 12) return `오전 ${hour}시`;
    if (hour === 12) return '오후 12시';
    return `오후 ${hour - 12}시`;
  };

  // 전화 앱으로 연결 (Android 대상)
  const dialPhoneNumber = async (rawNumber?: string) => {
    try {
      if (!rawNumber) {
        show('연락처 없음', '이 보호자에게 등록된 전화번호가 없습니다.');
        return;
      }
      const sanitized = rawNumber.replace(/[^\d+]/g, '');
      const url = `tel:${sanitized}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        show('실패', '이 기기에서 전화를 걸 수 없습니다.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('전화 앱 열기 실패:', error);
      show('오류', '전화 앱을 열 수 없습니다.');
    }
  };

  // TODO 완료 처리
  const handleCompleteTodo = async (todoId: string) => {
    try {
      await todoApi.completeTodo(todoId);
      show('완료!', '할 일을 완료했습니다.');
      // TODO 목록 새로고침
      loadTodayTodos();
    } catch (error) {
      console.error('할 일 완료 실패:', error);
      show('오류', '할 일 완료에 실패했습니다.');
    }
  };

  // TODO 완료 취소
  const handleCancelTodo = async (todoId: string) => {
    try {
      await todoApi.cancelTodo(todoId);
      show('취소됨', '할 일 완료를 취소했습니다.');
      // TODO 목록 새로고침
      loadTodayTodos();
    } catch (error) {
      console.error('할 일 취소 실패:', error);
      show('오류', '할 일 취소에 실패했습니다.');
    }
  };

  const handleLogout = async () => {
    show(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  // 튜토리얼 체크 함수
  const checkTutorial = async () => {
    try {
      const shouldShow = await AsyncStorage.getItem('showTutorial');
      
      // 기존 사용자 처리: 값이 없거나 'true'가 아니면 'false'로 설정
      if (shouldShow === null || shouldShow !== 'true') {
        await AsyncStorage.setItem('showTutorial', 'false');
        return;
      }
      
      // 신규 회원가입 사용자만 튜토리얼 표시
      if (shouldShow === 'true') {
        // 약간의 지연 후 튜토리얼 표시 (화면 렌더링 완료 후)
        setTimeout(() => {
          setShowTutorial(true);
        }, 500);
      }
    } catch (error) {
      console.error('튜토리얼 체크 실패:', error);
    }
  };

  // 튜토리얼 완료 처리
  const handleTutorialComplete = async () => {
    try {
      await AsyncStorage.setItem('showTutorial', 'false');
      setShowTutorial(false);
      // AI 전화 페이지로 이동
      setTimeout(() => {
        router.push('/ai-call');
      }, 300);
    } catch (error) {
      console.error('튜토리얼 플래그 저장 실패:', error);
    }
  };

  // 화면 포커스 시 데이터 새로고침
  useFocusEffect(
    React.useCallback(() => {
      loadTodayTodos();
      loadPendingConnections();
      loadActiveConnections();
      loadWeather();
      checkRecentCalls();
      checkTutorial();
    }, [loadWeather, selectedDayTab])
  );

  // 날씨 정보 30분마다 자동 갱신 (강제 새로고침)
  useEffect(() => {
    const weatherInterval = setInterval(() => {
      console.log('🔄 날씨 정보 자동 갱신 (30분)');
      loadWeather(true); // 강제 새로고침
    }, 30 * 60 * 1000); // 30분 = 1800초 = 1800000ms

    // Cleanup: 컴포넌트 unmount 시 interval 정리
    return () => {
      clearInterval(weatherInterval);
    };
  }, [loadWeather]);

  // 최초 마운트 시 날씨 데이터가 없으면 로드
  useEffect(() => {
    if (!hasWeather()) {
      console.log('📥 최초 마운트 - 날씨 데이터 로드');
      loadWeather();
    }
  }, [hasWeather, loadWeather]);

  // 현재 날짜 정보
  const today = new Date();
  const dateString = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayString = dayNames[today.getDay()];

  // 폰트 크기 버튼 컴포넌트
  const FontSizeButton = () => {
    const fontSizeButtonSize = getResponsiveSize(48, scale, true);
    const fontSizeButtonBorderRadius = fontSizeButtonSize / 2;
    const fontSizeButtonTextSize = getResponsiveFontSize(12, scale);
    
    return (
      <TouchableOpacity 
        onPress={toggleFontSize}
        style={[
          styles.fontSizeButton,
          {
            width: fontSizeButtonSize,
            height: fontSizeButtonSize,
            borderRadius: fontSizeButtonBorderRadius,
          }
        ]}
        activeOpacity={0.7}
      >
        <Text style={[styles.fontSizeButtonText, { fontSize: fontSizeButtonTextSize }]}>
          {getFontSizeText()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 공통 헤더 - 폰트 크기 버튼 표시 */}
      <Header 
        title="그랜비"
        showMenuButton={true} 
        rightButton={<FontSizeButton />}
      />

      {/* 연결 요청 알림 배너 */}
      {pendingConnections.length > 0 && (
        <TouchableOpacity
          style={styles.notificationBanner}
          onPress={() => {
            setSelectedConnection(pendingConnections[0]);
            setShowConnectionModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.bannerContent}>
            <Ionicons name="notifications" size={24} color="#FF9500" style={styles.bannerIcon} />
            <View style={styles.bannerText}>
              <Text 
                style={[styles.bannerTitle, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 22 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                새로운 연결 요청 ({pendingConnections.length})
              </Text>
              <Text 
                style={[styles.bannerSubtitle, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {pendingConnections[0].name}님이 보호자 연결을 요청했습니다
              </Text>
            </View>
            <Text style={styles.bannerArrow}>›</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 자동 전화 통화기록이 있으면 일기 작성 알림 배너 */}
      {hasRecentCall && (
        <View style={styles.draftNotificationBanner}>
          <TouchableOpacity
            style={styles.draftNotificationBannerContent}
            onPress={() => {
              router.push({
                pathname: '/diary-write',
                params: {
                  fromCall: 'true',
                  fromBanner: 'true', 
                },
              });
            }}
            activeOpacity={0.8}
          >
            <View style={styles.bannerContent}>
              <Ionicons name="call" size={24} color="#F57C00" style={styles.bannerIcon} />
              <View style={styles.bannerText}>
                <Text 
                  style={[styles.bannerTitle, fontSizeLevel >= 1 && { fontSize: 18 }, fontSizeLevel >= 2 && { fontSize: 22 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  AI 통화 완료! 일기를 작성해보세요
                </Text>
                <Text 
                  style={[styles.bannerSubtitle, fontSizeLevel >= 1 && { fontSize: 16 }, fontSizeLevel >= 2 && { fontSize: 18 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  대화를 바탕으로 일기를 작성할 수 있어요
                </Text>
              </View>
              <Text style={styles.bannerArrow}>›</Text>
            </View>
          </TouchableOpacity>
          {/* X 버튼 추가 */}
          <TouchableOpacity
            style={styles.bannerCloseButton}
            onPress={handleDismissBanner}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#555" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* 어르신 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {getProfileImageUrl() ? (
                <Image
                  source={{ uri: getProfileImageUrl()! }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  resizeMode="cover"
                />
              ) : (
                <ProfileIcon size={36} color="#34B79F" />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.greeting, fontSizeLevel >= 1 && styles.greetingLarge, fontSizeLevel >= 2 && { fontSize: 28 }]}>안녕하세요!</Text>
              <Text style={[styles.userName, fontSizeLevel >= 1 && styles.userNameLarge, fontSizeLevel >= 2 && { fontSize: 32 }]}>{user?.name || '사용자'}님</Text>
              <Text style={[styles.userStatus, fontSizeLevel >= 1 && styles.userStatusLarge, fontSizeLevel >= 2 && { fontSize: 22 }]}>건강한 하루 보내세요</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.todaySection}>
            <View style={styles.todayBadge}>
              <Text style={[styles.todayText, fontSizeLevel >= 1 && styles.todayTextLarge, fontSizeLevel >= 2 && { fontSize: 22 }]}>오늘</Text>
            </View>
            <Text style={[styles.dateText, fontSizeLevel >= 1 && styles.dateTextLarge, fontSizeLevel >= 2 && { fontSize: 20 }]}>{dateString} {dayString}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.reminderSection}>
            {upcomingTodo ? (
              <View style={styles.reminderContent}>
                <PillIcon size={fontSizeLevel >= 1 ? 20 : 16} color="#FFFFFF" />
                <Text style={[styles.reminderText, fontSizeLevel >= 1 && styles.reminderTextLarge, fontSizeLevel >= 2 && { fontSize: 18 }]}>
                  {upcomingTodo.due_time ? (
                    <>
                      {upcomingTodo.due_time.substring(0, 5)}에 {upcomingTodo.title}
                      {upcomingTodo.category && ` (${getCategoryName(upcomingTodo.category)})`}
                    </>
                  ) : (
                    <>
                      <Text style={[fontSizeLevel >= 1 ? styles.reminderTimeTextSmallLarge : styles.reminderTimeTextSmall]}>시간미정</Text>에 {upcomingTodo.title}
                      {upcomingTodo.category && ` (${getCategoryName(upcomingTodo.category)})`}
                    </>
                  )}
                </Text>
              </View>
            ) : (
              <View style={styles.reminderContent}>
                <PillIcon size={fontSizeLevel >= 1 ? 20 : 16} color="#FFFFFF" />
                <Text style={[styles.reminderText, fontSizeLevel >= 1 && styles.reminderTextLarge, fontSizeLevel >= 2 && { fontSize: 18 }]}>
                  오늘 예정된 일정이 없습니다
                </Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.weatherSection}>
            {weatherIconUrl ? (
              <Image
                source={{ uri: weatherIconUrl }}
                style={{
                  width: weatherIconSize,
                  height: weatherIconSize,
                  borderRadius: weatherIconSize / 2,
                }}
                resizeMode="contain"
              />
            ) : (
              <SunIcon size={weatherIconSize} color="#FFB800" />
            )}
            {isLoadingWeather ? (
              <Text style={[styles.weatherText, fontSizeLevel >= 1 && styles.weatherTextLarge, fontSizeLevel >= 2 && { fontSize: 18 }]}>
                날씨 정보를 불러오는 중...
              </Text>
            ) : weather.hasPermission === false ? (
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TouchableOpacity 
                  onPress={async () => {
                    // 위치 권한 다시 요청 (강제 새로고침)
                    await loadWeather(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="location-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={[styles.weatherText, fontSizeLevel >= 1 && styles.weatherTextLarge, fontSizeLevel >= 2 && { fontSize: 18 }, { textDecorationLine: 'underline' }]}>
                      위치 권한을 허용해주세요
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : weather.temperature !== undefined ? (
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.weatherText, fontSizeLevel >= 1 && styles.weatherTextLarge]}>
                  {weather.location && `${weather.location} `}현재 {weather.temperature}°C
                </Text>
              </View>
            ) : (
              <Text style={[styles.weatherText, fontSizeLevel >= 1 && styles.weatherTextLarge]}>
                날씨 정보를 불러올 수 없습니다
              </Text>
            )}
          </View>
        </View>

        {/* 빠른 액션 버튼들 */}
        <QuickActionGrid
          actions={[
            {
              id: 'todos',
              label: '내 일정',
              icon: <CheckIcon size={fontSizeLevel >= 1 ? 32 : 24} color="#34B79F" />,
              onPress: () => router.push('/todos'), // 할 일 목록 조회 및 완료 처리
            },
            {
              id: 'ai-call',
              label: 'AI 통화',
              icon: <PhoneIcon size={fontSizeLevel >= 1 ? 32 : 24} color="#34B79F" />,
              onPress: () => router.push('/ai-call'), // AI 전화 통화
            },
            {
              id: 'diaries',
              label: '일기',
              icon: <DiaryIcon size={fontSizeLevel >= 1 ? 32 : 24} color="#34B79F" />,
              onPress: () => router.push('/diaries'), // 일기 작성 및 조회
            },
            {
              id: 'calendar',
              label: '캘린더',
              icon: 'calendar-outline',
              onPress: () => router.push('/calendar'), // 전체 일정 한눈에 보기
            },
          ]}
          size={fontSizeLevel >= 1 ? 'large' : 'default'}
        />

        {/* 오늘/내일의 일정 카드 - 미완료 */}
        <View style={styles.scheduleCard}>
          <View>
            {/* 오늘/내일 탭 */}
            <View style={styles.cardHeader}>
              <View style={styles.dayTabContainer}>
                <TouchableOpacity
                  style={[styles.dayTab, selectedDayTab === 'today' && styles.dayTabActive]}
                  onPress={() => setSelectedDayTab('today')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayTabText, selectedDayTab === 'today' && styles.dayTabTextActive]}>
                    오늘
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dayTab, selectedDayTab === 'tomorrow' && styles.dayTabActive]}
                  onPress={() => setSelectedDayTab('tomorrow')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayTabText, selectedDayTab === 'tomorrow' && styles.dayTabTextActive]}>
                    내일
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (() => {
            const pendingTodos = todayTodos.filter(todo => 
              todo.status !== 'COMPLETED' && todo.status !== 'completed'
            );
            
            return pendingTodos.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: '#999999' }}>
                  {selectedDayTab === 'today' ? '오늘' : '내일'} 할 일이 없습니다
                </Text>
              </View>
            ) : (
              pendingTodos.slice(0, 3).map((todo, index) => {
                return (
                  <TouchableOpacity
                    key={todo.todo_id}
                    style={styles.scheduleItem}
                    onPress={() => {
                      setSelectedTodo(todo);
                      setShowTodoModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.scheduleTime}>
                      <Text style={[
                        styles.scheduleTimeText, 
                        fontSizeLevel >= 1 && styles.scheduleTimeTextLarge,
                        !todo.due_time && (fontSizeLevel >= 1 ? styles.scheduleTimeTextSmallLarge : styles.scheduleTimeTextSmall)
                      ]}>
                        {todo.due_time ? todo.due_time.substring(0, 5) : '시간미정'}
                      </Text>
                    </View>
                    <View style={styles.scheduleContent}>
                      <Text 
                        style={[styles.scheduleTitle, fontSizeLevel >= 1 && styles.scheduleTitleLarge]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {todo.title}
                      </Text>
                      <Text 
                        style={[styles.scheduleLocation, fontSizeLevel >= 1 && styles.scheduleLocationLarge]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {todo.description || ''}
                      </Text>
                      <Text style={[styles.scheduleDate, fontSizeLevel >= 1 && styles.scheduleDateLarge]}>
                        {todo.category ? `[${getCategoryName(todo.category)}]` : ''}
                      </Text>
                    </View>
                    <View style={styles.scheduleStatus}>
                      <Text style={[styles.scheduleStatusText, fontSizeLevel >= 1 && styles.scheduleStatusTextLarge]}>
                        예정
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            );
          })()}
        </View>

        {/* 완료한 일정 카드 */}
        {!isLoading && (() => {
          const completedTodos = todayTodos.filter(todo => 
            todo.status === 'COMPLETED' || todo.status === 'completed'
          );
          
          return completedTodos.length > 0 && (
            <View style={styles.scheduleCard}>
              <View style={styles.cardHeader}>
                <Text 
                  style={[styles.cardTitle, fontSizeLevel >= 1 && styles.cardTitleLarge]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  완료한 일정
                </Text>
                <View style={styles.completedBadge}>
                  <Text style={[styles.completedBadgeText, fontSizeLevel >= 1 && { fontSize: 16 }]}>
                    {completedTodos.length}
                  </Text>
                </View>
              </View>
              
              {completedTodos.slice(0, 3).map((todo, index) => {
                return (
                  <TouchableOpacity
                    key={todo.todo_id}
                    style={[styles.scheduleItem, styles.completedScheduleItem]}
                    onPress={() => {
                      setSelectedTodo(todo);
                      setShowTodoModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.scheduleTime}>
                      <Text style={[
                        styles.scheduleTimeText, 
                        styles.completedTimeText, 
                        fontSizeLevel >= 1 && styles.scheduleTimeTextLarge,
                        !todo.due_time && (fontSizeLevel >= 1 ? styles.scheduleTimeTextSmallLarge : styles.scheduleTimeTextSmall)
                      ]}>
                        {todo.due_time ? todo.due_time.substring(0, 5) : '시간미정'}
                      </Text>
                    </View>
                    <View style={styles.scheduleContent}>
                      <Text 
                        style={[styles.scheduleTitle, styles.completedTitleText, fontSizeLevel >= 1 && styles.scheduleTitleLarge]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {todo.title}
                      </Text>
                      <Text 
                        style={[styles.scheduleLocation, styles.completedDescText, fontSizeLevel >= 1 && styles.scheduleLocationLarge]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {todo.description || ''}
                      </Text>
                      <Text style={[styles.scheduleDate, styles.completedDescText, fontSizeLevel >= 1 && styles.scheduleDateLarge]}>
                        {todo.category ? `[${getCategoryName(todo.category)}]` : ''}
                      </Text>
                    </View>
                    <View style={[styles.scheduleStatus, styles.completedStatus]}>
                      <Text style={[styles.scheduleStatusText, fontSizeLevel >= 1 && styles.scheduleStatusTextLarge]}>
                        완료
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}

        {/* 내 가족/보호자 */}
        <View style={styles.healthSummaryCard}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View 
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#E8F5F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="people" size={20} color="#34B79F" />
              </View>
              <View>
                <Text 
                  style={[styles.cardTitle, fontSizeLevel >= 1 && styles.cardTitleLarge]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  내 가족
                </Text>
                {activeConnections.length > 0 && (
                  <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                    가족과 함께하고 있어요
                  </Text>
                )}
              </View>
            </View>
          </View>
          
          {activeConnections.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              {activeConnections.slice(0, 3).map((caregiver, index) => (
                <View
                  key={caregiver.connection_id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    marginBottom: 8,
                  }}
                >
                  <View 
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: '#34B79F',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#34B79F',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <Ionicons name="person" size={28} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text 
                      style={[styles.metricValue, { fontSize: 17, fontWeight: '600' }, fontSizeLevel >= 1 && styles.metricValueLarge]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {caregiver.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text 
                        style={[styles.metricLabel, { fontSize: 14 }, fontSizeLevel >= 1 && styles.metricLabelLarge]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {caregiver.phone_number ? formatPhoneNumber(caregiver.phone_number) : '연락처 없음'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginLeft: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <TouchableOpacity
                      onPress={() => dialPhoneNumber(caregiver.phone_number)}
                      activeOpacity={0.7}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#34B79F',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="call" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {activeConnections.length > 3 && (
                <View style={{ alignItems: 'center', marginTop: 8, paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="people-circle" size={16} color="#34B79F" />
                    <Text style={{ color: '#34B79F', fontSize: 14, marginLeft: 4, fontWeight: '600' }}>
                      외 {activeConnections.length - 3}명의 가족이 더 있어요
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="people-outline" size={64} color="#CCCCCC" />
              <Text 
                style={[styles.metricLabel, { color: '#999', marginTop: 16 }, fontSizeLevel >= 1 && styles.metricLabelLarge]}
              >
                연결된 보호자가 없습니다
              </Text>
            </View>
          )}
        </View>

        {/* 하단 여백 - 바텀 네비게이션 바 공간 */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 할일 상세보기 모달 */}
      <Modal
        visible={showTodoModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowTodoModal(false);
          setSelectedTodo(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            {/* 모달 헤더 */}
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>할 일 상세</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTodoModal(false);
                  setSelectedTodo(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            {/* TODO 정보 */}
            {selectedTodo && (
              <ScrollView style={styles.editModalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.todoDetailSection}>
                  <Text style={styles.todoDetailLabel}>제목</Text>
                  <Text style={styles.todoDetailValue}>{selectedTodo.title}</Text>
                </View>

                {selectedTodo.description && (
                  <View style={styles.todoDetailSection}>
                    <Text style={styles.todoDetailLabel}>설명</Text>
                    <Text style={styles.todoDetailValue}>{selectedTodo.description}</Text>
                  </View>
                )}

                <View style={styles.todoDetailRow}>
                  <View style={[styles.todoDetailSection, { flex: 1 }]}>
                    <Text style={styles.todoDetailLabel}>카테고리</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={getCategoryIcon(selectedTodo.category)} size={16} color="#34B79F" style={{ marginRight: 4 }} />
                      <Text style={styles.todoDetailValue}>{getCategoryName(selectedTodo.category)}</Text>
                    </View>
                  </View>

                  <View style={[styles.todoDetailSection, { flex: 1 }]}>
                    <Text style={styles.todoDetailLabel}>시간</Text>
                    <Text style={styles.todoDetailValue}>
                      {formatTimeToDisplay(selectedTodo.due_time) || '-'}
                    </Text>
                  </View>
                </View>

                <View style={styles.todoDetailSection}>
                  <Text style={styles.todoDetailLabel}>상태</Text>
                  <Text style={[
                    styles.todoDetailValue,
                    { color: selectedTodo.status === 'completed' || selectedTodo.status === 'COMPLETED' ? '#34B79F' : '#666666' }
                  ]}>
                    {selectedTodo.status === 'completed' || selectedTodo.status === 'COMPLETED' ? '완료' : 
                     selectedTodo.status === 'cancelled' || selectedTodo.status === 'CANCELLED' ? '취소' : '대기'}
                  </Text>
                </View>

                {selectedTodo.is_recurring && (
                  <View style={styles.todoDetailSection}>
                    <Text style={styles.todoDetailLabel}>반복 일정</Text>
                    <Text style={styles.todoDetailValue}>
                      {selectedTodo.recurring_type === 'DAILY' ? '매일' :
                       selectedTodo.recurring_type === 'WEEKLY' ? '매주' :
                       selectedTodo.recurring_type === 'MONTHLY' ? '매월' : '-'}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* 모달 액션 버튼 */}
            <View style={[styles.editModalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {selectedTodo && (selectedTodo.status !== 'completed' && selectedTodo.status !== 'COMPLETED') && (
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.editButton]}
                  onPress={async () => {
                    if (selectedTodo) {
                      await handleCompleteTodo(selectedTodo.todo_id);
                      setShowTodoModal(false);
                      setSelectedTodo(null);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editButtonText}>완료하기</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* 연결 요청 수락/거절 모달 */}
      <Modal
        visible={showConnectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConnectionModal(false);
          setSelectedConnection(null);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.connectionModalContent, { padding: scalePx(24) }]}>
            {selectedConnection && (
              <>
                <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }, fontSizeLevel >= 1 && { fontSize: 24 }]}>연결 요청</Text>
                
                <View style={styles.modalProfileSection}>
                  <Ionicons name="person" size={moderateScale(48)} color="#34B79F" style={styles.modalProfileIcon} />
                  <Text style={[styles.modalProfileName, { fontSize: moderateScale(20) }, fontSizeLevel >= 1 && { fontSize: 24 }]}>
                    {selectedConnection.name}님이
                  </Text>
                  <Text style={[styles.modalProfileSubtitle, { fontSize: moderateScale(16) }, fontSizeLevel >= 1 && { fontSize: 18 }]}>
                    보호자 연결을 요청했습니다
                  </Text>
                </View>

                <View style={styles.modalInfoSection}>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="mail" size={moderateScale(16)} color="#666" style={[styles.modalInfoLabel, fontSizeLevel >= 1 && { fontSize: 16 }]} />
                    <Text style={[styles.modalInfoText, { fontSize: moderateScale(14) }, fontSizeLevel >= 1 && { fontSize: 16 }]}>
                      {selectedConnection.email}
                    </Text>
                  </View>
                  {selectedConnection.phone_number && (
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="call" size={moderateScale(16)} color="#666" style={[styles.modalInfoLabel, fontSizeLevel >= 1 && { fontSize: 16 }]} />
                      <Text style={[styles.modalInfoText, { fontSize: moderateScale(14) }, fontSizeLevel >= 1 && { fontSize: 16 }]}>
                        {formatPhoneNumber(selectedConnection.phone_number)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalPermissionSection}>
                  <View style={styles.modalPermissionTitleRow}>
                    <Ionicons name="information-circle" size={moderateScale(16)} color="#34B79F" />
                    <Text style={[styles.modalPermissionTitle, { fontSize: moderateScale(14) }, fontSizeLevel >= 1 && { fontSize: 16 }]}>
                      연결하시면 다음을 공유합니다:
                    </Text>
                  </View>
                  <Text style={[styles.modalPermissionItem, { fontSize: moderateScale(14) }, fontSizeLevel >= 1 && { fontSize: 16 }]}>
                    • 할일 관리
                  </Text>
                  <Text style={[styles.modalPermissionItem, { fontSize: moderateScale(14) }, fontSizeLevel >= 1 && { fontSize: 16 }]}>
                    • 일기 열람
                  </Text>
                  <Text style={[styles.modalPermissionItem, { fontSize: moderateScale(14) }, fontSizeLevel >= 1 && { fontSize: 16 }]}>
                    • 건강 정보
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.rejectButton, { paddingVertical: moderateScale(14) }]}
                    onPress={handleRejectConnection}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.rejectButtonText, { fontSize: moderateScale(16) }, fontSizeLevel >= 1 && { fontSize: 18 }]}>
                      거절
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.acceptButton, { paddingVertical: moderateScale(14) }]}
                    onPress={handleAcceptConnection}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.acceptButtonText, { fontSize: moderateScale(16) }, fontSizeLevel >= 1 && { fontSize: 18 }]}>
                      수락
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 하단 네비게이션 바 */}
      <BottomNavigationBar />

      {/* 튜토리얼 모달 */}
      <TutorialModal
        visible={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={handleTutorialComplete}
      />
    </View>
  );
};

const styles = elderlyHomeStyles;

