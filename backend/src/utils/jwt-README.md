# JWT Token Management

This module provides comprehensive JWT (JSON Web Token) management for the Faculty Development Tracking System backend.

## Features

- **Access Token Generation**: Short-lived tokens for API authentication
- **Refresh Token Generation**: Long-lived tokens for obtaining new access tokens
- **Token Verification**: Secure validation of tokens with proper error handling
- **Token Blacklisting**: Logout functionality with token revocation
- **Token Refresh**: Seamless token renewal without re-authentication
- **Security Headers**: Proper JWT claims (issuer, audience, expiration)
- **Error Handling**: Comprehensive error handling for various token scenarios

## Configuration

JWT configuration is managed through environment variables:

```env
JWT_SECRET=your-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret-key-at-least-32-characters-long
JWT_REFRESH_EXPIRES_IN=7d
```

## Core Functions

### Token Generation

```typescript
import { generateAccessToken, generateRefreshToken, generateTokenPair } from './jwt.js';

const payload: JwtPayload = {
  userId: 'user-123',
  employeeId: 'EMP001',
  role: 'faculty',
  departmentId: 'dept-456'
};

// Generate individual tokens
const accessToken = generateAccessToken(payload);
const refreshToken = generateRefreshToken(payload);

// Generate both tokens at once
const { accessToken, refreshToken } = generateTokenPair(payload);
```

### Token Verification

```typescript
import { verifyAccessToken, verifyRefreshToken } from './jwt.js';

try {
  const decoded = verifyAccessToken(token);
  console.log('User:', decoded.userId, decoded.role);
} catch (error) {
  console.error('Token verification failed:', error.message);
}
```

### Token Refresh

```typescript
import { refreshAccessToken } from './jwt.js';

try {
  const newAccessToken = refreshAccessToken(refreshToken);
  // Use new access token for subsequent requests
} catch (error) {
  // Refresh token is invalid or expired, require re-login
}
```

### Token Blacklisting (Logout)

```typescript
import { blacklistToken, isTokenBlacklisted } from './jwt.js';

// Blacklist token on logout
blacklistToken(accessToken);
blacklistToken(refreshToken);

// Check if token is blacklisted
if (isTokenBlacklisted(token)) {
  throw new Error('Token has been revoked');
}
```

## Authentication Middleware

The module includes comprehensive Express middleware for authentication and authorization:

### Basic Authentication

```typescript
import { authenticateToken } from '../middleware/auth.js';

// Require valid JWT token
router.get('/protected', authenticateToken, (req, res) => {
  // req.user contains decoded token payload
  res.json({ user: req.user });
});
```

### Role-Based Authorization

```typescript
import { requireRole, requireAdmin, requireHoDOrAdmin } from '../middleware/auth.js';

// Require specific roles
router.get('/admin-only', requireAdmin, handler);
router.get('/hod-or-admin', requireHoDOrAdmin, handler);
router.get('/faculty-or-admin', requireRole('faculty', 'admin'), handler);
```

### Department-Based Authorization

```typescript
import { requireDepartmentAccess } from '../middleware/auth.js';

// Allow access based on department membership
router.get('/department/:departmentId/data', requireDepartmentAccess, handler);
```

### Self-Access Authorization

```typescript
import { requireSelfOrAdmin } from '../middleware/auth.js';

// Users can only access their own data (or admin can access any)
router.get('/users/:userId/profile', requireSelfOrAdmin, handler);
```

### Optional Authentication

```typescript
import { optionalAuth } from '../middleware/auth.js';

// Add user context if token is present, but don't require it
router.get('/public-with-context', optionalAuth, (req, res) => {
  if (req.user) {
    // User is authenticated
  } else {
    // Anonymous access
  }
});
```

## Token Structure

### Access Token Payload

```typescript
{
  userId: string;
  employeeId: string;
  role: 'faculty' | 'hod' | 'admin';
  departmentId: string;
  type: 'access';
  iat: number;  // Issued at
  exp: number;  // Expires at
  iss: 'fdts-api';     // Issuer
  aud: 'fdts-client';  // Audience
}
```

### Refresh Token Payload

```typescript
{
  userId: string;
  employeeId: string;
  role: 'faculty' | 'hod' | 'admin';
  departmentId: string;
  type: 'refresh';
  iat: number;
  exp: number;
  iss: 'fdts-api';
  aud: 'fdts-client';
}
```

## Security Features

### Token Blacklisting

- Tokens are blacklisted on logout to prevent reuse
- Automatic cleanup of expired tokens from blacklist
- Memory-efficient storage with automatic expiration

### Error Handling

- Distinguishes between invalid, expired, and revoked tokens
- Proper HTTP status codes for different error scenarios
- Comprehensive logging for security monitoring

### Token Validation

- Verifies token signature using secret keys
- Validates issuer and audience claims
- Checks token type (access vs refresh)
- Ensures tokens haven't been blacklisted

## Usage in Routes

### Authentication Routes

```typescript
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);
```

Available endpoints:
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Protected Routes

```typescript
import { authenticateToken, requireRole } from './middleware/auth.js';

// Protect all routes in this router
router.use(authenticateToken);

// Specific role requirements
router.get('/admin/users', requireRole('admin'), getUsersHandler);
router.get('/hod/submissions', requireRole('hod', 'admin'), getSubmissionsHandler);
```

## Error Responses

The middleware returns consistent error responses:

```typescript
// 401 Unauthorized
{
  success: false,
  error: "Access token required" | "Invalid token" | "Token expired" | "Token has been revoked",
  timestamp: "2023-12-07T10:30:00.000Z"
}

// 403 Forbidden
{
  success: false,
  error: "Insufficient permissions",
  timestamp: "2023-12-07T10:30:00.000Z"
}
```

## Testing

Run the JWT integration test:

```bash
npx tsx src/scripts/test-jwt.ts
```

Run unit tests:

```bash
npm test jwt.test.ts
npm test auth.test.ts
```

## Best Practices

1. **Token Expiration**: Keep access tokens short-lived (1-24 hours)
2. **Refresh Tokens**: Use longer-lived refresh tokens (7 days) for better UX
3. **Secure Storage**: Store refresh tokens securely on the client
4. **Token Rotation**: Consider rotating refresh tokens on each use
5. **Blacklisting**: Always blacklist tokens on logout
6. **Error Handling**: Provide clear error messages without exposing sensitive information
7. **Logging**: Log authentication events for security monitoring

## Production Considerations

1. **Redis Integration**: Replace in-memory blacklist with Redis for scalability
2. **Token Rotation**: Implement refresh token rotation for enhanced security
3. **Rate Limiting**: Add rate limiting to authentication endpoints
4. **Monitoring**: Set up alerts for suspicious authentication patterns
5. **Key Rotation**: Implement JWT secret key rotation procedures