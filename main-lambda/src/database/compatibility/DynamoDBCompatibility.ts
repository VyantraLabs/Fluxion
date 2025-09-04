/**
 * DynamoDB Compatibility Layer
 * 
 * This module provides compatibility functions to transform PostgreSQL query results
 * into DynamoDB-like response formats, ensuring existing API endpoints continue to work
 * without any changes to the frontend.
 */

import { User } from '../entities/User';
import { Invoice } from '../entities/Invoice';
import { Payment } from '../entities/Payment';
import { Organization } from '../entities/Organization';
import { 
  UserRecord, 
  InvoiceRecord, 
  PaymentRecord, 
  FluxionRecord,
  MultiTableQueryResult 
} from '@/types/common';

/**
 * Transform PostgreSQL User entity to DynamoDB UserRecord format
 */
export function transformUserToDynamoDB(user: User): UserRecord {
  return {
    // DynamoDB-style keys
    PK: `TENANT#${user.organizationId}`,
    SK: `USER#${user.id}`,
    GSI1PK: `TENANT#${user.organizationId}#USERS`,
    GSI1SK: `EMAIL#${user.email}`,
    GSI2PK: user.walletAddress ? `WALLET#${user.walletAddress}` : undefined,
    GSI2SK: `TENANT#${user.organizationId}`,
    
    // Entity metadata
    entityType: 'user',
    
    // User data
    user_id: user.id,
    tenant_id: user.organizationId,
    email: user.email,
    wallet_address: user.walletAddress,
    name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    first_name: user.firstName,
    last_name: user.lastName,
    role: user.role,
    status: user.isActive ? 'active' : 'inactive',
    email_verified: user.emailVerified,
    last_login_at: user.lastLoginAt?.toISOString(),
    
    // Timestamps
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
    
    // Computed fields for API compatibility
    display_name: user.displayName,
    permissions: {
      is_owner: user.isOwner,
      is_admin: user.isAdmin,
      can_manage_users: user.canManageUsers,
      can_create_invoices: user.canCreateInvoices,
      can_view_reports: user.canViewReports,
    },
  } as UserRecord;
}

/**
 * Transform PostgreSQL Invoice entity to DynamoDB InvoiceRecord format
 */
export function transformInvoiceToDynamoDB(invoice: Invoice): InvoiceRecord {
  return {
    // DynamoDB-style keys
    PK: `TENANT#${invoice.organizationId}`,
    SK: `INVOICE#${invoice.id}`,
    GSI1PK: `TENANT#${invoice.organizationId}#INVOICES`,
    GSI1SK: `STATUS#${invoice.status}#${invoice.createdAt.toISOString()}`,
    GSI2PK: `USER#${invoice.createdBy}`,
    GSI2SK: `INVOICE#${invoice.createdAt.toISOString()}`,
    
    // Entity metadata
    entityType: 'invoice',
    
    // Invoice data
    invoice_id: invoice.id,
    tenant_id: invoice.organizationId,
    freelancer_id: invoice.createdBy, // Legacy field name
    created_by: invoice.createdBy,
    invoice_number: invoice.invoiceNumber,
    
    // Invoice details
    title: invoice.title,
    description: invoice.description,
    amount: invoice.amount,
    amount_paid: invoice.amountPaid,
    status: invoice.status,
    due_date: invoice.dueDate?.toISOString(),
    
    // Client information
    client_name: invoice.clientName,
    client_email: invoice.clientEmail,
    client_wallet: invoice.clientWallet,
    
    // Blockchain data
    chain_id: invoice.network?.chainId,
    network_name: invoice.network?.name,
    token: invoice.token?.symbol,
    token_name: invoice.token?.name,
    token_decimals: invoice.token?.decimals,
    token_address: invoice.token?.contractAddress,
    
    // Legacy blockchain fields for API compatibility
    network_id: invoice.networkId,
    token_id: invoice.tokenId,
    
    // Status timestamps
    sent_at: invoice.sentAt?.toISOString(),
    paid_at: invoice.paidAt?.toISOString(),
    
    // Timestamps
    created_at: invoice.createdAt.toISOString(),
    updated_at: invoice.updatedAt.toISOString(),
    
    // Computed fields
    display_amount: invoice.displayAmount,
    display_amount_paid: invoice.displayAmountPaid,
    remaining_amount: invoice.remainingAmount,
    display_remaining_amount: invoice.displayRemainingAmount,
    is_overdue: invoice.isOverdue,
    is_paid: invoice.isPaid,
    is_partially_paid: invoice.isPartiallyPaid,
    payment_progress: invoice.paymentProgress,
    days_until_due: invoice.daysUntilDue,
    client_display_name: invoice.clientDisplayName,
    
    // Metadata
    metadata: invoice.metadata || {},
  } as InvoiceRecord;
}

/**
 * Transform PostgreSQL Payment entity to DynamoDB PaymentRecord format
 */
export function transformPaymentToDynamoDB(payment: Payment): PaymentRecord {
  return {
    // DynamoDB-style keys
    PK: `TENANT#${payment.organizationId}`,
    SK: `PAYMENT#${payment.id}`,
    GSI1PK: payment.invoiceId ? `INVOICE#${payment.invoiceId}` : `TENANT#${payment.organizationId}#PAYMENTS`,
    GSI1SK: `PAYMENT#${payment.createdAt.toISOString()}`,
    GSI2PK: `TX#${payment.txHash}`,
    GSI2SK: `NETWORK#${payment.networkId}`,
    
    // Entity metadata
    entityType: 'payment',
    
    // Payment data
    payment_id: payment.id,
    tenant_id: payment.organizationId,
    invoice_id: payment.invoiceId,
    
    // Transaction details
    tx_hash: payment.txHash,
    chain_id: payment.network?.chainId,
    network_name: payment.network?.name,
    token: payment.token?.symbol,
    token_name: payment.token?.name,
    token_decimals: payment.token?.decimals,
    token_address: payment.token?.contractAddress,
    
    // Legacy blockchain fields
    network_id: payment.networkId,
    token_id: payment.tokenId,
    
    // Payment details
    from_wallet: payment.fromAddress,
    to_wallet: payment.toAddress,
    from_address: payment.fromAddress,
    to_address: payment.toAddress,
    amount: payment.amount,
    gas_used: payment.gasUsed,
    gas_price: payment.gasPrice,
    gas_fee: payment.totalGasCost,
    
    // Status and confirmation
    status: payment.status,
    block_number: payment.blockNumber,
    confirmations: payment.confirmations,
    
    // Timestamps
    timestamp: payment.createdAt.toISOString(), // Legacy field name
    created_at: payment.createdAt.toISOString(),
    updated_at: payment.updatedAt.toISOString(),
    confirmed_at: payment.confirmedAt?.toISOString(),
    
    // Computed fields
    display_amount: payment.displayAmount,
    short_tx_hash: payment.shortTxHash,
    short_from_address: payment.shortFromAddress,
    short_to_address: payment.shortToAddress,
    is_confirmed: payment.isConfirmed,
    is_pending: payment.isPending,
    is_failed: payment.isFailed,
    explorer_url: payment.explorerUrl,
    from_address_url: payment.fromAddressUrl,
    to_address_url: payment.toAddressUrl,
    display_gas_cost: payment.displayGasCost,
    confirmation_progress: payment.confirmationProgress,
    age: payment.age,
    age_in_minutes: payment.ageInMinutes,
    
    // Metadata
    metadata: payment.metadata || {},
  } as PaymentRecord;
}

/**
 * Transform pagination results to DynamoDB format
 */
export function transformPaginationToDynamoDB<T, R>(
  result: { items: T[]; total: number; page: number; limit: number; totalPages: number },
  transformFn: (item: T) => R
): MultiTableQueryResult<R> {
  return {
    items: result.items.map(transformFn),
    nextToken: result.page < result.totalPages 
      ? Buffer.from((result.page + 1).toString()).toString('base64')
      : undefined,
  };
}

/**
 * Transform simple array results to DynamoDB format
 */
export function transformArrayToDynamoDB<T, R>(
  items: T[],
  transformFn: (item: T) => R,
  nextToken?: string
): MultiTableQueryResult<R> {
  return {
    items: items.map(transformFn),
    nextToken,
  };
}

/**
 * Parse DynamoDB-style next token to pagination info
 */
export function parseDynamoDBNextToken(nextToken?: string): { page: number } {
  if (!nextToken) {
    return { page: 1 };
  }
  
  try {
    const page = parseInt(Buffer.from(nextToken, 'base64').toString());
    return { page: isNaN(page) ? 1 : page };
  } catch {
    return { page: 1 };
  }
}

/**
 * Generate DynamoDB-style next token from pagination info
 */
export function generateDynamoDBNextToken(page: number): string {
  return Buffer.from(page.toString()).toString('base64');
}

/**
 * Transform any entity to generic FluxionRecord format
 */
export function transformToFluxionRecord(
  entity: any,
  entityType: string,
  tenantId: string
): FluxionRecord {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `${entityType.toUpperCase()}#${entity.id}`,
    entityType,
    ...entity,
    tenant_id: tenantId,
    created_at: entity.createdAt?.toISOString() || entity.created_at,
    updated_at: entity.updatedAt?.toISOString() || entity.updated_at,
  } as FluxionRecord;
}

/**
 * Legacy compatibility functions for specific use cases
 */
export class DynamoDBCompatibilityHelper {
  /**
   * Convert PostgreSQL user query to DynamoDB response format
   */
  static transformUsersQuery(users: User[]): { items: UserRecord[]; nextToken?: string } {
    return {
      items: users.map(transformUserToDynamoDB),
      nextToken: undefined, // Implement if needed
    };
  }

  /**
   * Convert PostgreSQL invoice query to DynamoDB response format
   */
  static transformInvoicesQuery(invoices: Invoice[]): { items: InvoiceRecord[]; nextToken?: string } {
    return {
      items: invoices.map(transformInvoiceToDynamoDB),
      nextToken: undefined, // Implement if needed
    };
  }

  /**
   * Convert PostgreSQL payment query to DynamoDB response format
   */
  static transformPaymentsQuery(payments: Payment[]): { items: PaymentRecord[]; nextToken?: string } {
    return {
      items: payments.map(transformPaymentToDynamoDB),
      nextToken: undefined, // Implement if needed
    };
  }

  /**
   * Generate legacy PK/SK patterns for compatibility
   */
  static generateLegacyKeys(entityType: string, tenantId: string, entityId: string): {
    PK: string;
    SK: string;
    GSI1PK?: string;
    GSI1SK?: string;
  } {
    const baseKeys = {
      PK: `TENANT#${tenantId}`,
      SK: `${entityType.toUpperCase()}#${entityId}`,
    };

    // Add GSI keys based on entity type
    switch (entityType.toLowerCase()) {
      case 'user':
        return {
          ...baseKeys,
          GSI1PK: `TENANT#${tenantId}#USERS`,
          GSI1SK: `USER#${entityId}`,
        };
      case 'invoice':
        return {
          ...baseKeys,
          GSI1PK: `TENANT#${tenantId}#INVOICES`,
          GSI1SK: `INVOICE#${entityId}`,
        };
      case 'payment':
        return {
          ...baseKeys,
          GSI1PK: `TENANT#${tenantId}#PAYMENTS`,
          GSI1SK: `PAYMENT#${entityId}`,
        };
      default:
        return baseKeys;
    }
  }

  /**
   * Transform health check response to DynamoDB format
   */
  static transformHealthCheck(status: 'healthy' | 'unhealthy', latency: number, error?: string): {
    status: 'healthy' | 'unhealthy';
    latency: number;
    error?: string;
    // Legacy DynamoDB fields
    table_status?: string;
    connection_status?: string;
  } {
    return {
      status,
      latency,
      error,
      // Legacy compatibility
      table_status: status,
      connection_status: status,
    };
  }
}

// Export all transformation functions for easy importing
export {
  transformUserToDynamoDB as userToDynamoDB,
  transformInvoiceToDynamoDB as invoiceToDynamoDB,
  transformPaymentToDynamoDB as paymentToDynamoDB,
  transformPaginationToDynamoDB as paginationToDynamoDB,
  transformArrayToDynamoDB as arrayToDynamoDB,
};