'use client';

import React from 'react';
import {
  CheckCircle,
  ExternalLink,
  Calendar,
  Hash,
  DollarSign,
  User,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Invoice, Payment, Token, BlockchainNetwork } from '@/types/invoice';
import { formatCurrency, formatDate, formatTxHash, formatConfirmations } from '@/utils/format';

interface PaymentStatusProps {
  invoice: Invoice;
  payments: Payment[];
  token: Token;
  network: BlockchainNetwork;
}

interface PaymentItemProps {
  payment: Payment;
  token: Token;
  network: BlockchainNetwork;
  isLatest: boolean;
}

const PaymentItem: React.FC<PaymentItemProps> = ({ payment, token, network, isLatest }) => {
  const getStatusInfo = (status: Payment['status'], confirmations: number) => {
    switch (status) {
      case 'confirmed':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'text-success-600 bg-success-100',
          label: 'Confirmed',
          description: `Confirmed with ${formatConfirmations(confirmations)}`,
        };
      case 'pending':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          color: 'text-warning-600 bg-warning-100',
          label: 'Pending',
          description: `Waiting for confirmations (${confirmations}/12)`,
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-danger-600 bg-danger-100',
          label: 'Failed',
          description: 'Transaction failed or reverted',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          color: 'text-secondary-600 bg-secondary-100',
          label: status,
          description: '',
        };
    }
  };

  const statusInfo = getStatusInfo(payment.status, payment.confirmations);
  const amount = parseFloat(payment.amount);

  return (
    <div className={`border rounded-lg p-4 ${isLatest ? 'border-primary-200 bg-primary-50' : 'border-secondary-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusInfo.color}`}>
            {statusInfo.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-semibold text-secondary-900">
                {statusInfo.label}
              </h4>
              {isLatest && (
                <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded">
                  Latest
                </span>
              )}
            </div>
            <p className="text-xs text-secondary-600 mt-1">
              {statusInfo.description}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-semibold text-secondary-900">
            {formatCurrency(amount)}
          </p>
          <p className="text-xs text-secondary-500">
            {payment.amount} {token.symbol}
          </p>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex items-center">
          <Hash className="w-3 h-3 text-secondary-400 mr-2" />
          <div>
            <span className="text-secondary-500">Transaction:</span>
            <a
              href={`${network.explorerUrl}/tx/${payment.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary-600 hover:text-primary-700 font-mono"
            >
              {formatTxHash(payment.transactionHash)}
              <ExternalLink className="w-3 h-3 inline ml-1" />
            </a>
          </div>
        </div>

        <div className="flex items-center">
          <Calendar className="w-3 h-3 text-secondary-400 mr-2" />
          <div>
            <span className="text-secondary-500">Date:</span>
            <span className="ml-1 text-secondary-900">{formatDate(payment.createdAt)}</span>
          </div>
        </div>

        {payment.blockNumber && (
          <div className="flex items-center">
            <span className="text-secondary-500">Block:</span>
            <a
              href={`${network.explorerUrl}/block/${payment.blockNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary-600 hover:text-primary-700"
            >
              {payment.blockNumber}
              <ExternalLink className="w-3 h-3 inline ml-1" />
            </a>
          </div>
        )}

        <div className="flex items-center">
          <User className="w-3 h-3 text-secondary-400 mr-2" />
          <div>
            <span className="text-secondary-500">From:</span>
            <span className="ml-1 text-secondary-900 font-mono text-xs">
              {payment.fromAddress.slice(0, 6)}...{payment.fromAddress.slice(-4)}
            </span>
          </div>
        </div>
      </div>

      {/* Gas Information */}
      {payment.gasUsed && payment.gasPrice && (
        <div className="mt-3 pt-3 border-t border-secondary-200">
          <div className="flex justify-between text-xs text-secondary-500">
            <span>Gas Used: {parseInt(payment.gasUsed).toLocaleString()}</span>
            <span>Gas Price: {parseFloat(payment.gasPrice).toFixed(2)} Gwei</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const PaymentStatus: React.FC<PaymentStatusProps> = ({
  invoice,
  payments,
  token,
  network,
}) => {
  const totalPaid = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  const invoiceAmount = parseFloat(invoice.amount);
  const remainingAmount = invoiceAmount - totalPaid;
  const isFullyPaid = remainingAmount <= 0.001; // Account for small floating point differences
  const isOverpaid = totalPaid > invoiceAmount;
  
  // Sort payments by date (newest first)
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-secondary-900">
            Payment Status
          </h2>
          <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
            isFullyPaid 
              ? 'text-success-600 bg-success-100' 
              : 'text-warning-600 bg-warning-100'
          }`}>
            {isFullyPaid ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <Clock className="w-4 h-4 mr-2" />
            )}
            {isFullyPaid ? 'Fully Paid' : 'Partially Paid'}
          </div>
        </div>

        {/* Payment Progress */}
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-secondary-600">Amount Paid:</span>
            <span className="font-semibold text-secondary-900">
              {formatCurrency(totalPaid)} ({totalPaid.toFixed(4)} {token.symbol})
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-secondary-600">Invoice Total:</span>
            <span className="font-semibold text-secondary-900">
              {formatCurrency(invoiceAmount)} ({invoice.amount} {token.symbol})
            </span>
          </div>

          {!isFullyPaid && (
            <div className="flex justify-between text-sm">
              <span className="text-secondary-600">Remaining:</span>
              <span className="font-semibold text-danger-600">
                {formatCurrency(remainingAmount)} ({remainingAmount.toFixed(4)} {token.symbol})
              </span>
            </div>
          )}

          {isOverpaid && (
            <div className="flex justify-between text-sm">
              <span className="text-secondary-600">Overpayment:</span>
              <span className="font-semibold text-warning-600">
                +{formatCurrency(totalPaid - invoiceAmount)} ({(totalPaid - invoiceAmount).toFixed(4)} {token.symbol})
              </span>
            </div>
          )}

          {/* Progress Bar */}
          <div className="w-full bg-secondary-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isFullyPaid ? 'bg-success-500' : 'bg-primary-500'
              }`}
              style={{
                width: `${Math.min((totalPaid / invoiceAmount) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Success Message */}
        {isFullyPaid && (
          <div className="mt-4 p-4 bg-success-50 border border-success-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-success-600 mr-2" />
              <div>
                <p className="text-sm font-semibold text-success-900">
                  Payment Complete!
                </p>
                <p className="text-sm text-success-800">
                  This invoice has been fully paid. Thank you for your payment.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">
          Payment History
        </h3>

        {payments.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-secondary-400 mx-auto mb-3" />
            <p className="text-secondary-600">No payments recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPayments.map((payment, index) => (
              <PaymentItem
                key={payment.id}
                payment={payment}
                token={token}
                network={network}
                isLatest={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Network Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              {network.metadata?.logo ? (
                <img
                  src={network.metadata.logo}
                  alt={network.name}
                  className="w-5 h-5 rounded"
                />
              ) : (
                <ExternalLink className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">{network.name} Network</p>
              <p className="text-xs text-blue-800">Chain ID: {network.chainId}</p>
            </div>
          </div>
          <a
            href={network.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
          >
            View explorer
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
};