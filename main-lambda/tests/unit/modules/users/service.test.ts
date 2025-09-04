import { UserService } from '../../../../src/modules/users/service';
import { DatabaseService } from '../../../../src/shared/database/client';
import { AuthenticateWalletDTO } from '../../../../src/types/user';
import { createUnauthorizedError, createNotFoundError } from '../../../../src/shared/errors';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('../../../../src/shared/database/client');
jest.mock('ethers', () => ({
  verifyMessage: jest.fn(),
  isAddress: jest.fn()
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mocked-jwt-token')
}));

const mockEthers = ethers as jest.Mocked<typeof ethers>;

describe('UserService', () => {
  let userService: UserService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      save: jest.fn(),
      findById: jest.fn(),
      queryByPK: jest.fn(),
      queryGSI1: jest.fn(),
      queryGSI2: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchWrite: jest.fn()
    } as any;

    (DatabaseService as jest.Mock).mockImplementation(() => mockDb);

    userService = new UserService();

    // Mock environment variables
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authenticateWallet', () => {
    const validWalletAddress = '0x1234567890123456789012345678901234567890';
    const mockSignature = '0xabcdef123456789';
    const currentTime = Date.now();
    const validMessage = `Welcome to fluxion.pay!\n\nPlease sign this message to authenticate your wallet.\n\nWallet: ${validWalletAddress}\nNonce: abc123\nTimestamp: ${currentTime}`;

    it('should authenticate wallet successfully for existing user', async () => {
      const authData: AuthenticateWalletDTO = {
        wallet_address: validWalletAddress,
        signature: mockSignature,
        message: validMessage
      };

      const existingUser = {
        wallet_address: validWalletAddress,
        email: 'test@example.com',
        display_name: 'Test User',
        notification_preferences: {
          email_on_payment: true,
          email_on_invoice_viewed: true
        },
        stats: {
          invoice_count: 5,
          total_received: 1000,
          last_active_at: '2023-01-01T00:00:00.000Z'
        },
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      // Mock signature verification
      mockEthers.verifyMessage.mockReturnValueOnce(validWalletAddress);

      // Mock finding existing user
      mockDb.findById.mockResolvedValueOnce({
        PK: `USER#${validWalletAddress}`,
        SK: 'PROFILE',
        entityType: 'USER',
        created_at: existingUser.created_at,
        updated_at: existingUser.updated_at,
        data: {
          wallet_address: existingUser.wallet_address,
          email: existingUser.email,
          display_name: existingUser.display_name,
          notification_preferences: existingUser.notification_preferences,
          stats: existingUser.stats
        }
      } as any);

      mockDb.update.mockResolvedValueOnce({} as any);

      const result = await userService.authenticateWallet(authData);

      expect(result).toEqual({
        token: 'mocked-jwt-token',
        user: existingUser,
        expires_at: expect.any(String)
      });

      expect(mockEthers.verifyMessage).toHaveBeenCalledWith(validMessage, mockSignature);
      expect(mockDb.update).toHaveBeenCalled(); // Update last active
    });

    it('should create new user if not exists', async () => {
      const authData: AuthenticateWalletDTO = {
        wallet_address: validWalletAddress,
        signature: mockSignature,
        message: validMessage
      };

      mockEthers.verifyMessage.mockReturnValueOnce(validWalletAddress);

      // Mock user not found
      mockDb.findById.mockResolvedValueOnce(null);

      // Mock user creation
      mockDb.save.mockResolvedValueOnce(undefined);
      mockDb.update.mockResolvedValueOnce({} as any);

      const result = await userService.authenticateWallet(authData);

      expect(result.token).toBe('mocked-jwt-token');
      expect(result.user.wallet_address).toBe(validWalletAddress);
      expect(mockDb.save).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: `USER#${validWalletAddress}`,
          SK: 'PROFILE',
          entityType: 'USER'
        })
      );
    });

    it('should throw error for invalid signature', async () => {
      const authData: AuthenticateWalletDTO = {
        wallet_address: validWalletAddress,
        signature: mockSignature,
        message: validMessage
      };

      // Mock signature verification returning different address
      mockEthers.verifyMessage.mockReturnValueOnce('0x9999999999999999999999999999999999999999');

      await expect(userService.authenticateWallet(authData)).rejects.toThrow(
        createUnauthorizedError('Invalid signature - wallet address mismatch')
      );
    });

    it('should throw error for expired message', async () => {
      const oldTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      const expiredMessage = `Welcome to fluxion.pay!\n\nPlease sign this message to authenticate your wallet.\n\nWallet: ${validWalletAddress}\nNonce: abc123\nTimestamp: ${oldTime}`;

      const authData: AuthenticateWalletDTO = {
        wallet_address: validWalletAddress,
        signature: mockSignature,
        message: expiredMessage
      };

      mockEthers.verifyMessage.mockReturnValueOnce(validWalletAddress);

      await expect(userService.authenticateWallet(authData)).rejects.toThrow(
        createUnauthorizedError('Authentication message too old')
      );
    });
  });

  describe('generateAuthMessage', () => {
    it('should generate valid auth message', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const domain = 'test.example.com';

      const result = userService.generateAuthMessage(walletAddress, domain);

      expect(result.message).toContain(`Welcome to ${domain}!`);
      expect(result.message).toContain(`Wallet: ${walletAddress}`);
      expect(result.message).toContain(`Nonce: ${result.nonce}`);
      expect(result.message).toContain(`Timestamp: ${result.timestamp}`);
      expect(result.nonce).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default domain if not provided', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';

      const result = userService.generateAuthMessage(walletAddress);

      expect(result.message).toContain('Welcome to fluxion.pay!');
    });
  });

  describe('findByWalletAddress', () => {
    it('should find user by wallet address', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const mockUserEntity = {
        PK: `USER#${walletAddress}`,
        SK: 'PROFILE',
        entityType: 'USER',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {
          wallet_address: walletAddress,
          email: 'test@example.com',
          display_name: 'Test User',
          notification_preferences: {
            email_on_payment: true,
            email_on_invoice_viewed: true
          },
          stats: {
            invoice_count: 5,
            total_received: 1000,
            last_active_at: '2023-01-01T00:00:00.000Z'
          }
        }
      };

      mockDb.findById.mockResolvedValueOnce(mockUserEntity as any);

      const result = await userService.findByWalletAddress(walletAddress);

      expect(result).toEqual(
        expect.objectContaining({
          wallet_address: walletAddress,
          email: 'test@example.com',
          display_name: 'Test User'
        })
      );

      expect(mockDb.findById).toHaveBeenCalledWith(`USER#${walletAddress}`, 'PROFILE');
    });

    it('should return null when user not found', async () => {
      mockDb.findById.mockResolvedValueOnce(null);

      const result = await userService.findByWalletAddress('0x1234567890123456789012345678901234567890');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const existingUser = {
        wallet_address: walletAddress,
        email: 'old@example.com',
        display_name: 'Old Name',
        notification_preferences: {
          email_on_payment: true,
          email_on_invoice_viewed: true
        },
        stats: {
          invoice_count: 5,
          total_received: 1000,
          last_active_at: '2023-01-01T00:00:00.000Z'
        },
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const updateData = {
        email: 'new@example.com',
        display_name: 'New Name',
        notification_preferences: {
          email_on_payment: false,
          email_on_invoice_viewed: true
        }
      };

      // Mock finding existing user
      mockDb.findById.mockResolvedValueOnce({
        data: existingUser
      } as any);

      mockDb.update.mockResolvedValueOnce({} as any);

      // Mock finding updated user
      mockDb.findById.mockResolvedValueOnce({
        data: {
          ...existingUser,
          ...updateData
        }
      } as any);

      const result = await userService.updateProfile(walletAddress, updateData);

      expect(result.email).toBe(updateData.email);
      expect(result.display_name).toBe(updateData.display_name);
      expect(result.notification_preferences).toEqual(updateData.notification_preferences);

      expect(mockDb.update).toHaveBeenCalledWith(
        `USER#${walletAddress}`,
        'PROFILE',
        expect.objectContaining({
          updated_at: expect.any(String)
        })
      );
    });

    it('should throw error when user not found', async () => {
      mockDb.findById.mockResolvedValueOnce(null);

      await expect(
        userService.updateProfile('0x1234567890123456789012345678901234567890', {})
      ).rejects.toThrow(createNotFoundError('User', '0x1234567890123456789012345678901234567890'));
    });
  });

  describe('updateStats', () => {
    it('should update user statistics', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const existingUser = {
        wallet_address: walletAddress,
        stats: {
          invoice_count: 5,
          total_received: 1000,
          last_active_at: '2023-01-01T00:00:00.000Z'
        }
      };

      mockDb.findById.mockResolvedValueOnce({
        data: existingUser
      } as any);

      mockDb.update.mockResolvedValueOnce({} as any);

      const statsUpdate = {
        invoice_count_delta: 2,
        total_received_delta: 500
      };

      await userService.updateStats(walletAddress, statsUpdate);

      expect(mockDb.update).toHaveBeenCalledWith(
        `USER#${walletAddress}`,
        'PROFILE',
        expect.objectContaining({
          'data.stats': expect.objectContaining({
            invoice_count: 7, // 5 + 2
            total_received: 1500, // 1000 + 500
            last_active_at: expect.any(String)
          }),
          updated_at: expect.any(String)
        })
      );
    });

    it('should handle negative deltas and prevent negative values', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const existingUser = {
        wallet_address: walletAddress,
        stats: {
          invoice_count: 2,
          total_received: 100,
          last_active_at: '2023-01-01T00:00:00.000Z'
        }
      };

      mockDb.findById.mockResolvedValueOnce({
        data: existingUser
      } as any);

      mockDb.update.mockResolvedValueOnce({} as any);

      const statsUpdate = {
        invoice_count_delta: -5, // Would result in -3, but should be clamped to 0
        total_received_delta: -200 // Would result in -100, but should be clamped to 0
      };

      await userService.updateStats(walletAddress, statsUpdate);

      expect(mockDb.update).toHaveBeenCalledWith(
        `USER#${walletAddress}`,
        'PROFILE',
        expect.objectContaining({
          'data.stats': expect.objectContaining({
            invoice_count: 0,
            total_received: 0
          })
        })
      );
    });

    it('should handle non-existent user gracefully', async () => {
      mockDb.findById.mockResolvedValueOnce(null);

      // Should not throw an error
      await expect(
        userService.updateStats('0x1234567890123456789012345678901234567890', { invoice_count_delta: 1 })
      ).resolves.not.toThrow();

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('getUserStats', () => {
    it('should get user statistics', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const mockUser = {
        stats: {
          invoice_count: 10,
          total_received: 5000,
          last_active_at: '2023-01-01T00:00:00.000Z'
        }
      };

      mockDb.findById.mockResolvedValueOnce({
        data: mockUser
      } as any);

      const result = await userService.getUserStats(walletAddress);

      expect(result).toEqual(mockUser.stats);
    });

    it('should throw error when user not found', async () => {
      mockDb.findById.mockResolvedValueOnce(null);

      await expect(
        userService.getUserStats('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow(createNotFoundError('User', '0x1234567890123456789012345678901234567890'));
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      mockDb.delete.mockResolvedValueOnce(undefined);

      await userService.deleteUser(walletAddress);

      expect(mockDb.delete).toHaveBeenCalledWith(`USER#${walletAddress}`, 'PROFILE');
    });
  });

  describe('isValidWalletAddress', () => {
    it('should validate wallet address', () => {
      mockEthers.isAddress.mockReturnValueOnce(true);

      const result = userService.isValidWalletAddress('0x1234567890123456789012345678901234567890');

      expect(result).toBe(true);
      expect(mockEthers.isAddress).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('should return false for invalid address', () => {
      mockEthers.isAddress.mockReturnValueOnce(false);

      const result = userService.isValidWalletAddress('invalid-address');

      expect(result).toBe(false);
    });
  });
});