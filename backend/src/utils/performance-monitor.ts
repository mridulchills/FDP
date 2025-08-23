import { Request, Response } from 'express';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import responseTime from 'response-time';
import { logger } from './logger.js';

// Initialize default metrics collection
collectDefaultMetrics({ prefix: 'fdts_' });

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'fdts_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

export const httpRequestTotal = new Counter({
  name: 'fdts_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const databaseQueryDuration = new Histogram({
  name: 'fdts_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const databaseQueryTotal = new Counter({
  name: 'fdts_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status']
});

export const activeConnections = new Gauge({
  name: 'fdts_active_connections',
  help: 'Number of active database connections'
});

export const memoryUsage = new Gauge({
  name: 'fdts_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type']
});

export const cpuUsage = new Gauge({
  name: 'fdts_cpu_usage_percent',
  help: 'CPU usage percentage'
});

export const fileOperations = new Counter({
  name: 'fdts_file_operations_total',
  help: 'Total number of file operations',
  labelNames: ['operation', 'status']
});

export const fileOperationDuration = new Histogram({
  name: 'fdts_file_operation_duration_seconds',
  help: 'Duration of file operations in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

// Performance monitoring middleware
export const performanceMiddleware = responseTime((req: Request, res: Response, time: number) => {
  const route = req.route?.path || req.path;
  const method = req.method;
  const statusCode = res.statusCode.toString();
  
  // Record metrics
  httpRequestDuration
    .labels(method, route, statusCode)
    .observe(time / 1000); // Convert to seconds
  
  httpRequestTotal
    .labels(method, route, statusCode)
    .inc();
  
  // Log slow requests
  if (time > 1000) { // Log requests taking more than 1 second
    logger.warn('Slow request detected', {
      method,
      route,
      statusCode,
      duration: time,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }
});

// Database query performance tracking
export class DatabasePerformanceTracker {
  static trackQuery<T>(
    operation: string,
    table: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = databaseQueryDuration.labels(operation, table).startTimer();
    
    return queryFn()
      .then((result) => {
        timer();
        databaseQueryTotal.labels(operation, table, 'success').inc();
        
        const duration = Date.now() - startTime;
        if (duration > 100) { // Log slow queries (>100ms)
          logger.warn('Slow database query detected', {
            operation,
            table,
            duration
          });
        }
        
        return result;
      })
      .catch((error) => {
        timer();
        databaseQueryTotal.labels(operation, table, 'error').inc();
        
        logger.error('Database query error', {
          operation,
          table,
          error: error.message,
          duration: Date.now() - startTime
        });
        
        throw error;
      });
  }
}

// File operation performance tracking
export class FilePerformanceTracker {
  static trackOperation<T>(
    operation: string,
    operationFn: () => Promise<T>
  ): Promise<T> {
    const timer = fileOperationDuration.labels(operation).startTimer();
    
    return operationFn()
      .then((result) => {
        timer();
        fileOperations.labels(operation, 'success').inc();
        return result;
      })
      .catch((error) => {
        timer();
        fileOperations.labels(operation, 'error').inc();
        throw error;
      });
  }
}

// System metrics collection
export const updateSystemMetrics = () => {
  const memUsage = process.memoryUsage();
  memoryUsage.labels('rss').set(memUsage.rss);
  memoryUsage.labels('heapTotal').set(memUsage.heapTotal);
  memoryUsage.labels('heapUsed').set(memUsage.heapUsed);
  memoryUsage.labels('external').set(memUsage.external);
  
  // CPU usage calculation (simplified)
  const cpuUsagePercent = process.cpuUsage();
  const totalUsage = cpuUsagePercent.user + cpuUsagePercent.system;
  cpuUsage.set(totalUsage / 1000000); // Convert to percentage
};

// Start system metrics collection
setInterval(updateSystemMetrics, 10000); // Update every 10 seconds

// Export metrics registry
export { register };