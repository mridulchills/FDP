import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit-service.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { ResponseSender } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const router = Router();
const auditService = new AuditService();

/**
 * GET /api/audit-logs
 * Get audit logs (Admin only)
 */
router.get('/',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { 
        entityType, 
        entityId, 
        userId, 
        action, 
        limit = 50,
        startDate,
        endDate
      } = req.query;

      let auditLogs;

      if (startDate && endDate) {
        // Get logs by date range
        auditLogs = await auditService.getAuditLogsByDateRange(
          new Date(startDate as string),
          new Date(endDate as string),
          parseInt(limit as string)
        );
      } else if (entityType && entityId) {
        // Get logs for specific entity
        auditLogs = await auditService.getEntityAuditLogs(
          entityType as string,
          entityId as string,
          parseInt(limit as string)
        );
      } else if (userId) {
        // Get logs for specific user
        auditLogs = await auditService.getUserAuditLogs(
          userId as string,
          parseInt(limit as string)
        );
      } else if (action) {
        // Get logs by action
        auditLogs = await auditService.getAuditLogsByAction(
          action as string,
          parseInt(limit as string)
        );
      } else {
        // Get recent logs
        auditLogs = await auditService.getRecentAuditLogs(
          parseInt(limit as string)
        );
      }

      logger.info('Audit logs retrieved successfully', {
        userId: req.user?.userId,
        count: auditLogs.length,
        filters: { entityType, entityId, userId, action }
      });

      return respond.success(auditLogs, 'Audit logs retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve audit logs', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve audit logs', 500, error);
    }
  }
);

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics (Admin only)
 */
router.get('/stats',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { days = 30 } = req.query;
      
      const stats = await auditService.getAuditLogStats(
        parseInt(days as string)
      );

      logger.info('Audit log statistics retrieved', {
        userId: req.user?.userId,
        days
      });

      return respond.success(stats, 'Audit log statistics retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve audit log statistics', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve audit log statistics', 500, error);
    }
  }
);

/**
 * GET /api/audit-logs/submission/:id
 * Get audit logs for a specific submission
 */
router.get('/submission/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const id = req.params['id'];
      const { limit = 20 } = req.query;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return respond.error('Invalid submission ID format', 400);
      }

      // Check if user can access this submission's audit logs
      // Faculty can only see audit logs for their own submissions
      // HoD can see audit logs for submissions in their department
      // Admin can see all audit logs
      if (req.user?.role === 'faculty' || req.user?.role === 'hod') {
        // For now, we'll allow access - in a complete implementation,
        // we would check submission ownership/department access here
      }

      const auditLogs = await auditService.getEntityAuditLogs(
        'submission',
        id,
        parseInt(limit as string)
      );

      logger.info('Submission audit logs retrieved', {
        userId: req.user?.userId,
        submissionId: id,
        count: auditLogs.length
      });

      return respond.success(auditLogs, 'Submission audit logs retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve submission audit logs', { 
        userId: req.user?.userId, 
        submissionId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve submission audit logs', 500, error);
    }
  }
);

export default router;