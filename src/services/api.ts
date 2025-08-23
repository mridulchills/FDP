import { ApiResponse, AuthResponse, LoginCredentials, User, PaginatedResponse } from '@/types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Token management
let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

// Token storage helpers
export const setTokens = (tokens: { accessToken: string; refreshToken: string }) => {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

// Enhanced error handling for new API response format
export class ApiError extends Error {
  public status: number;
  public details?: any;
  public requestId?: string;

  constructor(message: string, status: number, details?: any, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

// HTTP client with automatic token handling
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Add authorization header if token exists
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle token refresh for 401 errors
      if (response.status === 401 && refreshToken && endpoint !== '/auth/refresh') {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request with new token
          headers.Authorization = `Bearer ${accessToken}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          const retryData = await retryResponse.json();
          
          // Handle retry response errors
          if (!retryResponse.ok) {
            throw new ApiError(
              retryData.error || 'Request failed',
              retryResponse.status,
              retryData.details,
              retryData.requestId
            );
          }
          
          return retryData;
        } else {
          // Refresh failed, clear tokens and redirect to login
          clearTokens();
          window.location.href = '/login';
          throw new ApiError('Session expired', 401);
        }
      }

      const data = await response.json();
      
      // Handle API errors with new response format
      if (!response.ok) {
        throw new ApiError(
          data.error || `HTTP ${response.status}`,
          response.status,
          data.details,
          data.requestId
        );
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      
      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Network error - please check your connection', 0);
      }
      
      // Handle other errors
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        500
      );
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data: ApiResponse<{ accessToken: string }> = await response.json();
      
      if (response.ok && data.success && data.data?.accessToken) {
        accessToken = data.data.accessToken;
        localStorage.setItem('accessToken', data.data.accessToken);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create API client instance
export const apiClient = new ApiClient(API_BASE_URL);

// Authentication API
export const authApi = {
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    
    if (response.success && response.data) {
      setTokens({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });
    }
    
    return response;
  },

  async logout(): Promise<ApiResponse<void>> {
    const response = await apiClient.post<void>('/auth/logout', {
      refreshToken: getRefreshToken(),
    });
    
    clearTokens();
    return response;
  },

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/auth/me');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },
};

// Enhanced Users API with pagination and filtering
export const usersApi = {
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    department?: string;
    search?: string;
  }): Promise<ApiResponse<User[]> | PaginatedResponse<User>> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.role) queryParams.append('role', params.role);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.search) queryParams.append('search', params.search);
    
    const endpoint = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<User[]>(endpoint);
  },

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return apiClient.get<User>(`/users/${id}`);
  },

  async createUser(userData: {
    employeeId: string;
    name: string;
    email: string;
    role: 'faculty' | 'hod' | 'admin';
    departmentId: string;
    designation: string;
    institution: string;
    password: string;
  }): Promise<ApiResponse<User>> {
    return apiClient.post<User>('/users', userData);
  },

  async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`/users/${id}`, userData);
  },

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/users/${id}`);
  },

  async updateUserRole(id: string, role: 'faculty' | 'hod' | 'admin'): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`/users/${id}/role`, { role });
  },

  async resetUserPassword(id: string, newPassword: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/users/${id}/reset-password`, { password: newPassword });
  },

  async getUsersByDepartment(departmentId: string): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>(`/users/department/${departmentId}`);
  },

  async getUserStats(): Promise<ApiResponse<{
    total: number;
    byRole: Record<string, number>;
    byDepartment: Record<string, number>;
    active: number;
  }>> {
    return apiClient.get('/users/stats');
  },
};

// Re-export other API services
export { submissionApi } from './submissionApi';
export { departmentApi } from './departmentApi';
export { fileApi } from './fileApi';
export { notificationApi } from './notificationApi';
export { auditApi } from './auditApi';