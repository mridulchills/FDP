import request from 'supertest';
import express from 'express';
import authRoutes from '../auth';
import { UserRepository } from '../../repositories/user-repository';
import * as jwt from '../../utils/jwt';
import * as password from '../../utils/password';

// Mock dependencies
jest.mock('../../repositories/user-repository');
jest.mock('../../utils/jwt');
jest.mock('../../utils/password');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      userId: 'user-123',
      employeeId: 'EMP001',
      role: 'faculty'
    };
    next();
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Auth Routes', () => {
  let app: express.Application;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-123',
    employeeId: 'EMP001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'faculty' as const,
    departmentId: 'dept-123',
    designation: 'Assistant Professor',
    institution: 'Test University',
    passwordHash: '$2b$12$hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);

    // Reset mocks
    jest.clearAllMocks();

    // Setup UserRepository mock
    mockUserRepository = {
      findByEmployeeId: jest.fn(),
      updatePassword: jest.fn()
    } as any;

    (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        employeeId: 'EMP001',
        password: 'TestPassword123!'
      };

      const tokenPair = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      (password.comparePassword as jest.Mock).mockResolvedValue(true);
      (jwt.generateTokenPair as jest.Mock).mockReturnValue(tokenPair);

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            employeeId: mockUser.employeeId,
            name: mockUser.name,
            email: mockUser.email,
            role: mockUser.role,
            departmentId: mockUser.departmentId,
            designation: mockUser.designation,
            institution: mockUser.institution
          },
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        },
        message: 'Login successful',
        timestamp: expect.any(String)
      });

      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledWith('EMP001');
      expect(password.comparePassword).toHaveBeenCalledWith('TestPassword123!', mockUser.passwordHash);
      expect(jwt.generateTokenPair).toHaveBeenCalledWith({
        userId: mockUser.id,
        employeeId: mockUser.employeeId,
        role: mockUser.role,
        departmentId: mockUser.departmentId
      });
    });

    it('should reject login with invalid employee ID', async () => {
      const loginData = {
        employeeId: 'INVALID',
        password: 'TestPassword123!'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials',
        timestamp: expect.any(String)
      });

      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledWith('INVALID');
      expect(password.comparePassword).not.toHaveBeenCalled();
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        employeeId: 'EMP001',
        password: 'WrongPassword'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      (password.comparePassword as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials',
        timestamp: expect.any(String)
      });

      expect(password.comparePassword).toHaveBeenCalledWith('WrongPassword', mockUser.passwordHash);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            msg: 'Employee ID is required',
            path: 'employeeId'
          }),
          expect.objectContaining({
            msg: 'Password is required',
            path: 'password'
          })
        ]),
        timestamp: expect.any(String)
      });
    });

    it('should handle database errors gracefully', async () => {
      const loginData = {
        employeeId: 'EMP001',
        password: 'TestPassword123!'
      };

      mockUserRepository.findByEmployeeId.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error',
        timestamp: expect.any(String)
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token successfully', async () => {
      const refreshData = {
        refreshToken: 'valid-refresh-token'
      };

      const newAccessToken = 'new-access-token';
      (jwt.refreshAccessToken as jest.Mock).mockReturnValue(newAccessToken);

      const response = await request(app)
        .post('/auth/refresh')
        .send(refreshData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          accessToken: newAccessToken
        },
        message: 'Token refreshed successfully',
        timestamp: expect.any(String)
      });

      expect(jwt.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should reject invalid refresh token', async () => {
      const refreshData = {
        refreshToken: 'invalid-refresh-token'
      };

      (jwt.refreshAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send(refreshData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid refresh token',
        timestamp: expect.any(String)
      });
    });

    it('should validate required refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            msg: 'Refresh token is required',
            path: 'refreshToken'
          })
        ]),
        timestamp: expect.any(String)
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      (jwt.extractTokenFromHeader as jest.Mock).mockReturnValue('access-token');

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer access-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully',
        timestamp: expect.any(String)
      });

      expect(jwt.blacklistToken).toHaveBeenCalledWith('access-token');
    });

    it('should handle logout without token', async () => {
      (jwt.extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully',
        timestamp: expect.any(String)
      });
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      (password.comparePassword as jest.Mock).mockResolvedValue(true);
      (password.hashPassword as jest.Mock).mockResolvedValue('new-hashed-password');
      mockUserRepository.updatePassword.mockResolvedValue(true);

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer access-token')
        .send(passwordData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password changed successfully',
        timestamp: expect.any(String)
      });

      expect(password.comparePassword).toHaveBeenCalledWith('OldPassword123!', mockUser.passwordHash);
      expect(password.hashPassword).toHaveBeenCalledWith('NewPassword123!');
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith('user-123', 'new-hashed-password');
    });

    it('should reject incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword123!'
      };

      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);
      (password.comparePassword as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer access-token')
        .send(passwordData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Current password is incorrect',
        timestamp: expect.any(String)
      });
    });

    it('should validate password requirements', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'weak'
      };

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer access-token')
        .send(passwordData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should require authentication', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };

      // Mock authentication middleware to not set user
      const authApp = express();
      authApp.use(express.json());
      authApp.use('/auth', authRoutes);

      const response = await request(authApp)
        .post('/auth/change-password')
        .send(passwordData)
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile', async () => {
      mockUserRepository.findByEmployeeId.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer access-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: mockUser.id,
          employeeId: mockUser.employeeId,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          departmentId: mockUser.departmentId,
          designation: mockUser.designation,
          institution: mockUser.institution
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle user not found', async () => {
      mockUserRepository.findByEmployeeId.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer access-token')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'User not found',
        timestamp: expect.any(String)
      });
    });
  });
});