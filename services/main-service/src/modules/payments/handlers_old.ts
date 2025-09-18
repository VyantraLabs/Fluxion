import { Router, Request, Response } from 'express';
import { PaymentService } from './service';
import { VerifyPaymentSchema, GetPaymentsQuerySchema } from '../../types/payment';
import { APIResponse, PaginatedResponse } from '../../types/common';
import { Logger } from '../../shared/utils/logger';
import { optionalAuth } from '../../shared/middleware';

const router = Router();
const paymentService = new PaymentService();
const logger = new Logger('PaymentHandlers');

/**
 * Verify a blockchain payment
 * POST /payments/verify
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const data = VerifyPaymentSchema.parse(req.body);
    
    const result = await paymentService.verify(data);

    const response: APIResponse = {
      success: true,
      data: {
        payment: result.payment,
        invoice: result.invoice,
        verification_details: {
          is_valid: result.verification.isValid,
          confirmations: result.verification.confirmations,
          actual_amount: result.verification.actualAmount,
          actual_sender: result.verification.actualSender,
          actual_recipient: result.verification.actualRecipient,
          already_processed: result.verification.alreadyProcessed || false
        }
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Payment verification completed via API', { 
      payment_id: result.payment.payment_id,
      tx_hash: data.tx_hash,
      is_valid: result.verification.isValid
    });
    
    res.status(200).json(response);
  } catch (error) {
    throw error; // Let global error handler deal with it
  }
});

/**
 * Get payment by ID
 * GET /payments/:id
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.id;

    const payment = await paymentService.findById(paymentId);

    const response: APIResponse = {
      success: true,
      data: payment,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Payment retrieved via API', { payment_id: paymentId });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get payments for an invoice
 * GET /payments/invoice/:invoiceId
 */
router.get('/invoice/:invoiceId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.invoiceId;
    const query = GetPaymentsQuerySchema.parse(req.query);

    const result = await paymentService.findByInvoice(invoiceId, {
      limit: query.limit,
      nextToken: query.nextToken
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

    logger.info('Invoice payments retrieved via API', { 
      invoice_id: invoiceId,
      count: result.items.length 
    });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Update payment confirmations (usually called by webhook or cron)
 * POST /payments/:id/update-confirmations
 */
router.post('/:id/update-confirmations', async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.id;

    const payment = await paymentService.updateConfirmations(paymentId);

    const response: APIResponse = {
      success: true,
      data: payment,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Payment confirmations updated via API', { 
      payment_id: paymentId,
      confirmations: payment.confirmations 
    });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get payment by transaction hash
 * GET /payments/tx/:hash
 */
router.get('/tx/:hash', optionalAuth, async (req: Request, res: Response) => {
  try {
    const txHash = req.params.hash;

    // Validate transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction hash format'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(400).json(response);
      return;
    }

    const payment = await paymentService.findByTransactionHash(txHash);

    if (!payment) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Payment not found for this transaction hash'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      data: payment,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Payment retrieved by tx hash via API', { 
      payment_id: payment.payment_id,
      tx_hash: txHash 
    });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Check payment status (lightweight endpoint for polling)
 * GET /payments/:id/status
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.id;

    const payment = await paymentService.findById(paymentId);

    const response: APIResponse = {
      success: true,
      data: {
        payment_id: payment.payment_id,
        invoice_id: payment.invoice_id,
        status: payment.status,
        confirmations: payment.confirmations,
        amount: payment.amount,
        tx_hash: payment.tx_hash,
        updated_at: payment.updated_at
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Payment status checked via API', { 
      payment_id: paymentId,
      status: payment.status 
    });
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Get payment statistics (admin endpoint)
 * GET /payments/stats/overview
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await paymentService.getPaymentStats();

    const response: APIResponse = {
      success: true,
      data: stats,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('Payment statistics retrieved via API');
    res.json(response);
  } catch (error) {
    throw error;
  }
});

/**
 * Webhook endpoint for payment updates (future use)
 * POST /payments/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // This endpoint can be used for external webhook integrations
    // For now, just log the webhook data
    logger.info('Payment webhook received', { 
      body: req.body,
      headers: req.headers 
    });

    const response: APIResponse = {
      success: true,
      data: { message: 'Webhook received successfully' },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    throw error;
  }
});

export const paymentRoutes = router;