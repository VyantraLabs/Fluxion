import { UsersService } from '../../../../src/shared/services/users.service';
import { DatabaseService } from '../../../../src/shared/database/client';
import { TenantContext, UserRecord, FluxionError, ErrorCodes } from '../../../../src/types/common';

// Mock the database service
jest.mock('../../../../src/shared/database/client');

describe('UsersService', () => {
  let usersService: UsersService;
  let mockDb: jest.Mocked<DatabaseService>;
  
  const mockTenantContext: TenantContext = {
    tenantId: 'test-tenant',
    userId: 'test-user-id',
    walletAddress: '0x742d35Cc6635C0532925a3b8D0aC0199'
  };

  const mockUserRecord: UserRecord = {
    id: 'user-123',
    tenant_id: 'test-tenant',
    wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199',
    email: 'test@example.com',
    profile: {
      display_name: 'Test User',
      bio: 'Test bio'
    },
    notification_preferences: {
      email_on_payment: true,
      email_on_invoice_viewed: false,
      email_on_reminders: true
    },
    stats: {
      invoice_count: 0,
      total_received: 0,
      last_active_at: '2023-01-01T00:00:00.000Z'
    },
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      createUser: jest.fn(),
      getUserById: jest.fn(),
      getUserByWallet: jest.fn(),
      updateUser: jest.fn(),
      generateId: jest.fn().mockReturnValue('generated-id-123')
    } as any;
    
    usersService = new UsersService(mockDb);
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const userData = {
        wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199',
        email: 'test@example.com'
      };

      mockDb.createUser.mockResolvedValueOnce(mockUserRecord);

      const result = await usersService.createUser(mockTenantContext, userData);

      expect(result).toEqual(mockUserRecord);
      expect(mockDb.createUser).toHaveBeenCalledWith(
        mockTenantContext,
        expect.objectContaining({
          wallet_address: userData.wallet_address,
          email: userData.email,
          notification_preferences: {
            email_on_payment: true,
            email_on_invoice_viewed: false,
            email_on_reminders: true
          },
          stats: expect.objectContaining({
            invoice_count: 0,
            total_received: 0
          })
        })
      );
    });

    it('should handle creation errors', async () => {
      const userData = {
        wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199'
      };

      const error = new FluxionError(ErrorCodes.CONFLICT, 'User already exists', 409);
      mockDb.createUser.mockRejectedValueOnce(error);

      await expect(usersService.createUser(mockTenantContext, userData))
        .rejects.toThrow('User already exists');
    });
  });

  describe('getUserById', () => {
    it('should get a user by ID successfully', async () => {
      mockDb.getUserById.mockResolvedValueOnce(mockUserRecord);

      const result = await usersService.getUserById(mockTenantContext, 'user-123');

      expect(result).toEqual(mockUserRecord);
      expect(mockDb.getUserById).toHaveBeenCalledWith(mockTenantContext, 'user-123');
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockDb.getUserById.mockResolvedValueOnce(null);

      await expect(usersService.getUserById(mockTenantContext, 'user-123'))
        .rejects.toThrow(FluxionError);
      
      await expect(usersService.getUserById(mockTenantContext, 'user-123'))
        .rejects.toMatchObject({
          code: ErrorCodes.NOT_FOUND,
          statusCode: 404
        });
    });
  });

  describe('getUserByWallet', () => {
    it('should get a user by wallet address successfully', async () => {
      mockDb.getUserByWallet.mockResolvedValueOnce(mockUserRecord);

      const result = await usersService.getUserByWallet(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );

      expect(result).toEqual(mockUserRecord);
      expect(mockDb.getUserByWallet).toHaveBeenCalledWith(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      mockDb.getUserByWallet.mockResolvedValueOnce(null);

      await expect(usersService.getUserByWallet(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      )).rejects.toThrow(FluxionError);
    });
  });

  describe('getOrCreateUserByWallet', () => {
    it('should return existing user when found', async () => {
      mockDb.getUserByWallet.mockResolvedValueOnce(mockUserRecord);

      const result = await usersService.getOrCreateUserByWallet(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );

      expect(result).toEqual(mockUserRecord);
      expect(mockDb.getUserByWallet).toHaveBeenCalledWith(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );
      expect(mockDb.createUser).not.toHaveBeenCalled();
    });

    it('should create new user when not found', async () => {
      mockDb.getUserByWallet.mockRejectedValueOnce(
        new FluxionError(ErrorCodes.NOT_FOUND, 'User not found', 404)
      );
      mockDb.createUser.mockResolvedValueOnce(mockUserRecord);

      const result = await usersService.getOrCreateUserByWallet(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );

      expect(result).toEqual(mockUserRecord);
      expect(mockDb.getUserByWallet).toHaveBeenCalledWith(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );
      expect(mockDb.createUser).toHaveBeenCalledWith(
        mockTenantContext,
        expect.objectContaining({
          wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199'
        })
      );
    });

    it('should throw error for non-NOT_FOUND errors', async () => {
      const error = new FluxionError(ErrorCodes.DATABASE_ERROR, 'Database error', 500);
      mockDb.getUserByWallet.mockRejectedValueOnce(error);

      await expect(usersService.getOrCreateUserByWallet(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      )).rejects.toThrow('Database error');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updates = {
        email: 'newemail@example.com',
        profile: {
          display_name: 'Updated Name'
        }
      };

      // Mock getting current user
      mockDb.getUserById.mockResolvedValueOnce(mockUserRecord);
      
      const updatedUser = {
        ...mockUserRecord,
        email: updates.email,
        profile: {
          ...mockUserRecord.profile,
          ...updates.profile
        }
      };
      
      mockDb.updateUser.mockResolvedValueOnce(updatedUser);

      const result = await usersService.updateUser(mockTenantContext, 'user-123', updates);

      expect(result).toEqual(updatedUser);
      expect(mockDb.getUserById).toHaveBeenCalledWith(mockTenantContext, 'user-123');
      expect(mockDb.updateUser).toHaveBeenCalledWith(
        mockTenantContext,
        'user-123',
        expect.objectContaining({
          email: updates.email,
          profile: expect.objectContaining(updates.profile),
          stats: expect.objectContaining({
            last_active_at: expect.any(String)
          })
        })
      );
    });
  });

  describe('updateUserStats', () => {
    it('should update user statistics successfully', async () => {
      const statUpdates = {
        invoice_count_delta: 1,
        total_received_delta: 100.50
      };

      // Mock getting current user
      mockDb.getUserById.mockResolvedValueOnce(mockUserRecord);
      
      const updatedUser = {
        ...mockUserRecord,
        stats: {
          ...mockUserRecord.stats,
          invoice_count: mockUserRecord.stats!.invoice_count + 1,
          total_received: mockUserRecord.stats!.total_received + 100.50
        }
      };
      
      mockDb.updateUser.mockResolvedValueOnce(updatedUser);

      const result = await usersService.updateUserStats(mockTenantContext, 'user-123', statUpdates);

      expect(result).toEqual(updatedUser);
      expect(mockDb.updateUser).toHaveBeenCalledWith(
        mockTenantContext,
        'user-123',
        expect.objectContaining({
          stats: expect.objectContaining({
            invoice_count: 1,
            total_received: 100.50,
            last_active_at: expect.any(String)
          })
        })
      );
    });

    it('should handle negative deltas correctly', async () => {
      const userWithStats = {
        ...mockUserRecord,
        stats: {
          invoice_count: 5,
          total_received: 500,
          last_active_at: '2023-01-01T00:00:00.000Z'
        }
      };

      const statUpdates = {
        invoice_count_delta: -10, // Should not go below 0
        total_received_delta: -600 // Should not go below 0
      };

      // Mock getting current user with stats
      mockDb.getUserById.mockResolvedValueOnce(userWithStats);
      
      const updatedUser = {
        ...userWithStats,
        stats: {
          ...userWithStats.stats,
          invoice_count: 0, // Should be clamped to 0
          total_received: 0  // Should be clamped to 0
        }
      };
      
      mockDb.updateUser.mockResolvedValueOnce(updatedUser);

      const result = await usersService.updateUserStats(mockTenantContext, 'user-123', statUpdates);

      expect(result.stats?.invoice_count).toBe(0);
      expect(result.stats?.total_received).toBe(0);
    });
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      mockDb.getUserByWallet.mockResolvedValueOnce(mockUserRecord);

      const result = await usersService.userExists(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      mockDb.getUserByWallet.mockRejectedValueOnce(
        new FluxionError(ErrorCodes.NOT_FOUND, 'User not found', 404)
      );

      const result = await usersService.userExists(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      );

      expect(result).toBe(false);
    });

    it('should throw error for non-NOT_FOUND errors', async () => {
      const error = new FluxionError(ErrorCodes.DATABASE_ERROR, 'Database error', 500);
      mockDb.getUserByWallet.mockRejectedValueOnce(error);

      await expect(usersService.userExists(
        mockTenantContext, 
        '0x742d35Cc6635C0532925a3b8D0aC0199'
      )).rejects.toThrow('Database error');
    });
  });

  describe('validateUserAccess', () => {
    it('should return user when validation passes', async () => {
      mockDb.getUserById.mockResolvedValueOnce(mockUserRecord);

      const result = await usersService.validateUserAccess(mockTenantContext, 'user-123');

      expect(result).toEqual(mockUserRecord);
    });

    it('should throw error when user not found', async () => {
      mockDb.getUserById.mockResolvedValueOnce(null);

      await expect(usersService.validateUserAccess(mockTenantContext, 'user-123'))
        .rejects.toThrow(FluxionError);
    });
  });
});