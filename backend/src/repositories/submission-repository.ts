import { BaseRepository } from './base-repository.js';
import { Submission, SubmissionStatus, QueryOptions } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Submission repository for managing submission data operations
 */
export class SubmissionRepository extends BaseRepository<Submission> {
  protected tableName = 'submissions';
  protected primaryKey = 'id';

  /**
   * Map database row to Submission entity
   */
  protected mapRowToEntity(row: any): Submission {
    return {
      id: row.id,
      userId: row.user_id,
      moduleType: row.module_type as 'attended' | 'organized' | 'certification',
      status: row.status as SubmissionStatus,
      formData: JSON.parse(row.form_data),
      documentUrl: row.document_url,
      hodComment: row.hod_comment,
      adminComment: row.admin_comment,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map Submission entity to database row
   */
  protected mapEntityToRow(entity: Partial<Submission>): Record<string, any> {
    const row: Record<string, any> = {};
    
    if (entity.id !== undefined) row['id'] = entity.id;
    if (entity.userId !== undefined) row['user_id'] = entity.userId;
    if (entity.moduleType !== undefined) row['module_type'] = entity.moduleType;
    if (entity.status !== undefined) row['status'] = entity.status;
    if (entity.formData !== undefined) row['form_data'] = JSON.stringify(entity.formData);
    if (entity.documentUrl !== undefined) row['document_url'] = entity.documentUrl;
    if (entity.hodComment !== undefined) row['hod_comment'] = entity.hodComment;
    if (entity.adminComment !== undefined) row['admin_comment'] = entity.adminComment;
    if (entity.createdAt !== undefined) row['created_at'] = entity.createdAt.toISOString();
    if (entity.updatedAt !== undefined) row['updated_at'] = entity.updatedAt.toISOString();
    
    return row;
  }

  /**
   * Find submissions by user ID
   */
  public async findByUserId(userId: string, options: QueryOptions = {}): Promise<Submission[]> {
    try {
      logger.debug('Finding submissions by user ID', { userId, options });
      
      const filters = { ...options.filters, user_id: userId };
      return await this.findAll({ ...options, filters });
    } catch (error) {
      logger.error('Failed to find submissions by user ID', { userId, options, error });
      throw error;
    }
  }

  /**
   * Find submissions by status
   */
  public async findByStatus(status: SubmissionStatus, options: QueryOptions = {}): Promise<Submission[]> {
    try {
      logger.debug('Finding submissions by status', { status, options });
      
      const filters = { ...options.filters, status };
      return await this.findAll({ ...options, filters });
    } catch (error) {
      logger.error('Failed to find submissions by status', { status, options, error });
      throw error;
    }
  }

  /**
   * Find submissions by module type
   */
  public async findByModuleType(moduleType: 'attended' | 'organized' | 'certification', options: QueryOptions = {}): Promise<Submission[]> {
    try {
      logger.debug('Finding submissions by module type', { moduleType, options });
      
      const filters = { ...options.filters, module_type: moduleType };
      return await this.findAll({ ...options, filters });
    } catch (error) {
      logger.error('Failed to find submissions by module type', { moduleType, options, error });
      throw error;
    }
  }

  /**
   * Find submissions by department (through user relationship)
   */
  public async findByDepartment(departmentId: string, options: QueryOptions = {}): Promise<Submission[]> {
    const connection = await this.getConnection();
    
    try {
      const { filters = {}, sortBy, sortOrder = 'asc', page, limit } = options;
      
      // Build WHERE clause for additional filters
      const additionalFilters: Record<string, any> = {};
      for (const [key, value] of Object.entries(filters)) {
        if (key !== 'department_id') {
          additionalFilters[`s.${key}`] = value;
        }
      }
      
      const { clause: whereClause, params: whereParams } = this.buildWhereClause(additionalFilters);
      const baseWhere = 'WHERE u.department_id = ?';
      const fullWhere = whereClause 
        ? `${baseWhere} AND ${whereClause.replace('WHERE ', '')}`
        : baseWhere;
      
      const orderClause = this.buildOrderClause(sortBy ? `s.${sortBy}` : 's.id', sortOrder);
      const { clause: paginationClause } = this.buildPaginationClause(page, limit);
      
      const sql = `
        SELECT s.*
        FROM submissions s
        INNER JOIN users u ON s.user_id = u.id
        ${fullWhere}
        ${orderClause}
        ${paginationClause}
      `.trim();
      
      const params = [departmentId, ...whereParams];
      
      logger.debug('Finding submissions by department', { 
        departmentId, 
        options, 
        sql, 
        params 
      });
      
      const rows = await connection.all(sql, params);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find submissions by department', { departmentId, options, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Find submissions with user information
   */
  public async findWithUserInfo(options: QueryOptions = {}): Promise<(Submission & { 
    userName?: string; 
    userEmail?: string; 
    userEmployeeId?: string;
    departmentName?: string;
  })[]> {
    const connection = await this.getConnection();
    
    try {
      const { filters = {}, sortBy, sortOrder = 'asc', page, limit } = options;
      
      // Build WHERE clause
      const submissionFilters: Record<string, any> = {};
      const userFilters: Record<string, any> = {};
      const departmentFilters: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(filters)) {
        if (key.startsWith('user_')) {
          userFilters[key.replace('user_', '')] = value;
        } else if (key.startsWith('department_')) {
          departmentFilters[key.replace('department_', '')] = value;
        } else {
          submissionFilters[key] = value;
        }
      }
      
      const conditions: string[] = [];
      const params: any[] = [];
      
      if (Object.keys(submissionFilters).length > 0) {
        const { clause, params: subParams } = this.buildWhereClause(submissionFilters);
        if (clause) {
          conditions.push(clause.replace('WHERE ', '').replace(/(\w+)/g, 's.$1'));
          params.push(...subParams);
        }
      }
      
      if (Object.keys(userFilters).length > 0) {
        const { clause, params: userParams } = this.buildWhereClause(userFilters);
        if (clause) {
          conditions.push(clause.replace('WHERE ', '').replace(/(\w+)/g, 'u.$1'));
          params.push(...userParams);
        }
      }
      
      if (Object.keys(departmentFilters).length > 0) {
        const { clause, params: deptParams } = this.buildWhereClause(departmentFilters);
        if (clause) {
          conditions.push(clause.replace('WHERE ', '').replace(/(\w+)/g, 'd.$1'));
          params.push(...deptParams);
        }
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = this.buildOrderClause(sortBy ? `s.${sortBy}` : 's.id', sortOrder);
      const { clause: paginationClause } = this.buildPaginationClause(page, limit);
      
      const sql = `
        SELECT 
          s.*,
          u.name as user_name,
          u.email as user_email,
          u.employee_id as user_employee_id,
          d.name as department_name
        FROM submissions s
        INNER JOIN users u ON s.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        ${whereClause}
        ${orderClause}
        ${paginationClause}
      `.trim();
      
      logger.debug('Finding submissions with user info', { 
        options, 
        sql, 
        params 
      });
      
      const rows = await connection.all(sql, params);
      
      return rows.map(row => ({
        ...this.mapRowToEntity(row),
        userName: row.user_name,
        userEmail: row.user_email,
        userEmployeeId: row.user_employee_id,
        departmentName: row.department_name
      }));
    } catch (error) {
      logger.error('Failed to find submissions with user info', { options, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Update submission status with comment
   */
  public async updateStatus(
    submissionId: string, 
    status: SubmissionStatus, 
    comment?: string,
    commentType: 'hod' | 'admin' = 'hod'
  ): Promise<Submission | null> {
    try {
      logger.debug('Updating submission status', { submissionId, status, comment, commentType });
      
      const updates: Partial<Submission> = { status };
      
      if (comment) {
        if (commentType === 'hod') {
          updates.hodComment = comment;
        } else {
          updates.adminComment = comment;
        }
      }
      
      return await this.update(submissionId, updates);
    } catch (error) {
      logger.error('Failed to update submission status', { submissionId, status, comment, commentType, error });
      throw error;
    }
  }

  /**
   * Get submission statistics
   */
  public async getStats(departmentId?: string): Promise<{
    totalSubmissions: number;
    submissionsByStatus: Record<string, number>;
    submissionsByModule: Record<string, number>;
    submissionsByMonth: Record<string, number>;
  }> {
    const connection = await this.getConnection();
    
    try {
      let baseQuery = '';
      let params: any[] = [];
      
      if (departmentId) {
        baseQuery = `
          FROM submissions s
          INNER JOIN users u ON s.user_id = u.id
          WHERE u.department_id = ?
        `;
        params = [departmentId];
      } else {
        baseQuery = 'FROM submissions s';
      }
      
      // Get total submissions
      const totalResult = await connection.get(`SELECT COUNT(*) as count ${baseQuery}`, params);
      const totalSubmissions = totalResult?.count || 0;
      
      // Get submissions by status
      const statusResults = await connection.all(`
        SELECT s.status, COUNT(*) as count 
        ${baseQuery}
        GROUP BY s.status
      `, params);
      
      const submissionsByStatus: Record<string, number> = {};
      statusResults.forEach(row => {
        submissionsByStatus[row.status] = row.count;
      });
      
      // Get submissions by module type
      const moduleResults = await connection.all(`
        SELECT s.module_type, COUNT(*) as count 
        ${baseQuery}
        GROUP BY s.module_type
      `, params);
      
      const submissionsByModule: Record<string, number> = {};
      moduleResults.forEach(row => {
        submissionsByModule[row.module_type] = row.count;
      });
      
      // Get submissions by month (last 12 months)
      const monthResults = await connection.all(`
        SELECT 
          strftime('%Y-%m', s.created_at) as month,
          COUNT(*) as count
        ${baseQuery}
        AND s.created_at >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', s.created_at)
        ORDER BY month
      `, params);
      
      const submissionsByMonth: Record<string, number> = {};
      monthResults.forEach(row => {
        submissionsByMonth[row.month] = row.count;
      });
      
      return {
        totalSubmissions,
        submissionsByStatus,
        submissionsByModule,
        submissionsByMonth
      };
    } catch (error) {
      logger.error('Failed to get submission statistics', { departmentId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Delete submissions by user ID (for user deletion cascade)
   */
  public async deleteByUserId(userId: string): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      const sql = 'DELETE FROM submissions WHERE user_id = ?';
      
      logger.debug('Deleting submissions by user ID', { userId, sql });
      
      const result = await connection.run(sql, [userId]);
      return result.changes || 0;
    } catch (error) {
      logger.error('Failed to delete submissions by user ID', { userId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }
}