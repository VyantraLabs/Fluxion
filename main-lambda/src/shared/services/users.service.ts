import { DatabaseService } from '@/shared/database/client';
import { UserRecord, TenantContext, FluxionError, ErrorCodes } from '@/types/common';
import { CompleteOnboardingDTO } from '@/types/user';
import { Logger } from '@/shared/utils/logger';
import { User } from '@/database/entities/User';
import { repositories } from '@/database/repositories';
import { ulid } from 'ulid';

export class UsersService {
  private db: DatabaseService;
  private logger: Logger;

  constructor(db: DatabaseService) {
    this.db = db;
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
      const organization = await repositories.organizations.findById(tenantContext.tenantId);

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
        updated_at: user.updatedAt.toISOString(),
        organization: organization ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        } : undefined
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
      // For authentication, we need to search across ALL organizations to find the user
      // We use a direct database query instead of the repository to bypass tenant filtering
      const { AppDataSource } = await import('@/database/data-source');
      
      const userResult = await AppDataSource.query(`
        SELECT 
          u.id as user_id,
          u.organization_id,
          u.email,
          u.wallet_address,
          u.first_name,
          u.last_name,
          u.role,
          u.is_active,
          u.email_verified,
          u.last_login_at,
          u.created_at as user_created_at,
          u.updated_at as user_updated_at,
          o.id as org_id,
          o.name as org_name,
          o.slug as org_slug
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        WHERE u.wallet_address = $1 
        AND u.deleted_at IS NULL 
        AND o.deleted_at IS NULL
        LIMIT 1
      `, [walletAddress]);

      if (!userResult || userResult.length === 0) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'User not found',
          404,
          { walletAddress }
        );
      }

      const userData = userResult[0];
      
      this.logger.info('User found via cross-tenant search', { 
        walletAddress, 
        userId: userData.user_id,
        organizationId: userData.organization_id,
        organizationName: userData.org_name
      });

      // Transform to UserRecord format for compatibility
      const userRecord: UserRecord = {
        id: userData.user_id,
        tenant_id: userData.organization_id,
        wallet_address: walletAddress,
        email: userData.email,
        profile: {
          display_name: userData.first_name && userData.last_name 
            ? `${userData.first_name} ${userData.last_name}`.trim()
            : userData.first_name || '',
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
          last_active_at: userData.last_login_at?.toISOString() || new Date().toISOString()
        },
        created_at: userData.user_created_at,
        updated_at: userData.user_updated_at,
        organization: {
          id: userData.org_id,
          name: userData.org_name,
          slug: userData.org_slug
        }
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
    // Generate a stable ULID for the default organization (based on a fixed timestamp)
    const defaultOrgId = '01HBXYZ0000000000000000000'; // Fixed ULID for consistency
    
    if (tenantContext.tenantId === 'default' || tenantContext.tenantId === '00000000-0000-0000-0000-000000000000' || tenantContext.tenantId === defaultOrgId) {
      const { repositories } = await import('@/database/repositories');
      
      try {
        // First check if the default organization with the expected ULID exists
        let defaultOrg = await repositories.organizations.findById(defaultOrgId);
        
        if (!defaultOrg) {
          // If not found, create it using raw query to ensure specific ULID
          const { AppDataSource } = await import('@/database/data-source');
          const queryRunner = AppDataSource.createQueryRunner();
          
          try {
            await queryRunner.query(`
              INSERT INTO organizations (
                id,
                name, 
                slug,
                plan,
                settings,
                created_at,
                updated_at
              ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                NOW(),
                NOW()
              ) ON CONFLICT (id) DO NOTHING;
            `, [
              defaultOrgId,
              'Default Organization',
              'default',
              'basic',
              JSON.stringify({
                timezone: 'UTC',
                currency: 'USD',
                invoiceNumberPrefix: 'INV',
                paymentTerms: 30
              })
            ]);

            this.logger.info('Created default organization with specific ULID', { id: defaultOrgId });
          } catch (insertError) {
            this.logger.error('Failed to create default organization', { error: insertError });
          } finally {
            await queryRunner.release();
          }

          // Try to fetch again after creation
          defaultOrg = await repositories.organizations.findById(defaultOrgId);
        }

        if (!defaultOrg) {
          throw new Error(`Default organization ${defaultOrgId} could not be created or found`);
        }

        this.logger.debug('Using default organization', { id: defaultOrg.id, name: defaultOrg.name });
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
    const { repositories } = await import('@/database/repositories');
    
    // Generate organization name if not provided
    const orgName = organizationName || `${walletAddress.substring(0, 8)}'s Organization`;
    const orgSlug = this.generateOrgSlug(orgName, walletAddress);
    const orgId = ulid();

    try {
      // Create organization using raw query to ensure specific UUID
      const { AppDataSource } = await import('@/database/data-source');
      const queryRunner = AppDataSource.createQueryRunner();
      
      try {
        await queryRunner.query(`
          INSERT INTO organizations (
            id,
            name, 
            slug,
            plan,
            settings,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, NOW(), NOW()
          );
        `, [
          orgId,
          orgName,
          orgSlug,
          'basic',
          JSON.stringify({
            timezone: 'UTC',
            currency: 'USD',
            invoiceNumberPrefix: 'INV',
            paymentTerms: 30,
            features: {
              multiCurrency: false,
              customBranding: false,
              advancedReporting: false
            }
          })
        ]);

        this.logger.info('Created organization for user', { 
          orgId, 
          orgName, 
          orgSlug, 
          walletAddress 
        });
        
        return {
          id: orgId,
          name: orgName,
          slug: orgSlug
        };
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      // Handle duplicate key constraint - organization might already exist
      if (error.code === '23505' && error.constraint === 'UQ_963693341bd612aa01ddf3a4b68') {
        this.logger.info('Organization already exists, finding existing one', { walletAddress, orgSlug });
        
        try {
          const { AppDataSource } = await import('@/database/data-source');
          const existingOrg = await AppDataSource.query(
            'SELECT id, name, slug FROM organizations WHERE slug = $1',
            [orgSlug]
          );
          
          if (existingOrg && existingOrg.length > 0) {
            this.logger.info('Found existing organization', { 
              orgId: existingOrg[0].id, 
              orgName: existingOrg[0].name, 
              orgSlug: existingOrg[0].slug,
              walletAddress 
            });
            
            return {
              id: existingOrg[0].id,
              name: existingOrg[0].name,
              slug: existingOrg[0].slug
            };
          }
        } catch (findError) {
          this.logger.error('Failed to find existing organization', { error: findError.message, walletAddress });
        }
      }
      
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
      
      // Update organization name
      const { AppDataSource } = await import('@/database/data-source');
      const queryRunner = AppDataSource.createQueryRunner();
      
      try {
        // Generate new slug based on the organization name
        const orgSlug = this.generateOrgSlug(data.organizationName, currentUser.wallet_address);
        
        await queryRunner.query(`
          UPDATE organizations 
          SET 
            name = $1,
            slug = $2,
            updated_at = NOW()
          WHERE id = $3
        `, [
          data.organizationName,
          orgSlug,
          tenantContext.tenantId
        ]);

        this.logger.info('Organization name updated during onboarding', { 
          organizationId: tenantContext.tenantId,
          newName: data.organizationName,
          newSlug: orgSlug
        });
      } finally {
        await queryRunner.release();
      }

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
        updatedUser.organization.slug = this.generateOrgSlug(data.organizationName, currentUser.wallet_address);
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

  /**
   * Generate a unique slug for an organization
   */
  private generateOrgSlug(name: string, walletAddress: string): string {
    // Create a slug from the organization name
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
    
    // Ensure it's not empty and add wallet suffix for uniqueness
    if (!slug || slug.length < 3) {
      slug = 'org-' + walletAddress.substring(2, 10).toLowerCase();
    } else {
      slug = slug + '-' + walletAddress.substring(2, 10).toLowerCase();
    }
    
    return slug;
  }
}