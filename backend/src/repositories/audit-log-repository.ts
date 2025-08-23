import { BaseRepository } from './base-repository.js';
import { AuditLog } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Audit log repository for managing audit log data operations
 */
export class AuditLogRepository extends BaseRepository<AuditLog> {
  protected tableName = 'audit_logs';
  protected primaryKey = 'id';

  /**
   * Map database row to AuditLog entity
   */
  protected mapRowToEntity(row: any): AuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details ? JSON.parse(row.details) : null,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: new Date(row.timestamp)
    };
  }

  /**
   * Map AuditLog entity to database row
   */
  protected mapEntityToRow(entity: Partial<AuditLog>): Record<string, any> {
    const row: Record<string, any> = {};
    
    if (entity.id !== undefined) row['id'] = entity.id;
    if (entity.userId !== undefined) row['user_id'] = entity.userId;
    if (entity.action !== undefined) row['action'] = entity.action;
    if (entity.entityType !== undefined) row['entity_type'] = entity.entityType;
    if (entity.entityId !== undefined) row['entity_id'] = entity.entityId;
    if (entity.details !== undefined) row['details'] = entity.details ? JSON.stringify(entity.details) : null;
    if (entity.ipAddress !== undefined) row['ip_address'] = entity.ipAddress;
    if (entity.userAgent !== undefined) row['user_agent'] = entity.userAgent;
    if (entity.timestamp !== undefined) row['timestamp'] = entity.timestamp.toISOString();
    
    return row;
  }

  /**
   * Find audit logs by user ID
   */
  public async findByUserId(userId: string, limit: number = 50): Promise<AuditLog[]> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        SELECT * FROM audit_logs 
        WHERE user_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      logger.debug('Finding audit logs by user ID', { userId, limit, sql });
      
      const rows = await connection.all(sql, [userId, limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find audit logs by user ID', { userId, limit, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Find audit logs by entity
   */
  public async findByEntity(
    entityType: string, 
    entityId: string, 
    limit: number = 50
  ): Promise<AuditLog[]> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        SELECT * FROM audit_logs 
        WHERE entity_type = ? AND entity_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      logger.debug('Finding audit logs by entity', { entityType, entityId, limit, sql });
      
      const rows = await connection.all(sql, [entityType, entityId, limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find audit logs by entity', { entityType, entityId, limit, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Find audit logs by action
   */
  public async findByAction(action: string, limit: number = 50): Promise<AuditLog[]> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        SELECT * FROM audit_logs 
        WHERE action = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      logger.debug('Finding audit logs by action', { action, limit, sql });
      
      const rows = await connection.all(sql, [action, limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find audit logs by action', { action, limit, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Find audit logs within date range
   */
  public async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        SELECT * FROM audit_logs 
        WHERE timestamp >= ? AND timestamp <= ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      logger.debug('Finding audit logs by date range', { 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString(), 
        limit, 
        sql 
      });
      
      const rows = await connection.all(sql, [
        startDate.toISOString(),
        endDate.toISOString(),
        limit
      ]);
      
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find audit logs by date range', { 
        startDate, 
        endDate, 
        limit, 
        error 
      });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Get audit log statistics
   */
  public async getStats(days: number = 30): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByUser: Record<string, number>;
    logsByDay: Record<string, number>;
  }> {
    const connection = await this.getConnection();
    
    try {
      const dateFilter = `timestamp >= datetime('now', '-${days} days')`;
      
      // Get total logs
      const totalResult = await connection.get(`
        SELECT COUNT(*) as count FROM audit_logs WHERE ${dateFilter}
      `);
      const totalLogs = totalResult?.count || 0;
      
      // Get logs by action
      const actionResults = await connection.all(`
        SELECT action, COUNT(*) as count 
        FROM audit_logs 
        WHERE ${dateFilter}
        GROUP BY action
        ORDER BY count DESC
      `);
      
      const logsByAction: Record<string, number> = {};
      actionResults.forEach(row => {
        logsByAction[row.action] = row.count;
      });
      
      // Get logs by user
      const userResults = await connection.all(`
        SELECT user_id, COUNT(*) as count 
        FROM audit_logs 
        WHERE ${dateFilter} AND user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 20
      `);
      
      const logsByUser: Record<string, number> = {};
      userResults.forEach(row => {
        logsByUser[row.user_id] = row.count;
      });
      
      // Get logs by day
      const dayResults = await connection.all(`
        SELECT 
          date(timestamp) as day,
          COUNT(*) as count
        FROM audit_logs 
        WHERE ${dateFilter}
        GROUP BY date(timestamp)
        ORDER BY day DESC
      `);
      
      const logsByDay: Record<string, number> = {};
      dayResults.forEach(row => {
        logsByDay[row.day] = row.count;
      });
      
      return {
        totalLogs,
        logsByAction,
        logsByUser,
        logsByDay
      };
    } catch (error) {
      logger.error('Failed to get audit log statistics', { days, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Delete old audit logs (cleanup)
   */
  public async deleteOldLogs(daysOld: number = 365): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        DELETE FROM audit_logs 
        WHERE timestamp < datetime('now', '-${daysOld} days')
      `;
      
      logger.debug('Deleting old audit logs', { daysOld, sql });
      
      const result = await connection.run(sql);
      return result.changes || 0;
    } catch (error) {
      logger.error('Failed to delete old audit logs', { daysOld, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }
}