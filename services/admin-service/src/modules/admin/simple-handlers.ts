import { Router, Request, Response } from 'express';
import { SimplifiedAdminService } from './simple-service';
import { Logger } from '../../shared/utils/logger';
import { 
  authenticateJWT, 
  asyncHandler
} from '../../shared/middleware';
// import { getTenantContext } from '../../shared/middleware/tenant';

const router = Router();
const adminService = new SimplifiedAdminService();
const logger = new Logger('AdminHandlers');

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: List all users with statistics (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *       - name: organizationId
 *         in: query
 *         schema:
 *           type: string
 *       - name: adminOnly
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/users',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = {
      tenantId: req.context.tenantId || 'admin-system',
      userId: req.context.userId,
      walletAddress: req.context.walletAddress
    };
    const { 
      limit = 50, 
      offset = 0, 
      search, 
      organizationId, 
      adminOnly 
    } = req.query;
    
    try {
      const result = await adminService.getAllUsers(
        tenantContext,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10),
        search as string,
        organizationId as string,
        adminOnly === 'true'
      );
      
      logger.info('Admin: Users retrieved', {
        adminUser: tenantContext.userId,
        count: result.users.length,
        total: result.total
      });
      
      res.status(200).json({
        success: true,
        data: {
          users: result.users,
          pagination: {
            total: result.total,
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10)
          }
        },
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Admin: Failed to retrieve users', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve users'
        },
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * @swagger
 * /admin/system/stats:
 *   get:
 *     tags:
 *       - Admin System
 *     summary: Get comprehensive system statistics (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics retrieved successfully
 */
router.get('/system/stats',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = {
      tenantId: req.context.tenantId || 'admin-system',
      userId: req.context.userId,
      walletAddress: req.context.walletAddress
    };
    
    try {
      const stats = await adminService.getSystemStats(tenantContext);
      
      logger.info('Admin: System statistics retrieved', {
        adminUser: tenantContext.userId,
        totalUsers: stats.users.total,
        totalOrganizations: stats.organizations.total
      });
      
      res.status(200).json({
        success: true,
        data: stats,
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Admin: Failed to retrieve system statistics', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve system statistics'
        },
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     tags:
 *       - Admin System
 *     summary: Get system health status (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health check completed
 */
router.get('/system/health',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = {
      tenantId: req.context.tenantId || 'admin-system',
      userId: req.context.userId,
      walletAddress: req.context.walletAddress
    };
    
    try {
      const health = await adminService.getSystemHealth(tenantContext);
      
      logger.info('Admin: System health check completed', {
        adminUser: tenantContext.userId,
        status: health.status
      });
      
      res.status(200).json({
        success: true,
        data: health,
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Admin: Failed to retrieve system health', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve system health'
        },
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * @swagger
 * /admin/activity-logs:
 *   get:
 *     tags:
 *       - Admin Activity
 *     summary: Get global activity logs (system admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: organizationId
 *         in: query
 *         schema:
 *           type: string
 *       - name: action
 *         in: query
 *         schema:
 *           type: string
 *       - name: severityLevel
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: highRiskOnly
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Activity logs retrieved successfully
 */
router.get('/activity-logs',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = {
      tenantId: req.context.tenantId || 'admin-system',
      userId: req.context.userId,
      walletAddress: req.context.walletAddress
    };
    const { 
      limit = 50, 
      offset = 0, 
      organizationId,
      action,
      severityLevel,
      startDate,
      endDate,
      highRiskOnly
    } = req.query;
    
    // Build filters object
    const filters = {
      adminOnly: false, // Show all activities, not just admin
      highRiskOnly: highRiskOnly === 'true',
      organizationId: organizationId as string,
      action: action as string,
      severityLevel: severityLevel as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };
    
    try {
      const result = await adminService.getActivityLogs(
        tenantContext,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10),
        filters
      );
      
      logger.info('Admin: Global activity logs retrieved', {
        adminUser: tenantContext.userId,
        count: result.logs.length,
        total: result.total
      });
      
      res.status(200).json({
        success: true,
        data: {
          logs: result.logs,
          pagination: {
            total: result.total,
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10)
          },
          filters: {
            organizations: [], // Placeholder - would be populated in production
            actions: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'],
            severityLevels: ['low', 'medium', 'high', 'critical']
          }
        },
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Admin: Failed to retrieve global activity logs', {
        error: error.message,
        adminUser: tenantContext.userId,
        filters
      });
      
      if (error.code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'System admin access required for global activity logs'
          },
          meta: {
            requestId: (req as any).context?.requestId || 'unknown',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve global activity logs'
        },
        meta: {
          requestId: (req as any).context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// Basic info endpoint
router.get('/info', (req: Request, res: Response) => {
  res.json({
    service: 'admin-service',
    version: process.env.VERSION || '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

export const adminRoutes = router;