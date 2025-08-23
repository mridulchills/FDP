import { UserRepository } from '../user-repository';
import { User } from '../../types';
import { dbManager } from '../../utils/database';

// Mock the database manager
jest.mock('../../utils/database', () => ({
  dbManager: {
    getConnection: jest.fn(),
    releaseConnection: jest.fn(),
    executeQuery: jest.fn(),
    executeQuerySingle: jest.fn(),
    executeUpdate: jest.fn(),
    initialize: jest.fn()
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockConnection: any;

  const mockUser: User = {
    id: 'user-123',
    employeeId: 'EMP001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'faculty',
    departmentId: 'dept-123',
    designation: 'Assistant Professor',
    institution: 'Test University',
    passwordHash: '$2b$12$hashedpassword',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };

  const mockDbRow = {
    id: 'user-123',
    employee_id: 'EMP001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'faculty',
    department_id: 'dept-123',
    designation: 'Assistant Professor',
    institution: 'Test University',
    password_hash: '$2b$12$hashedpassword',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    userRepository = new UserRepository();
    mockConnection = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };

    (dbManager.getConnection as jest.Mock).mockResolvedValue(mockConnection);
    (dbManager.releaseConnection as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmployeeId', () => {
    it('should find user by employee ID', async () => {
      mockConnection.get.mockResolvedValue(mockDbRow);

      const result = await userRepository.findByEmployeeId('EMP001');

      expect(result).toEqual(mockUser);
      expect(mockConnection.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE employee_id = ?'),
        ['EMP001']
      );
    });

    it('should return null when user not found', async () => {
      mockConnection.get.mockResolvedValue(undefined);

      const result = await userRepository.findByEmployeeId('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockConnection.get.mockRejectedValue(new Error('Database error'));

      await expect(userRepository.findByEmployeeId('EMP001')).rejects.toThrow('Database error');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      mockConnection.get.mockResolvedValue(mockDbRow);

      const result = await userRepository.findByEmail('john.doe@example.com');

      expect(result).toEqual(mockUser);
      expect(mockConnection.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = ?'),
        ['john.doe@example.com']
      );
    });

    it('should return null when user not found', async () => {
      mockConnection.get.mockResolvedValue(undefined);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByDepartment', () => {
    it('should find users by department', async () => {
      mockConnection.all.mockResolvedValue([mockDbRow]);

      const result = await userRepository.findByDepartment('dept-123');

      expect(result).toEqual([mockUser]);
      expect(mockConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE department_id = ?'),
        ['dept-123']
      );
    });

    it('should return empty array when no users found', async () => {
      mockConnection.all.mockResolvedValue([]);

      const result = await userRepository.findByDepartment('nonexistent-dept');

      expect(result).toEqual([]);
    });

    it('should handle query options', async () => {
      mockConnection.all.mockResolvedValue([mockDbRow]);

      const options = {
        sortBy: 'name',
        sortOrder: 'desc' as const,
        page: 1,
        limit: 10
      };

      await userRepository.findByDepartment('dept-123', options);

      expect(mockConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name desc'),
        expect.any(Array)
      );
    });
  });

  describe('findByRole', () => {
    it('should find users by role', async () => {
      mockConnection.all.mockResolvedValue([mockDbRow]);

      const result = await userRepository.findByRole('faculty');

      expect(result).toEqual([mockUser]);
      expect(mockConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = ?'),
        ['faculty']
      );
    });

    it('should handle different roles', async () => {
      mockConnection.all.mockResolvedValue([]);

      await userRepository.findByRole('admin');

      expect(mockConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = ?'),
        ['admin']
      );
    });
  });

  describe('findWithDepartment', () => {
    const mockRowWithDept = {
      ...mockDbRow,
      department_name: 'Computer Science',
      department_code: 'CS'
    };

    it('should find users with department information', async () => {
      mockConnection.all.mockResolvedValue([mockRowWithDept]);

      const result = await userRepository.findWithDepartment();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockUser,
        departmentName: 'Computer Science',
        departmentCode: 'CS'
      });
      expect(mockConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN departments d ON u.department_id = d.id'),
        expect.any(Array)
      );
    });

    it('should handle search functionality', async () => {
      mockConnection.all.mockResolvedValue([mockRowWithDept]);

      const options = {
        filters: { search: 'John' }
      };

      await userRepository.findWithDepartment(options);

      expect(mockConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('(u.name LIKE ? OR u.email LIKE ?'),
        expect.arrayContaining(['%John%', '%John%'])
      );
    });
  });

  describe('countWithDepartment', () => {
    it('should count users with department filters', async () => {
      mockConnection.get.mockResolvedValue({ count: 5 });

      const result = await userRepository.countWithDepartment();

      expect(result).toBe(5);
      expect(mockConnection.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        expect.any(Array)
      );
    });

    it('should handle search in count', async () => {
      mockConnection.get.mockResolvedValue({ count: 2 });

      const filters = { search: 'John' };
      const result = await userRepository.countWithDepartment(filters);

      expect(result).toBe(2);
      expect(mockConnection.get).toHaveBeenCalledWith(
        expect.stringContaining('(u.name LIKE ? OR u.email LIKE ?'),
        expect.arrayContaining(['%John%', '%John%'])
      );
    });
  });

  describe('isEmployeeIdTaken', () => {
    it('should return true when employee ID is taken', async () => {
      mockConnection.get.mockResolvedValue({ '1': 1 });

      const result = await userRepository.isEmployeeIdTaken('EMP001');

      expect(result).toBe(true);
      expect(mockConnection.get).toHaveBeenCalledWith(
        'SELECT 1 FROM users WHERE employee_id = ?',
        ['EMP001']
      );
    });

    it('should return false when employee ID is not taken', async () => {
      mockConnection.get.mockResolvedValue(undefined);

      const result = await userRepository.isEmployeeIdTaken('EMP999');

      expect(result).toBe(false);
    });

    it('should exclude specific user ID when checking', async () => {
      mockConnection.get.mockResolvedValue(undefined);

      await userRepository.isEmployeeIdTaken('EMP001', 'user-123');

      expect(mockConnection.get).toHaveBeenCalledWith(
        'SELECT 1 FROM users WHERE employee_id = ? AND id != ?',
        ['EMP001', 'user-123']
      );
    });
  });

  describe('isEmailTaken', () => {
    it('should return true when email is taken', async () => {
      mockConnection.get.mockResolvedValue({ '1': 1 });

      const result = await userRepository.isEmailTaken('john@example.com');

      expect(result).toBe(true);
    });

    it('should return false when email is not taken', async () => {
      mockConnection.get.mockResolvedValue(undefined);

      const result = await userRepository.isEmailTaken('new@example.com');

      expect(result).toBe(false);
    });
  });

  describe('updatePassword', () => {
    it('should update user password successfully', async () => {
      // Mock the base repository update method
      const updateSpy = jest.spyOn(userRepository, 'update').mockResolvedValue(mockUser);

      const result = await userRepository.updatePassword('user-123', 'newhash');

      expect(result).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith('user-123', { passwordHash: 'newhash' });
    });

    it('should return false when update fails', async () => {
      const updateSpy = jest.spyOn(userRepository, 'update').mockResolvedValue(null);

      const result = await userRepository.updatePassword('user-123', 'newhash');

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return user statistics', async () => {
      mockConnection.get
        .mockResolvedValueOnce({ count: 10 }) // total users
        .mockResolvedValueOnce(undefined); // fallback for undefined result

      mockConnection.all
        .mockResolvedValueOnce([
          { role: 'faculty', count: 7 },
          { role: 'hod', count: 2 },
          { role: 'admin', count: 1 }
        ]) // users by role
        .mockResolvedValueOnce([
          { name: 'Computer Science', count: 5 },
          { name: 'Mathematics', count: 3 },
          { name: 'Physics', count: 2 }
        ]); // users by department

      const stats = await userRepository.getStats();

      expect(stats).toEqual({
        totalUsers: 10,
        usersByRole: {
          faculty: 7,
          hod: 2,
          admin: 1
        },
        usersByDepartment: {
          'Computer Science': 5,
          'Mathematics': 3,
          'Physics': 2
        }
      });
    });

    it('should handle empty statistics', async () => {
      mockConnection.get.mockResolvedValue({ count: 0 });
      mockConnection.all.mockResolvedValue([]);

      const stats = await userRepository.getStats();

      expect(stats).toEqual({
        totalUsers: 0,
        usersByRole: {},
        usersByDepartment: {}
      });
    });
  });

  describe('entity mapping', () => {
    it('should map database row to User entity correctly', () => {
      // Access the protected method through any casting for testing
      const mappedUser = (userRepository as any).mapRowToEntity(mockDbRow);

      expect(mappedUser).toEqual(mockUser);
      expect(mappedUser.createdAt).toBeInstanceOf(Date);
      expect(mappedUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should map User entity to database row correctly', () => {
      const mappedRow = (userRepository as any).mapEntityToRow(mockUser);

      expect(mappedRow).toEqual({
        id: 'user-123',
        employee_id: 'EMP001',
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'faculty',
        department_id: 'dept-123',
        designation: 'Assistant Professor',
        institution: 'Test University',
        password_hash: '$2b$12$hashedpassword',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      });
    });

    it('should handle partial entity mapping', () => {
      const partialUser = {
        name: 'Jane Doe',
        email: 'jane@example.com'
      };

      const mappedRow = (userRepository as any).mapEntityToRow(partialUser);

      expect(mappedRow).toEqual({
        name: 'Jane Doe',
        email: 'jane@example.com'
      });
    });
  });
});