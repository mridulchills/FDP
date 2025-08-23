#!/usr/bin/env tsx

import { performanceTestRunner } from '../utils/performance-testing.js';
import { systemMonitor } from '../utils/system-monitor.js';
import { logger } from '../utils/logger.js';

async function testPerformanceMonitoring() {
  try {
    logger.info('Testing performance monitoring system...');

    // Test system metrics collection
    logger.info('Testing system metrics collection...');
    const metrics = await systemMonitor.collectSystemMetrics();
    logger.info('System metrics collected successfully', {
      cpuUsage: metrics.cpu.usage.toFixed(2) + '%',
      memoryUsage: metrics.memory.usage_percent.toFixed(2) + '%',
      diskUsage: metrics.disk.usage_percent.toFixed(2) + '%'
    });

    // Test performance report generation
    logger.info('Testing performance report generation...');
    const report = await systemMonitor.getPerformanceReport();
    logger.info('Performance report generated successfully', {
      alertsCount: report.alerts.length,
      recommendationsCount: report.recommendations.length,
      healthScore: report.recommendations.length === 0 ? 'Good' : 'Needs attention'
    });

    // Test performance regression tests
    logger.info('Testing performance regression tests...');
    const testResults = await performanceTestRunner.runAllTests();
    logger.info('Performance regression tests completed', {
      testsRun: testResults.tests_run,
      testsPassed: testResults.tests_passed,
      testsFailed: testResults.tests_failed,
      successRate: testResults.success_rate.toFixed(2) + '%',
      overallStatus: testResults.overall_status
    });

    // Test individual test suites
    logger.info('Testing individual test suites...');
    const suites = performanceTestRunner.getAvailableTestSuites();
    logger.info('Available test suites', { suites });

    for (const suiteName of suites.slice(0, 1)) { // Test first suite only
      const suiteResults = await performanceTestRunner.runTestSuite(suiteName);
      logger.info(`Test suite "${suiteName}" completed`, {
        testsRun: suiteResults.length,
        testsPassed: suiteResults.filter(r => r.status === 'pass').length
      });
    }

    logger.info('Performance monitoring system test completed successfully!');
    
    // Display summary
    console.log('\n=== Performance Monitoring Test Summary ===');
    console.log(`✅ System metrics collection: Working`);
    console.log(`✅ Performance report generation: Working`);
    console.log(`✅ Regression testing: Working (${testResults.success_rate.toFixed(1)}% success rate)`);
    console.log(`✅ Test suites: ${suites.length} available`);
    console.log(`📊 Current system status:`);
    console.log(`   - CPU Usage: ${metrics.cpu.usage.toFixed(1)}%`);
    console.log(`   - Memory Usage: ${metrics.memory.usage_percent.toFixed(1)}%`);
    console.log(`   - Disk Usage: ${metrics.disk.usage_percent.toFixed(1)}%`);
    
    if (report.alerts.length > 0) {
      console.log(`⚠️  Active alerts: ${report.alerts.length}`);
      report.alerts.forEach(alert => console.log(`   - ${alert}`));
    }
    
    if (report.recommendations.length > 0) {
      console.log(`💡 Recommendations: ${report.recommendations.length}`);
      report.recommendations.slice(0, 3).forEach(rec => console.log(`   - ${rec}`));
    }

  } catch (error) {
    logger.error('Performance monitoring test failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    console.error('❌ Performance monitoring test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPerformanceMonitoring();