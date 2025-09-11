import { DataSource } from 'typeorm';
import { User } from '@/database/entities/User';
import { Organization } from '@/database/entities/Organization';
import { RBACService } from '@/shared/services/rbac.service';
import { SystemRoleKey, OrganizationRoleKey } from '@/database/entities/Role';
import { Logger } from '@/shared/utils/logger';
import { ulid } from 'ulid';

const logger = new Logger('SystemAdminUserSeed');

export interface SystemAdminUserData {
  email: string;
  walletAddress: string;
  displayName: string;
  systemRoles: SystemRoleKey[];
  organizationRole?: OrganizationRoleKey;
  organizationName?: string;
}

/**
 * Seed system admin users with proper RBAC roles
 */
export class SystemAdminUserSeeder {
  private rbacService: RBACService;

  constructor(private dataSource: DataSource) {
    this.rbacService = new RBACService();
  }

  /**
   * Seed system admin users
   */
  async seedSystemAdminUsers(): Promise<void> {
    logger.info('Starting system admin user seeding process');

    try {
      // Ensure RBAC system is initialized first
      await this.rbacService.initializeRBACSystem();

      // System admin users to seed
      const systemAdmins: SystemAdminUserData[] = [
        {
          email: 'super.admin@fluxion.pay',
          walletAddress: process.env.SUPER_ADMIN_WALLET || '0x742d35Cc6486C3e1Bd8E7D3dCF0a5c6D5C5F5e5A',
          displayName: 'System Super Administrator',
          systemRoles: [SystemRoleKey.SUPER_ADMIN],
          organizationRole: OrganizationRoleKey.OWNER,
          organizationName: 'Fluxion System Admin Org'
        },
        {
          email: 'system.admin@fluxion.pay',
          walletAddress: process.env.SYSTEM_ADMIN_WALLET || '0x8b5D7b5C9c5F5e5A5a4d3c2b1a9b8c7d6e5f4a3b',
          displayName: 'System Administrator',
          systemRoles: [SystemRoleKey.SYSTEM_ADMIN],
          organizationRole: OrganizationRoleKey.ADMIN,
          organizationName: 'Fluxion System Admin Org'
        },
        {
          email: 'support@fluxion.pay',
          walletAddress: process.env.SUPPORT_ADMIN_WALLET || '0x9c6E8c6d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c',
          displayName: 'Support Team Lead',
          systemRoles: [SystemRoleKey.SUPPORT_AGENT],
          organizationRole: OrganizationRoleKey.MEMBER,
          organizationName: 'Fluxion Support Org'
        },
        {
          email: 'moderator@fluxion.pay',
          walletAddress: process.env.MODERATOR_ADMIN_WALLET || '0xa7d9d7e8f7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2',
          displayName: 'Content Moderator',
          systemRoles: [SystemRoleKey.SUPPORT_AGENT], // Using support agent role for now
          organizationRole: OrganizationRoleKey.MEMBER,
          organizationName: 'Fluxion Moderation Team'
        }
      ];

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const adminData of systemAdmins) {
        try {
          const result = await this.createSystemAdminUser(adminData);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
          else if (result === 'skipped') skipped++;
        } catch (error: any) {
          logger.error('Failed to process system admin user', {
            email: adminData.email,
            walletAddress: adminData.walletAddress,
            error: error.message
          });
        }
      }

      logger.info('System admin user seeding completed', {
        created,
        updated,
        skipped,
        total: systemAdmins.length
      });

    } catch (error: any) {
      logger.error('System admin user seeding failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create or update a system admin user
   */
  private async createSystemAdminUser(adminData: SystemAdminUserData): Promise<'created' | 'updated' | 'skipped'> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find or create organization
      let organization: Organization;
      const orgRepository = queryRunner.manager.getRepository(Organization);
      
      const existingOrg = await orgRepository.findOne({
        where: { name: adminData.organizationName || 'System Admin Organization' }
      });

      if (existingOrg) {
        organization = existingOrg;
      } else {
        organization = orgRepository.create({
          id: ulid(),
          name: adminData.organizationName || 'System Admin Organization',
          slug: this.generateSlug(adminData.organizationName || 'system-admin-organization'),
          plan: 'enterprise',
          settings: {
            allowInvites: false,
            requireTwoFactor: true,
            sessionTimeout: 480 // 8 hours
          }
        });
        organization = await orgRepository.save(organization);
        logger.info('Created system admin organization', {
          orgId: organization.id,
          name: organization.name
        });
      }

      // 2. Find or create user
      const userRepository = queryRunner.manager.getRepository(User);
      let user = await userRepository.findOne({
        where: { walletAddress: adminData.walletAddress }
      });

      let userAction: 'created' | 'updated' | 'skipped' = 'skipped';

      if (!user) {
        // Create new user
        user = userRepository.create({
          id: ulid(),
          walletAddress: adminData.walletAddress,
          email: adminData.email,
          organizationId: organization.id,
          firstName: adminData.displayName.split(' ')[0],
          lastName: adminData.displayName.split(' ').slice(1).join(' ') || undefined,
          role: 'owner', // Legacy role
          isActive: true,
          emailVerified: true,
          // Legacy fields for backward compatibility
          isAdmin: true,
          isSuperAdmin: adminData.systemRoles.includes(SystemRoleKey.SUPER_ADMIN)
        });
        
        user = await userRepository.save(user);
        userAction = 'created';
        
        logger.info('Created system admin user', {
          userId: user.id,
          email: user.email,
          walletAddress: user.walletAddress
        });
      } else {
        // Update existing user
        user.email = adminData.email;
        user.firstName = adminData.displayName.split(' ')[0];
        user.lastName = adminData.displayName.split(' ').slice(1).join(' ') || undefined;
        user.organizationId = organization.id;
        user.isAdmin = true;
        user.isSuperAdmin = adminData.systemRoles.includes(SystemRoleKey.SUPER_ADMIN);
        
        user = await userRepository.save(user);
        userAction = 'updated';
        
        logger.info('Updated system admin user', {
          userId: user.id,
          email: user.email,
          walletAddress: user.walletAddress
        });
      }

      // 3. Assign system roles using RBAC service
      for (const systemRole of adminData.systemRoles) {
        try {
          await this.rbacService.assignRole(
            user.id,
            systemRole,
            undefined, // System roles don't have organization context
            user.id // Self-assigned during seeding
          );
          
          logger.debug('Assigned system role', {
            userId: user.id,
            role: systemRole
          });
        } catch (error: any) {
          // Role might already be assigned
          logger.warn('Failed to assign system role (might already exist)', {
            userId: user.id,
            role: systemRole,
            error: error.message
          });
        }
      }

      // 4. Assign organization role if specified
      if (adminData.organizationRole) {
        try {
          await this.rbacService.assignRole(
            user.id,
            adminData.organizationRole,
            organization.id,
            user.id
          );
          
          logger.debug('Assigned organization role', {
            userId: user.id,
            role: adminData.organizationRole,
            organizationId: organization.id
          });
        } catch (error: any) {
          logger.warn('Failed to assign organization role', {
            userId: user.id,
            role: adminData.organizationRole,
            organizationId: organization.id,
            error: error.message
          });
        }
      }

      await queryRunner.commitTransaction();
      
      logger.info('Successfully processed system admin user', {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        systemRoles: adminData.systemRoles,
        organizationRole: adminData.organizationRole,
        organizationId: organization.id,
        action: userAction
      });

      return userAction;

    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      logger.error('Failed to create/update system admin user', {
        email: adminData.email,
        walletAddress: adminData.walletAddress,
        error: error.message
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate URL-friendly slug
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}

/**
 * Export function for seeding system admin users
 */
export default async function seedSystemAdminUsers(dataSource: DataSource): Promise<void> {
  const seeder = new SystemAdminUserSeeder(dataSource);
  await seeder.seedSystemAdminUsers();
}