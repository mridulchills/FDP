/**
 * Pagination Utilities
 * 
 * Provides comprehensive pagination support for database queries and API responses.
 */

import { Request } from 'express';

// Pagination configuration
export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  defaultPage: number;
}

// Default pagination configuration
const defaultConfig: PaginationConfig = {
  defaultLimit: 10,
  maxLimit: 100,
  defaultPage: 1
};

// Pagination parameters
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage?: number;
  prevPage?: number;
}

// Sort parameters
export interface SortParams {
  field: string;
  direction: 'ASC' | 'DESC';
}

// Filter parameters
export interface FilterParams {
  [key: string]: any;
}

// Query parameters combining pagination, sorting, and filtering
export interface QueryParams {
  pagination: PaginationParams;
  sort?: SortParams;
  filters?: FilterParams;
  search?: string;
}

/**
 * Parse pagination parameters from request query
 */
export function parsePaginationParams(
  query: any,
  config: Partial<PaginationConfig> = {}
): PaginationParams {
  const finalConfig = { ...defaultConfig, ...config };
  
  const page = Math.max(finalConfig.defaultPage, parseInt(query.page) || finalConfig.defaultPage);
  const limit = Math.min(
    finalConfig.maxLimit,
    Math.max(1, parseInt(query.limit) || finalConfig.defaultLimit)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse sort parameters from request query
 */
export function parseSortParams(
  query: any,
  allowedFields: string[] = [],
  defaultField?: string,
  defaultDirection: 'ASC' | 'DESC' = 'ASC'
): SortParams | undefined {
  const sortBy = query.sortBy || query.sort || defaultField;
  const sortOrder = (query.sortOrder || query.order || defaultDirection).toUpperCase();

  if (!sortBy) {
    return undefined;
  }

  // Validate sort field if allowed fields are specified
  if (allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    throw new Error(`Invalid sort field: ${sortBy}. Allowed fields: ${allowedFields.join(', ')}`);
  }

  // Validate sort direction
  if (!['ASC', 'DESC'].includes(sortOrder)) {
    throw new Error(`Invalid sort direction: ${sortOrder}. Must be ASC or DESC`);
  }

  return {
    field: sortBy,
    direction: sortOrder as 'ASC' | 'DESC'
  };
}

/**
 * Parse filter parameters from request query
 */
export function parseFilterParams(
  query: any,
  allowedFilters: string[] = []
): FilterParams {
  const filters: FilterParams = {};

  for (const [key, value] of Object.entries(query)) {
    // Skip pagination and sort parameters
    if (['page', 'limit', 'sortBy', 'sort', 'sortOrder', 'order', 'search'].includes(key)) {
      continue;
    }

    // Validate filter field if allowed filters are specified
    if (allowedFilters.length > 0 && !allowedFilters.includes(key)) {
      continue;
    }

    // Parse filter value
    if (value !== undefined && value !== null && value !== '') {
      filters[key] = value;
    }
  }

  return filters;
}

/**
 * Parse search parameter from request query
 */
export function parseSearchParam(query: any): string | undefined {
  const search = query.search || query.q;
  return search && typeof search === 'string' ? search.trim() : undefined;
}

/**
 * Parse all query parameters
 */
export function parseQueryParams(
  req: Request,
  options: {
    paginationConfig?: Partial<PaginationConfig>;
    allowedSortFields?: string[];
    allowedFilters?: string[];
    defaultSort?: { field: string; direction: 'ASC' | 'DESC' };
  } = {}
): QueryParams {
  const { query } = req;
  
  const pagination = parsePaginationParams(query, options.paginationConfig);
  
  const sort = parseSortParams(
    query,
    options.allowedSortFields,
    options.defaultSort?.field,
    options.defaultSort?.direction
  );
  
  const filters = parseFilterParams(query, options.allowedFilters);
  const search = parseSearchParam(query);

  return {
    pagination,
    ...(sort && { sort }),
    filters,
    ...(search && { search })
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    ...(hasNext && { nextPage: page + 1 }),
    ...(hasPrev && { prevPage: page - 1 })
  };
}

/**
 * Generate SQL LIMIT and OFFSET clause
 */
export function generateLimitOffset(pagination: PaginationParams): string {
  return `LIMIT ${pagination.limit} OFFSET ${pagination.offset}`;
}

/**
 * Generate SQL ORDER BY clause
 */
export function generateOrderBy(sort?: SortParams): string {
  if (!sort) {
    return '';
  }
  
  // Sanitize field name to prevent SQL injection
  const sanitizedField = sort.field.replace(/[^a-zA-Z0-9_]/g, '');
  return `ORDER BY ${sanitizedField} ${sort.direction}`;
}

/**
 * Generate SQL WHERE clause for filters
 */
export function generateWhereClause(
  filters: FilterParams,
  fieldMappings: { [key: string]: string } = {}
): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(filters)) {
    const dbField = fieldMappings[key] || key;
    
    if (Array.isArray(value)) {
      // Handle array values (IN clause)
      const placeholders = value.map(() => '?').join(', ');
      conditions.push(`${dbField} IN (${placeholders})`);
      params.push(...value);
    } else if (typeof value === 'string' && value.includes('*')) {
      // Handle wildcard search
      const likeValue = value.replace(/\*/g, '%');
      conditions.push(`${dbField} LIKE ?`);
      params.push(likeValue);
    } else {
      // Handle exact match
      conditions.push(`${dbField} = ?`);
      params.push(value);
    }
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
}

/**
 * Generate full text search clause
 */
export function generateSearchClause(
  search: string,
  searchFields: string[]
): { clause: string; params: any[] } {
  if (!search || searchFields.length === 0) {
    return { clause: '', params: [] };
  }

  const searchTerm = `%${search}%`;
  const conditions = searchFields.map(field => `${field} LIKE ?`);
  const clause = `(${conditions.join(' OR ')})`;
  const params = new Array(searchFields.length).fill(searchTerm);

  return { clause, params };
}

/**
 * Pagination middleware for Express routes
 */
export function paginationMiddleware(options: {
  defaultLimit?: number;
  maxLimit?: number;
  allowedSortFields?: string[];
  allowedFilters?: string[];
} = {}) {
  return (req: Request, res: any, next: any) => {
    try {
      const queryParams = parseQueryParams(req, {
        paginationConfig: {
          ...(options.defaultLimit && { defaultLimit: options.defaultLimit }),
          ...(options.maxLimit && { maxLimit: options.maxLimit })
        },
        ...(options.allowedSortFields && { allowedSortFields: options.allowedSortFields }),
        ...(options.allowedFilters && { allowedFilters: options.allowedFilters })
      });

      req.queryParams = queryParams;
      next();
    } catch (error) {
      res.respond.error(
        error instanceof Error ? error.message : 'Invalid query parameters',
        400
      );
    }
  };
}

// Request interface is now declared in types/express.d.ts