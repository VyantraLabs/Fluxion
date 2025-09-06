'use client';

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Copy,
  CheckCircle,
  Download,
  Share,
  Smartphone,
  Wallet,
  ExternalLink,
} from 'lucide-react';

interface QRCodeDisplayProps {
  paymentAddress: string;
  amount: string;
  tokenSymbol: string;
  networkName: string;
  qrCodeData?: string; // Base64 or URL to QR code image
  explorerUrl?: string;
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  paymentAddress,
  amount,
  tokenSymbol,
  networkName,
  qrCodeData,
  explorerUrl,
  className = '',
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  // Generate QR code if not provided
  useEffect(() => {
    if (qrCodeData) {
      setQrUrl(qrCodeData);
    } else {
      // Generate QR code using a service (placeholder for now)
      // In production, this would generate actual QR codes
      const qrString = `ethereum:${paymentAddress}?value=${amount}&gas=21000`;
      setQrUrl(`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="12" fill="%236b7280">QR Code Placeholder</text></svg>`);
    }
  }, [qrCodeData, paymentAddress, amount]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadQR = () => {
    if (!qrUrl) return;
    
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `invoice-qr-${paymentAddress.slice(-8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment QR Code',
          text: `Payment address: ${paymentAddress}`,
          url: window.location.href,
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      // Fallback: copy link
      copyToClipboard(window.location.href, 'link');
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-secondary-200 p-6 text-center ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <QrCode className="w-6 h-6 text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-1">
          Scan to Pay
        </h3>
        <p className="text-sm text-secondary-600">
          Use your mobile wallet to scan this QR code
        </p>
      </div>

      {/* QR Code */}
      <div className="mb-6">
        <div className="relative inline-block p-4 bg-white border-2 border-secondary-200 rounded-xl">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="Payment QR Code"
              className="w-48 h-48 mx-auto"
              onError={() => setQrUrl(null)}
            />
          ) : (
            <div className="w-48 h-48 bg-secondary-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode className="w-12 h-12 text-secondary-400 mx-auto mb-2" />
                <p className="text-sm text-secondary-500">Loading QR Code...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Details */}
      <div className="space-y-3 mb-6">
        <div className="bg-secondary-50 rounded-lg p-4">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary-600">Amount:</span>
              <span className="font-semibold text-secondary-900">{amount} {tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600">Network:</span>
              <span className="text-secondary-900">{networkName}</span>
            </div>
          </div>
        </div>
        
        {/* Wallet Address */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-left">
              <p className="text-xs font-medium text-blue-800 mb-1">Payment Address</p>
              <p className="text-sm text-blue-900 font-mono break-all">
                {paymentAddress}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(paymentAddress, 'address')}
              className="ml-3 p-2 hover:bg-blue-100 rounded-lg transition-colors"
              title="Copy address"
            >
              {copied === 'address' ? (
                <CheckCircle className="w-4 h-4 text-success-600" />
              ) : (
                <Copy className="w-4 h-4 text-blue-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={downloadQR}
          disabled={!qrUrl}
          className="flex items-center justify-center px-4 py-2 border border-secondary-300 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </button>
        
        <button
          onClick={shareQR}
          className="flex items-center justify-center px-4 py-2 border border-secondary-300 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50 transition-colors"
        >
          <Share className="w-4 h-4 mr-2" />
          Share
        </button>
      </div>

      {/* Explorer Link */}
      {explorerUrl && (
        <div className="mt-4 pt-4 border-t border-secondary-200">
          <a
            href={`${explorerUrl}/address/${paymentAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
          >
            View on blockchain explorer
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      )}

      {/* Mobile Instructions */}
      <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
        <div className="flex items-center justify-center mb-2">
          <Smartphone className="w-5 h-5 text-purple-600 mr-2" />
          <span className="text-sm font-medium text-purple-900">Mobile Payment</span>
        </div>
        <p className="text-xs text-purple-800 leading-relaxed">
          Open your mobile crypto wallet and scan this QR code to automatically fill in the payment details. 
          Make sure you're connected to the correct network before sending.
        </p>
      </div>
    </div>
  );
};