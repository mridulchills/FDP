import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { 
  generateTokenPair, 
  refreshAccessToken, 
  blacklistToken,
  extractTokenFromHeader 
} from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { UserRepository } from '../repositories/user-repository.js';
import { authenticateToken } from '../middleware/auth.js';
import { JwtPayload, LoginRequest, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();
const userRepository = new UserRepository();

/**
 * POST /auth/login
 * Authenticate user and return JWT tokens
 */
router.post('/login', [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { employeeId, password }: LoginRequest = req.body;

    // Find user by employee ID
    const user = await userRepository.findByEmployeeId(employeeId);
    if (!user) {
      logger.warn(`Login attempt with invalid employee ID: ${employeeId}`);
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn(`Login attempt with invalid password for employee: ${employeeId}`);
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Generate JWT tokens
    const payload: JwtPayload = {
      userId: user.id,
      employeeId: user.employeeId,
      role: user.role,
      departmentId: user.departmentId
    };

    const tokens = generateTokenPair(payload);

    logger.info(`User logged in successfully: ${employeeId}`);

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          designation: user.designation,
          institution: user.institution
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
      message: 'Login successful',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { refreshToken } = req.body;

    // Generate new access token
    const newAccessToken = refreshAccessToken(refreshToken);

    logger.info('Access token refreshed successfully');

    const response: ApiResponse = {
      success: true,
      data: {
        accessToken: newAccessToken
      },
      message: 'Token refreshed successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.warn('Token refresh failed:', error);
    
    let statusCode = 401;
    let errorMessage = 'Invalid refresh token';
    
    if (error instanceof Error) {
      if (error.message === 'Token expired') {
        errorMessage = 'Refresh token expired';
      } else if (error.message === 'Token has been revoked') {
        errorMessage = 'Refresh token has been revoked';
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /auth/logout
 * Logout user and blacklist tokens
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = extractTokenFromHeader(authHeader);
    const { refreshToken } = req.body;

    // Blacklist both tokens
    if (accessToken) {
      blacklistToken(accessToken);
    }
    if (refreshToken) {
      blacklistToken(refreshToken);
    }

    logger.info(`User logged out: ${req.user?.employeeId}`);

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await userRepository.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        designation: user.designation,
        institution: user.institution,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /auth/change-password
 * Change user password
 */
router.post('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    // Get current user
    const user = await userRepository.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await userRepository.update(userId, { passwordHash: newPasswordHash });

    logger.info(`Password changed for user: ${user.employeeId}`);

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;