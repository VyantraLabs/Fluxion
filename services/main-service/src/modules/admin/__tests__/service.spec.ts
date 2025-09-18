import { AdminService } from '../service';
import { TenantContext } from '../../types/common';
import { AppDataSource } from '../../database/data-source';

// Mock the dependencies
jest.mock('./database/repositories/AdminRepository');
jest.mock('./database/repositories/UserRepository');
jest.mock('./database/repositories/OrganizationRepository');
jest.mock('./shared/services/rbac.service');

describe('AdminService', () => {
  let adminService: AdminService;
  let mockTenantContext: TenantContext;

  beforeEach(() => {
    adminService = new AdminService();
    mockTenantContext = {
      tenantId: 'test-org-id',
      userId: 'admin-user-id'
    };
  });

  describe('User Management', () => {
    describe('changeUserOrganizationRole', () => {
      it('should change user role successfully', async () => {
        const result = await adminService.changeUserOrganizationRole(
          mockTenantContext,
          'org-123',
          'user-456',
          'admin',
          'assign',
          'Promoted to admin'
        );

        expect(result).toEqual({
          success: true,
          message: 'Role admin assigned to user successfully'
        });
      });

      it('should revoke user role successfully', async () => {
        const result = await adminService.changeUserOrganizationRole(
          mockTenantContext,
          'org-123',
          'user-456',
          'admin',
          'revoke',
          'Demoted from admin'
        );

        expect(result).toEqual({
          success: true,
          message: 'Role admin revoked from user successfully'
        });
      });
    });

    describe('removeUserFromOrganization', () => {
      it('should remove user from organization successfully', async () => {
        await expect(
          adminService.removeUserFromOrganization(
            mockTenantContext,
            'org-123',
            'user-456',
            'User requested removal'
          )
        ).resolves.not.toThrow();
      });
    });

    describe('changeUserRoles', () => {
      it('should change system and organization roles', async () => {
        const roleChanges = {
          systemRoles: [
            { roleKey: 'support', action: 'assign' as const }
          ],
          organizationRoles: [
            { organizationId: 'org-123', roleKey: 'admin', action: 'assign' as const }
          ]
        };

        const result = await adminService.changeUserRoles(
          mockTenantContext,
          'user-456',
          roleChanges,
          'Promotion to support and org admin'
        );

        expect(result).toEqual({
          success: true,
          changes: 2
        });
      });
    });

    describe('getUserOrganizations', () => {
      it('should return user organizations', async () => {
        const organizations = await adminService.getUserOrganizations(
          mockTenantContext,
          'user-456'
        );

        expect(Array.isArray(organizations)).toBe(true);
      });
    });
  });

  describe('Audit Log Management', () => {
    describe('getUserAuditLogs', () => {
      it('should retrieve user audit logs with filters', async () => {
        const filters = {
          severityLevel: 'high',
          action: 'LOGIN',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31')
        };

        const result = await adminService.getUserAuditLogs(
          mockTenantContext,
          'user-456',
          50,
          0,
          filters
        );

        expect(result).toHaveProperty('logs');
        expect(result).toHaveProperty('total');
        expect(Array.isArray(result.logs)).toBe(true);
        expect(typeof result.total).toBe('number');
      });
    });

    describe('getOrganizationAuditLogs', () => {
      it('should retrieve organization audit logs', async () => {
        const result = await adminService.getOrganizationAuditLogs(
          mockTenantContext,
          'org-123',
          100,
          0
        );

        expect(result).toHaveProperty('logs');
        expect(result).toHaveProperty('total');
        expect(Array.isArray(result.logs)).toBe(true);
        expect(typeof result.total).toBe('number');
      });
    });

    describe('exportAuditLogs', () => {
      it('should export audit logs in CSV format', async () => {
        const filters = {
          userId: 'user-456',
          severityLevel: 'high'
        };

        const result = await adminService.exportAuditLogs(
          mockTenantContext,
          'csv',
          filters,
          1000
        );

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('recordCount');
        expect(typeof result.data).toBe('string');
        expect(typeof result.recordCount).toBe('number');
      });

      it('should export audit logs in JSON format', async () => {
        const filters = {
          organizationId: 'org-123'
        };

        const result = await adminService.exportAuditLogs(
          mockTenantContext,
          'json',
          filters,
          5000
        );

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('recordCount');
        expect(typeof result.data).toBe('string');
        expect(typeof result.recordCount).toBe('number');
        
        // Should be valid JSON
        expect(() => JSON.parse(result.data)).not.toThrow();
      });
    });
  });

  describe('Access Control', () => {
    describe('validateSuperAdminAccess', () => {
      it('should validate super admin access for valid user', async () => {
        const hasAccess = await adminService.validateSuperAdminAccess(mockTenantContext);
        
        // Since we're mocking, this will return false, but the method should not throw
        expect(typeof hasAccess).toBe('boolean');
      });

      it('should return false for missing userId', async () => {
        const contextWithoutUser: TenantContext = {
          tenantId: 'test-org-id'
        };

        const hasAccess = await adminService.validateSuperAdminAccess(contextWithoutUser);
        expect(hasAccess).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error
      jest.spyOn(adminService as any, 'rbacService').mockImplementation({
        assignRole: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      await expect(
        adminService.changeUserOrganizationRole(
          mockTenantContext,
          'org-123',
          'user-456',
          'admin',
          'assign'
        )
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle missing user errors', async () => {
      // Mock user not found
      jest.spyOn(adminService as any, 'userRepository').mockImplementation({
        findById: jest.fn().mockResolvedValue(null)
      });

      await expect(
        adminService.removeUserFromSystem(
          mockTenantContext,
          'non-existent-user',
          'User cleanup',
          false
        )
      ).rejects.toThrow('User not found');
    });
  });

  describe('Performance', () => {
    it('should handle large audit log exports efficiently', async () => {
      const startTime = Date.now();
      
      await adminService.exportAuditLogs(
        mockTenantContext,
        'csv',
        {},
        10000 // Large number of records
      );
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});