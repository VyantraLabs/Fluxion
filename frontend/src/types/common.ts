// Common API response types
export interface ApiResponse<T = any> {
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

// Pagination types
export interface PaginationMeta {
  hasMore: boolean;
  nextToken?: string;
  limit?: number;
  total?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// Error types
export interface ErrorDetails {
  field?: string;
  code: string;
  message: string;
}

export interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  details: ErrorDetails[];
}

// Enhanced error handling to match backend
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

// Tenant context for multi-tenant support
export interface TenantContext {
  tenantId: string;
  userId?: string;
  walletAddress?: string;
}

// Request context for enhanced tracking
export interface RequestContext {
  requestId: string;
  userId?: string;
  walletAddress?: string;
  tenantId?: string;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// Form validation
export interface FormFieldError {
  message: string;
  type: string;
}

export interface FormErrors {
  [key: string]: FormFieldError;
}

// Network types
export enum SupportedChain {
  POLYGON = 137,
  POLYGON_MUMBAI = 80001, // Testnet
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  currency: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  isTestnet: boolean;
}

// Token types
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Date/time helpers
export type DateString = string; // ISO 8601 format
export type UnixTimestamp = number;

// Wallet and blockchain types
export type WalletAddress = string; // Ethereum-style address (0x...)
export type TransactionHash = string; // Blockchain transaction hash

// Status types
export type Status = 'pending' | 'success' | 'error' | 'loading';

// Generic utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// Component props helpers
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Modal/Dialog types
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

// Button variants
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Table types
export interface TableColumn<T> {
  key: keyof T;
  header: string;
  render?: (value: any, item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Search and filter types
export interface SearchFilters {
  query?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any;
}

// Analytics types
export interface MetricValue {
  value: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'number' | 'currency' | 'percentage';
}

// Notification types
export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}