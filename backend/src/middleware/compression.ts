/**
 * Response Compression Middleware
 * 
 * Provides response compression and optimization for the FDTS API.
 */

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Compression configuration options
 */
interface CompressionOptions {
  threshold?: number;
  level?: number;
  chunkSize?: number;
  windowBits?: number;
  memLevel?: number;
  strategy?: number;
}

/**
 * Default compression options
 */
const defaultOptions: CompressionOptions = {
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (1-9, 6 is default)
  chunkSize: 16 * 1024, // 16KB chunks
  windowBits: 15,
  memLevel: 8,
  strategy: 0
};

/**
 * Custom compression filter
 * Determines which responses should be compressed
 */
function shouldCompress(req: Request, res: Response): boolean {
  // Don't compress if client doesn't support it
  if (!req.headers['accept-encoding']) {
    return false;
  }

  // Don't compress if response is already compressed
  if (res.getHeader('content-encoding')) {
    return false;
  }

  // Don't compress images, videos, or already compressed files
  const contentType = res.getHeader('content-type') as string;
  if (contentType) {
    const nonCompressibleTypes = [
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/x-rar-compressed',
      'application/pdf'
    ];

    if (nonCompressibleTypes.some(type => contentType.startsWith(type))) {
      return false;
    }
  }

  // Compress text-based content
  const compressibleTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml'
  ];

  if (contentType && compressibleTypes.some(type => contentType.startsWith(type))) {
    return true;
  }

  // Default compression filter
  return compression.filter(req, res);
}

/**
 * Create compression middleware with custom options
 */
export function createCompressionMiddleware(options: CompressionOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return compression({
    filter: shouldCompress,
    threshold: config.threshold,
    level: config.level,
    chunkSize: config.chunkSize,
    windowBits: config.windowBits,
    memLevel: config.memLevel,
    strategy: config.strategy
  });
}

/**
 * Response optimization middleware
 * Adds cache headers and other optimizations
 */
export function responseOptimizationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Add cache control for static assets
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  } else if (req.path.startsWith('/api/')) {
    // API responses should not be cached by default
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Add request ID header for tracing
  if (req.requestId) {
    res.setHeader('X-Request-ID', req.requestId);
  }

  // Add response time header
  const startTime = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${responseTime}ms`);
  });

  next();
}

/**
 * JSON response optimization
 * Removes null values and optimizes JSON structure
 */
export function optimizeJsonResponse(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(optimizeJsonResponse).filter(item => item !== null);
  }

  if (typeof obj === 'object') {
    const optimized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const optimizedValue = optimizeJsonResponse(value);
      
      // Only include non-null values
      if (optimizedValue !== null && optimizedValue !== undefined) {
        optimized[key] = optimizedValue;
      }
    }
    
    return optimized;
  }

  return obj;
}

/**
 * Middleware to optimize JSON responses
 */
export function jsonOptimizationMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const originalJson = res.json;

  res.json = function(obj: any) {
    const optimized = optimizeJsonResponse(obj);
    return originalJson.call(this, optimized);
  };

  next();
}