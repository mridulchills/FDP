import { BaseRepository } from './base-repository.js';
import { Department, QueryOptions } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Department repository for managing department data operations
 */
export class DepartmentRepository extends BaseRepository<Department> {
  protected tableName = 'departments';
  protected primaryKey = 'id';

  /**
   * Map database row to Department entity
   */
  protected mapRowToEntity(row: any): Department {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      hodUserId: row.hod_user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map Department entity to database row
   */
  protected mapEntityToRow(entity: Partial<Department>): Record<string, any> {
    const row: Record<string, any> = {};
    
    if (entity.id !== undefined) row['id'] = entity.id;
    if (entity.name !== undefined) row['name'] = entity.name;
    if (entity.code !== undefined) row['code'] = entity.code;
    if (entity.hodUserId !== undefined) row['hod_user_id'] = entity.hodUserId;
    if (entity.createdAt !== undefined) row['created_at'] = entity.createdAt.toISOString();
    if (entity.updatedAt !== undefined) row['updated_at'] = entity.updatedAt.toISOString();
    
    return row;
  }

  /**
   * Find department by name
   */
  public async findByName(name: string): Promise<Department | null> {
    try {
      logger.debug('Finding department by name', { name });
      return await this.findOne({ name });
    } catch (error) {
      logger.error('Failed to find department by name', { name, error });
      throw error;
    }
  }

  /**
   * Find department by code
   */
  public async findByCode(code: string): Promise<Department | null> {
    try {
      logger.debug('Finding department by code', { code });
      return await this.findOne({ code });
    } catch (error) {
      logger.error('Failed to find department by code', { code, error });
      throw error;
    }
  }

  /**
   * Find department by HOD user ID
   */
  public async findByHodUserId(hodUserId: string): Promise<Department | null> {
    try {
      logger.debug('Finding department by HOD user ID', { hodUserId });
      return await this.findOne({ hod_user_id: hodUserId });
    } catch (error) {
      logger.error('Failed to find department by HOD user ID', { hodUserId, error });
      throw error;
    }
  }

  /**
   * Find departments with HOD information
   */
  public async findWithHodInfo(options: QueryOptions = {}): Promise<(Department & { 
    hodName?: string; 
    hodEmail?: string; 
    hodEmployeeId?: string;
  })[]> {
    const connection = await this.getConnection();
    
    try {
      const { filters = {}, sortBy, sortOrder = 'asc', page, limit } = options;
      
      // Build WHERE clause
      const departmentFilters: Record<string, any> = {};
      const hodFilters: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(filters)) {
        if (key.startsWith('hod_')) {
          hodFilters[key.replace('hod_', '')] = value;
        } else {
          departmentFilters[key] = value;
        }
      }
      
      const conditions: string[] = [];
      const params: any[] = [];
      
      if (Object.keys(departmentFilters).length > 0) {
        const { clause, params: deptParams } = this.buildWhereClause(departmentFilters);
        if (clause) {
          conditions.push(clause.replace('WHERE ', '').replace(/(\w+)/g, 'd.$1'));
          params.push(...deptParams);
        }
      }
      
      if (Object.keys(hodFilters).length > 0) {
        const { clause, params: hodParams } = this.buildWhereClause(hodFilters);
        if (clause) {
          conditions.push(clause.replace('WHERE ', '').replace(/(\w+)/g, 'u.$1'));
          params.push(...hodParams);
        }
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = this.buildOrderClause(sortBy ? `d.${sortBy}` : 'd.id', sortOrder);
      const { clause: paginationClause } = this.buildPaginationClause(page, limit);
      
      const sql = `
        SELECT 
          d.*,
          u.name as hod_name,
          u.email as hod_email,
          u.employee_id as hod_employee_id
        FROM departments d
        LEFT JOIN users u ON d.hod_user_id = u.id
        ${whereClause}
        ${orderClause}
        ${paginationClause}
      `.trim();
      
      logger.debug('Finding departments with HOD info', { 
        options, 
        sql, 
        params 
      });
      
      const rows = await connection.all(sql, params);
      
      return rows.map(row => ({
        ...this.mapRowToEntity(row),
        hodName: row.hod_name,
        hodEmail: row.hod_email,
        hodEmployeeId: row.hod_employee_id
      }));
    } catch (error) {
      logger.error('Failed to find departments with HOD info', { options, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Find departments with user count
   */
  public async findWithUserCount(options: QueryOptions = {}): Promise<(Department & { userCount: number })[]> {
    const connection = await this.getConnection();
    
    try {
      const { filters = {}, sortBy, sortOrder = 'asc', page, limit } = options;
      
      const { clause: whereClause, params } = this.buildWhereClause(filters);
      const departmentWhere = whereClause.replace(/(\w+)/g, 'd.$1');
      
      const orderClause = this.buildOrderClause(sortBy ? `d.${sortBy}` : 'd.id', sortOrder);
      const { clause: paginationClause } = this.buildPaginationClause(page, limit);
      
      const sql = `
        SELECT 
          d.*,
          COUNT(u.id) as user_count
        FROM departments d
        LEFT JOIN users u ON d.id = u.department_id
        ${departmentWhere}
        GROUP BY d.id, d.name, d.code, d.hod_user_id, d.created_at, d.updated_at
        ${orderClause}
        ${paginationClause}
      `.trim();
      
      logger.debug('Finding departments with user count', { 
        options, 
        sql, 
        params 
      });
      
      const rows = await connection.all(sql, params);
      
      return rows.map(row => ({
        ...this.mapRowToEntity(row),
        userCount: row.user_count || 0
      }));
    } catch (error) {
      logger.error('Failed to find departments with user count', { options, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Check if department name is already taken
   */
  public async isNameTaken(name: string, excludeDepartmentId?: string): Promise<boolean> {
    const connection = await this.getConnection();
    
    try {
      let sql = 'SELECT 1 FROM departments WHERE name = ?';
      const params = [name];
      
      if (excludeDepartmentId) {
        sql += ' AND id != ?';
        params.push(excludeDepartmentId);
      }
      
      const result = await connection.get(sql, params);
      return !!result;
    } catch (error) {
      logger.error('Failed to check if department name is taken', { name, excludeDepartmentId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Check if department code is already taken
   */
  public async isCodeTaken(code: string, excludeDepartmentId?: string): Promise<boolean> {
    const connection = await this.getConnection();
    
    try {
      let sql = 'SELECT 1 FROM departments WHERE code = ?';
      const params = [code];
      
      if (excludeDepartmentId) {
        sql += ' AND id != ?';
        params.push(excludeDepartmentId);
      }
      
      const result = await connection.get(sql, params);
      return !!result;
    } catch (error) {
      logger.error('Failed to check if department code is taken', { code, excludeDepartmentId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Update department HOD
   */
  public async updateHod(departmentId: string, hodUserId: string | null): Promise<Department | null> {
    try {
      logger.debug('Updating department HOD', { departmentId, hodUserId });
      
      return await this.update(departmentId, { hodUserId } as Partial<Department>);
    } catch (error) {
      logger.error('Failed to update department HOD', { departmentId, hodUserId, error });
      throw error;
    }
  }

  /**
   * Get department statistics
   */
  public async getStats(): Promise<{
    totalDepartments: number;
    departmentsWithHod: number;
    departmentsWithoutHod: number;
    averageUsersPerDepartment: number;
  }> {
    const connection = await this.getConnection();
    
    try {
      // Get total departments
      const totalResult = await connection.get('SELECT COUNT(*) as count FROM departments');
      const totalDepartments = totalResult?.count || 0;
      
      // Get departments with HOD
      const hodResult = await connection.get('SELECT COUNT(*) as count FROM departments WHERE hod_user_id IS NOT NULL');
      const departmentsWithHod = hodResult?.count || 0;
      
      const departmentsWithoutHod = totalDepartments - departmentsWithHod;
      
      // Get average users per department
      const avgResult = await connection.get(`
        SELECT AVG(user_count) as avg_users
        FROM (
          SELECT COUNT(u.id) as user_count
          FROM departments d
          LEFT JOIN users u ON d.id = u.department_id
          GROUP BY d.id
        )
      `);
      
      const averageUsersPerDepartment = Math.round(avgResult?.avg_users || 0);
      
      return {
        totalDepartments,
        departmentsWithHod,
        departmentsWithoutHod,
        averageUsersPerDepartment
      };
    } catch (error) {
      logger.error('Failed to get department statistics', { error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Delete department and handle user references
   */
  public async deleteWithUserHandling(departmentId: string, newDepartmentId?: string): Promise<boolean> {
    return await this.executeTransaction(async (connection) => {
      try {
        // If a new department is provided, update users to the new department
        if (newDepartmentId) {
          await connection.run(
            'UPDATE users SET department_id = ? WHERE department_id = ?',
            [newDepartmentId, departmentId]
          );
          logger.debug('Updated users to new department', { departmentId, newDepartmentId });
        } else {
          // Otherwise, set department_id to NULL for affected users
          await connection.run(
            'UPDATE users SET department_id = NULL WHERE department_id = ?',
            [departmentId]
          );
          logger.debug('Set users department_id to NULL', { departmentId });
        }
        
        // Delete the department
        const result = await connection.run('DELETE FROM departments WHERE id = ?', [departmentId]);
        
        logger.debug('Deleted department', { departmentId, changes: result.changes });
        return (result.changes || 0) > 0;
      } catch (error) {
        logger.error('Failed to delete department with user handling', { departmentId, newDepartmentId, error });
        throw error;
      }
    });
  }
}