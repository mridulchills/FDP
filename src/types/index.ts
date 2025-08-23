// Core types for FDTS application

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: 'faculty' | 'hod' | 'admin' | 'accounts';
  department: string;
  designation: string;
  institution: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  hodUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionStatus = 
  | 'Pending Faculty Development Cell Approval'
  | 'Approved by Faculty Development Cell'
  | 'Rejected by Faculty Development Cell'
  | 'Pending HoD Approval'
  | 'Approved by HoD'
  | 'Rejected by HoD'
  | 'Pending Accounts Approval'
  | 'Approved by Accounts'
  | 'Rejected by Accounts'
  | 'Completed';

export type ModuleType = 'attended' | 'organized' | 'certification';

export interface BaseSubmission {
  id: string;
  userId: string;
  moduleType: ModuleType;
  status: SubmissionStatus;
  documentUrl?: string;
  facultyDevelopmentCellComment?: string;
  hodComment?: string;
  adminComment?: string;
  accountsComment?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

// Programs Attended Module
export interface ProgramAttendedData {
  title: string;
  type: 'FDP' | 'Workshop' | 'Conference' | 'Seminar' | 'Webinar' | 'MOOC';
  mode: 'Online' | 'Offline' | 'Hybrid';
  organizingInstitution: string;
  venue?: string;
  startDate: string;
  endDate: string;
  duration: number;
  durationType: 'hours' | 'days';
  domain: 'Own' | 'Related' | 'Other';
  domainOther?: string;
  objective: string;
  keyLearnings: string;
  contribution: string;
  sponsored: boolean;
  sponsorName?: string;
}

export interface ProgramAttendedSubmission extends BaseSubmission {
  moduleType: 'attended';
  formData: ProgramAttendedData;
}

// Programs Organized Module
export interface ProgramOrganizedData {
  title: string;
  type: 'FDP' | 'Workshop' | 'Conference' | 'Seminar' | 'Webinar' | 'Training';
  mode: 'Online' | 'Offline' | 'Hybrid';
  startDate: string;
  endDate: string;
  duration: number;
  durationType: 'hours' | 'days';
  targetAudience: ('Faculty' | 'Students' | 'Industry' | 'Researchers')[];
  participants: number;
  role: 'Convener' | 'Coordinator' | 'Resource Person';
  collaboratingPartners?: string;
  budgetApproval: boolean;
  budgetAmount?: number;
  fundingSource?: string;
  outcomeSummary: string;
  participantFeedback?: string;
  publicationLinks?: string;
}

export interface ProgramOrganizedSubmission extends BaseSubmission {
  moduleType: 'organized';
  formData: ProgramOrganizedData;
}

// Certifications Module
export interface CertificationData {
  courseName: string;
  platform: 'Coursera' | 'NPTEL' | 'edX' | 'Swayam' | 'ATAL' | 'Other';
  platformOther?: string;
  domain: string;
  duration: number;
  durationType: 'hours' | 'weeks';
  mode: 'Online' | 'Blended';
  status: 'Completed' | 'In Progress';
  relevance: string;
  implementation: string;
  extractedName?: string;
  extractedCourse?: string;
  extractedDate?: string;
}

export interface CertificationSubmission extends BaseSubmission {
  moduleType: 'certification';
  formData: CertificationData;
}

export type Submission = ProgramAttendedSubmission | ProgramOrganizedSubmission | CertificationSubmission;

export interface DashboardStats {
  totalSubmissions: number;
  pendingApprovals: number;
  approved: number;
  rejected: number;
  thisMonth: number;
  lastMonth: number;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  timestamp: string;
  user?: User;
}

// Form validation types
export interface FormErrors {
  [key: string]: string | undefined;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Authentication types
export interface LoginCredentials {
  employeeId: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// File upload types
export interface FileUpload {
  file: File;
  type: 'certificate' | 'brochure' | 'document';
}

export interface OCRResult {
  extractedName?: string;
  extractedCourse?: string;
  extractedDate?: string;
  confidence: number;
}
