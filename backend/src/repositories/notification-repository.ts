import { BaseRepository } from './base-repository.js';
import { Notification } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Notification repository for managing notification data operations
 */
export class NotificationRepository extends BaseRepository<Notification> {
  protected tableName = 'notifications';
  protected primaryKey = 'id';

  /**
   * Map database row to Notification entity
   */
  protected mapRowToEntity(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      message: row.message,
      link: row.link,
      readFlag: Boolean(row.read_flag),
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * Map Notification entity to database row
   */
  protected mapEntityToRow(entity: Partial<Notification>): Record<string, any> {
    const row: Record<string, any> = {};
    
    if (entity.id !== undefined) row['id'] = entity.id;
    if (entity.userId !== undefined) row['user_id'] = entity.userId;
    if (entity.message !== undefined) row['message'] = entity.message;
    if (entity.link !== undefined) row['link'] = entity.link;
    if (entity.readFlag !== undefined) row['read_flag'] = entity.readFlag ? 1 : 0;
    if (entity.createdAt !== undefined) row['created_at'] = entity.createdAt.toISOString();
    
    return row;
  }

  /**
   * Find notifications by user ID
   */
  public async findByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      logger.debug('Finding notifications by user ID', { userId, limit, sql });
      
      const rows = await connection.all(sql, [userId, limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find notifications by user ID', { userId, limit, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Find unread notifications by user ID
   */
  public async findUnreadByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        SELECT * FROM notifications 
        WHERE user_id = ? AND read_flag = 0 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      logger.debug('Finding unread notifications by user ID', { userId, limit, sql });
      
      const rows = await connection.all(sql, [userId, limit]);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find unread notifications by user ID', { userId, limit, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  public async markAllAsReadForUser(userId: string): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      const sql = 'UPDATE notifications SET read_flag = 1 WHERE user_id = ? AND read_flag = 0';
      
      logger.debug('Marking all notifications as read for user', { userId, sql });
      
      const result = await connection.run(sql, [userId]);
      return result.changes || 0;
    } catch (error) {
      logger.error('Failed to mark all notifications as read for user', { userId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Get unread notification count for a user
   */
  public async getUnreadCount(userId: string): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      const sql = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_flag = 0';
      
      logger.debug('Getting unread notification count', { userId, sql });
      
      const result = await connection.get(sql, [userId]);
      return result?.count || 0;
    } catch (error) {
      logger.error('Failed to get unread notification count', { userId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Delete old notifications (cleanup)
   */
  public async deleteOldNotifications(daysOld: number = 90): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      const sql = `
        DELETE FROM notifications 
        WHERE created_at < datetime('now', '-${daysOld} days')
      `;
      
      logger.debug('Deleting old notifications', { daysOld, sql });
      
      const result = await connection.run(sql);
      return result.changes || 0;
    } catch (error) {
      logger.error('Failed to delete old notifications', { daysOld, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Delete notifications by user ID (for user deletion cascade)
   */
  public async deleteByUserId(userId: string): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      const sql = 'DELETE FROM notifications WHERE user_id = ?';
      
      logger.debug('Deleting notifications by user ID', { userId, sql });
      
      const result = await connection.run(sql, [userId]);
      return result.changes || 0;
    } catch (error) {
      logger.error('Failed to delete notifications by user ID', { userId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }
}