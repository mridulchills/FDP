import { dbManager } from './database.js';
import { logger } from './logger.js';
import { DataValidator } from './data-validator.js';

export interface VerificationResult {
  success: boolean;
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    integrityIssues: number;
  };
  details: {
    recordCounts: {
      users: number;
      departments: number;
      submissions: number;
      notifications: number;
    };
    integrityChecks: {
      orphanedSubmissions: number;
      orphanedNotifications: number;
      orphanedUsers: number;
      invalidDepartmentHods: number;
    };
    dataQualityIssues: {
      usersWithoutDepartments: number;
      departmentsWithoutHods: number;
      submissionsWithoutDocuments: number;
      duplicateEmployeeIds: number;
      duplicateEmails: number;
    };
  };
  errors: string[];
  warnings: string[];
}

export class MigrationVerifier {
  private validator: DataValidator;

  constructor() {
    this.validator = new DataValidator();
  }

  /**
   * Perform comprehensive verification of migrated data
   */
  public async verifyMigration(): Promise<VerificationResult> {
    logger.info('Starting migration verification');

    const result: VerificationResult = {
      success: false,
      summary: {
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        integrityIssues: 0
      },
      details: {
        recordCounts: {
          users: 0,
          departments: 0,
          submissions: 0,
          notifications: 0
        },
        integrityChecks: {
          orphanedSubmissions: 0,
          orphanedNotifications: 0,
          orphanedUsers: 0,
          invalidDepartmentHods: 0
        },
        dataQualityIssues: {
          usersWithoutDepartments: 0,
          departmentsWithoutHods: 0,
          submissionsWithoutDocuments: 0,
          duplicateEmployeeIds: 0,
          duplicateEmails: 0
        }
      },
      errors: [],
      warnings: []
    };

    try {
      const connection = await dbManager.getConnection();

      try {
        // 1. Verify record counts
        await this.verifyRecordCounts(connection, result);

        // 2. Verify referential integrity
        await this.verifyReferentialIntegrity(connection, result);

        // 3. Verify data quality
        await this.verifyDataQuality(connection, result);

        // 4. Verify data validation
        await this.verifyDataValidation(connection, result);

        // Calculate summary
        result.summary.totalRecords = Object.values(result.details.recordCounts).reduce((sum, count) => sum + count, 0);
        result.summary.integrityIssues = Object.values(result.details.integrityChecks).reduce((sum, count) => sum + count, 0);
        result.summary.invalidRecords = result.errors.length;
        result.summary.validRecords = result.summary.totalRecords - result.summary.invalidRecords;

        result.success = result.errors.length === 0 && result.summary.integrityIssues === 0;

        logger.info('Migration verification completed', {
          success: result.success,
          totalRecords: result.summary.totalRecords,
          errors: result.errors.length,
          warnings: result.warnings.length,
          integrityIssues: result.summary.integrityIssues
        });

      } finally {
        await dbManager.releaseConnection(connection);
      }

      return result;
    } catch (error) {
      const errorMsg = `Migration verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      logger.error('Migration verification failed', error);
      return result;
    }
  }

  private async verifyRecordCounts(connection: any, result: VerificationResult): Promise<void> {
    try {
      // Count records in each table
      const userCount = await connection.get('SELECT COUNT(*) as count FROM users');
      const deptCount = await connection.get('SELECT COUNT(*) as count FROM departments');
      const submissionCount = await connection.get('SELECT COUNT(*) as count FROM submissions');
      const notificationCount = await connection.get('SELECT COUNT(*) as count FROM notifications');

      result.details.recordCounts = {
        users: userCount?.count || 0,
        departments: deptCount?.count || 0,
        submissions: submissionCount?.count || 0,
        notifications: notificationCount?.count || 0
      };

      // Verify minimum expected records
      if (result.details.recordCounts.users === 0) {
        result.errors.push('No users found in database');
      }

      if (result.details.recordCounts.departments === 0) {
        result.warnings.push('No departments found in database');
      }

      logger.debug('Record counts verified', result.details.recordCounts);
    } catch (error) {
      result.errors.push(`Failed to verify record counts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async verifyReferentialIntegrity(connection: any, result: VerificationResult): Promise<void> {
    try {
      // Check for orphaned submissions (submissions without valid users)
      const orphanedSubmissions = await connection.get(`
        SELECT COUNT(*) as count FROM submissions s 
        LEFT JOIN users u ON s.user_id = u.id 
        WHERE u.id IS NULL
      `);
      result.details.integrityChecks.orphanedSubmissions = orphanedSubmissions?.count || 0;

      // Check for orphaned notifications (notifications without valid users)
      const orphanedNotifications = await connection.get(`
        SELECT COUNT(*) as count FROM notifications n 
        LEFT JOIN users u ON n.user_id = u.id 
        WHERE u.id IS NULL
      `);
      result.details.integrityChecks.orphanedNotifications = orphanedNotifications?.count || 0;

      // Check for orphaned users (users with invalid department references)
      const orphanedUsers = await connection.get(`
        SELECT COUNT(*) as count FROM users u 
        LEFT JOIN departments d ON u.department_id = d.id 
        WHERE u.department_id IS NOT NULL AND d.id IS NULL
      `);
      result.details.integrityChecks.orphanedUsers = orphanedUsers?.count || 0;

      // Check for invalid department HOD references
      const invalidDepartmentHods = await connection.get(`
        SELECT COUNT(*) as count FROM departments d 
        LEFT JOIN users u ON d.hod_user_id = u.id 
        WHERE d.hod_user_id IS NOT NULL AND u.id IS NULL
      `);
      result.details.integrityChecks.invalidDepartmentHods = invalidDepartmentHods?.count || 0;

      // Add errors for integrity issues
      if (result.details.integrityChecks.orphanedSubmissions > 0) {
        result.errors.push(`Found ${result.details.integrityChecks.orphanedSubmissions} submissions with invalid user references`);
      }

      if (result.details.integrityChecks.orphanedNotifications > 0) {
        result.errors.push(`Found ${result.details.integrityChecks.orphanedNotifications} notifications with invalid user references`);
      }

      if (result.details.integrityChecks.orphanedUsers > 0) {
        result.errors.push(`Found ${result.details.integrityChecks.orphanedUsers} users with invalid department references`);
      }

      if (result.details.integrityChecks.invalidDepartmentHods > 0) {
        result.errors.push(`Found ${result.details.integrityChecks.invalidDepartmentHods} departments with invalid HOD references`);
      }

      logger.debug('Referential integrity verified', result.details.integrityChecks);
    } catch (error) {
      result.errors.push(`Failed to verify referential integrity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async verifyDataQuality(connection: any, result: VerificationResult): Promise<void> {
    try {
      // Check for users without departments
      const usersWithoutDepartments = await connection.get(`
        SELECT COUNT(*) as count FROM users 
        WHERE department_id IS NULL
      `);
      result.details.dataQualityIssues.usersWithoutDepartments = usersWithoutDepartments?.count || 0;

      // Check for departments without HODs
      const departmentsWithoutHods = await connection.get(`
        SELECT COUNT(*) as count FROM departments 
        WHERE hod_user_id IS NULL
      `);
      result.details.dataQualityIssues.departmentsWithoutHods = departmentsWithoutHods?.count || 0;

      // Check for submissions without documents
      const submissionsWithoutDocuments = await connection.get(`
        SELECT COUNT(*) as count FROM submissions 
        WHERE document_url IS NULL OR document_url = ''
      `);
      result.details.dataQualityIssues.submissionsWithoutDocuments = submissionsWithoutDocuments?.count || 0;

      // Check for duplicate employee IDs
      const duplicateEmployeeIds = await connection.get(`
        SELECT COUNT(*) - COUNT(DISTINCT employee_id) as count FROM users
      `);
      result.details.dataQualityIssues.duplicateEmployeeIds = duplicateEmployeeIds?.count || 0;

      // Check for duplicate emails
      const duplicateEmails = await connection.get(`
        SELECT COUNT(*) - COUNT(DISTINCT email) as count FROM users
      `);
      result.details.dataQualityIssues.duplicateEmails = duplicateEmails?.count || 0;

      // Add warnings for data quality issues
      if (result.details.dataQualityIssues.usersWithoutDepartments > 0) {
        result.warnings.push(`Found ${result.details.dataQualityIssues.usersWithoutDepartments} users without department assignments`);
      }

      if (result.details.dataQualityIssues.departmentsWithoutHods > 0) {
        result.warnings.push(`Found ${result.details.dataQualityIssues.departmentsWithoutHods} departments without HOD assignments`);
      }

      if (result.details.dataQualityIssues.submissionsWithoutDocuments > 0) {
        result.warnings.push(`Found ${result.details.dataQualityIssues.submissionsWithoutDocuments} submissions without document attachments`);
      }

      // Add errors for critical data quality issues
      if (result.details.dataQualityIssues.duplicateEmployeeIds > 0) {
        result.errors.push(`Found ${result.details.dataQualityIssues.duplicateEmployeeIds} duplicate employee IDs`);
      }

      if (result.details.dataQualityIssues.duplicateEmails > 0) {
        result.errors.push(`Found ${result.details.dataQualityIssues.duplicateEmails} duplicate email addresses`);
      }

      logger.debug('Data quality verified', result.details.dataQualityIssues);
    } catch (error) {
      result.errors.push(`Failed to verify data quality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async verifyDataValidation(connection: any, result: VerificationResult): Promise<void> {
    try {
      // Fetch sample data for validation
      const users = await connection.all('SELECT * FROM users LIMIT 100');
      const departments = await connection.all('SELECT * FROM departments LIMIT 100');
      const submissions = await connection.all('SELECT * FROM submissions LIMIT 100');
      const notifications = await connection.all('SELECT * FROM notifications LIMIT 100');

      // Validate data using the data validator
      const validationResult = this.validator.validateComplete(users, departments, submissions, notifications);

      // Add validation errors and warnings
      validationResult.errors.forEach(error => {
        result.errors.push(`Validation error in ${error.entity}: ${error.message}`);
      });

      validationResult.warnings.forEach(warning => {
        result.warnings.push(`Validation warning in ${warning.entity}: ${warning.message}`);
      });

      logger.debug('Data validation completed', {
        sampleSize: users.length + departments.length + submissions.length + notifications.length,
        validationErrors: validationResult.errors.length,
        validationWarnings: validationResult.warnings.length
      });
    } catch (error) {
      result.errors.push(`Failed to perform data validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a detailed verification report
   */
  public static formatVerificationReport(result: VerificationResult): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push('MIGRATION VERIFICATION REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    
    // Summary
    lines.push('SUMMARY:');
    lines.push(`  Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    lines.push(`  Total Records: ${result.summary.totalRecords}`);
    lines.push(`  Valid Records: ${result.summary.validRecords}`);
    lines.push(`  Invalid Records: ${result.summary.invalidRecords}`);
    lines.push(`  Integrity Issues: ${result.summary.integrityIssues}`);
    lines.push('');
    
    // Record Counts
    lines.push('RECORD COUNTS:');
    lines.push(`  Users: ${result.details.recordCounts.users}`);
    lines.push(`  Departments: ${result.details.recordCounts.departments}`);
    lines.push(`  Submissions: ${result.details.recordCounts.submissions}`);
    lines.push(`  Notifications: ${result.details.recordCounts.notifications}`);
    lines.push('');
    
    // Integrity Checks
    lines.push('REFERENTIAL INTEGRITY:');
    lines.push(`  Orphaned Submissions: ${result.details.integrityChecks.orphanedSubmissions}`);
    lines.push(`  Orphaned Notifications: ${result.details.integrityChecks.orphanedNotifications}`);
    lines.push(`  Orphaned Users: ${result.details.integrityChecks.orphanedUsers}`);
    lines.push(`  Invalid Department HODs: ${result.details.integrityChecks.invalidDepartmentHods}`);
    lines.push('');
    
    // Data Quality
    lines.push('DATA QUALITY:');
    lines.push(`  Users without Departments: ${result.details.dataQualityIssues.usersWithoutDepartments}`);
    lines.push(`  Departments without HODs: ${result.details.dataQualityIssues.departmentsWithoutHods}`);
    lines.push(`  Submissions without Documents: ${result.details.dataQualityIssues.submissionsWithoutDocuments}`);
    lines.push(`  Duplicate Employee IDs: ${result.details.dataQualityIssues.duplicateEmployeeIds}`);
    lines.push(`  Duplicate Emails: ${result.details.dataQualityIssues.duplicateEmails}`);
    lines.push('');
    
    // Errors
    if (result.errors.length > 0) {
      lines.push('ERRORS:');
      result.errors.forEach((error, index) => {
        lines.push(`  ${index + 1}. ${error}`);
      });
      lines.push('');
    }
    
    // Warnings
    if (result.warnings.length > 0) {
      lines.push('WARNINGS:');
      result.warnings.forEach((warning, index) => {
        lines.push(`  ${index + 1}. ${warning}`);
      });
      lines.push('');
    }
    
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Quick verification for basic checks
   */
  public async quickVerify(): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await dbManager.getConnection();
      
      try {
        // Check if tables exist and have data
        const userCount = await connection.get('SELECT COUNT(*) as count FROM users');
        const deptCount = await connection.get('SELECT COUNT(*) as count FROM departments');
        
        if (!userCount || userCount.count === 0) {
          return { success: false, message: 'No users found in database' };
        }
        
        if (!deptCount || deptCount.count === 0) {
          return { success: false, message: 'No departments found in database' };
        }
        
        // Check for basic integrity
        const orphanedSubmissions = await connection.get(`
          SELECT COUNT(*) as count FROM submissions s 
          LEFT JOIN users u ON s.user_id = u.id 
          WHERE u.id IS NULL
        `);
        
        if (orphanedSubmissions && orphanedSubmissions.count > 0) {
          return { success: false, message: `Found ${orphanedSubmissions.count} submissions with invalid user references` };
        }
        
        return { 
          success: true, 
          message: `Migration verified: ${userCount.count} users, ${deptCount.count} departments` 
        };
      } finally {
        await dbManager.releaseConnection(connection);
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}