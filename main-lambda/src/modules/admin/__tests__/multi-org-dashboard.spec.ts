import { AdminService } from '../service';
import { TenantContext } from '@/types/common';
import { AdminRepository } from '@/database/repositories/AdminRepository';

// Mock dependencies
jest.mock('@/database/repositories/AdminRepository');
jest.mock('@/shared/utils/logger');
jest.mock('@/shared/cache/redis-client', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(void 0)
  })),
  CacheHelper: {
    userKey: jest.fn().mockReturnValue('test-cache-key')
  }
}));

describe('AdminService - Multi-Organization Dashboard', () => {
  let adminService: AdminService;
  let mockAdminRepository: jest.Mocked<AdminRepository>;
  let mockTenantContext: TenantContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    adminService = new AdminService();
    mockAdminRepository = adminService['adminRepository'] as jest.Mocked<AdminRepository>;
    
    mockTenantContext = {
      userId: 'test-system-admin-id',
      tenantId: 'system'
    };
  });

  describe('getGlobalStatistics', () => {
    it('should return comprehensive global statistics for system admin', async () => {
      // Mock system admin validation
      jest.spyOn(adminService, 'validateSuperAdminAccess').mockResolvedValue(true);

      // Mock data sources
      const mockSystemStats = {
        users: { total: 1250, active: 1200, adminUsers: 15, superAdminUsers: 3, thisMonth: 85 },
        organizations: { total: 45, active: 43, thisMonth: 5 },
        invoices: { total: 8920, thisMonth: 340, totalValue: '2847561.50', thisMonthValue: '156780.25', averageValue: '319.18' },
        payments: { total: 7450, thisMonth: 298, totalValue: '2234890.75', thisMonthValue: '134560.80', successRate: 94.2 },
        templates: { system: 12, organizational: 89, active: 87, totalUsage: 4500 },
        systemHealth: { status: 'healthy' as const, uptime: 86400, lastUpdated: '2025-01-15T10:00:00Z', issues: [] }
      };

      const mockOrganizationsWithStats = {
        organizations: [
          {
            id: 'org-1',
            name: 'Acme Corp',
            slug: 'acme-corp',
            userCount: 150,
            invoiceCount: 1200,
            templateCount: 8,
            totalPayments: '450000.00',
            lastActivity: new Date('2025-01-15T09:30:00Z'),
            status: 'active' as const,
            createdAt: new Date('2024-06-01T10:00:00Z')
          },
          {
            id: 'org-2', 
            name: 'TechStart Inc',
            slug: 'techstart-inc',
            userCount: 75,
            invoiceCount: 650,
            templateCount: 5,
            totalPayments: '280000.50',
            lastActivity: new Date('2025-01-15T08:45:00Z'),
            status: 'active' as const,
            createdAt: new Date('2024-08-15T14:20:00Z')
          }
        ],
        total: 45
      };

      const mockRecentActivity = {
        logs: [
          {
            id: 'log-1',
            action: 'CREATE',
            tableName: 'invoices',
            displayAction: 'Created',
            displayTableName: 'Invoices',
            userDisplayName: 'John Doe',
            organizationName: 'Acme Corp',
            isHighRisk: false,
            adminAction: false,
            severityLevel: 'medium',
            ipAddress: '192.168.1.100',
            createdAt: new Date('2025-01-15T09:45:00Z'),
            summary: 'John Doe created a new invoice'
          },
          {
            id: 'log-2',
            action: 'UPDATE',
            tableName: 'users',
            displayAction: 'Updated',
            displayTableName: 'Users',
            userDisplayName: 'Jane Smith',
            organizationName: 'TechStart Inc',
            isHighRisk: false,
            adminAction: true,
            severityLevel: 'high',
            ipAddress: '192.168.1.101',
            createdAt: new Date('2025-01-15T09:30:00Z'),
            summary: 'Jane Smith updated user profile'
          }
        ],
        total: 150
      };

      mockAdminRepository.getSystemStats.mockResolvedValue(mockSystemStats);
      mockAdminRepository.getAllOrganizationsWithStats.mockResolvedValue(mockOrganizationsWithStats);
      mockAdminRepository.getActivityLogs.mockResolvedValue(mockRecentActivity);

      // Execute
      const result = await adminService.getGlobalStatistics(mockTenantContext);

      // Verify
      expect(result).toEqual({
        totalUsers: 1250,
        totalOrganizations: 45,
        totalInvoices: 8920,
        totalRevenue: 730000.5, // Sum of organization payments
        recentActivity: mockRecentActivity.logs,
        organizationBreakdown: [
          {
            id: 'org-1',
            name: 'Acme Corp',
            userCount: 150,
            invoiceCount: 1200,
            revenue: 450000.0
          },
          {
            id: 'org-2',
            name: 'TechStart Inc', 
            userCount: 75,
            invoiceCount: 650,
            revenue: 280000.5
          }
        ]
      });

      // Verify super admin access was checked
      expect(adminService.validateSuperAdminAccess).toHaveBeenCalledWith(mockTenantContext);

      // Verify repository calls
      expect(mockAdminRepository.getSystemStats).toHaveBeenCalled();
      expect(mockAdminRepository.getAllOrganizationsWithStats).toHaveBeenCalledWith(20, 0);
      expect(mockAdminRepository.getActivityLogs).toHaveBeenCalledWith(10, 0, { adminOnly: true, highRiskOnly: false });
    });

    it('should throw FORBIDDEN error for non-system admin users', async () => {
      // Mock non-system admin user
      jest.spyOn(adminService, 'validateSuperAdminAccess').mockResolvedValue(false);

      // Execute & Verify
      await expect(adminService.getGlobalStatistics(mockTenantContext))
        .rejects
        .toThrow('System admin access required for global statistics');

      // Verify super admin access was checked
      expect(adminService.validateSuperAdminAccess).toHaveBeenCalledWith(mockTenantContext);

      // Verify no repository calls were made
      expect(mockAdminRepository.getSystemStats).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Mock system admin validation
      jest.spyOn(adminService, 'validateSuperAdminAccess').mockResolvedValue(true);

      // Mock repository error
      const mockError = new Error('Database connection failed');
      mockAdminRepository.getSystemStats.mockRejectedValue(mockError);

      // Execute & Verify
      await expect(adminService.getGlobalStatistics(mockTenantContext))
        .rejects
        .toThrow('Database connection failed');

      expect(adminService.validateSuperAdminAccess).toHaveBeenCalledWith(mockTenantContext);
    });
  });

  describe('Redis Caching Integration', () => {
    it('should use Redis cache for global statistics', async () => {
      // Mock the redis client
      const mockGetRedisClient = require('@/shared/cache/redis-client').getRedisClient;
      const mockRedisInstance = {
        get: jest.fn().mockResolvedValue(null), // Cache miss
        set: jest.fn().mockResolvedValue(void 0)
      };
      mockGetRedisClient.mockReturnValue(mockRedisInstance);

      // Mock system admin validation
      jest.spyOn(adminService, 'validateSuperAdminAccess').mockResolvedValue(true);

      // Mock successful data fetching
      const mockSystemStats = {
        users: { total: 100, active: 95, adminUsers: 5, superAdminUsers: 1, thisMonth: 10 },
        organizations: { total: 5, active: 5, thisMonth: 1 },
        invoices: { total: 50, thisMonth: 5, totalValue: '10000', thisMonthValue: '1000', averageValue: '200' },
        payments: { total: 40, thisMonth: 4, totalValue: '8000', thisMonthValue: '800', successRate: 90 },
        templates: { system: 2, organizational: 8, active: 8, totalUsage: 100 },
        systemHealth: { status: 'healthy' as const, uptime: 3600, lastUpdated: '2025-01-15T10:00:00Z', issues: [] }
      };

      mockAdminRepository.getSystemStats.mockResolvedValue(mockSystemStats);
      mockAdminRepository.getAllOrganizationsWithStats.mockResolvedValue({ organizations: [], total: 0 });
      mockAdminRepository.getActivityLogs.mockResolvedValue({ logs: [], total: 0 });

      // Execute
      await adminService.getGlobalStatistics(mockTenantContext);

      // Verify cache interactions
      expect(mockRedisInstance.get).toHaveBeenCalled();
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        expect.any(String), // cache key
        expect.objectContaining({
          totalUsers: 100,
          totalOrganizations: 5,
          totalInvoices: 50,
          totalRevenue: 0,
          recentActivity: [],
          organizationBreakdown: []
        }),
        { ttl: 300 } // 5 minutes
      );
    });
  });

  describe('Performance and Data Quality', () => {
    it('should efficiently aggregate organization revenue', async () => {
      jest.spyOn(adminService, 'validateSuperAdminAccess').mockResolvedValue(true);

      const mockOrganizationsWithStats = {
        organizations: [
          { id: 'org-1', name: 'Org 1', totalPayments: '1000.50', userCount: 10, invoiceCount: 5, templateCount: 2, lastActivity: new Date(), status: 'active' as const, createdAt: new Date(), slug: 'org-1' },
          { id: 'org-2', name: 'Org 2', totalPayments: '2500.75', userCount: 20, invoiceCount: 8, templateCount: 3, lastActivity: new Date(), status: 'active' as const, createdAt: new Date(), slug: 'org-2' },
          { id: 'org-3', name: 'Org 3', totalPayments: '0', userCount: 5, invoiceCount: 0, templateCount: 1, lastActivity: new Date(), status: 'active' as const, createdAt: new Date(), slug: 'org-3' }
        ],
        total: 3
      };

      mockAdminRepository.getSystemStats.mockResolvedValue({
        users: { total: 35, active: 33, adminUsers: 2, superAdminUsers: 1, thisMonth: 5 },
        organizations: { total: 3, active: 3, thisMonth: 0 },
        invoices: { total: 13, thisMonth: 2, totalValue: '3501.25', thisMonthValue: '500.00', averageValue: '269.33' },
        payments: { total: 10, thisMonth: 1, totalValue: '3501.25', thisMonthValue: '500.00', successRate: 76.9 },
        templates: { system: 1, organizational: 6, active: 6, totalUsage: 50 },
        systemHealth: { status: 'healthy' as const, uptime: 7200, lastUpdated: '2025-01-15T10:00:00Z', issues: [] }
      });

      mockAdminRepository.getAllOrganizationsWithStats.mockResolvedValue(mockOrganizationsWithStats);
      mockAdminRepository.getActivityLogs.mockResolvedValue({ logs: [], total: 0 });

      const result = await adminService.getGlobalStatistics(mockTenantContext);

      // Verify revenue aggregation
      expect(result.totalRevenue).toBe(3501.25); // 1000.50 + 2500.75 + 0
      expect(result.organizationBreakdown).toHaveLength(3);
      expect(result.organizationBreakdown[0].revenue).toBe(1000.5);
      expect(result.organizationBreakdown[1].revenue).toBe(2500.75);
      expect(result.organizationBreakdown[2].revenue).toBe(0);
    });
  });
});