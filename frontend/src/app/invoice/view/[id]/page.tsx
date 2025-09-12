'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Invoice } from '@/types/invoice';
import { getPublicInvoice } from '@/utils/api/invoices';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function PublicInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const invoiceData = await getPublicInvoice(invoiceId);
      setInvoice(invoiceData);
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      const errorMessage = error.message || 'Failed to load invoice';
      setError(errorMessage);
      
      // Show user-friendly error based on status code
      if (error.code === 'INVOICE_NOT_FOUND') {
        setError('Invoice not found. It may have been deleted or the link is invalid.');
      } else if (error.code === 'UNAUTHORIZED') {
        setError('This invoice is private and cannot be viewed publicly.');
      } else {
        setError('Unable to load invoice. Please check the link and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: string, tokenSymbol?: string) => {
    const numAmount = parseFloat(amount);
    return `${numAmount.toLocaleString()} ${tokenSymbol || 'tokens'}`;
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-600';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isDue = invoice?.dueDate && new Date(invoice.dueDate) < new Date();
  const isOverdue = invoice?.status === 'overdue' || (isDue && invoice?.status !== 'paid');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-6">
          <div className="animate-pulse">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-6 w-2/3"></div>
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-6"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Unable to Load Invoice</h3>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <div className="mt-6">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Invoice not found</h3>
          <p className="mt-1 text-sm text-gray-500">The invoice you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-8 sm:px-8">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div className="sm:flex sm:space-x-5">
                <div className="mt-4 text-center sm:mt-0 sm:text-left">
                  <h1 className="text-2xl font-bold text-gray-900">{invoice.title}</h1>
                  <p className="text-sm font-medium text-gray-500">Invoice #{invoice.invoiceNumber}</p>
                </div>
              </div>
              <div className="mt-5 flex justify-center sm:mt-0">
                <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="border-t border-gray-200 px-6 py-6 sm:px-8">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {invoice.clientName && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Bill To</dt>
                  <dd className="mt-1 text-sm text-gray-900">{invoice.clientName}</dd>
                  {invoice.clientEmail && (
                    <dd className="mt-1 text-sm text-gray-500">{invoice.clientEmail}</dd>
                  )}
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">Issue Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(invoice.createdAt)}</dd>
              </div>

              {invoice.dueDate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Due Date</dt>
                  <dd className={`mt-1 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                    {formatDate(invoice.dueDate)}
                    {isOverdue && (
                      <span className="ml-2 text-red-500 text-xs">
                        (Overdue by {formatDistanceToNow(new Date(invoice.dueDate))})
                      </span>
                    )}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">Network</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {invoice.network?.name} (Chain ID: {invoice.network?.chainId})
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Payment Token</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {invoice.token?.symbol}
                </dd>
              </div>

              {invoice.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{invoice.description}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Amount Section */}
          <div className="bg-gray-50 px-6 py-6 sm:px-8">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div>
                <dt className="text-base font-medium text-gray-500">Total Amount</dt>
                <dd className="mt-1 text-3xl font-bold text-gray-900">
                  {formatAmount(invoice.amount, invoice.token?.symbol)}
                </dd>
                {parseFloat(invoice.amountPaid) > 0 && (
                  <dd className="mt-1 text-sm text-green-600">
                    Paid: {formatAmount(invoice.amountPaid, invoice.token?.symbol)}
                  </dd>
                )}
              </div>
              
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <div className="mt-4 sm:mt-0">
                  <button
                    onClick={() => toast('Payment integration coming soon!')}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Pay Invoice
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Payment Instructions */}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <div className="border-t border-gray-200 px-6 py-6 sm:px-8">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Payment Instructions</h3>
              <div className="bg-blue-50 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      To pay this invoice, you'll need to send <strong>{formatAmount(invoice.amount, invoice.token?.symbol)}</strong> 
                      {' '}to the payment address using the {invoice.network?.name} network.
                    </p>
                    <p className="text-sm text-blue-700 mt-2">
                      Click "Pay Invoice" above to connect your wallet and complete the payment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="border-t border-gray-200 px-6 py-6 sm:px-8">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Payment History</h3>
              <div className="space-y-3">
                {invoice.payments.map((payment, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatAmount(payment.amount, invoice.token?.symbol)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(payment.createdAt)} • Status: {payment.status}
                      </p>
                    </div>
                    {payment.transactionHash && (
                      <a
                        href={`https://etherscan.io/tx/${payment.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-500 text-sm"
                      >
                        View Transaction ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Powered by Fluxion • Secure Web3 Invoicing Platform
          </p>
        </div>
      </div>
    </div>
  );
}