import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import { dbConfig } from '../config/environment.js';
import { logger } from './logger.js';

// Enable verbose mode for better debugging in development
if (process.env['NODE_ENV'] === 'development') {
  sqlite3.verbose();
}

/**
 * Database connection manager class
 * Handles SQLite database connections, pooling, and transactions
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private isInitialized = false;
  private connectionPool: Database[] = [];
  private readonly maxConnections = 10;
  private activeConnections = 0;

  private constructor() {}

  /**
   * Get singleton instance of DatabaseManager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize the database connection and setup
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(dbConfig.path);
      await fs.mkdir(dbDir, { recursive: true });

      // Ensure backup directory exists
      await fs.mkdir(dbConfig.backupPath, { recursive: true });

      // Open main database connection
      this.db = await this.createConnection();
      
      // Configure SQLite for optimal performance and safety
      await this.configureSQLite(this.db);
      
      // Initialize connection pool
      await this.initializeConnectionPool();
      
      this.isInitialized = true;
      logger.info('Database manager initialized successfully', {
        databasePath: dbConfig.path,
        maxConnections: this.maxConnections
      });
    } catch (error) {
      logger.error('Failed to initialize database manager', { error });
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<Database> {
    try {
      const db = await open({
        filename: dbConfig.path,
        driver: sqlite3.Database
      });

      this.activeConnections++;
      logger.debug('New database connection created', { 
        activeConnections: this.activeConnections 
      });

      return db;
    } catch (error) {
      logger.error('Failed to create database connection', { error });
      throw error;
    }
  }

  /**
   * Configure SQLite settings for optimal performance and safety
   */
  private async configureSQLite(db: Database): Promise<void> {
    try {
      // Enable WAL mode for better concurrency
      await db.exec('PRAGMA journal_mode = WAL;');
      
      // Enable foreign key constraints
      await db.exec('PRAGMA foreign_keys = ON;');
      
      // Set synchronous mode to NORMAL for better performance while maintaining safety
      await db.exec('PRAGMA synchronous = NORMAL;');
      
      // Set cache size (negative value means KB, positive means pages)
      await db.exec('PRAGMA cache_size = -64000;'); // 64MB cache
      
      // Set temp store to memory for better performance
      await db.exec('PRAGMA temp_store = MEMORY;');
      
      // Set mmap size for memory-mapped I/O (256MB)
      await db.exec('PRAGMA mmap_size = 268435456;');
      
      // Set busy timeout to handle concurrent access
      await db.exec('PRAGMA busy_timeout = 30000;'); // 30 seconds
      
      logger.debug('SQLite configuration applied successfully');
    } catch (error) {
      logger.error('Failed to configure SQLite', { error });
      throw error;
    }
  }

  /**
   * Initialize connection pool
   */
  private async initializeConnectionPool(): Promise<void> {
    try {
      // Create initial connections for the pool
      const initialConnections = Math.min(3, this.maxConnections);
      
      for (let i = 0; i < initialConnections; i++) {
        const connection = await this.createConnection();
        await this.configureSQLite(connection);
        this.connectionPool.push(connection);
      }
      
      logger.debug('Connection pool initialized', { 
        initialConnections,
        maxConnections: this.maxConnections 
      });
    } catch (error) {
      logger.error('Failed to initialize connection pool', { error });
      throw error;
    }
  }

  /**
   * Get a database connection from the pool or create a new one
   */
  public async getConnection(): Promise<Database> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try to get a connection from the pool
    if (this.connectionPool.length > 0) {
      const connection = this.connectionPool.pop()!;
      logger.debug('Connection retrieved from pool', { 
        poolSize: this.connectionPool.length 
      });
      return connection;
    }

    // If pool is empty and we haven't reached max connections, create a new one
    if (this.activeConnections < this.maxConnections) {
      const connection = await this.createConnection();
      await this.configureSQLite(connection);
      return connection;
    }

    // If we've reached max connections, wait and retry
    logger.warn('Maximum connections reached, waiting for available connection');
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.getConnection();
  }

  /**
   * Return a connection to the pool
   */
  public async releaseConnection(connection: Database): Promise<void> {
    try {
      // Only return to pool if we haven't exceeded the pool size
      if (this.connectionPool.length < this.maxConnections) {
        this.connectionPool.push(connection);
        logger.debug('Connection returned to pool', { 
          poolSize: this.connectionPool.length 
        });
      } else {
        // Close the connection if pool is full
        await connection.close();
        this.activeConnections--;
        logger.debug('Connection closed (pool full)', { 
          activeConnections: this.activeConnections 
        });
      }
    } catch (error) {
      logger.error('Error releasing connection', { error });
      // Ensure we decrement the counter even if close fails
      this.activeConnections--;
    }
  }

  /**
   * Get the main database connection (for migrations and setup)
   */
  public async getMainConnection(): Promise<Database> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.db) {
      throw new Error('Main database connection not available');
    }
    
    return this.db;
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  public async executeTransaction<T>(
    callback: (db: Database) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection();
    
    try {
      await connection.exec('BEGIN TRANSACTION;');
      logger.debug('Transaction started');
      
      const result = await callback(connection);
      
      await connection.exec('COMMIT;');
      logger.debug('Transaction committed');
      
      return result;
    } catch (error) {
      try {
        await connection.exec('ROLLBACK;');
        logger.debug('Transaction rolled back');
      } catch (rollbackError) {
        logger.error('Failed to rollback transaction', { rollbackError });
      }
      
      logger.error('Transaction failed', { error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  public async executeQuery<T = any>(
    sql: string, 
    params: any[] = []
  ): Promise<T[]> {
    const connection = await this.getConnection();
    
    try {
      logger.debug('Executing query', { sql, params });
      const result = await connection.all(sql, params);
      return result as T[];
    } catch (error) {
      logger.error('Query execution failed', { sql, params, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Execute a single query and return first result
   */
  public async executeQuerySingle<T = any>(
    sql: string, 
    params: any[] = []
  ): Promise<T | undefined> {
    const connection = await this.getConnection();
    
    try {
      logger.debug('Executing single query', { sql, params });
      const result = await connection.get(sql, params);
      return result as T | undefined;
    } catch (error) {
      logger.error('Single query execution failed', { sql, params, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Execute a query that modifies data (INSERT, UPDATE, DELETE)
   */
  public async executeUpdate(
    sql: string, 
    params: any[] = []
  ): Promise<{ changes: number; lastID: number }> {
    const connection = await this.getConnection();
    
    try {
      logger.debug('Executing update query', { sql, params });
      const result = await connection.run(sql, params);
      return {
        changes: result.changes || 0,
        lastID: result.lastID || 0
      };
    } catch (error) {
      logger.error('Update query execution failed', { sql, params, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Check if database is healthy and accessible
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeQuerySingle('SELECT 1 as health');
      return result?.health === 1;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<{
    activeConnections: number;
    poolSize: number;
    databaseSize: number;
    pageCount: number;
    pageSize: number;
  }> {
    try {
      const pageCountResult = await this.executeQuerySingle('PRAGMA page_count;');
      const pageSizeResult = await this.executeQuerySingle('PRAGMA page_size;');
      
      const pageCount = pageCountResult?.page_count || 0;
      const pageSize = pageSizeResult?.page_size || 0;
      const databaseSize = pageCount * pageSize;

      return {
        activeConnections: this.activeConnections,
        poolSize: this.connectionPool.length,
        databaseSize,
        pageCount,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to get database stats', { error });
      throw error;
    }
  }

  /**
   * Close all connections and cleanup
   */
  public async close(): Promise<void> {
    try {
      // Close all pooled connections
      for (const connection of this.connectionPool) {
        await connection.close();
      }
      this.connectionPool = [];

      // Close main connection
      if (this.db) {
        await this.db.close();
        this.db = null;
      }

      this.activeConnections = 0;
      this.isInitialized = false;
      
      logger.info('Database manager closed successfully');
    } catch (error) {
      logger.error('Error closing database manager', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const dbManager = DatabaseManager.getInstance();

// Export types for use in other modules
export type { Database };