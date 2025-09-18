import { Router, Request, Response } from 'express';
import { AnalyticsService } from './service';
import { 
  AnalyticsQuerySchema
} from '../../shared/validation';
import { APIResponse, RequestContext } from '../../types/common';
import { Logger } from '../../shared/utils/logger';
import { 
  authenticateJWT, 
  optionalAuth, 
  validateRequest, 
  asyncHandler 
} from '../../shared/middleware';

const router = Router();
const analyticsService = new AnalyticsService();
const logger = new Logger('AnalyticsHandlers');

/**
 * Get platform analytics (public endpoint)
 * GET /analytics/platform
 */
router.get('/platform', 
  asyncHandler(async (_req: Request, res: Response) => {
    const analytics = await analyticsService.getPlatformAnalytics();
    
    logger.info('Platform analytics retrieved via API');
    res.success(analytics);
  })
);

/**
 * Get current user analytics
 * GET /analytics/my
 */
router.get('/my', 
  authenticateJWT,
  validateRequest({ query: AnalyticsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.walletAddress!;
    
    const analytics = await analyticsService.getUserAnalytics(walletAddress);
    
    logger.info('User analytics retrieved via API', { wallet_address: walletAddress });
    res.success(analytics);
  })
);

/**
 * Get invoice metrics
 * GET /analytics/invoice/:id/metrics
 */
router.get('/invoice/:id/metrics', optionalAuth, async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;

    const metrics = await analyticsService.getInvoiceMetrics(invoiceId);

    const response: APIResponse = {
      success: true,
      data: metrics,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Invoice metrics retrieved via API', { invoice_id: invoiceId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Track invoice view
 * POST /analytics/invoice/:id/view
 */
router.post('/invoice/:id/view', async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;

    const metadata = {
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
      ip: (req.context as RequestContext)?.ip || req.ip || 'unknown'
    };

    await analyticsService.trackInvoiceView(invoiceId, metadata);

    const response: APIResponse = {
      success: true,
      data: { message: 'View tracked successfully' },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Invoice view tracked via API', { invoice_id: invoiceId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get system health metrics
 * GET /analytics/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthMetrics = await analyticsService.getHealthMetrics();

    const response: APIResponse = {
      success: true,
      data: healthMetrics,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('System health metrics retrieved via API');
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get dashboard summary for current user
 * GET /analytics/dashboard
 */
router.get('/dashboard', 
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.walletAddress!;
    
    // Get user analytics and platform stats
    const [userAnalytics, platformAnalytics] = await Promise.all([
      analyticsService.getUserAnalytics(walletAddress),
      analyticsService.getPlatformAnalytics()
    ]);

    // Create dashboard summary
    const dashboardData = {
      user: {
        quick_stats: {
          total_invoices: userAnalytics.invoice_summary.total_invoices,
          total_received: userAnalytics.invoice_summary.total_amount_received,
          pending_amount: userAnalytics.invoice_summary.total_amount_invoiced - userAnalytics.invoice_summary.total_amount_received,
          conversion_rate: userAnalytics.invoice_summary.total_invoices > 0 
            ? (userAnalytics.invoice_summary.paid_invoices / userAnalytics.invoice_summary.total_invoices) * 100 
            : 0
        },
        recent_activity: userAnalytics.monthly_breakdown.slice(0, 3),
        payment_performance: userAnalytics.payment_summary
      },
      platform: {
        user_rank: Math.floor(Math.random() * 100) + 1, // Mock ranking
        network_activity: {
          active_users: platformAnalytics.overview.active_users_7d,
          recent_volume: platformAnalytics.trends.volume_last_7d
        }
      }
    };

    logger.info('Dashboard data retrieved via API', { wallet_address: walletAddress });
    res.success(dashboardData);
  })
);

/**
 * Export user data (GDPR compliance)
 * GET /analytics/export/:wallet
 */
router.get('/export/:wallet', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const walletAddress = req.params.wallet;
    
    // Ensure user can only export their own data
    if (walletAddress !== req.context?.walletAddress) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot export data for different wallet address'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(403).json(response);
      return;
    }

    const userAnalytics = await analyticsService.getUserAnalytics(walletAddress);

    // Create exportable data structure
    const exportData = {
      user_info: {
        wallet_address: walletAddress,
        export_date: new Date().toISOString(),
        data_period: 'all_time'
      },
      analytics: userAnalytics,
      notes: [
        'This export contains all analytics data associated with your wallet address',
        'Raw transaction data is available on the Polygon blockchain',
        'Personal information (email, name) is stored separately and can be exported via profile endpoints'
      ]
    };

    const response: APIResponse = {
      success: true,
      data: exportData,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('User data exported via API', { wallet_address: walletAddress });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

export const analyticsRoutes = router;