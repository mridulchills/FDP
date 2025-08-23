import { SubmissionStatus, UserRole, Submission } from '../types/index.js';
import { SubmissionRepository } from '../repositories/submission-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import { NotificationService } from './notification-service.js';
import { AuditService } from './audit-service.js';
import { logger } from '../utils/logger.js';

/**
 * Service for managing submission workflow logic including status transitions,
 * role-based access control, and notifications
 */
export class SubmissionWorkflowService {
  private submissionRepository: SubmissionRepository;
  private userRepository: UserRepository;
  private notificationService: NotificationService;
  private auditService: AuditService;

  constructor() {
    this.submissionRepository = new SubmissionRepository();
    this.userRepository = new UserRepository();
    this.notificationService = new NotificationService();
    this.auditService = new AuditService();
  }

  /**
   * Validate if a status transition is allowed
   */
  public validateStatusTransition(
    currentStatus: SubmissionStatus,
    newStatus: SubmissionStatus,
    userRole: UserRole
  ): { valid: boolean; reason?: string } {
    // Only pending submissions can be transitioned
    if (currentStatus !== 'pending') {
      return {
        valid: false,
        reason: 'Only pending submissions can have their status changed'
      };
    }

    // Valid transitions from pending
    const validTransitions: SubmissionStatus[] = ['approved', 'rejected'];
    if (!validTransitions.includes(newStatus)) {
      return {
        valid: false,
        reason: `Invalid status transition from ${currentStatus} to ${newStatus}`
      };
    }

    // Role-based validation
    if (userRole === 'faculty') {
      return {
        valid: false,
        reason: 'Faculty members cannot change submission status'
      };
    }

    // HoD and admin can approve/reject
    if (userRole === 'hod' || userRole === 'admin') {
      return { valid: true };
    }

    return {
      valid: false,
      reason: 'Insufficient permissions to change submission status'
    };
  }

  /**
   * Check if a user can access a specific submission
   */
  public async canAccessSubmission(
    submissionId: string,
    userId: string,
    userRole: UserRole,
    userDepartmentId: string
  ): Promise<{ canAccess: boolean; reason?: string }> {
    try {
      const submission = await this.submissionRepository.findById(submissionId);
      
      if (!submission) {
        return { canAccess: false, reason: 'Submission not found' };
      }

      // Faculty can only access their own submissions
      if (userRole === 'faculty') {
        if (submission.userId !== userId) {
          return { 
            canAccess: false, 
            reason: 'Faculty can only access their own submissions' 
          };
        }
        return { canAccess: true };
      }

      // HoD can access submissions from their department
      if (userRole === 'hod') {
        const submissionUser = await this.userRepository.findById(submission.userId);
        if (!submissionUser || submissionUser.departmentId !== userDepartmentId) {
          return { 
            canAccess: false, 
            reason: 'HoD can only access submissions from their department' 
          };
        }
        return { canAccess: true };
      }

      // Admin can access all submissions
      if (userRole === 'admin') {
        return { canAccess: true };
      }

      return { canAccess: false, reason: 'Invalid user role' };
    } catch (error) {
      logger.error('Error checking submission access', { submissionId, userId, error });
      return { canAccess: false, reason: 'Error checking access permissions' };
    }
  }

  /**
   * Check if a user can modify a specific submission
   */
  public async canModifySubmission(
    submissionId: string,
    userId: string,
    userRole: UserRole,
    userDepartmentId: string,
    modificationType: 'form_data' | 'status' | 'comment'
  ): Promise<{ canModify: boolean; reason?: string }> {
    try {
      const submission = await this.submissionRepository.findById(submissionId);
      
      if (!submission) {
        return { canModify: false, reason: 'Submission not found' };
      }

      // Check basic access first
      const accessCheck = await this.canAccessSubmission(submissionId, userId, userRole, userDepartmentId);
      if (!accessCheck.canAccess) {
        return { canModify: false, reason: accessCheck.reason || 'Access denied' };
      }

      // Faculty-specific rules
      if (userRole === 'faculty') {
        // Faculty can only modify their own submissions
        if (submission.userId !== userId) {
          return { canModify: false, reason: 'Faculty can only modify their own submissions' };
        }
        
        // Faculty can only modify form data and only if status is pending
        if (modificationType !== 'form_data') {
          return { canModify: false, reason: 'Faculty can only modify form data' };
        }
        
        if (submission.status !== 'pending') {
          return { 
            canModify: false, 
            reason: 'Cannot modify submissions that have been reviewed' 
          };
        }
        
        return { canModify: true };
      }

      // HoD-specific rules
      if (userRole === 'hod') {
        // HoD cannot modify form data unless it's their own submission
        if (modificationType === 'form_data' && submission.userId !== userId) {
          return { canModify: false, reason: 'HoD cannot modify form data of other users' };
        }
        
        // HoD can modify status and add comments for department submissions
        if (modificationType === 'status' || modificationType === 'comment') {
          return { canModify: true };
        }
        
        return { canModify: true };
      }

      // Admin-specific rules
      if (userRole === 'admin') {
        // Admin cannot modify form data unless it's their own submission
        if (modificationType === 'form_data' && submission.userId !== userId) {
          return { canModify: false, reason: 'Admin cannot modify form data of other users' };
        }
        
        // Admin can modify status and add comments for all submissions
        return { canModify: true };
      }

      return { canModify: false, reason: 'Invalid user role' };
    } catch (error) {
      logger.error('Error checking submission modification permissions', { 
        submissionId, userId, modificationType, error 
      });
      return { canModify: false, reason: 'Error checking modification permissions' };
    }
  }

  /**
   * Update submission status with proper workflow validation and notifications
   */
  public async updateSubmissionStatus(
    submissionId: string,
    newStatus: SubmissionStatus,
    comment: string | undefined,
    reviewerId: string,
    reviewerRole: UserRole,
    reviewerDepartmentId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; submission?: Submission; error?: string }> {
    try {
      // Get current submission
      const currentSubmission = await this.submissionRepository.findById(submissionId);
      if (!currentSubmission) {
        return { success: false, error: 'Submission not found' };
      }

      // Validate status transition
      const transitionValidation = this.validateStatusTransition(
        currentSubmission.status,
        newStatus,
        reviewerRole
      );
      
      if (!transitionValidation.valid) {
        return { success: false, error: transitionValidation.reason || 'Invalid status transition' };
      }

      // Check modification permissions
      const modifyCheck = await this.canModifySubmission(
        submissionId,
        reviewerId,
        reviewerRole,
        reviewerDepartmentId,
        'status'
      );
      
      if (!modifyCheck.canModify) {
        return { success: false, error: modifyCheck.reason || 'Cannot modify submission' };
      }

      // Update submission status
      const commentType = reviewerRole === 'admin' ? 'admin' : 'hod';
      const updatedSubmission = await this.submissionRepository.updateStatus(
        submissionId,
        newStatus,
        comment,
        commentType
      );

      if (!updatedSubmission) {
        return { success: false, error: 'Failed to update submission status' };
      }

      // Create audit log
      await this.auditService.logAction(
        reviewerId,
        'status_update',
        'submission',
        submissionId,
        {
          previousStatus: currentSubmission.status,
          newStatus,
          comment,
          commentType
        },
        ipAddress,
        userAgent
      );

      // Send notification to submission owner
      await this.notificationService.notifyStatusChange(
        updatedSubmission.userId,
        submissionId,
        currentSubmission.status,
        newStatus,
        comment,
        reviewerRole
      );

      logger.info('Submission status updated successfully', {
        submissionId,
        previousStatus: currentSubmission.status,
        newStatus,
        reviewerId,
        reviewerRole
      });

      return { success: true, submission: updatedSubmission };
    } catch (error) {
      logger.error('Failed to update submission status', {
        submissionId,
        newStatus,
        reviewerId,
        error: error instanceof Error ? error.message : error
      });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Add comment to submission with proper validation
   */
  public async addComment(
    submissionId: string,
    comment: string,
    commenterId: string,
    commenterRole: UserRole,
    commenterDepartmentId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; submission?: Submission; error?: string }> {
    try {
      // Check modification permissions
      const modifyCheck = await this.canModifySubmission(
        submissionId,
        commenterId,
        commenterRole,
        commenterDepartmentId,
        'comment'
      );
      
      if (!modifyCheck.canModify) {
        return { success: false, error: modifyCheck.reason || 'Cannot add comment to submission' };
      }

      // Get current submission
      const currentSubmission = await this.submissionRepository.findById(submissionId);
      if (!currentSubmission) {
        return { success: false, error: 'Submission not found' };
      }

      // Update comment based on role
      const commentType = commenterRole === 'admin' ? 'admin' : 'hod';
      const updates: Partial<Submission> = { updatedAt: new Date() };
      
      if (commentType === 'admin') {
        updates.adminComment = comment;
      } else {
        updates.hodComment = comment;
      }

      const updatedSubmission = await this.submissionRepository.update(submissionId, updates);
      
      if (!updatedSubmission) {
        return { success: false, error: 'Failed to add comment' };
      }

      // Create audit log
      await this.auditService.logAction(
        commenterId,
        'comment_added',
        'submission',
        submissionId,
        {
          comment,
          commentType
        },
        ipAddress,
        userAgent
      );

      // Send notification to submission owner if comment is added by reviewer
      if (currentSubmission.userId !== commenterId) {
        await this.notificationService.notifyCommentAdded(
          currentSubmission.userId,
          submissionId,
          comment,
          commenterRole
        );
      }

      logger.info('Comment added to submission successfully', {
        submissionId,
        commenterId,
        commenterRole,
        commentType
      });

      return { success: true, submission: updatedSubmission };
    } catch (error) {
      logger.error('Failed to add comment to submission', {
        submissionId,
        commenterId,
        error: error instanceof Error ? error.message : error
      });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get submissions accessible to a user based on their role
   */
  public async getAccessibleSubmissions(
    userId: string,
    userRole: UserRole,
    userDepartmentId: string,
    options: {
      status?: SubmissionStatus;
      moduleType?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<Submission[]> {
    try {
      const queryOptions = {
        page: options.page || 1,
        limit: options.limit || 10,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc' as 'desc',
        filters: {} as Record<string, any>
      };

      // Add status filter if provided
      if (options.status) {
        queryOptions.filters['status'] = options.status;
      }

      // Add module type filter if provided
      if (options.moduleType) {
        queryOptions.filters['module_type'] = options.moduleType;
      }

      // Apply role-based filtering
      if (userRole === 'faculty') {
        // Faculty can only see their own submissions
        return await this.submissionRepository.findByUserId(userId, queryOptions);
      } else if (userRole === 'hod') {
        // HoD can see submissions from their department
        return await this.submissionRepository.findByDepartment(userDepartmentId, queryOptions);
      } else if (userRole === 'admin') {
        // Admin can see all submissions
        return await this.submissionRepository.findAll(queryOptions);
      }

      return [];
    } catch (error) {
      logger.error('Failed to get accessible submissions', {
        userId,
        userRole,
        userDepartmentId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
}