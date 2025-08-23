import { logger } from './logger.js';

/**
 * SQL Query Builder utility for constructing complex queries
 */
export class QueryBuilder {
  private selectFields: string[] = [];
  private fromTable: string = '';
  private joinClauses: string[] = [];
  private whereConditions: string[] = [];
  private groupByFields: string[] = [];
  private havingConditions: string[] = [];
  private orderByFields: string[] = [];
  private limitValue: number | undefined;
  private offsetValue: number | undefined;
  private parameters: any[] = [];

  /**
   * Set SELECT fields
   */
  public select(fields: string | string[]): QueryBuilder {
    if (typeof fields === 'string') {
      this.selectFields = [fields];
    } else {
      this.selectFields = fields;
    }
    return this;
  }

  /**
   * Add additional SELECT fields
   */
  public addSelect(fields: string | string[]): QueryBuilder {
    if (typeof fields === 'string') {
      this.selectFields.push(fields);
    } else {
      this.selectFields.push(...fields);
    }
    return this;
  }

  /**
   * Set FROM table
   */
  public from(table: string): QueryBuilder {
    this.fromTable = table;
    return this;
  }

  /**
   * Add INNER JOIN
   */
  public innerJoin(table: string, condition: string): QueryBuilder {
    this.joinClauses.push(`INNER JOIN ${table} ON ${condition}`);
    return this;
  }

  /**
   * Add LEFT JOIN
   */
  public leftJoin(table: string, condition: string): QueryBuilder {
    this.joinClauses.push(`LEFT JOIN ${table} ON ${condition}`);
    return this;
  }

  /**
   * Add RIGHT JOIN
   */
  public rightJoin(table: string, condition: string): QueryBuilder {
    this.joinClauses.push(`RIGHT JOIN ${table} ON ${condition}`);
    return this;
  }

  /**
   * Add WHERE condition
   */
  public where(condition: string, value?: any): QueryBuilder {
    this.whereConditions.push(condition);
    if (value !== undefined) {
      this.parameters.push(value);
    }
    return this;
  }

  /**
   * Add WHERE condition with AND operator
   */
  public andWhere(condition: string, value?: any): QueryBuilder {
    return this.where(condition, value);
  }

  /**
   * Add WHERE condition with OR operator
   */
  public orWhere(condition: string, value?: any): QueryBuilder {
    if (this.whereConditions.length > 0) {
      const lastCondition = this.whereConditions.pop();
      this.whereConditions.push(`(${lastCondition}) OR (${condition})`);
    } else {
      this.whereConditions.push(condition);
    }
    if (value !== undefined) {
      this.parameters.push(value);
    }
    return this;
  }

  /**
   * Add WHERE IN condition
   */
  public whereIn(field: string, values: any[]): QueryBuilder {
    if (values.length === 0) {
      return this.where('1 = 0'); // Always false condition
    }
    
    const placeholders = values.map(() => '?').join(', ');
    this.whereConditions.push(`${field} IN (${placeholders})`);
    this.parameters.push(...values);
    return this;
  }

  /**
   * Add WHERE NOT IN condition
   */
  public whereNotIn(field: string, values: any[]): QueryBuilder {
    if (values.length === 0) {
      return this; // No condition needed
    }
    
    const placeholders = values.map(() => '?').join(', ');
    this.whereConditions.push(`${field} NOT IN (${placeholders})`);
    this.parameters.push(...values);
    return this;
  }

  /**
   * Add WHERE LIKE condition
   */
  public whereLike(field: string, pattern: string): QueryBuilder {
    this.whereConditions.push(`${field} LIKE ?`);
    this.parameters.push(pattern);
    return this;
  }

  /**
   * Add WHERE BETWEEN condition
   */
  public whereBetween(field: string, min: any, max: any): QueryBuilder {
    this.whereConditions.push(`${field} BETWEEN ? AND ?`);
    this.parameters.push(min, max);
    return this;
  }

  /**
   * Add WHERE IS NULL condition
   */
  public whereNull(field: string): QueryBuilder {
    this.whereConditions.push(`${field} IS NULL`);
    return this;
  }

  /**
   * Add WHERE IS NOT NULL condition
   */
  public whereNotNull(field: string): QueryBuilder {
    this.whereConditions.push(`${field} IS NOT NULL`);
    return this;
  }

  /**
   * Add GROUP BY field
   */
  public groupBy(field: string | string[]): QueryBuilder {
    if (typeof field === 'string') {
      this.groupByFields.push(field);
    } else {
      this.groupByFields.push(...field);
    }
    return this;
  }

  /**
   * Add HAVING condition
   */
  public having(condition: string, value?: any): QueryBuilder {
    this.havingConditions.push(condition);
    if (value !== undefined) {
      this.parameters.push(value);
    }
    return this;
  }

  /**
   * Add ORDER BY field
   */
  public orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.orderByFields.push(`${field} ${direction}`);
    return this;
  }

  /**
   * Set LIMIT
   */
  public limit(count: number): QueryBuilder {
    this.limitValue = count;
    return this;
  }

  /**
   * Set OFFSET
   */
  public offset(count: number): QueryBuilder {
    this.offsetValue = count;
    return this;
  }

  /**
   * Set pagination (limit and offset)
   */
  public paginate(page: number, perPage: number): QueryBuilder {
    this.limitValue = perPage;
    this.offsetValue = (page - 1) * perPage;
    return this;
  }

  /**
   * Build the complete SQL query
   */
  public toSql(): { sql: string; params: any[] } {
    let sql = '';

    // SELECT clause
    if (this.selectFields.length === 0) {
      sql += 'SELECT *';
    } else {
      sql += `SELECT ${this.selectFields.join(', ')}`;
    }

    // FROM clause
    if (!this.fromTable) {
      throw new Error('FROM table is required');
    }
    sql += ` FROM ${this.fromTable}`;

    // JOIN clauses
    if (this.joinClauses.length > 0) {
      sql += ` ${this.joinClauses.join(' ')}`;
    }

    // WHERE clause
    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    // GROUP BY clause
    if (this.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }

    // HAVING clause
    if (this.havingConditions.length > 0) {
      sql += ` HAVING ${this.havingConditions.join(' AND ')}`;
    }

    // ORDER BY clause
    if (this.orderByFields.length > 0) {
      sql += ` ORDER BY ${this.orderByFields.join(', ')}`;
    }

    // LIMIT clause
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    // OFFSET clause
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    logger.debug('Built SQL query', { sql, params: this.parameters });

    return {
      sql: sql.trim(),
      params: [...this.parameters]
    };
  }

  /**
   * Reset the query builder
   */
  public reset(): QueryBuilder {
    this.selectFields = [];
    this.fromTable = '';
    this.joinClauses = [];
    this.whereConditions = [];
    this.groupByFields = [];
    this.havingConditions = [];
    this.orderByFields = [];
    this.limitValue = undefined;
    this.offsetValue = undefined;
    this.parameters = [];
    return this;
  }

  /**
   * Clone the current query builder
   */
  public clone(): QueryBuilder {
    const cloned = new QueryBuilder();
    cloned.selectFields = [...this.selectFields];
    cloned.fromTable = this.fromTable;
    cloned.joinClauses = [...this.joinClauses];
    cloned.whereConditions = [...this.whereConditions];
    cloned.groupByFields = [...this.groupByFields];
    cloned.havingConditions = [...this.havingConditions];
    cloned.orderByFields = [...this.orderByFields];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.parameters = [...this.parameters];
    return cloned;
  }
}

/**
 * Create a new QueryBuilder instance
 */
export function createQueryBuilder(): QueryBuilder {
  return new QueryBuilder();
}

/**
 * Prepared statement utility for safe SQL execution
 */
export class PreparedStatement {
  private sql: string;
  private params: any[];

  constructor(sql: string, params: any[] = []) {
    this.sql = sql;
    this.params = params;
  }

  /**
   * Get the SQL string
   */
  public getSql(): string {
    return this.sql;
  }

  /**
   * Get the parameters
   */
  public getParams(): any[] {
    return [...this.params];
  }

  /**
   * Add a parameter
   */
  public addParam(value: any): PreparedStatement {
    this.params.push(value);
    return this;
  }

  /**
   * Set parameters
   */
  public setParams(params: any[]): PreparedStatement {
    this.params = [...params];
    return this;
  }

  /**
   * Replace a placeholder in the SQL with a parameter
   */
  public bind(placeholder: string, value: any): PreparedStatement {
    this.sql = this.sql.replace(new RegExp(`:${placeholder}\\b`, 'g'), '?');
    this.params.push(value);
    return this;
  }

  /**
   * Create a prepared statement from a query builder
   */
  public static fromQueryBuilder(queryBuilder: QueryBuilder): PreparedStatement {
    const { sql, params } = queryBuilder.toSql();
    return new PreparedStatement(sql, params);
  }
}

/**
 * SQL sanitization utilities
 */
export class SqlSanitizer {
  /**
   * Escape SQL identifier (table name, column name, etc.)
   */
  public static escapeIdentifier(identifier: string): string {
    // Remove any non-alphanumeric characters except underscore
    const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Ensure it doesn't start with a number
    if (/^\d/.test(cleaned)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    
    return cleaned;
  }

  /**
   * Validate table name
   */
  public static validateTableName(tableName: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName);
  }

  /**
   * Validate column name
   */
  public static validateColumnName(columnName: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(columnName);
  }

  /**
   * Sanitize ORDER BY direction
   */
  public static sanitizeOrderDirection(direction: string): 'ASC' | 'DESC' {
    const upper = direction.toUpperCase();
    return upper === 'DESC' ? 'DESC' : 'ASC';
  }

  /**
   * Validate and sanitize LIMIT value
   */
  public static sanitizeLimit(limit: any): number {
    const num = parseInt(limit, 10);
    if (isNaN(num) || num < 0) {
      throw new Error('Invalid limit value');
    }
    return Math.min(num, 1000); // Cap at 1000 for safety
  }

  /**
   * Validate and sanitize OFFSET value
   */
  public static sanitizeOffset(offset: any): number {
    const num = parseInt(offset, 10);
    if (isNaN(num) || num < 0) {
      throw new Error('Invalid offset value');
    }
    return num;
  }
}