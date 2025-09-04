import { WalletAddress, TransactionHash, DateString } from './common';

// Payment status types
export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

// Payment verification status
export type VerificationStatus = 'valid' | 'invalid' | 'pending' | 'already_processed';

// Core payment type (enhanced to match backend schema)
export interface Payment {
  id?: string;
  payment_id: string;
  invoice_id: string;
  tx_hash: TransactionHash;
  transaction_hash?: TransactionHash; // Alternative field name
  from_address: WalletAddress;
  to_address: WalletAddress;
  amount: number;
  token_address?: string;
  network?: string;
  gas_used?: number;
  block_number?: number;
  status: PaymentStatus;
  confirmations?: number;
  confirmed_at?: DateString;
  failure_reason?: string;
  tenant_id?: string;
  created_at: DateString;
  updated_at: DateString;
}

// Payment verification request
export interface VerifyPaymentRequest {
  invoice_id: string;
  tx_hash: TransactionHash;
  from_address: WalletAddress;
}

// Payment verification response
export interface PaymentVerificationResult {
  payment: Payment;
  invoice: any; // Will reference Invoice type
  verification_details: {
    is_valid: boolean;
    confirmations: number;
    actual_amount: string;
    actual_sender: WalletAddress;
    actual_recipient: WalletAddress;
    already_processed: boolean;
  };
}

// Payment processing state
export interface PaymentProcessingState {
  step: 'connecting' | 'approving' | 'sending' | 'confirming' | 'completed' | 'failed';
  message: string;
  txHash?: TransactionHash;
  error?: string;
}

// Payment form data
export interface PaymentFormData {
  amount: number;
  recipient_address: WalletAddress;
  invoice_id: string;
}

// Payment transaction details
export interface PaymentTransaction {
  hash: TransactionHash;
  blockNumber?: number;
  blockHash?: string;
  from: WalletAddress;
  to: WalletAddress;
  value: string;
  gasUsed?: string;
  gasPrice?: string;
  status: 'success' | 'failed';
  confirmations: number;
  timestamp?: number;
}

// Payment analytics
export interface PaymentAnalytics {
  total_payments: number;
  total_volume: number;
  successful_payments: number;
  failed_payments: number;
  pending_payments: number;
  average_amount: number;
  average_confirmation_time: number; // in seconds
  gas_costs: {
    total: number;
    average: number;
    currency: string;
  };
}

// Payment history item
export interface PaymentHistoryItem {
  payment_id: string;
  invoice_id: string;
  client_name: string;
  amount: number;
  status: PaymentStatus;
  tx_hash: TransactionHash;
  block_number?: number;
  confirmations: number;
  created_at: DateString;
}

// Payment filters
export interface PaymentFilters {
  status?: PaymentStatus;
  amount_min?: number;
  amount_max?: number;
  date_from?: DateString;
  date_to?: DateString;
  address?: WalletAddress;
  invoice_id?: string;
}

// Payment notification
export interface PaymentNotification {
  type: 'payment_received' | 'payment_confirmed' | 'payment_failed';
  payment: Payment;
  invoice: any; // Will reference Invoice type
  message: string;
  timestamp: DateString;
}

// USDC payment specific types
export interface USDCPaymentInfo {
  token_address: WalletAddress;
  decimals: number;
  symbol: string;
  amount_wei: string;
  amount_formatted: string;
  network: {
    name: string;
    chainId: number;
  };
}

// Payment link generation
export interface PaymentLinkOptions {
  invoice_id: string;
  amount: number;
  recipient: WalletAddress;
  description?: string;
  due_date?: DateString;
  success_url?: string;
  cancel_url?: string;
}

export interface PaymentLink {
  id: string;
  url: string;
  invoice_id: string;
  amount: number;
  recipient: WalletAddress;
  expires_at?: DateString;
  created_at: DateString;
  clicks: number;
  conversions: number;
}

// Payment widget configuration
export interface PaymentWidgetConfig {
  invoice_id: string;
  amount: number;
  recipient: WalletAddress;
  theme?: 'light' | 'dark';
  show_amount?: boolean;
  show_description?: boolean;
  custom_css?: string;
}

// Payment webhook
export interface PaymentWebhook {
  id: string;
  url: string;
  events: PaymentWebhookEvent[];
  secret: string;
  active: boolean;
  created_at: DateString;
}

export type PaymentWebhookEvent = 
  | 'payment.created'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.refunded';

// Payment refund (for future use)
export interface PaymentRefund {
  refund_id: string;
  payment_id: string;
  amount: number;
  reason: string;
  tx_hash?: TransactionHash;
  status: 'pending' | 'completed' | 'failed';
  created_at: DateString;
  completed_at?: DateString;
}

// Payment context types
export interface PaymentContextState {
  payments: Payment[];
  currentPayment: Payment | null;
  processingState: PaymentProcessingState | null;
  isLoading: boolean;
  error: string | null;
  analytics: PaymentAnalytics | null;
}

export interface PaymentContextActions {
  verifyPayment: (request: VerifyPaymentRequest) => Promise<PaymentVerificationResult>;
  getPayment: (id: string) => Promise<Payment>;
  getPaymentByTxHash: (txHash: TransactionHash) => Promise<Payment>;
  sendPayment: (invoiceId: string, amount: number, recipient: WalletAddress) => Promise<TransactionHash>;
  trackPayment: (txHash: TransactionHash) => Promise<PaymentTransaction>;
  getUserPayments: (walletAddress: WalletAddress, filters?: PaymentFilters) => Promise<Payment[]>;
  setProcessingState: (state: PaymentProcessingState | null) => void;
  clearError: () => void;
}