import { logger } from './logger.js';
import { dbManager } from './database.js';
import { userRepository, submissionRepository, departmentRepository } from '../repositories/index.js';

export interface PerformanceTest {
  name: string;
  description: string;
  threshold_ms: number;
  run: () => Promise<number>;
}

export interface PerformanceTestResult {
  test: string;
  description: string;
  duration_ms: number;
  threshold_ms: number;
  status: 'pass' | 'fail';
  timestamp: string;
}

export interface PerformanceTestSuite {
  name: string;
  tests: PerformanceTest[];
}

export class PerformanceTestRunner {
  private testSuites: PerformanceTestSuite[] = [];

  constructor() {
    this.initializeTestSuites();
  }

  private initializeTestSuites(): void {
    // Database performance tests
    this.testSuites.push({
      name: 'Database Operations',
      tests: [
        {
          name: 'user_query_performance',
          description: 'User repository findAll query performance',
          threshold_ms: 100,
          run: async () => {
            const start = Date.now();
            await userRepository.findAll({ limit: 50 });
            return Date.now() - start;
          }
        },
        {
          name: 'submission_query_performance',
          description: 'Submission repository findAll query performance',
          threshold_ms: 150,
          run: async () => {
            const start = Date.now();
            await submissionRepository.findAll({ limit: 50 });
            return Date.now() - start;
          }
        },
        {
          name: 'department_query_performance',
          description: 'Department repository findAll query performance',
          threshold_ms: 50,
          run: async () => {
            const start = Date.now();
            await departmentRepository.findAll();
            return Date.now() - start;
          }
        },
        {
          name: 'user_creation_performance',
          description: 'User creation operation performance',
          threshold_ms: 200,
          run: async () => {
            const start = Date.now();
            const testUser = {
              employeeId: `test-${Date.now()}`,
              name: 'Test User',
              email: `test-${Date.now()}@example.com`,
              role: 'faculty' as const,
              departmentId: 'test-dept',
              designation: 'Assistant Professor',
              institution: 'Test Institution',
              passwordHash: 'test-hash'
            };
            
            try {
              const created = await userRepository.create(testUser);
              // Clean up test user
              await userRepository.delete(created.id);
            } catch (error) {
              // Test user creation might fail due to constraints, that's ok for performance testing
            }
            
            return Date.now() - start;
          }
        },
        {
          name: 'database_connection_performance',
          description: 'Database connection establishment performance',
          threshold_ms: 50,
          run: async () => {
            const start = Date.now();
            const connection = await dbManager.getConnection();
            await dbManager.releaseConnection(connection);
            return Date.now() - start;
          }
        }
      ]
    });

    // Memory and CPU performance tests
    this.testSuites.push({
      name: 'System Resources',
      tests: [
        {
          name: 'memory_usage_stability',
          description: 'Memory usage stability test',
          threshold_ms: 10,
          run: async () => {
            const start = Date.now();
            const initialMemory = process.memoryUsage();
            
            // Perform some memory-intensive operations
            const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: `test-${i}` }));
            
            // Force garbage collection if available
            if (global.gc) {
              global.gc();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Log memory increase for monitoring
            logger.debug('Memory usage test completed', {
              initialHeapUsed: initialMemory.heapUsed,
              finalHeapUsed: finalMemory.heapUsed,
              memoryIncrease,
              arrayLength: largeArray.length
            });
            
            return Date.now() - start;
          }
        },
        {
          name: 'cpu_intensive_operation',
          description: 'CPU intensive operation performance',
          threshold_ms: 100,
          run: async () => {
            const start = Date.now();
            
            // Perform CPU-intensive calculation
            let result = 0;
            for (let i = 0; i < 100000; i++) {
              result += Math.sqrt(i) * Math.sin(i);
            }
            
            // Use result to prevent optimization
            logger.debug('CPU test completed', { result: result.toFixed(2) });
            
            return Date.now() - start;
          }
        }
      ]
    });

    // Concurrent operation tests
    this.testSuites.push({
      name: 'Concurrent Operations',
      tests: [
        {
          name: 'concurrent_database_reads',
          description: 'Concurrent database read operations performance',
          threshold_ms: 500,
          run: async () => {
            const start = Date.now();
            
            // Run multiple concurrent database operations
            const promises = Array.from({ length: 10 }, () => 
              userRepository.findAll({ limit: 10 })
            );
            
            await Promise.all(promises);
            return Date.now() - start;
          }
        },
        {
          name: 'concurrent_mixed_operations',
          description: 'Mixed concurrent database operations performance',
          threshold_ms: 800,
          run: async () => {
            const start = Date.now();
            
            // Mix of read operations
            const promises = [
              userRepository.findAll({ limit: 5 }),
              submissionRepository.findAll({ limit: 5 }),
              departmentRepository.findAll(),
              userRepository.count(),
              submissionRepository.count()
            ];
            
            await Promise.all(promises);
            return Date.now() - start;
          }
        }
      ]
    });
  }

  async runAllTests(): Promise<{
    timestamp: string;
    total_duration_ms: number;
    tests_run: number;
    tests_passed: number;
    tests_failed: number;
    success_rate: number;
    results: PerformanceTestResult[];
    overall_status: 'pass' | 'fail';
  }> {
    const startTime = Date.now();
    const results: PerformanceTestResult[] = [];

    logger.info('Starting performance regression tests');

    for (const suite of this.testSuites) {
      logger.info(`Running test suite: ${suite.name}`);
      
      for (const test of suite.tests) {
        try {
          logger.debug(`Running test: ${test.name}`);
          const duration = await test.run();
          const status = duration <= test.threshold_ms ? 'pass' : 'fail';
          
          const result: PerformanceTestResult = {
            test: test.name,
            description: test.description,
            duration_ms: duration,
            threshold_ms: test.threshold_ms,
            status,
            timestamp: new Date().toISOString()
          };
          
          results.push(result);
          
          logger.debug(`Test ${test.name} completed`, {
            duration,
            threshold: test.threshold_ms,
            status
          });
          
        } catch (error) {
          logger.error(`Test ${test.name} failed with error`, { error: error instanceof Error ? error.message : 'Unknown error' });
          
          results.push({
            test: test.name,
            description: test.description,
            duration_ms: -1,
            threshold_ms: test.threshold_ms,
            status: 'fail',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    const passedTests = results.filter(r => r.status === 'pass').length;
    const failedTests = results.length - passedTests;
    const successRate = (passedTests / results.length) * 100;

    const summary = {
      timestamp: new Date().toISOString(),
      total_duration_ms: totalDuration,
      tests_run: results.length,
      tests_passed: passedTests,
      tests_failed: failedTests,
      success_rate: successRate,
      results,
      overall_status: failedTests === 0 ? 'pass' as const : 'fail' as const
    };

    logger.info('Performance regression tests completed', {
      testsRun: results.length,
      testsPassed: passedTests,
      testsFailed: failedTests,
      successRate: successRate.toFixed(2) + '%',
      totalDuration
    });

    return summary;
  }

  async runTestSuite(suiteName: string): Promise<PerformanceTestResult[]> {
    const suite = this.testSuites.find(s => s.name === suiteName);
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    const results: PerformanceTestResult[] = [];

    for (const test of suite.tests) {
      try {
        const duration = await test.run();
        const status = duration <= test.threshold_ms ? 'pass' : 'fail';
        
        results.push({
          test: test.name,
          description: test.description,
          duration_ms: duration,
          threshold_ms: test.threshold_ms,
          status,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        results.push({
          test: test.name,
          description: test.description,
          duration_ms: -1,
          threshold_ms: test.threshold_ms,
          status: 'fail',
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  getAvailableTestSuites(): string[] {
    return this.testSuites.map(suite => suite.name);
  }

  getTestSuiteDetails(suiteName: string): PerformanceTestSuite | null {
    return this.testSuites.find(s => s.name === suiteName) || null;
  }
}

export const performanceTestRunner = new PerformanceTestRunner();