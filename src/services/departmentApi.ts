import { apiClient, ApiError } from './api';
import { ApiResponse, Department, User, PaginatedResponse } from '@/types';

export interface CreateDepartmentData {
  name: string;
  code: string;
  hodUserId?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  hodUserId?: string;
}

export interface DepartmentFilters {
  page?: number;
  limit?: number;
  search?: string;
  hasHod?: boolean;
}

export const departmentApi = {
  async getDepartments(filters?: DepartmentFilters): Promise<ApiResponse<Department[]> | PaginatedResponse<Department>> {
    const queryParams = new URLSearchParams();
    
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.search) queryParams.append('search', filters.search);
    if (filters?.hasHod !== undefined) queryParams.append('hasHod', filters.hasHod.toString());
    
    const endpoint = `/departments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<Department[]>(endpoint);
  },

  async getDepartmentById(id: string): Promise<ApiResponse<Department>> {
    try {
      return await apiClient.get<Department>(`/departments/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError('Department not found', 404);
      }
      throw error;
    }
  },

  async createDepartment(departmentData: CreateDepartmentData): Promise<ApiResponse<Department>> {
    try {
      return await apiClient.post<Department>('/departments', departmentData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to create department', 500);
    }
  },

  async updateDepartment(id: string, departmentData: UpdateDepartmentData): Promise<ApiResponse<Department>> {
    try {
      return await apiClient.put<Department>(`/departments/${id}`, departmentData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to update department', 500);
    }
  },

  async deleteDepartment(id: string): Promise<ApiResponse<void>> {
    try {
      return await apiClient.delete<void>(`/departments/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError('Department not found', 404);
      }
      throw error;
    }
  },

  async assignHod(departmentId: string, userId: string): Promise<ApiResponse<Department>> {
    return apiClient.put<Department>(`/departments/${departmentId}/hod`, { hodUserId: userId });
  },

  async removeHod(departmentId: string): Promise<ApiResponse<Department>> {
    return apiClient.delete<Department>(`/departments/${departmentId}/hod`);
  },

  async getDepartmentMembers(departmentId: string): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>(`/departments/${departmentId}/members`);
  },

  async getDepartmentStats(departmentId: string): Promise<ApiResponse<{
    totalMembers: number;
    totalSubmissions: number;
    pendingSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    membersByRole: Record<string, number>;
  }>> {
    return apiClient.get(`/departments/${departmentId}/stats`);
  },

  async getAllDepartmentStats(): Promise<ApiResponse<{
    total: number;
    withHod: number;
    withoutHod: number;
    totalMembers: number;
    averageMembersPerDepartment: number;
  }>> {
    return apiClient.get('/departments/stats');
  },
};