/**
 * ElderlyHomeScreen 스타일 정의
 */
import { StyleSheet } from 'react-native';

export const elderlyHomeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
  },
  
  // 어르신 프로필 카드
  profileCard: {
    backgroundColor: '#34B79F',
    borderRadius: 20,
    padding: 24,
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  greeting: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.9,
  },
  fontSizeButton: {
    backgroundColor: '#34B79F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fontSizeButtonText: {
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  userName: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 12,
  },
  todaySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  todayText: {
    fontSize: 14,
    color: '#34B79F',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  reminderSection: {
    paddingVertical: 4,
  },
  reminderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
  weatherSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  weatherText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
    marginLeft: 12,
  },
  weatherBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  weatherBadgeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  
  // 빠른 액션 버튼들
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionLabel: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    textAlign: 'center',
  },

  // 카드 공통 스타일
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  healthSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },

  // 일정 아이템
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  scheduleTime: {
    width: 60,
    alignItems: 'center',
    marginRight: 16,
  },
  scheduleTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  scheduleLocation: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  scheduleDate: {
    fontSize: 13,
    color: '#999999',
  },
  scheduleStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F0F8F5',
  },
  scheduleStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34B79F',
  },

  // 건강 지표
  healthMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  healthMetric: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricWithBorder: {
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  metricStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34B79F',
    backgroundColor: '#F0F8F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // 크게 보기 모드 스타일들
  greetingLarge: {
    fontSize: 22,
  },
  userNameLarge: {
    fontSize: 32,
  },
  userStatusLarge: {
    fontSize: 18,
  },
  todayTextLarge: {
    fontSize: 18,
  },
  dateTextLarge: {
    fontSize: 20,
  },
  reminderTextLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  weatherTextLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  actionButtonLarge: {
    paddingVertical: 20,
  },
  actionIconLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  actionLabelLarge: {
    fontSize: 18,
  },
  cardTitleLarge: {
    fontSize: 22,
  },
  viewAllTextLarge: {
    fontSize: 18,
  },
  scheduleTimeTextLarge: {
    fontSize: 20,
  },
  scheduleTitleLarge: {
    fontSize: 20,
  },
  scheduleLocationLarge: {
    fontSize: 18,
  },
  scheduleDateLarge: {
    fontSize: 16,
  },
  scheduleStatusTextLarge: {
    fontSize: 16,
  },
  metricValueLarge: {
    fontSize: 26,
  },
  metricLabelLarge: {
    fontSize: 18,
  },

  // 연결 요청 알림 배너
  notificationBanner: {
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  draftNotificationBanner: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F57C00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  bannerArrow: {
    fontSize: 24,
    color: '#999',
  },

  // 연결 요청 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  connectionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalProfileSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  modalProfileIcon: {
    marginBottom: 12,
  },
  modalProfileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modalProfileSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  modalInfoSection: {
    marginBottom: 20,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalInfoLabel: {
    marginRight: 8,
    width: 24,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  modalPermissionSection: {
    backgroundColor: '#E8F5F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  modalPermissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPermissionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  modalPermissionItem: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginBottom: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#34B79F',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // 일정 완료 버튼 스타일
  scheduleActionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  scheduleActionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButton: {
    backgroundColor: '#34B79F',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  scheduleActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // 완료된 일정 스타일
  completedScheduleItem: {
    backgroundColor: '#F8F9FA',
    opacity: 0.8,
  },
  completedTimeText: {
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  completedTitleText: {
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  completedDescText: {
    color: '#BBBBBB',
  },
  completedStatus: {
    backgroundColor: '#E8F5F2',
  },
  completedBadge: {
    backgroundColor: '#34B79F',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

