import jwt from 'jsonwebtoken';
import { getDatabase } from '../../shared/database/client';
import { getBlockchainService } from '../../shared/blockchain/client';
import { Logger } from '../../shared/utils/logger';
import { auditEventService } from '../../shared/services/audit-event.service';
import { getDefaultRole, Role, isValidRole } from '../../shared/utils/role-hierarchy';
import { 
  createNotFoundError, 
  createUnauthorizedError, 
  createValidationError,
  createAuthenticationError,
  createSignatureVerificationError,
  createMessageExpiredError,
  createInvalidMessageFormatError,
  createRepositoryOperationError,
  FluxionError,
  normalizeError
} from '../../shared/errors';
import { ErrorCodes } from '../../types/common';
import { 
  User, 
  UserEntity, 
  AuthenticateWalletDTO, 
  UpdateUserProfileDTO,
  CompleteOnboardingDTO,
  AuthResponse,
  JWTPayload,
  AuthMessage
} from '../../types/user';

export class UserService {
  private db = getDatabase();
  private blockchain = getBlockchainService();
  private logger = new Logger('UserService');

  /**
   * Authenticate user with wallet signature (FAULT-TOLERANT VERSION)
   * Returns success only for EXISTING users, throws NOT_FOUND for new users
   */
  async authenticateWallet(data: AuthenticateWalletDTO): Promise<AuthResponse> {
    const requestId = `auth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    this.logger.info('Starting wallet authentication', { 
      wallet_address: data.wallet_address,
      request_id: requestId 
    });

    try {
      // Step 1: Signature Verification (CRITICAL - Must succeed)
      let isValidSignature = false;
      try {
        isValidSignature = this.blockchain.verifyWalletSignature(
          data.message,
          data.signature,
          data.wallet_address
        );
      } catch (blockchainError: any) {
        this.logger.error('Blockchain signature verification failed', { 
          error: blockchainError.message,
          wallet_address: data.wallet_address,
          request_id: requestId 
        });
        throw createSignatureVerificationError('Signature verification service unavailable');
      }
      
      if (!isValidSignature) {
        this.logger.warn('Invalid signature provided', { 
          wallet_address: data.wallet_address,
          request_id: requestId 
        });
        throw createSignatureVerificationError('Invalid wallet signature');
      }

      // Step 2: Message Validation (CRITICAL - Must succeed)
      let authMessage: AuthMessage;
      try {
        authMessage = this.parseAuthMessage(data.message);
      } catch (parseError: any) {
        this.logger.error('Failed to parse auth message', { 
          error: parseError.message,
          wallet_address: data.wallet_address,
          request_id: requestId 
        });
        throw createInvalidMessageFormatError('Authentication message format is invalid');
      }

      const now = Date.now();
      const messageAge = now - authMessage.timestamp;
      
      // Message should be less than 5 minutes old
      if (messageAge > 5 * 60 * 1000) {
        this.logger.warn('Authentication message expired', { 
          wallet_address: data.wallet_address,
          message_age_ms: messageAge,
          request_id: requestId 
        });
        throw createMessageExpiredError('Authentication message has expired');
      }

      // Step 3: User Lookup (CRITICAL - Must succeed)
      const { UsersService } = await import('../../shared/services/users.service');
      const usersService = new UsersService(this.db);
      
      let userRecord: any;
      try {
        userRecord = await usersService.getUserByWallet({ tenantId: '' }, data.wallet_address);
        this.logger.info('User found for authentication', { 
          wallet_address: data.wallet_address, 
          user_id: userRecord.id,
          request_id: requestId 
        });
      } catch (error: any) {
        if (error.code === 'NOT_FOUND' || error.code === ErrorCodes.NOT_FOUND) {
          this.logger.info('User not found during authentication', { 
            wallet_address: data.wallet_address,
            request_id: requestId 
          });
          throw createNotFoundError('User', data.wallet_address);
        } else {
          this.logger.error('User lookup failed', { 
            error: error.message,
            wallet_address: data.wallet_address,
            request_id: requestId 
          });
          throw createAuthenticationError('User lookup failed');
        }
      }
      
      // Step 4: JWT Secret Validation (CRITICAL - Must succeed)
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET not configured', { request_id: requestId });
        throw createAuthenticationError('Authentication system configuration error');
      }

      // Step 5: Role Resolution - Use single role from RBAC or database
      let userRole: Role = getDefaultRole(); // Start with default role
      try {
        const { RBACService } = await import('../../shared/services/rbac.service');
        const { AppDataSource } = await import('../../database/data-source');
        const rbacService = new RBACService(AppDataSource);
        
        // Get user's active role from RBAC system
        const userRoles = await rbacService.getUserRoles(userRecord.id, userRecord.tenant_id);
        if (userRoles && userRoles.length > 0) {
          // Find the highest priority role that's still active
          const activeRoles = userRoles.filter(ur => !ur.isExpired);
          if (activeRoles.length > 0) {
            const sortedRoles = activeRoles.sort((a, b) => (b.role?.priority || 0) - (a.role?.priority || 0));
            const primaryRole = sortedRoles[0];
            if (primaryRole.role?.key && isValidRole(primaryRole.role.key)) {
              userRole = primaryRole.role.key as Role;
            }
          }
        }
        
        // Fallback to database role if RBAC doesn't have a valid role
        if (userRole === getDefaultRole() && userRecord.role && isValidRole(userRecord.role)) {
          userRole = userRecord.role as Role;
        }
        
        this.logger.info('User role resolved', { 
          user_id: userRecord.id,
          database_role: userRecord.role,
          final_role: userRole,
          rbac_roles_count: userRoles?.length || 0,
          request_id: requestId
        });
      } catch (rbacError: any) {
        this.logger.warn('Role resolution failed, using default', { 
          user_id: userRecord.id,
          error: rbacError.message,
          fallback_role: userRole,
          request_id: requestId
        });
        // Continue with default role - this is non-critical
      }

      // Step 6: Update last login timestamp (NON-CRITICAL)
      let lastLoginUpdated = false;
      
      try {
        const { UserRepository } = await import('../../database/repositories/UserRepository');
        const userRepo = new UserRepository();
        const typeormUser = await userRepo.findById({ tenantId: userRecord.tenant_id }, userRecord.id);
        
        if (typeormUser) {
          try {
            typeormUser.lastLoginAt = new Date();
            await userRepo.save(typeormUser);
            lastLoginUpdated = true;
            
            this.logger.debug('Last login timestamp updated', { 
              user_id: userRecord.id,
              request_id: requestId
            });
          } catch (saveError: any) {
            this.logger.warn('Failed to update last login timestamp', {
              user_id: userRecord.id,
              error: saveError.message,
              request_id: requestId
            });
            // Continue - this is non-critical
          }
        }
      } catch (repoError: any) {
        this.logger.warn('Failed to update last login', {
          user_id: userRecord.id,
          error: repoError.message,
          request_id: requestId
        });
        // Continue - this is non-critical
      }

      // Step 7: Enhanced Audit Event Emission (NON-CRITICAL - Graceful degradation)
      try {
        // Emit login success event using new audit system
        await auditEventService.emitLogin(
          {
            userId: userRecord.id,
            organizationId: userRecord.tenant_id,
            requestId
          },
          true, // success = true
          {
            wallet_address: userRecord.wallet_address,
            login_method: 'wallet_signature',
            last_login_updated: lastLoginUpdated,
            user_agent: 'API',
            signature_valid: isValidSignature,
            source: 'authentication_service'
          }
        );
        
        this.logger.debug('Audit event emitted for successful login', { 
          user_id: userRecord.id,
          request_id: requestId
        });
      } catch (auditError: any) {
        this.logger.warn('Failed to emit login audit event', {
          user_id: userRecord.id,
          error: auditError.message,
          request_id: requestId
        });
        // Continue - this is non-critical
      }
      
      // Step 8: JWT Token Generation (CRITICAL - Must succeed)
      let token: string;
      try {
        const tokenPayload: JWTPayload = {
          wallet_address: data.wallet_address,
          user_id: userRecord.id,
          tenant_id: userRecord.tenant_id,
          role: userRole,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        };

        token = jwt.sign(tokenPayload, jwtSecret);
      } catch (jwtError: any) {
        this.logger.error('JWT token generation failed', {
          user_id: userRecord.id,
          error: jwtError.message,
          request_id: requestId
        });
        throw createAuthenticationError('Token generation failed');
      }

      // Step 9: User object construction with single role
      this.logger.debug('User authentication complete', {
        user_id: userRecord.id,
        role: userRole,
        request_id: requestId
      });

      // Step 10: Response Construction (CRITICAL - Must succeed)
      const user: User = {
        id: userRecord.id,
        wallet_address: userRecord.wallet_address,
        email: userRecord.email,
        display_name: userRecord.profile?.display_name,
        notification_preferences: userRecord.notification_preferences,
        stats: userRecord.stats,
        created_at: userRecord.created_at,
        updated_at: userRecord.updated_at,
        role: userRole
      };

      const needsOnboarding = !userRecord.organization?.name || 
        userRecord.organization.name.includes("'s Organization");

      const authResponse: AuthResponse = {
        token,
        user,
        expires_at: new Date((Math.floor(Date.now() / 1000) + 24 * 60 * 60) * 1000).toISOString(),
        needsOnboarding,
        organization: userRecord.organization,
        isNewUser: false
      };

      this.logger.info('Wallet authentication successful', { 
        wallet_address: data.wallet_address,
        user_id: userRecord.id,
        tenant_id: userRecord.tenant_id,
        role: userRole,
        needs_onboarding: needsOnboarding,
        last_login_updated: lastLoginUpdated,
        request_id: requestId
      });

      return authResponse;
      
    } catch (error: any) {
      // Classify and log errors properly
      const normalizedError = normalizeError(error);
      
      this.logger.error('Wallet authentication failed', { 
        error: normalizedError.message,
        error_code: normalizedError.code,
        status_code: normalizedError.statusCode,
        wallet_address: data.wallet_address,
        request_id: requestId
      });

      // Emit failed login audit event (NON-CRITICAL)
      try {
        await auditEventService.emitLogin(
          {
            requestId
          },
          false, // success = false
          {
            wallet_address: data.wallet_address,
            login_method: 'wallet_signature',
            error_code: normalizedError.code,
            error_message: normalizedError.message,
            signature_valid: false,
            source: 'authentication_service',
            failure_reason: normalizedError.message
          }
        );
        
        this.logger.debug('Failed login audit event emitted', { 
          wallet_address: data.wallet_address,
          error_code: normalizedError.code,
          request_id: requestId
        });
      } catch (auditError: any) {
        this.logger.warn('Failed to emit login failure audit event', {
          wallet_address: data.wallet_address,
          error: auditError.message,
          request_id: requestId
        });
        // Continue - this is non-critical
      }
      
      // Re-throw the properly classified error
      throw normalizedError;
    }
  }

  /**
   * Create new user with organization (for onboarding flow)
   */
  async createNewUser(data: AuthenticateWalletDTO & { 
    organizationName?: string;
    displayName?: string; 
    email?: string;
  }): Promise<AuthResponse> {
    this.logger.info('Creating new user with organization', { 
      wallet_address: data.wallet_address,
      organization_name: data.organizationName 
    });

    // Verify the signature first
    try {
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
      
      if (messageAge > 5 * 60 * 1000) {
        throw createUnauthorizedError('Authentication message too old');
      }

      // Use the shared users service to create user with organization
      const { UsersService } = await import('../../shared/services/users.service');
      const usersService = new UsersService(this.db);
      
      // Check if user already exists
      try {
        const existingUser = await usersService.getUserByWallet({ tenantId: '' }, data.wallet_address);
        if (existingUser) {
          throw new Error('User already exists. Please use the login flow instead.');
        }
      } catch (error: any) {
        // User not found is expected for new user creation
        if (error.code !== 'NOT_FOUND' && error.code !== ErrorCodes.NOT_FOUND) {
          throw error;
        }
      }

      // Create new user with organization  
      const userRecord = await usersService.createUser({ tenantId: '' }, {
        wallet_address: data.wallet_address,
        organizationName: data.organizationName || `${data.wallet_address.substring(0, 8)}'s Organization`,
        email: data.email,
        profile: {
          display_name: data.displayName
        }
      });

      // Get user's role - new users get 'owner' role for their organization
      let userRole: Role = userRecord.role && isValidRole(userRecord.role) ? userRecord.role as Role : 'owner';
      
      try {
        const { RBACService } = await import('../../shared/services/rbac.service');
        const { AppDataSource } = await import('../../database/data-source');
        const rbacService = new RBACService(AppDataSource);
        
        // Get user's active role from RBAC system
        const userRoles = await rbacService.getUserRoles(userRecord.id, userRecord.tenant_id);
        if (userRoles && userRoles.length > 0) {
          const activeRoles = userRoles.filter(ur => !ur.isExpired);
          if (activeRoles.length > 0) {
            const sortedRoles = activeRoles.sort((a, b) => (b.role?.priority || 0) - (a.role?.priority || 0));
            const primaryRole = sortedRoles[0];
            if (primaryRole.role?.key && isValidRole(primaryRole.role.key)) {
              userRole = primaryRole.role.key as Role;
            }
          }
        }
        
        this.logger.info('New user role resolved', { 
          user_id: userRecord.id,
          wallet_address: userRecord.wallet_address,
          role: userRole,
          total_roles: userRoles?.length || 0
        });
      } catch (rbacError) {
        this.logger.warn('Failed to resolve role for new user, using owner', { 
          user_id: userRecord.id,
          error: rbacError.message,
          fallback_role: userRole
        });
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const tokenPayload: JWTPayload = {
        wallet_address: data.wallet_address,
        user_id: userRecord.id,
        tenant_id: userRecord.tenant_id,
        role: userRole, // Include role from RBAC system (now properly initialized)
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      };

      const token = jwt.sign(tokenPayload, jwtSecret);

      // Transform userRecord to User format for response
      const user: User = {
        id: userRecord.id,
        wallet_address: userRecord.wallet_address,
        email: userRecord.email,
        display_name: userRecord.profile?.display_name,
        notification_preferences: userRecord.notification_preferences,
        stats: userRecord.stats,
        created_at: userRecord.created_at,
        updated_at: userRecord.updated_at,
        // SECURITY: Admin flags are in JWT token only, NOT in API response
        role: userRole
      };

      const authResponse: AuthResponse = {
        token,
        user,
        expires_at: new Date(tokenPayload.exp * 1000).toISOString(),
        needsOnboarding: false, // User just completed onboarding
        organization: userRecord.organization,
        isNewUser: true
      };

      this.logger.info('New user created and authenticated successfully', { 
        wallet_address: data.wallet_address,
        user_id: userRecord.id,
        tenant_id: userRecord.tenant_id,
        organization_id: userRecord.organization?.id
      });

      return authResponse;
    } catch (error) {
      this.logger.error('New user creation failed', { 
        error,
        wallet_address: data.wallet_address 
      });
      
      if (error instanceof Error && error.message.includes('invalid signature')) {
        throw createUnauthorizedError('Invalid signature');
      }
      
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
   * Parse authentication message to extract components
   */
  private parseAuthMessage(message: string): AuthMessage {
    if (!message || typeof message !== 'string') {
      throw createInvalidMessageFormatError('Authentication message is required and must be a string');
    }

    const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
    const timestampMatch = message.match(/Timestamp: (\d+)/);

    if (!nonceMatch) {
      throw createInvalidMessageFormatError('Authentication message missing nonce');
    }
    
    if (!timestampMatch) {
      throw createInvalidMessageFormatError('Authentication message missing timestamp');
    }

    const timestamp = parseInt(timestampMatch[1]);
    if (isNaN(timestamp) || timestamp <= 0) {
      throw createInvalidMessageFormatError('Authentication message has invalid timestamp');
    }

    return {
      message,
      nonce: nonceMatch[1],
      timestamp
    };
  }

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    this.logger.info('Finding user by wallet address', { wallet_address: walletAddress });

    try {
      // Use the shared users service with cross-tenant search capability
      const { UsersService } = await import('../../shared/services/users.service');
      const usersService = new UsersService(this.db);

      // Try to get existing user, if not found return null
      // Note: getUserByWallet does cross-tenant search, so tenant context is ignored
      let userRecord;
      try {
        userRecord = await usersService.getUserByWallet({ tenantId: '' }, walletAddress);
      } catch (error: any) {
        this.logger.debug('getUserByWallet error details', { 
          wallet_address: walletAddress,
          errorCode: error.code,
          errorMessage: error.message,
          errorName: error.name,
          isFluxionError: error instanceof FluxionError,
          expectedCodes: ['NOT_FOUND', ErrorCodes.NOT_FOUND]
        });
        
        if (error.code === 'NOT_FOUND' || error.code === ErrorCodes.NOT_FOUND) {
          this.logger.info('User not found in database', { wallet_address: walletAddress });
          return null;
        }
        
        // Re-throw unexpected errors
        this.logger.error('Unexpected error in getUserByWallet', { 
          wallet_address: walletAddress, 
          error: error.message,
          code: error.code 
        });
        throw error;
      }
      
      // Transform userRecord to User format
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
        updated_at: userRecord.updated_at
      };

      this.logger.info('User found via PostgreSQL', { 
        wallet_address: walletAddress,
        user_id: user.id,
        display_name: user.display_name 
      });

      return user;
    } catch (error: any) {
      // For other errors, log and throw
      this.logger.error('Failed to find user by wallet address', { 
        error: error.message, 
        wallet_address: walletAddress 
      });
      throw error;
    }
  }

  /**
   * Create a new user
   */
  private async createUser(walletAddress: string): Promise<User> {
    this.logger.info('Creating new user', { wallet_address: walletAddress });

    try {
      // Use the new multi-table PostgreSQL service with proper error handling
      const { UsersService } = await import('../../shared/services/users.service');
      const usersService = new UsersService();
      const tenantContext = { tenantId: '01HBXYZ0000000000000000000' }; // Default tenant ULID for consistency

      // Use getOrCreateUserByWallet to handle tenant resolution and user creation
      const userRecord = await usersService.getOrCreateUserByWallet(tenantContext, walletAddress);

      // Transform PostgreSQL user record to legacy format
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
        updated_at: userRecord.updated_at
      };

      this.logger.info('User created successfully via PostgreSQL', { wallet_address: walletAddress });
      return user;
    } catch (error: any) {
      this.logger.error('Failed to create user', { error: error.message, wallet_address: walletAddress });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    walletAddress: string, 
    data: UpdateUserProfileDTO
  ): Promise<User> {
    this.logger.info('Updating user profile', { 
      wallet_address: walletAddress 
    });

    // Get existing user
    const existingUser = await this.findByWalletAddress(walletAddress);
    if (!existingUser) {
      throw createNotFoundError('User', walletAddress);
    }

    const now = new Date().toISOString();
    const updates: Partial<UserEntity> = {
      updated_at: now
    };

    // Prepare updates
    const updatedData = { ...existingUser };
    if (data.email !== undefined) updatedData.email = data.email;
    if (data.display_name !== undefined) updatedData.display_name = data.display_name;
    if (data.notification_preferences) {
      updatedData.notification_preferences = {
        ...updatedData.notification_preferences,
        ...data.notification_preferences
      };
    }

    updates.data = {
      wallet_address: walletAddress,
      email: updatedData.email,
      display_name: updatedData.display_name,
      notification_preferences: updatedData.notification_preferences,
      stats: updatedData.stats
    };

    try {
      await this.db.update(`USER#${walletAddress}`, 'PROFILE', updates);

      const updatedUser = await this.findByWalletAddress(walletAddress);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }

      this.logger.info('User profile updated successfully', { 
        wallet_address: walletAddress 
      });

      return updatedUser;
    } catch (error) {
      this.logger.error('Failed to update user profile', { 
        error,
        wallet_address: walletAddress 
      });
      throw error;
    }
  }

  /**
   * Update user last active timestamp
   */
  private async updateLastActive(walletAddress: string): Promise<void> {
    const now = new Date().toISOString();
    
    try {
      // First get the current user data, then update it
      const userEntity = await this.db.findById(`USER#${walletAddress}`, 'PROFILE');
      if (userEntity && userEntity.entityType === 'USER') {
        const userData = userEntity.data as any;
        if (userData.stats) {
          userData.stats.last_active_at = now;
        }
        
        await this.db.update(`USER#${walletAddress}`, 'PROFILE', {
          data: userData,
          GSI1PK: `ACTIVE#${now.split('T')[0]}`, // Update active date grouping
          updated_at: now
        });
      }

      this.logger.debug('User last active updated', { wallet_address: walletAddress });
    } catch (error) {
      this.logger.warn('Failed to update user last active', { 
        error,
        wallet_address: walletAddress 
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Update user statistics (called by other services)
   */
  async updateStats(walletAddress: string, stats: {
    invoice_count_delta?: number;
    total_received_delta?: number;
  }): Promise<void> {
    this.logger.info('Updating user statistics', { 
      wallet_address: walletAddress,
      stats 
    });

    const user = await this.findByWalletAddress(walletAddress);
    if (!user) {
      this.logger.warn('Cannot update stats for non-existent user', { 
        wallet_address: walletAddress 
      });
      return;
    }

    const now = new Date().toISOString();
    const newStats = {
      ...user.stats,
      last_active_at: now
    };

    if (stats.invoice_count_delta) {
      newStats.invoice_count = Math.max(0, newStats.invoice_count + stats.invoice_count_delta);
    }

    if (stats.total_received_delta) {
      newStats.total_received = Math.max(0, newStats.total_received + stats.total_received_delta);
    }

    try {
      // Get current user data and update stats
      const userEntity = await this.db.findById(`USER#${walletAddress}`, 'PROFILE');
      if (userEntity && userEntity.entityType === 'USER') {
        const userData = userEntity.data as any;
        userData.stats = newStats;
        
        await this.db.update(`USER#${walletAddress}`, 'PROFILE', {
          data: userData,
          updated_at: now
        });
      }

      this.logger.info('User statistics updated', { 
        wallet_address: walletAddress,
        new_stats: newStats 
      });
    } catch (error) {
      this.logger.error('Failed to update user statistics', { 
        error,
        wallet_address: walletAddress 
      });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(walletAddress: string): Promise<User['stats']> {
    const user = await this.findByWalletAddress(walletAddress);
    if (!user) {
      throw createNotFoundError('User', walletAddress);
    }

    return user.stats;
  }

  /**
   * Delete user (GDPR compliance)
   */
  async deleteUser(walletAddress: string): Promise<void> {
    this.logger.info('Deleting user', { wallet_address: walletAddress });

    // In a real implementation, you'd want to:
    // 1. Check if user has pending invoices
    // 2. Anonymize related data
    // 3. Keep minimal data for audit purposes

    try {
      await this.db.delete(`USER#${walletAddress}`, 'PROFILE');
      
      this.logger.info('User deleted successfully', { wallet_address: walletAddress });
    } catch (error) {
      this.logger.error('Failed to delete user', { error, wallet_address: walletAddress });
      throw error;
    }
  }

  /**
   * Validate wallet address format
   */
  isValidWalletAddress(address: string): boolean {
    return this.blockchain.isValidAddress(address);
  }

  /**
   * Get active users count (for analytics)
   */
  async getActiveUsersCount(days: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
      const result = await this.db.queryGSI1(`ACTIVE#${cutoffDate}`, {
        sortKeyCondition: '>=',
        GSI1SK: '',
        limit: 1000
      });

      const activeUsers = result.items.filter(item => item.entityType === 'USER');
      
      this.logger.info('Active users count retrieved', { 
        count: activeUsers.length,
        days 
      });

      return activeUsers.length;
    } catch (error) {
      this.logger.error('Failed to get active users count', { error, days });
      return 0;
    }
  }
}