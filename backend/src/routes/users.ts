import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../repositories/user-repository.js';
import { DepartmentRepository } from '../repositories/department-repository.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validationRules, createValidationChain } from '../middleware/validation.js';
import { ResponseSender } from '../utils/response.js';
import { hashPassword, validatePassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { User, CreateUserRequest, UpdateUserRequest, QueryOptions } from '../types/index.js';

const router = Router();
const userRepository = new UserRepository();
const departmentRepository = new DepartmentRepository();

/**
 * GET /api/users
 * Get all users with filtering, pagination, and department information
 */
router.get('/', 
  authenticateToken,
  requireRole('admin', 'hod'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'name', 
        sortOrder = 'asc',
        role,
        departmentId,
        search
      } = req.query;

      // Build filters
      const filters: Record<string, any> = {};
      
      if (role && typeof role === 'string') {
        filters['role'] = role;
      }
      
      if (departmentId && typeof departmentId === 'string') {
        filters['department_id'] = departmentId;
      }
      
      // Search functionality
      if (search && typeof search === 'string') {
        // For search, we'll need to modify the query to use LIKE
        filters['search'] = search;
      }

      const options: QueryOptions = {
        page: parseInt(page as string),
        limit: Math.min(100, parseInt(limit as string)), // Max 100 per page
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        filters
      };

      // If user is HoD, restrict to their department only
      if (req.user?.role === 'hod') {
        options.filters = { ...options.filters, department_id: req.user.departmentId };
      }

      // Get users with department information
      const users = await userRepository.findWithDepartment(options);
      
      // Get total count for pagination
      const totalUsers = await userRepository.countWithDepartment(options.filters);
      
      // Remove password hashes from response
      const sanitizedUsers = users.map(user => {
        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      logger.info('Users retrieved successfully', {
        userId: req.user?.userId,
        count: users.length,
        filters: options.filters
      });

      return respond.paginated(sanitizedUsers, {
        page: options.page!,
        limit: options.limit!,
        total: totalUsers
      }, 'Users retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve users', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve users', 500, error);
    }
  }
);

/**
 * GET /api/users/:id
 * Get a specific user by ID
 */
router.get('/:id',
  authenticateToken,
  requireRole('admin', 'hod'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return respond.error('User ID is required', 400);
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid user ID format', 400);
      }

      const user = await userRepository.findById(id);
      
      if (!user) {
        return respond.notFound('User');
      }

      // If user is HoD, ensure they can only access users from their department
      if (req.user?.role === 'hod' && user.departmentId !== req.user.departmentId) {
        return respond.forbidden('Access denied to user from different department');
      }

      // Get department information
      const department = await departmentRepository.findById(user.departmentId);
      
      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = user;
      const userWithDepartment = {
        ...userWithoutPassword,
        departmentName: department?.name,
        departmentCode: department?.code
      };

      logger.info('User retrieved successfully', {
        userId: req.user?.userId,
        targetUserId: id
      });

      return respond.success(userWithDepartment, 'User retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve user', { 
        userId: req.user?.userId, 
        targetUserId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve user', 500, error);
    }
  }
);

/**
 * POST /api/users
 * Create a new user
 */
router.post('/',
  authenticateToken,
  requireRole('admin'), // Only admins can create users
  createValidationChain(
    validationRules.employeeId(),
    validationRules.name(),
    validationRules.email(),
    validationRules.role(),
    validationRules.departmentId(),
    validationRules.designation(),
    validationRules.institution(),
    validationRules.password()
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const userData: CreateUserRequest = req.body;

      // Validate password strength
      const passwordValidation = validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        return respond.validationError({
          field: 'password',
          errors: passwordValidation.errors,
          suggestions: passwordValidation.suggestions
        });
      }

      // Check if employee ID already exists
      const existingUserByEmployeeId = await userRepository.findByEmployeeId(userData.employeeId);
      if (existingUserByEmployeeId) {
        return respond.conflict('Employee ID already exists');
      }

      // Check if email already exists
      const existingUserByEmail = await userRepository.findByEmail(userData.email);
      if (existingUserByEmail) {
        return respond.conflict('Email already exists');
      }

      // Verify department exists
      const department = await departmentRepository.findById(userData.departmentId);
      if (!department) {
        return respond.error('Department not found', 400);
      }

      // Hash password
      const passwordHash = await hashPassword(userData.password);

      // Create user object
      const newUser: User = {
        id: uuidv4(),
        employeeId: userData.employeeId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        departmentId: userData.departmentId,
        designation: userData.designation,
        institution: userData.institution,
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save user to database
      const createdUser = await userRepository.create(newUser);
      
      if (!createdUser) {
        return respond.error('Failed to create user', 500);
      }

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = createdUser;
      const userWithDepartment = {
        ...userWithoutPassword,
        departmentName: department.name,
        departmentCode: department.code
      };

      logger.info('User created successfully', {
        userId: req.user?.userId,
        createdUserId: createdUser.id,
        employeeId: createdUser.employeeId
      });

      return respond.created(userWithDepartment, 'User created successfully');

    } catch (error) {
      logger.error('Failed to create user', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to create user', 500, error);
    }
  }
);

/**
 * PUT /api/users/:id
 * Update an existing user
 */
router.put('/:id',
  authenticateToken,
  requireRole('admin', 'hod'),
  createValidationChain(
    validationRules.name().optional(),
    validationRules.email().optional(),
    validationRules.role().optional(),
    validationRules.departmentId().optional(),
    validationRules.designation().optional(),
    validationRules.institution().optional()
  ),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;
      const updateData: UpdateUserRequest = req.body;

      if (!id) {
        return respond.error('User ID is required', 400);
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid user ID format', 400);
      }

      // Check if user exists
      const existingUser = await userRepository.findById(id);
      if (!existingUser) {
        return respond.notFound('User');
      }

      // Authorization checks
      if (req.user?.role === 'hod') {
        // HoDs can only update users in their department
        if (existingUser.departmentId !== req.user.departmentId) {
          return respond.forbidden('Access denied to user from different department');
        }
        
        // HoDs cannot change user roles or departments
        if (updateData.role || updateData.departmentId) {
          return respond.forbidden('HoDs cannot change user roles or departments');
        }
      }

      // Validate email uniqueness if email is being updated
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailTaken = await userRepository.isEmailTaken(updateData.email, id);
        if (emailTaken) {
          return respond.conflict('Email already exists');
        }
      }

      // Validate department exists if department is being updated
      if (updateData.departmentId) {
        const department = await departmentRepository.findById(updateData.departmentId);
        if (!department) {
          return respond.error('Department not found', 400);
        }
      }

      // Prepare update data
      const updatePayload: Partial<User> = {
        ...updateData,
        updatedAt: new Date()
      };

      // Update user
      const updatedUser = await userRepository.update(id, updatePayload);
      
      if (!updatedUser) {
        return respond.error('Failed to update user', 500);
      }

      // Get department information for response
      const department = await departmentRepository.findById(updatedUser.departmentId);
      
      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = updatedUser;
      const userWithDepartment = {
        ...userWithoutPassword,
        departmentName: department?.name,
        departmentCode: department?.code
      };

      logger.info('User updated successfully', {
        userId: req.user?.userId,
        updatedUserId: id,
        updatedFields: Object.keys(updateData)
      });

      return respond.success(userWithDepartment, 'User updated successfully');

    } catch (error) {
      logger.error('Failed to update user', { 
        userId: req.user?.userId, 
        targetUserId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to update user', 500, error);
    }
  }
);

/**
 * DELETE /api/users/:id
 * Delete a user (with cascade handling)
 */
router.delete('/:id',
  authenticateToken,
  requireRole('admin'), // Only admins can delete users
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const { id } = req.params;

      if (!id) {
        return respond.error('User ID is required', 400);
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return respond.error('Invalid user ID format', 400);
      }

      // Check if user exists
      const existingUser = await userRepository.findById(id);
      if (!existingUser) {
        return respond.notFound('User');
      }

      // Prevent deletion of the last admin user
      if (existingUser.role === 'admin') {
        const adminUsers = await userRepository.findByRole('admin');
        if (adminUsers.length <= 1) {
          return respond.error('Cannot delete the last admin user', 400);
        }
      }

      // Prevent users from deleting themselves
      if (req.user?.userId === id) {
        return respond.error('Cannot delete your own account', 400);
      }

      // Check if user is HoD of any department
      const departmentsAsHoD = await departmentRepository.findAll({ 
        filters: { hod_user_id: id } 
      });
      
      if (departmentsAsHoD.length > 0) {
        return respond.error(
          'Cannot delete user who is Head of Department. Please assign a new HoD first.',
          400,
          { departments: departmentsAsHoD.map(d => d.name) }
        );
      }

      // TODO: In a complete implementation, we would also need to handle:
      // - Reassigning or deleting user's submissions
      // - Cleaning up notifications
      // - Updating audit logs
      // For now, we'll rely on database cascade constraints

      // Delete the user
      const deleted = await userRepository.delete(id);
      
      if (!deleted) {
        return respond.error('Failed to delete user', 500);
      }

      logger.info('User deleted successfully', {
        userId: req.user?.userId,
        deletedUserId: id,
        deletedUserEmployeeId: existingUser.employeeId
      });

      return respond.success(
        { deletedUserId: id }, 
        'User deleted successfully'
      );

    } catch (error) {
      logger.error('Failed to delete user', { 
        userId: req.user?.userId, 
        targetUserId: req.params['id'],
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to delete user', 500, error);
    }
  }
);

/**
 * GET /api/users/stats
 * Get user statistics (admin only)
 */
router.get('/stats',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const respond = new ResponseSender(res, req.requestId);
    
    try {
      const stats = await userRepository.getStats();

      logger.info('User statistics retrieved', {
        userId: req.user?.userId
      });

      return respond.success(stats, 'User statistics retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve user statistics', { 
        userId: req.user?.userId, 
        error: error instanceof Error ? error.message : error 
      });
      return respond.error('Failed to retrieve user statistics', 500, error);
    }
  }
);

export default router;