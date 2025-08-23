import jwt from 'jsonwebtoken';

import { jwtConfig } from '../config/environment.js';
import { JwtPayload } from '../types/index.js';
import { logger } from './logger.js';

// In-memory token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set<string>();

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface DecodedToken extends JwtPayload {
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JwtPayload): string {
  try {
    const tokenPayload = {
      ...payload,
      type: 'access'
    };
    
    return jwt.sign(tokenPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      issuer: 'fdts-api',
      audience: 'fdts-client'
    } as jwt.SignOptions);
  } catch (error) {
    logger.error('Error generating access token:', error);
    throw new Error('Failed to generate access token');
  }
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: JwtPayload): string {
  try {
    const tokenPayload = {
      ...payload,
      type: 'refresh'
    };
    
    return jwt.sign(tokenPayload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn,
      issuer: 'fdts-api',
      audience: 'fdts-client'
    } as jwt.SignOptions);
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JwtPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): DecodedToken {
  try {
    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      throw new Error('Token has been revoked');
    }
    
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: 'fdts-api',
      audience: 'fdts-client'
    }) as DecodedToken;
    
    // Verify token type
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid access token:', error.message);
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Access token expired');
      throw new Error('Token expired');
    }
    logger.error('Error verifying access token:', error);
    throw error;
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): DecodedToken {
  try {
    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      throw new Error('Token has been revoked');
    }
    
    const decoded = jwt.verify(token, jwtConfig.refreshSecret, {
      issuer: 'fdts-api',
      audience: 'fdts-client'
    }) as DecodedToken;
    
    // Verify token type
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid refresh token:', error.message);
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Refresh token expired');
      throw new Error('Token expired');
    }
    logger.error('Error verifying refresh token:', error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export function refreshAccessToken(refreshToken: string): string {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    
    // Create new access token payload (exclude JWT specific fields)
    const payload: JwtPayload = {
      userId: decoded.userId,
      employeeId: decoded.employeeId,
      role: decoded.role,
      departmentId: decoded.departmentId
    };
    
    return generateAccessToken(payload);
  } catch (error) {
    logger.error('Error refreshing access token:', error);
    throw error;
  }
}

/**
 * Add token to blacklist (for logout functionality)
 */
export function blacklistToken(token: string): void {
  try {
    // Extract token without Bearer prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // Decode token to get expiration time (don't verify, just decode)
    const decoded = jwt.decode(cleanToken) as DecodedToken;
    
    if (decoded && decoded.exp) {
      tokenBlacklist.add(cleanToken);
      
      // Schedule cleanup after token expires
      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      if (timeUntilExpiration > 0) {
        setTimeout(() => {
          tokenBlacklist.delete(cleanToken);
          logger.debug('Cleaned up expired token from blacklist');
        }, timeUntilExpiration);
      }
      
      logger.info('Token added to blacklist');
    }
  } catch (error) {
    logger.error('Error blacklisting token:', error);
    // Don't throw error for blacklisting failures
  }
}

/**
 * Check if token is blacklisted
 */
export function isTokenBlacklisted(token: string): boolean {
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
  return tokenBlacklist.has(cleanToken);
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1] || null;
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as DecodedToken;
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    logger.error('Error getting token expiration:', error);
    return null;
  }
}

/**
 * Check if token is about to expire (within 5 minutes)
 */
export function isTokenNearExpiry(token: string, thresholdMinutes: number = 5): boolean {
  try {
    const expiration = getTokenExpiration(token);
    if (!expiration) {
      return true; // Treat invalid tokens as expired
    }
    
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const timeUntilExpiration = expiration.getTime() - Date.now();
    
    return timeUntilExpiration <= thresholdMs;
  } catch (error) {
    logger.error('Error checking token expiry:', error);
    return true; // Treat errors as expired
  }
}

/**
 * Clean up expired tokens from blacklist (manual cleanup)
 */
export function cleanupExpiredTokens(): void {
  const currentTime = Date.now();
  let cleanedCount = 0;
  
  for (const token of Array.from(tokenBlacklist)) {
    try {
      const decoded = jwt.decode(token) as DecodedToken;
      if (decoded && decoded.exp && decoded.exp * 1000 < currentTime) {
        tokenBlacklist.delete(token);
        cleanedCount++;
      }
    } catch (error) {
      // Remove invalid tokens
      tokenBlacklist.delete(token);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} expired tokens from blacklist`);
  }
}

// Schedule periodic cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);