#!/usr/bin/env tsx

import { existsSync, copyFileSync, statSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { dbManager } from '../utils/database.js';
import { MigrationVerifier } from '../utils/migration-verification.js';

interface RollbackOptions {
    backupFile: string;
    verify?: boolean;
    force?: boolean;
}

interface RollbackResult {
    success: boolean;
    backupFile: string;
    backupSize: number;
    backupDate: Date;
    rollbackDuration: number;
    verificationResult?: {
        success: boolean;
        message: string;
    };
    errors: string[];
    warnings: string[];
}

class MigrationRollback {
    private options: RollbackOptions;
    private startTime: Date;

    constructor(options: RollbackOptions) {
        this.options = {
            verify: true,
            force: false,
            ...options
        };
        this.startTime = new Date();
    }

    /**
     * Execute rollback process
     */
    public async executeRollback(): Promise<RollbackResult> {
        const result: RollbackResult = {
            success: false,
            backupFile: this.options.backupFile,
            backupSize: 0,
            backupDate: new Date(),
            rollbackDuration: 0,
            errors: [],
            warnings: []
        };

        try {
            console.log('🔄 Starting migration rollback...');
            logger.info('Starting migration rollback', { backupFile: this.options.backupFile });

            // Validate backup file
            await this.validateBackupFile(result);

            // Confirm rollback if not forced
            if (!this.options.force) {
                const confirmed = await this.confirmRollback(result);
                if (!confirmed) {
                    result.warnings.push('Rollback cancelled by user');
                    console.log('⚠️  Rollback cancelled');
                    return result;
                }
            }

            // Perform rollback
            await this.performRollback(result);

            // Verify rollback if requested
            if (this.options.verify) {
                await this.verifyRollback(result);
            }

            result.success = result.errors.length === 0;
            result.rollbackDuration = Date.now() - this.startTime.getTime();

            // Generate final report
            this.generateFinalReport(result);

            return result;
        } catch (error) {
            const errorMsg = `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            result.success = false;
            result.rollbackDuration = Date.now() - this.startTime.getTime();

            console.error('❌ Rollback failed:', error);
            logger.error('Rollback failed', error);

            return result;
        }
    }

    private async validateBackupFile(result: RollbackResult): Promise<void> {
        console.log('🔍 Validating backup file...');

        // Check if backup file exists
        if (!existsSync(this.options.backupFile)) {
            throw new Error(`Backup file not found: ${this.options.backupFile}`);
        }

        // Get backup file info
        const stats = statSync(this.options.backupFile);
        result.backupSize = stats.size;
        result.backupDate = stats.mtime;

        // Check if backup file is not empty
        if (stats.size === 0) {
            throw new Error('Backup file is empty');
        }

        // Check if backup file is a SQLite database
        const fs = require('fs');
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(this.options.backupFile, 'r');
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        const sqliteHeader = 'SQLite format 3\0';
        if (buffer.toString('ascii', 0, 16) !== sqliteHeader) {
            throw new Error('Backup file is not a valid SQLite database');
        }

        console.log(`✅ Backup file validated: ${this.formatFileSize(result.backupSize)} (${result.backupDate.toISOString()})`);
        logger.info('Backup file validated', {
            backupFile: this.options.backupFile,
            size: result.backupSize,
            date: result.backupDate
        });
    }

    private async confirmRollback(result: RollbackResult): Promise<boolean> {
        console.log('\n' + '⚠️'.repeat(20));
        console.log('WARNING: You are about to rollback the database!');
        console.log('This will replace the current database with the backup.');
        console.log('All data changes since the backup will be LOST!');
        console.log('⚠️'.repeat(20));
        console.log('');
        console.log(`Backup file: ${this.options.backupFile}`);
        console.log(`Backup size: ${this.formatFileSize(result.backupSize)}`);
        console.log(`Backup date: ${result.backupDate.toLocaleString()}`);
        console.log('');

        // In a real CLI environment, you would use readline to get user input
        // For now, we'll assume confirmation if not forced
        console.log('Use --force flag to skip this confirmation');
        return false; // Require explicit --force flag
    }

    private async performRollback(result: RollbackResult): Promise<void> {
        console.log('🔄 Performing database rollback...');

        try {
            // Close all database connections
            console.log('📤 Closing database connections...');
            await dbManager.close();

            // Get current database path
            const currentDbPath = path.join(process.cwd(), 'data', 'database.db');

            // Create backup of current database before rollback
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const preRollbackBackup = path.join(
                path.dirname(currentDbPath),
                `pre-rollback-backup-${timestamp}.db`
            );

            if (existsSync(currentDbPath)) {
                console.log(`📦 Creating pre-rollback backup: ${preRollbackBackup}`);
                copyFileSync(currentDbPath, preRollbackBackup);
                result.warnings.push(`Pre-rollback backup created: ${preRollbackBackup}`);
            }

            // Restore from backup
            console.log('📥 Restoring database from backup...');
            copyFileSync(this.options.backupFile, currentDbPath);

            // Reinitialize database manager
            console.log('🔌 Reinitializing database connections...');
            await dbManager.initialize();

            console.log('✅ Database rollback completed');
            logger.info('Database rollback completed', {
                backupFile: this.options.backupFile,
                preRollbackBackup
            });
        } catch (error) {
            const errorMsg = `Failed to perform rollback: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            throw error;
        }
    }

    private async verifyRollback(result: RollbackResult): Promise<void> {
        console.log('🔍 Verifying rollback...');

        try {
            const verifier = new MigrationVerifier();
            const quickVerifyResult = await verifier.quickVerify();

            result.verificationResult = quickVerifyResult;

            if (quickVerifyResult.success) {
                console.log(`✅ Rollback verification passed: ${quickVerifyResult.message}`);
            } else {
                console.log(`⚠️  Rollback verification warning: ${quickVerifyResult.message}`);
                result.warnings.push(`Verification warning: ${quickVerifyResult.message}`);
            }

            logger.info('Rollback verification completed', quickVerifyResult);
        } catch (error) {
            const errorMsg = `Rollback verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.warnings.push(errorMsg);
            logger.warn('Rollback verification failed', error);
        }
    }

    private generateFinalReport(result: RollbackResult): void {
        console.log('\n' + '='.repeat(60));
        console.log('ROLLBACK REPORT');
        console.log('='.repeat(60));
        console.log(result.success ? '✅ Rollback completed successfully!' : '❌ Rollback completed with errors');
        console.log('');
        console.log(`📦 Backup file: ${result.backupFile}`);
        console.log(`📊 Backup size: ${this.formatFileSize(result.backupSize)}`);
        console.log(`📅 Backup date: ${result.backupDate.toLocaleString()}`);
        console.log(`⏱️  Rollback duration: ${this.formatDuration(result.rollbackDuration)}`);

        if (result.verificationResult) {
            console.log(`🔍 Verification: ${result.verificationResult.success ? '✅ PASSED' : '⚠️ WARNING'}`);
            console.log(`   ${result.verificationResult.message}`);
        }

        if (result.errors.length > 0) {
            console.log(`❌ Errors: ${result.errors.length}`);
            result.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        if (result.warnings.length > 0) {
            console.log(`⚠️  Warnings: ${result.warnings.length}`);
            result.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
        }

        console.log('='.repeat(60));

        if (result.success) {
            console.log('\n🎉 Database successfully rolled back!');
            console.log('Your database has been restored to the backup state.');
            console.log('Please test your application to ensure everything works correctly.');
        } else {
            console.log('\n⚠️  Rollback completed with issues.');
            console.log('Please review the errors above and check your database state.');
        }
    }

    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
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
     * List available backup files
     */
    public static listBackups(): void {
        const backupDir = path.join(process.cwd(), 'data', 'backups');

        if (!existsSync(backupDir)) {
            console.log('No backup directory found');
            return;
        }

        const fs = require('fs');
        const files = fs.readdirSync(backupDir)
            .filter((file: string) => file.endsWith('.db'))
            .map((file: string) => {
                const filePath = path.join(backupDir, file);
                const stats = statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: stats.size,
                    date: stats.mtime
                };
            })
            .sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

        if (files.length === 0) {
            console.log('No backup files found');
            return;
        }

        console.log('Available backup files:');
        console.log('='.repeat(80));
        files.forEach((file: any, index: number) => {
            console.log(`${index + 1}. ${file.name}`);
            console.log(`   Path: ${file.path}`);
            console.log(`   Size: ${this.prototype.formatFileSize(file.size)}`);
            console.log(`   Date: ${file.date.toLocaleString()}`);
            console.log('');
        });
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help') {
        console.log('Migration Rollback Tool');
        console.log('Usage: tsx rollback-migration.ts <backup-file> [options]');
        console.log('       tsx rollback-migration.ts --list-backups');
        console.log('');
        console.log('Options:');
        console.log('  --no-verify        Skip rollback verification');
        console.log('  --force            Skip confirmation prompt');
        console.log('  --list-backups     List available backup files');
        console.log('  --help             Show this help message');
        process.exit(0);
    }

    if (args[0] === '--list-backups') {
        MigrationRollback.listBackups();
        process.exit(0);
    }

    const backupFile = args[0];
    if (!backupFile) {
        console.error('Backup file is required');
        process.exit(1);
    }
    const options: RollbackOptions = { backupFile };

    // Parse command line options
    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--no-verify':
                options.verify = false;
                break;
            case '--force':
                options.force = true;
                break;
        }
    }

    const rollback = new MigrationRollback(options);

    rollback.executeRollback()
        .then((result) => {
            process.exit(result.success ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Fatal error:', error);
            logger.error('Fatal rollback error', error);
            process.exit(1);
        });
}

export { MigrationRollback, RollbackOptions, RollbackResult };