// Core entity types
export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: 'faculty' | 'hod' | 'admin';
  departmentId: string;
  designation: string;
  institution: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  hodUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Submission {
  id: string;
  userId: string;
  moduleType: 'attended' | 'organized' | 'certification';
  status: SubmissionStatus;
  formData: any;
  documentUrl?: string;
  hodComment?: string;
  adminComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  link?: string;
  readFlag: boolean;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Enums and status types
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'faculty' | 'hod' | 'admin';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

// Request types
export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface CreateUserRequest {
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  designation: string;
  institution: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  departmentId?: string;
  designation?: string;
  institution?: string;
}

export interface CreateSubmissionRequest {
  moduleType: 'attended' | 'organized' | 'certification';
  formData: any;
}

export interface UpdateSubmissionRequest {
  status?: SubmissionStatus;
  hodComment?: string;
  adminComment?: string;
}

// JWT Payload type
export interface JwtPayload {
  userId: string;
  employeeId: string;
  role: UserRole;
  departmentId: string;
  iat?: number;
  exp?: number;
}

// Database query options
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// File upload types
export interface FileUploadResult {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
}

// Migration types (for Supabase migration)
export interface MigrationProgress {
  step: string;
  completed: number;
  total: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}