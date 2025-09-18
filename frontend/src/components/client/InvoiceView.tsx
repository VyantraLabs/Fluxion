'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Calendar,
  User,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { PaymentMethods } from './PaymentMethods';
import { PaymentStatus } from './PaymentStatus';
import { formatCurrency, formatDate, formatDueDate } from '@/utils/format';
import { invoiceApi, paymentApi, handleApiResponse, handleApiError } from '@/utils/api';
import { ClientAccessResponse, InvoiceStatus } from '@/types/invoice';

interface InvoiceViewProps {
  token: string; // Access token from URL
}

interface InvoiceViewState {
  data: ClientAccessResponse | null;
  isLoading: boolean;
  error: string | null;
  paymentTxHash: string | null;
  isSubmittingPayment: boolean;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({ token }) => {
  const router = useRouter();
  const [state, setState] = useState<InvoiceViewState>({
    data: null,
    isLoading: true,
    error: null,
    paymentTxHash: null,
    isSubmittingPayment: false,
  });

  const fetchInvoiceData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await invoiceApi.getClientInvoice(token);
      const data = handleApiResponse<ClientAccessResponse>(response);
      
      setState(prev => ({
        ...prev,
        data,
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Failed to fetch invoice:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load invoice',
      }));
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [token]);

  const handlePaymentSubmit = async (txHash: string, payerAddress: string) => {
    if (!state.data) return;

    try {
      setState(prev => ({ 
        ...prev, 
        isSubmittingPayment: true,
        paymentTxHash: txHash,
      }));

      await paymentApi.submitPayment(state.data.invoice.id, txHash, payerAddress);

      // Refresh invoice data to get updated status
      await fetchInvoiceData();
    } catch (error: any) {
      console.error('Failed to submit payment:', error);
      setState(prev => ({ 
        ...prev,
        isSubmittingPayment: false,
        error: error.message || 'Failed to submit payment',
      }));
    } finally {
      setState(prev => ({ ...prev, isSubmittingPayment: false }));
    }
  };

  const getStatusInfo = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-success-600 bg-success-100',
          label: 'Paid',
        };
      case 'pending':
      case 'sent':
        return {
          icon: <Clock className="w-5 h-5" />,
          color: 'text-warning-600 bg-warning-100',
          label: 'Pending Payment',
        };
      case 'overdue':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          color: 'text-danger-600 bg-danger-100',
          label: 'Overdue',
        };
      case 'cancelled':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          color: 'text-secondary-600 bg-secondary-100',
          label: 'Cancelled',
        };
      default:
        return {
          icon: <FileText className="w-5 h-5" />,
          color: 'text-secondary-600 bg-secondary-100',
          label: status,
        };
    }
  };

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary-600 mb-4" />
          <h2 className="text-xl font-semibold text-secondary-900 mb-2">Loading Invoice</h2>
          <p className="text-secondary-600">Please wait while we fetch your invoice details...</p>
        </div>
      </div>
    );
  }

  if (state.error && !state.data) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-danger-600" />
          </div>
          <h2 className="text-xl font-semibold text-secondary-900 mb-2">Unable to Load Invoice</h2>
          <p className="text-secondary-600 mb-4">{state.error}</p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={fetchInvoiceData}
              className="btn-primary"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state.data) {
    return null;
  }

  const { invoice, token: paymentToken, network } = state.data;
  const statusInfo = getStatusInfo(invoice.status);
  const amount = parseFloat(invoice.amount);
  const dueInfo = invoice.dueDate ? formatDueDate(invoice.dueDate) : null;
  const isPaid = invoice.status === 'paid';
  const canPay = ['pending', 'sent', 'overdue'].includes(invoice.status);

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <div className="bg-white border-b border-secondary-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-secondary-900">
                  {invoice.title}
                </h1>
                <p className="text-sm text-secondary-500 mt-1">
                  Invoice #{invoice.invoiceNumber}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="ml-2">{statusInfo.label}</span>
              </div>
              <div className="mt-2 text-right">
                <p className="text-sm text-secondary-500">Amount Due</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {formatCurrency(amount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {state.error && (
          <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-danger-600 mr-2" />
              <p className="text-sm text-danger-800">{state.error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Invoice Details */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4">
                Invoice Details
              </h2>
              
              <div className="space-y-4">
                {/* Client Information */}
                {invoice.clientName && (
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-secondary-400 mr-3" />
                    <div>
                      <p className="text-sm text-secondary-500">Bill To</p>
                      <p className="text-secondary-900">{invoice.clientName}</p>
                    </div>
                  </div>
                )}

                {/* Created Date */}
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-secondary-400 mr-3" />
                  <div>
                    <p className="text-sm text-secondary-500">Created</p>
                    <p className="text-secondary-900">{formatDate(invoice.createdAt)}</p>
                  </div>
                </div>

                {/* Due Date */}
                {dueInfo && (
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-secondary-400 mr-3" />
                    <div>
                      <p className="text-sm text-secondary-500">Due Date</p>
                      <p className={`${dueInfo.status === 'overdue' ? 'text-danger-600' : 'text-secondary-900'}`}>
                        {dueInfo.formatted}
                        {dueInfo.status === 'overdue' && (
                          <span className="text-xs text-danger-600 ml-2">
                            ({Math.abs(dueInfo.daysRemaining)} days overdue)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 text-secondary-400 mr-3" />
                  <div>
                    <p className="text-sm text-secondary-500">Amount</p>
                    <p className="text-secondary-900 font-semibold">
                      {formatCurrency(amount)}
                    </p>
                    <p className="text-xs text-secondary-500">
                      {invoice.amount} {paymentToken.symbol} on {network.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {invoice.description && (
                <div className="mt-6 pt-6 border-t border-secondary-200">
                  <h3 className="text-sm font-semibold text-secondary-900 mb-2">
                    Description
                  </h3>
                  <p className="text-secondary-600 text-sm leading-relaxed">
                    {invoice.description}
                  </p>
                </div>
              )}

              {/* Paid Information */}
              {isPaid && invoice.paidAt && (
                <div className="mt-6 pt-6 border-t border-secondary-200">
                  <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-success-600 mr-2" />
                      <div>
                        <p className="text-sm font-semibold text-success-900">
                          Payment Received
                        </p>
                        <p className="text-xs text-success-800">
                          Paid on {formatDate(invoice.paidAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Powered by Fluxion */}
            <div className="mt-6 text-center">
              <p className="text-xs text-secondary-500">
                Powered by{' '}
                <a
                  href="/"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Fluxion
                </a>
              </p>
            </div>
          </div>

          {/* Payment Section */}
          <div className="lg:col-span-2">
            {isPaid ? (
              <PaymentStatus
                invoice={invoice}
                payments={invoice.payments || []}
                network={network}
                token={paymentToken}
              />
            ) : canPay ? (
              <PaymentMethods
                invoice={invoice}
                token={paymentToken}
                network={network}
                paymentAddress={state.data.paymentAddress}
                qrCodeData={state.data.qrCode}
                onPaymentSubmit={handlePaymentSubmit}
                isSubmittingPayment={state.isSubmittingPayment}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6 text-center">
                <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-secondary-400" />
                </div>
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">
                  Invoice Not Available for Payment
                </h3>
                <p className="text-secondary-600">
                  This invoice is currently {invoice.status.toLowerCase()} and cannot be paid at this time.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">
            Payment Instructions
          </h2>
          
          <div className="prose prose-sm text-secondary-600">
            <ul>
              <li>Payment must be made in <strong>{paymentToken.symbol}</strong> on the <strong>{network.name}</strong> network</li>
              <li>Send exactly <strong>{invoice.amount} {paymentToken.symbol}</strong> to avoid processing issues</li>
              <li>Payments typically confirm within 5-15 minutes depending on network conditions</li>
              <li>You will receive a confirmation once the payment is detected on the blockchain</li>
              <li>If you encounter any issues, please contact the invoice sender</li>
            </ul>
          </div>

          <div className="mt-4 pt-4 border-t border-secondary-200 flex items-center justify-between text-sm">
            <div className="flex items-center text-secondary-500">
              <span>Network: {network.name} (Chain ID: {network.chainId})</span>
            </div>
            <a
              href={network.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 flex items-center"
            >
              View on blockchain explorer
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};