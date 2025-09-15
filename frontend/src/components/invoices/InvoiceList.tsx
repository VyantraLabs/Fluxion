'use client';

import { useState } from 'react';
import { Invoice, InvoiceStatus } from '@/types/invoice';
import { getShareableLink, updateInvoiceStatus } from '@/utils/api/invoices';
import toast from 'react-hot-toast';

interface InvoiceListProps {
  invoices: Invoice[];
  isLoading?: boolean;
  onInvoiceClick?: (invoice: Invoice) => void;
  onStatusFilter?: (status: InvoiceStatus | 'all') => void;
  onCreateClick?: () => void;
  onInvoiceUpdate?: (invoice: Invoice) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  created: 'bg-blue-50 text-blue-800',
  initiated: 'bg-blue-100 text-blue-700',
  sent: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  partial: 'bg-yellow-100 text-yellow-800'
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  created: 'Created',
  initiated: 'Initiated',
  sent: 'Sent',
  pending: 'Pending',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  partial: 'Partially Paid'
};

export function InvoiceList({ 
  invoices, 
  isLoading = false, 
  onInvoiceClick, 
  onStatusFilter,
  onCreateClick,
  onInvoiceUpdate,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false
}: InvoiceListProps) {
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<{ [invoiceId: string]: string }>({});

  const handleStatusFilter = (status: InvoiceStatus | 'all') => {
    setSelectedStatus(status);
    onStatusFilter?.(status);
  };

  const formatAmount = (amount: string, tokenSymbol?: string) => {
    const numAmount = parseFloat(amount);
    return `${numAmount.toLocaleString()} ${tokenSymbol || 'tokens'}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: InvoiceStatus) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
      {statusLabels[status]}
    </span>
  );

  const handleShareInvoice = async (invoice: Invoice) => {
    try {
      setActionLoading(prev => ({ ...prev, [invoice.id]: 'sharing' }));
      const { shareUrl } = await getShareableLink(invoice.id);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Invoice link copied to clipboard!');
    } catch (error: any) {
      console.error('Error sharing invoice:', error);
      toast.error(error.message || 'Failed to generate share link');
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[invoice.id];
        return newState;
      });
    }
  };

  const handleUpdateStatus = async (invoice: Invoice, newStatus: 'sent' | 'cancelled') => {
    try {
      setActionLoading(prev => ({ ...prev, [invoice.id]: 'updating' }));
      const updatedInvoice = await updateInvoiceStatus(invoice.id, newStatus);
      
      onInvoiceUpdate?.(updatedInvoice);
      toast.success(`Invoice ${newStatus === 'sent' ? 'sent' : 'cancelled'} successfully!`);
    } catch (error: any) {
      console.error('Error updating invoice status:', error);
      toast.error(error.message || 'Failed to update invoice status');
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[invoice.id];
      return newState;
      });
    }
  };

  const getActionButtons = (invoice: Invoice) => {
    const loading = actionLoading[invoice.id];
    
    return (
      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
        {/* Share button */}
        <button
          onClick={() => handleShareInvoice(invoice)}
          disabled={!!loading}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          title="Copy share link"
        >
          {loading === 'sharing' ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          )}
        </button>
        
        {/* Status action buttons */}
        {invoice.status === 'draft' && (
          <button
            onClick={() => handleUpdateStatus(invoice, 'sent')}
            disabled={!!loading}
            className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50"
          >
            {loading === 'updating' ? 'Sending...' : 'Send'}
          </button>
        )}
        
        {(invoice.status === 'draft' || invoice.status === 'sent') && (
          <button
            onClick={() => handleUpdateStatus(invoice, 'cancelled')}
            disabled={!!loading}
            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
          >
            {loading === 'updating' ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="flex justify-between items-center mb-4">
              <div className="h-8 bg-gray-200 rounded w-48"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-64"></div>
                      <div className="h-3 bg-gray-200 rounded w-48"></div>
                      <div className="h-3 bg-gray-200 rounded w-32"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
            <p className="text-sm text-gray-500 mt-1">
              {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
            </p>
          </div>
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              New Invoice
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => handleStatusFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              selectedStatus === 'all'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {Object.entries(statusLabels).map(([status, label]) => (
            <button
              key={status}
              onClick={() => handleStatusFilter(status as InvoiceStatus)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedStatus === status
                  ? statusColors[status as InvoiceStatus]
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      <div className="divide-y divide-gray-200">
        {invoices.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first invoice.
            </p>
            {onCreateClick && (
              <div className="mt-6">
                <button
                  onClick={onCreateClick}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  New Invoice
                </button>
              </div>
            )}
          </div>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className={`p-6 hover:bg-gray-50 transition-colors ${
                onInvoiceClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => onInvoiceClick?.(invoice)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {invoice.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        #{invoice.invoiceNumber}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      {invoice.clientName || 'No client name'}
                    </div>
                    <span className="mx-2">•</span>
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      Created {formatDate(invoice.createdAt)}
                    </div>
                    {invoice.dueDate && (
                      <>
                        <span className="mx-2">•</span>
                        <div className="flex items-center">
                          <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          Due {formatDate(invoice.dueDate)}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end space-y-2">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatAmount(invoice.amount, invoice.token?.symbol)}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(invoice.status)}
                  </div>
                  {getActionButtons(invoice)}
                </div>
              </div>

              {invoice.description && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                  {invoice.description}
                </p>
              )}
            </div>
          ))
        )}
        
        {/* Load More Button */}
        {hasMore && (
          <div className="p-6 border-t border-gray-200 text-center">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}