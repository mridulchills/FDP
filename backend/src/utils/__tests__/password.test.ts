// Mock logger before importing password utilities
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import {
  hashPassword,
  comparePassword,
  validatePassword,
  generateSecurePassword,
  needsRehash,
  sanitizePasswordForLogging,
  PasswordStrength
} from '../password';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for non-string password', async () => {
      await expect(hashPassword(null as any)).rejects.toThrow('Password must be a non-empty string');
      await expect(hashPassword(undefined as any)).rejects.toThrow('Password must be a non-empty string');
      await expect(hashPassword(123 as any)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for password exceeding max length', async () => {
      const longPassword = 'a'.repeat(129);
      await expect(hashPassword(longPassword)).rejects.toThrow('Password must not exceed 128 characters');
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      
      const result = await comparePassword(wrongPassword, hash);
      expect(result).toBe(false);
    });

    it('should return false for empty inputs', async () => {
      const hash = await hashPassword('TestPassword123!');
      
      expect(await comparePassword('', hash)).toBe(false);
      expect(await comparePassword('TestPassword123!', '')).toBe(false);
      expect(await comparePassword('', '')).toBe(false);
    });

    it('should return false for non-string inputs', async () => {
      const hash = await hashPassword('TestPassword123!');
      
      expect(await comparePassword(null as any, hash)).toBe(false);
      expect(await comparePassword('TestPassword123!', null as any)).toBe(false);
      expect(await comparePassword(123 as any, hash)).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const result = await comparePassword('TestPassword123!', 'invalid-hash');
      expect(result).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate a strong password', () => {
      const result = validatePassword('StrongPass123!');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toBe(PasswordStrength.STRONG);
    });

    it('should reject password that is too short', () => {
      const result = validatePassword('Short1!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password that is too long', () => {
      const longPassword = 'A'.repeat(129) + '1!';
      const result = validatePassword(longPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });

    it('should reject password without uppercase letters', () => {
      const result = validatePassword('lowercase123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.suggestions).toContain('Add uppercase letters (A-Z)');
    });

    it('should reject password without lowercase letters', () => {
      const result = validatePassword('UPPERCASE123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
      expect(result.suggestions).toContain('Add lowercase letters (a-z)');
    });

    it('should reject password without numbers', () => {
      const result = validatePassword('NoNumbers!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.suggestions).toContain('Add numbers (0-9)');
    });

    it('should reject password without special characters', () => {
      const result = validatePassword('NoSpecialChars123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should handle null/undefined password', () => {
      expect(validatePassword(null as any).isValid).toBe(false);
      expect(validatePassword(undefined as any).isValid).toBe(false);
      expect(validatePassword('').isValid).toBe(false);
    });

    it('should classify password strength correctly', () => {
      expect(validatePassword('password').strength).toBe(PasswordStrength.WEAK);
      expect([PasswordStrength.FAIR, PasswordStrength.GOOD]).toContain(validatePassword('Password1').strength);
      expect([PasswordStrength.GOOD, PasswordStrength.STRONG]).toContain(validatePassword('Password123!').strength);
      expect(validatePassword('VeryStrongPassword123!@#').strength).toBe(PasswordStrength.STRONG);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = generateSecurePassword();
      
      expect(password).toBeDefined();
      expect(password.length).toBe(16);
    });

    it('should generate password with custom length', () => {
      const password = generateSecurePassword(20);
      
      expect(password).toBeDefined();
      expect(password.length).toBe(20);
    });

    it('should generate password with all character types', () => {
      const password = generateSecurePassword(16);
      
      expect(/[A-Z]/.test(password)).toBe(true); // uppercase
      expect(/[a-z]/.test(password)).toBe(true); // lowercase
      expect(/\d/.test(password)).toBe(true); // numbers
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true); // special chars
    });

    it('should generate different passwords each time', () => {
      const password1 = generateSecurePassword();
      const password2 = generateSecurePassword();
      
      expect(password1).not.toBe(password2);
    });

    it('should generate valid passwords', () => {
      const password = generateSecurePassword();
      const validation = validatePassword(password);
      
      expect(validation.isValid).toBe(true);
      expect([PasswordStrength.GOOD, PasswordStrength.STRONG]).toContain(validation.strength);
    });
  });

  describe('needsRehash', () => {
    it('should return false for recently hashed password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const result = needsRehash(hash);
      expect(result).toBe(false);
    });

    it('should return true for invalid hash', () => {
      const result = needsRehash('invalid-hash');
      expect(result).toBe(true);
    });

    it('should handle empty hash', () => {
      const result = needsRehash('');
      expect(result).toBe(true);
    });
  });

  describe('sanitizePasswordForLogging', () => {
    it('should replace password with asterisks', () => {
      const result = sanitizePasswordForLogging('TestPassword123!');
      expect(result).toBe('********');
    });

    it('should handle short passwords', () => {
      const result = sanitizePasswordForLogging('abc');
      expect(result).toBe('***');
    });

    it('should handle empty password', () => {
      const result = sanitizePasswordForLogging('');
      expect(result).toBe('');
    });

    it('should limit asterisks to 8 characters max', () => {
      const longPassword = 'a'.repeat(20);
      const result = sanitizePasswordForLogging(longPassword);
      expect(result).toBe('********');
      expect(result.length).toBe(8);
    });
  });
});