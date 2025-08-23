# Database Utilities

This directory contains the database connection and management utilities for the FDTS backend.

## Files

- `database.ts` - Core database manager with connection pooling and transaction management
- `database-init.ts` - Database initialization and schema management utilities
- `db.ts` - Main export module providing a clean interface for database operations
- `logger.ts` - Winston-based logging utility

## Usage

### Basic Database Operations

```typescript
import { dbManager, DatabaseInitializer } from '../utils/db.js';

// Initialize database (creates schema if needed)
await DatabaseInitializer.initialize();

// Execute a query
const users = await dbManager.executeQuery('SELECT * FROM users WHERE role = ?', ['faculty']);

// Execute a single query
const user = await dbManager.executeQuerySingle('SELECT * FROM users WHERE id = ?', [userId]);

// Execute an update/insert/delete
const result = await dbManager.executeUpdate('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [id, name, email]);

// Execute a transaction
await dbManager.executeTransaction(async (db) => {
  await db.run('INSERT INTO users (id, name) VALUES (?, ?)', [id, name]);
  await db.run('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)', [id, 'user_created']);
});
```

### Connection Management

The database manager automatically handles connection pooling:

- Maximum 10 concurrent connections
- Automatic connection creation and cleanup
- Connection reuse for better performance
- Graceful handling of connection limits

### Health Monitoring

```typescript
// Check database health
const isHealthy = await dbManager.healthCheck();

// Get database statistics
const stats = await dbManager.getStats();
console.log('Active connections:', stats.activeConnections);
console.log('Pool size:', stats.poolSize);
console.log('Database size:', stats.databaseSize);
```

### Database Schema

The database includes the following tables:

- `users` - User accounts with authentication and role information
- `departments` - Department information with HoD relationships
- `submissions` - Faculty development submissions with status tracking
- `notifications` - User notifications
- `audit_logs` - System audit trail

### Configuration

Database configuration is managed through environment variables:

- `DATABASE_PATH` - Path to SQLite database file (default: `./data/fdts.db`)
- `DATABASE_BACKUP_PATH` - Path for database backups (default: `./data/backups`)

### Performance Features

- **WAL Mode**: Enabled for better concurrency
- **Connection Pooling**: Up to 10 concurrent connections
- **Prepared Statements**: All queries use prepared statements for security and performance
- **Indexing**: Strategic indexes on frequently queried columns
- **Transaction Management**: Automatic rollback on errors

### Security Features

- **Foreign Key Constraints**: Enabled for data integrity
- **SQL Injection Prevention**: All queries use prepared statements
- **Connection Limits**: Prevents resource exhaustion
- **Error Handling**: Comprehensive error logging and handling

## Testing

Run the database test script to verify functionality:

```bash
npx tsx src/scripts/test-database.ts
```

This will test:
- Database initialization
- Connection management
- Query execution
- Transaction handling
- Health monitoring
- Statistics collection