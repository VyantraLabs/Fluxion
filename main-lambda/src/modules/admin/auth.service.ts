import jwt from 'jsonwebtoken';
import { getDatabase } from '@/shared/database/client';
import { getBlockchainService } from '@/shared/blockchain/client';
import { Logger } from '@/shared/utils/logger';
import { RBACService } from '@/shared/services/rbac.service';
import { UserRepository } from '@/database/repositories/UserRepository';
import { 
  createNotFoundError, 
  createUnauthorizedError, 
  createAuthenticationError,
  createSignatureVerificationError,
  createMessageExpiredError,
  createInvalidMessageFormatError
} from '@/shared/errors';
import { 
  AuthenticateWalletDTO, 
  AuthResponse,
  JWTPayload,
  AuthMessage,
  User
} from '@/types/user';
import { RoleType, SystemRoleKey } from '@/database/entities/Role';

export class AdminAuthService {
  private db = getDatabase();
  private blockchain = getBlockchainService();
  private rbacService = new RBACService(this.db);
  private userRepository = new UserRepository();
  private logger = new Logger('AdminAuthService');

  /**
   * Generate authentication message for potential system users
   */
  async generateAuthMessage(walletAddress: string): Promise<{ message: string }> {
    this.logger.info('Generating admin auth message', { 
      wallet_address: walletAddress 
    });

    // Check if this wallet address has any system roles
    const userWithSystemRoles = await this.userRepository.findByWalletAddressWithSystemRoles(walletAddress);
    
    if (!userWithSystemRoles || userWithSystemRoles.systemRoles.length === 0) {
      throw createUnauthorizedError('Wallet address not authorized for system admin access');
    }

    const nonce = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();
    
    const message = `Fluxion Admin Authentication

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp}
Action: Admin Login

This request will not trigger any blockchain transaction or cost any gas fees.`;

    return { message };
  }

  /**
   * Verify wallet signature and authenticate system admin user
   */
  async verifyAndAuthenticate(data: AuthenticateWalletDTO): Promise<AuthResponse> {
    const requestId = `admin_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    this.logger.info('Starting admin wallet authentication', { 
      wallet_address: data.wallet_address,
      request_id: requestId 
    });

    try {
      // Step 1: Signature Verification
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
        this.logger.warn('Invalid signature provided for admin auth', { 
          wallet_address: data.wallet_address,
          request_id: requestId 
        });
        throw createSignatureVerificationError('Invalid wallet signature');
      }

      // Step 2: Message Validation
      let authMessage: AuthMessage;
      try {
        authMessage = this.parseAuthMessage(data.message);
      } catch (parseError: any) {
        this.logger.error('Failed to parse admin auth message', { 
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
        this.logger.warn('Admin authentication message expired', { 
          wallet_address: data.wallet_address,
          message_age_ms: messageAge,
          request_id: requestId 
        });
        throw createMessageExpiredError('Authentication message has expired');
      }

      // Step 3: Get user with system roles
      const userWithSystemRoles = await this.userRepository.findByWalletAddressWithSystemRoles(data.wallet_address);
      
      if (!userWithSystemRoles || userWithSystemRoles.systemRoles.length === 0) {
        this.logger.warn('Wallet has no system roles', { 
          wallet_address: data.wallet_address,
          request_id: requestId 
        });
        throw createUnauthorizedError('No system admin privileges found for this wallet');
      }

      // Step 4: Generate JWT with system roles
      const token = this.generateSystemAdminJWT(userWithSystemRoles);

      // Step 5: Build response
      const user: User = {
        id: userWithSystemRoles.id,
        wallet_address: userWithSystemRoles.walletAddress,
        email: userWithSystemRoles.email,
        display_name: userWithSystemRoles.profile?.displayName,
        role: userWithSystemRoles.systemRoles[0], // Primary system role
        notification_preferences: userWithSystemRoles.notificationPreferences || {
          email_on_payment: false,
          email_on_invoice_viewed: false,
          email_on_reminders: false
        },
        stats: userWithSystemRoles.stats || {
          invoice_count: 0,
          total_received: 0,
          last_active_at: new Date().toISOString()
        },
        created_at: userWithSystemRoles.createdAt.toISOString(),
        updated_at: userWithSystemRoles.updatedAt.toISOString()
      };

      const authResponse: AuthResponse = {
        token,
        user,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        needsOnboarding: false,
        organization: userWithSystemRoles.organization ? {
          id: userWithSystemRoles.organization.id,
          name: userWithSystemRoles.organization.name,
          slug: userWithSystemRoles.organization.slug
        } : undefined
      };

      this.logger.info('Admin authentication successful', {
        user_id: userWithSystemRoles.id,
        system_roles: userWithSystemRoles.systemRoles,
        request_id: requestId
      });

      return authResponse;

    } catch (error: any) {
      this.logger.error('Admin authentication failed', {
        error: error.message,
        wallet_address: data.wallet_address,
        request_id: requestId
      });
      throw error;
    }
  }

  /**
   * Get current admin profile with system roles
   */
  async getAdminProfile(userId: string): Promise<User & { systemRoles: string[] }> {
    this.logger.info('Getting admin profile', { user_id: userId });

    const userWithSystemRoles = await this.userRepository.findByIdWithSystemRoles(userId);
    
    if (!userWithSystemRoles || userWithSystemRoles.systemRoles.length === 0) {
      throw createUnauthorizedError('User does not have system admin privileges');
    }

    const user: User & { systemRoles: string[] } = {
      id: userWithSystemRoles.id,
      wallet_address: userWithSystemRoles.walletAddress,
      email: userWithSystemRoles.email,
      display_name: userWithSystemRoles.profile?.displayName,
      role: userWithSystemRoles.systemRoles[0], // Primary system role
      notification_preferences: userWithSystemRoles.notificationPreferences || {
        email_on_payment: false,
        email_on_invoice_viewed: false,
        email_on_reminders: false
      },
      stats: userWithSystemRoles.stats || {
        invoice_count: 0,
        total_received: 0,
        last_active_at: new Date().toISOString()
      },
      created_at: userWithSystemRoles.createdAt.toISOString(),
      updated_at: userWithSystemRoles.updatedAt.toISOString(),
      systemRoles: userWithSystemRoles.systemRoles
    };

    return user;
  }

  /**
   * Parse authentication message
   */
  private parseAuthMessage(message: string): AuthMessage {
    // Extract nonce and timestamp from the message
    const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    
    if (!nonceMatch || !timestampMatch) {
      throw new Error('Invalid message format');
    }

    return {
      message,
      nonce: nonceMatch[1],
      timestamp: parseInt(timestampMatch[1], 10)
    };
  }

  /**
   * Generate JWT token for system admin
   */
  private generateSystemAdminJWT(user: any): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const tokenPayload: JWTPayload = {
      wallet_address: user.walletAddress,
      user_id: user.id,
      tenant_id: user.organizationId,
      role: user.systemRoles[0], // Primary system role
      is_admin: true,
      is_super_admin: user.systemRoles.includes(SystemRoleKey.SUPER_ADMIN),
      system_roles: user.systemRoles,
      is_system_user: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    return jwt.sign(tokenPayload, jwtSecret);
  }

}