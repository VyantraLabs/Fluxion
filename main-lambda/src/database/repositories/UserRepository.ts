import { FindOptionsWhere } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { User } from '../entities/User';
import { Role, RoleType } from '../entities/Role';
import { UserRole } from '../entities/UserRole';
import { TenantContext, FluxionError, ErrorCodes } from '@/types/common';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User, 'User');
  }

  /**
   * Find user by email within organization
   */
  async findByEmail(tenantContext: TenantContext, email: string): Promise<User | null> {
    await this.setTenantContext(tenantContext);
    
    try {
      const user = await this.repository.findOne({
        where: {
          email,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<User>,
      });
      
      this.logger.debug('User search by email', { 
        email, 
        found: !!user,
        tenantId: tenantContext.tenantId,
      });
      
      return user;
    } catch (error: any) {
      this.logger.error('Failed to find user by email', { 
        error: error.message, 
        email,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find user by email',
        500,
        error
      );
    }
  }

  /**
   * Find user by wallet address within organization
   */
  async findByWalletAddress(tenantContext: TenantContext, walletAddress: string): Promise<User | null> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Use case-insensitive search for wallet addresses
      const user = await this.repository
        .createQueryBuilder('user')
        .where('LOWER(user.walletAddress) = LOWER(:walletAddress)', { walletAddress })
        .andWhere('user.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
        .getOne();
      
      this.logger.debug('User search by wallet address', { 
        walletAddress, 
        found: !!user,
        tenantId: tenantContext.tenantId,
      });
      
      return user;
    } catch (error: any) {
      this.logger.error('Failed to find user by wallet address', { 
        error: error.message, 
        walletAddress,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find user by wallet address',
        500,
        error
      );
    }
  }

  /**
   * Find active users in organization
   */
  async findActiveUsers(tenantContext: TenantContext): Promise<User[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const users = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          isActive: true,
        } as FindOptionsWhere<User>,
        order: {
          firstName: 'ASC',
          lastName: 'ASC',
        },
      });
      
      this.logger.debug('Active users retrieved', { 
        count: users.length,
        tenantId: tenantContext.tenantId,
      });
      
      return users;
    } catch (error: any) {
      this.logger.error('Failed to find active users', { 
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find active users',
        500,
        error
      );
    }
  }

  /**
   * Find users by role within organization
   */
  async findByRole(tenantContext: TenantContext, role: string): Promise<User[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const users = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          role,
          isActive: true,
        } as FindOptionsWhere<User>,
        order: {
          firstName: 'ASC',
          lastName: 'ASC',
        },
      });
      
      this.logger.debug('Users by role retrieved', { 
        role,
        count: users.length,
        tenantId: tenantContext.tenantId,
      });
      
      return users;
    } catch (error: any) {
      this.logger.error('Failed to find users by role', { 
        error: error.message,
        role,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find users by role',
        500,
        error
      );
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(tenantContext: TenantContext, userId: string): Promise<void> {
    await this.setTenantContext(tenantContext);
    
    try {
      await this.repository.update(
        {
          id: userId,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<User>,
        {
          lastLoginAt: new Date(),
        }
      );
      
      this.logger.debug('User last login updated', { 
        userId,
        tenantId: tenantContext.tenantId,
      });
    } catch (error: any) {
      this.logger.error('Failed to update user last login', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update user last login',
        500,
        error
      );
    }
  }

  /**
   * Check if email is already in use within organization
   */
  async isEmailInUse(tenantContext: TenantContext, email: string, excludeUserId?: string): Promise<boolean> {
    await this.setTenantContext(tenantContext);
    
    try {
      const where: FindOptionsWhere<User> = {
        email,
        organizationId: tenantContext.tenantId,
      } as FindOptionsWhere<User>;

      if (excludeUserId) {
        where.id = { $ne: excludeUserId } as any;
      }

      const exists = await this.repository.exist({ where });
      
      this.logger.debug('Email usage check', { 
        email,
        inUse: exists,
        excludeUserId,
        tenantId: tenantContext.tenantId,
      });
      
      return exists;
    } catch (error: any) {
      this.logger.error('Failed to check email usage', { 
        error: error.message,
        email,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to check email usage',
        500,
        error
      );
    }
  }

  /**
   * Check if wallet address is already in use within organization
   */
  async isWalletInUse(tenantContext: TenantContext, walletAddress: string, excludeUserId?: string): Promise<boolean> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Use case-insensitive search for wallet addresses
      let queryBuilder = this.repository
        .createQueryBuilder('user')
        .where('LOWER(user.walletAddress) = LOWER(:walletAddress)', { walletAddress })
        .andWhere('user.organizationId = :organizationId', { organizationId: tenantContext.tenantId });

      if (excludeUserId) {
        queryBuilder = queryBuilder.andWhere('user.id != :excludeUserId', { excludeUserId });
      }

      const exists = await queryBuilder.getCount() > 0;
      
      this.logger.debug('Wallet address usage check', { 
        walletAddress,
        inUse: exists,
        excludeUserId,
        tenantId: tenantContext.tenantId,
      });
      
      return exists;
    } catch (error: any) {
      this.logger.error('Failed to check wallet usage', { 
        error: error.message,
        walletAddress,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to check wallet usage',
        500,
        error
      );
    }
  }

  /**
   * Find users with recent activity
   */
  async findRecentlyActive(tenantContext: TenantContext, daysAgo = 30): Promise<User[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      const users = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          isActive: true,
          lastLoginAt: { $gte: cutoffDate } as any,
        } as FindOptionsWhere<User>,
        order: {
          lastLoginAt: 'DESC',
        },
      });
      
      this.logger.debug('Recently active users retrieved', { 
        daysAgo,
        count: users.length,
        tenantId: tenantContext.tenantId,
      });
      
      return users;
    } catch (error: any) {
      this.logger.error('Failed to find recently active users', { 
        error: error.message,
        daysAgo,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find recently active users',
        500,
        error
      );
    }
  }

  /**
   * Get user statistics for organization
   */
  async getUserStats(tenantContext: TenantContext): Promise<{
    total: number;
    active: number;
    inactive: number;
    verified: number;
    unverified: number;
    byRole: Record<string, number>;
  }> {
    await this.setTenantContext(tenantContext);
    
    try {
      const [total, active, verified] = await Promise.all([
        this.repository.count({
          where: { organizationId: tenantContext.tenantId } as FindOptionsWhere<User>,
        }),
        this.repository.count({
          where: { 
            organizationId: tenantContext.tenantId,
            isActive: true,
          } as FindOptionsWhere<User>,
        }),
        this.repository.count({
          where: { 
            organizationId: tenantContext.tenantId,
            emailVerified: true,
          } as FindOptionsWhere<User>,
        }),
      ]);

      // Get role distribution
      const roleQuery = await this.repository
        .createQueryBuilder('user')
        .select('user.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where('user.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
        .groupBy('user.role')
        .getRawMany();

      const byRole: Record<string, number> = {};
      roleQuery.forEach(row => {
        byRole[row.role] = parseInt(row.count);
      });

      const stats = {
        total,
        active,
        inactive: total - active,
        verified,
        unverified: total - verified,
        byRole,
      };
      
      this.logger.debug('User statistics retrieved', { 
        stats,
        tenantId: tenantContext.tenantId,
      });
      
      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get user statistics', { 
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get user statistics',
        500,
        error
      );
    }
  }

  /**
   * Find user by wallet address across ALL organizations (for authentication)
   * This bypasses tenant isolation for cross-tenant user lookup
   */
  async findByWalletAddressGlobal(walletAddress: string): Promise<{
    id: string;
    organizationId: string;
    email: string;
    walletAddress: string;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    emailVerified: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{
      key: string;
      type: string;
      organizationId?: string;
    }>;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
  } | null> {
    try {
      const result = await this.query(`
        SELECT 
          u.id as user_id,
          u.organization_id,
          u.email,
          u.wallet_address,
          u.first_name,
          u.last_name,
          u.is_active,
          u.email_verified,
          u.last_login_at,
          u.created_at as user_created_at,
          u.updated_at as user_updated_at,
          o.id as org_id,
          o.name as org_name,
          o.slug as org_slug,
          COALESCE(
            json_agg(
              json_build_object(
                'key', r.key,
                'type', r.type,
                'organizationId', ur.organization_id
              )
            ) FILTER (WHERE r.id IS NOT NULL), 
            '[]'::json
          ) as roles
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true AND ur.deleted_at IS NULL
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true AND r.deleted_at IS NULL
        WHERE LOWER(u.wallet_address) = LOWER($1) 
        AND u.deleted_at IS NULL 
        AND o.deleted_at IS NULL
        GROUP BY u.id, o.id
        LIMIT 1
      `, [walletAddress]);

      if (!result || result.length === 0) {
        this.logger.debug('User not found in global wallet search', { walletAddress });
        return null;
      }

      const userData = result[0];
      
      this.logger.info('User found via global wallet search', { 
        walletAddress, 
        userId: userData.user_id,
        organizationId: userData.organization_id,
        organizationName: userData.org_name,
        rolesCount: userData.roles?.length || 0
      });

      return {
        id: userData.user_id,
        organizationId: userData.organization_id,
        email: userData.email,
        walletAddress: userData.wallet_address,
        firstName: userData.first_name,
        lastName: userData.last_name,
        isActive: userData.is_active,
        emailVerified: userData.email_verified,
        lastLoginAt: userData.last_login_at,
        roles: userData.roles || [],
        createdAt: userData.user_created_at,
        updatedAt: userData.user_updated_at,
        organization: {
          id: userData.org_id,
          name: userData.org_name,
          slug: userData.org_slug
        }
      };
    } catch (error: any) {
      this.logger.error('Failed to find user by wallet address globally', { 
        error: error.message, 
        walletAddress 
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find user by wallet address',
        500,
        error
      );
    }
  }

  /**
   * Get or create user by wallet address with organization creation
   */
  async getOrCreateUserByWallet(
    walletAddress: string, 
    organizationData?: {
      name: string;
      slug: string;
      id?: string;
    }
  ): Promise<User> {
    try {
      // First try to find existing user
      const existingUser = await this.findByWalletAddressGlobal(walletAddress);
      if (existingUser) {
        // Return the actual User entity
        const user = await this.repository.findOne({
          where: { id: existingUser.id }
        });
        if (user) {
          return user;
        }
      }

      // User doesn't exist, create new user with organization
      if (!organizationData) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Organization data required for new user creation',
          400
        );
      }

      return await this.transaction(async (transactionalRepo) => {
        // Create organization first
        const orgResult = await this.query(`
          INSERT INTO organizations (
            id, name, slug, plan, settings, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, NOW(), NOW()
          ) RETURNING id, name, slug
        `, [
          organizationData.id || this.generateId(),
          organizationData.name,
          organizationData.slug,
          'basic',
          JSON.stringify({
            timezone: 'UTC',
            currency: 'USD',
            invoiceNumberPrefix: 'INV',
            paymentTerms: 30
          })
        ]);

        const organization = orgResult[0];
        
        // Create user
        const user = transactionalRepo.create({
          id: this.generateId(),
          walletAddress,
          email: `${walletAddress}@temp.fluxion.app`,
          organizationId: organization.id,
          role: 'owner',
          isActive: true,
          emailVerified: false
        });

        const savedUser = await transactionalRepo.save(user);
        
        this.logger.info('User and organization created via repository', {
          userId: savedUser.id,
          organizationId: organization.id,
          walletAddress
        });

        return savedUser;
      });
    } catch (error: any) {
      this.logger.error('Failed to get or create user by wallet', {
        error: error.message,
        walletAddress
      });
      throw error instanceof FluxionError ? error : new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get or create user by wallet',
        500,
        error
      );
    }
  }

  /**
   * Find user with system roles by wallet address (for admin authentication)
   * This bypasses tenant isolation to check for system-level access
   */
  async findByWalletAddressWithSystemRoles(walletAddress: string): Promise<{
    id: string;
    organizationId: string;
    email: string;
    walletAddress: string;
    profile: any;
    notificationPreferences: any;
    stats: any;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    systemRoles: string[];
    organizationRoles: string[];
    organization?: {
      id: string;
      name: string;
      slug: string;
    };
  } | null> {
    try {
      const result = await this.query(`
        SELECT DISTINCT
          u.id,
          u.organization_id as "organizationId",
          u.email,
          u.wallet_address as "walletAddress",
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.is_active as "isActive",
          u.created_at as "createdAt",
          u.updated_at as "updatedAt",
          o.id as "orgId",
          o.name as "orgName",
          o.slug as "orgSlug",
          ARRAY_AGG(
            CASE 
              WHEN r.type = 'system' AND ur.is_active = true AND ur.deleted_at IS NULL 
              THEN r.key 
              ELSE NULL 
            END
          ) FILTER (WHERE r.type = 'system' AND ur.is_active = true AND ur.deleted_at IS NULL) as "systemRoles",
          ARRAY_AGG(
            CASE 
              WHEN r.type = 'organization' AND ur.is_active = true AND ur.deleted_at IS NULL 
              THEN r.key 
              ELSE NULL 
            END
          ) FILTER (WHERE r.type = 'organization' AND ur.is_active = true AND ur.deleted_at IS NULL) as "organizationRoles"
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE LOWER(u.wallet_address) = LOWER($1)
          AND u.deleted_at IS NULL
        GROUP BY u.id, o.id
      `, [walletAddress]);

      if (!result || result.length === 0) {
        this.logger.debug('User not found in wallet search with system roles', { walletAddress });
        return null;
      }

      const userData = result[0];
      
      this.logger.debug('User found with system roles', { 
        walletAddress, 
        userId: userData.id,
        systemRoles: userData.systemRoles || [],
        organizationRoles: userData.organizationRoles || []
      });

      return {
        id: userData.id,
        organizationId: userData.organizationId,
        email: userData.email,
        walletAddress: userData.walletAddress,
        profile: {
          displayName: userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : userData.firstName || userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName
        },
        notificationPreferences: {
          emailOnPayment: true,
          emailOnInvoiceViewed: true,
          emailOnReminders: true
        },
        stats: {
          invoiceCount: 0,
          totalReceived: 0,
          lastActiveAt: new Date()
        },
        isActive: userData.isActive,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        systemRoles: userData.systemRoles || [],
        organizationRoles: userData.organizationRoles || [],
        organization: userData.orgName ? {
          id: userData.orgId,
          name: userData.orgName,
          slug: userData.orgSlug
        } : undefined
      };
    } catch (error: any) {
      this.logger.error('Failed to find user with system roles', { 
        error: error.message, 
        walletAddress 
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find user with system roles',
        500,
        error
      );
    }
  }

  /**
   * Find user with system roles by user ID (for admin profile retrieval)
   */
  async findByIdWithSystemRoles(userId: string): Promise<{
    id: string;
    organizationId: string;
    email: string;
    walletAddress: string;
    profile: any;
    notificationPreferences: any;
    stats: any;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    systemRoles: string[];
    organizationRoles: string[];
    organization?: {
      id: string;
      name: string;
      slug: string;
    };
  } | null> {
    try {
      const result = await this.query(`
        SELECT DISTINCT
          u.id,
          u.organization_id as "organizationId",
          u.email,
          u.wallet_address as "walletAddress",
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.is_active as "isActive",
          u.created_at as "createdAt",
          u.updated_at as "updatedAt",
          o.id as "orgId",
          o.name as "orgName",
          o.slug as "orgSlug",
          ARRAY_AGG(
            CASE 
              WHEN r.type = 'system' AND ur.is_active = true AND ur.deleted_at IS NULL 
              THEN r.key 
              ELSE NULL 
            END
          ) FILTER (WHERE r.type = 'system' AND ur.is_active = true AND ur.deleted_at IS NULL) as "systemRoles",
          ARRAY_AGG(
            CASE 
              WHEN r.type = 'organization' AND ur.is_active = true AND ur.deleted_at IS NULL 
              THEN r.key 
              ELSE NULL 
            END
          ) FILTER (WHERE r.type = 'organization' AND ur.is_active = true AND ur.deleted_at IS NULL) as "organizationRoles"
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
          AND u.deleted_at IS NULL
        GROUP BY u.id, o.id
      `, [userId]);

      if (!result || result.length === 0) {
        this.logger.debug('User not found by ID with system roles', { userId });
        return null;
      }

      const userData = result[0];
      
      this.logger.debug('User found by ID with system roles', { 
        userId, 
        systemRoles: userData.systemRoles || [],
        organizationRoles: userData.organizationRoles || []
      });

      return {
        id: userData.id,
        organizationId: userData.organizationId,
        email: userData.email,
        walletAddress: userData.walletAddress,
        profile: {
          displayName: userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : userData.firstName || userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName
        },
        notificationPreferences: {
          emailOnPayment: true,
          emailOnInvoiceViewed: true,
          emailOnReminders: true
        },
        stats: {
          invoiceCount: 0,
          totalReceived: 0,
          lastActiveAt: new Date()
        },
        isActive: userData.isActive,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        systemRoles: userData.systemRoles || [],
        organizationRoles: userData.organizationRoles || [],
        organization: userData.orgName ? {
          id: userData.orgId,
          name: userData.orgName,
          slug: userData.orgSlug
        } : undefined
      };
    } catch (error: any) {
      this.logger.error('Failed to find user by ID with system roles', { 
        error: error.message, 
        userId 
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find user by ID with system roles',
        500,
        error
      );
    }
  }

  /**
   * Check if user has any system roles
   */
  async hasSystemRoles(userId: string): Promise<boolean> {
    try {
      const result = await this.query(`
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
          AND r.type = 'system'
          AND ur.is_active = true
          AND ur.deleted_at IS NULL
          AND r.deleted_at IS NULL
        LIMIT 1
      `, [userId]);

      const hasSystemRoles = result.length > 0;
      
      this.logger.debug('System roles check', { 
        userId, 
        hasSystemRoles 
      });

      return hasSystemRoles;
    } catch (error: any) {
      this.logger.error('Failed to check system roles', { 
        error: error.message, 
        userId 
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to check system roles',
        500,
        error
      );
    }
  }
}