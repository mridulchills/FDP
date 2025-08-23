/**
 * Example usage of password utilities
 * This file demonstrates how to use the password hashing and validation functions
 */

import {
  hashPassword,
  comparePassword,
  validatePassword,
  generateSecurePassword,
  needsRehash,
  sanitizePasswordForLogging,
  // PasswordStrength
} from './password';

async function demonstratePasswordUtilities() {
  console.log('=== Password Utilities Demo ===\n');

  // 1. Generate a secure password
  console.log('1. Generating a secure password:');
  const generatedPassword = generateSecurePassword(16);
  console.log(`Generated password: ${generatedPassword}`);
  console.log(`Sanitized for logging: ${sanitizePasswordForLogging(generatedPassword)}\n`);

  // 2. Validate password strength
  console.log('2. Validating password strength:');
  const validation = validatePassword(generatedPassword);
  console.log(`Is valid: ${validation.isValid}`);
  console.log(`Strength: ${validation.strength}`);
  console.log(`Errors: ${validation.errors.join(', ') || 'None'}`);
  console.log(`Suggestions: ${validation.suggestions.join(', ') || 'None'}\n`);

  // 3. Hash the password
  console.log('3. Hashing the password:');
  const hashedPassword = await hashPassword(generatedPassword);
  console.log(`Hashed password: ${hashedPassword.substring(0, 30)}...\n`);

  // 4. Compare passwords
  console.log('4. Comparing passwords:');
  const isCorrect = await comparePassword(generatedPassword, hashedPassword);
  const isWrong = await comparePassword('wrongpassword', hashedPassword);
  console.log(`Correct password matches: ${isCorrect}`);
  console.log(`Wrong password matches: ${isWrong}\n`);

  // 5. Check if rehashing is needed
  console.log('5. Checking if rehashing is needed:');
  const needsRehashing = needsRehash(hashedPassword);
  console.log(`Needs rehashing: ${needsRehashing}\n`);

  // 6. Test various password strengths
  console.log('6. Testing various password strengths:');
  const testPasswords = [
    'weak',
    'Password1',
    'Password123!',
    'MyVeryStr0ng&SecureP@ssw0rd2024!'
  ];

  testPasswords.forEach(pwd => {
    const result = validatePassword(pwd);
    console.log(`"${pwd}" -> ${result.strength} (valid: ${result.isValid})`);
  });

  console.log('\n=== Demo Complete ===');
}

// Uncomment the line below to run the demo
// demonstratePasswordUtilities().catch(console.error);

export { demonstratePasswordUtilities };