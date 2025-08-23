# Supabase Data Export Utilities

This directory contains utilities for exporting data from Supabase and preparing it for migration to SQLite.

## Overview

The export process consists of several stages:

1. **Data Export**: Fetch all data from Supabase tables
2. **Data Transformation**: Convert Supabase format to SQLite-compatible format
3. **Data Validation**: Validate data integrity and format compliance
4. **Progress Tracking**: Monitor export progress with detailed reporting
5. **File Generation**: Create multiple output files for different purposes

## Files

### Scripts
- `export-supabase-data.ts` - Main export script with comprehensive functionality

### Utilities
- `../utils/data-transformer.ts` - Data format transformation utilities
- `../utils/data-validator.ts` - Data validation and integrity checking
- `../utils/progress-tracker.ts` - Progress tracking and reporting

## Usage

### Prerequisites

1. Set up environment variables in `.env`:
```bash
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

2. Ensure you have the required dependencies:
```bash
npm install @supabase/supabase-js
```

### Running the Export

#### Command Line
```bash
# From backend directory
npm run export:supabase

# Or directly with tsx
tsx src/scripts/export-supabase-data.ts
```

#### Programmatic Usage
```typescript
import { SupabaseDataExporter } from './src/scripts/export-supabase-data.js';

const exporter = new SupabaseDataExporter();
const success = await exporter.exportAll();

if (success) {
  console.log('Export completed successfully');
} else {
  console.log('Export completed with errors');
}
```

## Output Files

The export process creates several files in the `data/exports/` directory:

### 1. Raw Export Data
- **File**: `supabase-raw-export-{timestamp}.json`
- **Purpose**: Original data as exported from Supabase
- **Format**: JSON with original Supabase structure

### 2. Transformed Data
- **File**: `supabase-transformed-export-{timestamp}.json`
- **Purpose**: Data transformed for SQLite compatibility
- **Format**: JSON with SQLite-compatible structure
- **Use**: Ready for import into SQLite database

### 3. Progress Report
- **File**: `export-report-{timestamp}.txt`
- **Purpose**: Detailed progress and execution report
- **Contents**: Step-by-step progress, timing, errors, warnings

### 4. Validation Report
- **File**: `validation-report-{timestamp}.txt`
- **Purpose**: Data validation results and integrity checks
- **Contents**: Schema validation, business rule validation, referential integrity

### 5. Summary
- **File**: `export-summary-{timestamp}.json`
- **Purpose**: High-level summary of export results
- **Contents**: Record counts, processing time, file references

## Data Transformation

### User Data
- Normalizes role values (`faculty`, `hod`, `admin`)
- Ensures password hashes are present (uses default if missing)
- Validates email formats and employee IDs
- Handles missing timestamps

### Department Data
- Validates department names and codes
- Ensures proper HOD references
- Handles missing timestamps

### Submission Data
- Normalizes module types (`attended`, `organized`, `certification`)
- Normalizes status values (`pending`, `approved`, `rejected`)
- Converts form_data to JSON strings for SQLite
- Validates user references

### Notification Data
- Converts boolean read_flag to integer (SQLite compatibility)
- Validates user references
- Ensures message content is present

## Validation Rules

### Schema Validation
- UUID format validation for IDs
- Required field presence
- Data type validation
- Format validation (emails, timestamps)

### Business Rule Validation
- Unique constraints (employee IDs, emails, department names)
- Valid enum values (roles, statuses, module types)
- JSON format validation for form data

### Referential Integrity
- User department references
- Department HOD references
- Submission user references
- Notification user references

## Error Handling

### Error Types
1. **Connection Errors**: Supabase connection issues
2. **Data Errors**: Invalid or missing data
3. **Transformation Errors**: Data format conversion issues
4. **Validation Errors**: Schema or business rule violations
5. **File System Errors**: File writing issues

### Error Recovery
- Individual record failures don't stop the entire export
- Detailed error logging for troubleshooting
- Partial exports are saved even if some steps fail
- Validation warnings don't prevent export completion

## Progress Tracking

### Features
- Real-time progress display
- Step-by-step execution tracking
- Time estimation and elapsed time
- Error and warning collection
- Detailed metadata for each step

### Progress Events
The progress tracker emits events that can be monitored:
- `progress` - General progress updates
- `step_started` - When a step begins
- `step_completed` - When a step completes successfully
- `step_failed` - When a step fails
- `step_skipped` - When a step is skipped
- `error` - When an error occurs
- `warning` - When a warning is issued

## Configuration

### Environment Variables
```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (with defaults)
NODE_ENV=development
LOG_LEVEL=info
```

### Customization
You can customize the export behavior by modifying:
- Table selection in export methods
- Transformation rules in `data-transformer.ts`
- Validation rules in `data-validator.ts`
- Progress steps in the constructor

## Troubleshooting

### Common Issues

#### 1. Connection Errors
```
Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
```
**Solution**: Ensure environment variables are properly set in `.env`

#### 2. Permission Errors
```
Error: Failed to export users: permission denied
```
**Solution**: Verify service role key has read permissions on all tables

#### 3. Data Validation Failures
```
Warning: User at index 5 missing required fields
```
**Solution**: Check source data quality in Supabase, fix if necessary

#### 4. File System Errors
```
Error: ENOENT: no such file or directory, open 'data/exports/...'
```
**Solution**: Ensure `data/exports` directory exists and is writable

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about each step of the export process.

## Performance Considerations

### Large Datasets
- The export loads all data into memory
- For very large datasets (>100k records), consider:
  - Increasing Node.js memory limit: `node --max-old-space-size=4096`
  - Implementing batch processing
  - Using streaming for file operations

### Network Timeouts
- Supabase queries may timeout for large tables
- Consider implementing retry logic for failed requests
- Monitor network connectivity during export

## Security Notes

- Service role keys have elevated permissions
- Export files may contain sensitive data
- Store export files securely
- Consider encrypting export files for production use
- Rotate service role keys after migration

## Next Steps

After successful export:

1. Review validation reports for data quality issues
2. Use transformed data file for SQLite import
3. Verify record counts match expectations
4. Test import process with sample data
5. Plan for file cleanup after successful migration