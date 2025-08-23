// Centralized API services export
export {
  apiClient,
  authApi,
  usersApi,
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  ApiError
} from './api';

export { submissionApi } from './submissionApi';
export { departmentApi } from './departmentApi';
export { fileApi } from './fileApi';
export { notificationApi } from './notificationApi';
export { auditApi } from './auditApi';

// Export types for convenience
export type {
  CreateSubmissionData,
  UpdateSubmissionData,
  SubmissionFilters
} from './submissionApi';

export type {
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentFilters
} from './departmentApi';

export type {
  FileUploadResult,
  FileUploadProgress
} from './fileApi';

export type {
  NotificationFilters
} from './notificationApi';

export type {
  AuditLogFilters
} from './auditApi';