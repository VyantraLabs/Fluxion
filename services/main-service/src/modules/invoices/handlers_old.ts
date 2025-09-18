import { Router, Request, Response } from 'express';

// Extend Express Request interface to include context with walletAddress
declare module 'express-serve-static-core' {
  interface Request {
    context?: {
      walletAddress?: string;
      requestId?: string;
      functionName?: string;
      functionVersion?: string;
      // add other fields as needed
    };
  }
}
import { InvoiceService } from './service';
import { 
  CreateInvoiceSchema, 
  UpdateInvoiceSchema, 
} from '../../shared/validation';
import { Logger } from '../../shared/utils/logger';
import { 
  authenticateJWT, 
  optionalAuth, 
  validateRequest, 
  asyncHandler 
} from '../../shared/middleware';
import { APIResponse, PaginatedResponse } from '../../types/common';
import { GetInvoicesQuerySchema } from '../../types/invoice';

const router = Router();
const invoiceService = new InvoiceService();
const logger = new Logger('InvoiceHandlers');

/**
 * Create a new invoice
 * POST /invoices
 */
router.post('/', 
  authenticateJWT,
  validateRequest({ body: CreateInvoiceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Set creator wallet to authenticated user
    const invoiceData = {
      ...req.body,
      creator_wallet: req.context!.walletAddress!
    };
    try{
      const invoice = await invoiceService.create(invoiceData);

      logger.info('Invoice created via API', {
        invoice_id: invoice.invoice_id,
        creator_wallet: invoice.creator_wallet
      });
    res.success(invoice, 201);
  } catch (error) {
    logger.error('Error creating invoice via API', { error });
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}));

/**
 * Get invoice by ID
 * GET /invoices/:id
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;
    const walletAddress = req.context?.walletAddress;

    const invoice = await invoiceService.findByIdWithPayments(invoiceId, walletAddress);

    const response: APIResponse = {
      success: true,
      data: invoice,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Invoice retrieved via API', { invoice_id: invoiceId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get invoices for authenticated user
 * GET /invoices/user/:wallet
 */
router.get('/user/:wallet', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const walletAddress = req.params.wallet;
    
    // Ensure user can only access their own invoices
    if (walletAddress !== req.context?.walletAddress) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot access invoices for different wallet address'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(403).json(response);
      return;
    }

    const query = GetInvoicesQuerySchema.parse(req.query);
    const result = await invoiceService.findByUser(walletAddress, {
      limit: query.limit,
      nextToken: query.nextToken,
      status: query.status
    });

    const response: PaginatedResponse<any> = {
      success: true,
      data: result.items,
      pagination: {
        hasMore: !!result.nextToken,
        nextToken: result.nextToken
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('User invoices retrieved via API', { 
      wallet_address: walletAddress,
      count: result.items.length 
    });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Update an invoice
 * PUT /invoices/:id
 */
router.put('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;
    const data = UpdateInvoiceSchema.parse(req.body);
    const walletAddress = req.context?.walletAddress!;

    const invoice = await invoiceService.update(invoiceId, data, walletAddress);

    const response: APIResponse = {
      success: true,
      data: invoice,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Invoice updated via API', { invoice_id: invoiceId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Delete (cancel) an invoice
 * DELETE /invoices/:id
 */
router.delete('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;
    const walletAddress = req.context?.walletAddress!;

    await invoiceService.delete(invoiceId, walletAddress);

    const response: APIResponse = {
      success: true,
      data: { message: 'Invoice cancelled successfully' },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Invoice deleted via API', { invoice_id: invoiceId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Send invoice (change status to pending)
 * POST /invoices/:id/send
 */
router.post('/:id/send', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;
    const walletAddress = req.context?.walletAddress!;

    const invoice = await invoiceService.update(
      invoiceId, 
      { status: 'pending' }, 
      walletAddress
    );

    const response: APIResponse = {
      success: true,
      data: invoice,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Invoice sent via API', { invoice_id: invoiceId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get public invoice details (for payment page)
 * GET /invoices/:id/public
 */
router.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;

    // Get invoice without wallet address check (public access)
    const invoice = await invoiceService.findById(invoiceId);

    // Only return necessary fields for payment
    const publicInvoice = {
      invoice_id: invoice.invoice_id,
      creator_wallet: invoice.creator_wallet,
      client_name: invoice.client_name,
      amount: invoice.amount,
      description: invoice.description,
      line_items: invoice.line_items,
      status: invoice.status,
      due_date: invoice.due_date,
      created_at: invoice.created_at
    };

    const response: APIResponse = {
      success: true,
      data: publicInvoice,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Public invoice retrieved via API', { invoice_id: invoiceId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get invoice statistics for user
 * GET /invoices/stats/:wallet
 */
router.get('/stats/:wallet', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const walletAddress = req.params.wallet;
    
    // Ensure user can only access their own stats
    if (walletAddress !== req.context?.walletAddress) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot access statistics for different wallet address'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(403).json(response);
      return;
    }

    // Get all invoices for user to calculate stats
    const allInvoices = await invoiceService.findByUser(walletAddress, { limit: 1000 });

    const stats = {
      total_invoices: allInvoices.items.length,
      total_amount: allInvoices.items.reduce((sum, invoice) => sum + invoice.amount, 0),
      paid_invoices: allInvoices.items.filter(i => i.status === 'paid').length,
      pending_invoices: allInvoices.items.filter(i => i.status === 'pending').length,
      draft_invoices: allInvoices.items.filter(i => i.status === 'draft').length,
      total_received: allInvoices.items
        .filter(i => i.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      average_invoice_amount: allInvoices.items.length > 0 
        ? allInvoices.items.reduce((sum, invoice) => sum + invoice.amount, 0) / allInvoices.items.length 
        : 0,
      payment_conversion_rate: allInvoices.items.length > 0
        ? (allInvoices.items.filter(i => i.status === 'paid').length / allInvoices.items.length) * 100
        : 0
    };

    const response: APIResponse = {
      success: true,
      data: stats,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Invoice statistics retrieved via API', { 
      wallet_address: walletAddress,
      total_invoices: stats.total_invoices 
    });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

export const invoiceRoutes = router;