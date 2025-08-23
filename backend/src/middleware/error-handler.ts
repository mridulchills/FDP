import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/environment.js';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string | undefined;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database error handler
 */
const handleDatabaseError = (error: any): AppError => {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new AppError('Duplicate entry found', 409, 'DUPLICATE_ENTRY');
  }
  
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return new AppError('Referenced record not found', 400, 'FOREIGN_KEY_CONSTRAINT');
  }
  
  if (error.code === 'SQLITE_CONSTRAINT_NOTNULL') {
    return new AppError('Required field is missing', 400, 'REQUIRED_FIELD_MISSING');
  }

  return new AppError('Database operation failed', 500, 'DATABASE_ERROR');
};

/**
 * JWT error handler
 */
const handleJWTError = (error: any): AppError => {
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
  }
  
  if (error.name === 'NotBeforeError') {
    return new AppError('Token not active yet', 401, 'TOKEN_NOT_ACTIVE');
  }

  return new AppError('Authentication failed', 401, 'AUTH_ERROR');
};

/**
 * Validation error handler
 */
const handleValidationError = (error: any): AppError => {
  const message = error.details ? error.details.map((detail: any) => detail.message).join(', ') : error.message;
  return new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
};

/**
 * Send error response in development
 */
const sendErrorDev = (err: AppError, req: Request, res: Response) => {
  logger.error('Error details:', {
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  });

  res.status(err.statusCode).json({
    success: false,
    error: err.message,
    code: err.code,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

/**
 * Send error response in production
 */
const sendErrorProd = (err: AppError, req: Request, res: Response) => {
  // Log error details for internal monitoring
  logger.error('Production error:', {
    error: err.message,
    statusCode: err.statusCode,
    code: err.code,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Only send operational errors to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  } else {
    // Don't leak error details in production
    res.status(500).json({
      success: false,
      error: 'Something went wrong',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Global error handling middleware
 */
export const globalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let err = error;

  // Convert known error types to AppError
  if (error.code && error.code.startsWith('SQLITE_')) {
    err = handleDatabaseError(error);
  } else if (error.name && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
    err = handleJWTError(error);
  } else if (error.name === 'ValidationError' || error.details) {
    err = handleValidationError(error);
  } else if (!(error instanceof AppError)) {
    // Convert unknown errors to AppError
    err = new AppError(error.message || 'Something went wrong', error.statusCode || 500);
  }

  // Send appropriate error response
  if (config.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    sendErrorProd(err, req, res);
  }
};

/**
 * Async error wrapper to catch async errors
 */
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

/**
 * Unhandled rejection handler
 */
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Close server gracefully
    process.exit(1);
  });
};

/**
 * Uncaught exception handler
 */
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    // Close server gracefully
    process.exit(1);
  });
};