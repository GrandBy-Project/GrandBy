/**
 * 홈 화면 (로그인 후 메인 화면)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { Button } from '../components/Button';

export const HomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert(
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

  const menuItems = [
    {
      id: 'diaries',
      title: '📖 일기',
      description: 'AI 자동 일기 및 직접 작성',
      color: '#FF9500',
      onPress: () => Alert.alert('준비중', '일기 기능은 개발 중입니다.'),
    },
    {
      id: 'calls',
      title: '📞 AI 통화',
      description: '어르신과의 AI 음성 대화',
      color: '#007AFF',
      onPress: () => Alert.alert('준비중', 'AI 통화 기능은 개발 중입니다.'),
    },
    {
      id: 'todos',
      title: '✅ 할일',
      description: 'AI 추출 및 관리',
      color: '#34C759',
      onPress: () => Alert.alert('준비중', '할일 기능은 개발 중입니다.'),
    },
    {
      id: 'connections',
      title: '👥 연결',
      description: '보호자-어르신 관계 관리',
      color: '#FF2D55',
      onPress: () => Alert.alert('준비중', '연결 관리 기능은 개발 중입니다.'),
    },
    {
      id: 'notifications',
      title: '🔔 알림',
      description: '중요 알림 및 리마인더',
      color: '#5856D6',
      onPress: () => Alert.alert('준비중', '알림 기능은 개발 중입니다.'),
    },
    {
      id: 'dashboard',
      title: '📊 대시보드',
      description: '감정 분석 및 통계',
      color: '#AF52DE',
      onPress: () => Alert.alert('준비중', '대시보드 기능은 개발 중입니다.'),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>안녕하세요,</Text>
          <Text style={styles.userName}>{user?.name}님! 👋</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userRole}>
            {user?.role === 'elderly' ? '👴 어르신' : '👨‍👩‍👧 보호자'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, { borderLeftColor: item.color }]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDescription}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Button
            title="로그아웃"
            onPress={handleLogout}
            variant="outline"
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  userInfo: {
    marginTop: 12,
  },
  userRole: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    backgroundColor: '#E3F2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  menuGrid: {
    gap: 12,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  menuDescription: {
    fontSize: 14,
    color: '#666666',
  },
  footer: {
    marginTop: 24,
    marginBottom: 32,
  },
});

