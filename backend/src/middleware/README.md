# Middleware Stack Documentation

This document describes the comprehensive middleware stack implemented for the Express server.

## Overview

The middleware stack provides security, validation, logging, and error handling capabilities for the API server. All middleware is organized into separate modules for maintainability and testability.

## Middleware Components

### 1. Security Middleware (`security.ts`)

**Security Headers**
- Uses Helmet.js for comprehensive security headers
- Content Security Policy (CSP) configuration
- HSTS (HTTP Strict Transport Security)
- Cross-origin policies

**Rate Limiting**
- General rate limiting: 100 requests per 15 minutes per IP
- Auth rate limiting: 10 requests per 15 minutes per IP
- Upload rate limiting: 20 uploads per hour per IP
- Custom error responses with proper logging

**Request Size Limiting**
- Maximum request size: 10MB
- Prevents DoS attacks via large payloads

**Suspicious Activity Detection**
- Detects common attack patterns (XSS, SQL injection, directory traversal)
- Identifies suspicious user agents (security scanners)
- Logs and blocks suspicious requests

**IP Whitelisting**
- Optional IP whitelist functionality for admin endpoints
- Configurable allowed IP addresses

### 2. Validation Middleware (`validation.ts`)

**Input Validation**
- Uses express-validator for comprehensive validation
- Pre-defined validation rules for common fields:
  - Employee ID, password, email, name
  - Role, department ID, designation, institution
  - Status, module type, comments
- Structured error responses with field-specific messages

**Input Sanitization**
- Removes potentially dangerous content (script tags, event handlers)
- Sanitizes all string values in request bodies
- Preserves data structure while cleaning content

**Validation Chain Builder**
- Helper function to create validation chains
- Combines multiple validation rules with error handling

### 3. Error Handling Middleware (`error-handler.ts`)

**Custom Error Class (AppError)**
- Structured error handling with status codes
- Operational vs programming error distinction
- Error codes for client-side handling

**Specialized Error Handlers**
- Database error handling (SQLite constraints)
- JWT error handling (expired, invalid tokens)
- Validation error formatting

**Environment-Aware Error Responses**
- Detailed errors in development
- Sanitized errors in production
- Comprehensive logging for all errors

**Global Error Handler**
- Catches all unhandled errors
- Converts unknown errors to AppError instances
- Proper HTTP status code mapping

### 4. Request Logging Middleware (`request-logger.ts`)

**Request Logging**
- Comprehensive request information logging
- Response time tracking
- Environment-aware detail levels
- Sensitive data sanitization

**Response Logging**
- Automatic response logging via JSON override
- Performance metrics (response time)
- Error response highlighting

**Sensitive Data Protection**
- Automatically redacts passwords, tokens, secrets
- Configurable sensitive field detection
- Safe logging for debugging

## Middleware Stack Order

The middleware is applied in the following order (critical for proper functionality):

1. **Global Error Handlers** - Process-level error handling
2. **Trust Proxy** - For accurate IP addresses behind proxies
3. **Security Headers** - Helmet security headers
4. **CORS** - Cross-origin resource sharing
5. **Request Size Limiting** - Prevent large payload attacks
6. **Suspicious Activity Detection** - Block malicious requests
7. **Rate Limiting** - General rate limiting
8. **Body Parsing** - JSON and URL-encoded parsing with validation
9. **Input Sanitization** - Clean user input
10. **Request Logging** - Log incoming requests
11. **Route Handlers** - Application routes
12. **Error Logging** - Log errors before handling
13. **404 Handler** - Handle unmatched routes
14. **Global Error Handler** - Final error processing

## Usage Examples

### Using Validation Middleware

```typescript
import { validationRules, createValidationChain } from '../middleware/validation.js';

// Create validation chain for user creation
const validateUserCreation = createValidationChain(
  validationRules.employeeId(),
  validationRules.password(),
  validationRules.email(),
  validationRules.name(),
  validationRules.role()
);

// Use in route
router.post('/users', validateUserCreation, async (req, res) => {
  // Request is validated and sanitized
});
```

### Using Custom Errors

```typescript
import { AppError } from '../middleware/error-handler.js';

// Throw custom error
throw new AppError('User not found', 404, 'USER_NOT_FOUND');

// Error will be caught by global error handler
```

### Using Rate Limiting

```typescript
import { authRateLimit, uploadRateLimit } from '../middleware/security.js';

// Apply auth rate limiting
router.post('/auth/login', authRateLimit, loginHandler);

// Apply upload rate limiting
router.post('/files/upload', uploadRateLimit, uploadHandler);
```

## Configuration

### Environment Variables

The middleware stack respects the following environment variables:

- `NODE_ENV` - Controls error detail levels and logging
- `CORS_ORIGIN` - Configures CORS allowed origins
- `PORT` - Server port (affects health check responses)

### Rate Limiting Configuration

Rate limits can be adjusted by modifying the middleware configuration:

```typescript
// Adjust rate limits in security.ts
const customRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // Time window
  max: 50, // Request limit
  message: 'Custom rate limit message'
});
```

## Testing

The middleware stack includes comprehensive tests:

- `test-middleware-stack.ts` - Tests all middleware components
- `test-server-startup.ts` - Tests server integration
- Individual middleware function tests

Run tests with:
```bash
npx tsx src/scripts/test-middleware-stack.ts
```

## Security Features

### Implemented Security Measures

1. **Headers Security** - Comprehensive security headers via Helmet
2. **Rate Limiting** - Multiple tiers of rate limiting
3. **Input Validation** - Strict validation of all user input
4. **Input Sanitization** - XSS and injection prevention
5. **Request Size Limits** - DoS prevention
6. **Suspicious Activity Detection** - Attack pattern recognition
7. **Error Information Leakage Prevention** - Safe error responses
8. **Comprehensive Logging** - Security event tracking

### Security Best Practices

- All user input is validated and sanitized
- Errors don't leak sensitive information in production
- Rate limiting prevents abuse
- Security headers protect against common attacks
- Comprehensive logging enables security monitoring

## Performance Considerations

- Middleware is optimized for minimal overhead
- Rate limiting uses efficient in-memory storage
- Logging is asynchronous where possible
- Validation rules are pre-compiled
- Error handling is optimized for common cases

## Monitoring and Debugging

The middleware stack provides extensive logging for:

- Request/response cycles
- Security events (rate limiting, suspicious activity)
- Validation failures
- Error occurrences
- Performance metrics

All logs include timestamps, IP addresses, and relevant context for debugging and security monitoring.