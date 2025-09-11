import jwt from 'jsonwebtoken';
import { getDatabase } from '@/shared/database/client';
import { getBlockchainService } from '@/shared/blockchain/client';
import { Logger } from '@/shared/utils/logger';
import { RBACService } from '@/shared/services/rbac.service';
import { 
  createNotFoundError, 
  createUnauthorizedError, 
  createValidationError,
  FluxionError
} from '@/shared/errors';
import { ErrorCodes } from '@/types/common';
import { 
  User, 
  AuthenticateWalletDTO, 
  AuthResponse,
  JWTPayload,
  AuthMessage
} from '@/types/user';
import { OrganizationRoleKey, SystemRoleKey } from '@/database/entities/Role';

export interface EnhancedAuthOptions {
  skipSignatureVerification?: boolean;
  developmentMode?: boolean;
  createUserIfNotExists?: boolean;
  defaultOrganizationRole?: OrganizationRoleKey;
}

export class EnhancedAuthService {
  private db = getDatabase();
  private blockchain = getBlockchainService();
  private rbacService = new RBACService(this.db);
  private logger = new Logger('EnhancedAuthService');

  /**
   * Enhanced wallet authentication with multiple fallback methods
   */
  async authenticateWallet(
    data: AuthenticateWalletDTO, 
    options: EnhancedAuthOptions = {}
  ): Promise<AuthResponse> {
    this.logger.info('Starting enhanced wallet authentication', { 
      wallet_address: data.wallet_address,
      options: {
        skipSignatureVerification: options.skipSignatureVerification,
        developmentMode: options.developmentMode,
        createUserIfNotExists: options.createUserIfNotExists
      }
    });

    try {
      // Step 1: Signature verification (unless skipped)
      if (!options.skipSignatureVerification && !options.developmentMode) {
        await this.verifyWalletSignature(data);
      } else {
        this.logger.warn('Signature verification skipped', { 
          wallet_address: data.wallet_address,
          reason: options.skipSignatureVerification ? 'explicitly_skipped' : 'development_mode'
        });
      }

      // Step 2: Find or create user
      let userRecord: any;
      try {
        userRecord = await this.findOrCreateUser(data.wallet_address, options);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND' && !options.createUserIfNotExists) {
          throw createNotFoundError(
            'User not found. Please complete onboarding first or enable user creation.',
            data.wallet_address
          );
        }
        throw error;
      }

      // Step 3: Migrate legacy user to RBAC system if needed
      await this.migrateUserToRBAC(userRecord);

      // Step 4: Get user permissions
      const userPermissions = await this.rbacService.getUserPermissions(
        userRecord.id, 
        userRecord.organizationId
      );

      // Step 5: Generate enhanced JWT token
      const token = await this.generateEnhancedJWT(userRecord, userPermissions);

      // Step 6: Build response
      const authResponse = await this.buildAuthResponse(userRecord, token, userPermissions);

      this.logger.info('Enhanced wallet authentication successful', { 
        wallet_address: data.wallet_address,
        user_id: userRecord.id,
        permissions_count: userPermissions?.permissions.length || 0,
        is_system_admin: userPermissions?.isSystemAdmin || false
      });

      return authResponse;

    } catch (error: any) {
      this.logger.error('Enhanced wallet authentication failed', { 
        error: error.message,
        wallet_address: data.wallet_address,
        stack: error.stack
      });
      
      // Provide helpful error messages
      if (error.message.includes('signature')) {
        throw createUnauthorizedError(
          'Invalid wallet signature. Please ensure you\'re signing with the correct wallet.',
          { wallet_address: data.wallet_address }
        );
      }
      
      throw error;
    }
  }

  /**
   * Create new user with organization and default role
   */
  async createUserWithOrganization(
    data: AuthenticateWalletDTO & { 
      organizationName?: string;
      displayName?: string; 
      email?: string;
    },
    options: EnhancedAuthOptions = {}
  ): Promise<AuthResponse> {
    this.logger.info('Creating new user with organization', { 
      wallet_address: data.wallet_address,
      organization_name: data.organizationName 
    });

    try {
      // Verify signature (unless in development mode)
      if (!options.developmentMode) {
        await this.verifyWalletSignature(data);
      }

      // Check if user already exists
      const existingUser = await this.findUserByWallet(data.wallet_address);
      if (existingUser) {
        throw createValidationError('User already exists. Please use the login flow instead.');
      }

      // Create user with organization using shared service
      const { UsersService } = await import('@/shared/services/users.service');
      const usersService = new UsersService(this.db);
      
      const userRecord = await usersService.createUser({ tenantId: '' }, {
        wallet_address: data.wallet_address,
        organizationName: data.organizationName || `${data.wallet_address.substring(0, 8)}'s Organization`,
        email: data.email,
        profile: {
          display_name: data.displayName
        }
      });

      // Assign default organization role
      const defaultRole = options.defaultOrganizationRole || OrganizationRoleKey.OWNER;
      await this.rbacService.assignRole(
        userRecord.id,
        defaultRole,
        userRecord.organizationId,
        userRecord.id // Self-granted
      );

      // Get user permissions
      const userPermissions = await this.rbacService.getUserPermissions(
        userRecord.id, 
        userRecord.organizationId
      );

      // Generate JWT token
      const token = await this.generateEnhancedJWT(userRecord, userPermissions);

      // Build response
      const authResponse = await this.buildAuthResponse(userRecord, token, userPermissions);
      authResponse.isNewUser = true;
      authResponse.needsOnboarding = false;

      this.logger.info('New user created successfully with RBAC', { 
        wallet_address: data.wallet_address,
        user_id: userRecord.id,
        organization_id: userRecord.organizationId,
        default_role: defaultRole
      });

      return authResponse;

    } catch (error: any) {
      this.logger.error('New user creation failed', { 
        error: error.message,
        wallet_address: data.wallet_address 
      });
      throw error;
    }
  }

  /**
   * Generate authentication message for wallet signing
   */
  async generateAuthMessage(walletAddress: string): Promise<AuthMessage> {
    const nonce = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();
    
    const message = this.blockchain.generateAuthMessage(walletAddress, nonce);
    
    this.logger.info('Auth message generated', { walletAddress, nonce, timestamp });
    
    return {
      message,
      nonce,
      timestamp
    };
  }

  /**
   * Refresh user permissions and generate new token
   */
  async refreshUserToken(userId: string, organizationId?: string): Promise<string> {
    try {
      const userRecord = await this.findUserById(userId);
      if (!userRecord) {
        throw createNotFoundError('User not found', userId);
      }

      const userPermissions = await this.rbacService.getUserPermissions(
        userId, 
        organizationId || userRecord.organizationId
      );

      return this.generateEnhancedJWT(userRecord, userPermissions);

    } catch (error: any) {
      this.logger.error('Token refresh failed', { 
        error: error.message,
        userId,
        organizationId 
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async verifyWalletSignature(data: AuthenticateWalletDTO): Promise<void> {
    const isValidSignature = this.blockchain.verifyWalletSignature(
      data.message,
      data.signature,
      data.wallet_address
    );
    
    if (!isValidSignature) {
      throw createUnauthorizedError('Invalid signature - wallet address mismatch');
    }

    // Parse and validate message timestamp
    const authMessage = this.parseAuthMessage(data.message);
    const now = Date.now();
    const messageAge = now - authMessage.timestamp;
    
    // Message should be less than 5 minutes old
    if (messageAge > 5 * 60 * 1000) {
      throw createUnauthorizedError('Authentication message too old');
    }
  }

  private async findOrCreateUser(
    walletAddress: string, 
    options: EnhancedAuthOptions
  ): Promise<any> {
    let userRecord = await this.findUserByWallet(walletAddress);
    
    if (!userRecord && options.createUserIfNotExists) {
      this.logger.info('Creating user automatically', { wallet_address: walletAddress });
      
      const { UsersService } = await import('@/shared/services/users.service');
      const usersService = new UsersService(this.db);
      
      userRecord = await usersService.createUser({ tenantId: '' }, {
        wallet_address: walletAddress,
        organizationName: `${walletAddress.substring(0, 8)}'s Organization`,
      });

      // Assign default role
      await this.rbacService.assignRole(
        userRecord.id,
        options.defaultOrganizationRole || OrganizationRoleKey.MEMBER,
        userRecord.organizationId,
        userRecord.id
      );
    }

    if (!userRecord) {
      throw createNotFoundError('User not found', walletAddress);
    }

    return userRecord;
  }

  private async findUserByWallet(walletAddress: string): Promise<any | null> {
    try {
      const { UsersService } = await import('@/shared/services/users.service');
      const usersService = new UsersService(this.db);
      return await usersService.getUserByWallet({ tenantId: '' }, walletAddress);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND' || error.code === ErrorCodes.NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  private async findUserById(userId: string): Promise<any | null> {
    try {
      const { UsersService } = await import('@/shared/services/users.service');
      const usersService = new UsersService(this.db);
      return await usersService.getUserById({ tenantId: '' }, userId);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND' || error.code === ErrorCodes.NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  private async migrateUserToRBAC(userRecord: any): Promise<void> {
    try {
      // Check if user already has RBAC roles
      const existingRoles = await this.rbacService.getUserRoles(userRecord.id);
      if (existingRoles.length > 0) {
        this.logger.debug('User already has RBAC roles', { 
          userId: userRecord.id, 
          roleCount: existingRoles.length 
        });
        return;
      }

      // Migrate legacy admin flags to system roles
      if (userRecord.is_super_admin) {
        await this.rbacService.assignRole(
          userRecord.id,
          SystemRoleKey.SUPER_ADMIN,
          undefined,
          userRecord.id
        );
        this.logger.info('Migrated super admin to RBAC', { userId: userRecord.id });
      } else if (userRecord.is_admin) {
        await this.rbacService.assignRole(
          userRecord.id,
          SystemRoleKey.ADMIN,
          undefined,
          userRecord.id
        );
        this.logger.info('Migrated admin to RBAC', { userId: userRecord.id });
      }

      // Assign organization role based on legacy role
      const organizationRole = this.mapLegacyRoleToRBAC(userRecord.role);
      if (organizationRole && userRecord.organizationId) {
        await this.rbacService.assignRole(
          userRecord.id,
          organizationRole,
          userRecord.organizationId,
          userRecord.id
        );
        this.logger.info('Migrated organization role to RBAC', { 
          userId: userRecord.id,
          legacyRole: userRecord.role,
          newRole: organizationRole
        });
      }

    } catch (error: any) {
      this.logger.error('Failed to migrate user to RBAC', {
        error: error.message,
        userId: userRecord.id
      });
      // Don't fail authentication for migration errors
    }
  }

  private mapLegacyRoleToRBAC(legacyRole: string): OrganizationRoleKey | null {
    const roleMap: Record<string, OrganizationRoleKey> = {
      'owner': OrganizationRoleKey.OWNER,
      'admin': OrganizationRoleKey.ORG_ADMIN,
      'member': OrganizationRoleKey.MEMBER,
      'viewer': OrganizationRoleKey.VIEWER
    };
    
    return roleMap[legacyRole] || OrganizationRoleKey.MEMBER;
  }

  private async generateEnhancedJWT(userRecord: any, userPermissions: any): Promise<string> {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const tokenPayload: JWTPayload = {
      wallet_address: userRecord.wallet_address,
      user_id: userRecord.id,
      tenant_id: userRecord.organizationId,
      is_admin: userPermissions?.isSystemAdmin || false,
      is_super_admin: userPermissions?.canCrossOrganizations || false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    return jwt.sign(tokenPayload, jwtSecret);
  }

  private async buildAuthResponse(
    userRecord: any, 
    token: string, 
    userPermissions: any
  ): Promise<AuthResponse> {
    const user: User = {
      id: userRecord.id,
      wallet_address: userRecord.wallet_address,
      email: userRecord.email,
      display_name: userRecord.profile?.display_name,
      notification_preferences: userRecord.notification_preferences || {
        email_on_payment: true,
        email_on_invoice_viewed: true,
        email_on_reminders: true
      },
      stats: userRecord.stats || {
        invoice_count: 0,
        total_received: 0,
        last_active_at: new Date().toISOString()
      },
      created_at: userRecord.created_at,
      updated_at: userRecord.updated_at,
      is_admin: userPermissions?.isSystemAdmin || false,
      is_super_admin: userPermissions?.canCrossOrganizations || false,
      admin_granted_at: userRecord.admin_granted_at,
      admin_granted_by: userRecord.admin_granted_by
    };

    // Check if onboarding is needed
    const needsOnboarding = !userRecord.organization?.name || 
      userRecord.organization.name.includes("'s Organization");

    return {
      token,
      user,
      expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
      needsOnboarding,
      organization: userRecord.organization,
      isNewUser: false
    };
  }

  private parseAuthMessage(message: string): AuthMessage {
    const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
    const timestampMatch = message.match(/Timestamp: (\d+)/);

    if (!nonceMatch || !timestampMatch) {
      throw createValidationError('Invalid authentication message format');
    }

    return {
      message,
      nonce: nonceMatch[1],
      timestamp: parseInt(timestampMatch[1])
    };
  }
}