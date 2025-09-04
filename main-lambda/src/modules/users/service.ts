import jwt from 'jsonwebtoken';
import { getDatabase } from '@/shared/database/client';
import { getBlockchainService } from '@/shared/blockchain/client';
import { Logger } from '@/shared/utils/logger';
import { 
  createNotFoundError, 
  createUnauthorizedError, 
  createValidationError,
  FluxionError
} from '@/shared/errors';
import { ErrorCodes } from '@/types/common';
import { 
  User, 
  UserEntity, 
  AuthenticateWalletDTO, 
  UpdateUserProfileDTO,
  AuthResponse,
  JWTPayload,
  AuthMessage
} from '@/types/user';

export class UserService {
  private db = getDatabase();
  private blockchain = getBlockchainService();
  private logger = new Logger('UserService');

  /**
   * Authenticate user with wallet signature
   */
  async authenticateWallet(data: AuthenticateWalletDTO): Promise<AuthResponse> {
    this.logger.info('Authenticating wallet', { 
      wallet_address: data.wallet_address 
    });

    // Verify the signature
    try {
      const isValidSignature = this.blockchain.verifyWalletSignature(
        data.message,
        data.signature,
        data.wallet_address
      );
      
      if (!isValidSignature) {
        throw createUnauthorizedError('Invalid signature - wallet address mismatch');
      }

      // Parse the message to validate timestamp and prevent replay attacks
      const authMessage = this.parseAuthMessage(data.message);
      const now = Date.now();
      const messageAge = now - authMessage.timestamp;
      
      // Message should be less than 5 minutes old
      if (messageAge > 5 * 60 * 1000) {
        throw createUnauthorizedError('Authentication message too old');
      }

      // Get or create user
      let user = await this.findByWalletAddress(data.wallet_address);
      if (!user) {
        user = await this.createUser(data.wallet_address);
      } else {
        // Update last active time
        await this.updateLastActive(data.wallet_address);
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const tokenPayload: JWTPayload = {
        wallet_address: data.wallet_address,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      };

      const token = jwt.sign(tokenPayload, jwtSecret);

      const authResponse: AuthResponse = {
        token,
        user,
        expires_at: new Date(tokenPayload.exp * 1000).toISOString()
      };

      this.logger.info('Wallet authentication successful', { 
        wallet_address: data.wallet_address 
      });

      return authResponse;
    } catch (error) {
      this.logger.error('Wallet authentication failed', { 
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

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    this.logger.info('Finding user by wallet address', { wallet_address: walletAddress });

    try {
      // Use the new multi-table PostgreSQL service
      const { UsersService } = await import('@/shared/services/users.service');
      const usersService = new UsersService(this.db);
      const tenantContext = { tenantId: 'default' }; // Default tenant for legacy compatibility

      // First try to get existing user, if not found return null
      let userRecord;
      try {
        userRecord = await usersService.getUserByWallet(tenantContext, walletAddress);
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
      
      // Transform PostgreSQL user record to legacy format
      const user: User = {
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
      const { UsersService } = await import('@/shared/services/users.service');
      const usersService = new UsersService(this.db);
      const tenantContext = { tenantId: 'default' }; // Default tenant for legacy compatibility

      // Use getOrCreateUserByWallet to handle tenant resolution and user creation
      const userRecord = await usersService.getOrCreateUserByWallet(tenantContext, walletAddress);

      // Transform PostgreSQL user record to legacy format
      const user: User = {
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