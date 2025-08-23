import { Database } from 'sqlite';
import { dbManager } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { QueryOptions } from '../types/index.js';
import { DatabasePerformanceTracker } from '../utils/performance-monitor.js';

/**
 * Base repository class providing common CRUD operations
 * All specific repositories should extend this class
 */
export abstract class BaseRepository<T> {
  protected abstract tableName: string;
  protected abstract primaryKey: string;

  /**
   * Get database connection
   */
  protected async getConnection(): Promise<Database> {
    return dbManager.getConnection();
  }

  /**
   * Release database connection
   */
  protected async releaseConnection(connection: Database): Promise<void> {
    return dbManager.releaseConnection(connection);
  }

  /**
   * Execute a transaction
   */
  protected async executeTransaction<R>(
    callback: (db: Database) => Promise<R>
  ): Promise<R> {
    return dbManager.executeTransaction(callback);
  }

  /**
   * Build WHERE clause from filters
   */
  protected buildWhereClause(filters: Record<string, any>): { clause: string; params: any[] } {
    if (!filters || Object.keys(filters).length === 0) {
      return { clause: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) {
        conditions.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'string' && value.includes('%')) {
        conditions.push(`${key} LIKE ?`);
        params.push(value);
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Build ORDER BY clause
   */
  protected buildOrderClause(sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): string {
    if (!sortBy) {
      return `ORDER BY ${this.primaryKey} ${sortOrder.toUpperCase()}`;
    }
    return `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
  }

  /**
   * Build LIMIT and OFFSET clause for pagination
   */
  protected buildPaginationClause(page?: number, limit?: number): { clause: string; offset: number } {
    if (!page || !limit) {
      return { clause: '', offset: 0 };
    }

    const offset = (page - 1) * limit;
    return {
      clause: `LIMIT ${limit} OFFSET ${offset}`,
      offset
    };
  }

  /**
   * Convert database row to entity
   */
  protected abstract mapRowToEntity(row: any): T;

  /**
   * Convert entity to database row
   */
  protected abstract mapEntityToRow(entity: Partial<T>): Record<string, any>;

  /**
   * Find entity by primary key
   */
  public async findById(id: string): Promise<T | null> {
    return DatabasePerformanceTracker.trackQuery('SELECT', this.tableName, async () => {
      const connection = await this.getConnection();
      
      try {
        const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
        logger.debug('Finding entity by ID', { tableName: this.tableName, id, sql });
        
        const row = await connection.get(sql, [id]);
        return row ? this.mapRowToEntity(row) : null;
      } catch (error) {
        logger.error('Failed to find entity by ID', { 
          tableName: this.tableName, 
          id, 
          error 
        });
        throw error;
      } finally {
        await this.releaseConnection(connection);
      }
    });
  }

  /**
   * Find all entities with optional filtering, sorting, and pagination
   */
  public async findAll(options: QueryOptions = {}): Promise<T[]> {
    return DatabasePerformanceTracker.trackQuery('SELECT', this.tableName, async () => {
      const connection = await this.getConnection();
      
      try {
        const { filters = {}, sortBy, sortOrder = 'asc', page, limit } = options;
        
        const { clause: whereClause, params } = this.buildWhereClause(filters);
        const orderClause = this.buildOrderClause(sortBy, sortOrder);
        const { clause: paginationClause } = this.buildPaginationClause(page, limit);
        
        const sql = `SELECT * FROM ${this.tableName} ${whereClause} ${orderClause} ${paginationClause}`.trim();
        
        logger.debug('Finding all entities', { 
          tableName: this.tableName, 
          options, 
          sql, 
          params 
        });
        
        const rows = await connection.all(sql, params);
        return rows.map(row => this.mapRowToEntity(row));
      } catch (error) {
        logger.error('Failed to find all entities', { 
          tableName: this.tableName, 
          options, 
          error 
        });
        throw error;
      } finally {
        await this.releaseConnection(connection);
      }
    });
  }

  /**
   * Find single entity by filters
   */
  public async findOne(filters: Record<string, any>): Promise<T | null> {
    const connection = await this.getConnection();
    
    try {
      const { clause: whereClause, params } = this.buildWhereClause(filters);
      const sql = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
      
      logger.debug('Finding single entity', { 
        tableName: this.tableName, 
        filters, 
        sql, 
        params 
      });
      
      const row = await connection.get(sql, params);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      logger.error('Failed to find single entity', { 
        tableName: this.tableName, 
        filters, 
        error 
      });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Count entities with optional filtering
   */
  public async count(filters: Record<string, any> = {}): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      const { clause: whereClause, params } = this.buildWhereClause(filters);
      const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
      
      logger.debug('Counting entities', { 
        tableName: this.tableName, 
        filters, 
        sql, 
        params 
      });
      
      const result = await connection.get(sql, params);
      return result?.count || 0;
    } catch (error) {
      logger.error('Failed to count entities', { 
        tableName: this.tableName, 
        filters, 
        error 
      });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Create new entity
   */
  public async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    return DatabasePerformanceTracker.trackQuery('INSERT', this.tableName, async () => {
      const connection = await this.getConnection();
      
      try {
        const row = this.mapEntityToRow(entity as Partial<T>);
        const now = new Date().toISOString();
        
        // Add timestamps
        row['created_at'] = now;
        row['updated_at'] = now;
        
        // Generate ID if not provided
        if (!row['id']) {
          row['id'] = this.generateId();
        }
        
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(row);
        
        const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        logger.debug('Creating entity', { 
          tableName: this.tableName, 
          sql, 
          values 
        });
        
        await connection.run(sql, values);
        
        // Return the created entity
        const created = await connection.get(
          `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
          [row['id']]
        );
        
        return this.mapRowToEntity(created);
      } catch (error) {
        logger.error('Failed to create entity', { 
          tableName: this.tableName, 
          entity, 
          error 
        });
        throw error;
      } finally {
        await this.releaseConnection(connection);
      }
    });
  }

  /**
   * Update entity by ID
   */
  public async update(id: string, updates: Partial<T>): Promise<T | null> {
    return DatabasePerformanceTracker.trackQuery('UPDATE', this.tableName, async () => {
      const connection = await this.getConnection();
      
      try {
        const row = this.mapEntityToRow(updates);
        row['updated_at'] = new Date().toISOString();
        
        const columns = Object.keys(row);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const values = [...Object.values(row), id];
        
        const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`;
        
        logger.debug('Updating entity', { 
          tableName: this.tableName, 
          id, 
          updates, 
          sql, 
          values 
        });
        
        const result = await connection.run(sql, values);
        
        if (result.changes === 0) {
          return null;
        }
        
        // Return the updated entity
        const updated = await connection.get(
          `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
          [id]
        );
        
        return this.mapRowToEntity(updated);
      } catch (error) {
        logger.error('Failed to update entity', { 
          tableName: this.tableName, 
          id, 
          updates, 
          error 
        });
        throw error;
      } finally {
        await this.releaseConnection(connection);
      }
    });
  }

  /**
   * Delete entity by ID
   */
  public async delete(id: string): Promise<boolean> {
    return DatabasePerformanceTracker.trackQuery('DELETE', this.tableName, async () => {
      const connection = await this.getConnection();
      
      try {
        const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
        
        logger.debug('Deleting entity', { 
          tableName: this.tableName, 
          id, 
          sql 
        });
        
        const result = await connection.run(sql, [id]);
        return (result.changes || 0) > 0;
      } catch (error) {
        logger.error('Failed to delete entity', { 
          tableName: this.tableName, 
          id, 
          error 
        });
        throw error;
      } finally {
        await this.releaseConnection(connection);
      }
    });
  }

  /**
   * Check if entity exists by ID
   */
  public async exists(id: string): Promise<boolean> {
    const connection = await this.getConnection();
    
    try {
      const sql = `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = ? LIMIT 1`;
      const result = await connection.get(sql, [id]);
      return !!result;
    } catch (error) {
      logger.error('Failed to check entity existence', { 
        tableName: this.tableName, 
        id, 
        error 
      });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Generate a unique ID for new entities
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}