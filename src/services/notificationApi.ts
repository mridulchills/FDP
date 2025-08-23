import { apiClient, ApiError } from './api';
import { ApiResponse, Notification, PaginatedResponse } from '@/types';

export interface NotificationFilters {
  page?: number;
  limit?: number;
  read?: boolean;
  startDate?: string;
  endDate?: string;
}

export const notificationApi = {
  async getNotifications(filters?: NotificationFilters): Promise<ApiResponse<Notification[]> | PaginatedResponse<Notification>> {
    const queryParams = new URLSearchParams();
    
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.read !== undefined) queryParams.append('read', filters.read.toString());
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    
    const endpoint = `/notifications${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<Notification[]>(endpoint);
  },

  async markAsRead(id: string): Promise<ApiResponse<Notification>> {
    try {
      return await apiClient.put<Notification>(`/notifications/${id}/read`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError('Notification not found', 404);
      }
      throw error;
    }
  },

  async markAllAsRead(): Promise<ApiResponse<void>> {
    return apiClient.put<void>('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<ApiResponse<void>> {
    try {
      return await apiClient.delete<void>(`/notifications/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError('Notification not found', 404);
      }
      throw error;
    }
  },

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return apiClient.get('/notifications/unread-count');
  },
};