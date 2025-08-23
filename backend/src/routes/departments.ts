import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DepartmentRepository } from '../repositories/department-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { createValidationChain } from '../middleware/validation.js';
import { body } from 'express-validator';
import { ResponseSender } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { Department, QueryOptions } from '../types/index.js';

// Extended department type with HOD information
interface DepartmentWithHod extends Department {
  hodName?: string;
  hodEmail?: string;
  hodEmployeeId?: string;
  userCount?: number;
}

const router = Router();
const departmentRepository = new DepartmentRepository();
const userRepository = new UserRepository();

// Department-specific validation rules
const departmentValidationRules = {
  // Department name validation
  departmentName: () => body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Department name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s&.-]+$/)
    .withMessage('Department name can only contain letters, spaces, ampersands, periods, and hyphens'),

  // Department code validation
  departmentCode: () => body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Department code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Department code can only contain uppercase letters and numbers'),

  // HOD user ID validation (optional)
  hodUserId: () => body('hodUserId')
    .optional()
    .trim()
    .custom((value) => {
      if (value === null || value === '') return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    })
    .withMessage('HOD User ID must be a valid UUID or null')
};

/**
 * GET /api/departments
 * Get all departments with filtering, pagination, and HOD information
 */
router.get('/', 
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'name', 
        sortOrder = 'asc',
        search,
        withHod = 'true',
        withUserCount = 'false'
      } = req.query;

      // Build filters
      const filters: Record<string, any> = {};
      
      // Search functionality
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

      let departments;
      let totalDepartments;

      // Get departments with HOD information if requested
      if (withHod === 'true') {
        departments = await departmentRepository.findWithHodInfo(options);
        totalDepartments = await departmentRepository.count(options.filters);
      } else if (withUserCount === 'true') {
        departments = await departmentRepository.findWithUserCount(options);
        totalDepartments = await departmentRepository.count(options.filters);
      } else {
        departments = await departmentRepository.findAll(options);
        totalDepartments = await departmentRepository.count(options.filters);
      }

      logger.info('Departments retrieved successfully', {
        userId: req.user?.userId,
        count: departments.length,
        filters: options.filters
      });

      return respond.paginated(departments, {
        page: options.page!,
        limit: options.limit!,
        total: totalDepartments
      }, 'Departments retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve departments', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve departments', 500, error);
    }
  }
);/**

 * GET /api/departments/:id
 * Get a specific department by ID
 */
router.get('/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return respond.error('Department ID is required', 400);
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid department ID format', 400);
      }

      const department = await departmentRepository.findById(id);
      
      if (!department) {
        return respond.notFound('Department');
      }

      // Get HOD information if available
      let departmentWithHod: DepartmentWithHod = { ...department };
      if (department.hodUserId) {
        const hod = await userRepository.findById(department.hodUserId);
        if (hod) {
          departmentWithHod = {
            ...department,
            hodName: hod.name,
            hodEmail: hod.email,
            hodEmployeeId: hod.employeeId
          };
        }
      }

      // Get user count for this department
      const userCount = await userRepository.count({ department_id: id });
      const departmentWithStats: DepartmentWithHod = {
        ...departmentWithHod,
        userCount
      };

      logger.info('Department retrieved successfully', {
        userId: req.user?.userId,
        departmentId: id
      });

      return respond.success(departmentWithStats, 'Department retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve department', { 
        userId: req.user?.userId, 
        departmentId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve department', 500, error);
    }
  }
);

/**
 * POST /api/departments
 * Create a new department
 */
router.post('/',
  authenticateToken,
  requireRole('admin'), // Only admins can create departments
  createValidationChain(
    departmentValidationRules.departmentName(),
    departmentValidationRules.departmentCode(),
    departmentValidationRules.hodUserId()
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { name, code, hodUserId } = req.body;

      // Check if department name already exists
      const existingDepartmentByName = await departmentRepository.findByName(name);
      if (existingDepartmentByName) {
        return respond.conflict('Department name already exists');
      }

      // Check if department code already exists
      const existingDepartmentByCode = await departmentRepository.findByCode(code);
      if (existingDepartmentByCode) {
        return respond.conflict('Department code already exists');
      }

      // Validate HOD user if provided
      let hodUser = null;
      if (hodUserId) {
        hodUser = await userRepository.findById(hodUserId);
        if (!hodUser) {
          return respond.error('HOD user not found', 400);
        }

        // Check if user is already HOD of another department
        const existingHodDepartment = await departmentRepository.findByHodUserId(hodUserId);
        if (existingHodDepartment) {
          return respond.error('User is already HOD of another department', 400);
        }

        // Verify user has appropriate role (should be faculty or hod)
        if (hodUser.role !== 'faculty' && hodUser.role !== 'hod') {
          return respond.error('HOD must be a faculty member or existing HOD', 400);
        }
      }

      // Create department object
      const newDepartment: Department = {
        id: uuidv4(),
        name,
        code: code.toUpperCase(), // Ensure code is uppercase
        hodUserId: hodUserId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save department to database
      const createdDepartment = await departmentRepository.create(newDepartment);
      
      if (!createdDepartment) {
        return respond.error('Failed to create department', 500);
      }

      // If HOD was assigned, update their role to 'hod' if they were faculty
      if (hodUser && hodUser.role === 'faculty') {
        await userRepository.update(hodUserId, { 
          role: 'hod',
          updatedAt: new Date()
        });
      }

      // Prepare response with HOD information
      let departmentResponse: DepartmentWithHod = { ...createdDepartment };
      if (hodUser) {
        departmentResponse = {
          ...createdDepartment,
          hodName: hodUser.name,
          hodEmail: hodUser.email,
          hodEmployeeId: hodUser.employeeId
        };
      }

      logger.info('Department created successfully', {
        userId: req.user?.userId,
        departmentId: createdDepartment.id,
        departmentName: createdDepartment.name,
        hodUserId: hodUserId
      });

      return respond.created(departmentResponse, 'Department created successfully');

    } catch (error) {
      logger.error('Failed to create department', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to create department', 500, error);
    }
  }
);/**

 * PUT /api/departments/:id
 * Update an existing department
 */
router.put('/:id',
  authenticateToken,
  requireRole('admin'), // Only admins can update departments
  createValidationChain(
    departmentValidationRules.departmentName().optional(),
    departmentValidationRules.departmentCode().optional(),
    departmentValidationRules.hodUserId()
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      const { name, code, hodUserId } = req.body;

      if (!id) {
        return respond.error('Department ID is required', 400);
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid department ID format', 400);
      }

      // Check if department exists
      const existingDepartment = await departmentRepository.findById(id);
      if (!existingDepartment) {
        return respond.notFound('Department');
      }

      // Validate name uniqueness if name is being updated
      if (name && name !== existingDepartment.name) {
        const nameTaken = await departmentRepository.isNameTaken(name, id);
        if (nameTaken) {
          return respond.conflict('Department name already exists');
        }
      }

      // Validate code uniqueness if code is being updated
      if (code && code !== existingDepartment.code) {
        const codeTaken = await departmentRepository.isCodeTaken(code.toUpperCase(), id);
        if (codeTaken) {
          return respond.conflict('Department code already exists');
        }
      }

      // Handle HOD assignment changes
      let hodUser = null;
      let previousHodUser = null;
      
      // Get previous HOD if exists
      if (existingDepartment.hodUserId) {
        previousHodUser = await userRepository.findById(existingDepartment.hodUserId);
      }

      // Validate new HOD user if provided
      if (hodUserId !== undefined) {
        if (hodUserId && hodUserId !== existingDepartment.hodUserId) {
          hodUser = await userRepository.findById(hodUserId);
          if (!hodUser) {
            return respond.error('HOD user not found', 400);
          }

          // Check if user is already HOD of another department
          const existingHodDepartment = await departmentRepository.findByHodUserId(hodUserId);
          if (existingHodDepartment && existingHodDepartment.id !== id) {
            return respond.error('User is already HOD of another department', 400);
          }

          // Verify user has appropriate role
          if (hodUser.role !== 'faculty' && hodUser.role !== 'hod') {
            return respond.error('HOD must be a faculty member or existing HOD', 400);
          }

          // Verify user belongs to this department
          if (hodUser.departmentId !== id) {
            return respond.error('HOD must be a member of this department', 400);
          }
        }
      }

      // Prepare update data
      const updateData: Partial<Department> = {
        updatedAt: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code.toUpperCase();
      if (hodUserId !== undefined) updateData.hodUserId = hodUserId || null;

      // Update department
      const updatedDepartment = await departmentRepository.update(id, updateData);
      
      if (!updatedDepartment) {
        return respond.error('Failed to update department', 500);
      }

      // Handle role changes for HOD assignment
      if (hodUserId !== undefined) {
        // If removing HOD (setting to null), demote previous HOD to faculty if they have no other HOD roles
        if (!hodUserId && previousHodUser && previousHodUser.role === 'hod') {
          const otherHodDepartments = await departmentRepository.findAll({
            filters: { hod_user_id: previousHodUser.id }
          });
          
          if (otherHodDepartments.length === 0) {
            await userRepository.update(previousHodUser.id, { 
              role: 'faculty',
              updatedAt: new Date()
            });
          }
        }

        // If assigning new HOD, promote them to HOD role if they were faculty
        if (hodUser && hodUser.role === 'faculty') {
          await userRepository.update(hodUserId, { 
            role: 'hod',
            updatedAt: new Date()
          });
        }
      }

      // Prepare response with HOD information
      let departmentResponse: DepartmentWithHod = { ...updatedDepartment };
      if (updatedDepartment.hodUserId) {
        const currentHod = await userRepository.findById(updatedDepartment.hodUserId);
        if (currentHod) {
          departmentResponse = {
            ...updatedDepartment,
            hodName: currentHod.name,
            hodEmail: currentHod.email,
            hodEmployeeId: currentHod.employeeId
          };
        }
      }

      // Get user count for response
      const userCount = await userRepository.count({ department_id: id });
      const departmentWithStats: DepartmentWithHod = {
        ...departmentResponse,
        userCount
      };

      logger.info('Department updated successfully', {
        userId: req.user?.userId,
        departmentId: id,
        updatedFields: Object.keys(req.body),
        previousHodId: existingDepartment.hodUserId,
        newHodId: updatedDepartment.hodUserId
      });

      return respond.success(departmentWithStats, 'Department updated successfully');

    } catch (error) {
      logger.error('Failed to update department', { 
        userId: req.user?.userId, 
        departmentId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to update department', 500, error);
    }
  }
);/*
*
 * DELETE /api/departments/:id
 * Delete a department (with user handling)
 */
router.delete('/:id',
  authenticateToken,
  requireRole('admin'), // Only admins can delete departments
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      const { transferToDepartmentId } = req.query;

      if (!id) {
        return respond.error('Department ID is required', 400);
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid department ID format', 400);
      }

      // Check if department exists
      const existingDepartment = await departmentRepository.findById(id);
      if (!existingDepartment) {
        return respond.notFound('Department');
      }

      // Check if there are users in this department
      const usersInDepartment = await userRepository.count({ department_id: id });
      
      if (usersInDepartment > 0) {
        if (!transferToDepartmentId) {
          return respond.error(
            'Cannot delete department with users. Please provide transferToDepartmentId to transfer users to another department.',
            400,
            { userCount: usersInDepartment }
          );
        }

        // Validate transfer department exists
        if (typeof transferToDepartmentId === 'string') {
          if (!uuidRegex.test(transferToDepartmentId)) {
            return respond.error('Invalid transfer department ID format', 400);
          }

          const transferDepartment = await departmentRepository.findById(transferToDepartmentId);
          if (!transferDepartment) {
            return respond.error('Transfer department not found', 400);
          }

          if (transferToDepartmentId === id) {
            return respond.error('Cannot transfer users to the same department being deleted', 400);
          }
        }
      }

      // Get HOD information before deletion for logging
      let previousHodUser = null;
      if (existingDepartment.hodUserId) {
        previousHodUser = await userRepository.findById(existingDepartment.hodUserId);
      }

      // Delete department with user handling
      const deleted = await departmentRepository.deleteWithUserHandling(
        id, 
        transferToDepartmentId as string | undefined
      );
      
      if (!deleted) {
        return respond.error('Failed to delete department', 500);
      }

      // If previous HOD exists and was demoted, check if they should be demoted to faculty
      if (previousHodUser && previousHodUser.role === 'hod') {
        const otherHodDepartments = await departmentRepository.findAll({
          filters: { hod_user_id: previousHodUser.id }
        });
        
        if (otherHodDepartments.length === 0) {
          await userRepository.update(previousHodUser.id, { 
            role: 'faculty',
            updatedAt: new Date()
          });
        }
      }

      logger.info('Department deleted successfully', {
        userId: req.user?.userId,
        deletedDepartmentId: id,
        deletedDepartmentName: existingDepartment.name,
        transferToDepartmentId: transferToDepartmentId,
        usersTransferred: usersInDepartment,
        previousHodId: existingDepartment.hodUserId
      });

      return respond.success(
        { 
          deletedDepartmentId: id,
          usersTransferred: usersInDepartment,
          transferToDepartmentId: transferToDepartmentId || null
        }, 
        'Department deleted successfully'
      );

    } catch (error) {
      logger.error('Failed to delete department', { 
        userId: req.user?.userId, 
        departmentId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to delete department', 500, error);
    }
  }
);

/**
 * PUT /api/departments/:id/hod
 * Assign or update HOD for a department
 */
router.put('/:id/hod',
  authenticateToken,
  requireRole('admin'), // Only admins can assign HODs
  createValidationChain(
    body('hodUserId')
      .optional()
      .trim()
      .custom((value) => {
        if (value === null || value === '') return true;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      })
      .withMessage('HOD User ID must be a valid UUID or null')
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      const { hodUserId } = req.body;

      if (!id) {
        return respond.error('Department ID is required', 400);
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid department ID format', 400);
      }

      // Check if department exists
      const existingDepartment = await departmentRepository.findById(id);
      if (!existingDepartment) {
        return respond.notFound('Department');
      }

      // Get previous HOD if exists
      let previousHodUser = null;
      if (existingDepartment.hodUserId) {
        previousHodUser = await userRepository.findById(existingDepartment.hodUserId);
      }

      // Validate new HOD user if provided
      let newHodUser = null;
      if (hodUserId) {
        newHodUser = await userRepository.findById(hodUserId);
        if (!newHodUser) {
          return respond.error('HOD user not found', 400);
        }

        // Check if user is already HOD of another department
        const existingHodDepartment = await departmentRepository.findByHodUserId(hodUserId);
        if (existingHodDepartment && existingHodDepartment.id !== id) {
          return respond.error('User is already HOD of another department', 400);
        }

        // Verify user has appropriate role
        if (newHodUser.role !== 'faculty' && newHodUser.role !== 'hod') {
          return respond.error('HOD must be a faculty member or existing HOD', 400);
        }

        // Verify user belongs to this department
        if (newHodUser.departmentId !== id) {
          return respond.error('HOD must be a member of this department', 400);
        }
      }

      // Update department HOD
      const updatedDepartment = await departmentRepository.updateHod(id, hodUserId || null);
      
      if (!updatedDepartment) {
        return respond.error('Failed to update department HOD', 500);
      }

      // Handle role changes
      // If removing HOD (setting to null), demote previous HOD to faculty if they have no other HOD roles
      if (!hodUserId && previousHodUser && previousHodUser.role === 'hod') {
        const otherHodDepartments = await departmentRepository.findAll({
          filters: { hod_user_id: previousHodUser.id }
        });
        
        if (otherHodDepartments.length === 0) {
          await userRepository.update(previousHodUser.id, { 
            role: 'faculty',
            updatedAt: new Date()
          });
        }
      }

      // If assigning new HOD, promote them to HOD role if they were faculty
      if (newHodUser && newHodUser.role === 'faculty') {
        await userRepository.update(hodUserId, { 
          role: 'hod',
          updatedAt: new Date()
        });
      }

      // Prepare response with HOD information
      let departmentResponse: DepartmentWithHod = { ...updatedDepartment };
      if (newHodUser) {
        departmentResponse = {
          ...updatedDepartment,
          hodName: newHodUser.name,
          hodEmail: newHodUser.email,
          hodEmployeeId: newHodUser.employeeId
        };
      }

      logger.info('Department HOD updated successfully', {
        userId: req.user?.userId,
        departmentId: id,
        previousHodId: existingDepartment.hodUserId,
        newHodId: hodUserId
      });

      return respond.success(departmentResponse, 'Department HOD updated successfully');

    } catch (error) {
      logger.error('Failed to update department HOD', { 
        userId: req.user?.userId, 
        departmentId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to update department HOD', 500, error);
    }
  }
);/**

 * GET /api/departments/stats
 * Get department statistics (admin only)
 */
router.get('/stats',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const stats = await departmentRepository.getStats();

      logger.info('Department statistics retrieved', {
        userId: req.user?.userId
      });

      return respond.success(stats, 'Department statistics retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve department statistics', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve department statistics', 500, error);
    }
  }
);

/**
 * GET /api/departments/:id/users
 * Get all users in a specific department
 */
router.get('/:id/users',
  authenticateToken,
  requireRole('admin', 'hod'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return respond.error('Department ID is required', 400);
      }
      
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'name', 
        sortOrder = 'asc',
        role,
        search
      } = req.query;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid department ID format', 400);
      }

      // Check if department exists
      const department = await departmentRepository.findById(id);
      if (!department) {
        return respond.notFound('Department');
      }

      // If user is HoD, ensure they can only access their own department
      if (req.user?.role === 'hod' && req.user.departmentId !== id) {
        return respond.forbidden('Access denied to users from different department');
      }

      // Build filters
      const filters: Record<string, any> = {
        department_id: id
      };
      
      if (role && typeof role === 'string') {
        filters['role'] = role;
      }
      
      if (search && typeof search === 'string') {
        filters['search'] = search;
      }

      const options: QueryOptions = {
        page: parseInt(page as string),
        limit: Math.min(100, parseInt(limit as string)),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        filters
      };

      // Get users in department
      const users = await userRepository.findAll(options);
      const totalUsers = await userRepository.count(options.filters);
      
      // Remove password hashes from response
      const sanitizedUsers = users.map(user => {
        const { passwordHash, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          departmentName: department.name,
          departmentCode: department.code
        };
      });

      logger.info('Department users retrieved successfully', {
        userId: req.user?.userId,
        departmentId: id,
        count: users.length,
        filters: options.filters
      });

      return respond.paginated(sanitizedUsers, {
        page: options.page!,
        limit: options.limit!,
        total: totalUsers
      }, 'Department users retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve department users', { 
        userId: req.user?.userId, 
        departmentId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve department users', 500, error);
    }
  }
);

export default router;