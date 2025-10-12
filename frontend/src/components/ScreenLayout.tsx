/**
 * 공통 스크린 레이아웃 (헤더 + 콘텐츠 + 하단 네비게이션)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from './Header';
import { BottomNavigationBar } from './BottomNavigationBar';

interface ScreenLayoutProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
  showBottomNav?: boolean;
  showBackButton?: boolean;
  headerRightButton?: React.ReactNode;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  children,
  title,
  showHeader = true,
  showBottomNav = true,
  showBackButton = false,
  headerRightButton,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {showHeader && (
          <Header
            title={title}
            showBackButton={showBackButton}
            rightButton={headerRightButton}
          />
        )}
        
        <View style={styles.content}>{children}</View>
        
        {showBottomNav && <BottomNavigationBar />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
});

