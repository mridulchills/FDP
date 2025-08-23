import { Database } from 'sqlite';
import { dbManager } from './database.js';
import { logger } from './logger.js';

/**
 * Transaction isolation levels
 */
export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE'
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number; // in milliseconds
  retryAttempts?: number;
  retryDelay?: number; // in milliseconds
}

/**
 * Transaction context for managing database transactions
 */
export class TransactionContext {
  private connection: Database;
  private isActive: boolean = false;
  private startTime: number;
  private options: TransactionOptions;

  constructor(connection: Database, options: TransactionOptions = {}) {
    this.connection = connection;
    this.startTime = Date.now();
    this.options = {
      timeout: 30000, // 30 seconds default
      retryAttempts: 3,
      retryDelay: 100,
      ...options
    };
  }

  /**
   * Get the database connection
   */
  public getConnection(): Database {
    if (!this.isActive) {
      throw new Error('Transaction is not active');
    }
    return this.connection;
  }

  /**
   * Check if transaction is active
   */
  public isTransactionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get transaction duration in milliseconds
   */
  public getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Check if transaction has timed out
   */
  public hasTimedOut(): boolean {
    return this.options.timeout ? this.getDuration() > this.options.timeout : false;
  }

  /**
   * Start the transaction
   */
  public async begin(): Promise<void> {
    if (this.isActive) {
      throw new Error('Transaction is already active');
    }

    try {
      // Set isolation level if specified
      if (this.options.isolationLevel) {
        await this.connection.exec(`PRAGMA read_uncommitted = ${this.options.isolationLevel === IsolationLevel.READ_UNCOMMITTED ? 'ON' : 'OFF'};`);
      }

      await this.connection.exec('BEGIN TRANSACTION;');
      this.isActive = true;
      
      logger.debug('Transaction started', {
        isolationLevel: this.options.isolationLevel,
        timeout: this.options.timeout
      });
    } catch (error) {
      logger.error('Failed to start transaction', { error });
      throw error;
    }
  }

  /**
   * Commit the transaction
   */
  public async commit(): Promise<void> {
    if (!this.isActive) {
      throw new Error('No active transaction to commit');
    }

    try {
      await this.connection.exec('COMMIT;');
      this.isActive = false;
      
      logger.debug('Transaction committed', {
        duration: this.getDuration()
      });
    } catch (error) {
      logger.error('Failed to commit transaction', { error });
      throw error;
    }
  }

  /**
   * Rollback the transaction
   */
  public async rollback(): Promise<void> {
    if (!this.isActive) {
      logger.warn('Attempted to rollback inactive transaction');
      return;
    }

    try {
      await this.connection.exec('ROLLBACK;');
      this.isActive = false;
      
      logger.debug('Transaction rolled back', {
        duration: this.getDuration()
      });
    } catch (error) {
      logger.error('Failed to rollback transaction', { error });
      // Don't throw here as this is often called in error handling
    }
  }

  /**
   * Create a savepoint
   */
  public async savepoint(name: string): Promise<void> {
    if (!this.isActive) {
      throw new Error('No active transaction for savepoint');
    }

    try {
      await this.connection.exec(`SAVEPOINT ${name};`);
      logger.debug('Savepoint created', { name });
    } catch (error) {
      logger.error('Failed to create savepoint', { name, error });
      throw error;
    }
  }

  /**
   * Release a savepoint
   */
  public async releaseSavepoint(name: string): Promise<void> {
    if (!this.isActive) {
      throw new Error('No active transaction for savepoint release');
    }

    try {
      await this.connection.exec(`RELEASE SAVEPOINT ${name};`);
      logger.debug('Savepoint released', { name });
    } catch (error) {
      logger.error('Failed to release savepoint', { name, error });
      throw error;
    }
  }

  /**
   * Rollback to a savepoint
   */
  public async rollbackToSavepoint(name: string): Promise<void> {
    if (!this.isActive) {
      throw new Error('No active transaction for savepoint rollback');
    }

    try {
      await this.connection.exec(`ROLLBACK TO SAVEPOINT ${name};`);
      logger.debug('Rolled back to savepoint', { name });
    } catch (error) {
      logger.error('Failed to rollback to savepoint', { name, error });
      throw error;
    }
  }
}

/**
 * Transaction manager for handling database transactions
 */
export class TransactionManager {
  /**
   * Execute a function within a transaction
   */
  public static async execute<T>(
    callback: (context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const connection = await dbManager.getConnection();
    const context = new TransactionContext(connection, options);
    
    let attempt = 0;
    const maxAttempts = options.retryAttempts || 1;
    
    while (attempt < maxAttempts) {
      try {
        await context.begin();
        
        // Check for timeout before executing callback
        if (context.hasTimedOut()) {
          throw new Error('Transaction timed out before execution');
        }
        
        const result = await callback(context);
        
        // Check for timeout before committing
        if (context.hasTimedOut()) {
          throw new Error('Transaction timed out before commit');
        }
        
        await context.commit();
        return result;
        
      } catch (error) {
        await context.rollback();
        
        attempt++;
        
        // Check if we should retry
        if (attempt < maxAttempts && this.isRetryableError(error)) {
          logger.warn('Transaction failed, retrying', {
            attempt,
            maxAttempts,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          // Wait before retrying
          if (options.retryDelay) {
            await new Promise(resolve => setTimeout(resolve, options.retryDelay));
          }
          
          continue;
        }
        
        logger.error('Transaction failed', {
          attempt,
          maxAttempts,
          duration: context.getDuration(),
          error
        });
        
        throw error;
      } finally {
        await dbManager.releaseConnection(connection);
      }
    }
    
    throw new Error('Transaction failed after all retry attempts');
  }

  /**
   * Execute multiple operations in a single transaction
   */
  public static async executeBatch<T>(
    operations: Array<(context: TransactionContext) => Promise<T>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    return this.execute(async (context) => {
      const results: T[] = [];
      
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          if (!operation) {
            throw new Error(`Operation at index ${i} is undefined`);
          }
          const result = await operation(context);
          results.push(result);
        } catch (error) {
          logger.error('Batch operation failed', {
            operationIndex: i,
            totalOperations: operations.length,
            error
          });
          throw error;
        }
      }
      
      return results;
    }, options);
  }

  /**
   * Execute operations with savepoints for partial rollback
   */
  public static async executeWithSavepoints<T>(
    operations: Array<{
      name: string;
      operation: (context: TransactionContext) => Promise<T>;
      onError?: (error: any, context: TransactionContext) => Promise<void>;
    }>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    return this.execute(async (context) => {
      const results: T[] = [];
      
      for (const { name, operation, onError } of operations) {
        await context.savepoint(name);
        
        try {
          const result = await operation(context);
          results.push(result);
          await context.releaseSavepoint(name);
        } catch (error) {
          logger.warn('Operation failed, rolling back to savepoint', {
            savepointName: name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          await context.rollbackToSavepoint(name);
          
          if (onError) {
            await onError(error, context);
          } else {
            throw error;
          }
        }
      }
      
      return results;
    }, options);
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || error.toString();
    
    // SQLite specific retryable errors
    const retryablePatterns = [
      /database is locked/i,
      /database is busy/i,
      /disk I\/O error/i,
      /temporary failure/i
    ];
    
    return retryablePatterns.some(pattern => pattern.test(message));
  }
}

/**
 * Decorator for automatic transaction management
 */
export function withTransaction(options: TransactionOptions = {}) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return TransactionManager.execute(async (context) => {
        // Replace 'this' context with transaction context for the method
        return method.apply({ ...this, transactionContext: context }, args);
      }, options);
    };
    
    return descriptor;
  };
}

/**
 * Utility functions for transaction management
 */
export class TransactionUtils {
  /**
   * Create a transaction context manually
   */
  public static async createContext(options: TransactionOptions = {}): Promise<TransactionContext> {
    const connection = await dbManager.getConnection();
    const context = new TransactionContext(connection, options);
    await context.begin();
    return context;
  }

  /**
   * Execute a query within a transaction context
   */
  public static async executeQuery<T>(
    context: TransactionContext,
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    try {
      logger.debug('Executing query in transaction', { sql, params });
      return await context.getConnection().all(sql, params);
    } catch (error) {
      logger.error('Query execution failed in transaction', { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute a single query within a transaction context
   */
  public static async executeQuerySingle<T>(
    context: TransactionContext,
    sql: string,
    params: any[] = []
  ): Promise<T | undefined> {
    try {
      logger.debug('Executing single query in transaction', { sql, params });
      return await context.getConnection().get(sql, params);
    } catch (error) {
      logger.error('Single query execution failed in transaction', { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute an update query within a transaction context
   */
  public static async executeUpdate(
    context: TransactionContext,
    sql: string,
    params: any[] = []
  ): Promise<{ changes: number; lastID: number }> {
    try {
      logger.debug('Executing update in transaction', { sql, params });
      const result = await context.getConnection().run(sql, params);
      return {
        changes: result.changes || 0,
        lastID: result.lastID || 0
      };
    } catch (error) {
      logger.error('Update execution failed in transaction', { sql, params, error });
      throw error;
    }
  }
}