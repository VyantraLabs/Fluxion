/**
 * Integration test for Multi-Organization Dashboard APIs
 * Tests the new global statistics and enhanced organization endpoints
 */

import request from 'supertest';
import express from 'express';
import { adminRoutes } from '../handlers';

// Mock the dependencies to focus on route integration
jest.mock('../service', () => ({
  AdminService: jest.fn().mockImplementation(() => ({
    getGlobalStatistics: jest.fn().mockResolvedValue({
      totalUsers: 1250,
      totalOrganizations: 45,
      totalInvoices: 8920,
      totalRevenue: 2847561.50,
      recentActivity: [
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
        }
      ],
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
    }),
    getActivityLogs: jest.fn().mockResolvedValue({
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
        }
      ],
      total: 150
    })
  }))
}));

// Mock middleware
jest.mock('@/shared/middleware', () => ({
  authenticateJWT: (req: any, res: any, next: any) => {
    req.context = { userId: 'system-admin-id', walletAddress: '0xSystemAdmin' };
    next();
  },
  validateRequest: () => (req: any, res: any, next: any) => next(),
  asyncHandler: (fn: any) => fn,
  adminOnly: (req: any, res: any, next: any) => next(),
  requireSystemRole: () => (req: any, res: any, next: any) => next(),
  requireSystemSuperAdmin: (req: any, res: any, next: any) => next(),
  requireSystemAdmin: (req: any, res: any, next: any) => next()
}));

jest.mock('@/shared/middleware/super-admin', () => ({
  requireSuperAdmin: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next(),
  auditAdminOperation: () => (req: any, res: any, next: any) => next()
}));

jest.mock('@/shared/middleware/tenant', () => ({
  getTenantContext: (req: any) => ({ userId: 'system-admin-id', tenantId: 'system' }),
  extractTenantContext: () => (req: any, res: any, next: any) => next()
}));

jest.mock('@/database/data-source', () => ({
  AppDataSource: {
    query: jest.fn().mockResolvedValue([
      { id: 'org-1', name: 'Acme Corp' },
      { id: 'org-2', name: 'TechStart Inc' }
    ])
  }
}));

// Mock response helpers
const mockResponse = () => {
  const res: any = {};
  res.success = jest.fn().mockReturnValue(res);
  res.error = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Multi-Organization Dashboard API Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // Add response helpers
    app.use((req, res, next) => {
      res.success = (data: any, status = 200) => {
        res.status(status).json({ success: true, data });
      };
      res.error = (code: string, message: string, status = 500) => {
        res.status(status).json({ success: false, error: { code, message } });
      };
      next();
    });
    
    app.use('/admin', adminRoutes);
  });

  describe('GET /admin/global-stats', () => {
    it('should return comprehensive global statistics', async () => {
      const response = await request(app)
        .get('/admin/global-stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalUsers: 1250,
        totalOrganizations: 45,
        totalInvoices: 8920,
        totalRevenue: 2847561.50,
        recentActivity: expect.arrayContaining([
          expect.objectContaining({
            id: 'log-1',
            action: 'CREATE',
            userDisplayName: 'John Doe',
            organizationName: 'Acme Corp'
          })
        ]),
        organizationBreakdown: expect.arrayContaining([
          expect.objectContaining({
            id: 'org-1',
            name: 'Acme Corp',
            userCount: 150,
            invoiceCount: 1200,
            revenue: 450000.0
          })
        ])
      });
    });
  });

  describe('GET /admin/activity-logs', () => {
    it('should return global activity logs with filtering', async () => {
      const response = await request(app)
        .get('/admin/activity-logs')
        .query({
          limit: 50,
          offset: 0,
          organizationId: 'org-1',
          action: 'CREATE',
          severityLevel: 'medium'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        logs: expect.arrayContaining([
          expect.objectContaining({
            id: 'log-1',
            action: 'CREATE',
            displayAction: 'Created',
            userDisplayName: 'John Doe'
          })
        ]),
        pagination: expect.objectContaining({
          total: 150,
          limit: 50,
          offset: 0
        }),
        filters: expect.objectContaining({
          organizations: expect.any(Array),
          actions: expect.any(Array),
          severityLevels: expect.any(Array)
        })
      });
    });

    it('should handle query parameters correctly', async () => {
      const response = await request(app)
        .get('/admin/activity-logs')
        .query({
          highRiskOnly: 'true',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('logs');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('filters');
    });
  });

  describe('API Response Format', () => {
    it('should maintain consistent response structure for global stats', async () => {
      const response = await request(app)
        .get('/admin/global-stats')
        .expect(200);

      // Verify standard API response format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const { data } = response.body;
      
      // Verify all required fields are present
      expect(data).toHaveProperty('totalUsers');
      expect(data).toHaveProperty('totalOrganizations');
      expect(data).toHaveProperty('totalInvoices');
      expect(data).toHaveProperty('totalRevenue');
      expect(data).toHaveProperty('recentActivity');
      expect(data).toHaveProperty('organizationBreakdown');
      
      // Verify data types
      expect(typeof data.totalUsers).toBe('number');
      expect(typeof data.totalOrganizations).toBe('number');
      expect(typeof data.totalInvoices).toBe('number');
      expect(typeof data.totalRevenue).toBe('number');
      expect(Array.isArray(data.recentActivity)).toBe(true);
      expect(Array.isArray(data.organizationBreakdown)).toBe(true);
    });

    it('should maintain consistent response structure for activity logs', async () => {
      const response = await request(app)
        .get('/admin/activity-logs')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const { data } = response.body;
      
      // Verify required structure
      expect(data).toHaveProperty('logs');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('filters');
      
      // Verify pagination structure
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('offset');
      
      // Verify filters structure
      expect(data.filters).toHaveProperty('organizations');
      expect(data.filters).toHaveProperty('actions');
      expect(data.filters).toHaveProperty('severityLevels');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      const { AdminService } = require('../service');
      const mockAdminService = AdminService.mock.instances[0];
      mockAdminService.getGlobalStatistics.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/admin/global-stats')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve global statistics'
      });
    });
  });
});