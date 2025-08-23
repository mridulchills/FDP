import { ApiError, getAccessToken, getRefreshToken, setTokens, clearTokens } from './api';

// Request interceptor for adding authentication headers
export const requestInterceptor = (config: RequestInit): RequestInit => {
  const token = getAccessToken();
  
  if (token) {
    const headers = {
      ...config.headers as Record<string, string>,
      'Authorization': `Bearer ${token}`,
    };
    
    return {
      ...config,
      headers,
    };
  }
  
  return config;
};

// Response interceptor for handling token refresh
export const responseInterceptor = async (
  response: Response,
  originalRequest: () => Promise<Response>
): Promise<Response> => {
  // If response is successful, return as is
  if (response.ok) {
    return response;
  }
  
  // Handle 401 Unauthorized - attempt token refresh
  if (response.status === 401) {
    const refreshTokenValue = getRefreshToken();
    
    if (refreshTokenValue) {
      try {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: refreshTokenValue }),
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          
          if (data.success && data.data?.accessToken) {
            // Update tokens
            setTokens({
              accessToken: data.data.accessToken,
              refreshToken: data.data.refreshToken || refreshTokenValue,
            });
            
            // Retry original request
            return await originalRequest();
          }
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }
    
    // Refresh failed or no refresh token, clear tokens and redirect
    clearTokens();
    window.location.href = '/login';
    throw new ApiError('Session expired', 401);
  }
  
  return response;
};

// Global error handler for API errors
export const handleApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError('Network error - please check your connection', 0);
  }
  
  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }
  
  return new ApiError('An unknown error occurred', 500);
};

// Retry mechanism for failed requests
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on authentication errors or client errors (4xx)
      if (error instanceof ApiError && (error.status === 401 || (error.status >= 400 && error.status < 500))) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
};