#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { DataTransformer } from '../utils/data-transformer.js';
import { DataValidator } from '../utils/data-validator.js';
import { ProgressTracker } from '../utils/progress-tracker.js';

interface ExportedData {
  users: any[];
  departments: any[];
  submissions: any[];
  notifications: any[];
  metadata: {
    exportDate: string;
    totalRecords: number;
    version: string;
    supabaseUrl: string;
  };
}

interface TransformedData {
  users: any[];
  departments: any[];
  submissions: any[];
  notifications: any[];
}

class SupabaseDataExporter {
  private supabase: any;
  private outputDir: string;
  private progressTracker: ProgressTracker;
  private validator: DataValidator;

  constructor() {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
    }

    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    this.outputDir = path.join(process.cwd(), 'data', 'exports');
    this.progressTracker = new ProgressTracker();
    this.validator = new DataValidator();

    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }

    // Set up progress tracking
    this.setupProgressTracking();
  }

  private setupProgressTracking(): void {
    this.progressTracker.addSteps([
      { id: 'export_users', name: 'Export Users', description: 'Fetching user data from Supabase', weight: 2 },
      { id: 'export_departments', name: 'Export Departments', description: 'Fetching department data from Supabase', weight: 1 },
      { id: 'export_submissions', name: 'Export Submissions', description: 'Fetching submission data from Supabase', weight: 3 },
      { id: 'export_notifications', name: 'Export Notifications', description: 'Fetching notification data from Supabase', weight: 1 },
      { id: 'transform_data', name: 'Transform Data', description: 'Converting data to SQLite format', weight: 2 },
      { id: 'validate_data', name: 'Validate Data', description: 'Validating data integrity and format', weight: 2 },
      { id: 'save_files', name: 'Save Files', description: 'Writing export files to disk', weight: 1 }
    ]);

    // Set up progress display
    this.progressTracker.on('progress', () => {
      this.progressTracker.displayProgress();
    });
  }

  async exportUsers(): Promise<any[]> {
    try {
      this.progressTracker.startStep('export_users');
      
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to export users: ${error.message}`);
      }

      const userCount = data?.length || 0;
      this.progressTracker.completeStep('export_users', { recordCount: userCount });
      logger.info(`Exported ${userCount} users`);
      
      return data || [];
    } catch (error) {
      const errorMsg = `Failed to export users: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('export_users', errorMsg);
      return [];
    }
  }

  async exportDepartments(): Promise<any[]> {
    try {
      this.progressTracker.startStep('export_departments');
      
      const { data, error } = await this.supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to export departments: ${error.message}`);
      }

      const deptCount = data?.length || 0;
      this.progressTracker.completeStep('export_departments', { recordCount: deptCount });
      logger.info(`Exported ${deptCount} departments`);
      
      return data || [];
    } catch (error) {
      const errorMsg = `Failed to export departments: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('export_departments', errorMsg);
      return [];
    }
  }

  async exportSubmissions(): Promise<any[]> {
    try {
      this.progressTracker.startStep('export_submissions');
      
      const { data, error } = await this.supabase
        .from('submissions')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to export submissions: ${error.message}`);
      }

      const submissionCount = data?.length || 0;
      this.progressTracker.completeStep('export_submissions', { recordCount: submissionCount });
      logger.info(`Exported ${submissionCount} submissions`);
      
      return data || [];
    } catch (error) {
      const errorMsg = `Failed to export submissions: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('export_submissions', errorMsg);
      return [];
    }
  }

  async exportNotifications(): Promise<any[]> {
    try {
      this.progressTracker.startStep('export_notifications');
      
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to export notifications: ${error.message}`);
      }

      const notificationCount = data?.length || 0;
      this.progressTracker.completeStep('export_notifications', { recordCount: notificationCount });
      logger.info(`Exported ${notificationCount} notifications`);
      
      return data || [];
    } catch (error) {
      const errorMsg = `Failed to export notifications: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('export_notifications', errorMsg);
      return [];
    }
  }

  transformData(rawData: ExportedData): TransformedData {
    this.progressTracker.startStep('transform_data');
    
    try {
      // Transform each entity type
      const userResult = DataTransformer.transformUsers(rawData.users);
      const deptResult = DataTransformer.transformDepartments(rawData.departments);
      const submissionResult = DataTransformer.transformSubmissions(rawData.submissions);
      const notificationResult = DataTransformer.transformNotifications(rawData.notifications);

      // Collect transformation errors
      const allErrors = [
        ...userResult.errors,
        ...deptResult.errors,
        ...submissionResult.errors,
        ...notificationResult.errors
      ];

      if (allErrors.length > 0) {
        allErrors.forEach(error => this.progressTracker.addError(error));
      }

      const transformedData: TransformedData = {
        users: userResult.data,
        departments: deptResult.data,
        submissions: submissionResult.data,
        notifications: notificationResult.data
      };

      const totalTransformed = userResult.data.length + deptResult.data.length + 
                              submissionResult.data.length + notificationResult.data.length;
      const totalSkipped = userResult.skipped + deptResult.skipped + 
                          submissionResult.skipped + notificationResult.skipped;

      this.progressTracker.completeStep('transform_data', {
        totalTransformed,
        totalSkipped,
        errorCount: allErrors.length
      });

      logger.info(`Data transformation completed: ${totalTransformed} records transformed, ${totalSkipped} skipped, ${allErrors.length} errors`);
      
      return transformedData;
    } catch (error) {
      const errorMsg = `Data transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('transform_data', errorMsg);
      throw error;
    }
  }

  validateData(data: TransformedData): boolean {
    this.progressTracker.startStep('validate_data');
    
    try {
      const validationResult = this.validator.validateComplete(
        data.users,
        data.departments,
        data.submissions,
        data.notifications
      );

      // Add validation errors to progress tracker
      validationResult.errors.forEach(error => {
        this.progressTracker.addError(`${error.entity}: ${error.message}`);
      });

      // Add validation warnings to progress tracker
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

      logger.info(`Data validation completed: ${validationResult.isValid ? 'PASSED' : 'FAILED'} - ${validationResult.summary.validRecords}/${validationResult.summary.totalRecords} valid records`);
      
      return validationResult.isValid;
    } catch (error) {
      const errorMsg = `Data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('validate_data', errorMsg);
      return false;
    }
  }

  async exportAll(): Promise<boolean> {
    try {
      console.log('🚀 Starting Supabase data export...');
      logger.info('Starting Supabase data export');

      // Export raw data from Supabase
      const users = await this.exportUsers();
      const departments = await this.exportDepartments();
      const submissions = await this.exportSubmissions();
      const notifications = await this.exportNotifications();

      const rawData: ExportedData = {
        users,
        departments,
        submissions,
        notifications,
        metadata: {
          exportDate: new Date().toISOString(),
          totalRecords: users.length + departments.length + submissions.length + notifications.length,
          version: '1.0.0',
          supabaseUrl: config.SUPABASE_URL || 'unknown'
        }
      };

      // Transform data to SQLite format
      const transformedData = this.transformData(rawData);

      // Validate transformed data
      const isValid = this.validateData(transformedData);

      // Save files
      await this.saveFiles(rawData, transformedData, isValid);

      const state = this.progressTracker.getState();
      const success = !this.progressTracker.hasErrors();

      console.log('\n' + '='.repeat(60));
      console.log(success ? '✅ Export completed successfully!' : '❌ Export completed with errors');
      console.log(`📈 Total records exported: ${rawData.metadata.totalRecords}`);
      console.log(`🔄 Total records transformed: ${transformedData.users.length + transformedData.departments.length + transformedData.submissions.length + transformedData.notifications.length}`);
      console.log(`⏱️  Total time: ${this.formatDuration(state.elapsedTime)}`);
      
      if (state.errors.length > 0) {
        console.log(`❌ Errors: ${state.errors.length}`);
      }
      
      if (state.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${state.warnings.length}`);
      }
      
      console.log('='.repeat(60));

      logger.info(`Export completed. Success: ${success}, Total records: ${rawData.metadata.totalRecords}, Errors: ${state.errors.length}, Warnings: ${state.warnings.length}`);
      
      return success;
    } catch (error) {
      const errorMsg = `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.addError(errorMsg);
      console.error('❌ Export failed:', error);
      logger.error('Export failed', error);
      return false;
    }
  }

  private async saveFiles(rawData: ExportedData, transformedData: TransformedData, isValid: boolean): Promise<void> {
    this.progressTracker.startStep('save_files');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Save raw export data
      const rawFilename = `supabase-raw-export-${timestamp}.json`;
      const rawFilepath = path.join(this.outputDir, rawFilename);
      writeFileSync(rawFilepath, JSON.stringify(rawData, null, 2));

      // Save transformed data (ready for SQLite import)
      const transformedFilename = `supabase-transformed-export-${timestamp}.json`;
      const transformedFilepath = path.join(this.outputDir, transformedFilename);
      writeFileSync(transformedFilepath, JSON.stringify(transformedData, null, 2));

      // Save progress report
      const reportFilename = `export-report-${timestamp}.txt`;
      const reportFilepath = path.join(this.outputDir, reportFilename);
      writeFileSync(reportFilepath, this.progressTracker.generateReport());

      // Save validation report if validator was used
      const validationReportFilename = `validation-report-${timestamp}.txt`;
      const validationReportFilepath = path.join(this.outputDir, validationReportFilename);
      const validationResult = this.validator.validateComplete(
        transformedData.users,
        transformedData.departments,
        transformedData.submissions,
        transformedData.notifications
      );
      writeFileSync(validationReportFilepath, DataValidator.formatValidationReport(validationResult));

      // Save summary
      const state = this.progressTracker.getState();
      const summaryFilename = `export-summary-${timestamp}.json`;
      const summaryFilepath = path.join(this.outputDir, summaryFilename);
      const summary = {
        exportDate: rawData.metadata.exportDate,
        supabaseUrl: rawData.metadata.supabaseUrl,
        totalRecords: rawData.metadata.totalRecords,
        recordCounts: {
          raw: {
            users: rawData.users.length,
            departments: rawData.departments.length,
            submissions: rawData.submissions.length,
            notifications: rawData.notifications.length
          },
          transformed: {
            users: transformedData.users.length,
            departments: transformedData.departments.length,
            submissions: transformedData.submissions.length,
            notifications: transformedData.notifications.length
          }
        },
        validationPassed: isValid,
        processingTime: this.formatDuration(state.elapsedTime),
        errors: state.errors,
        warnings: state.warnings,
        files: {
          rawDataFile: rawFilename,
          transformedDataFile: transformedFilename,
          progressReportFile: reportFilename,
          validationReportFile: validationReportFilename,
          summaryFile: summaryFilename
        }
      };

      writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));

      this.progressTracker.completeStep('save_files', {
        filesCreated: 5,
        rawFilepath,
        transformedFilepath,
        reportFilepath,
        validationReportFilepath,
        summaryFilepath
      });

      console.log(`\n📁 Files saved to: ${this.outputDir}`);
      console.log(`   • Raw data: ${rawFilename}`);
      console.log(`   • Transformed data: ${transformedFilename}`);
      console.log(`   • Progress report: ${reportFilename}`);
      console.log(`   • Validation report: ${validationReportFilename}`);
      console.log(`   • Summary: ${summaryFilename}`);
      
    } catch (error) {
      const errorMsg = `Failed to save files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('save_files', errorMsg);
      throw error;
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
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const exporter = new SupabaseDataExporter();
  
  exporter.exportAll()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      logger.error('Fatal export error', error);
      process.exit(1);
    });
}

export { SupabaseDataExporter };