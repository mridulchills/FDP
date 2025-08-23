/**
 * Database utilities - Main export module
 * This module provides a clean interface for database operations
 */

import { dbManager as _dbManager } from './database.js';

export { dbManager } from './database.js';
export { DatabaseInitializer } from './database-init.js';
export type { Database } from './database.js';

// Re-export commonly used functions for convenience
export const executeQuery = _dbManager.executeQuery.bind(_dbManager);
export const executeQuerySingle = _dbManager.executeQuerySingle.bind(_dbManager);
export const executeUpdate = _dbManager.executeUpdate.bind(_dbManager);
export const executeTransaction = _dbManager.executeTransaction.bind(_dbManager);
export const healthCheck = _dbManager.healthCheck.bind(_dbManager);
export const getStats = _dbManager.getStats.bind(_dbManager);
export const initializeDatabase = _dbManager.initialize.bind(_dbManager);
export const closeDatabase = _dbManager.close.bind(_dbManager);