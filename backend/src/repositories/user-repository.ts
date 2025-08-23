import { BaseRepository } from './base-repository.js';
import { User, QueryOptions } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * User repository for managing user data operations
 */
export class UserRepository extends BaseRepository<User> {
  protected tableName = 'users';
  protected primaryKey = 'id';

  /**
   * Map database row to User entity
   */
  protected mapRowToEntity(row: any): User {
    return {
      id: row.id,
      employeeId: row.employee_id,
      name: row.name,
      email: row.email,
      role: row.role as 'faculty' | 'hod' | 'admin',
      departmentId: row.department_id,
      designation: row.designation,
      institution: row.institution,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map User entity to database row
   */
  protected mapEntityToRow(entity: Partial<User>): Record<string, any> {
    const row: Record<string, any> = {};
    
    if (entity.id !== undefined) row['id'] = entity.id;
    if (entity.employeeId !== undefined) row['employee_id'] = entity.employeeId;
    if (entity.name !== undefined) row['name'] = entity.name;
    if (entity.email !== undefined) row['email'] = entity.email;
    if (entity.role !== undefined) row['role'] = entity.role;
    if (entity.departmentId !== undefined) row['department_id'] = entity.departmentId;
    if (entity.designation !== undefined) row['designation'] = entity.designation;
    if (entity.institution !== undefined) row['institution'] = entity.institution;
    if (entity.passwordHash !== undefined) row['password_hash'] = entity.passwordHash;
    if (entity.createdAt !== undefined) row['created_at'] = entity.createdAt.toISOString();
    if (entity.updatedAt !== undefined) row['updated_at'] = entity.updatedAt.toISOString();
    
    return row;
  }

  /**
   * Find user by employee ID
   */
  public async findByEmployeeId(employeeId: string): Promise<User | null> {
    try {
      logger.debug('Finding user by employee ID', { employeeId });
      return await this.findOne({ employee_id: employeeId });
    } catch (error) {
      logger.error('Failed to find user by employee ID', { employeeId, error });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  public async findByEmail(email: string): Promise<User | null> {
    try {
      logger.debug('Finding user by email', { email });
      return await this.findOne({ email });
    } catch (error) {
      logger.error('Failed to find user by email', { email, error });
      throw error;
    }
  }

  /**
   * Find users by department
   */
  public async findByDepartment(departmentId: string, options: QueryOptions = {}): Promise<User[]> {
    try {
      logger.debug('Finding users by department', { departmentId, options });
      
      const filters = { ...options.filters, department_id: departmentId };
      return await this.findAll({ ...options, filters });
    } catch (error) {
      logger.error('Failed to find users by department', { departmentId, options, error });
      throw error;
    }
  }

  /**
   * Find users by role
   */
  public async findByRole(role: 'faculty' | 'hod' | 'admin', options: QueryOptions = {}): Promise<User[]> {
    try {
      logger.debug('Finding users by role', { role, options });
      
      const filters = { ...options.filters, role };
      return await this.findAll({ ...options, filters });
    } catch (error) {
      logger.error('Failed to find users by role', { role, options, error });
      throw error;
    }
  }

  /**
   * Find users with department information
   */
  public async findWithDepartment(options: QueryOptions = {}): Promise<(User & { departmentName?: string; departmentCode?: string })[]> {
    const connection = await this.getConnection();
    
    try {
      const { filters = {}, sortBy, sortOrder = 'asc', page, limit } = options;
      
      // Handle search separately
      const { search, ...otherFilters } = filters;
      
      // Build WHERE clause for users table
      const userFilters: Record<string, any> = {};
      const departmentFilters: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(otherFilters)) {
        if (key.startsWith('department_')) {
          departmentFilters[key.replace('department_', '')] = value;
        } else {
          userFilters[key] = value;
        }
      }
      
      const { clause: userWhereClause, params: userParams } = this.buildWhereClause(userFilters);
      const { clause: deptWhereClause, params: deptParams } = this.buildWhereClause(departmentFilters);
      
      let whereClause = '';
      let allParams: any[] = [];
      
      // Build base WHERE clause
      if (userWhereClause && deptWhereClause) {
        whereClause = `WHERE ${userWhereClause.replace('WHERE ', '')} AND ${deptWhereClause.replace('WHERE ', '')}`;
        allParams = [...userParams, ...deptParams];
      } else if (userWhereClause) {
        whereClause = userWhereClause;
        allParams = userParams;
      } else if (deptWhereClause) {
        whereClause = `WHERE ${deptWhereClause.replace('WHERE ', '')}`;
        allParams = deptParams;
      }
      
      // Add search functionality
      if (search) {
        const searchCondition = `(u.name LIKE ? OR u.email LIKE ? OR u.employee_id LIKE ? OR u.designation LIKE ? OR d.name LIKE ?)`;
        const searchParam = `%${search}%`;
        
        if (whereClause) {
          whereClause += ` AND ${searchCondition}`;
        } else {
          whereClause = `WHERE ${searchCondition}`;
        }
        
        allParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      }
      
      const orderClause = this.buildOrderClause(sortBy, sortOrder);
      const { clause: paginationClause } = this.buildPaginationClause(page, limit);
      
      const sql = `
        SELECT 
          u.*,
          d.name as department_name,
          d.code as department_code
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ${whereClause}
        ${orderClause}
        ${paginationClause}
      `.trim();
      
      logger.debug('Finding users with department info', { 
        options, 
        sql, 
        params: allParams 
      });
      
      const rows = await connection.all(sql, allParams);
      
      return rows.map(row => ({
        ...this.mapRowToEntity(row),
        departmentName: row.department_name,
        departmentCode: row.department_code
      }));
    } catch (error) {
      logger.error('Failed to find users with department info', { options, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Count users with department information and search
   */
  public async countWithDepartment(filters: Record<string, any> = {}): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      // Handle search separately
      const { search, ...otherFilters } = filters;
      
      // Build WHERE clause for users table
      const userFilters: Record<string, any> = {};
      const departmentFilters: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(otherFilters)) {
        if (key.startsWith('department_')) {
          departmentFilters[key.replace('department_', '')] = value;
        } else {
          userFilters[key] = value;
        }
      }
      
      const { clause: userWhereClause, params: userParams } = this.buildWhereClause(userFilters);
      const { clause: deptWhereClause, params: deptParams } = this.buildWhereClause(departmentFilters);
      
      let whereClause = '';
      let allParams: any[] = [];
      
      // Build base WHERE clause
      if (userWhereClause && deptWhereClause) {
        whereClause = `WHERE ${userWhereClause.replace('WHERE ', '')} AND ${deptWhereClause.replace('WHERE ', '')}`;
        allParams = [...userParams, ...deptParams];
      } else if (userWhereClause) {
        whereClause = userWhereClause;
        allParams = userParams;
      } else if (deptWhereClause) {
        whereClause = `WHERE ${deptWhereClause.replace('WHERE ', '')}`;
        allParams = deptParams;
      }
      
      // Add search functionality
      if (search) {
        const searchCondition = `(u.name LIKE ? OR u.email LIKE ? OR u.employee_id LIKE ? OR u.designation LIKE ? OR d.name LIKE ?)`;
        const searchParam = `%${search}%`;
        
        if (whereClause) {
          whereClause += ` AND ${searchCondition}`;
        } else {
          whereClause = `WHERE ${searchCondition}`;
        }
        
        allParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      }
      
      const sql = `
        SELECT COUNT(*) as count
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ${whereClause}
      `.trim();
      
      logger.debug('Counting users with department info', { 
        filters, 
        sql, 
        params: allParams 
      });
      
      const result = await connection.get(sql, allParams);
      return result?.count || 0;
    } catch (error) {
      logger.error('Failed to count users with department info', { filters, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Check if employee ID is already taken
   */
  public async isEmployeeIdTaken(employeeId: string, excludeUserId?: string): Promise<boolean> {
    const connection = await this.getConnection();
    
    try {
      let sql = 'SELECT 1 FROM users WHERE employee_id = ?';
      const params = [employeeId];
      
      if (excludeUserId) {
        sql += ' AND id != ?';
        params.push(excludeUserId);
      }
      
      const result = await connection.get(sql, params);
      return !!result;
    } catch (error) {
      logger.error('Failed to check if employee ID is taken', { employeeId, excludeUserId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Check if email is already taken
   */
  public async isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
    const connection = await this.getConnection();
    
    try {
      let sql = 'SELECT 1 FROM users WHERE email = ?';
      const params = [email];
      
      if (excludeUserId) {
        sql += ' AND id != ?';
        params.push(excludeUserId);
      }
      
      const result = await connection.get(sql, params);
      return !!result;
    } catch (error) {
      logger.error('Failed to check if email is taken', { email, excludeUserId, error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }

  /**
   * Update user password
   */
  public async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    try {
      logger.debug('Updating user password', { userId });
      
      const result = await this.update(userId, { passwordHash } as Partial<User>);
      return !!result;
    } catch (error) {
      logger.error('Failed to update user password', { userId, error });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  public async getStats(): Promise<{
    totalUsers: number;
    usersByRole: Record<string, number>;
    usersByDepartment: Record<string, number>;
  }> {
    const connection = await this.getConnection();
    
    try {
      // Get total users
      const totalResult = await connection.get('SELECT COUNT(*) as count FROM users');
      const totalUsers = totalResult?.count || 0;
      
      // Get users by role
      const roleResults = await connection.all(`
        SELECT role, COUNT(*) as count 
        FROM users 
        GROUP BY role
      `);
      
      const usersByRole: Record<string, number> = {};
      roleResults.forEach(row => {
        usersByRole[row.role] = row.count;
      });
      
      // Get users by department
      const deptResults = await connection.all(`
        SELECT d.name, COUNT(u.id) as count
        FROM departments d
        LEFT JOIN users u ON d.id = u.department_id
        GROUP BY d.id, d.name
      `);
      
      const usersByDepartment: Record<string, number> = {};
      deptResults.forEach(row => {
        usersByDepartment[row.name] = row.count;
      });
      
      return {
        totalUsers,
        usersByRole,
        usersByDepartment
      };
    } catch (error) {
      logger.error('Failed to get user statistics', { error });
      throw error;
    } finally {
      await this.releaseConnection(connection);
    }
  }
}