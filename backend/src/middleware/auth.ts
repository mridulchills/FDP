import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt.js';
import { UserRole } from '../types/index.js';
import { logger } from '../utils/logger.js';

// User type is now declared in types/express.d.ts

/**
 * Authentication middleware - verifies JWT token
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    
    logger.debug(`User authenticated: ${decoded.employeeId} (${decoded.role})`);
    next();
  } catch (error) {
    logger.warn('Authentication failed:', error);
    
    let errorMessage = 'Invalid token';
    if (error instanceof Error) {
      if (error.message === 'Token expired') {
        errorMessage = 'Token expired';
      } else if (error.message === 'Token has been revoked') {
        errorMessage = 'Token has been revoked';
      }
    }
    
    res.status(401).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Authorization middleware factory - checks user roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.employeeId}: required roles [${allowedRoles.join(', ')}], user role: ${req.user.role}`);
      
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    logger.debug(`Authorization granted for user ${req.user.employeeId} with role ${req.user.role}`);
    next();
  };
}

/**
 * Authorization middleware - admin only
 */
export const requireAdmin = requireRole('admin');

/**
 * Authorization middleware - HoD or admin
 */
export const requireHoDOrAdmin = requireRole('hod', 'admin');

/**
 * Authorization middleware - any authenticated user
 */
export const requireAuth = authenticateToken;

/**
 * Department-based authorization middleware
 * Allows access if user is admin, HoD of the department, or the user themselves
 */
export function requireDepartmentAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  const { user } = req;
  const targetUserId = req.params['userId'] || req.params['id'];
  const targetDepartmentId = req.params['departmentId'] || req.body.departmentId;
  
  // Admin has access to everything
  if (user.role === 'admin') {
    next();
    return;
  }
  
  // HoD has access to their department
  if (user.role === 'hod' && targetDepartmentId === user.departmentId) {
    next();
    return;
  }
  
  // Users can access their own data
  if (targetUserId === user.userId) {
    next();
    return;
  }
  
  // Faculty can only access their own department's data if explicitly allowed
  if (user.role === 'faculty' && targetDepartmentId === user.departmentId) {
    next();
    return;
  }
  
  logger.warn(`Department access denied for user ${user.employeeId}: insufficient permissions`);
  
  res.status(403).json({
    success: false,
    error: 'Access denied: insufficient permissions for this department',
    timestamp: new Date().toISOString()
  });
}

/**
 * Self-access authorization middleware
 * Allows access only if user is accessing their own data or is admin
 */
export function requireSelfOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  const { user } = req;
  const targetUserId = req.params['userId'] || req.params['id'];
  
  // Admin has access to everything
  if (user.role === 'admin') {
    next();
    return;
  }
  
  // Users can only access their own data
  if (targetUserId === user.userId) {
    next();
    return;
  }
  
  logger.warn(`Self-access denied for user ${user.employeeId}: trying to access user ${targetUserId}`);
  
  res.status(403).json({
    success: false,
    error: 'Access denied: can only access your own data',
    timestamp: new Date().toISOString()
  });
}

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't require authentication
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      logger.debug(`Optional auth: User identified as ${decoded.employeeId}`);
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    logger.debug('Optional auth failed, continuing without user context');
  }
  
  next();
}

/**
 * Middleware to check if user can modify submission
 */
export function requireSubmissionAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  const { user } = req;
  const action = req.method.toLowerCase();
  
  // Admin can do everything
  if (user.role === 'admin') {
    next();
    return;
  }
  
  // HoD can view and update submissions in their department
  if (user.role === 'hod' && (action === 'get' || action === 'put' || action === 'patch')) {
    next();
    return;
  }
  
  // Faculty can create, view their own, and update their own submissions
  if (user.role === 'faculty') {
    if (action === 'post') {
      // Can create new submissions
      next();
      return;
    }
    
    // For other operations, need to check ownership (this would typically be done in the route handler)
    next();
    return;
  }
  
  logger.warn(`Submission access denied for user ${user.employeeId}: insufficient permissions for action ${action}`);
  
  res.status(403).json({
    success: false,
    error: 'Insufficient permissions for this action',
    timestamp: new Date().toISOString()
  });
}