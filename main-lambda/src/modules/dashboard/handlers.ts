import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Logger } from '@/shared/utils/logger';
import { asyncHandler, authenticateJWT, validateRequestSync } from '@/shared/middleware';
import { DashboardService } from './service';
import { ClientType } from './types';
import { TenantContext } from '@/types/common';

const logger = new Logger('DashboardHandlers');
const dashboardService = new DashboardService();

// Validation schemas
const getDashboardSchema = z.object({
  headers: z.object({
    'x-client-type': z.enum(['admin-frontend', 'frontend']).optional().default('frontend')
  }),
  query: z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    organization_id: z.string().optional()
  })
});

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Get role-based dashboard data
 *     description: Returns dashboard statistics and information based on user role and client type
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Client-Type
 *         schema:
 *           type: string
 *           enum: [admin-frontend, frontend]
 *           default: frontend
 *         description: Client application type
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics filtering
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: string
 *         description: Specific organization ID for filtering (admin only)
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/AdminDashboardResponse'
 *                     - $ref: '#/components/schemas/FrontendDashboardResponse'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Dashboard data requested', {
    userId: req.context?.user?.id,
    clientType: req.headers['x-client-type'],
    organizationId: req.context?.tenantId
  });

  // Validate request
  const validation = validateRequestSync(getDashboardSchema, req);
  if (!validation.success) {
    return res.error('VALIDATION_ERROR', validation.error?.message || 'Validation failed', 400, validation.error?.details);
  }

  const { headers, query } = validation.data;
  const tenantContext = req.context as TenantContext;

  // Determine client type
  const clientType = headers['x-client-type'] === 'admin-frontend' 
    ? ClientType.ADMIN_FRONTEND 
    : ClientType.FRONTEND;

  // Build filters
  const filters = {
    dateRange: query.start_date && query.end_date ? {
      start: new Date(query.start_date),
      end: new Date(query.end_date)
    } : undefined,
    organizationId: query.organization_id
  };

  try {
    const dashboardData = await dashboardService.getDashboardData(
      tenantContext,
      clientType,
      filters
    );

    logger.info('Dashboard data retrieved successfully', {
      userId: tenantContext.userId,
      clientType,
      dataType: clientType === ClientType.ADMIN_FRONTEND ? 'admin' : 'frontend'
    });

    res.success(dashboardData, 200);
  } catch (error: any) {
    logger.error('Failed to get dashboard data', {
      error: error.message,
      userId: tenantContext.userId,
      clientType
    });
    
    if (error.statusCode) {
      return res.error(error.message, error.statusCode);
    }
    
    res.error('Failed to retrieve dashboard data', 500);
  }
});

/**
 * @swagger
 * /dashboard/health:
 *   get:
 *     summary: Get system health status
 *     description: Returns current system health and service status
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System health retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SystemHealth'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
const getSystemHealth = asyncHandler(async (req: Request, res: Response) => {
  logger.info('System health check requested', {
    userId: req.context?.user?.id
  });

  const tenantContext = req.context as TenantContext;

  try {
    // Use the private method via reflection or expose it
    const dashboardData = await dashboardService.getDashboardData(
      tenantContext,
      ClientType.ADMIN_FRONTEND
    );

    if ('system_health' in dashboardData) {
      res.success(dashboardData.system_health, 200);
    } else {
      res.error('Health data not available for this user type', 403);
    }
  } catch (error: any) {
    logger.error('Failed to get system health', {
      error: error.message,
      userId: tenantContext.userId
    });
    
    res.error('Failed to retrieve system health', 500);
  }
});

/**
 * @swagger
 * /dashboard/quick-actions:
 *   get:
 *     summary: Get available quick actions for user
 *     description: Returns a list of quick actions based on user permissions
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Quick actions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QuickAction'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
const getQuickActions = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Quick actions requested', {
    userId: req.context?.user?.id
  });

  const tenantContext = req.context as TenantContext;

  try {
    const dashboardData = await dashboardService.getDashboardData(
      tenantContext,
      ClientType.FRONTEND
    );

    if ('quick_actions' in dashboardData) {
      res.success(dashboardData.quick_actions, 200);
    } else {
      res.error('Quick actions not available for admin users', 403);
    }
  } catch (error: any) {
    logger.error('Failed to get quick actions', {
      error: error.message,
      userId: tenantContext.userId
    });
    
    res.error('Failed to retrieve quick actions', 500);
  }
});

// Create router
const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Dashboard routes
router.get('/', getDashboard);
router.get('/health', getSystemHealth);
router.get('/quick-actions', getQuickActions);

export { router as dashboardRoutes };

// Swagger component definitions
/**
 * @swagger
 * components:
 *   schemas:
 *     UserInfo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           description: User email
 *         role:
 *           type: string
 *           description: User's highest role
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: User's permissions
 *         organizationId:
 *           type: string
 *           description: User's organization ID
 *         organizationName:
 *           type: string
 *           description: User's organization name
 * 
 *     SystemStats:
 *       type: object
 *       properties:
 *         users:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             active:
 *               type: number
 *             admin_users:
 *               type: number
 *             new_this_month:
 *               type: number
 *         organizations:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             active:
 *               type: number
 *             new_this_month:
 *               type: number
 *         invoices:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             total_value:
 *               type: number
 *             this_month:
 *               type: number
 *             success_rate:
 *               type: number
 *         payments:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             total_value:
 *               type: number
 *             success_rate:
 *               type: number
 *             this_month:
 *               type: number
 *         platform_health:
 *           type: object
 *           properties:
 *             uptime:
 *               type: number
 *             response_time:
 *               type: number
 *             error_rate:
 *               type: number
 * 
 *     OrganizationStats:
 *       type: object
 *       properties:
 *         invoices:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             pending:
 *               type: number
 *             paid:
 *               type: number
 *             total_value:
 *               type: number
 *         payments:
 *           type: object
 *           properties:
 *             total_received:
 *               type: number
 *             pending_amount:
 *               type: number
 *             this_month:
 *               type: number
 *         team:
 *           type: object
 *           properties:
 *             members:
 *               type: number
 *             active_users:
 *               type: number
 * 
 *     PersonalStats:
 *       type: object
 *       properties:
 *         my_invoices:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             paid:
 *               type: number
 *             pending:
 *               type: number
 *             total_value:
 *               type: number
 *         recent_activity:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ActivityItem'
 * 
 *     ActivityItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [invoice_created, payment_received, user_joined, system_alert, role_changed]
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 * 
 *     SystemHealth:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, down]
 *         services:
 *           type: object
 *           properties:
 *             database:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                 response_time:
 *                   type: number
 *             blockchain:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                 response_time:
 *                   type: number
 *             notifications:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                 response_time:
 *                   type: number
 *             cache:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                 response_time:
 *                   type: number
 * 
 *     QuickAction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         icon:
 *           type: string
 *         route:
 *           type: string
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 * 
 *     AdminDashboardResponse:
 *       type: object
 *       properties:
 *         user_info:
 *           $ref: '#/components/schemas/UserInfo'
 *         system_stats:
 *           $ref: '#/components/schemas/SystemStats'
 *         recent_activity:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ActivityItem'
 *         system_health:
 *           $ref: '#/components/schemas/SystemHealth'
 * 
 *     FrontendDashboardResponse:
 *       type: object
 *       properties:
 *         user_info:
 *           $ref: '#/components/schemas/UserInfo'
 *         organization_stats:
 *           $ref: '#/components/schemas/OrganizationStats'
 *         personal_stats:
 *           $ref: '#/components/schemas/PersonalStats'
 *         quick_actions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/QuickAction'
 */