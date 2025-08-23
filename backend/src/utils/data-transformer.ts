import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';

export interface SupabaseUser {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  department_id?: string;
  designation?: string;
  institution?: string;
  created_at: string;
  updated_at?: string;
  // Supabase auth fields that need transformation
  auth_id?: string;
  encrypted_password?: string;
  password_hash?: string;
}

export interface SQLiteUser {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: 'faculty' | 'hod' | 'admin';
  department_id?: string | null;
  designation?: string | null;
  institution?: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseDepartment {
  id: string;
  name: string;
  code?: string;
  hod_user_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface SQLiteDepartment {
  id: string;
  name: string;
  code?: string | null;
  hod_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseSubmission {
  id: string;
  user_id: string;
  module_type: string;
  status: string;
  form_data: any;
  document_url?: string;
  hod_comment?: string;
  admin_comment?: string;
  created_at: string;
  updated_at?: string;
}

export interface SQLiteSubmission {
  id: string;
  user_id: string;
  module_type: 'attended' | 'organized' | 'certification';
  status: 'pending' | 'approved' | 'rejected';
  form_data: string; // JSON string in SQLite
  document_url?: string | null;
  hod_comment?: string | null;
  admin_comment?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseNotification {
  id: string;
  user_id: string;
  message: string;
  link?: string;
  read_flag: boolean;
  created_at: string;
}

export interface SQLiteNotification {
  id: string;
  user_id: string;
  message: string;
  link?: string | null;
  read_flag: number; // SQLite uses integers for booleans
  created_at: string;
}

export interface TransformationResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  skipped: number;
}

export class DataTransformer {
  private static readonly DEFAULT_PASSWORD_HASH = '$2b$12$defaulthashformigratedusers.placeholder.hash';
  
  static transformUsers(supabaseUsers: SupabaseUser[]): TransformationResult<SQLiteUser> {
    const result: TransformationResult<SQLiteUser> = {
      success: true,
      data: [],
      errors: [],
      skipped: 0
    };

    for (let i = 0; i < supabaseUsers.length; i++) {
      const user = supabaseUsers[i];
      
      try {
        // Skip if user is null/undefined
        if (!user) {
          result.errors.push(`User at index ${i}: User data is null or undefined`);
          result.skipped++;
          continue;
        }

        // Validate required fields
        if (!user.id || !user.employee_id || !user.email || !user.name) {
          result.errors.push(`User at index ${i}: Missing required fields`);
          result.skipped++;
          continue;
        }

        // Validate and normalize role
        const normalizedRole = this.normalizeRole(user.role);
        if (!normalizedRole) {
          result.errors.push(`User at index ${i}: Invalid role '${user.role}'`);
          result.skipped++;
          continue;
        }

        // Transform user data
        const transformedUser: SQLiteUser = {
          id: user.id,
          employee_id: user.employee_id,
          name: user.name.trim(),
          email: user.email.toLowerCase().trim(),
          role: normalizedRole,
          department_id: user.department_id || null,
          designation: user.designation?.trim() || null,
          institution: user.institution?.trim() || null,
          password_hash: user.password_hash || this.DEFAULT_PASSWORD_HASH,
          created_at: this.normalizeTimestamp(user.created_at),
          updated_at: this.normalizeTimestamp(user.updated_at || user.created_at)
        };

        result.data.push(transformedUser);
      } catch (error) {
        result.errors.push(`User at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.skipped++;
      }
    }

    result.success = result.errors.length === 0;
    logger.info(`Transformed ${result.data.length} users, skipped ${result.skipped}, errors: ${result.errors.length}`);
    
    return result;
  }

  static transformDepartments(supabaseDepartments: SupabaseDepartment[]): TransformationResult<SQLiteDepartment> {
    const result: TransformationResult<SQLiteDepartment> = {
      success: true,
      data: [],
      errors: [],
      skipped: 0
    };

    for (let i = 0; i < supabaseDepartments.length; i++) {
      const dept = supabaseDepartments[i];
      
      try {
        // Skip if department is null/undefined
        if (!dept) {
          result.errors.push(`Department at index ${i}: Department data is null or undefined`);
          result.skipped++;
          continue;
        }

        // Validate required fields
        if (!dept.id || !dept.name) {
          result.errors.push(`Department at index ${i}: Missing required fields`);
          result.skipped++;
          continue;
        }

        // Transform department data
        const transformedDept: SQLiteDepartment = {
          id: dept.id,
          name: dept.name.trim(),
          code: dept.code?.trim() || null,
          hod_user_id: dept.hod_user_id || null,
          created_at: this.normalizeTimestamp(dept.created_at),
          updated_at: this.normalizeTimestamp(dept.updated_at || dept.created_at)
        };

        result.data.push(transformedDept);
      } catch (error) {
        result.errors.push(`Department at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.skipped++;
      }
    }

    result.success = result.errors.length === 0;
    logger.info(`Transformed ${result.data.length} departments, skipped ${result.skipped}, errors: ${result.errors.length}`);
    
    return result;
  }

  static transformSubmissions(supabaseSubmissions: SupabaseSubmission[]): TransformationResult<SQLiteSubmission> {
    const result: TransformationResult<SQLiteSubmission> = {
      success: true,
      data: [],
      errors: [],
      skipped: 0
    };

    for (let i = 0; i < supabaseSubmissions.length; i++) {
      const submission = supabaseSubmissions[i];
      
      try {
        // Skip if submission is null/undefined
        if (!submission) {
          result.errors.push(`Submission at index ${i}: Submission data is null or undefined`);
          result.skipped++;
          continue;
        }

        // Validate required fields
        if (!submission.id || !submission.user_id) {
          result.errors.push(`Submission at index ${i}: Missing required fields`);
          result.skipped++;
          continue;
        }

        // Validate and normalize module type
        const normalizedModuleType = this.normalizeModuleType(submission.module_type);
        if (!normalizedModuleType) {
          result.errors.push(`Submission at index ${i}: Invalid module_type '${submission.module_type}'`);
          result.skipped++;
          continue;
        }

        // Validate and normalize status
        const normalizedStatus = this.normalizeStatus(submission.status);
        if (!normalizedStatus) {
          result.errors.push(`Submission at index ${i}: Invalid status '${submission.status}'`);
          result.skipped++;
          continue;
        }

        // Transform submission data
        const transformedSubmission: SQLiteSubmission = {
          id: submission.id,
          user_id: submission.user_id,
          module_type: normalizedModuleType,
          status: normalizedStatus,
          form_data: JSON.stringify(submission.form_data || {}),
          document_url: submission.document_url || null,
          hod_comment: submission.hod_comment?.trim() || null,
          admin_comment: submission.admin_comment?.trim() || null,
          created_at: this.normalizeTimestamp(submission.created_at),
          updated_at: this.normalizeTimestamp(submission.updated_at || submission.created_at)
        };

        result.data.push(transformedSubmission);
      } catch (error) {
        result.errors.push(`Submission at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.skipped++;
      }
    }

    result.success = result.errors.length === 0;
    logger.info(`Transformed ${result.data.length} submissions, skipped ${result.skipped}, errors: ${result.errors.length}`);
    
    return result;
  }

  static transformNotifications(supabaseNotifications: SupabaseNotification[]): TransformationResult<SQLiteNotification> {
    const result: TransformationResult<SQLiteNotification> = {
      success: true,
      data: [],
      errors: [],
      skipped: 0
    };

    for (let i = 0; i < supabaseNotifications.length; i++) {
      const notification = supabaseNotifications[i];
      
      try {
        // Skip if notification is null/undefined
        if (!notification) {
          result.errors.push(`Notification at index ${i}: Notification data is null or undefined`);
          result.skipped++;
          continue;
        }

        // Validate required fields
        if (!notification.id || !notification.user_id || !notification.message) {
          result.errors.push(`Notification at index ${i}: Missing required fields`);
          result.skipped++;
          continue;
        }

        // Transform notification data
        const transformedNotification: SQLiteNotification = {
          id: notification.id,
          user_id: notification.user_id,
          message: notification.message.trim(),
          link: notification.link?.trim() || null,
          read_flag: notification.read_flag ? 1 : 0, // Convert boolean to integer
          created_at: this.normalizeTimestamp(notification.created_at)
        };

        result.data.push(transformedNotification);
      } catch (error) {
        result.errors.push(`Notification at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.skipped++;
      }
    }

    result.success = result.errors.length === 0;
    logger.info(`Transformed ${result.data.length} notifications, skipped ${result.skipped}, errors: ${result.errors.length}`);
    
    return result;
  }

  private static normalizeRole(role: string): 'faculty' | 'hod' | 'admin' | null {
    if (!role) return null;
    
    const normalized = role.toLowerCase().trim();
    switch (normalized) {
      case 'faculty':
      case 'teacher':
      case 'professor':
      case 'lecturer':
        return 'faculty';
      case 'hod':
      case 'head':
      case 'department_head':
        return 'hod';
      case 'admin':
      case 'administrator':
      case 'system_admin':
        return 'admin';
      default:
        return null;
    }
  }

  private static normalizeModuleType(moduleType: string): 'attended' | 'organized' | 'certification' | null {
    if (!moduleType) return null;
    
    const normalized = moduleType.toLowerCase().trim();
    switch (normalized) {
      case 'attended':
      case 'attend':
      case 'participation':
        return 'attended';
      case 'organized':
      case 'organize':
      case 'conducted':
        return 'organized';
      case 'certification':
      case 'certificate':
      case 'certified':
        return 'certification';
      default:
        return null;
    }
  }

  private static normalizeStatus(status: string): 'pending' | 'approved' | 'rejected' | null {
    if (!status) return null;
    
    const normalized = status.toLowerCase().trim();
    switch (normalized) {
      case 'pending':
      case 'submitted':
      case 'under_review':
        return 'pending';
      case 'approved':
      case 'accepted':
      case 'verified':
        return 'approved';
      case 'rejected':
      case 'declined':
      case 'denied':
        return 'rejected';
      default:
        return null;
    }
  }

  private static normalizeTimestamp(timestamp: string | undefined): string {
    if (!timestamp) {
      return new Date().toISOString();
    }
    
    try {
      // Ensure the timestamp is in ISO format
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date.toISOString();
    } catch (error) {
      logger.warn(`Invalid timestamp '${timestamp}', using current time`);
      return new Date().toISOString();
    }
  }

  static generateMissingIds(data: any[]): any[] {
    return data.map(item => {
      if (!item.id) {
        item.id = uuidv4();
      }
      return item;
    });
  }

  static validateReferentialIntegrity(
    users: SQLiteUser[],
    departments: SQLiteDepartment[],
    submissions: SQLiteSubmission[],
    notifications: SQLiteNotification[]
  ): string[] {
    const errors: string[] = [];
    
    const userIds = new Set(users.map(u => u.id));
    const departmentIds = new Set(departments.map(d => d.id));

    // Check user department references
    users.forEach((user, index) => {
      if (user.department_id && !departmentIds.has(user.department_id)) {
        errors.push(`User '${user.name}' (index ${index}) references non-existent department_id: ${user.department_id}`);
      }
    });

    // Check department HOD references
    departments.forEach((dept, index) => {
      if (dept.hod_user_id && !userIds.has(dept.hod_user_id)) {
        errors.push(`Department '${dept.name}' (index ${index}) references non-existent hod_user_id: ${dept.hod_user_id}`);
      }
    });

    // Check submission user references
    submissions.forEach((submission, index) => {
      if (!userIds.has(submission.user_id)) {
        errors.push(`Submission (index ${index}) references non-existent user_id: ${submission.user_id}`);
      }
    });

    // Check notification user references
    notifications.forEach((notification, index) => {
      if (!userIds.has(notification.user_id)) {
        errors.push(`Notification (index ${index}) references non-existent user_id: ${notification.user_id}`);
      }
    });

    return errors;
  }
}