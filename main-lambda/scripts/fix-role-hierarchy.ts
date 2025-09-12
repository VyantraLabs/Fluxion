#!/usr/bin/env node

/**
 * Script to fix role hierarchy issues in Fluxion
 * 
 * This script:
 * 1. Ensures all users have proper RBAC roles assigned
 * 2. Synchronizes RBAC roles back to legacy User.role field
 * 3. Fixes organization owners getting 'member' role instead of 'owner'
 */

import { AppDataSource } from '../src/database/data-source';
import { RBACService } from '../src/shared/services/rbac.service';
import { User } from '../src/database/entities/User';
import { Logger } from '../src/shared/utils/logger';

const logger = new Logger('FixRoleHierarchy');

async function main() {
  logger.info('Starting role hierarchy fix...');

  try {
    // Initialize database connection
    await AppDataSource.initialize();
    logger.info('Database connection established');

    const rbacService = new RBACService(AppDataSource);
    const userRepository = AppDataSource.getRepository(User);
    
    // Get all users
    const users = await userRepository.find({
      where: { deletedAt: undefined },
      relations: ['organization']
    });

    logger.info(`Found ${users.length} users to process`);

    let processedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        logger.info(`Processing user ${user.id} (${user.walletAddress})`);

        // Check if user already has RBAC roles
        const existingRoles = await rbacService.getUserRoles(user.id, user.organizationId);
        
        if (existingRoles.length === 0) {
          // No RBAC roles - need to assign based on legacy role
          logger.info(`User ${user.id} has no RBAC roles, assigning based on legacy role: ${user.role}`);
          
          // Assign system roles if applicable
          if (user.isSuperAdmin) {
            await rbacService.assignRole(user.id, 'super_admin', undefined, user.id);
            logger.info(`Assigned super_admin role to user ${user.id}`);
          } else if (user.isAdmin) {
            await rbacService.assignRole(user.id, 'system_admin', undefined, user.id);
            logger.info(`Assigned system_admin role to user ${user.id}`);
          }

          // Assign organization role
          if (user.role === 'owner') {
            await rbacService.assignRole(user.id, 'owner', user.organizationId, user.id);
            logger.info(`Assigned owner role to user ${user.id} in organization ${user.organizationId}`);
          } else if (user.role === 'admin') {
            await rbacService.assignRole(user.id, 'admin', user.organizationId, user.id);
            logger.info(`Assigned admin role to user ${user.id} in organization ${user.organizationId}`);
          } else if (user.role === 'member') {
            await rbacService.assignRole(user.id, 'member', user.organizationId, user.id);
            logger.info(`Assigned member role to user ${user.id} in organization ${user.organizationId}`);
          } else if (user.role === 'viewer') {
            await rbacService.assignRole(user.id, 'viewer', user.organizationId, user.id);
            logger.info(`Assigned viewer role to user ${user.id} in organization ${user.organizationId}`);
          } else {
            // Default to member role
            await rbacService.assignRole(user.id, 'member', user.organizationId, user.id);
            logger.info(`Assigned default member role to user ${user.id} in organization ${user.organizationId}`);
          }
        } else {
          logger.info(`User ${user.id} already has ${existingRoles.length} RBAC roles`);
        }

        // Always sync legacy role from RBAC
        await rbacService.syncUserLegacyRole(user.id, user.organizationId);
        logger.info(`Synchronized legacy role for user ${user.id}`);

        processedCount++;

      } catch (error: any) {
        logger.error(`Failed to process user ${user.id}`, {
          error: error.message,
          userId: user.id,
          walletAddress: user.walletAddress
        });
        errorCount++;
      }
    }

    logger.info('Role hierarchy fix completed', {
      totalUsers: users.length,
      processed: processedCount,
      errors: errorCount
    });

    // Verify some users to ensure fix worked
    logger.info('Verifying fix with sample users...');
    
    const sampleUsers = users.slice(0, 3);
    for (const user of sampleUsers) {
      const userRoles = await rbacService.getUserRoles(user.id, user.organizationId);
      const highestRole = await rbacService.getUserHighestRole(user.id, user.organizationId);
      
      logger.info(`User ${user.id} verification`, {
        walletAddress: user.walletAddress,
        legacyRole: user.role,
        rbacRoles: userRoles.map(ur => ur.role.key),
        highestRole,
        organizationId: user.organizationId
      });
    }

  } catch (error: any) {
    logger.error('Role hierarchy fix failed', { error: error.message });
    throw error;
  } finally {
    await AppDataSource.destroy();
    logger.info('Database connection closed');
  }
}

if (require.main === module) {
  main()
    .then(() => {
      logger.info('Role hierarchy fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Role hierarchy fix failed', { error: error.message });
      process.exit(1);
    });
}

export { main };