import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { register } from '../utils/performance-monitor.js';
import { systemMonitor } from '../utils/system-monitor.js';
import { performanceTestRunner } from '../utils/performance-testing.js';
import { logger } from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();

// Prometheus metrics endpoint (admin only)
router.get('/metrics', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Error retrieving metrics', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).send('Error retrieving metrics');
  }
});

// System performance dashboard data (admin only)
router.get('/dashboard', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const report = await systemMonitor.getPerformanceReport();
    res.json(successResponse(report, 'Performance dashboard data retrieved'));
  } catch (error) {
    logger.error('Error retrieving dashboard data', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to retrieve dashboard data'));
  }
});

// Real-time system metrics (admin only)
router.get('/system', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const metrics = await systemMonitor.collectSystemMetrics();
    res.json(successResponse(metrics, 'System metrics retrieved'));
  } catch (error) {
    logger.error('Error retrieving system metrics', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to retrieve system metrics'));
  }
});

// Performance alerts (admin only)
router.get('/alerts', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const report = await systemMonitor.getPerformanceReport();
    const alerts = {
      alerts: report.alerts,
      recommendations: report.recommendations,
      timestamp: report.timestamp
    };
    res.json(successResponse(alerts, 'Performance alerts retrieved'));
  } catch (error) {
    logger.error('Error retrieving performance alerts', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to retrieve performance alerts'));
  }
});

// Performance optimization recommendations (admin only)
router.get('/recommendations', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const recommendations = await generatePerformanceRecommendations();
    res.json(successResponse(recommendations, 'Performance recommendations generated'));
  } catch (error) {
    logger.error('Error generating recommendations', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to generate recommendations'));
  }
});

// Start/stop system monitoring (admin only)
router.post('/monitoring/start', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { interval = 30000 } = req.body;
    systemMonitor.startCollection(interval);
    res.json(successResponse(null, 'System monitoring started'));
  } catch (error) {
    logger.error('Error starting monitoring', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to start monitoring'));
  }
});

router.post('/monitoring/stop', authenticateToken, requireRole('admin'), (_req, res) => {
  try {
    systemMonitor.stopCollection();
    res.json(successResponse(null, 'System monitoring stopped'));
  } catch (error) {
    logger.error('Error stopping monitoring', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to stop monitoring'));
  }
});

// Monitoring status (admin only)
router.get('/monitoring/status', authenticateToken, requireRole('admin'), (_req, res) => {
  try {
    const status = {
      isActive: systemMonitor.isCollectionActive(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    res.json(successResponse(status, 'Monitoring status retrieved'));
  } catch (error) {
    logger.error('Error retrieving monitoring status', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to retrieve monitoring status'));
  }
});

// Performance regression test results (admin only)
router.get('/regression-tests', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const results = await performanceTestRunner.runAllTests();
    res.json(successResponse(results, 'Performance regression test results'));
  } catch (error) {
    logger.error('Error running regression tests', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to run regression tests'));
  }
});

// Run performance regression tests (admin only)
router.post('/regression-tests/run', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { suite } = req.body;
    let results;
    
    if (suite) {
      results = await performanceTestRunner.runTestSuite(suite);
    } else {
      results = await performanceTestRunner.runAllTests();
    }
    
    res.json(successResponse(results, 'Performance regression tests completed'));
  } catch (error) {
    logger.error('Error running regression tests', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to run regression tests'));
  }
});

// Get available test suites (admin only)
router.get('/regression-tests/suites', authenticateToken, requireRole('admin'), (_req, res) => {
  try {
    const suites = performanceTestRunner.getAvailableTestSuites();
    res.json(successResponse(suites, 'Available test suites retrieved'));
  } catch (error) {
    logger.error('Error retrieving test suites', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json(errorResponse('Failed to retrieve test suites'));
  }
});

// Helper function to generate performance recommendations
async function generatePerformanceRecommendations() {
  const report = await systemMonitor.getPerformanceReport();
  const recommendations = [...report.recommendations];

  // Database-specific recommendations
  if (report.metrics.database.size_bytes > 500 * 1024 * 1024) { // 500MB
    recommendations.push('Consider implementing database query optimization and indexing review');
  }

  // Memory-specific recommendations
  if (report.metrics.memory.usage_percent > 70) {
    recommendations.push('Monitor for memory leaks and consider implementing memory caching strategies');
  }

  // Network-specific recommendations
  if (report.metrics.network.rx_sec > 1024 * 1024 || report.metrics.network.tx_sec > 1024 * 1024) { // 1MB/s
    recommendations.push('High network traffic detected, consider implementing response compression');
  }

  // Process-specific recommendations
  if (report.metrics.process.uptime > 7 * 24 * 60 * 60) { // 7 days
    recommendations.push('Consider periodic application restarts to prevent memory fragmentation');
  }

  return {
    timestamp: new Date().toISOString(),
    recommendations,
    priority_actions: recommendations.slice(0, 3), // Top 3 recommendations
    system_health_score: calculateHealthScore(report.metrics)
  };
}

// Helper function to calculate system health score
function calculateHealthScore(metrics: any): number {
  let score = 100;

  // Deduct points based on resource usage
  if (metrics.cpu.usage > 80) score -= 20;
  else if (metrics.cpu.usage > 60) score -= 10;

  if (metrics.memory.usage_percent > 85) score -= 20;
  else if (metrics.memory.usage_percent > 70) score -= 10;

  if (metrics.disk.usage_percent > 90) score -= 15;
  else if (metrics.disk.usage_percent > 80) score -= 5;

  return Math.max(0, score);
}



export default router;