#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Running Comprehensive System Tests');
console.log('=' .repeat(60));

const testSuites = [
  { name: 'Build Verification', command: 'npm run build' },
  { name: 'Unit Tests', command: 'npm test -- --testPathIgnorePatterns="integration|load|migration|system"' },
  { name: 'Integration Tests', command: 'npm run test:integration' },
  { name: 'Migration Validation', command: 'npm run test:migration' },
  { name: 'System Acceptance', command: 'npm run test:system' },
  { name: 'Load Testing', command: 'npm run test:load' }
];

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of testSuites) {
  console.log(`\n🧪 Running ${suite.name}...`);
  const startTime = Date.now();
  
  try {
    const output = execSync(suite.command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: __dirname
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${suite.name} passed in ${(duration / 1000).toFixed(2)}s`);
    
    results.push({
      name: suite.name,
      status: 'PASS',
      duration: duration,
      output: output.substring(0, 200) + '...'
    });
    
    totalPassed++;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`❌ ${suite.name} failed in ${(duration / 1000).toFixed(2)}s`);
    console.log(`   Error: ${error.message.substring(0, 100)}...`);
    
    results.push({
      name: suite.name,
      status: 'FAIL',
      duration: duration,
      error: error.message.substring(0, 200) + '...'
    });
    
    totalFailed++;
  }
}

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));
console.log(`Overall Status: ${totalFailed === 0 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Total Suites: ${testSuites.length}`);
console.log(`Passed: ${totalPassed}`);
console.log(`Failed: ${totalFailed}`);

console.log('\nDetailed Results:');
results.forEach(result => {
  const status = result.status === 'PASS' ? '✅' : '❌';
  const duration = (result.duration / 1000).toFixed(2);
  console.log(`  ${status} ${result.name}: ${duration}s`);
  
  if (result.error) {
    console.log(`     Error: ${result.error}`);
  }
});

// Save results to file
const fs = require('fs');
const reportPath = path.join(__dirname, 'test-results.json');
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalSuites: testSuites.length,
  passed: totalPassed,
  failed: totalFailed,
  overallStatus: totalFailed === 0 ? 'PASS' : 'FAIL',
  results: results
}, null, 2));

console.log(`\n📄 Results saved to: ${reportPath}`);

// Exit with appropriate code
process.exit(totalFailed === 0 ? 0 : 1);