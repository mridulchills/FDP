// Mock the environment config
jest.mock('../../config/environment.js', () => ({
  dbConfig: {
    path: ':memory:', // Use in-memory database for tests
    backupPath: './test-backups'
  }
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined)
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { dbManager } from '../database';
import { Database } from 'sqlite';

describe('Database Manager', () => {
  beforeEach(async () => {
    // Reset database manager state
    await dbManager.close();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  describe('initialization', () => {
    it('should initialize database manager successfully', async () => {
      await expect(dbManager.initialize()).resolves.not.toThrow();
    });

    it('should not reinitialize if already initialized', async () => {
      await dbManager.initialize();
      await expect(dbManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('connection management', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should get a database connection', async () => {
      const connection = await dbManager.getConnection();
      expect(connection).toBeDefined();
      expect(typeof connection.all).toBe('function');
      expect(typeof connection.get).toBe('function');
      expect(typeof connection.run).toBe('function');
      
      await dbManager.releaseConnection(connection);
    });

    it('should get main connection', async () => {
      const connection = await dbManager.getMainConnection();
      expect(connection).toBeDefined();
      expect(typeof connection.all).toBe('function');
    });

    it('should release connection back to pool', async () => {
      const connection = await dbManager.getConnection();
      await expect(dbManager.releaseConnection(connection)).resolves.not.toThrow();
    });
  });

  describe('query execution', () => {
    beforeEach(async () => {
      await dbManager.initialize();
      
      // Create a test table
      await dbManager.executeUpdate(`
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          value INTEGER
        )
      `);
    });

    it('should execute query and return results', async () => {
      // Insert test data
      await dbManager.executeUpdate(
        'INSERT INTO test_table (name, value) VALUES (?, ?)',
        ['test1', 100]
      );

      const results = await dbManager.executeQuery(
        'SELECT * FROM test_table WHERE name = ?',
        ['test1']
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('test1');
      expect(results[0].value).toBe(100);
    });

    it('should execute single query and return first result', async () => {
      // Insert test data
      await dbManager.executeUpdate(
        'INSERT INTO test_table (name, value) VALUES (?, ?)',
        ['test2', 200]
      );

      const result = await dbManager.executeQuerySingle(
        'SELECT * FROM test_table WHERE name = ?',
        ['test2']
      );

      expect(result).toBeDefined();
      expect(result!.name).toBe('test2');
      expect(result!.value).toBe(200);
    });

    it('should return undefined for single query with no results', async () => {
      const result = await dbManager.executeQuerySingle(
        'SELECT * FROM test_table WHERE name = ?',
        ['nonexistent']
      );

      expect(result).toBeUndefined();
    });

    it('should execute update queries and return changes', async () => {
      const result = await dbManager.executeUpdate(
        'INSERT INTO test_table (name, value) VALUES (?, ?)',
        ['test3', 300]
      );

      expect(result.changes).toBe(1);
      expect(result.lastID).toBeGreaterThan(0);
    });

    it('should handle query errors gracefully', async () => {
      await expect(
        dbManager.executeQuery('SELECT * FROM nonexistent_table')
      ).rejects.toThrow();
    });
  });

  describe('transaction management', () => {
    beforeEach(async () => {
      await dbManager.initialize();
      
      // Create a test table
      await dbManager.executeUpdate(`
        CREATE TABLE IF NOT EXISTS test_transactions (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
    });

    it('should execute successful transaction', async () => {
      const result = await dbManager.executeTransaction(async (db) => {
        await db.run('INSERT INTO test_transactions (name) VALUES (?)', ['tx1']);
        await db.run('INSERT INTO test_transactions (name) VALUES (?)', ['tx2']);
        return 'success';
      });

      expect(result).toBe('success');

      // Verify data was committed
      const rows = await dbManager.executeQuery('SELECT * FROM test_transactions');
      expect(rows).toHaveLength(2);
    });

    it('should rollback failed transaction', async () => {
      await expect(
        dbManager.executeTransaction(async (db) => {
          await db.run('INSERT INTO test_transactions (name) VALUES (?)', ['tx3']);
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // Verify data was rolled back
      const rows = await dbManager.executeQuery('SELECT * FROM test_transactions');
      expect(rows.filter(row => row.name === 'tx3')).toHaveLength(0);
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should return true for healthy database', async () => {
      const isHealthy = await dbManager.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should return database statistics', async () => {
      const stats = await dbManager.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.activeConnections).toBe('number');
      expect(typeof stats.poolSize).toBe('number');
      expect(typeof stats.databaseSize).toBe('number');
      expect(typeof stats.pageCount).toBe('number');
      expect(typeof stats.pageSize).toBe('number');
    });
  });

  describe('cleanup', () => {
    it('should close database manager without errors', async () => {
      await dbManager.initialize();
      await expect(dbManager.close()).resolves.not.toThrow();
    });

    it('should handle closing uninitialized manager', async () => {
      await expect(dbManager.close()).resolves.not.toThrow();
    });
  });
});