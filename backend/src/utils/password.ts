import bcrypt from 'bcrypt';
import { logger } from './logger';

/**
 * Password strength levels
 */
export enum PasswordStrength {
  WEAK = 'weak',
  FAIR = 'fair',
  GOOD = 'good',
  STRONG = 'strong'
}

/**
 * Password validation result interface
 */
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  errors: string[];
  suggestions: string[];
}

/**
 * Password hashing configuration
 */
const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

/**
 * Password validation rules
 */
const PASSWORD_RULES = {
  minLength: MIN_PASSWORD_LENGTH,
  maxLength: MAX_PASSWORD_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

/**
 * Hash a password using bcrypt
 * @param password - Plain text password to hash
 * @returns Promise<string> - Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    logger.debug('Password hashed successfully');
    return hashedPassword;
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password
 * @param hashedPassword - Hashed password to compare against
 * @returns Promise<boolean> - True if passwords match
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    if (!password || !hashedPassword) {
      return false;
    }

    if (typeof password !== 'string' || typeof hashedPassword !== 'string') {
      return false;
    }

    const isMatch = await bcrypt.compare(password, hashedPassword);
    logger.debug(`Password comparison result: ${isMatch}`);
    return isMatch;
  } catch (error) {
    logger.error('Error comparing password:', error);
    return false;
  }
}

/**
 * Validate password strength and format
 * @param password - Password to validate
 * @returns PasswordValidationResult - Validation result with strength and errors
 */
export function validatePassword(password: string): PasswordValidationResult {
  const result: PasswordValidationResult = {
    isValid: true,
    strength: PasswordStrength.WEAK,
    errors: [],
    suggestions: []
  };

  // Basic validation
  if (!password || typeof password !== 'string') {
    result.isValid = false;
    result.errors.push('Password is required');
    return result;
  }

  // Length validation
  if (password.length < PASSWORD_RULES.minLength) {
    result.isValid = false;
    result.errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
  }

  if (password.length > PASSWORD_RULES.maxLength) {
    result.isValid = false;
    result.errors.push(`Password must not exceed ${PASSWORD_RULES.maxLength} characters`);
  }

  // Character type validation
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = new RegExp(`[${PASSWORD_RULES.specialChars.replace(/[\\^\-\]]/g, '\\$&')}]`).test(password);

  if (PASSWORD_RULES.requireUppercase && !hasUppercase) {
    result.errors.push('Password must contain at least one uppercase letter');
    result.suggestions.push('Add uppercase letters (A-Z)');
  }

  if (PASSWORD_RULES.requireLowercase && !hasLowercase) {
    result.errors.push('Password must contain at least one lowercase letter');
    result.suggestions.push('Add lowercase letters (a-z)');
  }

  if (PASSWORD_RULES.requireNumbers && !hasNumbers) {
    result.errors.push('Password must contain at least one number');
    result.suggestions.push('Add numbers (0-9)');
  }

  if (PASSWORD_RULES.requireSpecialChars && !hasSpecialChars) {
    result.errors.push('Password must contain at least one special character');
    result.suggestions.push(`Add special characters (${PASSWORD_RULES.specialChars})`);
  }

  // Common password patterns to avoid
  const commonPatterns = [
    /(.)\1{2,}/g, // Repeated characters (aaa, 111)
    /123456|654321|qwerty|password|admin|user/i, // Common passwords
    /^[a-zA-Z]+$/, // Only letters
    /^\d+$/, // Only numbers
  ];

  commonPatterns.forEach(pattern => {
    if (pattern.test(password)) {
      result.suggestions.push('Avoid common patterns and dictionary words');
    }
  });

  // Calculate password strength
  result.strength = calculatePasswordStrength(password, hasUppercase, hasLowercase, hasNumbers, hasSpecialChars);

  // Update validity based on errors
  result.isValid = result.errors.length === 0;

  return result;
}

/**
 * Calculate password strength based on various criteria
 * @param password - Password to analyze
 * @param hasUppercase - Whether password contains uppercase letters
 * @param hasLowercase - Whether password contains lowercase letters
 * @param hasNumbers - Whether password contains numbers
 * @param hasSpecialChars - Whether password contains special characters
 * @returns PasswordStrength - Calculated strength level
 */
function calculatePasswordStrength(
  password: string,
  hasUppercase: boolean,
  hasLowercase: boolean,
  hasNumbers: boolean,
  hasSpecialChars: boolean
): PasswordStrength {
  let score = 0;

  // Check for common weak passwords first
  const commonWeakPasswords = /^(password|123456|qwerty|admin|user|letmein|welcome|monkey|dragon)$/i;
  if (commonWeakPasswords.test(password)) {
    return PasswordStrength.WEAK;
  }

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety scoring
  if (hasUppercase) score += 1;
  if (hasLowercase) score += 1;
  if (hasNumbers) score += 1;
  if (hasSpecialChars) score += 1;

  // Entropy scoring (character variety)
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) score += 1;

  // Avoid common patterns
  const hasNoRepeatedChars = !/(.)\1{2,}/.test(password);
  const hasNoSequentialChars = !/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789)/i.test(password);
  
  if (hasNoRepeatedChars) score += 1;
  if (hasNoSequentialChars) score += 1;

  // Determine strength based on score
  if (score >= 8) return PasswordStrength.STRONG;
  if (score >= 6) return PasswordStrength.GOOD;
  if (score >= 4) return PasswordStrength.FAIR;
  return PasswordStrength.WEAK;
}

/**
 * Generate a secure random password
 * @param length - Desired password length (default: 16)
 * @returns string - Generated password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + specialChars;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if a password needs to be rehashed (e.g., if salt rounds have changed)
 * @param hashedPassword - Current hashed password
 * @returns boolean - True if password needs rehashing
 */
export function needsRehash(hashedPassword: string): boolean {
  try {
    const rounds = bcrypt.getRounds(hashedPassword);
    return rounds < SALT_ROUNDS;
  } catch (error) {
    logger.error('Error checking if password needs rehash:', error);
    return true; // If we can't determine, assume it needs rehashing
  }
}

/**
 * Sanitize password for logging (replace with asterisks)
 * @param password - Password to sanitize
 * @returns string - Sanitized password for logging
 */
export function sanitizePasswordForLogging(password: string): string {
  if (!password) return '';
  return '*'.repeat(Math.min(password.length, 8));
}