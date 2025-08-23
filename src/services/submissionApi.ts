import { apiClient, ApiError } from './api';
import { 
  ApiResponse, 
  Submission, 
  PaginatedResponse, 
  SubmissionStatus,
  ModuleType,
  ProgramAttendedData,
  ProgramOrganizedData,
  CertificationData
} from '@/types';

export interface CreateSubmissionData {
  moduleType: ModuleType;
  formData: ProgramAttendedData | ProgramOrganizedData | CertificationData;
  documentUrl?: string;
}

export interface UpdateSubmissionData {
  status?: SubmissionStatus;
  hodComment?: string;
  adminComment?: string;
  formData?: any;
}

export interface SubmissionFilters {
  page?: number;
  limit?: number;
  status?: SubmissionStatus;
  moduleType?: ModuleType;
  userId?: string;
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export const submissionApi = {
  async createSubmission(data: CreateSubmissionData): Promise<ApiResponse<Submission>> {
    try {
      return await apiClient.post<Submission>('/submissions', data);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to create submission', 500);
    }
  },

  async getMySubmissions(filters?: Omit<SubmissionFilters, 'userId' | 'departmentId'>): Promise<ApiResponse<Submission[]> | PaginatedResponse<Submission>> {
    const queryParams = new URLSearchParams();
    
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.moduleType) queryParams.append('moduleType', filters.moduleType);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.search) queryParams.append('search', filters.search);
    
    const endpoint = `/submissions/my${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<Submission[]>(endpoint);
  },

  async getDepartmentSubmissions(filters?: Omit<SubmissionFilters, 'departmentId'>): Promise<ApiResponse<Submission[]> | PaginatedResponse<Submission>> {
    const queryParams = new URLSearchParams();
    
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.moduleType) queryParams.append('moduleType', filters.moduleType);
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.search) queryParams.append('search', filters.search);
    
    const endpoint = `/submissions/department${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<Submission[]>(endpoint);
  },

  async getAllSubmissions(filters?: SubmissionFilters): Promise<ApiResponse<Submission[]> | PaginatedResponse<Submission>> {
    const queryParams = new URLSearchParams();
    
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.moduleType) queryParams.append('moduleType', filters.moduleType);
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.departmentId) queryParams.append('departmentId', filters.departmentId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.search) queryParams.append('search', filters.search);
    
    const endpoint = `/submissions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<Submission[]>(endpoint);
  },

  async getSubmissionById(id: string): Promise<ApiResponse<Submission>> {
    try {
      return await apiClient.get<Submission>(`/submissions/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError('Submission not found', 404);
      }
      throw error;
    }
  },

  async updateSubmission(id: string, updates: UpdateSubmissionData): Promise<ApiResponse<Submission>> {
    try {
      return await apiClient.put<Submission>(`/submissions/${id}`, updates);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to update submission', 500);
    }
  },

  async deleteSubmission(id: string): Promise<ApiResponse<void>> {
    try {
      return await apiClient.delete<void>(`/submissions/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError('Submission not found', 404);
      }
      throw error;
    }
  },

  async approveSubmission(id: string, comment?: string): Promise<ApiResponse<Submission>> {
    return apiClient.put<Submission>(`/submissions/${id}/approve`, { comment });
  },

  async rejectSubmission(id: string, comment: string): Promise<ApiResponse<Submission>> {
    return apiClient.put<Submission>(`/submissions/${id}/reject`, { comment });
  },

  async getSubmissionStats(): Promise<ApiResponse<{
    total: number;
    byStatus: Record<SubmissionStatus, number>;
    byModule: Record<ModuleType, number>;
    thisMonth: number;
    lastMonth: number;
    pending: number;
  }>> {
    return apiClient.get('/submissions/stats');
  },

  async exportSubmissions(filters?: SubmissionFilters, format: 'csv' | 'excel' = 'csv'): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.moduleType) queryParams.append('moduleType', filters.moduleType);
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.departmentId) queryParams.append('departmentId', filters.departmentId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    queryParams.append('format', format);
    
    const endpoint = `/submissions/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(`${apiClient['baseURL']}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) {
      throw new ApiError('Failed to export submissions', response.status);
    }

    return await response.blob();
  },
};