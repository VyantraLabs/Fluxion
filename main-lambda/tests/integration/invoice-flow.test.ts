import request from 'supertest';
import { app } from '../../src/index';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/types/common';

// Mock AWS services for integration tests
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sqs');

// Test data
const testWalletAddress = '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e';
const testClientEmail = 'client@example.com';
const testClientName = 'Test Client Company';

// Generate test JWT token
const generateTestToken = (walletAddress: string) => {
  return jwt.sign(
    {
      wallet_address: walletAddress,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    },
    JWT_SECRET
  );
};

describe('Invoice Flow Integration Tests', () => {
  let authToken: string;
  let createdInvoiceId: string;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.DYNAMODB_TABLE = 'fluxion-test';
    process.env.NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
    process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
    
    authToken = generateTestToken(testWalletAddress);
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          version: expect.any(String),
          services: {
            database: 'healthy',
            blockchain: 'healthy',
            notifications: 'healthy'
          }
        }
      });
    });
  });

  describe('API Info', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          service: 'Fluxion API',
          version: expect.any(String),
          endpoints: expect.any(Object),
          supported_networks: ['Polygon'],
          supported_tokens: ['USDC']
        }
      });
    });
  });

  describe('Authentication Required Endpoints', () => {
    it('should reject requests without authentication', async () => {
      await request(app)
        .post('/invoices')
        .send({
          creator_wallet: testWalletAddress,
          client_email: testClientEmail,
          client_name: testClientName,
          amount: 250.00,
          description: 'Test invoice',
          due_date: '2024-02-01T00:00:00.000Z'
        })
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .post('/invoices')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          creator_wallet: testWalletAddress,
          client_email: testClientEmail,
          client_name: testClientName,
          amount: 250.00,
          description: 'Test invoice',
          due_date: '2024-02-01T00:00:00.000Z'
        })
        .expect(401);
    });
  });

  describe('Invoice CRUD Operations', () => {
    describe('Create Invoice', () => {
      it('should create a new invoice successfully', async () => {
        const invoiceData = {
          creator_wallet: testWalletAddress,
          client_email: testClientEmail,
          client_name: testClientName,
          amount: 250.00,
          description: 'Integration test invoice',
          due_date: '2024-02-01T00:00:00.000Z',
          line_items: [
            {
              description: 'Development work',
              quantity: 10,
              rate: 25.00,
              amount: 250.00
            }
          ]
        };

        const response = await request(app)
          .post('/invoices')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invoiceData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoice_id: expect.any(String),
            creator_wallet: testWalletAddress,
            client_email: testClientEmail,
            client_name: testClientName,
            amount: 250.00,
            description: 'Integration test invoice',
            status: 'draft',
            due_date: '2024-02-01T00:00:00.000Z',
            payment_url: expect.stringContaining('/pay/'),
            line_items: expect.arrayContaining([
              expect.objectContaining({
                description: 'Development work',
                quantity: 10,
                rate: 25.00,
                amount: 250.00
              })
            ]),
            created_at: expect.any(String),
            updated_at: expect.any(String)
          },
          meta: {
            requestId: expect.any(String),
            timestamp: expect.any(String)
          }
        });

        createdInvoiceId = response.body.data.invoice_id;
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/invoices')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            creator_wallet: testWalletAddress,
            // Missing required fields
            amount: 250.00
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.any(String),
            details: expect.arrayContaining([
              expect.objectContaining({
                field: expect.any(String),
                message: expect.any(String)
              })
            ])
          }
        });
      });

      it('should validate wallet ownership', async () => {
        const differentWalletToken = generateTestToken('0x8ba1f109551bD432803012645Hac136c95ce69A88');

        await request(app)
          .post('/invoices')
          .set('Authorization', `Bearer ${differentWalletToken}`)
          .send({
            creator_wallet: testWalletAddress, // Different from token wallet
            client_email: testClientEmail,
            client_name: testClientName,
            amount: 250.00,
            description: 'Test invoice',
            due_date: '2024-02-01T00:00:00.000Z'
          })
          .expect(403);
      });

      it('should validate line items total', async () => {
        const response = await request(app)
          .post('/invoices')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            creator_wallet: testWalletAddress,
            client_email: testClientEmail,
            client_name: testClientName,
            amount: 100.00, // Doesn't match line items total
            description: 'Test invoice',
            due_date: '2024-02-01T00:00:00.000Z',
            line_items: [
              {
                description: 'Work',
                quantity: 10,
                rate: 25.00,
                amount: 250.00 // Total is 250, but invoice amount is 100
              }
            ]
          })
          .expect(400);

        expect(response.body.error.message).toContain('Total line item amount must match invoice amount');
      });
    });

    describe('Get Invoice', () => {
      it('should get invoice by ID', async () => {
        const response = await request(app)
          .get(`/invoices/${createdInvoiceId}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoice_id: createdInvoiceId,
            creator_wallet: testWalletAddress,
            client_email: testClientEmail,
            client_name: testClientName,
            amount: 250.00,
            status: 'draft'
          }
        });
      });

      it('should get public invoice details', async () => {
        const response = await request(app)
          .get(`/invoices/${createdInvoiceId}/public`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoice_id: createdInvoiceId,
            creator_wallet: testWalletAddress,
            client_name: testClientName,
            amount: 250.00,
            status: 'draft'
            // Should not include client_email for public view
          }
        });

        expect(response.body.data).not.toHaveProperty('client_email');
      });

      it('should return 404 for non-existent invoice', async () => {
        await request(app)
          .get('/invoices/non-existent-id')
          .expect(404);
      });
    });

    describe('Update Invoice', () => {
      it('should update invoice successfully', async () => {
        const updates = {
          client_name: 'Updated Client Name',
          description: 'Updated description',
          due_date: '2024-03-01T00:00:00.000Z'
        };

        const response = await request(app)
          .put(`/invoices/${createdInvoiceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoice_id: createdInvoiceId,
            client_name: 'Updated Client Name',
            description: 'Updated description',
            due_date: '2024-03-01T00:00:00.000Z',
            updated_at: expect.any(String)
          }
        });
      });

      it('should enforce ownership for updates', async () => {
        const differentWalletToken = generateTestToken('0x8ba1f109551bD432803012645Hac136c95ce69A88');

        await request(app)
          .put(`/invoices/${createdInvoiceId}`)
          .set('Authorization', `Bearer ${differentWalletToken}`)
          .send({
            description: 'Unauthorized update attempt'
          })
          .expect(403);
      });

      it('should validate update data', async () => {
        const response = await request(app)
          .put(`/invoices/${createdInvoiceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            client_email: 'invalid-email' // Invalid email format
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('Send Invoice', () => {
      it('should send invoice and change status to pending', async () => {
        const response = await request(app)
          .post(`/invoices/${createdInvoiceId}/send`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoice_id: createdInvoiceId,
            status: 'pending',
            updated_at: expect.any(String)
          }
        });
      });

      it('should enforce ownership for sending', async () => {
        const differentWalletToken = generateTestToken('0x8ba1f109551bD432803012645Hac136c95ce69A88');

        await request(app)
          .post(`/invoices/${createdInvoiceId}/send`)
          .set('Authorization', `Bearer ${differentWalletToken}`)
          .expect(403);
      });
    });

    describe('Get User Invoices', () => {
      it('should get invoices for authenticated user', async () => {
        const response = await request(app)
          .get(`/invoices/user/${testWalletAddress}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              invoice_id: createdInvoiceId,
              creator_wallet: testWalletAddress,
              amount: 250.00
            })
          ])
        });
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get(`/invoices/user/${testWalletAddress}?limit=5`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        // Pagination info might be present if there are more results
      });

      it('should support status filtering', async () => {
        const response = await request(app)
          .get(`/invoices/user/${testWalletAddress}?status=pending`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        // All returned invoices should have pending status
        response.body.data.forEach((invoice: any) => {
          expect(invoice.status).toBe('pending');
        });
      });

      it('should enforce wallet ownership', async () => {
        const differentWalletToken = generateTestToken('0x8ba1f109551bD432803012645Hac136c95ce69A88');

        await request(app)
          .get(`/invoices/user/${testWalletAddress}`) // Different wallet than token
          .set('Authorization', `Bearer ${differentWalletToken}`)
          .expect(403);
      });
    });

    describe('Dashboard Statistics', () => {
      it('should get dashboard statistics', async () => {
        const response = await request(app)
          .get('/invoices/dashboard/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            overview: {
              total_invoices: expect.any(Number),
              draft_invoices: expect.any(Number),
              pending_invoices: expect.any(Number),
              paid_invoices: expect.any(Number),
              total_revenue: expect.any(Number),
              average_invoice_amount: expect.any(Number)
            },
            recent_activity: {
              invoices_last_30_days: expect.any(Number),
              revenue_last_30_days: expect.any(Number)
            },
            status_breakdown: {
              draft: expect.any(Number),
              pending: expect.any(Number),
              paid: expect.any(Number),
              expired: expect.any(Number),
              cancelled: expect.any(Number)
            }
          }
        });
      });
    });

    describe('Cancel Invoice', () => {
      it('should cancel invoice', async () => {
        const response = await request(app)
          .delete(`/invoices/${createdInvoiceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Invoice cancelled successfully'
          }
        });

        // Verify invoice is cancelled
        const getResponse = await request(app)
          .get(`/invoices/${createdInvoiceId}`)
          .expect(200);

        expect(getResponse.body.data.status).toBe('cancelled');
      });
    });
  });

  describe('Payment Verification', () => {
    let testInvoiceId: string;

    beforeAll(async () => {
      // Create a test invoice for payment verification
      const response = await request(app)
        .post('/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          creator_wallet: testWalletAddress,
          client_email: 'payment-test@example.com',
          client_name: 'Payment Test Client',
          amount: 100.00,
          description: 'Payment verification test invoice',
          due_date: '2024-02-01T00:00:00.000Z'
        });
      
      testInvoiceId = response.body.data.invoice_id;

      // Send the invoice
      await request(app)
        .post(`/invoices/${testInvoiceId}/send`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should verify payment with valid transaction', async () => {
      // Mock a valid transaction hash (this would be mocked in the blockchain service)
      const testTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const response = await request(app)
        .post('/payments/verify')
        .send({
          invoice_id: testInvoiceId,
          tx_hash: testTxHash,
          from_address: '0x8ba1f109551bD432803012645Hac136c95ce69A88'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          payment: {
            payment_id: expect.any(String),
            invoice_id: testInvoiceId,
            tx_hash: testTxHash,
            status: expect.stringMatching(/confirmed|pending/)
          },
          invoice: {
            invoice_id: testInvoiceId,
            status: expect.stringMatching(/paid|pending/)
          },
          verification: {
            isValid: expect.any(Boolean),
            actualAmount: expect.any(String),
            confirmations: expect.any(Number)
          }
        }
      });
    });

    it('should validate payment verification input', async () => {
      const response = await request(app)
        .post('/payments/verify')
        .send({
          invoice_id: 'invalid-id', // Invalid UUID
          tx_hash: '0x123', // Invalid tx hash format
          from_address: 'invalid-address' // Invalid wallet address
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(expect.arrayContaining([
        expect.objectContaining({
          field: expect.any(String),
          message: expect.any(String)
        })
      ]));
    });

    it('should handle non-existent invoice', async () => {
      await request(app)
        .post('/payments/verify')
        .send({
          invoice_id: '12345678-1234-1234-1234-123456789012', // Valid UUID but non-existent
          tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          from_address: testWalletAddress
        })
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{invalid json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle unsupported HTTP methods', async () => {
      await request(app)
        .patch('/invoices/123') // PATCH not supported
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('Route GET /non-existent-endpoint not found')
        }
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under rate limit', async () => {
      // Make several requests that should all succeed
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/health')
          .expect(200)
      );

      await Promise.all(promises);
    });

    // Note: Rate limiting test for exceeded limits would require
    // making many requests quickly, which might be flaky in CI
    // Consider implementing this in load tests instead
  });

  describe('CORS', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/invoices')
        .set('Origin', 'https://app.fluxion.pay')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });
});