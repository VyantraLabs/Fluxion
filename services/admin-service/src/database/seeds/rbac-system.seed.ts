import { DataSource, IsNull } from 'typeorm';
import { Logger } from '../../shared/utils/logger';
import { RBACService } from '../../shared/services/rbac.service';
import { Role, SystemRoleKey, OrganizationRoleKey } from '../entities/Role';
import { UserRole } from '../entities/UserRole';
import { User } from '../entities/User';

const logger = new Logger('RBACSystemSeed');

export class RBACSystemSeed {
  constructor(private dataSource: DataSource) {}

  async run(): Promise<void> {
    logger.info('Starting RBAC system seed...');

    try {
      const rbacService = new RBACService(this.dataSource);

      // Initialize the complete RBAC system
      await rbacService.initializeRBACSystem();

      // Migrate existing users to RBAC system
      await this.migrateExistingUsers(rbacService);

      // Create default system admin if none exists
      await this.ensureSystemAdmin(rbacService);

      logger.info('RBAC system seed completed successfully');

    } catch (error: any) {
      logger.error('RBAC system seed failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate existing users from legacy role system to RBAC
   */
  private async migrateExistingUsers(rbacService: RBACService): Promise<void> {
    logger.info('Migrating existing users to RBAC system...');

    const userRepository = this.dataSource.getRepository(User);
    
    // Get all users that don't have RBAC roles yet
    const users = await userRepository.createQueryBuilder('user')
      .leftJoin('user.userRoles', 'userRole')
      .where('userRole.id IS NULL') // Users without any roles
      .andWhere('user.deletedAt IS NULL')
      .getMany();

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        await this.migrateUser(user, rbacService);
        migratedCount++;
      } catch (error: any) {
        logger.error('Failed to migrate user', {
          userId: user.id,
          walletAddress: user.walletAddress,
          error: error.message
        });
        errorCount++;
      }
    }

    logger.info('User migration completed', {
      totalUsers: users.length,
      migrated: migratedCount,
      errors: errorCount
    });
  }

  /**
   * Migrate individual user to RBAC system
   */
  private async migrateUser(user: User, rbacService: RBACService): Promise<void> {
    const roles: string[] = [];

    // Migrate system-level admin roles
    if (user.isSuperAdmin) {
      roles.push(SystemRoleKey.SUPER_ADMIN);
    } else if (user.isAdmin) {
      roles.push(SystemRoleKey.SYSTEM_ADMIN);
    }

    // Migrate organization role
    const orgRole = this.mapLegacyRoleToRBAC(user.role);
    if (orgRole) {
      roles.push(orgRole);
    }

    // Assign roles
    for (const roleKey of roles) {
      try {
        if (roleKey === SystemRoleKey.SUPER_ADMIN || roleKey === SystemRoleKey.SYSTEM_ADMIN) {
          // System roles don't have organization context
          await rbacService.assignRole(
            user.id,
            roleKey,
            undefined,
            user.id // Self-granted during migration
          );
        } else {
          // Organization roles need organization context
          await rbacService.assignRole(
            user.id,
            roleKey,
            user.organizationId,
            user.id // Self-granted during migration
          );
        }

        logger.debug('Assigned role to user', {
          userId: user.id,
          roleKey,
          organizationId: user.organizationId
        });
      } catch (error: any) {
        // Log but don't fail - role might already exist
        logger.warn('Failed to assign role during migration', {
          userId: user.id,
          roleKey,
          error: error.message
        });
      }
    }

    if (roles.length === 0) {
      // Give default member role to users without explicit roles
      await rbacService.assignRole(
        user.id,
        OrganizationRoleKey.MEMBER,
        user.organizationId,
        user.id
      );

      logger.debug('Assigned default member role', {
        userId: user.id,
        organizationId: user.organizationId
      });
    }
  }

  /**
   * Ensure there's at least one system administrator
   */
  private async ensureSystemAdmin(rbacService: RBACService): Promise<void> {
    const userRoleRepository = this.dataSource.getRepository(UserRole);
    const roleRepository = this.dataSource.getRepository(Role);

    // Check if any super admin exists
    const superAdminRole = await roleRepository.findOne({
      where: { key: SystemRoleKey.SUPER_ADMIN }
    });

    if (!superAdminRole) {
      logger.error('Super admin role not found - RBAC system may not be initialized properly');
      return;
    }

    const existingSuperAdmin = await userRoleRepository.findOne({
      where: {
        roleId: superAdminRole.id,
        isActive: true,
        deletedAt: IsNull()
      }
    });

    if (existingSuperAdmin) {
      logger.info('System admin already exists', {
        userId: existingSuperAdmin.userId
      });
      return;
    }

    // Find the first organization owner to promote to system admin
    const orgOwnerRole = await roleRepository.findOne({
      where: { key: OrganizationRoleKey.OWNER }
    });

    if (orgOwnerRole) {
      const firstOwner = await userRoleRepository.findOne({
        where: {
          roleId: orgOwnerRole.id,
          isActive: true,
          deletedAt: IsNull()
        },
        relations: ['user']
      });

      if (firstOwner) {
        // Promote first organization owner to super admin
        await rbacService.assignRole(
          firstOwner.userId,
          SystemRoleKey.SUPER_ADMIN,
          undefined,
          firstOwner.userId
        );

        logger.info('Promoted first organization owner to super admin', {
          userId: firstOwner.userId
        });
        return;
      }
    }

    logger.warn('No suitable candidate found for system admin promotion');
  }

  /**
   * Map legacy role to new RBAC role
   */
  private mapLegacyRoleToRBAC(legacyRole: string): OrganizationRoleKey | null {
    const roleMap: Record<string, OrganizationRoleKey> = {
      'owner': OrganizationRoleKey.OWNER,
      'admin': OrganizationRoleKey.ADMIN,
      'member': OrganizationRoleKey.MEMBER,
      'viewer': OrganizationRoleKey.VIEWER
    };

    return roleMap[legacyRole] || null;
  }
}

export default async function seed(dataSource: DataSource): Promise<void> {
  const seeder = new RBACSystemSeed(dataSource);
  await seeder.run();
}