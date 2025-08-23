import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { dbManager } from './database.js';
import { logger } from './logger.js';
import type { Database } from './database.js';

/**
 * Migration information interface
 */
export interface Migration {
  version: string;
  description: string;
  filename: string;
  sql: string;
  checksum: string;
}

/**
 * Applied migration record from database
 */
export interface AppliedMigration {
  version: string;
  description: string;
  applied_at: string;
  checksum: string;
}

/**
 * Migration result interface
 */
export interface MigrationResult {
  version: string;
  description: string;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * Database migration manager with version control
 */
export class MigrationManager {
  private static readonly MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'migrations');
  private static readonly MIGRATION_TABLE = 'schema_migrations';

  /**
   * Run all pending migrations
   */
  public static async migrate(): Promise<MigrationResult[]> {
    try {
      logger.info('Starting database migration process...');
      
      // Ensure migration tracking table exists
      await this.ensureMigrationTable();
      
      // Get all available migrations
      const availableMigrations = await this.getAvailableMigrations();
      
      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      
      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedVersions.has(migration.version)
      );
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return [];
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migrations`, {
        pending: pendingMigrations.map(m => m.version)
      });
      
      // Apply migrations in order
      const results: MigrationResult[] = [];
      
      for (const migration of pendingMigrations) {
        const result = await this.applyMigration(migration);
        results.push(result);
        
        if (!result.success) {
          logger.error(`Migration ${migration.version} failed, stopping migration process`);
          break;
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      logger.info(`Migration process completed: ${successCount}/${results.length} successful`);
      
      return results;
    } catch (error) {
      logger.error('Migration process failed', { error });
      throw error;
    }
  }

  /**
   * Rollback the last applied migration
   */
  public static async rollback(): Promise<void> {
    try {
      logger.warn('Starting migration rollback...');
      
      const appliedMigrations = await this.getAppliedMigrations();
      
      if (appliedMigrations.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }
      
      // Get the last applied migration
      const lastMigration = appliedMigrations[appliedMigrations.length - 1];
      
      if (!lastMigration) {
        throw new Error('No migrations to rollback');
      }
      
      logger.warn(`Rolling back migration: ${lastMigration.version}`, {
        description: lastMigration.description,
        appliedAt: lastMigration.applied_at
      });
      
      // Remove the migration record
      await dbManager.executeUpdate(
        `DELETE FROM ${this.MIGRATION_TABLE} WHERE version = ?`,
        [lastMigration.version]
      );
      
      logger.warn(`Migration ${lastMigration.version} rolled back successfully`);
      logger.warn('Note: Schema changes were not automatically reverted. Manual cleanup may be required.');
    } catch (error) {
      logger.error('Migration rollback failed', { error });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  public static async getStatus(): Promise<{
    appliedMigrations: AppliedMigration[];
    pendingMigrations: Migration[];
    totalMigrations: number;
  }> {
    try {
      await this.ensureMigrationTable();
      
      const availableMigrations = await this.getAvailableMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedVersions.has(migration.version)
      );
      
      return {
        appliedMigrations,
        pendingMigrations,
        totalMigrations: availableMigrations.length
      };
    } catch (error) {
      logger.error('Failed to get migration status', { error });
      throw error;
    }
  }

  /**
   * Validate migration integrity
   */
  public static async validateMigrations(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    try {
      logger.info('Validating migration integrity...');
      
      const issues: string[] = [];
      
      // Check if migration table exists
      try {
        await this.ensureMigrationTable();
      } catch (error) {
        issues.push('Migration table could not be created or accessed');
        return { valid: false, issues };
      }
      
      // Get migrations
      const availableMigrations = await this.getAvailableMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Check for checksum mismatches
      for (const applied of appliedMigrations) {
        const available = availableMigrations.find(m => m.version === applied.version);
        
        if (!available) {
          issues.push(`Applied migration ${applied.version} not found in migration files`);
          continue;
        }
        
        if (available.checksum !== applied.checksum) {
          issues.push(`Checksum mismatch for migration ${applied.version}`);
        }
      }
      
      // Check for gaps in migration sequence
      const appliedVersions = appliedMigrations.map(m => m.version).sort();
      const availableVersions = availableMigrations.map(m => m.version).sort();
      
      for (let i = 0; i < appliedVersions.length - 1; i++) {
        const currentVersion = appliedVersions[i];
        const nextVersion = appliedVersions[i + 1];
        
        if (!currentVersion || !nextVersion) continue;
        
        const currentIndex = availableVersions.indexOf(currentVersion);
        const nextIndex = availableVersions.indexOf(nextVersion);
        
        if (nextIndex - currentIndex > 1) {
          const skippedVersions = availableVersions.slice(currentIndex + 1, nextIndex);
          issues.push(`Skipped migrations detected: ${skippedVersions.join(', ')}`);
        }
      }
      
      const valid = issues.length === 0;
      
      if (valid) {
        logger.info('Migration integrity validation passed');
      } else {
        logger.warn('Migration integrity validation failed', { issues });
      }
      
      return { valid, issues };
    } catch (error) {
      logger.error('Migration validation failed', { error });
      return {
        valid: false,
        issues: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Create a new migration file
   */
  public static async createMigration(description: string): Promise<string> {
    try {
      // Generate version number (timestamp-based)
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const version = `${timestamp}_${description.toLowerCase().replace(/\s+/g, '_')}`;
      const filename = `${version}.sql`;
      const filepath = path.join(this.MIGRATIONS_DIR, filename);
      
      // Create migration template
      const template = `-- Migration: ${version}
-- Description: ${description}
-- Created: ${new Date().toISOString().split('T')[0]}

-- Add your SQL statements here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id TEXT PRIMARY KEY,
--     name TEXT NOT NULL,
--     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );
`;
      
      // Ensure migrations directory exists
      await fs.mkdir(this.MIGRATIONS_DIR, { recursive: true });
      
      // Write migration file
      await fs.writeFile(filepath, template, 'utf8');
      
      logger.info(`Created new migration: ${filename}`);
      
      return filename;
    } catch (error) {
      logger.error('Failed to create migration', { error });
      throw error;
    }
  }

  /**
   * Ensure migration tracking table exists
   */
  private static async ensureMigrationTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.MIGRATION_TABLE} (
        version TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT NOT NULL
      );
    `;
    
    await dbManager.executeUpdate(sql);
  }

  /**
   * Get all available migration files
   */
  private static async getAvailableMigrations(): Promise<Migration[]> {
    try {
      // Ensure migrations directory exists
      await fs.mkdir(this.MIGRATIONS_DIR, { recursive: true });
      
      const files = await fs.readdir(this.MIGRATIONS_DIR);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort to ensure proper order
      
      const migrations: Migration[] = [];
      
      for (const filename of migrationFiles) {
        const filepath = path.join(this.MIGRATIONS_DIR, filename);
        const sql = await fs.readFile(filepath, 'utf8');
        
        // Extract version and description from filename or SQL content
        const version = filename.replace('.sql', '');
        const descriptionMatch = sql.match(/-- Description: (.+)/);
        const description = descriptionMatch?.[1]?.trim() || 'No description';
        
        // Calculate checksum
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');
        
        migrations.push({
          version,
          description,
          filename,
          sql,
          checksum
        });
      }
      
      return migrations;
    } catch (error) {
      logger.error('Failed to get available migrations', { error });
      throw error;
    }
  }

  /**
   * Get applied migrations from database
   */
  private static async getAppliedMigrations(): Promise<AppliedMigration[]> {
    try {
      const migrations = await dbManager.executeQuery<AppliedMigration>(
        `SELECT version, description, applied_at, checksum 
         FROM ${this.MIGRATION_TABLE} 
         ORDER BY applied_at ASC`
      );
      
      return migrations;
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      
      logger.error('Failed to get applied migrations', { error });
      throw error;
    }
  }

  /**
   * Apply a single migration
   */
  private static async applyMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Applying migration: ${migration.version}`, {
        description: migration.description
      });
      
      // Execute migration in a transaction
      await dbManager.executeTransaction(async (db: Database) => {
        // Execute the migration SQL
        await db.exec(migration.sql);
        
        // Record the migration as applied
        await db.run(
          `INSERT INTO ${this.MIGRATION_TABLE} (version, description, checksum) 
           VALUES (?, ?, ?)`,
          [migration.version, migration.description, migration.checksum]
        );
      });
      
      const duration = Date.now() - startTime;
      
      logger.info(`Migration ${migration.version} applied successfully`, {
        duration: `${duration}ms`
      });
      
      return {
        version: migration.version,
        description: migration.description,
        success: true,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Migration ${migration.version} failed`, {
        error: errorMessage,
        duration: `${duration}ms`
      });
      
      return {
        version: migration.version,
        description: migration.description,
        success: false,
        error: errorMessage,
        duration
      };
    }
  }
}