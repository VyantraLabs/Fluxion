import { DatabaseService } from '@/shared/database/client';
import { UserRecord, TenantContext, FluxionError, ErrorCodes } from '@/types/common';
import { Logger } from '@/shared/utils/logger';
import { User } from '@/database/entities/User';
import { repositories } from '@/database/repositories';

export class UsersService {
  private db: DatabaseService;
  private logger: Logger;

  constructor(db: DatabaseService) {
    this.db = db;
    this.logger = new Logger('UsersService');
  }

  /**
   * Create a new user
   */
  async createUser(tenantContext: TenantContext, userData: {
    wallet_address: string;
    email?: string;
    profile?: {
      display_name?: string;
      avatar_url?: string;
      bio?: string;
    };
    notification_preferences?: {
      email_on_payment: boolean;
      email_on_invoice_viewed: boolean;
      email_on_reminders: boolean;
    };
  }): Promise<UserRecord> {
    this.logger.info('Creating user', { 
      tenantId: tenantContext.tenantId, 
      walletAddress: userData.wallet_address 
    });

    const actualTenantContext = await this.ensureTenantContext(tenantContext);

    try {
      // Create user using the PostgreSQL repository
      const user = await repositories.users.create(actualTenantContext, {
        walletAddress: userData.wallet_address,
        email: userData.email || `${userData.wallet_address}@temp.fluxion.app`, // Temporary email if none provided
        firstName: userData.profile?.display_name?.split(' ')[0],
        lastName: userData.profile?.display_name?.split(' ').slice(1).join(' '),
        role: 'member',
        isActive: true,
        emailVerified: false,
      });

      // Transform to UserRecord format for compatibility
      const userRecord: UserRecord = {
        id: user.id,
        tenant_id: actualTenantContext.tenantId,
        wallet_address: userData.wallet_address,
        email: user.email,
        profile: {
          display_name: userData.profile?.display_name || user.displayName,
          avatar_url: userData.profile?.avatar_url,
          bio: userData.profile?.bio,
        },
        notification_preferences: userData.notification_preferences || {
          email_on_payment: true,
          email_on_invoice_viewed: false,
          email_on_reminders: true
        },
        stats: {
          invoice_count: 0,
          total_received: 0,
          last_active_at: new Date().toISOString()
        },
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString()
      };

      this.logger.info('User created successfully', { userId: user.id });
      return userRecord;
    } catch (error: any) {
      this.logger.error('Failed to create user', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(tenantContext: TenantContext, userId: string): Promise<UserRecord> {
    this.logger.info('Getting user by ID', { userId, tenantId: tenantContext.tenantId });

    try {
      const user = await repositories.users.findById(tenantContext, userId);
      if (!user) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'User not found',
          404,
          { userId }
        );
      }

      // Transform to UserRecord format for compatibility
      const userRecord: UserRecord = {
        id: user.id,
        tenant_id: tenantContext.tenantId,
        wallet_address: user.walletAddress || '',
        email: user.email,
        profile: {
          display_name: user.displayName,
          avatar_url: undefined,
          bio: undefined,
        },
        notification_preferences: {
          email_on_payment: true,
          email_on_invoice_viewed: false,
          email_on_reminders: true
        },
        stats: {
          invoice_count: 0,
          total_received: 0,
          last_active_at: user.lastLoginAt?.toISOString() || new Date().toISOString()
        },
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString()
      };

      return userRecord;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve user',
        500,
        error
      );
    }
  }

  /**
   * Get user by wallet address
   */
  async getUserByWallet(tenantContext: TenantContext, walletAddress: string): Promise<UserRecord> {
    this.logger.info('Getting user by wallet', { walletAddress, tenantId: tenantContext.tenantId });

    const actualTenantContext = await this.ensureTenantContext(tenantContext);
    
    try {
      const user = await repositories.users.findByWalletAddress(actualTenantContext, walletAddress);
      if (!user) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'User not found',
          404,
          { walletAddress }
        );
      }

      // Transform to UserRecord format for compatibility
      const userRecord: UserRecord = {
        id: user.id,
        tenant_id: actualTenantContext.tenantId,
        wallet_address: walletAddress,
        email: user.email,
        profile: {
          display_name: user.displayName,
          avatar_url: undefined, // Add this field to User entity if needed
          bio: undefined, // Add this field to User entity if needed
        },
        notification_preferences: {
          email_on_payment: true,
          email_on_invoice_viewed: false,
          email_on_reminders: true
        },
        stats: {
          invoice_count: 0, // TODO: Calculate from invoices
          total_received: 0, // TODO: Calculate from payments
          last_active_at: user.lastLoginAt?.toISOString() || new Date().toISOString()
        },
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString()
      };

      return userRecord;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve user by wallet',
        500,
        error
      );
    }
  }

  /**
   * Get or create user by wallet address
   */
  async getOrCreateUserByWallet(tenantContext: TenantContext, walletAddress: string): Promise<UserRecord> {
    this.logger.info('Getting or creating user by wallet', { walletAddress, tenantId: tenantContext.tenantId });

    try {
      // First ensure we have a valid tenant context with organization
      const actualTenantContext = await this.ensureTenantContext(tenantContext);
      return await this.getUserByWallet(actualTenantContext, walletAddress);
    } catch (error: any) {
      if (error.code === ErrorCodes.NOT_FOUND) {
        this.logger.info('User not found, creating new user', { walletAddress });
        const actualTenantContext = await this.ensureTenantContext(tenantContext);
        return await this.createUser(actualTenantContext, { wallet_address: walletAddress });
      }
      throw error;
    }
  }

  /**
   * Ensure tenant context has a valid organization ID
   */
  private async ensureTenantContext(tenantContext: TenantContext): Promise<TenantContext> {
    // If tenantId is 'default', we need to look up the default organization UUID
    if (tenantContext.tenantId === 'default') {
      const { repositories } = await import('@/database/repositories');
      
      try {
        const defaultOrg = await repositories.organizations.findBySlug('default');
        if (!defaultOrg) {
          // Try to create default organization if it doesn't exist
          const createdOrg = await repositories.organizations.create(tenantContext, {
            name: 'Default Organization',
            slug: 'default',
            plan: 'basic',
            settings: {}
          });
          this.logger.info('Created default organization', { id: createdOrg.id });
          return { tenantId: createdOrg.id };
        }
        return { tenantId: defaultOrg.id };
      } catch (error) {
        this.logger.error('Failed to resolve default organization', { error });
        throw new FluxionError(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to resolve organization context',
          500,
          error
        );
      }
    }
    
    return tenantContext;
  }

  /**
   * Update user profile
   */
  async updateUser(tenantContext: TenantContext, userId: string, updates: {
    email?: string;
    profile?: Partial<{
      display_name?: string;
      avatar_url?: string;
      bio?: string;
    }>;
    notification_preferences?: Partial<{
      email_on_payment: boolean;
      email_on_invoice_viewed: boolean;
      email_on_reminders: boolean;
    }>;
  }): Promise<UserRecord> {
    this.logger.info('Updating user', { userId, tenantId: tenantContext.tenantId });

    try {
      // Get current user to merge with updates
      const currentUser = await this.getUserById(tenantContext, userId);
      
      const updateData: any = {};
      
      if (updates.email !== undefined) {
        updateData.email = updates.email;
      }

      if (updates.profile?.display_name) {
        const nameParts = updates.profile.display_name.split(' ');
        updateData.firstName = nameParts[0];
        updateData.lastName = nameParts.slice(1).join(' ');
      }

      // Update last login to mark as active
      updateData.lastLoginAt = new Date();

      const updatedUser = await repositories.users.update(tenantContext, userId, updateData);
      this.logger.info('User updated successfully', { userId });

      // Transform to UserRecord format for compatibility
      const userRecord: UserRecord = {
        id: updatedUser.id,
        tenant_id: tenantContext.tenantId,
        wallet_address: updatedUser.walletAddress || '',
        email: updatedUser.email,
        profile: {
          display_name: updates.profile?.display_name || updatedUser.displayName,
          avatar_url: updates.profile?.avatar_url,
          bio: updates.profile?.bio,
        },
        notification_preferences: {
          ...currentUser.notification_preferences,
          ...updates.notification_preferences
        },
        stats: {
          ...currentUser.stats,
          last_active_at: new Date().toISOString()
        },
        created_at: updatedUser.createdAt.toISOString(),
        updated_at: updatedUser.updatedAt.toISOString()
      };

      return userRecord;
    } catch (error: any) {
      this.logger.error('Failed to update user', { error: error.message, userId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update user',
        500,
        error
      );
    }
  }

  /**
   * Update user statistics
   */
  async updateUserStats(tenantContext: TenantContext, userId: string, stats: {
    invoice_count_delta?: number;
    total_received_delta?: number;
  }): Promise<UserRecord> {
    this.logger.info('Updating user stats', { userId, tenantId: tenantContext.tenantId, stats });

    const currentUser = await this.getUserById(tenantContext, userId);
    
    const currentStats = currentUser.stats || {
      invoice_count: 0,
      total_received: 0,
      last_active_at: new Date().toISOString()
    };

    const updatedStats = {
      ...currentStats,
      last_active_at: new Date().toISOString()
    };

    if (stats.invoice_count_delta !== undefined) {
      updatedStats.invoice_count = Math.max(0, updatedStats.invoice_count + stats.invoice_count_delta);
    }

    if (stats.total_received_delta !== undefined) {
      updatedStats.total_received = Math.max(0, updatedStats.total_received + stats.total_received_delta);
    }

    try {
      const updatedUser = await this.db.updateUser(tenantContext, userId, { stats: updatedStats });
      this.logger.info('User stats updated successfully', { userId });
      return updatedUser;
    } catch (error: any) {
      this.logger.error('Failed to update user stats', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if user exists by wallet address
   */
  async userExists(tenantContext: TenantContext, walletAddress: string): Promise<boolean> {
    try {
      const actualTenantContext = await this.ensureTenantContext(tenantContext);
      const user = await repositories.users.findByWalletAddress(actualTenantContext, walletAddress);
      return !!user;
    } catch (error: any) {
      this.logger.error('Failed to check if user exists', { error: error.message, walletAddress });
      return false;
    }
  }

  /**
   * Validate user can perform action
   */
  async validateUserAccess(tenantContext: TenantContext, userId: string): Promise<UserRecord> {
    const user = await this.getUserById(tenantContext, userId);
    
    // Add any additional validation logic here
    // For example, check if user is active, has required permissions, etc.
    
    return user;
  }
}