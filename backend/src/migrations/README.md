# Database Migrations

This directory contains database migration files for the Faculty Development Tracking System (FDTS) SQLite database.

## Overview

The migration system provides:
- **Version Control**: Track database schema changes over time
- **Automated Deployment**: Apply schema changes consistently across environments
- **Rollback Support**: Ability to rollback the last applied migration
- **Integrity Validation**: Verify migration and schema integrity
- **Performance Optimization**: Automated index creation and optimization

## Migration Files

### Current Migrations

1. **001_initial_schema.sql** - Creates the initial database schema matching the Supabase structure
   - Creates all core tables: departments, users, submissions, notifications, audit_logs
   - Implements proper foreign key constraints and data validation
   - Adds CHECK constraints for data integrity

2. **002_create_indexes.sql** - Creates performance optimization indexes
   - Adds indexes for frequently queried columns
   - Creates composite indexes for common query patterns
   - Optimizes performance for large datasets

## Usage

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Show migration status
npm run migrate status

# Validate migration integrity
npm run migrate validate

# Validate database schema
npm run migrate schema
```

### Creating New Migrations

```bash
# Create a new migration file
npm run migrate create "Add user preferences table"
```

This will create a new migration file with a timestamp-based version number and a template for your SQL statements.

### Rollback

```bash
# Rollback the last applied migration
npm run migrate rollback
```

**Warning**: Rollback only removes the migration record from the tracking table. Schema changes are not automatically reverted and may require manual cleanup.

## Migration File Format

Migration files should follow this format:

```sql
-- Migration: 003_add_user_preferences
-- Description: Add user preferences table for storing user settings
-- Created: 2025-01-23

-- Your SQL statements here
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    preferences TEXT NOT NULL, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
```

## Best Practices

### 1. Migration Naming
- Use descriptive names that clearly indicate what the migration does
- Use snake_case for consistency
- Include the purpose (create, add, modify, remove, etc.)

### 2. SQL Guidelines
- Always use `IF NOT EXISTS` for CREATE statements
- Include proper constraints and foreign keys
- Add appropriate indexes for performance
- Use transactions for complex operations
- Include comments for complex logic

### 3. Data Safety
- Test migrations on a copy of production data first
- Always backup the database before running migrations in production
- Validate data integrity after migrations
- Consider the impact on existing data

### 4. Performance Considerations
- Create indexes for frequently queried columns
- Use composite indexes for multi-column queries
- Consider the size of existing data when adding constraints
- Monitor query performance after schema changes

## Schema Validation

The system includes comprehensive schema validation that checks:

### Table Structure
- Presence of all required tables
- Column definitions and types
- Primary key constraints
- Foreign key relationships

### Data Integrity
- Foreign key constraint violations
- CHECK constraint compliance
- Unique constraint violations
- Data type consistency

### Performance Optimization
- Index presence and effectiveness
- Query optimization opportunities
- Database configuration settings

## Troubleshooting

### Common Issues

1. **Migration Fails**
   - Check the error message in the logs
   - Verify SQL syntax
   - Ensure foreign key dependencies are met
   - Check for data conflicts

2. **Schema Validation Fails**
   - Run `npm run migrate validate` to check migration integrity
   - Verify all required tables exist
   - Check foreign key constraints are enabled
   - Ensure indexes are properly created

3. **Performance Issues**
   - Review query execution plans
   - Check if appropriate indexes exist
   - Monitor database size and growth
   - Consider query optimization

### Recovery Procedures

1. **Corrupted Migration State**
   ```bash
   # Check migration status
   npm run migrate status
   
   # Validate integrity
   npm run migrate validate
   
   # If needed, manually fix migration records in schema_migrations table
   ```

2. **Schema Inconsistencies**
   ```bash
   # Validate current schema
   npm run migrate schema
   
   # Check for specific issues and fix manually
   # Re-run migrations if needed
   ```

## Development Workflow

### Adding New Features

1. **Plan the Schema Changes**
   - Design the new tables/columns needed
   - Consider impact on existing data
   - Plan for indexes and constraints

2. **Create Migration**
   ```bash
   npm run migrate create "Add feature X tables"
   ```

3. **Write Migration SQL**
   - Edit the generated migration file
   - Add CREATE TABLE statements
   - Include appropriate indexes
   - Add any data transformation needed

4. **Test Migration**
   ```bash
   # Test on development database
   npm run migrate
   
   # Validate schema
   npm run migrate schema
   
   # Test rollback if needed
   npm run migrate rollback
   ```

5. **Deploy to Production**
   - Backup production database
   - Run migration during maintenance window
   - Validate schema and data integrity
   - Monitor performance

## Monitoring and Maintenance

### Regular Tasks

1. **Monitor Migration Status**
   - Check that all environments are up to date
   - Verify migration integrity regularly
   - Monitor database performance

2. **Database Maintenance**
   - Regular backups
   - Analyze query performance
   - Monitor database size growth
   - Update statistics and optimize queries

3. **Schema Evolution**
   - Plan for future schema changes
   - Consider backward compatibility
   - Document schema decisions
   - Review and optimize existing indexes

## Security Considerations

- Migration files may contain sensitive schema information
- Ensure proper access controls on migration files
- Use environment variables for sensitive configuration
- Audit migration execution in production
- Validate data integrity after migrations

## Support

For issues with migrations:
1. Check the logs for detailed error messages
2. Validate migration integrity with `npm run migrate validate`
3. Review the schema with `npm run migrate schema`
4. Consult this documentation for troubleshooting steps
5. Contact the development team for complex issues