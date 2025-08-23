import { z } from 'zod';
import { logger } from './logger.js';

// Zod schemas for validation
const UserSchema = z.object({
  id: z.string().uuid('User ID must be a valid UUID'),
  employee_id: z.string().min(1, 'Employee ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  role: z.enum(['faculty', 'hod', 'admin'], { errorMap: () => ({ message: 'Role must be faculty, hod, or admin' }) }),
  department_id: z.string().uuid().optional().nullable(),
  designation: z.string().optional().nullable(),
  institution: z.string().optional().nullable(),
  password_hash: z.string().min(1, 'Password hash is required'),
  created_at: z.string().datetime('Invalid created_at timestamp'),
  updated_at: z.string().datetime('Invalid updated_at timestamp')
});

const DepartmentSchema = z.object({
  id: z.string().uuid('Department ID must be a valid UUID'),
  name: z.string().min(1, 'Department name is required'),
  code: z.string().optional().nullable(),
  hod_user_id: z.string().uuid().optional().nullable(),
  created_at: z.string().datetime('Invalid created_at timestamp'),
  updated_at: z.string().datetime('Invalid updated_at timestamp')
});

const SubmissionSchema = z.object({
  id: z.string().uuid('Submission ID must be a valid UUID'),
  user_id: z.string().uuid('User ID must be a valid UUID'),
  module_type: z.enum(['attended', 'organized', 'certification'], { 
    errorMap: () => ({ message: 'Module type must be attended, organized, or certification' }) 
  }),
  status: z.enum(['pending', 'approved', 'rejected'], { 
    errorMap: () => ({ message: 'Status must be pending, approved, or rejected' }) 
  }),
  form_data: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Form data must be valid JSON string'),
  document_url: z.string().optional().nullable(),
  hod_comment: z.string().optional().nullable(),
  admin_comment: z.string().optional().nullable(),
  created_at: z.string().datetime('Invalid created_at timestamp'),
  updated_at: z.string().datetime('Invalid updated_at timestamp')
});

const NotificationSchema = z.object({
  id: z.string().uuid('Notification ID must be a valid UUID'),
  user_id: z.string().uuid('User ID must be a valid UUID'),
  message: z.string().min(1, 'Message is required'),
  link: z.string().optional().nullable(),
  read_flag: z.number().int().min(0).max(1, 'Read flag must be 0 or 1'),
  created_at: z.string().datetime('Invalid created_at timestamp')
});

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    warningCount: number;
  };
}

export interface ValidationError {
  type: 'schema' | 'integrity' | 'business';
  entity: string;
  index?: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  type: 'data_quality' | 'performance' | 'compatibility';
  entity: string;
  message: string;
}

export class DataValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];

  validateUsers(users: any[]): ValidationResult {
    logger.info(`Validating ${users.length} users`);
    
    const validUsers: any[] = [];
    const employeeIds = new Set<string>();
    const emails = new Set<string>();

    users.forEach((user, index) => {
      // Schema validation
      const result = UserSchema.safeParse(user);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          this.errors.push({
            type: 'schema',
            entity: 'user',
            index,
            field: issue.path.join('.'),
            message: issue.message,
            severity: 'error'
          });
        });
        return;
      }

      // Business rule validation
      const validUser = result.data;

      // Check for duplicate employee IDs
      if (employeeIds.has(validUser.employee_id)) {
        this.errors.push({
          type: 'business',
          entity: 'user',
          index,
          field: 'employee_id',
          message: `Duplicate employee ID: ${validUser.employee_id}`,
          severity: 'error'
        });
      } else {
        employeeIds.add(validUser.employee_id);
      }

      // Check for duplicate emails
      if (emails.has(validUser.email)) {
        this.errors.push({
          type: 'business',
          entity: 'user',
          index,
          field: 'email',
          message: `Duplicate email: ${validUser.email}`,
          severity: 'error'
        });
      } else {
        emails.add(validUser.email);
      }

      // Data quality warnings
      if (!validUser.designation) {
        this.warnings.push({
          type: 'data_quality',
          entity: 'user',
          message: `User ${validUser.name} (index ${index}) has no designation`
        });
      }

      if (!validUser.institution) {
        this.warnings.push({
          type: 'data_quality',
          entity: 'user',
          message: `User ${validUser.name} (index ${index}) has no institution`
        });
      }

      validUsers.push(validUser);
    });

    return this.createValidationResult('users', users.length, validUsers.length);
  }

  validateDepartments(departments: any[]): ValidationResult {
    logger.info(`Validating ${departments.length} departments`);
    
    const validDepartments: any[] = [];
    const departmentNames = new Set<string>();
    const departmentCodes = new Set<string>();

    departments.forEach((dept, index) => {
      // Schema validation
      const result = DepartmentSchema.safeParse(dept);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          this.errors.push({
            type: 'schema',
            entity: 'department',
            index,
            field: issue.path.join('.'),
            message: issue.message,
            severity: 'error'
          });
        });
        return;
      }

      const validDept = result.data;

      // Check for duplicate department names
      if (departmentNames.has(validDept.name)) {
        this.errors.push({
          type: 'business',
          entity: 'department',
          index,
          field: 'name',
          message: `Duplicate department name: ${validDept.name}`,
          severity: 'error'
        });
      } else {
        departmentNames.add(validDept.name);
      }

      // Check for duplicate department codes
      if (validDept.code) {
        if (departmentCodes.has(validDept.code)) {
          this.errors.push({
            type: 'business',
            entity: 'department',
            index,
            field: 'code',
            message: `Duplicate department code: ${validDept.code}`,
            severity: 'error'
          });
        } else {
          departmentCodes.add(validDept.code);
        }
      }

      validDepartments.push(validDept);
    });

    return this.createValidationResult('departments', departments.length, validDepartments.length);
  }

  validateSubmissions(submissions: any[]): ValidationResult {
    logger.info(`Validating ${submissions.length} submissions`);
    
    const validSubmissions: any[] = [];

    submissions.forEach((submission, index) => {
      // Schema validation
      const result = SubmissionSchema.safeParse(submission);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          this.errors.push({
            type: 'schema',
            entity: 'submission',
            index,
            field: issue.path.join('.'),
            message: issue.message,
            severity: 'error'
          });
        });
        return;
      }

      const validSubmission = result.data;

      // Validate form_data JSON structure
      try {
        const formData = JSON.parse(validSubmission.form_data);
        
        // Basic form data validation
        if (typeof formData !== 'object' || formData === null) {
          this.warnings.push({
            type: 'data_quality',
            entity: 'submission',
            message: `Submission at index ${index} has invalid form_data structure`
          });
        }
      } catch (error) {
        this.errors.push({
          type: 'schema',
          entity: 'submission',
          index,
          field: 'form_data',
          message: 'Invalid JSON in form_data',
          severity: 'error'
        });
        return;
      }

      // Business rule validation
      if (validSubmission.status === 'approved' && !validSubmission.hod_comment && !validSubmission.admin_comment) {
        this.warnings.push({
          type: 'data_quality',
          entity: 'submission',
          message: `Approved submission at index ${index} has no approval comment`
        });
      }

      if (validSubmission.status === 'rejected' && !validSubmission.hod_comment && !validSubmission.admin_comment) {
        this.warnings.push({
          type: 'data_quality',
          entity: 'submission',
          message: `Rejected submission at index ${index} has no rejection comment`
        });
      }

      validSubmissions.push(validSubmission);
    });

    return this.createValidationResult('submissions', submissions.length, validSubmissions.length);
  }

  validateNotifications(notifications: any[]): ValidationResult {
    logger.info(`Validating ${notifications.length} notifications`);
    
    const validNotifications: any[] = [];

    notifications.forEach((notification, index) => {
      // Schema validation
      const result = NotificationSchema.safeParse(notification);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          this.errors.push({
            type: 'schema',
            entity: 'notification',
            index,
            field: issue.path.join('.'),
            message: issue.message,
            severity: 'error'
          });
        });
        return;
      }

      validNotifications.push(result.data);
    });

    return this.createValidationResult('notifications', notifications.length, validNotifications.length);
  }

  validateReferentialIntegrity(users: any[], departments: any[], submissions: any[], notifications: any[]): ValidationResult {
    logger.info('Validating referential integrity');
    
    const userIds = new Set(users.map(u => u.id));
    const departmentIds = new Set(departments.map(d => d.id));

    // Validate user department references
    users.forEach((user, index) => {
      if (user.department_id && !departmentIds.has(user.department_id)) {
        this.errors.push({
          type: 'integrity',
          entity: 'user',
          index,
          field: 'department_id',
          message: `References non-existent department: ${user.department_id}`,
          severity: 'error'
        });
      }
    });

    // Validate department HOD references
    departments.forEach((dept, index) => {
      if (dept.hod_user_id && !userIds.has(dept.hod_user_id)) {
        this.errors.push({
          type: 'integrity',
          entity: 'department',
          index,
          field: 'hod_user_id',
          message: `References non-existent user: ${dept.hod_user_id}`,
          severity: 'error'
        });
      }
    });

    // Validate submission user references
    submissions.forEach((submission, index) => {
      if (!userIds.has(submission.user_id)) {
        this.errors.push({
          type: 'integrity',
          entity: 'submission',
          index,
          field: 'user_id',
          message: `References non-existent user: ${submission.user_id}`,
          severity: 'error'
        });
      }
    });

    // Validate notification user references
    notifications.forEach((notification, index) => {
      if (!userIds.has(notification.user_id)) {
        this.errors.push({
          type: 'integrity',
          entity: 'notification',
          index,
          field: 'user_id',
          message: `References non-existent user: ${notification.user_id}`,
          severity: 'error'
        });
      }
    });

    const totalRecords = users.length + departments.length + submissions.length + notifications.length;
    const errorCount = this.errors.filter(e => e.type === 'integrity').length;
    
    return this.createValidationResult('referential_integrity', totalRecords, totalRecords - errorCount);
  }

  validateComplete(users: any[], departments: any[], submissions: any[], notifications: any[]): ValidationResult {
    // Reset errors and warnings
    this.errors = [];
    this.warnings = [];

    // Validate each entity type
    this.validateUsers(users);
    this.validateDepartments(departments);
    this.validateSubmissions(submissions);
    this.validateNotifications(notifications);
    this.validateReferentialIntegrity(users, departments, submissions, notifications);

    const totalRecords = users.length + departments.length + submissions.length + notifications.length;
    const errorCount = this.errors.length;
    
    const result = {
      isValid: errorCount === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        totalRecords,
        validRecords: totalRecords - errorCount,
        invalidRecords: errorCount,
        warningCount: this.warnings.length
      }
    };

    logger.info(`Validation complete: ${result.summary.validRecords}/${totalRecords} valid records, ${errorCount} errors, ${this.warnings.length} warnings`);
    
    return result;
  }

  private createValidationResult(entity: string, total: number, valid: number): ValidationResult {
    const invalid = total - valid;
    
    return {
      isValid: invalid === 0,
      errors: this.errors.filter(e => e.entity === entity),
      warnings: this.warnings.filter(w => w.entity === entity),
      summary: {
        totalRecords: total,
        validRecords: valid,
        invalidRecords: invalid,
        warningCount: this.warnings.filter(w => w.entity === entity).length
      }
    };
  }

  static formatValidationReport(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push('DATA VALIDATION REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    
    // Summary
    lines.push('SUMMARY:');
    lines.push(`  Total Records: ${result.summary.totalRecords}`);
    lines.push(`  Valid Records: ${result.summary.validRecords}`);
    lines.push(`  Invalid Records: ${result.summary.invalidRecords}`);
    lines.push(`  Warnings: ${result.summary.warningCount}`);
    lines.push(`  Overall Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push('');
    
    // Errors
    if (result.errors.length > 0) {
      lines.push('ERRORS:');
      result.errors.forEach((error, index) => {
        lines.push(`  ${index + 1}. [${error.type.toUpperCase()}] ${error.entity}${error.index !== undefined ? `[${error.index}]` : ''}${error.field ? `.${error.field}` : ''}: ${error.message}`);
      });
      lines.push('');
    }
    
    // Warnings
    if (result.warnings.length > 0) {
      lines.push('WARNINGS:');
      result.warnings.forEach((warning, index) => {
        lines.push(`  ${index + 1}. [${warning.type.toUpperCase()}] ${warning.entity}: ${warning.message}`);
      });
      lines.push('');
    }
    
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }
}