#!/usr/bin/env node

import { dbManager } from '../utils/database';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationTestResult {
  phase: string;
  success: boolean;
  duration: number;
  details: any;
  errors: string[];
}

class FullMigrationTester {
  private results: MigrationTestResult[] = [];
  private testDataPath = path.join(__dirname, '..', 'test-data');

  async runFullMigrationTest(): Promise<void> {
    console.log('🚀 Starting Full Migration Process Test');
    console.log('=' .repeat(60));

    try {
      // Phase 1: Setup test environment
      await this.runPhase('Environment Setup', () => this.setupTestEnvironment());

      // Phase 2: Create test Supabase data
      await this.runPhase('Create Test Data', () => this.createTestSupabaseData());

      // Phase 3: Run database migration
      await this.runPhase('Database Migration', () => this.runDatabaseMigration());

      // Phase 4: Import test data
      await this.runPhase('Data Import', () => this.importTestData());

      // Phase 5: Validate migration
      await this.runPhase('Migration Validation', () => this.validateMigration());

      // Phase 6: Test API functionality
      await this.runPhase('API Testing', () => this.testApiEndpoints());

      // Phase 7: Performance testing
      await this.runPhase('Performance Testing', () => this.runPerformanceTests());

      // Phase 8: Cleanup
      await this.runPhase('Cleanup', () => this.cleanup());

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Migration test failed:', error);
      process.exit(1);
    }
  }

  private async runPhase(phaseName: string, phaseFunction: () => Promise<any>): Promise<void> {
    console.log(`\n🔄 ${phaseName}...`);
    const startTime = performance.now();

    try {
      const details = await phaseFunction();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.push({
        phase: phaseName,
        success: true,
        duration,
        details,
        errors: []
      });

      console.log(`✅ ${phaseName} completed in ${(duration / 1000).toFixed(2)}s`);

    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.push({
        phase: phaseName,
        success: false,
        duration,
        details: null,
        errors: [error.message || 'Unknown error']
      });

      console.log(`❌ ${phaseName} failed: ${error.message}`);
      throw error;
    }
  }

  private async setupTestEnvironment(): Promise<any> {
    // Create test data directory
    await fs.mkdir(this.testDataPath, { recursive: true });

    // Create test database directory
    const dbDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dbDir, { recursive: true });

    // Create test uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'submissions'), { recursive: true });
    await fs.mkdir(path.join(uploadsDir, 'temp'), { recursive: true });

    return {
      testDataPath: this.testDataPath,
      dbDir,
      uploadsDir
    };
  }

  private async createTestSupabaseData(): Promise<any> {
    // Create mock Supabase export data
    const testUsers = [
      {
        id: 'user-1',
        employee_id: 'EMP001',
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'faculty',
        department_id: 'dept-1',
        designation: 'Professor',
        institution: 'Test University',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'user-2',
        employee_id: 'EMP002',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'hod',
        department_id: 'dept-1',
        designation: 'Head of Department',
        institution: 'Test University',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'user-3',
        employee_id: 'ADMIN001',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        department_id: 'dept-1',
        designation: 'Administrator',
        institution: 'Test University',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ];

    const testDepartments = [
      {
        id: 'dept-1',
        name: 'Computer Science',
        code: 'CS',
        hod_user_id: null, // Will be updated after users are created
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'dept-2',
        name: 'Mathematics',
        code: 'MATH',
        hod_user_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ];

    const testSubmissions = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        module_type: 'attended',
        status: 'pending',
        form_data: JSON.stringify({
          title: 'Machine Learning Workshop',
          organizer: 'IEEE',
          duration: '3 days',
          startDate: '2024-01-15',
          endDate: '2024-01-17'
        }),
        document_url: null,
        hod_comment: null,
        admin_comment: null,
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z'
      },
      {
        id: 'sub-2',
        user_id: 'user-1',
        module_type: 'organized',
        status: 'approved',
        form_data: JSON.stringify({
          title: 'Data Science Seminar',
          organizer: 'University',
          duration: '1 day',
          startDate: '2024-02-01',
          endDate: '2024-02-01'
        }),
        document_url: '/uploads/submissions/user-1/certificate.pdf',
        hod_comment: 'Excellent initiative',
        admin_comment: 'Approved for professional development',
        created_at: '2024-01-20T00:00:00Z',
        updated_at: '2024-01-25T00:00:00Z'
      }
    ];

    // Save test data files
    await fs.writeFile(
      path.join(this.testDataPath, 'users.json'),
      JSON.stringify(testUsers, null, 2)
    );

    await fs.writeFile(
      path.join(this.testDataPath, 'departments.json'),
      JSON.stringify(testDepartments, null, 2)
    );

    await fs.writeFile(
      path.join(this.testDataPath, 'submissions.json'),
      JSON.stringify(testSubmissions, null, 2)
    );

    return {
      users: testUsers.length,
      departments: testDepartments.length,
      submissions: testSubmissions.length
    };
  }

  private async runDatabaseMigration(): Promise<any> {
    // Initialize database
    await dbManager.initialize();
    const db = await dbManager.getConnection();

    // Run migrations
    const migrationDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = await fs.readdir(migrationDir);
    const sqlFiles = migrationFiles.filter(f => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const migrationSql = await fs.readFile(path.join(migrationDir, file), 'utf8');
      const statements = migrationSql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await db.exec(statement);
        }
      }
    }

    // Verify tables were created
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    return {
      migrationsRun: sqlFiles.length,
      tablesCreated: tables.length,
      tables: tables.map((t: any) => t.name)
    };
  }

  private async importTestData(): Promise<any> {
    const db = await dbManager.getConnection();

    // Import departments first (due to foreign key constraints)
    const departments = JSON.parse(
      await fs.readFile(path.join(this.testDataPath, 'departments.json'), 'utf8')
    );

    for (const dept of departments) {
      await db.run(`
        INSERT INTO departments (id, name, code, hod_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [dept.id, dept.name, dept.code, dept.hod_user_id, dept.created_at, dept.updated_at]);
    }

    // Import users
    const users = JSON.parse(
      await fs.readFile(path.join(this.testDataPath, 'users.json'), 'utf8')
    );

    for (const user of users) {
      // Hash password for test users
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash('testpassword123', 12);

      await db.run(`
        INSERT INTO users (id, employee_id, name, email, role, department_id, designation, institution, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id, user.employee_id, user.name, user.email, user.role,
        user.department_id, user.designation, user.institution, passwordHash,
        user.created_at, user.updated_at
      ]);
    }

    // Import submissions
    const submissions = JSON.parse(
      await fs.readFile(path.join(this.testDataPath, 'submissions.json'), 'utf8')
    );

    for (const submission of submissions) {
      await db.run(`
        INSERT INTO submissions (id, user_id, module_type, status, form_data, document_url, hod_comment, admin_comment, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        submission.id, submission.user_id, submission.module_type, submission.status,
        submission.form_data, submission.document_url, submission.hod_comment,
        submission.admin_comment, submission.created_at, submission.updated_at
      ]);
    }

    // Update department HOD after users are created
    await db.run(`
      UPDATE departments SET hod_user_id = 'user-2' WHERE id = 'dept-1'
    `);

    return {
      departmentsImported: departments.length,
      usersImported: users.length,
      submissionsImported: submissions.length
    };
  }

  private async validateMigration(): Promise<any> {
    const db = await dbManager.getConnection();

    // Validate data counts
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const deptCount = await db.get('SELECT COUNT(*) as count FROM departments');
    const submissionCount = await db.get('SELECT COUNT(*) as count FROM submissions');

    // Validate data integrity
    const orphanedSubmissions = await db.all(`
      SELECT s.id FROM submissions s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE u.id IS NULL
    `);

    const orphanedUsers = await db.all(`
      SELECT u.id FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      WHERE u.department_id IS NOT NULL AND d.id IS NULL
    `);

    // Validate indexes
    const indexes = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `);

    // Validate foreign keys
    const foreignKeysEnabled = await db.get('PRAGMA foreign_keys');

    return {
      dataCounts: {
        users: userCount.count,
        departments: deptCount.count,
        submissions: submissionCount.count
      },
      dataIntegrity: {
        orphanedSubmissions: orphanedSubmissions.length,
        orphanedUsers: orphanedUsers.length
      },
      indexes: indexes.length,
      foreignKeysEnabled: foreignKeysEnabled.foreign_keys === 1
    };
  }

  private async testApiEndpoints(): Promise<any> {
    // This would typically start the server and make HTTP requests
    // For now, we'll test the database operations directly
    const db = await dbManager.getConnection();

    // Test user queries
    const users = await db.all('SELECT * FROM users');
    const userById = await db.get('SELECT * FROM users WHERE id = ?', ['user-1']);

    // Test submission queries
    const submissions = await db.all('SELECT * FROM submissions');
    const submissionsByUser = await db.all('SELECT * FROM submissions WHERE user_id = ?', ['user-1']);

    // Test joins
    const submissionsWithUsers = await db.all(`
      SELECT s.*, u.name as user_name 
      FROM submissions s 
      JOIN users u ON s.user_id = u.id
    `);

    return {
      userQueries: {
        totalUsers: users.length,
        userByIdFound: !!userById
      },
      submissionQueries: {
        totalSubmissions: submissions.length,
        submissionsByUser: submissionsByUser.length
      },
      joinQueries: {
        submissionsWithUsers: submissionsWithUsers.length
      }
    };
  }

  private async runPerformanceTests(): Promise<any> {
    const db = await dbManager.getConnection();

    // Test query performance
    const performanceTests = [
      {
        name: 'Select all users',
        query: 'SELECT * FROM users',
        params: []
      },
      {
        name: 'Select user by employee_id',
        query: 'SELECT * FROM users WHERE employee_id = ?',
        params: ['EMP001']
      },
      {
        name: 'Select submissions with user join',
        query: 'SELECT s.*, u.name FROM submissions s JOIN users u ON s.user_id = u.id',
        params: []
      },
      {
        name: 'Count submissions by status',
        query: 'SELECT status, COUNT(*) FROM submissions GROUP BY status',
        params: []
      }
    ];

    const results = [];

    for (const test of performanceTests) {
      const startTime = performance.now();
      await db.all(test.query, test.params);
      const endTime = performance.now();
      const duration = endTime - startTime;

      results.push({
        name: test.name,
        duration: duration,
        acceptable: duration < 100 // Should complete within 100ms
      });
    }

    return {
      tests: results,
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      allAcceptable: results.every(r => r.acceptable)
    };
  }

  private async cleanup(): Promise<any> {
    // Close database connection
    await dbManager.close();

    // Clean up test data files
    try {
      await fs.rm(this.testDataPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    return {
      testDataCleaned: true,
      databaseClosed: true
    };
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Full Migration Test Report');
    console.log('='.repeat(60));

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const successfulPhases = this.results.filter(r => r.success).length;
    const failedPhases = this.results.filter(r => !r.success).length;

    console.log(`\nOverall Status: ${failedPhases === 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Successful Phases: ${successfulPhases}/${this.results.length}`);
    console.log(`Failed Phases: ${failedPhases}`);

    console.log('\nPhase Details:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`  ${status} ${result.phase}: ${duration}s`);
      
      if (result.details) {
        console.log(`     Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}...`);
      }
      
      if (result.errors.length > 0) {
        console.log(`     Errors: ${result.errors.join(', ')}`);
      }
    });

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'migration-test-report.json');
    fs.writeFile(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalDuration,
      overallStatus: failedPhases === 0 ? 'PASS' : 'FAIL',
      results: this.results
    }, null, 2)).then(() => {
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    });
  }
}

// Run the test
const tester = new FullMigrationTester();
tester.runFullMigrationTest()
  .then(() => {
    console.log('\n🎉 Full migration test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Full migration test failed:', error);
    process.exit(1);
  });

export { FullMigrationTester };