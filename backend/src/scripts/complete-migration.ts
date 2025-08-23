#!/usr/bin/env tsx

import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { SupabaseDataExporter } from './export-supabase-data.js';
import { SQLiteDataImporter, ImportOptions } from './import-sqlite-data.js';
import { MigrationVerifier } from '../utils/migration-verification.js';
import { ProgressTracker } from '../utils/progress-tracker.js';

interface MigrationOptions {
  exportOnly?: boolean;
  importOnly?: boolean;
  importFile?: string;
  skipExport?: boolean;
  skipImport?: boolean;
  skipVerification?: boolean;
  batchSize?: number;
  skipDuplicates?: boolean;
  validateData?: boolean;
  createBackup?: boolean;
  dryRun?: boolean;
}

interface MigrationResult {
  success: boolean;
  phases: {
    export?: {
      success: boolean;
      recordCount: number;
      duration: number;
      outputFile?: string;
    };
    import?: {
      success: boolean;
      importedRecords: number;
      skippedRecords: number;
      errorRecords: number;
      duration: number;
      backupFile?: string;
    };
    verification?: {
      success: boolean;
      totalRecords: number;
      integrityIssues: number;
      errors: number;
      warnings: number;
    };
  };
  totalDuration: number;
  errors: string[];
  warnings: string[];
}

class CompleteMigrationManager {
  private progressTracker: ProgressTracker;
  private startTime: Date;
  private options: MigrationOptions;

  constructor(options: MigrationOptions = {}) {
    this.options = {
      batchSize: 100,
      skipDuplicates: true,
      validateData: true,
      createBackup: true,
      dryRun: false,
      ...options
    };

    this.progressTracker = new ProgressTracker();
    this.startTime = new Date();
    
    this.setupProgressTracking();
  }

  private setupProgressTracking(): void {
    const steps = [];

    if (!this.options.skipExport && !this.options.importOnly) {
      steps.push({ id: 'export', name: 'Export from Supabase', description: 'Exporting data from Supabase', weight: 3 });
    }

    if (!this.options.skipImport && !this.options.exportOnly) {
      steps.push({ id: 'import', name: 'Import to SQLite', description: 'Importing data to SQLite', weight: 4 });
    }

    if (!this.options.skipVerification && !this.options.exportOnly) {
      steps.push({ id: 'verification', name: 'Verify Migration', description: 'Verifying migration integrity', weight: 2 });
    }

    steps.push({ id: 'finalize', name: 'Finalize Migration', description: 'Finalizing migration process', weight: 1 });

    this.progressTracker.addSteps(steps);

    this.progressTracker.on('progress', () => {
      this.progressTracker.displayProgress();
    });
  }

  /**
   * Execute complete migration process
   */
  public async executeMigration(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      phases: {},
      totalDuration: 0,
      errors: [],
      warnings: []
    };

    try {
      console.log('🚀 Starting complete migration process...');
      logger.info('Starting complete migration process', { options: this.options });

      let exportFile: string | undefined;

      // Phase 1: Export from Supabase
      if (!this.options.skipExport && !this.options.importOnly) {
        exportFile = await this.executeExportPhase(result);
        if (!result.phases.export?.success) {
          throw new Error('Export phase failed');
        }
      }

      // Phase 2: Import to SQLite
      if (!this.options.skipImport && !this.options.exportOnly) {
        const importFile = this.options.importFile || exportFile;
        if (!importFile) {
          throw new Error('No import file specified and export was skipped');
        }
        
        await this.executeImportPhase(importFile, result);
        if (!result.phases.import?.success) {
          throw new Error('Import phase failed');
        }
      }

      // Phase 3: Verification
      if (!this.options.skipVerification && !this.options.exportOnly) {
        await this.executeVerificationPhase(result);
      }

      // Phase 4: Finalization
      await this.executeFinalizationPhase(result);

      result.success = this.determineOverallSuccess(result);
      result.totalDuration = Date.now() - this.startTime.getTime();

      // Generate final report
      this.generateFinalReport(result);

      return result;
    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      result.success = false;
      result.totalDuration = Date.now() - this.startTime.getTime();
      
      console.error('❌ Migration failed:', error);
      logger.error('Migration failed', error);
      
      return result;
    }
  }

  private async executeExportPhase(result: MigrationResult): Promise<string | undefined> {
    this.progressTracker.startStep('export');

    try {
      console.log('📤 Starting export phase...');
      
      const exporter = new SupabaseDataExporter();
      const exportSuccess = await exporter.exportAll();

      if (!exportSuccess) {
        throw new Error('Supabase export failed');
      }

      // Find the most recent export file
      const exportDir = path.join(process.cwd(), 'data', 'exports');
      const fs = require('fs');
      const files = fs.readdirSync(exportDir)
        .filter((file: string) => file.startsWith('supabase-transformed-export-'))
        .sort()
        .reverse();

      if (files.length === 0) {
        throw new Error('No export files found');
      }

      const exportFile = path.join(exportDir, files[0]);
      const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
      const recordCount = exportData.users.length + exportData.departments.length + 
                         exportData.submissions.length + exportData.notifications.length;

      result.phases.export = {
        success: true,
        recordCount,
        duration: 0, // Will be calculated by progress tracker
        outputFile: exportFile
      };

      this.progressTracker.completeStep('export', {
        recordCount,
        outputFile: exportFile
      });

      console.log(`✅ Export completed: ${recordCount} records exported to ${exportFile}`);
      logger.info('Export phase completed', { recordCount, outputFile: exportFile });

      return exportFile;
    } catch (error) {
      const errorMsg = `Export phase failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('export', errorMsg);
      result.errors.push(errorMsg);
      
      result.phases.export = {
        success: false,
        recordCount: 0,
        duration: 0
      };

      throw error;
    }
  }

  private async executeImportPhase(importFile: string, result: MigrationResult): Promise<void> {
    this.progressTracker.startStep('import');

    try {
      console.log('📥 Starting import phase...');
      
      if (!existsSync(importFile)) {
        throw new Error(`Import file not found: ${importFile}`);
      }

      const importOptions: Partial<ImportOptions> = {};
      if (this.options.batchSize !== undefined) importOptions.batchSize = this.options.batchSize;
      if (this.options.skipDuplicates !== undefined) importOptions.skipDuplicates = this.options.skipDuplicates;
      if (this.options.validateData !== undefined) importOptions.validateData = this.options.validateData;
      if (this.options.createBackup !== undefined) importOptions.createBackup = this.options.createBackup;
      if (this.options.dryRun !== undefined) importOptions.dryRun = this.options.dryRun;
      
      const importer = new SQLiteDataImporter(importOptions);

      const importResult = await importer.importFromFile(importFile);

      result.phases.import = {
        success: importResult.success,
        importedRecords: importResult.importedRecords,
        skippedRecords: importResult.skippedRecords,
        errorRecords: importResult.errorRecords,
        duration: importResult.duration
      };
      
      if (importResult.backupFile) {
        result.phases.import.backupFile = importResult.backupFile;
      }

      // Add import errors and warnings to overall result
      result.errors.push(...importResult.errors);
      result.warnings.push(...importResult.warnings);

      this.progressTracker.completeStep('import', {
        importedRecords: importResult.importedRecords,
        skippedRecords: importResult.skippedRecords,
        errorRecords: importResult.errorRecords,
        backupFile: importResult.backupFile
      });

      console.log(`✅ Import completed: ${importResult.importedRecords} records imported`);
      logger.info('Import phase completed', {
        importedRecords: importResult.importedRecords,
        skippedRecords: importResult.skippedRecords,
        errorRecords: importResult.errorRecords
      });

      if (!importResult.success) {
        throw new Error(`Import failed with ${importResult.errorRecords} errors`);
      }
    } catch (error) {
      const errorMsg = `Import phase failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('import', errorMsg);
      result.errors.push(errorMsg);

      if (!result.phases.import) {
        result.phases.import = {
          success: false,
          importedRecords: 0,
          skippedRecords: 0,
          errorRecords: 0,
          duration: 0
        };
      }

      throw error;
    }
  }

  private async executeVerificationPhase(result: MigrationResult): Promise<void> {
    this.progressTracker.startStep('verification');

    try {
      console.log('🔍 Starting verification phase...');
      
      const verifier = new MigrationVerifier();
      const verificationResult = await verifier.verifyMigration();

      result.phases.verification = {
        success: verificationResult.success,
        totalRecords: verificationResult.summary.totalRecords,
        integrityIssues: verificationResult.summary.integrityIssues,
        errors: verificationResult.errors.length,
        warnings: verificationResult.warnings.length
      };

      // Add verification errors and warnings to overall result
      result.errors.push(...verificationResult.errors);
      result.warnings.push(...verificationResult.warnings);

      this.progressTracker.completeStep('verification', {
        success: verificationResult.success,
        totalRecords: verificationResult.summary.totalRecords,
        integrityIssues: verificationResult.summary.integrityIssues,
        errors: verificationResult.errors.length,
        warnings: verificationResult.warnings.length
      });

      // Save verification report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportDir = path.join(process.cwd(), 'data', 'reports');
      const reportFile = path.join(reportDir, `migration-verification-${timestamp}.txt`);
      
      const fs = require('fs');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      writeFileSync(reportFile, MigrationVerifier.formatVerificationReport(verificationResult));

      console.log(`✅ Verification completed: ${verificationResult.success ? 'PASSED' : 'FAILED'}`);
      console.log(`📄 Verification report saved: ${reportFile}`);
      
      logger.info('Verification phase completed', {
        success: verificationResult.success,
        totalRecords: verificationResult.summary.totalRecords,
        integrityIssues: verificationResult.summary.integrityIssues,
        reportFile
      });

      if (!verificationResult.success) {
        this.progressTracker.addWarning('Verification found issues but migration can continue');
      }
    } catch (error) {
      const errorMsg = `Verification phase failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('verification', errorMsg);
      result.warnings.push(errorMsg); // Verification failure is a warning, not a fatal error

      result.phases.verification = {
        success: false,
        totalRecords: 0,
        integrityIssues: 0,
        errors: 1,
        warnings: 0
      };

      logger.warn('Verification phase failed but migration continues', error);
    }
  }

  private async executeFinalizationPhase(result: MigrationResult): Promise<void> {
    this.progressTracker.startStep('finalize');

    try {
      // Save migration summary
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportDir = path.join(process.cwd(), 'data', 'reports');
      const summaryFile = path.join(reportDir, `migration-summary-${timestamp}.json`);

      const fs = require('fs');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const summary = {
        ...result,
        timestamp: new Date().toISOString(),
        options: this.options,
        progressReport: this.progressTracker.generateReport()
      };

      writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

      this.progressTracker.completeStep('finalize', {
        summaryFile
      });

      console.log(`📄 Migration summary saved: ${summaryFile}`);
      logger.info('Finalization phase completed', { summaryFile });
    } catch (error) {
      const errorMsg = `Finalization phase failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.progressTracker.failStep('finalize', errorMsg);
      result.warnings.push(errorMsg);
      logger.warn('Finalization phase failed', error);
    }
  }

  private determineOverallSuccess(result: MigrationResult): boolean {
    // Migration is successful if all executed phases succeeded
    const executedPhases = Object.values(result.phases);
    return executedPhases.length > 0 && executedPhases.every(phase => phase.success);
  }

  private generateFinalReport(result: MigrationResult): void {
    // const state = this.progressTracker.getState();
    
    console.log('\n' + '='.repeat(80));
    console.log('COMPLETE MIGRATION REPORT');
    console.log('='.repeat(80));
    console.log(result.success ? '✅ Migration completed successfully!' : '❌ Migration completed with issues');
    console.log('');

    // Phase results
    if (result.phases.export) {
      console.log(`📤 Export: ${result.phases.export.success ? '✅' : '❌'} - ${result.phases.export.recordCount} records`);
    }
    
    if (result.phases.import) {
      console.log(`📥 Import: ${result.phases.import.success ? '✅' : '❌'} - ${result.phases.import.importedRecords} imported, ${result.phases.import.skippedRecords} skipped, ${result.phases.import.errorRecords} errors`);
    }
    
    if (result.phases.verification) {
      console.log(`🔍 Verification: ${result.phases.verification.success ? '✅' : '⚠️'} - ${result.phases.verification.totalRecords} records, ${result.phases.verification.integrityIssues} integrity issues`);
    }

    console.log('');
    console.log(`⏱️  Total Duration: ${this.formatDuration(result.totalDuration)}`);
    
    if (result.errors.length > 0) {
      console.log(`❌ Errors: ${result.errors.length}`);
    }
    
    if (result.warnings.length > 0) {
      console.log(`⚠️  Warnings: ${result.warnings.length}`);
    }

    if (result.phases.import?.backupFile) {
      console.log(`📦 Backup: ${result.phases.import.backupFile}`);
    }
    
    console.log('='.repeat(80));

    // Show next steps
    if (result.success) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('Next steps:');
      console.log('1. Update your application configuration to use SQLite');
      console.log('2. Test your application thoroughly');
      console.log('3. Monitor for any issues');
      if (result.phases.import?.backupFile) {
        console.log(`4. Keep the backup file safe: ${result.phases.import.backupFile}`);
      }
    } else {
      console.log('\n⚠️  Migration completed with issues.');
      console.log('Please review the errors and warnings above.');
      if (result.phases.import?.backupFile) {
        console.log(`You can rollback using: tsx import-sqlite-data.ts --rollback "${result.phases.import.backupFile}"`);
      }
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
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};

  // Parse command line options
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--export-only':
        options.exportOnly = true;
        break;
      case '--import-only':
        options.importOnly = true;
        break;
      case '--import-file':
        const importFileArg = args[++i];
        if (importFileArg) {
          options.importFile = importFileArg;
        }
        break;
      case '--skip-export':
        options.skipExport = true;
        break;
      case '--skip-import':
        options.skipImport = true;
        break;
      case '--skip-verification':
        options.skipVerification = true;
        break;
      case '--batch-size':
        const batchSizeArg = args[++i];
        if (batchSizeArg) {
          options.batchSize = parseInt(batchSizeArg);
        }
        break;
      case '--no-skip-duplicates':
        options.skipDuplicates = false;
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
      case '--help':
        console.log('Complete Migration Tool');
        console.log('Usage: tsx complete-migration.ts [options]');
        console.log('');
        console.log('Options:');
        console.log('  --export-only              Only export from Supabase');
        console.log('  --import-only               Only import to SQLite');
        console.log('  --import-file <file>        Import file path (for import-only)');
        console.log('  --skip-export               Skip export phase');
        console.log('  --skip-import               Skip import phase');
        console.log('  --skip-verification         Skip verification phase');
        console.log('  --batch-size <number>       Batch size for imports (default: 100)');
        console.log('  --no-skip-duplicates        Don\'t skip duplicate records');
        console.log('  --no-validation             Skip data validation');
        console.log('  --no-backup                 Skip backup creation');
        console.log('  --dry-run                   Perform dry run without importing');
        console.log('  --help                      Show this help message');
        process.exit(0);
    }
  }

  const migrationManager = new CompleteMigrationManager(options);
  
  migrationManager.executeMigration()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      logger.error('Fatal migration error', error);
      process.exit(1);
    });
}

export { CompleteMigrationManager, MigrationOptions, MigrationResult };