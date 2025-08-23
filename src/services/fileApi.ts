import { ApiResponse } from '@/types';
import { getAccessToken, ApiError } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface FileUploadResult {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
  url?: string;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const fileApi = {
  async uploadFile(
    file: File, 
    type: 'certificate' | 'brochure' | 'document' = 'document',
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<ApiResponse<FileUploadResult>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(
          data.error || 'File upload failed',
          response.status,
          data.details,
          data.requestId
        );
      }

      return data;
    } catch (error) {
      console.error('File upload failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('File upload failed', 500);
    }
  },

  async uploadMultipleFiles(
    files: File[],
    type: 'certificate' | 'brochure' | 'document' = 'document'
  ): Promise<ApiResponse<FileUploadResult[]>> {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    formData.append('type', type);

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files/upload/multiple`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(
          data.error || 'Multiple file upload failed',
          response.status,
          data.details,
          data.requestId
        );
      }

      return data;
    } catch (error) {
      console.error('Multiple file upload failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('Multiple file upload failed', 500);
    }
  },

  async downloadFile(path: string, filename?: string): Promise<Blob> {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(path)}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || 'File download failed',
          response.status,
          errorData.details,
          errorData.requestId
        );
      }

      return await response.blob();
    } catch (error) {
      console.error('File download failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('File download failed', 500);
    }
  },

  async deleteFile(path: string): Promise<ApiResponse<void>> {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(
          data.error || 'File deletion failed',
          response.status,
          data.details,
          data.requestId
        );
      }

      return data;
    } catch (error) {
      console.error('File deletion failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('File deletion failed', 500);
    }
  },

  async getFileInfo(path: string): Promise<ApiResponse<{
    filename: string;
    size: number;
    mimetype: string;
    uploadedAt: string;
    path: string;
  }>> {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(path)}/info`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(
          data.error || 'Failed to get file info',
          response.status,
          data.details,
          data.requestId
        );
      }

      return data;
    } catch (error) {
      console.error('Get file info failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError('Failed to get file info', 500);
    }
  },

  getFileUrl(path: string): string {
    return `${API_BASE_URL}/files/${encodeURIComponent(path)}`;
  },

  getDownloadUrl(path: string, filename?: string): string {
    const url = new URL(`${API_BASE_URL}/files/${encodeURIComponent(path)}`);
    if (filename) {
      url.searchParams.append('download', 'true');
      url.searchParams.append('filename', filename);
    }
    return url.toString();
  },
};