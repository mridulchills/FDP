import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SubmissionRepository } from '../repositories/submission-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import { DepartmentRepository } from '../repositories/department-repository.js';
import { SubmissionWorkflowService } from '../services/submission-workflow.js';
import { AuditService } from '../services/audit-service.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validationRules, createValidationChain } from '../middleware/validation.js';
import { ResponseSender } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { 
  Submission, 
  CreateSubmissionRequest, 
  UpdateSubmissionRequest, 
  QueryOptions,
  SubmissionStatus 
} from '../types/index.js';

const router = Router();
const submissionRepository = new SubmissionRepository();
const userRepository = new UserRepository();
const departmentRepository = new DepartmentRepository();
const workflowService = new SubmissionWorkflowService();
const auditService = new AuditService();

/**
 * GET /api/submissions
 * Get all submissions with filtering, pagination, and user information
 */
router.get('/', 
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        status,
        moduleType,
        userId,
        departmentId,
        search
      } = req.query;

      // Build filters
      const filters: Record<string, any> = {};
      
      if (status && typeof status === 'string') {
        filters['status'] = status;
      }
      
      if (moduleType && typeof moduleType === 'string') {
        filters['module_type'] = moduleType;
      }
      
      if (userId && typeof userId === 'string') {
        filters['user_id'] = userId;
      }
      
      if (departmentId && typeof departmentId === 'string') {
        filters['user_department_id'] = departmentId;
      }
      
      // Search functionality (search in form data or comments)
      if (search && typeof search === 'string') {
        filters['search'] = search;
      }

      const options: QueryOptions = {
        page: parseInt(page as string),
        limit: Math.min(100, parseInt(limit as string)), // Max 100 per page
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        filters
      };

      // Apply role-based filtering
      if (req.user?.role === 'faculty') {
        // Faculty can only see their own submissions
        options.filters = { ...options.filters, user_id: req.user.userId };
      } else if (req.user?.role === 'hod') {
        // HoD can see submissions from their department
        options.filters = { ...options.filters, user_department_id: req.user.departmentId };
      }
      // Admins can see all submissions (no additional filtering)

      // Get submissions with user information
      const submissions = await submissionRepository.findWithUserInfo(options);
      
      // Get total count for pagination
      const totalSubmissions = await submissionRepository.count(options.filters);

      logger.info('Submissions retrieved successfully', {
        userId: req.user?.userId,
        count: submissions.length,
        filters: options.filters
      });

      return respond.paginated(submissions, {
        page: options.page!,
        limit: options.limit!,
        total: totalSubmissions
      }, 'Submissions retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve submissions', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve submissions', 500, error);
    }
  }
);

/**
 * GET /api/submissions/my
 * Get current user's submissions
 */
router.get('/my',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        status,
        moduleType
      } = req.query;

      // Build filters for user's submissions
      const filters: Record<string, any> = {
        user_id: req.user!.userId
      };
      
      if (status && typeof status === 'string') {
        filters['status'] = status;
      }
      
      if (moduleType && typeof moduleType === 'string') {
        filters['module_type'] = moduleType;
      }

      const options: QueryOptions = {
        page: parseInt(page as string),
        limit: Math.min(100, parseInt(limit as string)),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        filters
      };

      const submissions = await submissionRepository.findByUserId(req.user!.userId, options);
      const totalSubmissions = await submissionRepository.count(filters);

      logger.info('User submissions retrieved successfully', {
        userId: req.user?.userId,
        count: submissions.length
      });

      return respond.paginated(submissions, {
        page: options.page!,
        limit: options.limit!,
        total: totalSubmissions
      }, 'Your submissions retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve user submissions', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve your submissions', 500, error);
    }
  }
);

/**
 * GET /api/submissions/department
 * Get submissions for current user's department (HoD and Admin only)
 */
router.get('/department',
  authenticateToken,
  requireRole('hod', 'admin'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        status,
        moduleType
      } = req.query;

      // Build filters
      const filters: Record<string, any> = {};
      
      if (status && typeof status === 'string') {
        filters['status'] = status;
      }
      
      if (moduleType && typeof moduleType === 'string') {
        filters['module_type'] = moduleType;
      }

      const options: QueryOptions = {
        page: parseInt(page as string),
        limit: Math.min(100, parseInt(limit as string)),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        filters
      };

      let submissions;
      let totalSubmissions;

      if (req.user?.role === 'admin') {
        // Admin can see all submissions
        submissions = await submissionRepository.findWithUserInfo(options);
        totalSubmissions = await submissionRepository.count(options.filters);
      } else {
        // HoD can see submissions from their department
        submissions = await submissionRepository.findByDepartment(req.user!.departmentId, options);
        totalSubmissions = await submissionRepository.count({
          ...options.filters,
          user_department_id: req.user!.departmentId
        });
      }

      logger.info('Department submissions retrieved successfully', {
        userId: req.user?.userId,
        departmentId: req.user?.departmentId,
        count: submissions.length
      });

      return respond.paginated(submissions, {
        page: options.page!,
        limit: options.limit!,
        total: totalSubmissions
      }, 'Department submissions retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve department submissions', { 
        userId: req.user?.userId, 
        departmentId: req.user?.departmentId,
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve department submissions', 500, error);
    }
  }
);

/**
 * GET /api/submissions/:id
 * Get a specific submission by ID
 */
router.get('/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return respond.error('Submission ID is required', 400);
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid submission ID format', 400);
      }

      const submission = await submissionRepository.findById(id);
      
      if (!submission) {
        return respond.notFound('Submission');
      }

      // Authorization checks
      if (req.user?.role === 'faculty') {
        // Faculty can only access their own submissions
        if (submission.userId !== req.user.userId) {
          return respond.forbidden('Access denied to submission from different user');
        }
      } else if (req.user?.role === 'hod') {
        // HoD can access submissions from their department
        const submissionUser = await userRepository.findById(submission.userId);
        if (!submissionUser || submissionUser.departmentId !== req.user.departmentId) {
          return respond.forbidden('Access denied to submission from different department');
        }
      }
      // Admins can access all submissions

      // Get user and department information
      const user = await userRepository.findById(submission.userId);
      const department = user ? await departmentRepository.findById(user.departmentId) : null;
      
      const submissionWithInfo = {
        ...submission,
        userName: user?.name,
        userEmail: user?.email,
        userEmployeeId: user?.employeeId,
        departmentName: department?.name,
        departmentCode: department?.code
      };

      logger.info('Submission retrieved successfully', {
        userId: req.user?.userId,
        submissionId: id
      });

      return respond.success(submissionWithInfo, 'Submission retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve submission', { 
        userId: req.user?.userId, 
        submissionId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve submission', 500, error);
    }
  }
);

/**
 * POST /api/submissions
 * Create a new submission
 */
router.post('/',
  authenticateToken,
  createValidationChain(
    validationRules.moduleType(),
    // Form data validation - we'll validate the structure based on module type
    // For now, we'll accept any object and validate it in the business logic
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const submissionData: CreateSubmissionRequest = req.body;

      // Validate form data structure based on module type
      if (!submissionData.formData || typeof submissionData.formData !== 'object') {
        return respond.error('Form data is required and must be an object', 400);
      }

      // Basic form data validation based on module type
      const requiredFields = getRequiredFieldsForModuleType(submissionData.moduleType);
      const missingFields = requiredFields.filter(field => 
        !submissionData.formData[field] || 
        (typeof submissionData.formData[field] === 'string' && submissionData.formData[field].trim() === '')
      );

      if (missingFields.length > 0) {
        return respond.validationError({
          field: 'formData',
          errors: [`Missing required fields: ${missingFields.join(', ')}`]
        });
      }

      // Create submission object
      const newSubmission: Submission = {
        id: uuidv4(),
        userId: req.user!.userId,
        moduleType: submissionData.moduleType,
        status: 'pending' as SubmissionStatus,
        formData: submissionData.formData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save submission to database
      const createdSubmission = await submissionRepository.create(newSubmission);
      
      if (!createdSubmission) {
        return respond.error('Failed to create submission', 500);
      }

      // Create audit log for submission creation
      await auditService.logSubmissionCreated(
        req.user!.userId,
        createdSubmission.id,
        createdSubmission.moduleType,
        req.ip,
        req.get('User-Agent')
      );

      // Get user and department information for response
      const user = await userRepository.findById(req.user!.userId);
      const department = user ? await departmentRepository.findById(user.departmentId) : null;
      
      const submissionWithInfo = {
        ...createdSubmission,
        userName: user?.name,
        userEmail: user?.email,
        userEmployeeId: user?.employeeId,
        departmentName: department?.name,
        departmentCode: department?.code
      };

      logger.info('Submission created successfully', {
        userId: req.user?.userId,
        submissionId: createdSubmission.id,
        moduleType: createdSubmission.moduleType
      });

      return respond.created(submissionWithInfo, 'Submission created successfully');

    } catch (error) {
      logger.error('Failed to create submission', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to create submission', 500, error);
    }
  }
);

/**
 * PUT /api/submissions/:id
 * Update an existing submission
 */
router.put('/:id',
  authenticateToken,
  createValidationChain(
    validationRules.status().optional(),
    validationRules.comment().optional()
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return respond.error('Submission ID is required', 400);
      }
      
      const updateData: UpdateSubmissionRequest = req.body;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid submission ID format', 400);
      }

      // Check if submission exists
      const existingSubmission = await submissionRepository.findById(id);
      if (!existingSubmission) {
        return respond.notFound('Submission');
      }

      // Authorization and business logic checks
      if (req.user?.role === 'faculty') {
        // Faculty can only update their own submissions and only if status is pending
        if (existingSubmission.userId !== req.user.userId) {
          return respond.forbidden('Access denied to submission from different user');
        }
        
        if (existingSubmission.status !== 'pending') {
          return respond.error('Cannot update submission that has already been reviewed', 400);
        }
        
        // Faculty cannot change status or add comments
        if (updateData.status || updateData.hodComment || updateData.adminComment) {
          return respond.forbidden('Faculty cannot change submission status or add review comments');
        }
        
        // For faculty updates, we allow updating form data
        if (req.body.formData) {
          // Validate form data structure
          const requiredFields = getRequiredFieldsForModuleType(existingSubmission.moduleType);
          const missingFields = requiredFields.filter(field => 
            !req.body.formData[field] || 
            (typeof req.body.formData[field] === 'string' && req.body.formData[field].trim() === '')
          );

          if (missingFields.length > 0) {
            return respond.validationError({
              field: 'formData',
              errors: [`Missing required fields: ${missingFields.join(', ')}`]
            });
          }
        }
      } else if (req.user?.role === 'hod') {
        // HoD can update submissions from their department
        const submissionUser = await userRepository.findById(existingSubmission.userId);
        if (!submissionUser || submissionUser.departmentId !== req.user.departmentId) {
          return respond.forbidden('Access denied to submission from different department');
        }
        
        // HoD can change status and add HoD comments, but not admin comments
        if (updateData.adminComment) {
          return respond.forbidden('HoD cannot add admin comments');
        }
        
        // HoD cannot modify form data
        if (req.body.formData) {
          return respond.forbidden('HoD cannot modify submission form data');
        }
      } else if (req.user?.role === 'admin') {
        // Admin can update any submission
        // Admin cannot modify form data unless it's their own submission
        if (req.body.formData && existingSubmission.userId !== req.user.userId) {
          return respond.forbidden('Admin cannot modify form data of other users\' submissions');
        }
      }

      // Prepare update data
      const updatePayload: Partial<Submission> = {
        updatedAt: new Date()
      };

      // Handle status updates
      if (updateData.status) {
        updatePayload.status = updateData.status;
      }

      // Handle comment updates
      if (updateData.hodComment !== undefined) {
        updatePayload.hodComment = updateData.hodComment;
      }
      
      if (updateData.adminComment !== undefined) {
        updatePayload.adminComment = updateData.adminComment;
      }

      // Handle form data updates (for faculty updating their own submissions)
      if (req.body.formData && req.user?.role === 'faculty' && existingSubmission.userId === req.user.userId) {
        updatePayload.formData = req.body.formData;
      }

      // Update submission
      const updatedSubmission = await submissionRepository.update(id, updatePayload);
      
      if (!updatedSubmission) {
        return respond.error('Failed to update submission', 500);
      }

      // Create audit log for submission update
      await auditService.logSubmissionUpdated(
        req.user!.userId,
        id,
        Object.keys(updatePayload),
        req.ip,
        req.get('User-Agent')
      );

      // Get user and department information for response
      const user = await userRepository.findById(updatedSubmission.userId);
      const department = user ? await departmentRepository.findById(user.departmentId) : null;
      
      const submissionWithInfo = {
        ...updatedSubmission,
        userName: user?.name,
        userEmail: user?.email,
        userEmployeeId: user?.employeeId,
        departmentName: department?.name,
        departmentCode: department?.code
      };

      logger.info('Submission updated successfully', {
        userId: req.user?.userId,
        submissionId: id,
        updatedFields: Object.keys(updateData)
      });

      return respond.success(submissionWithInfo, 'Submission updated successfully');

    } catch (error) {
      logger.error('Failed to update submission', { 
        userId: req.user?.userId, 
        submissionId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to update submission', 500, error);
    }
  }
);

/**
 * PUT /api/submissions/:id/status
 * Update submission status with comment (HoD and Admin only)
 */
router.put('/:id/status',
  authenticateToken,
  requireRole('hod', 'admin'),
  createValidationChain(
    validationRules.status(),
    validationRules.comment().optional()
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return respond.error('Submission ID is required', 400);
      }
      
      const { status, comment } = req.body;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid submission ID format', 400);
      }

      // Use workflow service to update status with proper validation and notifications
      const result = await workflowService.updateSubmissionStatus(
        id,
        status as SubmissionStatus,
        comment,
        req.user!.userId,
        req.user!.role,
        req.user!.departmentId,
        req.ip,
        req.get('User-Agent')
      );

      if (!result.success) {
        if (result.error?.includes('not found')) {
          return respond.notFound('Submission');
        }
        if (result.error?.includes('Access denied') || result.error?.includes('cannot')) {
          return respond.forbidden(result.error);
        }
        return respond.error(result.error || 'Failed to update submission status', 400);
      }

      // Get user and department information for response
      const user = await userRepository.findById(result.submission!.userId);
      const department = user ? await departmentRepository.findById(user.departmentId) : null;
      
      const submissionWithInfo = {
        ...result.submission,
        userName: user?.name,
        userEmail: user?.email,
        userEmployeeId: user?.employeeId,
        departmentName: department?.name,
        departmentCode: department?.code
      };

      logger.info('Submission status updated successfully', {
        userId: req.user?.userId,
        submissionId: id,
        newStatus: status
      });

      return respond.success(submissionWithInfo, 'Submission status updated successfully');

    } catch (error) {
      logger.error('Failed to update submission status', { 
        userId: req.user?.userId, 
        submissionId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to update submission status', 500, error);
    }
  }
);

/**
 * PUT /api/submissions/:id/comment
 * Add comment to submission (HoD and Admin only)
 */
router.put('/:id/comment',
  authenticateToken,
  requireRole('hod', 'admin'),
  createValidationChain(
    validationRules.comment()
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return respond.error('Submission ID is required', 400);
      }
      
      const { comment } = req.body;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid submission ID format', 400);
      }

      // Use workflow service to add comment with proper validation and notifications
      const result = await workflowService.addComment(
        id,
        comment,
        req.user!.userId,
        req.user!.role,
        req.user!.departmentId,
        req.ip,
        req.get('User-Agent')
      );

      if (!result.success) {
        if (result.error?.includes('not found')) {
          return respond.notFound('Submission');
        }
        if (result.error?.includes('Access denied') || result.error?.includes('cannot')) {
          return respond.forbidden(result.error);
        }
        return respond.error(result.error || 'Failed to add comment', 400);
      }

      // Get user and department information for response
      const user = await userRepository.findById(result.submission!.userId);
      const department = user ? await departmentRepository.findById(user.departmentId) : null;
      
      const submissionWithInfo = {
        ...result.submission,
        userName: user?.name,
        userEmail: user?.email,
        userEmployeeId: user?.employeeId,
        departmentName: department?.name,
        departmentCode: department?.code
      };

      logger.info('Comment added to submission successfully', {
        userId: req.user?.userId,
        submissionId: id
      });

      return respond.success(submissionWithInfo, 'Comment added successfully');

    } catch (error) {
      logger.error('Failed to add comment to submission', { 
        userId: req.user?.userId, 
        submissionId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to add comment', 500, error);
    }
  }
);

/**
 * DELETE /api/submissions/:id
 * Delete a submission (with file cleanup)
 */
router.delete('/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;

      if (!id) {
        return respond.error('Submission ID is required', 400);
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid submission ID format', 400);
      }

      // Check if submission exists
      const existingSubmission = await submissionRepository.findById(id);
      if (!existingSubmission) {
        return respond.notFound('Submission');
      }

      // Authorization checks
      if (req.user?.role === 'faculty') {
        // Faculty can only delete their own submissions and only if status is pending
        if (existingSubmission.userId !== req.user.userId) {
          return respond.forbidden('Access denied to submission from different user');
        }
        
        if (existingSubmission.status !== 'pending') {
          return respond.error('Cannot delete submission that has already been reviewed', 400);
        }
      } else if (req.user?.role === 'hod') {
        // HoD can delete submissions from their department
        const submissionUser = await userRepository.findById(existingSubmission.userId);
        if (!submissionUser || submissionUser.departmentId !== req.user.departmentId) {
          return respond.forbidden('Access denied to submission from different department');
        }
      }
      // Admins can delete any submission

      // TODO: File cleanup - In a complete implementation, we would:
      // 1. Check if submission has associated files (documentUrl)
      // 2. Delete the physical files from storage
      // 3. Clean up any temporary files
      // For now, we'll just log the file cleanup requirement
      if (existingSubmission.documentUrl) {
        logger.info('File cleanup required for submission deletion', {
          submissionId: id,
          documentUrl: existingSubmission.documentUrl,
          userId: req.user?.userId
        });
        // TODO: Implement file deletion logic here
        // await fileService.deleteFile(existingSubmission.documentUrl);
      }

      // Delete the submission
      const deleted = await submissionRepository.delete(id);
      
      if (!deleted) {
        return respond.error('Failed to delete submission', 500);
      }

      // Create audit log for submission deletion
      await auditService.logSubmissionDeleted(
        req.user!.userId,
        id,
        existingSubmission.userId,
        req.ip,
        req.get('User-Agent')
      );

      logger.info('Submission deleted successfully', {
        userId: req.user?.userId,
        deletedSubmissionId: id,
        submissionUserId: existingSubmission.userId
      });

      return respond.success(
        { deletedSubmissionId: id }, 
        'Submission deleted successfully'
      );

    } catch (error) {
      logger.error('Failed to delete submission', { 
        userId: req.user?.userId, 
        submissionId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to delete submission', 500, error);
    }
  }
);

/**
 * GET /api/submissions/stats
 * Get submission statistics
 */
router.get('/stats',
  authenticateToken,
  requireRole('hod', 'admin'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      let departmentId: string | undefined;
      
      // HoD can only see stats for their department
      if (req.user?.role === 'hod') {
        departmentId = req.user.departmentId;
      }
      // Admin can see stats for all departments or specific department if requested
      else if (req.user?.role === 'admin' && req.query['departmentId']) {
        departmentId = req.query['departmentId'] as string;
      }

      const stats = await submissionRepository.getStats(departmentId);

      logger.info('Submission statistics retrieved', {
        userId: req.user?.userId,
        departmentId
      });

      return respond.success(stats, 'Submission statistics retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve submission statistics', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve submission statistics', 500, error);
    }
  }
);

/**
 * Helper function to get required fields for each module type
 */
function getRequiredFieldsForModuleType(moduleType: 'attended' | 'organized' | 'certification'): string[] {
  switch (moduleType) {
    case 'attended':
      return ['title', 'organizer', 'startDate', 'endDate', 'venue'];
    case 'organized':
      return ['title', 'description', 'startDate', 'endDate', 'venue', 'participants'];
    case 'certification':
      return ['title', 'issuingOrganization', 'issueDate', 'certificateNumber'];
    default:
      return [];
  }
}

export default router;