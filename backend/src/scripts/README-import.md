# SQLite Data Import System

This document describes the SQLite data import system that handles batch data import with transaction management, duplicate detection, and rollback capabilities.

## Overview

The import system consists of several components:

1. **SQLiteDataImporter** - Main import class with batch processing
2. **MigrationVerifier** - Verifies data integrity after import
3. **CompleteMigrationManager** - Orchestrates the complete migration process
4. **MigrationRollback** - Handles rollback operations

## Features

- **Batch Processing**: Imports data in configurable batches for better performance
- **Transaction Management**: Uses database transactions for data consistency
- **Duplicate Detection**: Identifies and handles duplicate records
- **Data Validation**: Validates data integrity before and after import
- **Backup Creation**: Creates database backups before import
- **Rollback Support**: Can rollback to previous state using backups
- **Progress Tracking**: Real-time progress reporting with detailed logging
- **Error Handling**: Comprehensive error handling with detailed reporting

## Usage

### Complete Migration (Recommended)

The complete migration script handles export, import, and verification:

```bash
# Complete migration from Supabase to SQLite
tsx complete-migration.ts

# Export only
tsx complete-migration.ts --export-only

# Import only (requires existing export file)
tsx complete-migration.ts --import-only --import-file data/exports/export-file.json

# Dry run (no actual import)
tsx complete-migration.ts --dry-run

# Skip verification
tsx complete-migration.ts --skip-verification

# Custom batch size
tsx complete-migration.ts --batch-size 50
```

### Direct Import

Import data directly from an export file:

```bash
# Basic import
tsx import-sqlite-data.ts data/exports/export-file.json

# Import with custom options
tsx import-sqlite-data.ts data/exports/export-file.json \
  --batch-size 200 \
  --skip-duplicates \
  --no-validation \
  --no-backup

# Dry run
tsx import-sqlite-data.ts data/exports/export-file.json --dry-run
```

### Verification

Verify migration integrity:

```bash
# Run verification script directly
tsx verify-migration.ts

# Quick verification
tsx verify-migration.ts --quick
```

### Rollback

Rollback to a previous backup:

```bash
# List available backups
tsx rollback-migration.ts --list-backups

# Rollback to specific backup
tsx rollback-migration.ts data/backups/backup-file.db --force

# Rollback with verification
tsx rollback-migration.ts data/backups/backup-file.db --verify
```

## Import Options

### SQLiteDataImporter Options

- `batchSize` (default: 100) - Number of records to process in each batch
- `skipDuplicates` (default: true) - Skip duplicate records instead of updating
- `validateData` (default: true) - Validate data before import
- `createBackup` (default: true) - Create backup before import
- `dryRun` (default: false) - Perform dry run without actual import

### Command Line Options

- `--batch-size <number>` - Set batch size for imports
- `--skip-duplicates` - Skip duplicate records (default behavior)
- `--no-validation` - Skip data validation
- `--no-backup` - Skip backup creation
- `--dry-run` - Perform dry run without importing

## Data Format

The import system expects JSON files with the following structure:

```json
{
  "users": [
    {
      "id": "uuid",
      "employee_id": "string",
      "name": "string",
      "email": "string",
      "role": "faculty|hod|admin",
      "department_id": "uuid|null",
      "designation": "string|null",
      "institution": "string|null",
      "password_hash": "string",
      "created_at": "ISO timestamp",
      "updated_at": "ISO timestamp"
    }
  ],
  "departments": [
    {
      "id": "uuid",
      "name": "string",
      "code": "string|null",
      "hod_user_id": "uuid|null",
      "created_at": "ISO timestamp",
      "updated_at": "ISO timestamp"
    }
  ],
  "submissions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "module_type": "attended|organized|certification",
      "status": "pending|approved|rejected",
      "form_data": "JSON string",
      "document_url": "string|null",
      "hod_comment": "string|null",
      "admin_comment": "string|null",
      "created_at": "ISO timestamp",
      "updated_at": "ISO timestamp"
    }
  ],
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "message": "string",
      "link": "string|null",
      "read_flag": 0|1,
      "created_at": "ISO timestamp"
    }
  ]
}
```

## Import Process

### 1. Data Loading
- Reads and parses the import file
- Validates file structure
- Calculates total record counts

### 2. Data Validation (Optional)
- Validates each record against schema
- Checks data types and constraints
- Identifies data quality issues

### 3. Backup Creation (Optional)
- Creates a backup of the current database
- Uses SQLite VACUUM INTO for efficient backup

### 4. Duplicate Detection
- Identifies existing records that would conflict
- Uses business keys (employee_id, email, name, etc.)
- Provides options to skip or update duplicates

### 5. Batch Import
- Imports data in configurable batches
- Uses database transactions for consistency
- Maintains referential integrity
- Handles errors gracefully

### 6. Verification (Optional)
- Verifies record counts
- Checks referential integrity
- Validates data quality
- Reports any issues found

## Error Handling

The import system provides comprehensive error handling:

### Import Errors
- **Schema Validation Errors**: Invalid data types or missing required fields
- **Referential Integrity Errors**: References to non-existent records
- **Duplicate Key Errors**: Conflicts with existing unique constraints
- **Database Errors**: Connection issues, constraint violations, etc.

### Error Recovery
- **Transaction Rollback**: Automatic rollback on batch failures
- **Partial Import**: Continue with remaining batches after errors
- **Error Reporting**: Detailed error logs with record-level information
- **Backup Restoration**: Rollback to pre-import state if needed

## Performance Considerations

### Batch Size
- Larger batches: Better performance, more memory usage
- Smaller batches: Lower memory usage, more transaction overhead
- Recommended: 100-500 records per batch

### Database Configuration
- WAL mode enabled for better concurrency
- Increased cache size for better performance
- Prepared statements for efficient queries
- Connection pooling for multiple operations

### Memory Usage
- Streaming JSON parsing for large files
- Batch processing to limit memory usage
- Connection pooling to manage resources
- Progress tracking with minimal overhead

## Monitoring and Logging

### Progress Tracking
- Real-time progress display
- Step-by-step progress reporting
- Estimated completion time
- Error and warning counts

### Logging
- Structured logging with Winston
- Different log levels (debug, info, warn, error)
- File and console output
- Request/response logging for debugging

### Reports
- Import summary reports
- Detailed progress reports
- Validation reports
- Error and warning summaries

## Best Practices

### Before Import
1. **Backup Current Data**: Always create backups before import
2. **Validate Export Data**: Ensure export data is complete and valid
3. **Test with Dry Run**: Use dry run to identify potential issues
4. **Check Disk Space**: Ensure sufficient space for import and backups

### During Import
1. **Monitor Progress**: Watch for errors and warnings
2. **Check System Resources**: Monitor CPU, memory, and disk usage
3. **Avoid Interruption**: Don't interrupt the import process
4. **Review Logs**: Check logs for any issues

### After Import
1. **Verify Data**: Run verification to ensure data integrity
2. **Test Application**: Thoroughly test application functionality
3. **Monitor Performance**: Check for any performance issues
4. **Keep Backups**: Maintain backups for rollback if needed

## Troubleshooting

### Common Issues

#### Import Fails with "Database is locked"
- Ensure no other processes are using the database
- Check for long-running transactions
- Restart the application if necessary

#### Out of Memory Errors
- Reduce batch size
- Close other applications
- Increase system memory if possible

#### Referential Integrity Errors
- Check data export for missing references
- Verify import order (departments before users, users before submissions)
- Review foreign key constraints

#### Duplicate Key Errors
- Use `--skip-duplicates` option
- Clean up duplicate data in export
- Review unique constraints

### Recovery Procedures

#### Partial Import Failure
1. Review error logs to identify issues
2. Fix data issues in export file
3. Use rollback if necessary
4. Re-run import with corrected data

#### Complete Import Failure
1. Check error logs for root cause
2. Rollback to backup if database is corrupted
3. Fix underlying issues
4. Re-run complete migration

#### Data Corruption
1. Stop application immediately
2. Rollback to most recent backup
3. Investigate corruption cause
4. Re-run migration with fixes

## File Locations

### Data Files
- **Exports**: `data/exports/`
- **Backups**: `data/backups/`
- **Reports**: `data/reports/`
- **Database**: `data/database.db`

### Log Files
- **Application Logs**: `logs/`
- **Import Logs**: Included in application logs
- **Error Logs**: `logs/error.log`

### Scripts
- **Import Script**: `src/scripts/import-sqlite-data.ts`
- **Complete Migration**: `src/scripts/complete-migration.ts`
- **Rollback Script**: `src/scripts/rollback-migration.ts`
- **Verification Script**: `src/utils/migration-verification.ts`

## API Reference

### SQLiteDataImporter

```typescript
class SQLiteDataImporter {
  constructor(options?: Partial<ImportOptions>)
  
  // Import from file
  async importFromFile(filePath: string): Promise<ImportResult>
  
  // Import from data object
  async importData(data: ImportData): Promise<ImportResult>
  
  // Rollback to backup
  async rollback(backupFile: string): Promise<boolean>
}
```

### MigrationVerifier

```typescript
class MigrationVerifier {
  // Full verification
  async verifyMigration(): Promise<VerificationResult>
  
  // Quick verification
  async quickVerify(): Promise<{ success: boolean; message: string }>
  
  // Format verification report
  static formatVerificationReport(result: VerificationResult): string
}
```

### CompleteMigrationManager

```typescript
class CompleteMigrationManager {
  constructor(options?: MigrationOptions)
  
  // Execute complete migration
  async executeMigration(): Promise<MigrationResult>
}
```

### MigrationRollback

```typescript
class MigrationRollback {
  constructor(options: RollbackOptions)
  
  // Execute rollback
  async executeRollback(): Promise<RollbackResult>
  
  // List available backups
  static listBackups(): void
}
```