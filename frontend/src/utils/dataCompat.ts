/**
 * Data compatibility utilities for handling both old and new data structures
 * during the backend migration period.
 */

import { Invoice, User, Payment } from '@/types';
import { WalletAddress, DateString } from '@/types/common';

// User data compatibility helpers
export const getUserDisplayName = (user: User): string => {
  // Try new nested profile structure first, then fallback to legacy
  return user.profile?.display_name || user.display_name || '';
};

export const getUserEmail = (user: User): string => {
  // User email is at root level in both structures
  return user.email || '';
};

export const getUserAvatarUrl = (user: User): string | undefined => {
  // Avatar only exists in new nested profile structure
  return user.profile?.avatar_url;
};

export const getUserBio = (user: User): string | undefined => {
  // Bio only exists in new nested profile structure
  return user.profile?.bio;
};

// Invoice data compatibility helpers
export const getInvoiceClientName = (invoice: Invoice): string => {
  // Try new client_info structure first, then fallback to legacy
  return (invoice as any).client_info?.name || (invoice as any).client_name || '';
};

export const getInvoiceClientEmail = (invoice: Invoice): string => {
  // Try new client_info structure first, then fallback to legacy
  return (invoice as any).client_info?.email || (invoice as any).client_email || '';
};

export const getInvoiceClientAddress = (invoice: Invoice): string | undefined => {
  // Client address only exists in new structure
  return (invoice as any).client_info?.address;
};

export const getInvoiceAmount = (invoice: Invoice): number => {
  // Try new amounts.total first, then fallback to legacy amount
  return (invoice as any).amounts?.total || invoice.amount || 0;
};

export const getInvoiceSubtotal = (invoice: Invoice): number => {
  // Subtotal only exists in new structure, fallback to total amount
  return (invoice as any).amounts?.subtotal || (invoice as any).amounts?.total || invoice.amount || 0;
};

export const getInvoiceTaxAmount = (invoice: Invoice): number => {
  // Tax amount only exists in new structure
  return (invoice as any).amounts?.tax_amount || 0;
};

export const getInvoiceDescription = (invoice: Invoice): string => {
  // Try new metadata.description first, then fallback to legacy
  return (invoice as any).metadata?.description || (invoice as any).description || '';
};

export const getInvoicePaymentUrl = (invoice: Invoice): string => {
  // Try new blockchain_data.payment_url first, then fallback to legacy
  return (invoice as any).blockchain_data?.payment_url || (invoice as any).payment_url || '';
};

export const getInvoicePdfUrl = (invoice: Invoice): string | undefined => {
  // Try new metadata.pdf_url first, then fallback to legacy
  return (invoice as any).metadata?.pdf_url || (invoice as any).pdf_url;
};

export const getInvoiceNotes = (invoice: Invoice): string | undefined => {
  // Notes only exist in new structure
  return (invoice as any).metadata?.notes;
};

// Payment data compatibility helpers
export const getPaymentTransactionHash = (payment: Payment): string => {
  // Handle both field names
  return (payment as any).transaction_hash || (payment as any).tx_hash || '';
};

export const getPaymentNetwork = (payment: Payment): string | undefined => {
  // Network only exists in new structure
  return (payment as any).network;
};

export const getPaymentTokenAddress = (payment: Payment): string | undefined => {
  // Token address only exists in new structure
  return (payment as any).token_address;
};

// Data transformation helpers for API requests
export interface LegacyInvoiceRequest {
  creator_wallet: WalletAddress;
  client_email: string;
  client_name: string;
  amount: number;
  description: string;
  line_items?: any[];
  due_date: DateString;
}

export interface EnhancedInvoiceRequest {
  creator_wallet: WalletAddress;
  client_info: {
    name: string;
    email: string;
    address?: string;
  };
  amounts: {
    subtotal: number;
    tax_rate?: number;
    tax_amount?: number;
    discount_amount?: number;
    total: number;
  };
  line_items?: any[];
  due_date: DateString;
  blockchain_data?: {
    network: string;
    token_address: string;
    recipient_address: string;
  };
  metadata?: {
    notes?: string;
    description?: string;
  };
}

// Convert legacy invoice request to enhanced format
export const transformInvoiceRequest = (legacy: LegacyInvoiceRequest): EnhancedInvoiceRequest => {
  return {
    creator_wallet: legacy.creator_wallet,
    client_info: {
      name: legacy.client_name,
      email: legacy.client_email,
    },
    amounts: {
      subtotal: legacy.amount,
      total: legacy.amount,
    },
    line_items: legacy.line_items,
    due_date: legacy.due_date,
    metadata: {
      description: legacy.description,
    },
  };
};

// Helper to determine if an invoice is using the new schema
export const isEnhancedInvoice = (invoice: Invoice): boolean => {
  return !!((invoice as any).client_info || (invoice as any).amounts || (invoice as any).blockchain_data);
};

// Helper to determine if a user is using the new schema
export const isEnhancedUser = (user: User): boolean => {
  return !!(user.profile || user.id || user.tenant_id);
};

// Helper to determine if a payment is using the new schema
export const isEnhancedPayment = (payment: Payment): boolean => {
  return !!((payment as any).network || (payment as any).token_address || (payment as any).confirmed_at);
};

// Error message extraction helpers
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error?.message) return error.error.message;
  return 'An unexpected error occurred';
};

export const getValidationErrors = (error: any): Array<{field: string, message: string}> => {
  if (error?.validation_errors) {
    return error.validation_errors;
  }
  if (error?.details && Array.isArray(error.details)) {
    return error.details.map((detail: any) => ({
      field: detail.field || 'unknown',
      message: detail.message || 'Validation error'
    }));
  }
  return [];
};

// Helper to check if error is a specific type
export const isErrorType = (error: any, errorCode: string): boolean => {
  return error?.code === errorCode || error?.error?.code === errorCode;
};

// Helper to format validation errors for display
export const formatValidationErrors = (errors: Array<{field: string, message: string}>): string => {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0].message;
  
  return errors.map(error => `${error.field}: ${error.message}`).join(', ');
};