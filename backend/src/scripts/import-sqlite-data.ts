#!/usr/bin/env tsx

import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { dbManager } from '../utils/database.js';
import { TransactionManager, TransactionContext } from '../utils/transaction-manager.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import { DataValidator } from '../utils/data-validator.js';
import { 
  SQLiteUser, 
  SQLiteDepartment, 
  SQLiteSubmission, 
  SQLiteNotification 
} from '../utils/data-transformer.js';

interface ImportData {
  users: SQLiteUser[];
  departments: SQLiteDepartment[];
  submissions: SQLiteSubmission[];
  notifications: SQLiteNotification[];
}

export interface ImportOptions {
  batchSize: number;
  skipDuplicates: boolean;
  validateData: boolean;
  createBackup: boolean;
  dryRun: boolean;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  duplicateRecords: number;
  errorRecords: number;
  errors: string[];
  warnings: string[];
  duration: number;
  backupFile?: string;
}

interface BatchImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

class SQLiteDataImporter {
  private progressTracker: ProgressTracker;
  private validator: DataValidator;
  private importStartTime: Date;
  private options: ImportOptions;

  constructor(options: Partial<ImportOptions> = {}) {
    this.options = {
      batchSize: 100,
      skipDuplicates: true,
      validateData: true,
      createBackup: true,
      dryRun: false,
      ...options
    };

    this.progressTracker = new ProgressTracker();
    this.validator = new DataValidator();
    this.importStartTime = new Date();
    
    this.setupProgressTracking();
  }

  private setupProgressTracking(): void {
    this.progressTracker.addSteps([
      { id: 'load_data', name: 'Load Import Data', description: 'Reading and parsing import files', weight: 1 },
      { id: 'validate_data', name: 'Validate Data', description: 'Validating data integrity and format', weight: 2 },
      { id: 'create_backup', name: 'Create Backup', description: 'Creating database backup before import', weight: 1 },
      { id: 'detect_duplicates', name: 'Detect Duplicates', description: 'Identifying duplicate records', weight: 2 },
      { id: 'import_departments', name: 'Import Departments', description: 'Importing department records', weight: 2 },
      { id: 'import_users', name: 'Import Users', description: 'Importing user records', weight: 3 },
      { id: 'import_submissions', name: 'Import Submissions', description: 'Importing submission records', weight: 3 },
      { id: 'import_notifications', name: 'Import Notifications', description: 'Importing notification records', weight: 2 },
      { id: 'verify_import', name: 'Verify Import', description: 'Verifying imported data integrity', weight: 2 },
      { id: 'cleanup', name: 'Cleanup', description: 'Cleaning up temporary resources', weight: 1 }
    ]);

    this.progressTracker.on('progress', () => {
      this.progressTracker.displayProgress();
    });
  }

  /**
   * Import data from a JSON file
   */
  public async importFromFile(filePath: string): Promise<ImportResult> {
    try {
      console.log('🚀 Starting SQLite data import...');
      logger.info('Starting SQLite data import', { filePath, options: this.options });

      // Load data from file
      const data = await this.loadDataFromFile(filePath);

      // Import the data
      const result = await this.importData(data);

      // Generate final report
      this.generateFinalReport(result);

      return result;
    } catch (error) {
      const errorMsg = `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.addError(errorMsg);
      console.error('❌ Import failed:', error);
      logger.error('Import failed', error);
      
      return {
        success: false,
        totalRecords: 0,
        importedRecords: 0,
        skippedRecords: 0,
        duplicateRecords: 0,
        errorRecords: 0,
        errors: [errorMsg],
        warnings: [],
        duration: Date.now() - this.importStartTime.getTime()
      };
    }
  }

  /**
   * Import data from an object
   */
  public async importData(data: ImportData): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      duplicateRecords: 0,
      errorRecords: 0,
      errors: [],
      warnings: [],
      duration: 0
    };

    try {
      // Calculate total records
      result.totalRecords = data.users.length + data.departments.length + 
                           data.submissions.length + data.notifications.length;

      // Validate data if requested
      if (this.options.validateData) {
        const isValid = await this.validateImportData(data);
        if (!isValid) {
          throw new Error('Data validation failed. Import aborted.');
        }
      }

      // Create backup if requested
      if (this.options.createBackup && !this.options.dryRun) {
        result.backupFile = await this.createBackup();
      }

      // Detect duplicates
      const duplicateInfo = await this.detectDuplicates(data);
      result.duplicateRecords = duplicateInfo.totalDuplicates;

      if (!this.options.dryRun) {
        // Import data in transaction
        await TransactionManager.execute(async (context) => {
          // Import in dependency order: departments -> users -> submissions -> notifications
          const deptResult = await this.importDepartmentsBatch(data.departments, context);
          const userResult = await this.importUsersBatch(data.users, context);
          const submissionResult = await this.importSubmissionsBatch(data.submissions, context);
          const notificationResult = await this.importNotificationsBatch(data.notifications, context);

          // Aggregate results
          result.importedRecords = deptResult.imported + userResult.imported + 
                                 submissionResult.imported + notificationResult.imported;
          result.skippedRecords = deptResult.skipped + userResult.skipped + 
                                submissionResult.skipped + notificationResult.skipped;
          result.errorRecords = deptResult.errors.length + userResult.errors.length + 
                              submissionResult.errors.length + notificationResult.errors.length;
          
          result.errors.push(
            ...deptResult.errors,
            ...userResult.errors,
            ...submissionResult.errors,
            ...notificationResult.errors
          );
        }, {
          timeout: 300000, // 5 minutes
          retryAttempts: 1
        });

        // Verify import
        await this.verifyImport(data, result);
      } else {
        console.log('🔍 Dry run completed - no data was actually imported');
        result.importedRecords = result.totalRecords - result.duplicateRecords;
      }

      // Cleanup
      await this.cleanup();

      result.success = result.errorRecords === 0;
      result.duration = Date.now() - this.importStartTime.getTime();
      result.warnings = this.progressTracker.getState().warnings;

      logger.info('Import completed', {
        success: result.success,
        totalRecords: result.totalRecords,
        importedRecords: result.importedRecords,
        errorRecords: result.errorRecords,
        duration: result.duration
      });

      return result;
    } catch (error) {
      const errorMsg = `Import execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      result.success = false;
      result.duration = Date.now() - this.importStartTime.getTime();
      
      logger.error('Import execution failed', error);
      throw error;
    }
  }

  private async loadDataFromFile(filePath: string): Promise<ImportData> {
    this.progressTracker.startStep('load_data');

    try {
      if (!existsSync(filePath)) {
        throw new Error(`Import file not found: ${filePath}`);
      }

      const fileContent = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent) as ImportData;

      // Validate structure
      if (!data.users || !data.departments || !data.submissions || !data.notifications) {
        throw new Error('Invalid import file structure. Missing required arrays.');
      }

      this.progressTracker.completeStep('load_data', {
        filePath,
        totalRecords: data.users.length + data.departments.length + 
                     data.submissions.length + data.notifications.length,
        users: data.users.length,
        departments: data.departments.length,
        submissions: data.submissions.length,
        notifications: data.notifications.length
      });

      logger.info('Import data loaded successfully', {
        filePath,
        users: data.users.length,
        departments: data.departments.length,
        submissions: data.submissions.length,
        notifications: data.notifications.length
      });

      return data;
    } catch (error) {
      const errorMsg = `Failed to load import data: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('load_data', errorMsg);
      throw error;
    }
  }

  private async validateImportData(data: ImportData): Promise<boolean> {
    this.progressTracker.startStep('validate_data');

    try {
      const validationResult = this.validator.validateComplete(
        data.users,
        data.departments,
        data.submissions,
        data.notifications
      );

      // Add validation errors and warnings to progress tracker
      validationResult.errors.forEach(error => {
        this.progressTracker.addError(`${error.entity}: ${error.message}`);
      });

      validationResult.warnings.forEach(warning => {
        this.progressTracker.addWarning(`${warning.entity}: ${warning.message}`);
      });

      this.progressTracker.completeStep('validate_data', {
        isValid: validationResult.isValid,
        totalRecords: validationResult.summary.totalRecords,
        validRecords: validationResult.summary.validRecords,
        errorCount: validationResult.summary.invalidRecords,
        warningCount: validationResult.summary.warningCount
      });

      logger.info('Data validation completed', {
        isValid: validationResult.isValid,
        validRecords: validationResult.summary.validRecords,
        totalRecords: validationResult.summary.totalRecords,
        errors: validationResult.summary.invalidRecords,
        warnings: validationResult.summary.warningCount
      });

      return validationResult.isValid;
    } catch (error) {
      const errorMsg = `Data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('validate_data', errorMsg);
      throw error;
    }
  }

  private async createBackup(): Promise<string> {
    this.progressTracker.startStep('create_backup');

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(process.cwd(), 'data', 'backups');
      const backupFile = path.join(backupDir, `database-backup-${timestamp}.db`);

      // Ensure backup directory exists
      const fs = await import('fs/promises');
      await fs.mkdir(backupDir, { recursive: true });

      // Create backup using SQLite backup API
      const connection = await dbManager.getMainConnection();
      await connection.exec(`VACUUM INTO '${backupFile}'`);

      this.progressTracker.completeStep('create_backup', {
        backupFile,
        timestamp
      });

      logger.info('Database backup created', { backupFile });
      console.log(`📦 Database backup created: ${backupFile}`);

      return backupFile;
    } catch (error) {
      const errorMsg = `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('create_backup', errorMsg);
      throw error;
    }
  }

  private async detectDuplicates(data: ImportData): Promise<{
    totalDuplicates: number;
    userDuplicates: string[];
    departmentDuplicates: string[];
    submissionDuplicates: string[];
    notificationDuplicates: string[];
  }> {
    this.progressTracker.startStep('detect_duplicates');

    try {
      const connection = await dbManager.getConnection();
      
      try {
        // Check for duplicate users (by employee_id and email)
        const userDuplicates: string[] = [];
        for (const user of data.users) {
          const existing = await connection.get(
            'SELECT id FROM users WHERE employee_id = ? OR email = ?',
            [user.employee_id, user.email]
          );
          if (existing) {
            userDuplicates.push(user.id);
          }
        }

        // Check for duplicate departments (by name)
        const departmentDuplicates: string[] = [];
        for (const dept of data.departments) {
          const existing = await connection.get(
            'SELECT id FROM departments WHERE name = ?',
            [dept.name]
          );
          if (existing) {
            departmentDuplicates.push(dept.id);
          }
        }

        // Check for duplicate submissions (by id)
        const submissionDuplicates: string[] = [];
        for (const submission of data.submissions) {
          const existing = await connection.get(
            'SELECT id FROM submissions WHERE id = ?',
            [submission.id]
          );
          if (existing) {
            submissionDuplicates.push(submission.id);
          }
        }

        // Check for duplicate notifications (by id)
        const notificationDuplicates: string[] = [];
        for (const notification of data.notifications) {
          const existing = await connection.get(
            'SELECT id FROM notifications WHERE id = ?',
            [notification.id]
          );
          if (existing) {
            notificationDuplicates.push(notification.id);
          }
        }

        const totalDuplicates = userDuplicates.length + departmentDuplicates.length + 
                               submissionDuplicates.length + notificationDuplicates.length;

        this.progressTracker.completeStep('detect_duplicates', {
          totalDuplicates,
          userDuplicates: userDuplicates.length,
          departmentDuplicates: departmentDuplicates.length,
          submissionDuplicates: submissionDuplicates.length,
          notificationDuplicates: notificationDuplicates.length
        });

        if (totalDuplicates > 0) {
          this.progressTracker.addWarning(`Found ${totalDuplicates} duplicate records that will be ${this.options.skipDuplicates ? 'skipped' : 'updated'}`);
        }

        logger.info('Duplicate detection completed', {
          totalDuplicates,
          userDuplicates: userDuplicates.length,
          departmentDuplicates: departmentDuplicates.length,
          submissionDuplicates: submissionDuplicates.length,
          notificationDuplicates: notificationDuplicates.length
        });

        return {
          totalDuplicates,
          userDuplicates,
          departmentDuplicates,
          submissionDuplicates,
          notificationDuplicates
        };
      } finally {
        await dbManager.releaseConnection(connection);
      }
    } catch (error) {
      const errorMsg = `Duplicate detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('detect_duplicates', errorMsg);
      throw error;
    }
  }

  private async importDepartmentsBatch(
    departments: SQLiteDepartment[], 
    context: TransactionContext
  ): Promise<BatchImportResult> {
    this.progressTracker.startStep('import_departments');

    const result: BatchImportResult = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: []
    };

    try {
      const connection = context.getConnection();
      const batches = this.createBatches(departments, this.options.batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        if (!batch) continue;
        
        for (const dept of batch) {
          try {
            // Check for duplicates
            const existing = await connection.get(
              'SELECT id FROM departments WHERE name = ?',
              [dept.name]
            );

            if (existing) {
              if (this.options.skipDuplicates) {
                result.duplicates++;
                result.skipped++;
                continue;
              } else {
                // Update existing record
                await connection.run(
                  `UPDATE departments SET 
                   code = ?, hod_user_id = ?, updated_at = ?
                   WHERE name = ?`,
                  [dept.code, dept.hod_user_id, dept.updated_at, dept.name]
                );
                result.imported++;
              }
            } else {
              // Insert new record
              await connection.run(
                `INSERT INTO departments (id, name, code, hod_user_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [dept.id, dept.name, dept.code, dept.hod_user_id, dept.created_at, dept.updated_at]
              );
              result.imported++;
            }
          } catch (error) {
            const errorMsg = `Failed to import department '${dept.name}': ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            logger.error('Department import error', { department: dept, error });
          }
        }
      }

      this.progressTracker.completeStep('import_departments', {
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates,
        errors: result.errors.length
      });

      logger.info('Department import completed', result);
      return result;
    } catch (error) {
      const errorMsg = `Department batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('import_departments', errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  private async importUsersBatch(
    users: SQLiteUser[], 
    context: TransactionContext
  ): Promise<BatchImportResult> {
    this.progressTracker.startStep('import_users');

    const result: BatchImportResult = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: []
    };

    try {
      const connection = context.getConnection();
      const batches = this.createBatches(users, this.options.batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        if (!batch) continue;
        
        for (const user of batch) {
          try {
            // Check for duplicates by employee_id or email
            const existing = await connection.get(
              'SELECT id FROM users WHERE employee_id = ? OR email = ?',
              [user.employee_id, user.email]
            );

            if (existing) {
              if (this.options.skipDuplicates) {
                result.duplicates++;
                result.skipped++;
                continue;
              } else {
                // Update existing record
                await connection.run(
                  `UPDATE users SET 
                   name = ?, email = ?, role = ?, department_id = ?, 
                   designation = ?, institution = ?, password_hash = ?, updated_at = ?
                   WHERE employee_id = ?`,
                  [
                    user.name, user.email, user.role, user.department_id,
                    user.designation, user.institution, user.password_hash, 
                    user.updated_at, user.employee_id
                  ]
                );
                result.imported++;
              }
            } else {
              // Insert new record
              await connection.run(
                `INSERT INTO users (
                  id, employee_id, name, email, role, department_id, 
                  designation, institution, password_hash, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  user.id, user.employee_id, user.name, user.email, user.role,
                  user.department_id, user.designation, user.institution,
                  user.password_hash, user.created_at, user.updated_at
                ]
              );
              result.imported++;
            }
          } catch (error) {
            const errorMsg = `Failed to import user '${user.name}' (${user.employee_id}): ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            logger.error('User import error', { user: { id: user.id, name: user.name, employee_id: user.employee_id }, error });
          }
        }
      }

      this.progressTracker.completeStep('import_users', {
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates,
        errors: result.errors.length
      });

      logger.info('User import completed', result);
      return result;
    } catch (error) {
      const errorMsg = `User batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('import_users', errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  private async importSubmissionsBatch(
    submissions: SQLiteSubmission[], 
    context: TransactionContext
  ): Promise<BatchImportResult> {
    this.progressTracker.startStep('import_submissions');

    const result: BatchImportResult = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: []
    };

    try {
      const connection = context.getConnection();
      const batches = this.createBatches(submissions, this.options.batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        if (!batch) continue;
        
        for (const submission of batch) {
          try {
            // Check for duplicates by id
            const existing = await connection.get(
              'SELECT id FROM submissions WHERE id = ?',
              [submission.id]
            );

            if (existing) {
              if (this.options.skipDuplicates) {
                result.duplicates++;
                result.skipped++;
                continue;
              } else {
                // Update existing record
                await connection.run(
                  `UPDATE submissions SET 
                   user_id = ?, module_type = ?, status = ?, form_data = ?,
                   document_url = ?, hod_comment = ?, admin_comment = ?, updated_at = ?
                   WHERE id = ?`,
                  [
                    submission.user_id, submission.module_type, submission.status,
                    submission.form_data, submission.document_url, submission.hod_comment,
                    submission.admin_comment, submission.updated_at, submission.id
                  ]
                );
                result.imported++;
              }
            } else {
              // Verify user exists
              const userExists = await connection.get(
                'SELECT id FROM users WHERE id = ?',
                [submission.user_id]
              );

              if (!userExists) {
                result.errors.push(`Submission ${submission.id}: Referenced user ${submission.user_id} does not exist`);
                continue;
              }

              // Insert new record
              await connection.run(
                `INSERT INTO submissions (
                  id, user_id, module_type, status, form_data, document_url,
                  hod_comment, admin_comment, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  submission.id, submission.user_id, submission.module_type, submission.status,
                  submission.form_data, submission.document_url, submission.hod_comment,
                  submission.admin_comment, submission.created_at, submission.updated_at
                ]
              );
              result.imported++;
            }
          } catch (error) {
            const errorMsg = `Failed to import submission ${submission.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            logger.error('Submission import error', { submission: { id: submission.id, user_id: submission.user_id }, error });
          }
        }
      }

      this.progressTracker.completeStep('import_submissions', {
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates,
        errors: result.errors.length
      });

      logger.info('Submission import completed', result);
      return result;
    } catch (error) {
      const errorMsg = `Submission batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('import_submissions', errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  private async importNotificationsBatch(
    notifications: SQLiteNotification[], 
    context: TransactionContext
  ): Promise<BatchImportResult> {
    this.progressTracker.startStep('import_notifications');

    const result: BatchImportResult = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: []
    };

    try {
      const connection = context.getConnection();
      const batches = this.createBatches(notifications, this.options.batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        if (!batch) continue;
        
        for (const notification of batch) {
          try {
            // Check for duplicates by id
            const existing = await connection.get(
              'SELECT id FROM notifications WHERE id = ?',
              [notification.id]
            );

            if (existing) {
              if (this.options.skipDuplicates) {
                result.duplicates++;
                result.skipped++;
                continue;
              } else {
                // Update existing record
                await connection.run(
                  `UPDATE notifications SET 
                   user_id = ?, message = ?, link = ?, read_flag = ?
                   WHERE id = ?`,
                  [
                    notification.user_id, notification.message, notification.link,
                    notification.read_flag, notification.id
                  ]
                );
                result.imported++;
              }
            } else {
              // Verify user exists
              const userExists = await connection.get(
                'SELECT id FROM users WHERE id = ?',
                [notification.user_id]
              );

              if (!userExists) {
                result.errors.push(`Notification ${notification.id}: Referenced user ${notification.user_id} does not exist`);
                continue;
              }

              // Insert new record
              await connection.run(
                `INSERT INTO notifications (id, user_id, message, link, read_flag, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  notification.id, notification.user_id, notification.message,
                  notification.link, notification.read_flag, notification.created_at
                ]
              );
              result.imported++;
            }
          } catch (error) {
            const errorMsg = `Failed to import notification ${notification.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            logger.error('Notification import error', { notification: { id: notification.id, user_id: notification.user_id }, error });
          }
        }
      }

      this.progressTracker.completeStep('import_notifications', {
        imported: result.imported,
        skipped: result.skipped,
        duplicates: result.duplicates,
        errors: result.errors.length
      });

      logger.info('Notification import completed', result);
      return result;
    } catch (error) {
      const errorMsg = `Notification batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('import_notifications', errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  private async verifyImport(_data: ImportData, _result: ImportResult): Promise<void> {
    this.progressTracker.startStep('verify_import');

    try {
      const connection = await dbManager.getConnection();
      
      try {
        // Verify record counts
        const userCount = await connection.get('SELECT COUNT(*) as count FROM users');
        const deptCount = await connection.get('SELECT COUNT(*) as count FROM departments');
        const submissionCount = await connection.get('SELECT COUNT(*) as count FROM submissions');
        const notificationCount = await connection.get('SELECT COUNT(*) as count FROM notifications');

        // Verify referential integrity
        const orphanedSubmissions = await connection.get(`
          SELECT COUNT(*) as count FROM submissions s 
          LEFT JOIN users u ON s.user_id = u.id 
          WHERE u.id IS NULL
        `);

        const orphanedNotifications = await connection.get(`
          SELECT COUNT(*) as count FROM notifications n 
          LEFT JOIN users u ON n.user_id = u.id 
          WHERE u.id IS NULL
        `);

        const orphanedUsers = await connection.get(`
          SELECT COUNT(*) as count FROM users u 
          LEFT JOIN departments d ON u.department_id = d.id 
          WHERE u.department_id IS NOT NULL AND d.id IS NULL
        `);

        const verificationResult = {
          recordCounts: {
            users: userCount?.count || 0,
            departments: deptCount?.count || 0,
            submissions: submissionCount?.count || 0,
            notifications: notificationCount?.count || 0
          },
          integrityIssues: {
            orphanedSubmissions: orphanedSubmissions?.count || 0,
            orphanedNotifications: orphanedNotifications?.count || 0,
            orphanedUsers: orphanedUsers?.count || 0
          }
        };

        // Add warnings for integrity issues
        if (verificationResult.integrityIssues.orphanedSubmissions > 0) {
          this.progressTracker.addWarning(`Found ${verificationResult.integrityIssues.orphanedSubmissions} submissions with invalid user references`);
        }
        if (verificationResult.integrityIssues.orphanedNotifications > 0) {
          this.progressTracker.addWarning(`Found ${verificationResult.integrityIssues.orphanedNotifications} notifications with invalid user references`);
        }
        if (verificationResult.integrityIssues.orphanedUsers > 0) {
          this.progressTracker.addWarning(`Found ${verificationResult.integrityIssues.orphanedUsers} users with invalid department references`);
        }

        this.progressTracker.completeStep('verify_import', verificationResult);

        logger.info('Import verification completed', verificationResult);
      } finally {
        await dbManager.releaseConnection(connection);
      }
    } catch (error) {
      const errorMsg = `Import verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('verify_import', errorMsg);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    this.progressTracker.startStep('cleanup');

    try {
      // Perform any cleanup operations
      // For now, just log completion
      this.progressTracker.completeStep('cleanup', {
        message: 'Cleanup completed successfully'
      });

      logger.info('Import cleanup completed');
    } catch (error) {
      const errorMsg = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('cleanup', errorMsg);
      // Don't throw here as cleanup failure shouldn't fail the entire import
      logger.warn('Cleanup failed but import was successful', error);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private generateFinalReport(result: ImportResult): void {
    const state = this.progressTracker.getState();
    
    console.log('\n' + '='.repeat(60));
    console.log(result.success ? '✅ Import completed successfully!' : '❌ Import completed with errors');
    console.log(`📊 Total records: ${result.totalRecords}`);
    console.log(`✅ Imported: ${result.importedRecords}`);
    console.log(`⏭️  Skipped: ${result.skippedRecords}`);
    console.log(`🔄 Duplicates: ${result.duplicateRecords}`);
    console.log(`❌ Errors: ${result.errorRecords}`);
    console.log(`⏱️  Duration: ${this.formatDuration(result.duration)}`);
    
    if (result.backupFile) {
      console.log(`📦 Backup: ${result.backupFile}`);
    }
    
    if (state.errors.length > 0) {
      console.log(`❌ Total errors: ${state.errors.length}`);
    }
    
    if (state.warnings.length > 0) {
      console.log(`⚠️  Total warnings: ${state.warnings.length}`);
    }
    
    console.log('='.repeat(60));

    // Save detailed report
    this.saveDetailedReport(result);
  }

  private saveDetailedReport(result: ImportResult): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportDir = path.join(process.cwd(), 'data', 'reports');
      const reportFile = path.join(reportDir, `import-report-${timestamp}.json`);

      // Ensure report directory exists
      const fs = require('fs');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const report = {
        ...result,
        progressReport: this.progressTracker.generateReport(),
        timestamp: new Date().toISOString(),
        options: this.options
      };

      writeFileSync(reportFile, JSON.stringify(report, null, 2));
      console.log(`📄 Detailed report saved: ${reportFile}`);
    } catch (error) {
      logger.warn('Failed to save detailed report', error);
    }
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Rollback import by restoring from backup
   */
  public async rollback(backupFile: string): Promise<boolean> {
    try {
      console.log('🔄 Starting import rollback...');
      logger.info('Starting import rollback', { backupFile });

      if (!existsSync(backupFile)) {
        throw new Error(`Backup file not found: ${backupFile}`);
      }

      // Close current database connections
      await dbManager.close();

      // Restore from backup
      const fs = await import('fs/promises');
      const dbPath = path.join(process.cwd(), 'data', 'database.db');
      await fs.copyFile(backupFile, dbPath);

      // Reinitialize database
      await dbManager.initialize();

      console.log('✅ Rollback completed successfully');
      logger.info('Import rollback completed successfully', { backupFile });
      
      return true;
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      logger.error('Import rollback failed', { backupFile, error });
      return false;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: tsx import-sqlite-data.ts <import-file> [options]');
    console.error('Options:');
    console.error('  --batch-size <number>     Batch size for imports (default: 100)');
    console.error('  --skip-duplicates         Skip duplicate records (default: true)');
    console.error('  --no-validation          Skip data validation');
    console.error('  --no-backup              Skip backup creation');
    console.error('  --dry-run                Perform dry run without importing');
    process.exit(1);
  }

  const importFile = args[0];
  if (!importFile) {
    console.error('Import file is required');
    process.exit(1);
  }
  const options: Partial<ImportOptions> = {};

  // Parse command line options
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        const batchSizeArg = args[++i];
        if (batchSizeArg) {
          options.batchSize = parseInt(batchSizeArg);
        }
        break;
      case '--skip-duplicates':
        options.skipDuplicates = true;
        break;
      case '--no-validation':
        options.validateData = false;
        break;
      case '--no-backup':
        options.createBackup = false;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
    }
  }

  const importer = new SQLiteDataImporter(options);
  
  importer.importFromFile(importFile)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      logger.error('Fatal import error', error);
      process.exit(1);
    });
}

export { SQLiteDataImporter };