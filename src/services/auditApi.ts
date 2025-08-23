import { apiClient, ApiError } from './api';
import { ApiResponse, AuditLog, PaginatedResponse } from '@/types';

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
}

export const auditApi = {
  async getAuditLogs(filters?: AuditLogFilters): Promise<ApiResponse<AuditLog[]> | PaginatedResponse<AuditLog>> {
    const queryParams = new URLSearchParams();
    
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.action) queryParams.append('action', filters.action);
    if (filters?.entityType) queryParams.append('entityType', filters.entityType);
    if (filters?.entityId) queryParams.append('entityId', filters.entityId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    
    const endpoint = `/audit-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<AuditLog[]>(endpoint);
  },

  async getAuditLogById(id: string): Promise<ApiResponse<AuditLog>> {
    try {
      return await apiClient.get<AuditLog>(`/audit-logs/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError('Audit log not found', 404);
      }
      throw error;
    }
  },

  async exportAuditLogs(filters?: AuditLogFilters, format: 'csv' | 'excel' = 'csv'): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.action) queryParams.append('action', filters.action);
    if (filters?.entityType) queryParams.append('entityType', filters.entityType);
    if (filters?.entityId) queryParams.append('entityId', filters.entityId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    queryParams.append('format', format);
    
    const endpoint = `/audit-logs/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(`${apiClient['baseURL']}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) {
      throw new ApiError('Failed to export audit logs', response.status);
    }

    return await response.blob();
  },
};