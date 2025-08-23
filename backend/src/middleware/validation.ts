import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import { logger } from '../utils/logger.js';

/**
 * Middleware to handle validation results from express-validator
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', {
      path: req.path,
      method: req.method,
      errors: errors.array(),
      ip: req.ip
    });
    
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      })),
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next();
};

/**
 * Common validation rules for user input
 */
export const validationRules = {
  // Employee ID validation
  employeeId: () => body('employeeId')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Employee ID must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Employee ID can only contain letters, numbers, hyphens, and underscores'),

  // Password validation
  password: () => body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  // Email validation
  email: () => body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  // Name validation
  name: () => body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage('Name can only contain letters, spaces, periods, apostrophes, and hyphens'),

  // Role validation
  role: () => body('role')
    .isIn(['faculty', 'hod', 'admin'])
    .withMessage('Role must be one of: faculty, hod, admin'),

  // Department ID validation
  departmentId: () => body('departmentId')
    .trim()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),

  // Designation validation
  designation: () => body('designation')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Designation must be between 1 and 100 characters'),

  // Institution validation
  institution: () => body('institution')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Institution must be between 1 and 200 characters'),

  // UUID parameter validation
  uuidParam: (paramName: string) => body(paramName)
    .trim()
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`),

  // Status validation for submissions
  status: () => body('status')
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Status must be one of: pending, approved, rejected'),

  // Module type validation
  moduleType: () => body('moduleType')
    .isIn(['attended', 'organized', 'certification'])
    .withMessage('Module type must be one of: attended, organized, certification'),

  // Comment validation
  comment: () => body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment must not exceed 1000 characters')
};

/**
 * Sanitization middleware to clean user input
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  // Recursively sanitize all string values in request body
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * Validation chain builder for common patterns
 */
export const createValidationChain = (...rules: ValidationChain[]) => {
  return [...rules, handleValidationErrors];
};