/**
 * 알림 API
 */
import apiClient from './client';
import { Notification } from '../types';

/**
 * 알림 목록 조회
 */
export const getNotifications = async (): Promise<Notification[]> => {
  const response = await apiClient.get('/api/notifications/');
  return response.data;
};

/**
 * 알림 읽음 처리
 */
export const markNotificationAsRead = async (notification_id: string): Promise<void> => {
  await apiClient.patch(`/api/notifications/${notification_id}/read`);
};

/**
 * 읽지 않은 알림 개수
 */
export const getUnreadCount = async (): Promise<number> => {
  const notifications = await getNotifications();
  return notifications.filter(n => !n.is_read).length;
};

