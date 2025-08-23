import { dbManager } from './database.js';
import { logger } from './logger.js';

/**
 * Schema validation result interface
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  tableInfo: TableInfo[];
}

/**
 * Table information interface
 */
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
  constraints: ConstraintInfo[];
}

/**
 * Column information interface
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

/**
 * Index information interface
 */
export interface IndexInfo {
  name: string;
  unique: boolean;
  columns: string[];
}

/**
 * Foreign key information interface
 */
export interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  onUpdate: string;
  onDelete: string;
  match: string;
}

/**
 * Constraint information interface
 */
export interface ConstraintInfo {
  type: 'CHECK' | 'UNIQUE' | 'PRIMARY KEY' | 'FOREIGN KEY';
  definition: string;
}

/**
 * Expected schema definition
 */
interface ExpectedSchema {
  tables: {
    [tableName: string]: {
      columns: {
        [columnName: string]: {
          type: string;
          nullable: boolean;
          primaryKey?: boolean;
          unique?: boolean;
          defaultValue?: string;
        };
      };
      indexes: {
        [indexName: string]: {
          columns: string[];
          unique?: boolean;
        };
      };
      foreignKeys: {
        [columnName: string]: {
          table: string;
          column: string;
          onDelete?: string;
          onUpdate?: string;
        };
      };
    };
  };
}

/**
 * Database schema validator
 */
export class SchemaValidator {
  /**
   * Expected schema definition based on our design
   */
  private static readonly EXPECTED_SCHEMA: ExpectedSchema = {
    tables: {
      departments: {
        columns: {
          id: { type: 'TEXT', nullable: false, primaryKey: true },
          name: { type: 'TEXT', nullable: false, unique: true },
          code: { type: 'TEXT', nullable: false, unique: true },
          hod_user_id: { type: 'TEXT', nullable: true },
          created_at: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
          updated_at: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' }
        },
        indexes: {
          idx_departments_name: { columns: ['name'] },
          idx_departments_code: { columns: ['code'] },
          idx_departments_hod_user_id: { columns: ['hod_user_id'] }
        },
        foreignKeys: {
          hod_user_id: { table: 'users', column: 'id', onDelete: 'SET NULL' }
        }
      },
      users: {
        columns: {
          id: { type: 'TEXT', nullable: false, primaryKey: true },
          employee_id: { type: 'TEXT', nullable: false, unique: true },
          name: { type: 'TEXT', nullable: false },
          email: { type: 'TEXT', nullable: false, unique: true },
          role: { type: 'TEXT', nullable: false },
          department_id: { type: 'TEXT', nullable: true },
          designation: { type: 'TEXT', nullable: true },
          institution: { type: 'TEXT', nullable: true },
          password_hash: { type: 'TEXT', nullable: false },
          created_at: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
          updated_at: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' }
        },
        indexes: {
          idx_users_employee_id: { columns: ['employee_id'] },
          idx_users_email: { columns: ['email'] },
          idx_users_department_id: { columns: ['department_id'] },
          idx_users_role: { columns: ['role'] },
          idx_users_created_at: { columns: ['created_at'] }
        },
        foreignKeys: {
          department_id: { table: 'departments', column: 'id', onDelete: 'SET NULL' }
        }
      },
      submissions: {
        columns: {
          id: { type: 'TEXT', nullable: false, primaryKey: true },
          user_id: { type: 'TEXT', nullable: false },
          module_type: { type: 'TEXT', nullable: false },
          status: { type: 'TEXT', nullable: false, defaultValue: 'pending' },
          form_data: { type: 'TEXT', nullable: false },
          document_url: { type: 'TEXT', nullable: true },
          hod_comment: { type: 'TEXT', nullable: true },
          admin_comment: { type: 'TEXT', nullable: true },
          created_at: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
          updated_at: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' }
        },
        indexes: {
          idx_submissions_user_id: { columns: ['user_id'] },
          idx_submissions_status: { columns: ['status'] },
          idx_submissions_module_type: { columns: ['module_type'] },
          idx_submissions_created_at: { columns: ['created_at'] },
          idx_submissions_user_status: { columns: ['user_id', 'status'] },
          idx_submissions_status_created: { columns: ['status', 'created_at'] }
        },
        foreignKeys: {
          user_id: { table: 'users', column: 'id', onDelete: 'CASCADE' }
        }
      },
      notifications: {
        columns: {
          id: { type: 'TEXT', nullable: false, primaryKey: true },
          user_id: { type: 'TEXT', nullable: false },
          message: { type: 'TEXT', nullable: false },
          link: { type: 'TEXT', nullable: true },
          read_flag: { type: 'BOOLEAN', nullable: true, defaultValue: 'FALSE' },
          created_at: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' }
        },
        indexes: {
          idx_notifications_user_id: { columns: ['user_id'] },
          idx_notifications_read_flag: { columns: ['read_flag'] },
          idx_notifications_created_at: { columns: ['created_at'] },
          idx_notifications_user_read: { columns: ['user_id', 'read_flag'] }
        },
        foreignKeys: {
          user_id: { table: 'users', column: 'id', onDelete: 'CASCADE' }
        }
      },
      audit_logs: {
        columns: {
          id: { type: 'TEXT', nullable: false, primaryKey: true },
          user_id: { type: 'TEXT', nullable: true },
          action: { type: 'TEXT', nullable: false },
          entity_type: { type: 'TEXT', nullable: false },
          entity_id: { type: 'TEXT', nullable: true },
          details: { type: 'TEXT', nullable: true },
          ip_address: { type: 'TEXT', nullable: true },
          user_agent: { type: 'TEXT', nullable: true },
          timestamp: { type: 'DATETIME', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' }
        },
        indexes: {
          idx_audit_logs_user_id: { columns: ['user_id'] },
          idx_audit_logs_action: { columns: ['action'] },
          idx_audit_logs_entity_type: { columns: ['entity_type'] },
          idx_audit_logs_entity_id: { columns: ['entity_id'] },
          idx_audit_logs_timestamp: { columns: ['timestamp'] },
          idx_audit_logs_user_timestamp: { columns: ['user_id', 'timestamp'] },
          idx_audit_logs_entity_timestamp: { columns: ['entity_type', 'entity_id', 'timestamp'] }
        },
        foreignKeys: {
          user_id: { table: 'users', column: 'id', onDelete: 'SET NULL' }
        }
      }
    }
  };

  /**
   * Validate the entire database schema
   */
  public static async validateSchema(): Promise<SchemaValidationResult> {
    try {
      logger.info('Starting comprehensive schema validation...');
      
      const errors: string[] = [];
      const warnings: string[] = [];
      const tableInfo: TableInfo[] = [];
      
      // Check if foreign keys are enabled
      const fkResult = await dbManager.executeQuerySingle('PRAGMA foreign_keys;');
      if (!fkResult || fkResult.foreign_keys !== 1) {
        errors.push('Foreign key constraints are not enabled');
      }
      
      // Get all tables
      const tables = await dbManager.executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'
        ORDER BY name
      `);
      
      // Validate each table
      for (const table of tables) {
        const info = await this.validateTable(table.name);
        tableInfo.push(info);
        
        // Check against expected schema
        const expectedTable = this.EXPECTED_SCHEMA.tables[table.name];
        if (!expectedTable) {
          warnings.push(`Unexpected table found: ${table.name}`);
          continue;
        }
        
        // Validate columns
        const columnErrors = this.validateTableColumns(table.name, info.columns, expectedTable.columns);
        errors.push(...columnErrors);
        
        // Validate indexes
        const indexWarnings = this.validateTableIndexes(table.name, info.indexes, expectedTable.indexes);
        warnings.push(...indexWarnings);
        
        // Validate foreign keys
        const fkErrors = this.validateTableForeignKeys(table.name, info.foreignKeys, expectedTable.foreignKeys);
        errors.push(...fkErrors);
      }
      
      // Check for missing tables
      for (const expectedTableName of Object.keys(this.EXPECTED_SCHEMA.tables)) {
        if (!tables.find(t => t.name === expectedTableName)) {
          errors.push(`Missing required table: ${expectedTableName}`);
        }
      }
      
      // Validate data integrity
      const integrityErrors = await this.validateDataIntegrity();
      errors.push(...integrityErrors);
      
      const valid = errors.length === 0;
      
      if (valid) {
        logger.info('Schema validation completed successfully', {
          tables: tables.length,
          warnings: warnings.length
        });
      } else {
        logger.error('Schema validation failed', {
          errors: errors.length,
          warnings: warnings.length
        });
      }
      
      return {
        valid,
        errors,
        warnings,
        tableInfo
      };
    } catch (error) {
      logger.error('Schema validation failed with exception', { error });
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        tableInfo: []
      };
    }
  }

  /**
   * Validate a specific table structure
   */
  private static async validateTable(tableName: string): Promise<TableInfo> {
    // Get column information
    const columns = await this.getTableColumns(tableName);
    
    // Get index information
    const indexes = await this.getTableIndexes(tableName);
    
    // Get foreign key information
    const foreignKeys = await this.getTableForeignKeys(tableName);
    
    // Get constraint information
    const constraints = await this.getTableConstraints(tableName);
    
    return {
      name: tableName,
      columns,
      indexes,
      foreignKeys,
      constraints
    };
  }

  /**
   * Get column information for a table
   */
  private static async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const columns = await dbManager.executeQuery<any>(`PRAGMA table_info(${tableName})`);
    
    return columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      primaryKey: col.pk === 1
    }));
  }

  /**
   * Get index information for a table
   */
  private static async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    const indexes = await dbManager.executeQuery<any>(`PRAGMA index_list(${tableName})`);
    const indexInfo: IndexInfo[] = [];
    
    for (const index of indexes) {
      if (index.name.startsWith('sqlite_autoindex_')) {
        continue; // Skip auto-generated indexes
      }
      
      const indexColumns = await dbManager.executeQuery<any>(`PRAGMA index_info(${index.name})`);
      
      indexInfo.push({
        name: index.name,
        unique: index.unique === 1,
        columns: indexColumns.map((col: any) => col.name)
      });
    }
    
    return indexInfo;
  }

  /**
   * Get foreign key information for a table
   */
  private static async getTableForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const foreignKeys = await dbManager.executeQuery<any>(`PRAGMA foreign_key_list(${tableName})`);
    
    return foreignKeys.map(fk => ({
      id: fk.id,
      seq: fk.seq,
      table: fk.table,
      from: fk.from,
      to: fk.to,
      onUpdate: fk.on_update,
      onDelete: fk.on_delete,
      match: fk.match
    }));
  }

  /**
   * Get constraint information for a table
   */
  private static async getTableConstraints(tableName: string): Promise<ConstraintInfo[]> {
    // Get table creation SQL to extract constraints
    const tableInfo = await dbManager.executeQuerySingle<{ sql: string }>(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name=?
    `, [tableName]);
    
    if (!tableInfo?.sql) {
      return [];
    }
    
    const constraints: ConstraintInfo[] = [];
    const sql = tableInfo.sql;
    
    // Extract CHECK constraints
    const checkMatches = sql.match(/CHECK\s*\([^)]+\)/gi);
    if (checkMatches) {
      checkMatches.forEach(match => {
        constraints.push({
          type: 'CHECK',
          definition: match.trim()
        });
      });
    }
    
    // Extract UNIQUE constraints
    const uniqueMatches = sql.match(/UNIQUE\s*\([^)]+\)/gi);
    if (uniqueMatches) {
      uniqueMatches.forEach(match => {
        constraints.push({
          type: 'UNIQUE',
          definition: match.trim()
        });
      });
    }
    
    return constraints;
  }

  /**
   * Validate table columns against expected schema
   */
  private static validateTableColumns(
    tableName: string,
    actualColumns: ColumnInfo[],
    expectedColumns: { [key: string]: any }
  ): string[] {
    const errors: string[] = [];
    
    // Check for missing columns
    for (const expectedColumnName of Object.keys(expectedColumns)) {
      const actualColumn = actualColumns.find(col => col.name === expectedColumnName);
      if (!actualColumn) {
        errors.push(`Table ${tableName}: Missing column ${expectedColumnName}`);
        continue;
      }
      
      const expected = expectedColumns[expectedColumnName];
      
      // Validate column type
      if (actualColumn.type !== expected.type) {
        errors.push(`Table ${tableName}: Column ${expectedColumnName} has type ${actualColumn.type}, expected ${expected.type}`);
      }
      
      // Validate nullable (skip for primary key columns as they have special handling)
      if (!expected.primaryKey && actualColumn.nullable !== expected.nullable) {
        errors.push(`Table ${tableName}: Column ${expectedColumnName} nullable mismatch - expected ${expected.nullable}, got ${actualColumn.nullable}`);
      }
      
      // Validate primary key
      if (expected.primaryKey && !actualColumn.primaryKey) {
        errors.push(`Table ${tableName}: Column ${expectedColumnName} should be primary key`);
      }
    }
    
    return errors;
  }

  /**
   * Validate table indexes against expected schema
   */
  private static validateTableIndexes(
    tableName: string,
    actualIndexes: IndexInfo[],
    expectedIndexes: { [key: string]: any }
  ): string[] {
    const warnings: string[] = [];
    
    // Check for missing indexes
    for (const expectedIndexName of Object.keys(expectedIndexes)) {
      const actualIndex = actualIndexes.find(idx => idx.name === expectedIndexName);
      if (!actualIndex) {
        warnings.push(`Table ${tableName}: Missing index ${expectedIndexName}`);
      }
    }
    
    return warnings;
  }

  /**
   * Validate table foreign keys against expected schema
   */
  private static validateTableForeignKeys(
    tableName: string,
    actualForeignKeys: ForeignKeyInfo[],
    expectedForeignKeys: { [key: string]: any }
  ): string[] {
    const errors: string[] = [];
    
    // Check for missing foreign keys
    for (const expectedColumnName of Object.keys(expectedForeignKeys)) {
      const actualFk = actualForeignKeys.find(fk => fk.from === expectedColumnName);
      if (!actualFk) {
        errors.push(`Table ${tableName}: Missing foreign key for column ${expectedColumnName}`);
        continue;
      }
      
      const expected = expectedForeignKeys[expectedColumnName];
      
      // Validate referenced table
      if (actualFk.table !== expected.table) {
        errors.push(`Table ${tableName}: Foreign key ${expectedColumnName} references ${actualFk.table}, expected ${expected.table}`);
      }
      
      // Validate referenced column
      if (actualFk.to !== expected.column) {
        errors.push(`Table ${tableName}: Foreign key ${expectedColumnName} references column ${actualFk.to}, expected ${expected.column}`);
      }
    }
    
    return errors;
  }

  /**
   * Validate data integrity
   */
  private static async validateDataIntegrity(): Promise<string[]> {
    const errors: string[] = [];
    
    try {
      // Check foreign key integrity
      const integrityResult = await dbManager.executeQuery('PRAGMA foreign_key_check;');
      
      if (integrityResult.length > 0) {
        integrityResult.forEach((row: any) => {
          errors.push(`Foreign key violation in table ${row.table}: ${JSON.stringify(row)}`);
        });
      }
      
      // Check for orphaned records (additional custom checks can be added here)
      
    } catch (error) {
      errors.push(`Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return errors;
  }

  /**
   * Quick health check for essential schema elements
   */
  public static async quickHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    try {
      const issues: string[] = [];
      
      // Check if essential tables exist
      const essentialTables = ['users', 'departments', 'submissions'];
      
      for (const tableName of essentialTables) {
        const tableExists = await dbManager.executeQuerySingle(`
          SELECT name FROM sqlite_master WHERE type='table' AND name=?
        `, [tableName]);
        
        if (!tableExists) {
          issues.push(`Essential table missing: ${tableName}`);
        }
      }
      
      // Check if foreign keys are enabled
      const fkResult = await dbManager.executeQuerySingle('PRAGMA foreign_keys;');
      if (!fkResult || fkResult.foreign_keys !== 1) {
        issues.push('Foreign key constraints are not enabled');
      }
      
      return {
        healthy: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}