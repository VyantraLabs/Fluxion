import { UserRecord, TenantContext, FluxionError, ErrorCodes } from '../../types/common';
import { CompleteOnboardingDTO } from '../../types/user';
import { Logger } from '../utils/logger';
import { User } from '../../database/entities/User';
import { repositories } from '../../database/repositories';
import { ulid } from 'ulid';

export class UsersService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('UsersService');
  }

  /**
   * Create a new user with their own organization
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
    organizationName?: string;
  }): Promise<UserRecord> {
    this.logger.info('Creating user with organization', { 
      tenantId: tenantContext.tenantId, 
      walletAddress: userData.wallet_address,
      organizationName: userData.organizationName
    });

    try {
      // Create organization first
      const organization = await this.createUserOrganization(userData.wallet_address, userData.organizationName);
      
      const userTenantContext = { tenantId: organization.id };

      // Create user using the PostgreSQL repository with new organization
      const user = await repositories.users.create(userTenantContext, {
        walletAddress: userData.wallet_address,
        email: userData.email || `${userData.wallet_address}@temp.fluxion.app`, // Temporary email if none provided
        firstName: userData.profile?.display_name?.split(' ')[0],
        lastName: userData.profile?.display_name?.split(' ').slice(1).join(' '),
        role: 'owner', // User is owner of their own organization
        isActive: true,
        emailVerified: false,
      });

      // Assign RBAC role to the new user
      const { RBACService } = await import('../services/rbac.service');
      const { getDatabase } = await import('../database/client');
      
      try {
        const rbacService = new RBACService();
        await rbacService.assignRole(
          user.id,
          'owner', // Organization owner role
          organization.id,
          user.id, // Self-granted
          undefined // No expiration
        );
        
        this.logger.info('Assigned RBAC owner role to new user', {
          userId: user.id,
          organizationId: organization.id
        });
      } catch (rbacError: any) {
        this.logger.error('Failed to assign RBAC role to new user', {
          error: rbacError.message,
          userId: user.id,
          organizationId: organization.id
        });
        // Don't fail user creation for RBAC errors, but log them
      }

      // Transform to UserRecord format for compatibility
      const userRecord: UserRecord = {
        id: user.id,
        tenant_id: organization.id,
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
        updated_at: user.updatedAt.toISOString(),
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        }
      };

      this.logger.info('User and organization created successfully', { 
        userId: user.id, 
        organizationId: organization.id 
      });
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

      // Get the organization information
      const organization = await repositories.organizations.findById(user.organizationId);

      // Transform to UserRecord format for compatibility
      // SECURITY: Remove sensitive data from API responses
      const userRecord: UserRecord = {
        id: user.id,
        // SECURITY: Don't expose tenant_id in API responses - use JWT context instead
        tenant_id: user.organizationId, // Used internally but not exposed in JSON
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
        updated_at: user.updatedAt.toISOString(),
        organization: organization ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        } : undefined
        // SECURITY: Removed admin fields - these should only be in JWT tokens
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
   * Get user by wallet address (searches across ALL organizations)
   */
  async getUserByWallet(tenantContext: TenantContext, walletAddress: string): Promise<UserRecord> {
    this.logger.info('Getting user by wallet (cross-tenant search)', { walletAddress });

    try {
      // Use the enhanced repository method for global wallet search
      const userData = await repositories.users.findByWalletAddressGlobal(walletAddress);
      
      if (!userData) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'User not found',
          404,
          { walletAddress }
        );
      }
      
      this.logger.info('User found via cross-tenant search', { 
        walletAddress, 
        userId: userData.id,
        organizationId: userData.organizationId,
        organizationName: userData.organization.name
      });

      // Transform to UserRecord format for compatibility
      const userRecord: UserRecord = {
        id: userData.id,
        tenant_id: userData.organizationId,
        wallet_address: userData.walletAddress,
        email: userData.email,
        profile: {
          display_name: userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}`.trim()
            : userData.firstName || '',
          avatar_url: undefined, 
          bio: undefined,
        },
        notification_preferences: {
          email_on_payment: true,
          email_on_invoice_viewed: false,
          email_on_reminders: true
        },
        stats: {
          invoice_count: 0, // TODO: Calculate from invoices
          total_received: 0, // TODO: Calculate from payments
          last_active_at: userData.lastLoginAt?.toISOString() || new Date().toISOString()
        },
        created_at: userData.createdAt.toISOString(),
        updated_at: userData.updatedAt.toISOString(),
        organization: userData.organization
      };

      return userRecord;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      this.logger.error('Failed to retrieve user by wallet (cross-tenant)', { 
        error: error.message, 
        walletAddress 
      });
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
      // Try to find existing user first
      return await this.getUserByWallet(tenantContext, walletAddress);
    } catch (error: any) {
      if (error.code === ErrorCodes.NOT_FOUND) {
        this.logger.info('User not found, creating new user', { walletAddress });
        return await this.createUser(tenantContext, { wallet_address: walletAddress });
      }
      throw error;
    }
  }

  /**
   * Ensure tenant context has a valid organization ID
   */
  private async ensureTenantContext(tenantContext: TenantContext): Promise<TenantContext> {
    const defaultOrgId = '01HBXYZ0000000000000000000'; // Fixed ULID for consistency
    
    if (tenantContext.tenantId === 'default' || tenantContext.tenantId === '00000000-0000-0000-0000-000000000000' || tenantContext.tenantId === defaultOrgId) {
      try {
        // Use repository method to get or create default organization
        const defaultOrg = await repositories.organizations.getOrCreateDefaultOrganization();
        
        this.logger.debug('Using default organization', { 
          id: defaultOrg.id, 
          name: defaultOrg.name 
        });
        
        return { tenantId: defaultOrg.id };
      } catch (error: any) {
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
      // SECURITY: Remove sensitive data from API responses
      const userRecord: UserRecord = {
        id: updatedUser.id,
        // SECURITY: Don't expose tenant_id in API responses - use JWT context instead  
        tenant_id: updatedUser.organizationId, // Used internally but not exposed in JSON
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
        updated_at: updatedUser.updatedAt.toISOString(),
        organization: currentUser.organization
        // SECURITY: Removed admin fields - these should only be in JWT tokens
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

    // For now, this method doesn't directly update user stats in the database
    // Stats are calculated dynamically based on invoices and payments
    // This is a placeholder for future implementation if needed
    const currentUser = await this.getUserById(tenantContext, userId);
    
    this.logger.info('User stats update requested but not implemented', { userId });
    return currentUser;
  }

  /**
   * Check if user exists by wallet address (searches across ALL organizations)
   */
  async userExists(tenantContext: TenantContext, walletAddress: string): Promise<boolean> {
    try {
      // Use cross-tenant search
      const user = await this.getUserByWallet(tenantContext, walletAddress);
      return !!user;
    } catch (error: any) {
      if (error.code === ErrorCodes.NOT_FOUND) {
        return false;
      }
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

  /**
   * Create a new organization for a user
   */
  private async createUserOrganization(walletAddress: string, organizationName?: string): Promise<{id: string, name: string, slug: string}> {
    // Generate organization name if not provided
    const orgName = organizationName || `${walletAddress.substring(0, 8)}'s Organization`;
    const orgSlug = repositories.organizations.generateSlug(orgName, walletAddress);
    const orgId = ulid();

    try {
      // Create organization using repository method
      const organization = await repositories.organizations.createWithSettings({
        id: orgId,
        name: orgName,
        slug: orgSlug,
        plan: 'basic',
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          invoiceNumberPrefix: 'INV',
          paymentTerms: 30,
          features: {
            multiCurrency: false,
            customBranding: false,
            advancedReporting: false
          }
        }
      });

      this.logger.info('Created organization for user', { 
        orgId: organization.id, 
        orgName: organization.name, 
        orgSlug: organization.slug, 
        walletAddress 
      });
      
      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      };
    } catch (error: any) {
      this.logger.error('Failed to create organization', { error: error.message, walletAddress });
      throw new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create organization',
        500,
        error
      );
    }
  }

  /**
   * Complete onboarding for a user by updating their organization name
   */
  async completeOnboarding(tenantContext: TenantContext, userId: string, data: CompleteOnboardingDTO): Promise<UserRecord> {
    this.logger.info('Completing user onboarding', { 
      userId, 
      tenantId: tenantContext.tenantId,
      organizationName: data.organizationName
    });

    try {
      // Get current user to validate they exist
      const currentUser = await this.getUserById(tenantContext, userId);
      
      // Update organization name and slug using repository method
      const orgSlug = repositories.organizations.generateSlug(data.organizationName, currentUser.wallet_address);
      await repositories.organizations.updateNameAndSlug(
        tenantContext.tenantId,
        data.organizationName,
        orgSlug
      );

      this.logger.info('Organization name updated during onboarding', { 
        organizationId: tenantContext.tenantId,
        newName: data.organizationName,
        newSlug: orgSlug
      });

      // Update user profile if display name or email provided
      if (data.displayName || data.email) {
        const updateData: any = {};
        
        if (data.email) {
          updateData.email = data.email;
        }
        
        if (data.displayName) {
          const nameParts = data.displayName.split(' ');
          updateData.firstName = nameParts[0];
          updateData.lastName = nameParts.slice(1).join(' ');
        }

        await repositories.users.update(tenantContext, userId, updateData);
        
        this.logger.info('User profile updated during onboarding', { 
          userId,
          email: data.email ? '***@***' : 'unchanged',
          displayName: data.displayName || 'unchanged'
        });
      }

      // Return updated user record
      const updatedUser = await this.getUserById(tenantContext, userId);
      
      // Update the organization info in the response
      if (updatedUser.organization) {
        updatedUser.organization.name = data.organizationName;
        updatedUser.organization.slug = orgSlug;
      }

      this.logger.info('User onboarding completed successfully', { 
        userId,
        organizationName: data.organizationName
      });
      
      return updatedUser;
    } catch (error: any) {
      this.logger.error('Failed to complete user onboarding', { 
        error: error.message, 
        userId,
        organizationName: data.organizationName
      });
      
      if (error instanceof FluxionError) {
        throw error;
      }
      
      throw new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to complete onboarding',
        500,
        error
      );
    }
  }

  // =============================================================================
  // ORGANIZATION USER MANAGEMENT METHODS
  // =============================================================================

  /**
   * Invite user to organization
   */
  async inviteUserToOrganization(
    tenantContext: TenantContext,
    organizationId: string,
    email: string,
    roleKey: string,
    invitedBy: string,
    message?: string
  ): Promise<{ success: boolean; invitationId: string; email: string }> {
    this.logger.info('Inviting user to organization', {
      organizationId,
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for logs
      roleKey,
      invitedBy
    });

    try {
      // Check if user already exists
      const existingUser = await repositories.users.findByEmail(tenantContext, email);
      
      if (existingUser) {
        // User exists, assign role directly
        const { RBACService } = await import('../services/rbac.service');
        const rbacService = new RBACService();
        
        await rbacService.assignRole(existingUser.id, roleKey, organizationId, invitedBy);
        
        this.logger.info('Existing user added to organization', {
          userId: existingUser.id,
          organizationId,
          roleKey
        });
        
        return {
          success: true,
          invitationId: `direct_${Date.now()}`,
          email
        };
      }
      
      // User doesn't exist, create invitation record (placeholder)
      const invitationId = ulid();
      
      this.logger.info('User invitation created for new user', {
        invitationId,
        organizationId,
        roleKey,
        message: !!message
      });
      
      // TODO: Implement invitation system with email notifications
      // For now, return success for API compatibility
      return {
        success: true,
        invitationId,
        email
      };
      
    } catch (error: any) {
      this.logger.error('Failed to invite user to organization', {
        error: error.message,
        organizationId,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2')
      });
      
      throw new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to send invitation',
        500,
        error
      );
    }
  }

}