import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../types/index.js';
import { AuditLogRepository } from '../repositories/audit-log-repository.js';
import { logger } from '../utils/logger.js';

/**
 * Service for managing audit logs for submission workflow actions
 */
export class AuditService {
  private auditLogRepository: AuditLogRepository;

  constructor() {
    this.auditLogRepository = new AuditLogRepository();
  }

  /**
   * Log an action performed by a user
   */
  public async logAction(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: uuidv4(),
        userId,
        action,
        entityType,
        entityId,
        details,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        timestamp: new Date()
      };

      await this.auditLogRepository.create(auditLog);
      
      logger.debug('Audit log created', {
        userId,
        action,
        entityType,
        entityId
      });
    } catch (error) {
      logger.error('Failed to create audit log', {
        userId,
        action,
        entityType,
        entityId,
        error: error instanceof Error ? error.message : error
      });
      // Don't throw error - audit failure shouldn't break the main workflow
    }
  }

  /**
   * Log submission status change
   */
  public async logStatusChange(
    userId: string,
    submissionId: string,
    previousStatus: string,
    newStatus: string,
    comment?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'submission_status_change',
      'submission',
      submissionId,
      {
        previousStatus,
        newStatus,
        comment
      },
      ipAddress,
      userAgent
    );
  }

  /**
   * Log comment addition
   */
  public async logCommentAdded(
    userId: string,
    submissionId: string,
    comment: string,
    commentType: 'hod' | 'admin',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'submission_comment_added',
      'submission',
      submissionId,
      {
        comment,
        commentType
      },
      ipAddress,
      userAgent
    );
  }

  /**
   * Log submission creation
   */
  public async logSubmissionCreated(
    userId: string,
    submissionId: string,
    moduleType: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'submission_created',
      'submission',
      submissionId,
      {
        moduleType
      },
      ipAddress,
      userAgent
    );
  }

  /**
   * Log submission update
   */
  public async logSubmissionUpdated(
    userId: string,
    submissionId: string,
    updatedFields: string[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'submission_updated',
      'submission',
      submissionId,
      {
        updatedFields
      },
      ipAddress,
      userAgent
    );
  }

  /**
   * Log submission deletion
   */
  public async logSubmissionDeleted(
    userId: string,
    submissionId: string,
    submissionUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'submission_deleted',
      'submission',
      submissionId,
      {
        submissionUserId
      },
      ipAddress,
      userAgent
    );
  }

  /**
   * Get audit logs for a specific entity
   */
  public async getEntityAuditLogs(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.findByEntity(entityType, entityId, limit);
    } catch (error) {
      logger.error('Failed to get entity audit logs', {
        entityType,
        entityId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  public async getUserAuditLogs(
    userId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.findByUserId(userId, limit);
    } catch (error) {
      logger.error('Failed to get user audit logs', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get audit logs by date range
   */
  public async getAuditLogsByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.findByDateRange(startDate, endDate, limit);
    } catch (error) {
      logger.error('Failed to get audit logs by date range', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get audit logs by action
   */
  public async getAuditLogsByAction(
    action: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.findByAction(action, limit);
    } catch (error) {
      logger.error('Failed to get audit logs by action', {
        action,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get recent audit logs
   */
  public async getRecentAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.findAll({
        limit,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });
    } catch (error) {
      logger.error('Failed to get recent audit logs', {
        limit,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  public async getAuditLogStats(days: number = 30): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByUser: Record<string, number>;
    logsByDay: Record<string, number>;
  }> {
    try {
      return await this.auditLogRepository.getStats(days);
    } catch (error) {
      logger.error('Failed to get audit log statistics', {
        days,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
}