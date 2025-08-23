import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/environment.js';

/**
 * Extended request interface to track timing
 */
interface TimedRequest extends Request {
  startTime?: number;
}

/**
 * Request logging middleware with detailed information
 */
export const requestLogger = (req: TimedRequest, res: Response, next: NextFunction) => {
  // Record start time
  req.startTime = Date.now();

  // Extract relevant request information
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString()
  };

  // Log request in development mode with more details
  if (config.NODE_ENV === 'development') {
    logger.info('Incoming request:', {
      ...requestInfo,
      headers: req.headers,
      query: req.query,
      params: req.params,
      // Don't log sensitive data like passwords
      body: sanitizeBodyForLogging(req.body)
    });
  } else {
    // Log minimal info in production
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: requestInfo.timestamp
    });
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = req.startTime ? Date.now() - req.startTime : 0;
    
    // Log response information
    const responseInfo = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: JSON.stringify(body).length,
      timestamp: new Date().toISOString()
    };

    if (config.NODE_ENV === 'development') {
      logger.info('Response sent:', {
        ...responseInfo,
        // Don't log sensitive response data
        body: sanitizeBodyForLogging(body)
      });
    } else {
      // Log response summary in production
      if (res.statusCode >= 400) {
        logger.warn(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`, {
          ip: req.ip,
          error: body.error || 'Unknown error'
        });
      } else {
        logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`);
      }
    }

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Sanitize request/response body for logging
 * Remove sensitive information like passwords, tokens, etc.
 */
const sanitizeBodyForLogging = (body: any): any => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'session',
    'secret',
    'key',
    'passwordHash'
  ];

  const sanitized = { ...body };

  const sanitizeObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const lowerKey = key.toLowerCase();
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeObject(obj[key]);
          }
        }
      }
      return result;
    }
    return obj;
  };

  return sanitizeObject(sanitized);
};

/**
 * Error logging middleware
 */
export const errorLogger = (error: any, req: Request, _res: Response, next: NextFunction) => {
  const errorInfo = {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  // Log error with appropriate level
  if (error.statusCode && error.statusCode < 500) {
    logger.warn('Client error:', errorInfo);
  } else {
    logger.error('Server error:', errorInfo);
  }

  next(error);
};