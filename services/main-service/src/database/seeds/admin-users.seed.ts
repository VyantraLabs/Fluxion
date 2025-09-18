import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Organization } from '../entities/Organization';
import { AuditLog } from '../entities/AuditLog';
import { SystemSettings } from '../entities/SystemSettings';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('AdminUserSeed');

export interface AdminUserSeedData {
  email: string;
  walletAddress: string;
  firstName?: string;
  lastName?: string;
  isSuperAdmin?: boolean;
  organizationName?: string;
}

/**
 * Seed admin users for the Fluxion system
 * This script should be run after initial system setup to create admin users
 */
export class AdminUserSeeder {
  constructor(private dataSource: DataSource) {}

  /**
   * Seed default admin users
   * This includes system super admin and regular admin users
   */
  async seedDefaultAdminUsers(): Promise<void> {
    logger.info('Starting admin user seeding process');

    try {
      // Default admin users to seed
      const defaultAdmins: AdminUserSeedData[] = [
        {
          email: 'admin@fluxion.pay',
          walletAddress: process.env.SUPER_ADMIN_WALLET || '0x0000000000000000000000000000000000000001',
          firstName: 'System',
          lastName: 'Administrator',
          isSuperAdmin: true,
          organizationName: 'Fluxion System Admin'
        },
        {
          email: 'support@fluxion.pay',
          walletAddress: process.env.SUPPORT_ADMIN_WALLET || '0x0000000000000000000000000000000000000002',
          firstName: 'Support',
          lastName: 'Team',
          isSuperAdmin: false,
          organizationName: 'Fluxion Support'
        }
      ];

      // Add custom admin users from environment variables if provided
      if (process.env.CUSTOM_ADMIN_USERS) {
        try {
          const customAdmins: AdminUserSeedData[] = JSON.parse(process.env.CUSTOM_ADMIN_USERS);
          defaultAdmins.push(...customAdmins);
        } catch (error) {
          logger.warn('Failed to parse CUSTOM_ADMIN_USERS environment variable', {
            error: error instanceof Error ? error.message : error
          });
        }
      }

      let createdCount = 0;
      let existingCount = 0;

      for (const adminData of defaultAdmins) {
        const result = await this.createAdminUser(adminData);
        if (result.created) {
          createdCount++;
        } else {
          existingCount++;
        }
      }

      logger.info('Admin user seeding completed', {
        created: createdCount,
        existing: existingCount,
        total: defaultAdmins.length
      });

    } catch (error: any) {
      logger.error('Failed to seed admin users', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create a single admin user
   */
  async createAdminUser(adminData: AdminUserSeedData): Promise<{ created: boolean; user: User }> {
    const userRepository = this.dataSource.getRepository(User);
    const organizationRepository = this.dataSource.getRepository(Organization);
    const auditLogRepository = this.dataSource.getRepository(AuditLog);

    try {
      // Check if user already exists
      let existingUser = await userRepository.findOne({
        where: { 
          walletAddress: adminData.walletAddress 
        },
        relations: ['organization']
      });

      if (existingUser) {
        // Update existing user to ensure admin privileges
        if (!existingUser.isAdmin || (adminData.isSuperAdmin && !existingUser.isSuperAdmin)) {
          existingUser.grantAdminAccess('system', adminData.isSuperAdmin || false);
          existingUser = await userRepository.save(existingUser);
          
          logger.info('Updated existing user with admin privileges', {
            userId: existingUser.id,
            email: existingUser.email,
            walletAddress: existingUser.walletAddress,
            isAdmin: existingUser.isAdmin,
            isSuperAdmin: existingUser.isSuperAdmin
          });
        }
        
        return { created: false, user: existingUser };
      }

      // Check if user exists by email
      existingUser = await userRepository.findOne({
        where: { 
          email: adminData.email 
        },
        relations: ['organization']
      });

      if (existingUser) {
        // Update wallet address and admin privileges
        existingUser.walletAddress = adminData.walletAddress;
        existingUser.grantAdminAccess('system', adminData.isSuperAdmin || false);
        existingUser = await userRepository.save(existingUser);
        
        logger.info('Updated existing user email with admin privileges', {
          userId: existingUser.id,
          email: existingUser.email,
          walletAddress: existingUser.walletAddress,
          isAdmin: existingUser.isAdmin,
          isSuperAdmin: existingUser.isSuperAdmin
        });
        
        return { created: false, user: existingUser };
      }

      // Create or find the admin organization
      let organization = await organizationRepository.findOne({
        where: { 
          name: adminData.organizationName || 'Admin Organization'
        }
      });

      if (!organization) {
        organization = organizationRepository.create({
          name: adminData.organizationName || 'Admin Organization',
          slug: this.generateSlug(adminData.organizationName || 'admin-organization'),
          settings: {
            allowUserInvites: false,
            requireEmailVerification: false,
            defaultRole: 'viewer'
          }
        });
        organization = await organizationRepository.save(organization);
        
        logger.info('Created admin organization', {
          organizationId: organization.id,
          name: organization.name
        });
      }

      // Create the admin user
      const adminUser = userRepository.create({
        email: adminData.email,
        walletAddress: adminData.walletAddress,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        organizationId: organization.id,
        role: 'owner',
        isActive: true,
        emailVerified: true,
        isAdmin: true,
        isSuperAdmin: adminData.isSuperAdmin || false,
        adminGrantedAt: new Date(),
        adminGrantedBy: 'system'
      });

      const savedUser = await userRepository.save(adminUser);

      // Create audit log for admin user creation
      const auditData = auditLogRepository.create({
        organizationId: savedUser.organizationId,
        userId: savedUser.id,
        tableName: 'users',
        recordId: savedUser.id,
        action: 'CREATE',
        newValues: {
          userId: savedUser.id,
          email: savedUser.email,
          walletAddress: savedUser.walletAddress,
          isAdmin: savedUser.isAdmin,
          isSuperAdmin: savedUser.isSuperAdmin,
          organizationId: savedUser.organizationId
        },
        adminAction: true,
        adminUserId: savedUser.id,
        severityLevel: 'critical',
        metadata: {
          source: 'system',
          reason: 'Admin user seeding process'
        }
      });

      await auditLogRepository.save(auditData);

      logger.info('Created admin user successfully', {
        userId: savedUser.id,
        email: savedUser.email,
        walletAddress: savedUser.walletAddress,
        organizationId: savedUser.organizationId,
        isAdmin: savedUser.isAdmin,
        isSuperAdmin: savedUser.isSuperAdmin
      });

      return { created: true, user: savedUser };

    } catch (error: any) {
      logger.error('Failed to create admin user', {
        error: error.message,
        adminData: {
          email: adminData.email,
          walletAddress: adminData.walletAddress,
          organizationName: adminData.organizationName
        }
      });
      throw error;
    }
  }

  /**
   * Grant admin privileges to an existing user
   */
  async grantAdminPrivileges(
    userIdentifier: string, // email or wallet address
    isSuperAdmin: boolean = false,
    grantedBy: string = 'system'
  ): Promise<User> {
    const userRepository = this.dataSource.getRepository(User);
    const auditLogRepository = this.dataSource.getRepository(AuditLog);

    try {
      // Find user by email or wallet address
      let user = await userRepository.findOne({
        where: [
          { email: userIdentifier },
          { walletAddress: userIdentifier }
        ]
      });

      if (!user) {
        throw new Error(`User not found: ${userIdentifier}`);
      }

      const oldValues = {
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        adminGrantedAt: user.adminGrantedAt,
        adminGrantedBy: user.adminGrantedBy
      };

      // Grant admin privileges
      user.grantAdminAccess(grantedBy, isSuperAdmin);
      user = await userRepository.save(user);

      // Create audit log
      const auditData = auditLogRepository.create({
        organizationId: user.organizationId,
        userId: user.id,
        tableName: 'users',
        recordId: user.id,
        action: 'UPDATE',
        oldValues,
        newValues: {
          isAdmin: user.isAdmin,
          isSuperAdmin: user.isSuperAdmin,
          adminGrantedAt: user.adminGrantedAt,
          adminGrantedBy: user.adminGrantedBy
        },
        adminAction: true,
        adminUserId: grantedBy === 'system' ? undefined : grantedBy,
        severityLevel: 'critical',
        metadata: {
          source: 'system',
          reason: 'Grant admin privileges operation'
        }
      });

      await auditLogRepository.save(auditData);

      logger.info('Admin privileges granted successfully', {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        grantedBy
      });

      return user;

    } catch (error: any) {
      logger.error('Failed to grant admin privileges', {
        error: error.message,
        userIdentifier,
        isSuperAdmin,
        grantedBy
      });
      throw error;
    }
  }

  /**
   * Revoke admin privileges from a user
   */
  async revokeAdminPrivileges(
    userIdentifier: string, // email or wallet address
    revokedBy: string = 'system'
  ): Promise<User> {
    const userRepository = this.dataSource.getRepository(User);
    const auditLogRepository = this.dataSource.getRepository(AuditLog);

    try {
      // Find user by email or wallet address
      let user = await userRepository.findOne({
        where: [
          { email: userIdentifier },
          { walletAddress: userIdentifier }
        ]
      });

      if (!user) {
        throw new Error(`User not found: ${userIdentifier}`);
      }

      if (!user.isAdmin) {
        throw new Error(`User ${userIdentifier} is not an admin`);
      }

      const oldValues = {
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        adminGrantedAt: user.adminGrantedAt,
        adminGrantedBy: user.adminGrantedBy
      };

      // Revoke admin privileges
      user.revokeAdminAccess();
      user = await userRepository.save(user);

      // Create audit log
      const auditData = auditLogRepository.create({
        organizationId: user.organizationId,
        userId: user.id,
        tableName: 'users',
        recordId: user.id,
        action: 'UPDATE',
        oldValues,
        newValues: {
          isAdmin: user.isAdmin,
          isSuperAdmin: user.isSuperAdmin,
          adminGrantedAt: user.adminGrantedAt,
          adminGrantedBy: user.adminGrantedBy
        },
        adminAction: true,
        adminUserId: revokedBy === 'system' ? undefined : revokedBy,
        severityLevel: 'critical',
        metadata: {
          source: 'system',
          reason: 'Revoke admin privileges operation'
        }
      });

      await auditLogRepository.save(auditData);

      logger.info('Admin privileges revoked successfully', {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        revokedBy
      });

      return user;

    } catch (error: any) {
      logger.error('Failed to revoke admin privileges', {
        error: error.message,
        userIdentifier,
        revokedBy
      });
      throw error;
    }
  }

  /**
   * List all admin users
   */
  async listAdminUsers(): Promise<User[]> {
    const userRepository = this.dataSource.getRepository(User);

    try {
      const adminUsers = await userRepository.find({
        where: [
          { isAdmin: true },
          { isSuperAdmin: true }
        ],
        relations: ['organization'],
        order: {
          isSuperAdmin: 'DESC',
          isAdmin: 'DESC',
          createdAt: 'ASC'
        }
      });

      logger.info('Retrieved admin users', {
        totalAdmins: adminUsers.length,
        superAdmins: adminUsers.filter(u => u.isSuperAdmin).length,
        regularAdmins: adminUsers.filter(u => u.isAdmin && !u.isSuperAdmin).length
      });

      return adminUsers;

    } catch (error: any) {
      logger.error('Failed to list admin users', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize system settings for admin functionality
   */
  async initializeSystemSettings(): Promise<void> {
    const systemSettingsRepository = this.dataSource.getRepository(SystemSettings);

    try {
      const defaultSettings = [
        SystemSettings.create(
          'admin_session_timeout_hours',
          48,
          'security',
          {
            description: 'Admin session timeout in hours (longer than regular users)',
            isPublic: false
          }
        ),
        SystemSettings.create(
          'super_admin_ip_whitelist',
          [],
          'security',
          {
            description: 'IP addresses allowed for super admin access (empty = all allowed)',
            isPublic: false
          }
        ),
        SystemSettings.create(
          'admin_notification_email',
          process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@fluxion.pay',
          'notifications',
          {
            description: 'Email address for admin notifications',
            isPublic: false
          }
        ),
        SystemSettings.create(
          'enable_admin_audit_logs',
          true,
          'security',
          {
            description: 'Enable comprehensive audit logging for admin actions',
            isPublic: false
          }
        ),
        SystemSettings.create(
          'max_failed_admin_login_attempts',
          5,
          'security',
          {
            description: 'Maximum failed admin login attempts before temporary lockout',
            isPublic: false
          }
        )
      ];

      let createdCount = 0;
      let existingCount = 0;

      for (const settingData of defaultSettings) {
        const existingSetting = await systemSettingsRepository.findOne({
          where: { key: settingData.key }
        });

        if (!existingSetting) {
          const setting = systemSettingsRepository.create(settingData);
          await systemSettingsRepository.save(setting);
          createdCount++;
          
          logger.info('Created system setting', {
            key: settingData.key,
            category: settingData.category
          });
        } else {
          existingCount++;
        }
      }

      logger.info('System settings initialization completed', {
        created: createdCount,
        existing: existingCount,
        total: defaultSettings.length
      });

    } catch (error: any) {
      logger.error('Failed to initialize system settings', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate URL-safe slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

/**
 * CLI script execution
 * Can be run directly: node -r ts-node/register admin-users.seed.ts
 */
export async function runAdminUserSeed(): Promise<void> {
  const { AppDataSource } = await import('../data-source');
  
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connection initialized for admin user seeding');
    }

    const seeder = new AdminUserSeeder(AppDataSource);
    
    // Seed default admin users
    await seeder.seedDefaultAdminUsers();
    
    // Initialize system settings
    await seeder.initializeSystemSettings();
    
    logger.info('Admin user seeding process completed successfully');
    
  } catch (error: any) {
    logger.error('Admin user seeding process failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  runAdminUserSeed()
    .then(() => {
      logger.info('Admin user seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Admin user seeding script failed', { error: error.message });
      process.exit(1);
    });
}