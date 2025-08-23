import { v4 as uuidv4 } from 'uuid';
import { Notification, SubmissionStatus, UserRole } from '../types/index.js';
import { NotificationRepository } from '../repositories/notification-repository.js';
import { logger } from '../utils/logger.js';

/**
 * Service for managing notifications related to submission workflow
 */
export class NotificationService {
  private notificationRepository: NotificationRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  /**
   * Send notification when submission status changes
   */
  public async notifyStatusChange(
    userId: string,
    submissionId: string,
    previousStatus: SubmissionStatus,
    newStatus: SubmissionStatus,
    comment?: string,
    reviewerRole?: UserRole
  ): Promise<void> {
    try {
      const reviewerTitle = reviewerRole === 'admin' ? 'Administrator' : 'Head of Department';
      
      let message = `Your submission status has been changed from "${previousStatus}" to "${newStatus}"`;
      
      if (reviewerRole) {
        message += ` by ${reviewerTitle}`;
      }
      
      if (comment) {
        message += `. Comment: "${comment}"`;
      }

      const notification: Notification = {
        id: uuidv4(),
        userId,
        message,
        link: `/submissions/${submissionId}`,
        readFlag: false,
        createdAt: new Date()
      };

      await this.notificationRepository.create(notification);
      
      logger.info('Status change notification sent', {
        userId,
        submissionId,
        previousStatus,
        newStatus,
        reviewerRole
      });
    } catch (error) {
      logger.error('Failed to send status change notification', {
        userId,
        submissionId,
        previousStatus,
        newStatus,
        error: error instanceof Error ? error.message : error
      });
      // Don't throw error - notification failure shouldn't break the main workflow
    }
  }

  /**
   * Send notification when comment is added to submission
   */
  public async notifyCommentAdded(
    userId: string,
    submissionId: string,
    comment: string,
    commenterRole: UserRole
  ): Promise<void> {
    try {
      const commenterTitle = commenterRole === 'admin' ? 'Administrator' : 'Head of Department';
      
      const message = `${commenterTitle} added a comment to your submission: "${comment}"`;

      const notification: Notification = {
        id: uuidv4(),
        userId,
        message,
        link: `/submissions/${submissionId}`,
        readFlag: false,
        createdAt: new Date()
      };

      await this.notificationRepository.create(notification);
      
      logger.info('Comment notification sent', {
        userId,
        submissionId,
        commenterRole
      });
    } catch (error) {
      logger.error('Failed to send comment notification', {
        userId,
        submissionId,
        commenterRole,
        error: error instanceof Error ? error.message : error
      });
      // Don't throw error - notification failure shouldn't break the main workflow
    }
  }

  /**
   * Send notification when new submission is created (to HoD and admin)
   */
  public async notifyNewSubmission(
    submissionId: string,
    submitterName: string,
    submitterDepartmentId: string,
    moduleType: string
  ): Promise<void> {
    try {
      // This would typically notify HoD and admin users
      // For now, we'll log the requirement - full implementation would require
      // getting HoD and admin users and sending notifications to them
      
      logger.info('New submission notification required', {
        submissionId,
        submitterName,
        submitterDepartmentId,
        moduleType
      });
      
      // TODO: Implement notification to HoD and admin users
      // 1. Get HoD for the department
      // 2. Get all admin users
      // 3. Send notifications to them
    } catch (error) {
      logger.error('Failed to send new submission notification', {
        submissionId,
        submitterName,
        submitterDepartmentId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Get unread notifications for a user
   */
  public async getUnreadNotifications(userId: string): Promise<Notification[]> {
    try {
      return await this.notificationRepository.findUnreadByUserId(userId);
    } catch (error) {
      logger.error('Failed to get unread notifications', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      // Verify notification belongs to user
      const notification = await this.notificationRepository.findById(notificationId);
      if (!notification || notification.userId !== userId) {
        return false;
      }

      const updated = await this.notificationRepository.update(notificationId, {
        readFlag: true
      });

      return !!updated;
    } catch (error) {
      logger.error('Failed to mark notification as read', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  public async markAllAsRead(userId: string): Promise<number> {
    try {
      return await this.notificationRepository.markAllAsReadForUser(userId);
    } catch (error) {
      logger.error('Failed to mark all notifications as read', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      return 0;
    }
  }

  /**
   * Get all notifications for a user
   */
  public async getAllNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      return await this.notificationRepository.findByUserId(userId, limit);
    } catch (error) {
      logger.error('Failed to get all notifications', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  public async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.notificationRepository.getUnreadCount(userId);
    } catch (error) {
      logger.error('Failed to get unread notification count', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      return 0;
    }
  }
}