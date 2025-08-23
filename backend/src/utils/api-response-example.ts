/**
 * API Response Standardization Example
 * 
 * Demonstrates how to use the response utilities, pagination, versioning,
 * and compression features together.
 */

import { Request, Response, Router } from 'express';
import { responseMiddleware } from './response';
import { createCompressionMiddleware, responseOptimizationMiddleware } from '../middleware/compression';
import { versionMiddleware, ApiVersion } from './versioning';
import { paginationMiddleware } from './pagination';

/**
 * Example API route using all response standardization features
 */
export function createExampleRouter(): Router {
  const router = Router();

  // Apply middleware stack
  router.use(responseMiddleware);
  router.use(createCompressionMiddleware());
  router.use(responseOptimizationMiddleware);
  router.use(versionMiddleware);
  router.use(paginationMiddleware({
    defaultLimit: 10,
    maxLimit: 100,
    allowedSortFields: ['name', 'email', 'createdAt'],
    allowedFilters: ['role', 'department', 'status']
  }));

  /**
   * Example: Get users with pagination, filtering, and sorting
   */
  router.get('/users', async (req: Request, res: Response) => {
    try {
      const { pagination, sort, filters, search } = req.queryParams;

      // Simulate database query
      const mockUsers = [
        { id: '1', name: 'John Doe', email: 'john@example.com', role: 'faculty' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'hod' },
        // ... more users
      ];

      // Apply filters and search (in real implementation, this would be in the database query)
      let filteredUsers = mockUsers;
      
      if (search) {
        filteredUsers = filteredUsers.filter(user => 
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (filters && filters['role']) {
        filteredUsers = filteredUsers.filter(user => user.role === filters['role']);
      }

      // Apply sorting
      if (sort) {
        filteredUsers.sort((a, b) => {
          const aValue = (a as any)[sort.field];
          const bValue = (b as any)[sort.field];
          const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          return sort.direction === 'DESC' ? -comparison : comparison;
        });
      }

      // Apply pagination
      const total = filteredUsers.length;
      const startIndex = pagination.offset;
      const endIndex = startIndex + pagination.limit;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      // Send paginated response
      res.respond.paginated(
        paginatedUsers,
        {
          page: pagination.page,
          limit: pagination.limit,
          total
        },
        'Users retrieved successfully'
      );

    } catch (error) {
      res.respond.error(
        'Failed to retrieve users',
        500,
        error instanceof Error ? error.message : error
      );
    }
  });

  /**
   * Example: Create user
   */
  router.post('/users', async (req: Request, res: Response) => {
    try {
      const userData = req.body;

      // Validate input (in real implementation, use validation middleware)
      if (!userData.name || !userData.email) {
        return res.respond.validationError({
          name: userData.name ? null : 'Name is required',
          email: userData.email ? null : 'Email is required'
        });
      }

      // Simulate user creation
      const newUser = {
        id: Date.now().toString(),
        ...userData,
        createdAt: new Date().toISOString()
      };

      return res.respond.created(newUser, 'User created successfully');

    } catch (error) {
      return res.respond.error(
        'Failed to create user',
        500,
        error instanceof Error ? error.message : error
      );
    }
  });

  /**
   * Example: Get single user
   */
  router.get('/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Simulate database lookup
      const user = { id, name: 'John Doe', email: 'john@example.com' };

      if (!user) {
        return res.respond.notFound('User');
      }

      return res.respond.success(user, 'User retrieved successfully');

    } catch (error) {
      return res.respond.error(
        'Failed to retrieve user',
        500,
        error instanceof Error ? error.message : error
      );
    }
  });

  /**
   * Example: Update user
   */
  router.put('/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Simulate user update
      const updatedUser = {
        id,
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      res.respond.success(updatedUser, 'User updated successfully');

    } catch (error) {
      res.respond.error(
        'Failed to update user',
        500,
        error instanceof Error ? error.message : error
      );
    }
  });

  /**
   * Example: Delete user
   */
  router.delete('/users/:id', async (_req: Request, res: Response) => {
    try {
      // Simulate user deletion
      // In real implementation, check if user exists first

      return res.respond.noContent();

    } catch (error) {
      return res.respond.error(
        'Failed to delete user',
        500,
        error instanceof Error ? error.message : error
      );
    }
  });

  /**
   * Example: Version-specific endpoint
   */
  router.get('/version-info', (req: Request, res: Response) => {
    const versionInfo = {
      version: req.apiVersion,
      deprecated: req.versionConfig.deprecated || false,
      features: req.apiVersion === ApiVersion.V2 ? 
        ['enhanced-pagination', 'improved-filtering', 'better-error-handling'] :
        ['basic-pagination', 'simple-filtering']
    };

    res.respond.success(versionInfo, 'Version information retrieved');
  });

  /**
   * Example: Error handling
   */
  router.get('/error-example', (req: Request, res: Response) => {
    const errorType = req.query['type'] as string;

    switch (errorType) {
      case 'validation':
        return res.respond.validationError({
          field1: 'Field1 is required',
          field2: 'Field2 must be a valid email'
        });
      
      case 'unauthorized':
        return res.respond.unauthorized('Invalid credentials');
      
      case 'forbidden':
        return res.respond.forbidden('Insufficient permissions');
      
      case 'notfound':
        return res.respond.notFound('Resource');
      
      case 'conflict':
        return res.respond.conflict('Resource already exists');
      
      default:
        return res.respond.error('Internal server error', 500);
    }
  });

  return router;
}

/**
 * Example usage in main server file
 */
export function setupApiResponseStandardization(app: any) {
  // Global middleware
  app.use(responseMiddleware);
  app.use(createCompressionMiddleware());
  app.use(responseOptimizationMiddleware);
  app.use(versionMiddleware);

  // API routes
  app.use('/api/v1', createExampleRouter());
  app.use('/api/v2', createExampleRouter());
}