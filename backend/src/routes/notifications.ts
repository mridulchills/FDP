import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notification-service.js';
import { authenticateToken } from '../middleware/auth.js';
import { ResponseSender } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const router = Router();
const notificationService = new NotificationService();

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get('/',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { limit = 50, unreadOnly = false } = req.query;
      
      let notifications;
      if (unreadOnly === 'true') {
        notifications = await notificationService.getUnreadNotifications(req.user!.userId);
      } else {
        // For now, we'll get all notifications (could add pagination later)
        // We need to add a method to the service to get all notifications
        notifications = await notificationService.getAllNotifications(
          req.user!.userId, 
          parseInt(limit as string)
        );
      }

      logger.info('Notifications retrieved successfully', {
        userId: req.user?.userId,
        count: notifications.length,
        unreadOnly
      });

      return respond.success(notifications, 'Notifications retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve notifications', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve notifications', 500, error);
    }
  }
);

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the current user
 */
router.get('/unread-count',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const count = await notificationService.getUnreadCount(req.user!.userId);

      logger.debug('Unread notification count retrieved', {
        userId: req.user?.userId,
        count
      });

      return respond.success({ count }, 'Unread notification count retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve unread notification count', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve unread notification count', 500, error);
    }
  }
);

/**
 * PUT /api/notifications/:id/read
 * Mark a specific notification as read
 */
router.put('/:id/read',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const id = req.params['id'];

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return respond.error('Invalid notification ID format', 400);
      }

      const success = await notificationService.markAsRead(id, req.user!.userId);
      
      if (!success) {
        return respond.notFound('Notification');
      }

      logger.info('Notification marked as read', {
        userId: req.user?.userId,
        notificationId: id
      });

      return respond.success({ notificationId: id }, 'Notification marked as read');

    } catch (error) {
      logger.error('Failed to mark notification as read', { 
        userId: req.user?.userId, 
        notificationId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to mark notification as read', 500, error);
    }
  }
);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the current user
 */
router.put('/read-all',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const count = await notificationService.markAllAsRead(req.user!.userId);

      logger.info('All notifications marked as read', {
        userId: req.user?.userId,
        count
      });

      return respond.success({ markedCount: count }, 'All notifications marked as read');

    } catch (error) {
      logger.error('Failed to mark all notifications as read', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to mark all notifications as read', 500, error);
    }
  }
);

export default router;