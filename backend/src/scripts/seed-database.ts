#!/usr/bin/env node

/**
 * Database seeding script
 * Creates initial admin user and test data for development
 */

import { v4 as uuidv4 } from 'uuid';
import { dbManager } from '../utils/database.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

/**
 * Seed data interface
 */
interface SeedData {
  departments: Array<{
    id: string;
    name: string;
    code: string;
    hod_user_id?: string;
  }>;
  users: Array<{
    id: string;
    employee_id: string;
    name: string;
    email: string;
    role: 'faculty' | 'hod' | 'admin';
    department_id?: string;
    designation?: string;
    institution: string;
    password: string;
  }>;
  submissions?: Array<{
    id: string;
    user_id: string;
    module_type: 'attended' | 'organized' | 'certification';
    status: 'pending' | 'approved' | 'rejected';
    form_data: any;
    document_url?: string;
    hod_comment?: string;
    admin_comment?: string;
  }>;
}

/**
 * Default seed data
 */
const DEFAULT_SEED_DATA: SeedData = {
  departments: [
    {
      id: uuidv4(),
      name: 'Computer Science and Engineering',
      code: 'CSE'
    },
    {
      id: uuidv4(),
      name: 'Information Technology',
      code: 'IT'
    },
    {
      id: uuidv4(),
      name: 'Electronics and Communication Engineering',
      code: 'ECE'
    },
    {
      id: uuidv4(),
      name: 'Mechanical Engineering',
      code: 'MECH'
    },
    {
      id: uuidv4(),
      name: 'Civil Engineering',
      code: 'CIVIL'
    }
  ],
  users: [],
  submissions: []
};

// Generate users after departments are defined
const cseDept = DEFAULT_SEED_DATA.departments[0]!;
const itDept = DEFAULT_SEED_DATA.departments[1]!;
const eceDept = DEFAULT_SEED_DATA.departments[2]!;

DEFAULT_SEED_DATA.users = [
  {
    id: uuidv4(),
    employee_id: 'ADMIN001',
    name: 'System Administrator',
    email: 'admin@institution.edu',
    role: 'admin',
    designation: 'System Administrator',
    institution: 'Sample Institution',
    password: 'admin123' // Will be hashed
  },
  {
    id: uuidv4(),
    employee_id: 'HOD001',
    name: 'Dr. John Smith',
    email: 'john.smith@institution.edu',
    role: 'hod',
    department_id: cseDept.id,
    designation: 'Professor & Head',
    institution: 'Sample Institution',
    password: 'hod123' // Will be hashed
  },
  {
    id: uuidv4(),
    employee_id: 'HOD002',
    name: 'Dr. Jane Doe',
    email: 'jane.doe@institution.edu',
    role: 'hod',
    department_id: itDept.id,
    designation: 'Associate Professor & Head',
    institution: 'Sample Institution',
    password: 'hod123' // Will be hashed
  },
  {
    id: uuidv4(),
    employee_id: 'FAC001',
    name: 'Dr. Alice Johnson',
    email: 'alice.johnson@institution.edu',
    role: 'faculty',
    department_id: cseDept.id,
    designation: 'Assistant Professor',
    institution: 'Sample Institution',
    password: 'faculty123' // Will be hashed
  },
  {
    id: uuidv4(),
    employee_id: 'FAC002',
    name: 'Prof. Bob Wilson',
    email: 'bob.wilson@institution.edu',
    role: 'faculty',
    department_id: itDept.id,
    designation: 'Associate Professor',
    institution: 'Sample Institution',
    password: 'faculty123' // Will be hashed
  },
  {
    id: uuidv4(),
    employee_id: 'FAC003',
    name: 'Dr. Carol Brown',
    email: 'carol.brown@institution.edu',
    role: 'faculty',
    department_id: eceDept.id,
    designation: 'Assistant Professor',
    institution: 'Sample Institution',
    password: 'faculty123' // Will be hashed
  }
];

// Update department HoDs
DEFAULT_SEED_DATA.departments[0]!.hod_user_id = DEFAULT_SEED_DATA.users[1]!.id; // CSE HoD
DEFAULT_SEED_DATA.departments[1]!.hod_user_id = DEFAULT_SEED_DATA.users[2]!.id; // IT HoD

/**
 * Main seeding function
 */
async function seedDatabase(seedData: SeedData = DEFAULT_SEED_DATA): Promise<void> {
  try {
    logger.info('Starting database seeding...');

    // Initialize database connection
    await dbManager.initialize();

    // Check if data already exists
    const existingUsers = await dbManager.executeQuery('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0]?.count > 0) {
      logger.warn('Database already contains data. Use --force to overwrite.');

      if (!process.argv.includes('--force')) {
        logger.info('Seeding skipped. Use --force flag to overwrite existing data.');
        return;
      }

      logger.warn('Force flag detected. Clearing existing data...');
      await clearExistingData();
    }

    // Seed departments
    await seedDepartments(seedData.departments);

    // Seed users
    await seedUsers(seedData.users);

    // Update department HoDs
    await updateDepartmentHoDs(seedData.departments);

    // Seed sample submissions if provided
    if (seedData.submissions && seedData.submissions.length > 0) {
      await seedSubmissions(seedData.submissions);
    }

    logger.info('Database seeding completed successfully');

    // Display seeded data summary
    await displaySeedingSummary();

  } catch (error) {
    logger.error('Database seeding failed', { error });
    throw error;
  } finally {
    await dbManager.close();
  }
}

/**
 * Clear existing data
 */
async function clearExistingData(): Promise<void> {
  try {
    logger.info('Clearing existing data...');

    await dbManager.executeTransaction(async (db) => {
      // Clear in reverse order to respect foreign key constraints
      await db.run('DELETE FROM audit_logs');
      await db.run('DELETE FROM notifications');
      await db.run('DELETE FROM submissions');
      await db.run('DELETE FROM users');
      await db.run('DELETE FROM departments');
    });

    logger.info('Existing data cleared');
  } catch (error) {
    logger.error('Failed to clear existing data', { error });
    throw error;
  }
}

/**
 * Seed departments
 */
async function seedDepartments(departments: SeedData['departments']): Promise<void> {
  try {
    logger.info(`Seeding ${departments.length} departments...`);

    for (const dept of departments) {
      await dbManager.executeUpdate(
        `INSERT INTO departments (id, name, code, created_at, updated_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [dept.id, dept.name, dept.code]
      );

      logger.debug(`Seeded department: ${dept.name} (${dept.code})`);
    }

    logger.info('Departments seeded successfully');
  } catch (error) {
    logger.error('Failed to seed departments', { error });
    throw error;
  }
}

/**
 * Seed users
 */
async function seedUsers(users: SeedData['users']): Promise<void> {
  try {
    logger.info(`Seeding ${users.length} users...`);

    for (const user of users) {
      // Hash the password
      const passwordHash = await hashPassword(user.password);

      await dbManager.executeUpdate(
        `INSERT INTO users (id, employee_id, name, email, role, department_id, designation, institution, password_hash, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          user.id,
          user.employee_id,
          user.name,
          user.email,
          user.role,
          user.department_id || null,
          user.designation || null,
          user.institution,
          passwordHash
        ]
      );

      logger.debug(`Seeded user: ${user.name} (${user.employee_id}) - ${user.role}`);
    }

    logger.info('Users seeded successfully');
  } catch (error) {
    logger.error('Failed to seed users', { error });
    throw error;
  }
}

/**
 * Update department HoDs
 */
async function updateDepartmentHoDs(departments: SeedData['departments']): Promise<void> {
  try {
    logger.info('Updating department HoDs...');

    for (const dept of departments) {
      if (dept.hod_user_id) {
        await dbManager.executeUpdate(
          'UPDATE departments SET hod_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [dept.hod_user_id, dept.id]
        );

        logger.debug(`Updated HoD for department: ${dept.name}`);
      }
    }

    logger.info('Department HoDs updated successfully');
  } catch (error) {
    logger.error('Failed to update department HoDs', { error });
    throw error;
  }
}

/**
 * Seed sample submissions
 */
async function seedSubmissions(submissions: SeedData['submissions']): Promise<void> {
  if (!submissions) {
    logger.info('No submissions to seed');
    return;
  }

  try {
    logger.info(`Seeding ${submissions.length} sample submissions...`);

    for (const submission of submissions) {
      await dbManager.executeUpdate(
        `INSERT INTO submissions (id, user_id, module_type, status, form_data, document_url, hod_comment, admin_comment, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          submission.id,
          submission.user_id,
          submission.module_type,
          submission.status,
          JSON.stringify(submission.form_data),
          submission.document_url || null,
          submission.hod_comment || null,
          submission.admin_comment || null
        ]
      );

      logger.debug(`Seeded submission: ${submission.module_type} - ${submission.status}`);
    }

    logger.info('Sample submissions seeded successfully');
  } catch (error) {
    logger.error('Failed to seed submissions', { error });
    throw error;
  }
}

/**
 * Display seeding summary
 */
async function displaySeedingSummary(): Promise<void> {
  try {
    const departmentCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM departments');
    const userCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM users');
    const submissionCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM submissions');

    const adminUsers = await dbManager.executeQuery('SELECT employee_id, name, email FROM users WHERE role = "admin"');
    const hodUsers = await dbManager.executeQuery('SELECT employee_id, name, email FROM users WHERE role = "hod"');

    console.log('\n🎉 Database Seeding Summary:');
    console.log('================================');
    console.log(`📊 Departments: ${departmentCount?.count || 0}`);
    console.log(`👥 Users: ${userCount?.count || 0}`);
    console.log(`📝 Submissions: ${submissionCount?.count || 0}`);

    console.log('\n🔑 Admin Users:');
    adminUsers.forEach((user: any) => {
      console.log(`   • ${user.name} (${user.employee_id}) - ${user.email}`);
    });

    console.log('\n👨‍💼 HoD Users:');
    hodUsers.forEach((user: any) => {
      console.log(`   • ${user.name} (${user.employee_id}) - ${user.email}`);
    });

    console.log('\n🔐 Default Passwords:');
    console.log('   • Admin: admin123');
    console.log('   • HoD: hod123');
    console.log('   • Faculty: faculty123');

    console.log('\n⚠️  Remember to change default passwords in production!');
    console.log('================================\n');

  } catch (error) {
    logger.error('Failed to display seeding summary', { error });
  }
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'seed':
      case undefined:
        await seedDatabase();
        break;

      case 'clear':
        await dbManager.initialize();
        await clearExistingData();
        console.log('✅ Database cleared successfully');
        break;

      case 'status':
        await dbManager.initialize();
        await displaySeedingSummary();
        break;

      default:
        console.log(`
🌱 Database Seeding CLI

Usage:
  npm run seed [command] [options]

Commands:
  seed                     Seed database with default data (default)
  clear                    Clear all data from database
  status                   Show current database status

Options:
  --force                  Force overwrite existing data

Examples:
  npm run seed                    # Seed with default data
  npm run seed seed --force       # Force overwrite existing data
  npm run seed clear              # Clear all data
  npm run seed status             # Show status
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Seeding command failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

// Run CLI if this file is executed directly
if (process.argv[1] && process.argv[1].endsWith('seed-database.ts')) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { seedDatabase, DEFAULT_SEED_DATA };