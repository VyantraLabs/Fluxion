import { FindOptionsWhere } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { User } from '../entities/User';
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
      const user = await this.repository.findOne({
        where: {
          walletAddress,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<User>,
      });
      
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
      const where: FindOptionsWhere<User> = {
        walletAddress,
        organizationId: tenantContext.tenantId,
      } as FindOptionsWhere<User>;

      if (excludeUserId) {
        where.id = { $ne: excludeUserId } as any;
      }

      const exists = await this.repository.exist({ where });
      
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
}