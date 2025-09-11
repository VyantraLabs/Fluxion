export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
    version?: string;
  };
}

export interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination?: {
    hasMore: boolean;
    nextToken?: string;
    totalCount?: number;
  };
}

export interface FluxionRecord {
  PK: string;              // Partition Key: Entity type + ID
  SK: string;              // Sort Key: Relationship/metadata
  GSI1PK?: string;         // User-based queries
  GSI1SK?: string;         // Time-based sorting  
  GSI2PK?: string;         // Status-based queries
  GSI2SK?: string;         // Additional sorting
  entityType: 'INVOICE' | 'PAYMENT' | 'USER' | 'NOTIFICATION';
  created_at: string;
  updated_at: string;
  ttl?: number;           // Automatic cleanup
  data: InvoiceData | PaymentData | UserData | NotificationData;
}

// New Multi-Table Schema Types

export interface BaseRecord {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserRecord extends BaseRecord {
  wallet_address: string;
  email?: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  };
  notification_preferences?: {
    email_on_payment: boolean;
    email_on_invoice_viewed: boolean;
    email_on_reminders: boolean;
  };
  stats?: {
    invoice_count: number;
    total_received: number;
    last_active_at: string;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  // DEPRECATED: Admin fields moved to JWT-only for security
  // These should not be included in API responses
  is_admin?: boolean;
  is_super_admin?: boolean;
  admin_granted_at?: string;
  admin_granted_by?: string;
}

// Safe version of UserRecord for API responses (removes sensitive data)
export interface SafeUserRecord {
  id: string;
  wallet_address: string;
  email?: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  };
  notification_preferences?: {
    email_on_payment: boolean;
    email_on_invoice_viewed: boolean;
    email_on_reminders: boolean;
  };
  stats?: {
    invoice_count: number;
    total_received: number;
    last_active_at: string;
  };
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

// Utility function to sanitize UserRecord for API responses
export function sanitizeUserRecord(userRecord: UserRecord): SafeUserRecord {
  const {
    tenant_id,      // Remove sensitive tenant_id
    is_admin,       // Remove admin flags
    is_super_admin, // Remove admin flags 
    admin_granted_at,
    admin_granted_by,
    ...safeRecord
  } = userRecord;
  
  return safeRecord;
}

export interface InvoiceRecord extends BaseRecord {
  user_id: string;
  client_info: {
    name: string;
    email: string;
    address?: string;
  };
  line_items: LineItem[];
  amounts: {
    subtotal: number;
    tax_rate?: number;
    tax_amount?: number;
    discount_amount?: number;
    total: number;
  };
  status: InvoiceStatus;
  due_date: string;
  paid_at?: string;
  blockchain_data?: {
    network: string;
    token_address: string;
    recipient_address: string;
    payment_url: string;
  };
  metadata?: {
    pdf_url?: string;
    public_url?: string;
    notes?: string;
  };
}

export interface PaymentRecord extends BaseRecord {
  invoice_id: string;
  transaction_hash: string;
  amount: number;
  token_address: string;
  network: string;
  from_address: string;
  to_address: string;
  status: PaymentStatus;
  confirmations?: number;
  block_number?: number;
  gas_used?: number;
  confirmed_at?: string;
  failure_reason?: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export type InvoiceStatus = 'draft' | 'created' | 'initiated' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partial';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export interface InvoiceData {
  invoice_id: string;
  creator_wallet: string;
  client_email: string;
  client_name: string;
  amount: number;
  description: string;
  line_items?: LineItem[];
  status: InvoiceStatus;
  due_date: string;
  paid_at?: string;
  payment_tx_hash?: string;
  payment_url: string;
  pdf_url?: string;
}

export interface PaymentData {
  payment_id: string;
  invoice_id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  gas_used: number;
  block_number: number;
  status: PaymentStatus;
  confirmations: number;
}

export interface UserData {
  wallet_address: string;
  email?: string;
  display_name?: string;
  notification_preferences: {
    email_on_payment: boolean;
    email_on_invoice_viewed: boolean;
    email_on_reminders: boolean;
  };
  stats: {
    invoice_count: number;
    total_received: number;
    last_active_at: string;
  };
}

export interface NotificationData {
  notification_id: string;
  type: 'INVOICE_CREATED' | 'PAYMENT_RECEIVED' | 'INVOICE_REMINDER';
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  data: any;
  sent_at?: string;
  error_message?: string;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  walletAddress?: string;
  tenantId?: string;
  userRole?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isSystemUser?: boolean;
  systemRoles?: string[];
  functionName?: string;
  functionVersion?: string;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

export interface TenantContext {
  tenantId: string;
  userId?: string;
  walletAddress?: string;
}

export interface QueryOptions {
  limit?: number;
  nextToken?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface MultiTableQueryResult<T> {
  items: T[];
  nextToken?: string;
  totalCount?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Error handling
export enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

export class FluxionError extends Error {
  constructor(
    public code: ErrorCodes,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'FluxionError';
  }
}

// Blockchain configuration
export interface BlockchainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  tokens: {
    USDC: {
      address: string;
      decimals: number;
    };
  };
}

export const SUPPORTED_CHAINS: Record<string, BlockchainConfig> = {
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY || ''),
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    tokens: {
      USDC: {
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6
      }
    }
  }
};

// Configuration constants
export const POLYGON_USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY || '');
export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'fluxion-data-dev';
// DEPRECATED: Use config.aws.sqs.notificationQueueUrl instead
// export const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL || '';
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const CONSTANTS = {
  MIN_CONFIRMATION_BLOCKS: 12,
  PAYMENT_TIMEOUT_HOURS: 24,
  MAX_INVOICE_AMOUNT: 1000000,
  MIN_INVOICE_AMOUNT: 0.01,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100
} as const;

// Express Request interface extension is in types/express.d.ts