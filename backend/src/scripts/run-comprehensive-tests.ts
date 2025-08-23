#!/usr/bin/env node

// Import removed - using require in executeCommand
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  duration: number;
  coverage?: number | undefined;
  errors: string[];
}

interface SystemTestReport {
  timestamp: string;
  totalDuration: number;
  overallStatus: 'PASS' | 'FAIL';
  results: TestResult[];
  summary: {
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    averageCoverage: number;
  };
  recommendations: string[];
}

class ComprehensiveTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<SystemTestReport> {
    console.log('🚀 Starting Comprehensive System Testing Suite');
    console.log('=' .repeat(60));
    
    this.startTime = performance.now();

    // Run different test suites
    await this.runTestSuite('Unit Tests', 'npm test -- --testPathPattern="(?!.*integration|.*load|.*migration).*\\.test\\.(ts|js)$"');
    await this.runTestSuite('Integration Tests', 'npm test -- --testPathPattern="integration\\.test\\.(ts|js)$"');
    await this.runTestSuite('System Acceptance Tests', 'npm test -- --testPathPattern="system-acceptance\\.test\\.(ts|js)$"');
    await this.runTestSuite('Migration Validation', 'npm test -- --testPathPattern="migration-validation\\.test\\.(ts|js)$"');
    await this.runTestSuite('Load Testing', 'npm test -- --testPathPattern="load-testing\\.test\\.(ts|js)$"');

    // Run build verification
    await this.runBuildVerification();

    // Generate comprehensive report
    const report = this.generateReport();
    await this.saveReport(report);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Suite Completed');
    this.printSummary(report);

    return report;
  }

  private async runTestSuite(suiteName: string, command: string): Promise<void> {
    console.log(`\n🧪 Running ${suiteName}...`);
    const startTime = performance.now();

    try {
      const result = await this.executeCommand(command);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const testResult: TestResult = {
        suite: suiteName,
        passed: this.extractPassedTests(result.stdout),
        failed: this.extractFailedTests(result.stdout),
        duration: duration,
        coverage: this.extractCoverage(result.stdout),
        errors: this.extractErrors(result.stderr)
      };

      this.results.push(testResult);
      
      console.log(`✅ ${suiteName} completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`   Passed: ${testResult.passed}, Failed: ${testResult.failed}`);
      
      if (testResult.coverage) {
        console.log(`   Coverage: ${testResult.coverage}%`);
      }

    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const testResult: TestResult = {
        suite: suiteName,
        passed: 0,
        failed: 1,
        duration: duration,
        errors: [error.message || 'Unknown error']
      };

      this.results.push(testResult);
      console.log(`❌ ${suiteName} failed: ${error.message}`);
    }
  }

  private async runBuildVerification(): Promise<void> {
    console.log('\n🔨 Running Build Verification...');
    const startTime = performance.now();

    try {
      // Test backend build
      await this.executeCommand('npm run build', { cwd: process.cwd() });
      
      // Test frontend build (if exists)
      const frontendPath = path.join(process.cwd(), '..', 'package.json');
      try {
        await fs.access(frontendPath);
        await this.executeCommand('npm run build', { cwd: path.dirname(frontendPath) });
      } catch {
        console.log('   Frontend build skipped (not found)');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.push({
        suite: 'Build Verification',
        passed: 1,
        failed: 0,
        duration: duration,
        errors: []
      });

      console.log(`✅ Build verification completed in ${(duration / 1000).toFixed(2)}s`);

    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.push({
        suite: 'Build Verification',
        passed: 0,
        failed: 1,
        duration: duration,
        errors: [error.message || 'Build failed']
      });

      console.log(`❌ Build verification failed: ${error.message}`);
    }
  }

  private executeCommand(command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      
      exec(command, { ...options }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  private extractPassedTests(output: string): number {
    const match = output.match(/(\d+) passed/);
    return match && match[1] ? parseInt(match[1]) : 0;
  }

  private extractFailedTests(output: string): number {
    const match = output.match(/(\d+) failed/);
    return match && match[1] ? parseInt(match[1]) : 0;
  }

  private extractCoverage(output: string): number | undefined {
    const match = output.match(/All files\s+\|\s+(\d+\.?\d*)/);
    return match && match[1] ? parseFloat(match[1]) : undefined;
  }

  private extractErrors(stderr: string): string[] {
    if (!stderr.trim()) return [];
    
    return stderr
      .split('\n')
      .filter(line => line.trim())
      .filter(line => !line.includes('warning'))
      .slice(0, 10); // Limit to first 10 errors
  }

  private generateReport(): SystemTestReport {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    const totalTests = this.results.reduce((sum, result) => sum + result.passed + result.failed, 0);
    const totalPassed = this.results.reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = this.results.reduce((sum, result) => sum + result.failed, 0);
    
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    const averageCoverage = coverageResults.length > 0 
      ? coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length
      : 0;

    const overallStatus: 'PASS' | 'FAIL' = totalFailed === 0 ? 'PASS' : 'FAIL';

    const recommendations = this.generateRecommendations();

    return {
      timestamp: new Date().toISOString(),
      totalDuration: totalDuration,
      overallStatus,
      results: this.results,
      summary: {
        totalTests,
        totalPassed,
        totalFailed,
        averageCoverage
      },
      recommendations
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check for failed tests
    const failedSuites = this.results.filter(r => r.failed > 0);
    if (failedSuites.length > 0) {
      recommendations.push(`Address failing tests in: ${failedSuites.map(s => s.suite).join(', ')}`);
    }

    // Check coverage
    const lowCoverageSuites = this.results.filter(r => r.coverage && r.coverage < 80);
    if (lowCoverageSuites.length > 0) {
      recommendations.push(`Improve test coverage in: ${lowCoverageSuites.map(s => s.suite).join(', ')}`);
    }

    // Check performance
    const slowSuites = this.results.filter(r => r.duration > 30000); // 30 seconds
    if (slowSuites.length > 0) {
      recommendations.push(`Optimize performance for: ${slowSuites.map(s => s.suite).join(', ')}`);
    }

    // Check for errors
    const suitesWithErrors = this.results.filter(r => r.errors.length > 0);
    if (suitesWithErrors.length > 0) {
      recommendations.push(`Review and fix errors in: ${suitesWithErrors.map(s => s.suite).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests are passing! System is ready for production.');
    }

    return recommendations;
  }

  private async saveReport(report: SystemTestReport): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'test-reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const reportPath = path.join(reportsDir, `comprehensive-test-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Also save as HTML for better readability
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(reportsDir, `comprehensive-test-report-${Date.now()}.html`);
    await fs.writeFile(htmlPath, htmlReport);

    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   HTML: ${htmlPath}`);
  }

  private generateHtmlReport(report: SystemTestReport): string {
    const statusColor = report.overallStatus === 'PASS' ? '#28a745' : '#dc3545';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .suite { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .pass { border-left: 5px solid #28a745; }
        .fail { border-left: 5px solid #dc3545; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Comprehensive System Test Report</h1>
        <p>Status: ${report.overallStatus} | Generated: ${report.timestamp}</p>
        <p>Total Duration: ${(report.totalDuration / 1000).toFixed(2)} seconds</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Tests</td><td>${report.summary.totalTests}</td></tr>
            <tr><td>Passed</td><td style="color: #28a745">${report.summary.totalPassed}</td></tr>
            <tr><td>Failed</td><td style="color: #dc3545">${report.summary.totalFailed}</td></tr>
            <tr><td>Average Coverage</td><td>${report.summary.averageCoverage.toFixed(1)}%</td></tr>
        </table>
    </div>

    <h2>Test Suite Results</h2>
    ${report.results.map(result => `
        <div class="suite ${result.failed > 0 ? 'fail' : 'pass'}">
            <h3>${result.suite}</h3>
            <p>Passed: ${result.passed} | Failed: ${result.failed} | Duration: ${(result.duration / 1000).toFixed(2)}s</p>
            ${result.coverage ? `<p>Coverage: ${result.coverage}%</p>` : ''}
            ${result.errors.length > 0 ? `
                <div style="color: #dc3545;">
                    <strong>Errors:</strong>
                    <ul>${result.errors.map(error => `<li>${error}</li>`).join('')}</ul>
                </div>
            ` : ''}
        </div>
    `).join('')}

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
  }

  private printSummary(report: SystemTestReport): void {
    console.log(`Overall Status: ${report.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.totalPassed}`);
    console.log(`Failed: ${report.summary.totalFailed}`);
    console.log(`Average Coverage: ${report.summary.averageCoverage.toFixed(1)}%`);
    console.log(`Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    
    if (report.recommendations.length > 0) {
      console.log('\n📋 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests()
    .then(report => {
      process.exit(report.overallStatus === 'PASS' ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

export { ComprehensiveTestRunner };