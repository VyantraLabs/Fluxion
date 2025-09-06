'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UnifiedInvoiceForm } from '@/components/invoices/UnifiedInvoiceForm';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { invoiceApi, InvoiceApiError } from '@/utils/api/invoices';
import { Invoice, CreateInvoiceRequest, InvoiceStatus } from '@/types/invoice';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig, useConfigLoading } from '@/contexts/ConfigContext';
import toast from 'react-hot-toast';

export default function InvoicesPage() {
  const router = useRouter();
  const { state: authState } = useAuth();
  const { config } = useConfig();
  const { isLoading: configLoading, isLoaded: configLoaded } = useConfigLoading();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({
    hasMore: false,
    nextToken: undefined as string | undefined,
    isLoadingMore: false
  });

  // Authentication check
  useEffect(() => {
    if (!authState.isAuthenticated) {
      toast.error('Please connect your wallet and authenticate to access invoices');
      router.push('/');
      return;
    }
  }, [authState.isAuthenticated, router]);

  // Load data when authenticated and config is loaded
  useEffect(() => {
    if (authState.isAuthenticated && configLoaded) {
      loadInvoices();
      loadStats();
    }
  }, [authState.isAuthenticated, configLoaded]);

  const loadInvoices = async (reset = true) => {
    try {
      if (reset) {
        setIsLoading(true);
        setPagination(prev => ({ ...prev, nextToken: undefined }));
      } else {
        setPagination(prev => ({ ...prev, isLoadingMore: true }));
      }
      setError(null);
      
      const response = await invoiceApi.getUserInvoices({
        limit: 20,
        nextToken: reset ? undefined : pagination.nextToken
      });
      
      if (reset) {
        setInvoices(response.invoices);
      } else {
        setInvoices(prev => [...prev, ...response.invoices]);
      }
      
      setPagination({
        hasMore: response.pagination.hasMore,
        nextToken: response.pagination.nextToken,
        isLoadingMore: false
      });
    } catch (err) {
      if (err instanceof InvoiceApiError) {
        setError(err.message);
      } else {
        setError('Failed to load invoices');
      }
      console.error('Error loading invoices:', err);
    } finally {
      setIsLoading(false);
      setPagination(prev => ({ ...prev, isLoadingMore: false }));
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await invoiceApi.getDashboardStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleCreateInvoice = async (data: CreateInvoiceRequest) => {
    try {
      setIsCreating(true);
      setError(null);
      const newInvoice = await invoiceApi.createInvoice(data);
      setInvoices(prev => [newInvoice, ...prev]);
      setShowCreateForm(false);
      loadStats(); // Refresh stats
      toast.success('Invoice created successfully!');
    } catch (err) {
      if (err instanceof InvoiceApiError) {
        setError(err.message);
      } else {
        setError('Failed to create invoice');
      }
      console.error('Error creating invoice:', err);
      throw err; // Let the form handle it
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusFilter = async (status: InvoiceStatus | 'all') => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await invoiceApi.getUserInvoices({
        status: status === 'all' ? undefined : status,
        limit: 20
      });
      setInvoices(response.invoices);
      setPagination({
        hasMore: response.pagination.hasMore,
        nextToken: response.pagination.nextToken,
        isLoadingMore: false
      });
    } catch (err) {
      if (err instanceof InvoiceApiError) {
        setError(err.message);
      } else {
        setError('Failed to filter invoices');
      }
      console.error('Error filtering invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvoiceClick = (invoice: Invoice) => {
    // Navigate to invoice view
    router.push(`/invoice/view/${invoice.id}`);
  };

  const handleInvoiceUpdate = (updatedInvoice: Invoice) => {
    setInvoices(prev => 
      prev.map(invoice => 
        invoice.id === updatedInvoice.id ? updatedInvoice : invoice
      )
    );
    loadStats(); // Refresh stats when invoice status changes
  };

  const handleLoadMore = () => {
    loadInvoices(false);
  };

  // Show loading state while config is loading
  if (configLoading || (!configLoaded && !config.error)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading blockchain configuration...</p>
        </div>
      </div>
    );
  }

  // Show error state if config failed to load
  if (config.error && !configLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Configuration Error</h3>
          <p className="mt-2 text-sm text-gray-500">{config.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Invoices
            </h2>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Invoices</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.total}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Amount</dt>
                      <dd className="text-lg font-medium text-gray-900">{parseFloat(stats.totalAmount).toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Paid Amount</dt>
                      <dd className="text-lg font-medium text-gray-900">{parseFloat(stats.totalPaidAmount).toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Overdue</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.overdue}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="text-sm font-medium text-red-800 hover:text-red-600"
                    onClick={() => {
                      setError(null);
                      loadInvoices();
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Invoice Form */}
        {showCreateForm && (
          <div className="mt-8">
            <UnifiedInvoiceForm
              layout="single-page"
              onSubmit={handleCreateInvoice}
              onCancel={() => setShowCreateForm(false)}
              showHeader={false}
              autoSave={false}
              showSendOption={true}
              allowDraft={true}
              submitButtonText={isCreating ? 'Creating...' : 'Create Invoice'}
              containerClassName="max-w-full"
            />
          </div>
        )}

        {/* Invoice List */}
        {!showCreateForm && (
          <div className="mt-8">
            <InvoiceList
              invoices={invoices}
              isLoading={isLoading}
              onInvoiceClick={handleInvoiceClick}
              onStatusFilter={handleStatusFilter}
              onCreateClick={() => setShowCreateForm(true)}
              onInvoiceUpdate={handleInvoiceUpdate}
              hasMore={pagination.hasMore}
              onLoadMore={handleLoadMore}
              isLoadingMore={pagination.isLoadingMore}
            />
          </div>
        )}
      </div>
    </div>
  );
}