/**
 * API Response Standardization Utilities
 * 
 * Provides consistent response formats, pagination helpers,
 * and response optimization for the FDTS API.
 */

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Standard API response interface
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    timestamp: string;
    requestId?: string;
}

// Paginated response interface
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// Error response interface
export interface ErrorResponse extends ApiResponse {
    success: false;
    error: string;
    details?: any;
    stack?: string;
}

// Pagination parameters interface
export interface PaginationParams {
    page: number;
    limit: number;
    offset: number;
}

/**
 * Success response helper
 */
export function successResponse<T>(
    data: T,
    message?: string,
    requestId?: string
): ApiResponse<T> {
    return {
        success: true,
        data,
        ...(message && { message }),
        timestamp: new Date().toISOString(),
        ...(requestId && { requestId })
    };
}

/**
 * Error response helper
 */
export function errorResponse(
    error: string,
    details?: any,
    requestId?: string,
    includeStack = false
): ErrorResponse {
    const response: ErrorResponse = {
        success: false,
        error,
        timestamp: new Date().toISOString(),
        ...(requestId && { requestId })
    };

    if (details) {
        response.details = details;
    }

    if (includeStack && details instanceof Error && details.stack) {
        response.stack = details.stack;
    }

    return response;
}

/**
 * Paginated response helper
 */
export function paginatedResponse<T>(
    data: T[],
    pagination: {
        page: number;
        limit: number;
        total: number;
    },
    message?: string,
    requestId?: string
): PaginatedResponse<T> {
    const totalPages = Math.ceil(pagination.total / pagination.limit);

    return {
        success: true,
        data,
        ...(message && { message }),
        timestamp: new Date().toISOString(),
        ...(requestId && { requestId }),
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages,
            hasNext: pagination.page < totalPages,
            hasPrev: pagination.page > 1
        }
    };
}/*
*
 * Parse pagination parameters from query string
 */
export function parsePaginationParams(query: any): PaginationParams {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

/**
 * Response sender utility class
 */
export class ResponseSender {
    private res: Response;
    private requestId: string;

    constructor(res: Response, requestId?: string) {
        this.res = res;
        this.requestId = requestId || uuidv4();
    }

    /**
     * Send success response
     */
    success<T>(data: T, message?: string, statusCode = 200): Response {
        return this.res.status(statusCode).json(
            successResponse(data, message, this.requestId)
        );
    }

    /**
     * Send error response
     */
    error(
        error: string,
        statusCode = 500,
        details?: any,
        includeStack = false
    ): Response {
        return this.res.status(statusCode).json(
            errorResponse(error, details, this.requestId, includeStack)
        );
    }

    /**
     * Send paginated response
     */
    paginated<T>(
        data: T[],
        pagination: { page: number; limit: number; total: number },
        message?: string,
        statusCode = 200
    ): Response {
        return this.res.status(statusCode).json(
            paginatedResponse(data, pagination, message, this.requestId)
        );
    }

    /**
     * Send validation error response
     */
    validationError(errors: any): Response {
        return this.error('Validation failed', 400, errors);
    }

    /**
     * Send not found response
     */
    notFound(resource = 'Resource'): Response {
        return this.error(`${resource} not found`, 404);
    }

    /**
     * Send unauthorized response
     */
    unauthorized(message = 'Unauthorized'): Response {
        return this.error(message, 401);
    }

    /**
     * Send forbidden response
     */
    forbidden(message = 'Forbidden'): Response {
        return this.error(message, 403);
    }

    /**
     * Send conflict response
     */
    conflict(message = 'Conflict'): Response {
        return this.error(message, 409);
    }

    /**
     * Send created response
     */
    created<T>(data: T, message = 'Created successfully'): Response {
        return this.success(data, message, 201);
    }

    /**
     * Send no content response
     */
    noContent(): Response {
        return this.res.status(204).send();
    }
}

/**
 * Express middleware to add response utilities to res object
 */
export function responseMiddleware(req: any, res: Response, next: any) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.locals['requestId'] = requestId;

    // Add response sender to res object
    res.respond = new ResponseSender(res, requestId);

    next();
}

// Extend Express Response interface
declare global {
    namespace Express {
        interface Response {
            respond: ResponseSender;
        }
        // Request interface is now declared in types/express.d.ts
    }
}