'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Smartphone,
  Globe,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { WalletConnectPayment } from './WalletConnectPayment';
import { Invoice, Token, BlockchainNetwork } from '@/types/invoice';
import { formatCurrency } from '@/utils/format';

interface PaymentMethodsProps {
  invoice: Invoice;
  token: Token;
  network: BlockchainNetwork;
  paymentAddress: string;
  qrCodeData?: string;
  onPaymentSubmit: (txHash: string, payerAddress: string) => void;
  isSubmittingPayment?: boolean;
}

type PaymentMethod = 'qr' | 'wallet' | 'manual';

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  invoice,
  token,
  network,
  paymentAddress,
  qrCodeData,
  onPaymentSubmit,
  isSubmittingPayment = false,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('qr');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const amount = parseFloat(invoice.amount);
  const isStablecoin = token.isStablecoin;
  const isNativeToken = token.isNative;

  const paymentMethods = [
    {
      id: 'qr' as PaymentMethod,
      title: 'QR Code',
      subtitle: 'Scan with mobile wallet',
      icon: <Smartphone className="w-5 h-5" />,
      recommended: true,
      description: 'The easiest way to pay using your mobile crypto wallet',
    },
    {
      id: 'wallet' as PaymentMethod,
      title: 'Browser Wallet',
      subtitle: 'Connect MetaMask or similar',
      icon: <Wallet className="w-5 h-5" />,
      recommended: false,
      description: 'Connect your browser extension wallet directly',
    },
    {
      id: 'manual' as PaymentMethod,
      title: 'Manual Transfer',
      subtitle: 'Send from any wallet',
      icon: <Globe className="w-5 h-5" />,
      recommended: false,
      description: 'Copy the address and send manually from your wallet',
    },
  ];

  const renderPaymentMethodContent = () => {
    switch (selectedMethod) {
      case 'qr':
        return (
          <QRCodeDisplay
            paymentAddress={paymentAddress}
            amount={invoice.amount}
            tokenSymbol={token.symbol}
            networkName={network.name}
            qrCodeData={qrCodeData}
            explorerUrl={network.explorerUrl}
          />
        );
      
      case 'wallet':
        return (
          <WalletConnectPayment
            invoice={invoice}
            token={token}
            network={network}
            paymentAddress={paymentAddress}
            onPaymentSubmit={onPaymentSubmit}
            isSubmitting={isSubmittingPayment}
          />
        );
      
      case 'manual':
        return (
          <div className="bg-white rounded-lg border border-secondary-200 p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">
                Manual Payment
              </h3>
              <p className="text-sm text-secondary-600">
                Send payment from any wallet to the address below
              </p>
            </div>

            <div className="space-y-4">
              {/* Payment Details */}
              <div className="bg-secondary-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-secondary-900 mb-3">Payment Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Amount:</span>
                    <span className="font-semibold text-secondary-900">
                      {invoice.amount} {token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Network:</span>
                    <span className="text-secondary-900">{network.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Token:</span>
                    <span className="text-secondary-900">
                      {token.name} ({token.symbol})
                      {isStablecoin && <Star className="w-3 h-3 inline ml-1 text-warning-500" />}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Address */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Send to Address</h4>
                <div className="bg-white rounded border p-3">
                  <p className="text-sm font-mono text-secondary-900 break-all">
                    {paymentAddress}
                  </p>
                </div>
                <p className="text-xs text-blue-800 mt-2">
                  ⚠️ Only send {token.symbol} on the {network.name} network to this address
                </p>
              </div>

              {/* Important Notes */}
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-warning-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-warning-900 mb-1">Important</h4>
                    <ul className="text-sm text-warning-800 space-y-1">
                      <li>• Send exactly {invoice.amount} {token.symbol}</li>
                      <li>• Use {network.name} network only</li>
                      <li>• Payment may take 5-15 minutes to confirm</li>
                      <li>• Double-check the address before sending</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      <div>
        <h2 className="text-xl font-semibold text-secondary-900 mb-4">
          Choose Payment Method
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`relative p-4 border-2 rounded-lg text-left transition-all hover:border-primary-300 ${
                selectedMethod === method.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-secondary-200 hover:bg-secondary-50'
              }`}
            >
              {method.recommended && (
                <div className="absolute -top-2 left-4">
                  <span className="bg-success-500 text-white text-xs font-medium px-2 py-1 rounded">
                    Recommended
                  </span>
                </div>
              )}
              
              <div className="flex items-center mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                  selectedMethod === method.id ? 'bg-primary-100' : 'bg-secondary-100'
                }`}>
                  <div className={selectedMethod === method.id ? 'text-primary-600' : 'text-secondary-600'}>
                    {method.icon}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-secondary-900">{method.title}</h3>
                  <p className="text-sm text-secondary-600">{method.subtitle}</p>
                </div>
              </div>
              
              <p className="text-sm text-secondary-600 leading-relaxed">
                {method.description}
              </p>

              {selectedMethod === method.id && (
                <div className="absolute right-3 top-3">
                  <CheckCircle className="w-5 h-5 text-primary-600" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Content */}
      <div className="min-h-[400px]">
        {renderPaymentMethodContent()}
      </div>

      {/* Payment Information */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-start">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Payment Information</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <p>• Payment amount: <strong>{formatCurrency(amount)} ({invoice.amount} {token.symbol})</strong></p>
              <p>• Network: <strong>{network.name}</strong></p>
              <p>• Estimated confirmation time: <strong>5-15 minutes</strong></p>
              {isStablecoin && <p>• You're paying with a stablecoin for price stability 🌟</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="border-t border-secondary-200 pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-secondary-600 hover:text-secondary-900 flex items-center"
        >
          <span>Advanced options</span>
          <ArrowRight className={`w-4 h-4 ml-1 transform transition-transform ${
            showAdvanced ? 'rotate-90' : ''
          }`} />
        </button>
        
        {showAdvanced && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-secondary-600">
              <p><strong>Contract Address:</strong> {token.contractAddress}</p>
              <p><strong>Chain ID:</strong> {network.chainId}</p>
              <p><strong>Token Decimals:</strong> {token.decimals}</p>
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <a
                href={`${network.explorerUrl}/address/${paymentAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 flex items-center"
              >
                View address on explorer
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
              
              <a
                href={`${network.explorerUrl}/token/${token.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 flex items-center"
              >
                View token contract
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};