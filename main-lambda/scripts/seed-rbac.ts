#!/usr/bin/env ts-node

import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';
import { RBACSystemSeed } from '../src/database/seeds/rbac-system.seed';
import { Logger } from '../src/shared/utils/logger';

const logger = new Logger('SeedRBAC');

async function main() {
  try {
    logger.info('Starting RBAC system initialization...');
    
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connection initialized');
    }
    
    // Run RBAC system seed
    const rbacSeeder = new RBACSystemSeed(AppDataSource);
    await rbacSeeder.run();
    
    logger.info('RBAC system initialization completed successfully');
    process.exit(0);
    
  } catch (error: any) {
    logger.error('RBAC system initialization failed', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}