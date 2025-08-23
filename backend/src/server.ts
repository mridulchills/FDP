import express from 'express';
import cors from 'cors';
import { config } from './config/environment.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import submissionRoutes from './routes/submissions.js';
import departmentRoutes from './routes/departments.js';
import notificationRoutes from './routes/notifications.js';
import auditLogRoutes from './routes/audit-logs.js';
import fileRoutes from './routes/files.js';
import performanceRoutes from './routes/performance.js';

// Import middleware
import {
  securityHeaders,
  generalRateLimit,
  authRateLimit,
  requestSizeLimit,
  suspiciousActivityDetection
} from './middleware/security.js';
import { requestLogger, errorLogger } from './middleware/request-logger.js';
import { sanitizeInput } from './middleware/validation.js';
import { responseMiddleware } from './utils/response.js';
import {
  globalErrorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException
} from './middleware/error-handler.js';
import { performanceMiddleware } from './utils/performance-monitor.js';
import { systemMonitor } from './utils/system-monitor.js';

const app = express();

// Set up global error handlers
handleUnhandledRejection();
handleUncaughtException();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(securityHeaders);
app.use(cors({
  origin: config.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}));

// Request size limiting
app.use(requestSizeLimit);

// Suspicious activity detection
app.use(suspiciousActivityDetection);

// Rate limiting middleware
app.use(generalRateLimit);

// Body parsing middleware with size limits
app.use(express.json({
  limit: '10mb',
  verify: (_req, _res, buf) => {
    // Verify JSON is valid
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 100 // Limit number of parameters
}));

// Input sanitization middleware
app.use(sanitizeInput);

// Response utilities middleware
app.use(responseMiddleware);

// Performance monitoring middleware
app.use(performanceMiddleware);

// Request logging middleware
app.use(requestLogger);

// Serve static files for performance dashboard
app.use('/dashboard', express.static('src/public'));

// Health check endpoint with detailed system information
app.get('/health', (_req, res) => {
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    platform: process.platform
  };

  res.json(healthInfo);
});

// API routes with appropriate rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/performance', performanceRoutes);

// Error logging middleware (before error handler)
app.use(errorLogger);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handling middleware
app.use(globalErrorHandler);

// Start server
const PORT = config.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.NODE_ENV} mode`);
  
  // Start system monitoring
  systemMonitor.startCollection(30000); // Collect metrics every 30 seconds
  logger.info('Available routes:');
  logger.info('  GET  /health - Health check');
  logger.info('  POST /api/auth/login - User login');
  logger.info('  POST /api/auth/refresh - Refresh access token');
  logger.info('  POST /api/auth/logout - User logout');
  logger.info('  GET  /api/auth/me - Get user profile');
  logger.info('  POST /api/auth/change-password - Change password');
  logger.info('  GET  /api/users - Get all users (with filtering/pagination)');
  logger.info('  GET  /api/users/:id - Get user by ID');
  logger.info('  POST /api/users - Create new user');
  logger.info('  PUT  /api/users/:id - Update user');
  logger.info('  DELETE /api/users/:id - Delete user');
  logger.info('  GET  /api/users/stats - Get user statistics');
  logger.info('  GET  /api/submissions - Get all submissions (with filtering/pagination)');
  logger.info('  GET  /api/submissions/my - Get current user submissions');
  logger.info('  GET  /api/submissions/department - Get department submissions');
  logger.info('  GET  /api/submissions/:id - Get submission by ID');
  logger.info('  POST /api/submissions - Create new submission');
  logger.info('  PUT  /api/submissions/:id - Update submission');
  logger.info('  PUT  /api/submissions/:id/status - Update submission status');
  logger.info('  PUT  /api/submissions/:id/comment - Add comment to submission');
  logger.info('  DELETE /api/submissions/:id - Delete submission');
  logger.info('  GET  /api/submissions/stats - Get submission statistics');
  logger.info('  GET  /api/departments - Get all departments (with filtering/pagination)');
  logger.info('  GET  /api/departments/:id - Get department by ID');
  logger.info('  POST /api/departments - Create new department');
  logger.info('  PUT  /api/departments/:id - Update department');
  logger.info('  DELETE /api/departments/:id - Delete department');
  logger.info('  PUT  /api/departments/:id/hod - Assign/update department HOD');
  logger.info('  GET  /api/departments/stats - Get department statistics');
  logger.info('  GET  /api/departments/:id/users - Get users in department');
  logger.info('  GET  /api/notifications - Get user notifications');
  logger.info('  GET  /api/notifications/unread-count - Get unread notification count');
  logger.info('  PUT  /api/notifications/:id/read - Mark notification as read');
  logger.info('  PUT  /api/notifications/read-all - Mark all notifications as read');
  logger.info('  GET  /api/audit-logs - Get audit logs (Admin only)');
  logger.info('  GET  /api/audit-logs/stats - Get audit log statistics (Admin only)');
  logger.info('  GET  /api/audit-logs/submission/:id - Get submission audit logs');
  logger.info('  POST /api/files/upload - Upload single file');
  logger.info('  POST /api/files/upload-multiple - Upload multiple files');
  logger.info('  GET  /api/files/download/:filePath - Download file with access control');
  logger.info('  GET  /api/files/metadata/:filePath - Get file metadata');
  logger.info('  DELETE /api/files/:filePath - Delete file');
  logger.info('  GET  /api/files/stats - Get storage statistics (Admin only)');
  logger.info('  POST /api/files/cleanup/orphaned - Clean up orphaned files (Admin only)');
  logger.info('  POST /api/files/cleanup/temp - Clean up temporary files (Admin only)');
  logger.info('  POST /api/files/migrate/supabase - Migrate files from Supabase (Admin only)');
  logger.info('  POST /api/files/migrate/verify - Verify migration integrity (Admin only)');
  logger.info('  GET  /api/performance/metrics - Prometheus metrics (Admin only)');
  logger.info('  GET  /api/performance/dashboard - Performance dashboard data (Admin only)');
  logger.info('  GET  /api/performance/system - Real-time system metrics (Admin only)');
  logger.info('  GET  /api/performance/alerts - Performance alerts (Admin only)');
  logger.info('  GET  /api/performance/recommendations - Performance recommendations (Admin only)');
  logger.info('  POST /api/performance/monitoring/start - Start system monitoring (Admin only)');
  logger.info('  POST /api/performance/monitoring/stop - Stop system monitoring (Admin only)');
  logger.info('  GET  /api/performance/monitoring/status - Monitoring status (Admin only)');
  logger.info('  GET  /api/performance/regression-tests - Performance regression test results (Admin only)');
  logger.info('  POST /api/performance/regression-tests/run - Run performance regression tests (Admin only)');
});

export default app;