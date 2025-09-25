import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://localhost:3003',
    'https://admin.fluxion.pay'
  ],
  credentials: true
}));

app.use(express.json());

// Mock data for responses
const mockUsers = [
  {
    id: '01HBXYZ1000000000000000001',
    email: 'admin@example.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
    displayName: 'System Admin',
    organizationId: '01HBXYZ0000000000000000000',
    organizationName: 'Default Organization',
    isAdmin: true,
    isSuperAdmin: true,
    lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    invoiceCount: 5,
    totalReceived: '1500.00'
  },
  {
    id: '01HBXYZ1000000000000000002',
    email: 'user@example.com',
    walletAddress: '0x0987654321098765432109876543210987654321',
    displayName: 'Regular User',
    organizationId: '01HBXYZ0000000000000000000',
    organizationName: 'Default Organization',
    isAdmin: false,
    isSuperAdmin: false,
    lastActiveAt: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    invoiceCount: 2,
    totalReceived: '750.00'
  }
];

const mockSystemStats = {
  users: {
    total: 25,
    active: 18,
    adminUsers: 3,
    superAdminUsers: 1,
    thisMonth: 8,
    lastMonth: 5,
    growthRate: 60.0
  },
  organizations: {
    total: 5,
    active: 4,
    thisMonth: 2,
    lastMonth: 1,
    growthRate: 100.0
  },
  invoices: {
    total: 127,
    thisMonth: 34,
    totalValue: '45750.00',
    completedRate: 85.5
  },
  payments: {
    total: 109,
    totalValue: '39087.50',
    successRate: 94.2
  }
};

const mockActivityLogs = [
  {
    id: '01HBXYZ2000000000000000001',
    userId: '01HBXYZ1000000000000000001',
    organizationId: '01HBXYZ0000000000000000000',
    action: 'CREATE',
    tableName: 'invoices',
    recordId: '01HBXYZ3000000000000000001',
    severityLevel: 'low',
    ipAddress: '192.168.1.100',
    summary: 'Created new invoice #INV-001',
    adminAction: false,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '01HBXYZ2000000000000000002',
    userId: '01HBXYZ1000000000000000001',
    organizationId: '01HBXYZ0000000000000000000',
    action: 'UPDATE',
    tableName: 'users',
    recordId: '01HBXYZ1000000000000000002',
    severityLevel: 'high',
    ipAddress: '192.168.1.100',
    summary: 'Updated user admin status',
    adminAction: true,
    createdAt: new Date(Date.now() - 7200000).toISOString()
  }
];

// Simple JWT middleware (for testing, very basic)
const simpleAuth = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required'
      },
      meta: {
        requestId: 'test-request-id',
        timestamp: new Date().toISOString()
      }
    });
  }

  // For testing, we'll accept any Bearer token
  next();
};

// Endpoints that admin frontend needs
app.get('/admin/users', simpleAuth, (req: Request, res: Response) => {
  const { limit = 50, offset = 0, search } = req.query;
  
  console.log(`Admin: GET /admin/users called with limit=${limit}, offset=${offset}, search=${search}`);
  
  let filteredUsers = [...mockUsers];
  
  if (search) {
    const searchTerm = String(search).toLowerCase();
    filteredUsers = filteredUsers.filter(user => 
      user.email?.toLowerCase().includes(searchTerm) ||
      user.displayName?.toLowerCase().includes(searchTerm) ||
      user.walletAddress.toLowerCase().includes(searchTerm)
    );
  }
  
  const total = filteredUsers.length;
  const startIdx = parseInt(String(offset), 10);
  const endIdx = startIdx + parseInt(String(limit), 10);
  const users = filteredUsers.slice(startIdx, endIdx);
  
  res.json({
    success: true,
    data: {
      users,
      pagination: {
        total,
        limit: parseInt(String(limit), 10),
        offset: startIdx
      }
    },
    meta: {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/admin/system/stats', simpleAuth, (req: Request, res: Response) => {
  console.log('Admin: GET /admin/system/stats called');
  
  res.json({
    success: true,
    data: mockSystemStats,
    meta: {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/admin/system/health', simpleAuth, (req: Request, res: Response) => {
  console.log('Admin: GET /admin/system/health called');
  
  const health = {
    status: 'healthy',
    checks: {
      database: { status: 'ok' },
      redis: { status: 'ok' },
      external_apis: { status: 'ok' },
      storage: { status: 'ok' }
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: health,
    meta: {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/admin/activity-logs', simpleAuth, (req: Request, res: Response) => {
  console.log('Admin: GET /admin/activity-logs called');
  
  const { limit = 50, offset = 0 } = req.query;
  
  const total = mockActivityLogs.length;
  const startIdx = parseInt(String(offset), 10);
  const endIdx = startIdx + parseInt(String(limit), 10);
  const logs = mockActivityLogs.slice(startIdx, endIdx);
  
  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        total,
        limit: parseInt(String(limit), 10),
        offset: startIdx
      },
      filters: {
        organizations: [],
        actions: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'],
        severityLevels: ['low', 'medium', 'high', 'critical']
      }
    },
    meta: {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString()
    }
  });
});

// Basic health endpoint
app.get('/admin/health', (req: Request, res: Response) => {
  console.log('Admin: GET /admin/health called (basic endpoint)');
  
  res.json({
    service: 'admin-service-simple',
    status: 'healthy',
    version: '1.0.0-simple',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Info endpoint
app.get('/admin/info', (req: Request, res: Response) => {
  console.log('Admin: GET /admin/info called');
  
  res.json({
    service: 'admin-service-simple',
    version: '1.0.0-simple',
    status: 'running',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /admin/users',
      'GET /admin/system/stats', 
      'GET /admin/system/health',
      'GET /admin/activity-logs',
      'GET /admin/health',
      'GET /admin/info'
    ]
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  console.log(`Admin: 404 - Route not found: ${req.method} ${req.path}`);
  
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    meta: {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString()
    }
  });
});

// Error handler
app.use((error: any, req: Request, res: Response, _next: any) => {
  console.error('Admin: Error occurred:', error);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    },
    meta: {
      requestId: 'test-request-id',
      timestamp: new Date().toISOString()
    }
  });
});

export default app;