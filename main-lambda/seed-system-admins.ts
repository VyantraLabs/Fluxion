#!/usr/bin/env ts-node

import 'reflect-metadata';
import dotenv from 'dotenv';
import { AppDataSource } from './src/database/data-source';
import seedSystemAdminUsers from './src/database/seeds/system-admin-users.seed';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting system admin users seeding...');
  
  try {
    // Initialize database connection using the app data source
    await AppDataSource.initialize();
    console.log('📦 Database connection established');
    
    // Run system admin users seed
    await seedSystemAdminUsers(AppDataSource);
    
    console.log('✅ System admin users seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ System admin users seeding failed:', error);
    process.exit(1);
  } finally {
    // Close connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('📦 Database connection closed');
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}