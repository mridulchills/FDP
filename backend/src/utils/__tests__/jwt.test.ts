// Mock the environment config
jest.mock('../../config/environment.js', () => ({
  jwtConfig: {
    secret: 'test-secret-key',
    refreshSecret: 'test-refresh-secret-key',
    expiresIn: '15m',
    refreshExpiresIn: '7d'
  }
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  blacklistToken,
  isTokenBlacklisted,
  extractTokenFromHeader,
  getTokenExpiration,
  isTokenNearExpiry,
  cleanupExpiredTokens
} from '../jwt';
import { JwtPayload } from '../../types';

describe('JWT Utilities', () => {
  const mockPayload: JwtPayload = {
    userId: 'user-123',
    employeeId: 'EMP001',
    role: 'faculty',
    departmentId: 'dept-123'
  };

  beforeEach(() => {
    // Clear any blacklisted tokens before each test
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload data in token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.employeeId).toBe(mockPayload.employeeId);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.departmentId).toBe(mockPayload.departmentId);
      expect(decoded.type).toBe('access');
    });

    it('should generate different tokens for same payload', () => {
      const token1 = generateAccessToken(mockPayload);
      const token2 = generateAccessToken(mockPayload);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include payload data in refresh token', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.employeeId).toBe(mockPayload.employeeId);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.departmentId).toBe(mockPayload.departmentId);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokenPair = generateTokenPair(mockPayload);
      
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
    });

    it('should generate valid token pair', () => {
      const tokenPair = generateTokenPair(mockPayload);
      
      const accessDecoded = verifyAccessToken(tokenPair.accessToken);
      const refreshDecoded = verifyRefreshToken(tokenPair.refreshToken);
      
      expect(accessDecoded.type).toBe('access');
      expect(refreshDecoded.type).toBe('refresh');
      expect(accessDecoded.userId).toBe(refreshDecoded.userId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.type).toBe('access');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw error for refresh token used as access token', () => {
      const refreshToken = generateRefreshToken(mockPayload);
      expect(() => verifyAccessToken(refreshToken)).toThrow('Invalid token type');
    });

    it('should throw error for blacklisted token', () => {
      const token = generateAccessToken(mockPayload);
      blacklistToken(token);
      
      expect(() => verifyAccessToken(token)).toThrow('Token has been revoked');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw error for access token used as refresh token', () => {
      const accessToken = generateAccessToken(mockPayload);
      expect(() => verifyRefreshToken(accessToken)).toThrow('Invalid token type');
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from valid refresh token', () => {
      const refreshToken = generateRefreshToken(mockPayload);
      const newAccessToken = refreshAccessToken(refreshToken);
      
      expect(newAccessToken).toBeDefined();
      expect(typeof newAccessToken).toBe('string');
      
      const decoded = verifyAccessToken(newAccessToken);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.type).toBe('access');
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => refreshAccessToken('invalid-token')).toThrow();
    });

    it('should throw error for blacklisted refresh token', () => {
      const refreshToken = generateRefreshToken(mockPayload);
      blacklistToken(refreshToken);
      
      expect(() => refreshAccessToken(refreshToken)).toThrow('Token has been revoked');
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist a token', () => {
      const token = generateAccessToken(mockPayload);
      
      expect(isTokenBlacklisted(token)).toBe(false);
      blacklistToken(token);
      expect(isTokenBlacklisted(token)).toBe(true);
    });

    it('should handle Bearer prefix', () => {
      const token = generateAccessToken(mockPayload);
      const bearerToken = `Bearer ${token}`;
      
      blacklistToken(bearerToken);
      expect(isTokenBlacklisted(token)).toBe(true);
    });

    it('should handle invalid tokens gracefully', () => {
      expect(() => blacklistToken('invalid-token')).not.toThrow();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'sample-token';
      const header = `Bearer ${token}`;
      
      const extracted = extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(extractTokenFromHeader('InvalidFormat token')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('Bearer ')).toBeNull();
    });

    it('should return null for undefined header', () => {
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    it('should return null for empty header', () => {
      expect(extractTokenFromHeader('')).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      const token = generateAccessToken(mockPayload);
      const expiration = getTokenExpiration(token);
      
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      const expiration = getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });
  });

  describe('isTokenNearExpiry', () => {
    it('should return false for fresh token', () => {
      const token = generateAccessToken(mockPayload);
      const isNearExpiry = isTokenNearExpiry(token, 5);
      
      expect(isNearExpiry).toBe(false);
    });

    it('should return true for invalid token', () => {
      const isNearExpiry = isTokenNearExpiry('invalid-token');
      expect(isNearExpiry).toBe(true);
    });

    it('should use default threshold of 5 minutes', () => {
      const token = generateAccessToken(mockPayload);
      const isNearExpiry = isTokenNearExpiry(token);
      
      expect(typeof isNearExpiry).toBe('boolean');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should not throw error when called', () => {
      expect(() => cleanupExpiredTokens()).not.toThrow();
    });
  });
});