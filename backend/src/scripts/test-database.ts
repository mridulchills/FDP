#!/usr/bin/env node

/**
 * Database connectivity and operations test script
 */

import { dbManager } from '../utils/database.js';
// import { logger } from '../utils/logger.js';

/**
 * Test database connectivity and basic operations
 */
async function testDatabase(): Promise<void> {
  try {
    console.log('🔍 Testing database connectivity and operations...\n');
    
    // Initialize database
    await dbManager.initialize();
    console.log('✅ Database connection established');
    
    // Test health check
    const isHealthy = await dbManager.healthCheck();
    console.log(`✅ Database health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    // Test basic query - count users
    const userCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM users');
    console.log(`✅ User count query: ${userCount?.count} users found`);
    
    // Test basic query - count departments
    const deptCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM departments');
    console.log(`✅ Department count query: ${deptCount?.count} departments found`);
    
    // Test join query - users with departments
    const usersWithDepts = await dbManager.executeQuery(`
      SELECT u.name, u.employee_id, u.role, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.role, u.name
    `);
    
    console.log(`✅ Join query: ${usersWithDepts.length} users with department info`);
    
    // Display users
    console.log('\n👥 Users in database:');
    usersWithDepts.forEach((user: any) => {
      const dept = user.department_name || 'No Department';
      console.log(`   • ${user.name} (${user.employee_id}) - ${user.role} - ${dept}`);
    });
    
    // Test transaction
    console.log('\n🔄 Testing transaction...');
    
    // Get a valid user ID first
    const firstUser = await dbManager.executeQuerySingle('SELECT id FROM users LIMIT 1');
    if (!firstUser) {
      throw new Error('No users found for transaction test');
    }
    
    await dbManager.executeTransaction(async (db) => {
      // Test insert with valid user ID
      await db.run('INSERT INTO notifications (id, user_id, message) VALUES (?, ?, ?)', 
        ['test-notification', firstUser.id, 'Test notification']);
      
      const notificationCount = await db.get('SELECT COUNT(*) as count FROM notifications');
      console.log(`   • Notification inserted, count: ${notificationCount?.count}`);
      
      // This will be committed
    });
    
    // Verify notification was inserted
    const finalNotificationCount = await dbManager.executeQuerySingle('SELECT COUNT(*) as count FROM notifications');
    console.log(`   • Final notification count: ${finalNotificationCount?.count}`);
    
    // Clean up test notification
    await dbManager.executeUpdate('DELETE FROM notifications WHERE id = ?', ['test-notification']);
    console.log('   • Test notification cleaned up');
    
    // Test database stats
    const stats = await dbManager.getStats();
    console.log('\n📊 Database Statistics:');
    console.log(`   • Active connections: ${stats.activeConnections}`);
    console.log(`   • Pool size: ${stats.poolSize}`);
    console.log(`   • Database size: ${(stats.databaseSize / 1024).toFixed(2)} KB`);
    console.log(`   • Page count: ${stats.pageCount}`);
    console.log(`   • Page size: ${stats.pageSize} bytes`);
    
    // Test foreign key constraints
    console.log('\n🔗 Testing foreign key constraints...');
    try {
      await dbManager.executeUpdate(
        'INSERT INTO users (id, employee_id, name, email, role, department_id, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['test-user', 'TEST001', 'Test User', 'test@test.com', 'faculty', 'invalid-dept-id', 'hash']
      );
      console.log('   ❌ Foreign key constraint test failed - invalid insert succeeded');
    } catch (error) {
      console.log('   ✅ Foreign key constraint working - invalid insert rejected');
    }
    
    console.log('\n🎉 All database tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error instanceof Error ? error.message : error);
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
    await testDatabase();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('test-database.ts')) {
  main();
}

export { testDatabase };