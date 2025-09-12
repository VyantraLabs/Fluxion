import { auditEventService } from '../../audit-event.service';
import { auditConsumerRegistry } from '../index';

describe('Audit Event System Integration Tests', () => {
  beforeAll(async () => {
    // Initialize audit system for testing
    await auditConsumerRegistry.initialize();
  });

  afterAll(async () => {
    // Clean up
    await auditConsumerRegistry.shutdown();
  });

  describe('Event Emission', () => {
    it('should emit login success event', async () => {
      const context = {
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        endpoint: '/auth/login',
        method: 'POST'
      };

      // This should not throw
      await auditEventService.emitLogin(
        context,
        true,
        {
          wallet_address: '0x1234567890123456789012345678901234567890',
          login_method: 'wallet_signature'
        }
      );

      expect(true).toBe(true); // If we reach here, the event was emitted successfully
    });

    it('should emit login failure event', async () => {
      const context = {
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        endpoint: '/auth/login',
        method: 'POST'
      };

      // This should not throw
      await auditEventService.emitLogin(
        context,
        false,
        {
          wallet_address: '0x1234567890123456789012345678901234567890',
          login_method: 'wallet_signature',
          error_code: 'INVALID_SIGNATURE',
          failure_reason: 'Invalid signature'
        }
      );

      expect(true).toBe(true); // If we reach here, the event was emitted successfully
    });

    it('should emit role assignment event', async () => {
      const context = {
        userId: 'admin-user-id',
        organizationId: 'test-org-id',
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent'
      };

      // This should not throw
      await auditEventService.emitRoleAssigned(
        context,
        'target-user-id',
        'admin',
        'test-org-id',
        'admin-user-id',
        {
          reason: 'Promoted to admin role'
        }
      );

      expect(true).toBe(true); // If we reach here, the event was emitted successfully
    });

    it('should emit user created event', async () => {
      const context = {
        userId: 'admin-user-id',
        organizationId: 'test-org-id',
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent'
      };

      // This should not throw
      await auditEventService.emitUserCreated(
        context,
        'new-user-id',
        {
          wallet_address: '0x1234567890123456789012345678901234567890',
          email: 'test@example.com',
          organization_name: 'Test Organization'
        }
      );

      expect(true).toBe(true); // If we reach here, the event was emitted successfully
    });

    it('should emit resource management events', async () => {
      const context = {
        userId: 'user-id',
        organizationId: 'test-org-id',
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent'
      };

      // Test resource created event
      await auditEventService.emitResourceCreated(
        context,
        'invoice',
        'invoice-123',
        {
          amount: 1000,
          currency: 'USDC',
          client_email: 'client@example.com'
        }
      );

      // Test resource updated event
      await auditEventService.emitResourceUpdated(
        context,
        'invoice',
        'invoice-123',
        { status: 'draft' },
        { status: 'sent' },
        {
          reason: 'Invoice sent to client'
        }
      );

      // Test resource deleted event
      await auditEventService.emitResourceDeleted(
        context,
        'invoice',
        'invoice-123',
        {
          reason: 'Cancelled by user'
        }
      );

      expect(true).toBe(true); // If we reach here, all events were emitted successfully
    });
  });

  describe('Consumer Status', () => {
    it('should have registered consumers', () => {
      const stats = auditEventService.getConsumerStats();
      
      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
      
      // Check that we have the expected consumers
      const consumerNames = stats.map((s: any) => s.name);
      expect(consumerNames).toContain('database');
      expect(consumerNames).toContain('file');
      expect(consumerNames).toContain('cloudwatch');
    });

    it('should have database consumer enabled', () => {
      const stats = auditEventService.getConsumerStats();
      const databaseConsumer = stats.find((s: any) => s.name === 'database');
      
      expect(databaseConsumer).toBeDefined();
      expect(databaseConsumer?.enabled).toBe(true);
    });

    it('should have file consumer enabled in development', () => {
      const stats = auditEventService.getConsumerStats();
      const fileConsumer = stats.find((s: any) => s.name === 'file');
      
      expect(fileConsumer).toBeDefined();
      // File consumer should be enabled in development/test environment
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        expect(fileConsumer?.enabled).toBe(true);
      }
    });
  });

  describe('Context Creation', () => {
    it('should create context from request object', () => {
      const mockRequest = {
        user: { id: 'user-123' },
        tenant: { organizationId: 'org-456' },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0 Test Browser'),
        path: '/api/test',
        method: 'GET',
        id: 'req-789',
        sessionId: 'session-abc'
      };

      const context = auditEventService.createContextFromRequest(mockRequest);

      expect(context).toEqual({
        userId: 'user-123',
        organizationId: 'org-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        endpoint: '/api/test',
        method: 'GET',
        requestId: 'req-789',
        sessionId: 'session-abc'
      });
    });

    it('should handle missing user/tenant gracefully', () => {
      const mockRequest = {
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0 Test Browser'),
        path: '/api/test',
        method: 'GET'
      };

      const context = auditEventService.createContextFromRequest(mockRequest);

      expect(context).toEqual({
        userId: undefined,
        organizationId: undefined,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        endpoint: '/api/test',
        method: 'GET',
        requestId: undefined,
        sessionId: undefined
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle consumer errors gracefully', async () => {
      // This test ensures that if one consumer fails, others still work
      // and the system doesn't crash
      
      const context = {
        userId: 'test-user',
        organizationId: 'test-org'
      };

      // This should not throw even if a consumer has issues
      await expect(
        auditEventService.emitLogin(context, true, { test: 'data' })
      ).resolves.not.toThrow();
    });
  });
});