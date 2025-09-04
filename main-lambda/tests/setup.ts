/**
 * Jest setup file for global test configuration
 */

// Mock environment variables for all tests
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.NOTIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.POLYGON_RPC_URL = 'https://polygon-mainnet.g.alchemy.com/v2/';
process.env.ALCHEMY_API_KEY = 'test-alchemy-key';
process.env.FROM_EMAIL = 'test@fluxion.pay';
process.env.FRONTEND_URL = 'https://test.fluxion.pay';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// PostgreSQL test database configuration
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'postgres';
process.env.DB_PASSWORD = 'password';
process.env.DB_DATABASE = 'fluxion_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock AWS SDK globally (only those that exist in the project)
jest.mock('@aws-sdk/client-sqs');

// Mock winston logger to prevent console output during tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

// Mock ethers globally
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(),
    Contract: jest.fn(),
    verifyMessage: jest.fn(),
    isAddress: jest.fn(),
    parseUnits: jest.fn((value: string, decimals: number) => BigInt(parseFloat(value) * Math.pow(10, decimals))),
    formatUnits: jest.fn((value: bigint, decimals: number) => (Number(value) / Math.pow(10, decimals)).toString())
  },
  verifyMessage: jest.fn(),
  isAddress: jest.fn(),
  parseUnits: jest.fn((value: string, decimals: number) => BigInt(parseFloat(value) * Math.pow(10, decimals))),
  formatUnits: jest.fn((value: bigint, decimals: number) => (Number(value) / Math.pow(10, decimals)).toString()),
  JsonRpcProvider: jest.fn(),
  Contract: jest.fn()
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

// Global test helpers
(global as any).mockDate = (date: string) => {
  const mockDate = new Date(date);
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
  Date.now = jest.fn(() => mockDate.getTime());
  return mockDate;
};

(global as any).restoreDate = () => {
  (global.Date as any).mockRestore?.();
  (Date.now as any).mockRestore?.();
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  (global as any).restoreDate();
});

// Global timeout for all tests
jest.setTimeout(30000);

// Suppress console logs during tests unless explicitly enabled
const originalConsole = console;
if (process.env.ENABLE_TEST_LOGS !== 'true') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Export original console for tests that need it
export { originalConsole };