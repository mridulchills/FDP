import { dbManager } from './database.js';
import { logger } from './logger.js';
import { MigrationManager } from './migration-manager.js';
import { SchemaValidator } from './schema-validator.js';
// import type { Database } from './database.js';

/**
 * Database initialization and schema management utilities
 */
export class DatabaseInitializer {
  /**
   * Initialize the database with schema and initial data
   */
  public static async initialize(): Promise<void> {
    try {
      logger.info('Starting database initialization...');
      
      // Initialize the database manager
      await dbManager.initialize();
      
      // Run migrations to create/update schema
      await this.runMigrations();
      
      // Verify schema integrity
      await this.verifySchema();
      
      logger.info('Database initialization completed successfully');
    } catch (error) {
      logger.error('Database initialization failed', { error });
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  private static async runMigrations(): Promise<void> {
    try {
      logger.info('Running database migrations...');
      
      const results = await MigrationManager.migrate();
      
      if (results.length > 0) {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        logger.info(`Migration results: ${successful} successful, ${failed} failed`);
        
        if (failed > 0) {
          const failedMigrations = results.filter(r => !r.success);
          logger.error('Some migrations failed', { failedMigrations });
          throw new Error(`${failed} migrations failed`);
        }
      } else {
        logger.info('No migrations needed - database is up to date');
      }
    } catch (error) {
      logger.error('Migration process failed', { error });
      throw error;
    }
  }



  /**
   * Verify schema integrity using the schema validator
   */
  private static async verifySchema(): Promise<void> {
    try {
      logger.info('Verifying database schema...');
      
      const validationResult = await SchemaValidator.validateSchema();
      
      if (!validationResult.valid) {
        logger.error('Schema validation failed', {
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
        throw new Error(`Schema validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      if (validationResult.warnings.length > 0) {
        logger.warn('Schema validation completed with warnings', {
          warnings: validationResult.warnings
        });
      }
      
      logger.info('Database schema verification completed successfully', {
        tables: validationResult.tableInfo.length,
        warnings: validationResult.warnings.length
      });
    } catch (error) {
      logger.error('Schema verification failed', { error });
      throw error;
    }
  }

  /**
   * Check if database needs initialization
   */
  public static async needsInitialization(): Promise<boolean> {
    try {
      const tables = await dbManager.executeQuery(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `);
      
      return tables.length === 0;
    } catch (error) {
      logger.error('Failed to check if database needs initialization', { error });
      return true; // Assume it needs initialization if we can't check
    }
  }

  /**
   * Reset database (drop all tables and recreate schema)
   * WARNING: This will delete all data!
   */
  public static async reset(): Promise<void> {
    try {
      logger.warn('Resetting database - all data will be lost!');
      
      const db = await dbManager.getMainConnection();
      
      // Drop all tables in reverse order to respect foreign key constraints
      const dropTables = [
        'DROP TABLE IF EXISTS audit_logs;',
        'DROP TABLE IF EXISTS notifications;',
        'DROP TABLE IF EXISTS submissions;',
        'DROP TABLE IF EXISTS users;',
        'DROP TABLE IF EXISTS departments;'
      ];
      
      for (const dropSql of dropTables) {
        await db.exec(dropSql);
      }
      
      logger.info('All tables dropped');
      
      // Recreate schema
      await this.runMigrations();
      
      logger.info('Database reset completed');
    } catch (error) {
      logger.error('Database reset failed', { error });
      throw error;
    }
  }

  /**
   * Get database information
   */
  public static async getDatabaseInfo(): Promise<{
    version: string;
    encoding: string;
    pageSize: number;
    pageCount: number;
    size: number;
    tables: string[];
  }> {
    try {
      const versionResult = await dbManager.executeQuerySingle('SELECT sqlite_version() as version;');
      const encodingResult = await dbManager.executeQuerySingle('PRAGMA encoding;');
      const pageSizeResult = await dbManager.executeQuerySingle('PRAGMA page_size;');
      const pageCountResult = await dbManager.executeQuerySingle('PRAGMA page_count;');
      
      const tables = await dbManager.executeQuery(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
      `);
      
      const pageSize = pageSizeResult?.page_size || 0;
      const pageCount = pageCountResult?.page_count || 0;
      
      return {
        version: versionResult?.version || 'unknown',
        encoding: encodingResult?.encoding || 'unknown',
        pageSize,
        pageCount,
        size: pageSize * pageCount,
        tables: tables.map((row: any) => row.name)
      };
    } catch (error) {
      logger.error('Failed to get database info', { error });
      throw error;
    }
  }
}