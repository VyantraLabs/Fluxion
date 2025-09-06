import { Router, Request, Response } from 'express';
import { BackgroundJobService } from './service';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler,
  adminOnly 
} from '@/shared/middleware';
import { getTenantContext, extractTenantContext } from '@/shared/middleware/tenant';
import {
  TriggerJobSchema,
  JobFilterSchema,
  JobIdSchema
} from '@/shared/validation/jobs';

const router = Router();
const backgroundJobService = new BackgroundJobService();
const logger = new Logger('JobHandlers');

/**
 * @swagger
 * /jobs/trigger:
 *   post:
 *     tags:
 *       - Background Jobs
 *     summary: Trigger background job
 *     description: |
 *       Manually triggers a background job. Useful for testing or immediate processing.
 *       Admin access required.
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobType
 *             properties:
 *               jobType:
 *                 type: string
 *                 enum: [payment_verification, email_delivery, reminder_processing, scheduled_notifications]
 *                 example: "payment_verification"
 *               parameters:
 *                 type: object
 *                 description: Job-specific parameters
 *                 example:
 *                   invoiceId: "abc123def"
 *                   paymentId: "pay456ghi"
 *     responses:
 *       200:
 *         description: Background job triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       format: uuid
 *                       example: "job123abc"
 *                     status:
 *                       type: string
 *                       enum: [queued, running, completed, failed]
 *                       example: "queued"
 *                     message:
 *                       type: string
 *                       example: "Background job queued successfully"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/trigger',
  authenticateJWT,
  extractTenantContext(),
  adminOnly,
  validateRequest({ body: TriggerJobSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { jobType, parameters } = req.body;
    
    const result = await backgroundJobService.triggerJob(tenantContext, jobType, parameters);
    
    logger.info('Background job triggered via API', {
      jobId: result.jobId,
      jobType,
      adminUser: tenantContext.userId
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /jobs:
 *   get:
 *     tags:
 *       - Background Jobs
 *     summary: List background jobs
 *     description: |
 *       Retrieves a paginated list of background jobs. Admin access required.
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of jobs to return
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: nextToken
 *         in: query
 *         description: Pagination token from previous response
 *         required: false
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         description: Filter by job status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [queued, running, completed, failed, cancelled]
 *       - name: jobType
 *         in: query
 *         description: Filter by job type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [payment_verification, email_delivery, reminder_processing, scheduled_notifications]
 *     responses:
 *       200:
 *         description: Background jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           jobId:
 *                             type: string
 *                           jobType:
 *                             type: string
 *                           status:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           completedAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           error:
 *                             type: string
 *                             nullable: true
 *                     total:
 *                       type: integer
 *                       example: 247
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         hasMore:
 *                           type: boolean
 *                         nextToken:
 *                           type: string
 *                           nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/',
  authenticateJWT,
  extractTenantContext(),
  adminOnly,
  validateRequest({ query: JobFilterSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { limit, nextToken, status, jobType } = req.query as any;
    
    const result = await backgroundJobService.getJobs(tenantContext, {
      limit,
      nextToken,
      status,
      jobType
    });
    
    logger.info('Background jobs retrieved via API', {
      count: result.items.length,
      total: result.total,
      adminUser: tenantContext.userId
    });
    
    res.success({
      jobs: result.items,
      total: result.total,
      pagination: {
        hasMore: !!result.nextToken,
        nextToken: result.nextToken
      }
    });
  })
);

/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     tags:
 *       - Background Jobs
 *     summary: Get background job by ID
 *     description: Retrieves details of a specific background job
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Job ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Background job retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     jobType:
 *                       type: string
 *                     status:
 *                       type: string
 *                     parameters:
 *                       type: object
 *                     result:
 *                       type: object
 *                       nullable: true
 *                     error:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     duration:
 *                       type: number
 *                       description: Job duration in milliseconds
 *                       nullable: true
 *       404:
 *         description: Job not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id',
  authenticateJWT,
  extractTenantContext(),
  adminOnly,
  validateRequest({ params: JobIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const jobId = req.params.id;
    
    const job = await backgroundJobService.getJobById(tenantContext, jobId);
    
    logger.info('Background job retrieved via API', { jobId });
    res.success(job);
  })
);

/**
 * @swagger
 * /jobs/{id}/retry:
 *   post:
 *     tags:
 *       - Background Jobs
 *     summary: Retry failed background job
 *     description: |
 *       Retries a failed background job. Only jobs with 'failed' status can be retried.
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Job ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job retry queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Job queued for retry"
 *                     newJobId:
 *                       type: string
 *                       format: uuid
 *                       example: "job456def"
 *       400:
 *         description: Job cannot be retried (not in failed status)
 *       404:
 *         description: Job not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/retry',
  authenticateJWT,
  extractTenantContext(),
  adminOnly,
  validateRequest({ params: JobIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const jobId = req.params.id;
    
    const result = await backgroundJobService.retryJob(tenantContext, jobId);
    
    logger.info('Background job retry queued via API', {
      originalJobId: jobId,
      newJobId: result.newJobId
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /jobs/stats:
 *   get:
 *     tags:
 *       - Background Jobs
 *     summary: Get background job statistics
 *     description: |
 *       Retrieves comprehensive statistics about background job processing.
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: period
 *         in: query
 *         description: Time period for statistics
 *         required: false
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Job statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 1542
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         completed:
 *                           type: integer
 *                           example: 1450
 *                         failed:
 *                           type: integer
 *                           example: 67
 *                         running:
 *                           type: integer
 *                           example: 15
 *                         queued:
 *                           type: integer
 *                           example: 10
 *                     byType:
 *                       type: object
 *                       properties:
 *                         payment_verification:
 *                           type: integer
 *                           example: 890
 *                         email_delivery:
 *                           type: integer
 *                           example: 425
 *                         reminder_processing:
 *                           type: integer
 *                           example: 180
 *                     successRate:
 *                       type: number
 *                       example: 94.05
 *                     averageProcessingTime:
 *                       type: number
 *                       description: Average processing time in milliseconds
 *                       example: 2847.5
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/stats',
  authenticateJWT,
  extractTenantContext(),
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { period = 'day' } = req.query as any;
    
    const stats = await backgroundJobService.getJobStats(tenantContext, period);
    
    logger.info('Background job stats retrieved via API', {
      period,
      total: stats.total,
      adminUser: tenantContext.userId
    });
    
    res.success(stats);
  })
);

export const jobRoutes = router;