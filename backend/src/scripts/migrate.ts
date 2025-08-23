#!/usr/bin/env node

/**
 * Database migration CLI script
 * Usage:
 *   npm run migrate                    # Run all pending migrations
 *   npm run migrate status             # Show migration status
 *   npm run migrate create <name>      # Create new migration
 *   npm run migrate rollback           # Rollback last migration
 *   npm run migrate validate           # Validate migration integrity
 *   npm run migrate schema             # Validate database schema
 */

import { MigrationManager } from '../utils/migration-manager.js';
import { SchemaValidator } from '../utils/schema-validator.js';
import { dbManager } from '../utils/database.js';

/**
 * Main CLI function
 */
async function main() {
  const command = process.argv[2] || 'migrate';
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await runMigrations();
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'create':
        if (!arg) {
          console.error('Error: Migration description is required');
          console.log('Usage: npm run migrate create "description"');
          process.exit(1);
        }
        await createMigration(arg);
        break;
        
      case 'rollback':
      case 'down':
        await rollbackMigration();
        break;
        
      case 'validate':
        await validateMigrations();
        break;
        
      case 'schema':
        await validateSchema();
        break;
        
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('Migration command failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  console.log('🚀 Running database migrations...\n');
  
  const results = await MigrationManager.migrate();
  
  if (results.length === 0) {
    console.log('✅ No pending migrations found. Database is up to date.');
    return;
  }
  
  console.log(`📊 Migration Results:\n`);
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    
    console.log(`${status} ${result.version} - ${result.description} (${duration})`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n📈 Summary: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    throw new Error(`${failed} migrations failed`);
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  console.log('📋 Migration Status:\n');
  
  const status = await MigrationManager.getStatus();
  
  console.log(`Total migrations: ${status.totalMigrations}`);
  console.log(`Applied: ${status.appliedMigrations.length}`);
  console.log(`Pending: ${status.pendingMigrations.length}\n`);
  
  if (status.appliedMigrations.length > 0) {
    console.log('✅ Applied Migrations:');
    for (const migration of status.appliedMigrations) {
      console.log(`   ${migration.version} - ${migration.description} (${migration.applied_at})`);
    }
    console.log();
  }
  
  if (status.pendingMigrations.length > 0) {
    console.log('⏳ Pending Migrations:');
    for (const migration of status.pendingMigrations) {
      console.log(`   ${migration.version} - ${migration.description}`);
    }
    console.log();
  }
}

/**
 * Create a new migration
 */
async function createMigration(description: string) {
  console.log(`📝 Creating new migration: ${description}\n`);
  
  const filename = await MigrationManager.createMigration(description);
  
  console.log(`✅ Migration created: ${filename}`);
  console.log(`📁 Location: src/migrations/${filename}`);
  console.log('\n💡 Edit the migration file to add your SQL statements, then run:');
  console.log('   npm run migrate');
}

/**
 * Rollback the last migration
 */
async function rollbackMigration() {
  console.log('⚠️  Rolling back last migration...\n');
  
  await MigrationManager.rollback();
  
  console.log('✅ Migration rolled back successfully');
  console.log('⚠️  Note: Schema changes were not automatically reverted.');
  console.log('   Manual cleanup may be required.');
}

/**
 * Validate migration integrity
 */
async function validateMigrations() {
  console.log('🔍 Validating migration integrity...\n');
  
  const result = await MigrationManager.validateMigrations();
  
  if (result.valid) {
    console.log('✅ Migration integrity validation passed');
  } else {
    console.log('❌ Migration integrity validation failed\n');
    
    console.log('Issues found:');
    for (const issue of result.issues) {
      console.log(`   • ${issue}`);
    }
    
    throw new Error('Migration integrity validation failed');
  }
}

/**
 * Validate database schema
 */
async function validateSchema() {
  console.log('🔍 Validating database schema...\n');
  
  const result = await SchemaValidator.validateSchema();
  
  if (result.valid) {
    console.log('✅ Schema validation passed');
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const warning of result.warnings) {
        console.log(`   • ${warning}`);
      }
    }
  } else {
    console.log('❌ Schema validation failed\n');
    
    console.log('Errors:');
    for (const error of result.errors) {
      console.log(`   • ${error}`);
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const warning of result.warnings) {
        console.log(`   • ${warning}`);
      }
    }
    
    throw new Error('Schema validation failed');
  }
  
  console.log(`\n📊 Schema Summary:`);
  console.log(`   Tables: ${result.tableInfo.length}`);
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Warnings: ${result.warnings.length}`);
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🗄️  Database Migration CLI

Usage:
  npm run migrate [command] [options]

Commands:
  migrate, up              Run all pending migrations (default)
  status                   Show migration status
  create <description>     Create a new migration file
  rollback, down          Rollback the last applied migration
  validate                Validate migration integrity
  schema                  Validate database schema

Examples:
  npm run migrate                           # Run migrations
  npm run migrate status                    # Show status
  npm run migrate create "Add user roles"  # Create migration
  npm run migrate rollback                  # Rollback last migration
  npm run migrate validate                  # Validate migrations
  npm run migrate schema                    # Validate schema

For more information, see the documentation.
`);
}

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});