#!/usr/bin/env node

/**
 * Complete Role Synchronization Fix for Fluxion
 * 
 * This script ensures perfect synchronization between:
 * 1. RBAC roles (user_roles table)
 * 2. Legacy role field (users.role)
 * 3. Admin flags (users.is_admin, users.is_super_admin)
 */

import { AppDataSource } from '../src/database/data-source';
import { RBACService } from '../src/shared/services/rbac.service';
import { User } from '../src/database/entities/User';
import { Logger } from '../src/shared/utils/logger';

const logger = new Logger('CompleteRoleSync');

async function main() {
  logger.info('Starting complete role synchronization...');

  try {
    // Initialize database connection
    await AppDataSource.initialize();
    logger.info('Database connection established');

    const rbacService = new RBACService(AppDataSource);
    const userRepository = AppDataSource.getRepository(User);
    
    // Get all users
    const users = await userRepository.find({
      where: { deletedAt: undefined }
    });

    logger.info(`Found ${users.length} users to synchronize`);

    let processedCount = 0;
    let fixedCount = 0;

    for (const user of users) {
      try {
        logger.info(`Processing user ${user.id} (${user.walletAddress})`);

        // Get user's RBAC roles
        const systemRoles = await rbacService.getUserRoles(user.id);
        const orgRoles = await rbacService.getUserRoles(user.id, user.organizationId);
        
        const allRoles = [...systemRoles, ...orgRoles];
        logger.info(`User has ${allRoles.length} RBAC roles: ${allRoles.map(r => r.role.key).join(', ')}`);

        // Determine correct admin flags based on RBAC roles
        const hasSuperAdminRole = allRoles.some(ur => ur.role.key === 'super_admin');
        const hasSystemAdminRole = allRoles.some(ur => ur.role.key === 'system_admin');
        const hasAdminRole = allRoles.some(ur => ur.role.key === 'admin');
        
        // Determine correct legacy role based on highest priority organization role
        const orgRolesByPriority = orgRoles
          .filter(ur => ['owner', 'admin', 'member', 'viewer'].includes(ur.role.key))
          .sort((a, b) => (b.role.priority || 0) - (a.role.priority || 0));
        
        const correctLegacyRole = orgRolesByPriority.length > 0 
          ? orgRolesByPriority[0].role.key 
          : 'member';

        // Calculate what the correct flags should be
        const correctIsSuperAdmin = hasSuperAdminRole;
        const correctIsAdmin = hasSuperAdminRole || hasSystemAdminRole || hasAdminRole;
        const correctRole = correctLegacyRole;

        // Check if user needs updates
        const needsUpdate = 
          user.isSuperAdmin !== correctIsSuperAdmin ||
          user.isAdmin !== correctIsAdmin ||
          user.role !== correctRole;

        if (needsUpdate) {
          logger.info(`User ${user.id} needs synchronization:`, {
            current: {
              role: user.role,
              is_admin: user.isAdmin,
              is_super_admin: user.isSuperAdmin
            },
            correct: {
              role: correctRole,
              is_admin: correctIsAdmin,
              is_super_admin: correctIsSuperAdmin
            },
            rbac_roles: allRoles.map(r => r.role.key)
          });

          // Update user flags
          await userRepository.update(user.id, {
            role: correctRole as any,
            isAdmin: correctIsAdmin,
            isSuperAdmin: correctIsSuperAdmin,
            // Update admin granted timestamp if becoming admin
            adminGrantedAt: correctIsAdmin && !user.adminGrantedAt ? new Date() : user.adminGrantedAt,
            adminGrantedBy: correctIsAdmin && !user.adminGrantedBy ? 'system_sync' : user.adminGrantedBy,
          });

          logger.info(`✅ Updated user ${user.id} role synchronization`);
          fixedCount++;
        } else {
          logger.info(`✅ User ${user.id} is already correctly synchronized`);
        }

        processedCount++;

      } catch (error: any) {
        logger.error(`Failed to process user ${user.id}`, {
          error: error.message,
          userId: user.id,
          walletAddress: user.walletAddress
        });
      }
    }

    logger.info('Complete role synchronization finished', {
      totalUsers: users.length,
      processed: processedCount,
      fixed: fixedCount,
      alreadyCorrect: processedCount - fixedCount
    });

    // Verify the synchronization worked
    logger.info('Verifying synchronization results...');
    
    const verifyUsers = await userRepository.find({
      where: { deletedAt: undefined }
    });

    for (const user of verifyUsers.slice(0, 4)) { // Check first 4 users
      const systemRoles = await rbacService.getUserRoles(user.id);
      const orgRoles = await rbacService.getUserRoles(user.id, user.organizationId);
      const allRoles = [...systemRoles, ...orgRoles];
      
      logger.info(`Verification - User ${user.id}:`, {
        walletAddress: user.walletAddress,
        database_flags: {
          role: user.role,
          is_admin: user.isAdmin,
          is_super_admin: user.isSuperAdmin
        },
        rbac_roles: allRoles.map(r => r.role.key),
        admin_granted: {
          at: user.adminGrantedAt,
          by: user.adminGrantedBy
        }
      });
    }

  } catch (error: any) {
    logger.error('Complete role synchronization failed', { error: error.message });
    throw error;
  } finally {
    await AppDataSource.destroy();
    logger.info('Database connection closed');
  }
}

if (require.main === module) {
  main()
    .then(() => {
      logger.info('🎉 Complete role synchronization completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Complete role synchronization failed', { error: error.message });
      process.exit(1);
    });
}

export { main };