#!/usr/bin/env node

/**
 * Comprehensive migration verification script
 * Tests all aspects of the database migration and setup
 */

import { dbManager } from '../utils/database.js';
import { MigrationManager } from '../utils/migration-manager.js';
import { SchemaValidator } from '../utils/schema-validator.js';
// import { DatabaseInitializer } from '../utils/database-init.js';

/**
 * Comprehensive migration verification
 */
async function verifyMigration(): Promise<void> {
  console.log('🔍 Comprehensive Migration Verification\n');
  console.log('=' .repeat(50));
  
  try {
    // 1. Database Connection Test
    console.log('\n1️⃣  Testing Database Connection...');
    await dbManager.initialize();
    const isHealthy = await dbManager.healthCheck();
    console.log(`   ✅ Database connection: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    // 2. Migration Status Check
    console.log('\n2️⃣  Checking Migration Status...');
    const migrationStatus = await MigrationManager.getStatus();
    console.log(`   📊 Total migrations: ${migrationStatus.totalMigrations}`);
    console.log(`   ✅ Applied migrations: ${migrationStatus.appliedMigrations.length}`);
    console.log(`   ⏳ Pending migrations: ${migrationStatus.pendingMigrations.length}`);
    
    if (migrationStatus.pendingMigrations.length > 0) {
      console.log('   ⚠️  Warning: Pending migrations found!');
      migrationStatus.pendingMigrations.forEach(m => {
        console.log(`      • ${m.version} - ${m.description}`);
      });
    }
    
    // 3. Schema Validation
    console.log('\n3️⃣  Validating Database Schema...');
    const schemaResult = await SchemaValidator.validateSchema();
    console.log(`   ${schemaResult.valid ? '✅' : '❌'} Schema validation: ${schemaResult.valid ? 'PASSED' : 'FAILED'}`);
    console.log(`   📊 Tables found: ${schemaResult.tableInfo.length}`);
    console.log(`   ❌ Errors: ${schemaResult.errors.length}`);
    console.log(`   ⚠️  Warnings: ${schemaResult.warnings.length}`);
    
    if (schemaResult.errors.length > 0) {
      console.log('\n   Schema Errors:');
      schemaResult.errors.forEach(error => console.log(`      • ${error}`));
    }
    
    if (schemaResult.warnings.length > 0) {
      console.log('\n   Schema Warnings:');
      schemaResult.warnings.forEach(warning => console.log(`      • ${warning}`));
    }
    
    // 4. Table Structure Verification
    console.log('\n4️⃣  Verifying Table Structures...');
    const expectedTables = ['departments', 'users', 'submissions', 'notifications', 'audit_logs'];
    
    for (const tableName of expectedTables) {
      const tableInfo = schemaResult.tableInfo.find(t => t.name === tableName);
      if (tableInfo) {
        console.log(`   ✅ ${tableName}: ${tableInfo.columns.length} columns, ${tableInfo.indexes.length} indexes, ${tableInfo.foreignKeys.length} foreign keys`);
      } else {
        console.log(`   ❌ ${tableName}: TABLE MISSING`);
      }
    }
    
    // 5. Data Integrity Check
    console.log('\n5️⃣  Checking Data Integrity...');
    
    // Check foreign key constraints
    const fkCheck = await dbManager.executeQuery('PRAGMA foreign_key_check;');
    console.log(`   ${fkCheck.length === 0 ? '✅' : '❌'} Foreign key integrity: ${fkCheck.length === 0 ? 'PASSED' : 'VIOLATIONS FOUND'}`);
    
    if (fkCheck.length > 0) {
      console.log('   Foreign Key Violations:');
      fkCheck.forEach((violation: any) => {
        console.log(`      • Table: ${violation.table}, Row: ${violation.rowid}`);
      });
    }
    
    // 6. Sample Data Verification
    console.log('\n6️⃣  Verifying Sample Data...');
    
    const userCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM users');
    const deptCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM departments');
    const adminCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
    const hodCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM users WHERE role = "hod"');
    
    console.log(`   👥 Users: ${userCount?.count || 0}`);
    console.log(`   🏢 Departments: ${deptCount?.count || 0}`);
    console.log(`   🔑 Admin users: ${adminCount?.count || 0}`);
    console.log(`   👨‍💼 HoD users: ${hodCount?.count || 0}`);
    
    // 7. Authentication Test
    console.log('\n7️⃣  Testing Authentication Data...');
    
    const adminUser = await dbManager.executeQuerySingle(`
      SELECT employee_id, name, email, password_hash 
      FROM users 
      WHERE role = 'admin' 
      LIMIT 1
    `);
    
    if (adminUser) {
      console.log(`   ✅ Admin user found: ${adminUser.name} (${adminUser.employee_id})`);
      console.log(`   ✅ Password hash present: ${adminUser.password_hash ? 'YES' : 'NO'}`);
      console.log(`   ✅ Email: ${adminUser.email}`);
    } else {
      console.log('   ❌ No admin user found!');
    }
    
    // 8. Database Performance Check
    console.log('\n8️⃣  Database Performance Check...');
    
    const stats = await dbManager.getStats();
    console.log(`   📊 Database size: ${(stats.databaseSize / 1024).toFixed(2)} KB`);
    console.log(`   📄 Page count: ${stats.pageCount}`);
    console.log(`   📏 Page size: ${stats.pageSize} bytes`);
    console.log(`   🔗 Active connections: ${stats.activeConnections}`);
    console.log(`   🏊 Connection pool size: ${stats.poolSize}`);
    
    // 9. Index Verification
    console.log('\n9️⃣  Verifying Database Indexes...');
    
    const indexes = await dbManager.executeQuery(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY tbl_name, name
    `);
    
    console.log(`   📇 Custom indexes found: ${indexes.length}`);
    
    const indexesByTable: { [key: string]: number } = {};
    indexes.forEach((index: any) => {
      indexesByTable[index.tbl_name] = (indexesByTable[index.tbl_name] || 0) + 1;
    });
    
    Object.entries(indexesByTable).forEach(([table, count]) => {
      console.log(`      • ${table}: ${count} indexes`);
    });
    
    // 10. Final Verification
    console.log('\n🔟 Final Migration Verification...');
    
    const allChecks = [
      isHealthy,
      migrationStatus.pendingMigrations.length === 0,
      schemaResult.valid,
      fkCheck.length === 0,
      (userCount?.count || 0) > 0,
      (adminCount?.count || 0) > 0,
      adminUser !== undefined
    ];
    
    const passedChecks = allChecks.filter(Boolean).length;
    const totalChecks = allChecks.length;
    
    console.log(`   📊 Verification Score: ${passedChecks}/${totalChecks} checks passed`);
    
    if (passedChecks === totalChecks) {
      console.log('\n🎉 MIGRATION VERIFICATION SUCCESSFUL!');
      console.log('   All database migrations and setup completed successfully.');
      console.log('   The system is ready for use.');
    } else {
      console.log('\n⚠️  MIGRATION VERIFICATION INCOMPLETE!');
      console.log(`   ${totalChecks - passedChecks} checks failed. Please review the issues above.`);
    }
    
    console.log('\n' + '=' .repeat(50));
    
  } catch (error) {
    console.error('\n❌ Migration verification failed:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    await dbManager.close();
    console.log('\n🔌 Database connection closed');
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    await verifyMigration();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('verify-migration.ts')) {
  main();
}

export { verifyMigration };