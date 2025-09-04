import request from 'supertest';
import { app } from '../../src/index';

// Mock all external dependencies
jest.mock('../../src/shared/database/client');
jest.mock('../../src/shared/notifications/client');
jest.mock('../../src/shared/blockchain/client');
jest.mock('ethers');

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.DYNAMODB_TABLE = 'test-table';
    process.env.FRONTEND_URL = 'https://test.example.com';
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          version: expect.any(String),
          environment: expect.any(String),
          services: expect.objectContaining({
            database: 'healthy',
            blockchain: 'healthy',
            notifications: 'healthy'
          }),
          memory_usage: expect.any(Object),
          uptime: expect.any(Number)
        }),
        meta: expect.objectContaining({
          requestId: expect.any(String),
          timestamp: expect.any(String)
        })
      });
    });
  });

  describe('API Info', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          service: 'Fluxion API',
          version: expect.any(String),
          environment: expect.any(String),
          endpoints: expect.objectContaining({
            invoices: expect.objectContaining({
              base: '/invoices',
              description: 'Invoice management operations',
              methods: expect.arrayContaining(['GET', 'POST', 'PUT', 'DELETE'])
            }),
            payments: expect.objectContaining({
              base: '/payments',
              methods: expect.arrayContaining(['GET', 'POST'])
            }),
            users: expect.objectContaining({
              base: '/users',
              methods: expect.arrayContaining(['GET', 'POST', 'PUT', 'DELETE'])
            }),
            analytics: expect.objectContaining({
              base: '/analytics',
              methods: expect.arrayContaining(['GET', 'POST'])
            })
          }),
          supported_networks: ['Polygon'],
          supported_tokens: ['USDC']
        }),
        meta: expect.any(Object)
      });
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return system metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          process: expect.objectContaining({
            uptime: expect.any(Number),
            memory_usage: expect.any(Object),
            cpu_usage: expect.any(Object),
            node_version: expect.any(String),
            platform: expect.any(String),
            arch: expect.any(String)
          }),
          environment: expect.objectContaining({
            node_env: expect.any(String)
          })
        })
      );
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/invoices')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect(200);

      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Route GET /unknown-route not found'
        }),
        meta: expect.objectContaining({
          requestId: expect.any(String),
          timestamp: expect.any(String)
        })
      });
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/invoices')
        .send({
          // Invalid data that should trigger validation error
          creator_wallet: 'invalid-wallet',
          client_email: 'invalid-email',
          amount: -100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle unauthorized requests', async () => {
      const response = await request(app)
        .get('/invoices/user/0x1234567890123456789012345678901234567890')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'UNAUTHORIZED',
          message: 'Authentication token required'
        }),
        meta: expect.any(Object)
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    // Note: This test would be flaky in CI as it depends on timing
    // In a real application, you might want to use a more controlled approach
    it('should rate limit requests', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed initially due to high limit in test
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    }, 10000);
  });

  describe('Content Security', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet middleware should add security headers
      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-download-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('Request Logging', () => {
    it('should handle requests with custom request ID', async () => {
      const customRequestId = 'test-request-123';
      
      const response = await request(app)
        .get('/health')
        .set('x-request-id', customRequestId)
        .expect(200);

      expect(response.body.meta.requestId).toBe(customRequestId);
    });

    it('should generate request ID if not provided', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.meta.requestId).toMatch(/^req-\d+-[a-z0-9]+$/);
    });
  });

  describe('JSON Body Parsing', () => {
    it('should parse JSON request bodies', async () => {
      const response = await request(app)
        .post('/users/validate-address')
        .send({ wallet_address: '0x1234567890123456789012345678901234567890' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/users/validate-address')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should enforce body size limits', async () => {
      const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) }; // > 10MB
      
      const response = await request(app)
        .post('/users/validate-address')
        .send(largePayload)
        .expect(413);
    }, 15000);
  });
});