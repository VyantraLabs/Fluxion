'use client';

import React from 'react';
import {
  FileText,
  User,
  Calendar,
  DollarSign,
  Globe,
  Mail,
  Wallet,
  Clock,
  Star,
} from 'lucide-react';
import { InvoiceFormData } from '@/types/invoice';
import { formatCurrency, formatDate } from '@/utils/format';

interface InvoicePreviewProps {
  formData: InvoiceFormData;
  showActions?: boolean;
  className?: string;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  formData,
  showActions = true,
  className = '',
}) => {
  const amount = parseFloat(formData.amount) || 0;
  const dueDate = formData.dueDate ? new Date(formData.dueDate) : null;
  const today = new Date();

  return (
    <div className={`bg-white rounded-lg border border-secondary-200 shadow-sm ${className}`}>
      {/* Preview Header */}
      <div className="p-6 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-secondary-900">Invoice Preview</h3>
              <p className="text-sm text-secondary-500">How this invoice will appear to your client</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-secondary-500">Amount</p>
            <p className="text-2xl font-bold text-primary-600">
              {formatCurrency(amount)}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="p-6 space-y-6">
        {/* Invoice Title */}
        <div>
          <h2 className="text-xl font-bold text-secondary-900 mb-2">
            {formData.title || 'Untitled Invoice'}
          </h2>
          {formData.description && (
            <p className="text-secondary-600 leading-relaxed">
              {formData.description}
            </p>
          )}
        </div>

        {/* Invoice Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-secondary-900 uppercase tracking-wide">
              Bill To
            </h4>
            
            <div className="space-y-3">
              {formData.clientName && (
                <div className="flex items-center">
                  <User className="w-4 h-4 text-secondary-400 mr-3" />
                  <span className="text-secondary-900">{formData.clientName}</span>
                </div>
              )}
              
              {formData.clientEmail && (
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-secondary-400 mr-3" />
                  <span className="text-secondary-600">{formData.clientEmail}</span>
                </div>
              )}
              
              {!formData.clientName && !formData.clientEmail && (
                <div className="flex items-center text-secondary-400">
                  <User className="w-4 h-4 mr-3" />
                  <span className="italic">Client information not provided</span>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Metadata */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-secondary-900 uppercase tracking-wide">
              Invoice Details
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 text-secondary-400 mr-3" />
                <div>
                  <span className="text-sm text-secondary-500 mr-2">Created:</span>
                  <span className="text-secondary-900">{formatDate(today)}</span>
                </div>
              </div>
              
              {dueDate && (
                <div className="flex items-center">
                  <Clock className="w-4 h-4 text-secondary-400 mr-3" />
                  <div>
                    <span className="text-sm text-secondary-500 mr-2">Due:</span>
                    <span className={`font-medium ${
                      dueDate < today ? 'text-danger-600' : 'text-secondary-900'
                    }`}>
                      {formatDate(dueDate)}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 text-secondary-400 mr-3" />
                <div>
                  <span className="text-sm text-secondary-500 mr-2">Amount:</span>
                  <span className="text-secondary-900 font-semibold">
                    {formatCurrency(amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        {(formData.networkId || formData.tokenId) && (
          <div className="border-t border-secondary-200 pt-6">
            <h4 className="text-sm font-semibold text-secondary-900 uppercase tracking-wide mb-4">
              Payment Information
            </h4>
            
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Globe className="w-5 h-5 text-primary-600 mr-2" />
                <span className="font-medium text-primary-900">Crypto Payment Required</span>
              </div>
              
              <div className="space-y-2 text-sm">
                {formData.networkId && (
                  <div className="flex items-center text-primary-800">
                    <span className="font-medium mr-2">Network:</span>
                    <span>Selected blockchain network</span>
                  </div>
                )}
                
                {formData.tokenId && (
                  <div className="flex items-center text-primary-800">
                    <span className="font-medium mr-2">Token:</span>
                    <span>Selected payment token</span>
                    <Star className="w-3 h-3 ml-1 text-warning-500" />
                  </div>
                )}
                
                <p className="text-primary-700 mt-3">
                  Payment instructions and wallet address will be provided when the invoice is sent.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-between pt-6 border-t border-secondary-200">
          <div className="flex items-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-warning-100 text-warning-800">
              <Clock className="w-3 h-3 mr-1" />
              Draft
            </span>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-secondary-500 mb-1">Total Amount</p>
            <p className="text-lg font-bold text-secondary-900">
              {formatCurrency(amount)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="p-6 bg-secondary-50 border-t border-secondary-200 rounded-b-lg">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center text-sm text-secondary-600">
              <FileText className="w-4 h-4 mr-2" />
              <span>This preview shows how your invoice will appear to clients</span>
            </div>
          </div>
        </div>
      )}

      {/* Validation Messages */}
      <div className="px-6 pb-6">
        <div className="space-y-2">
          {!formData.title && (
            <div className="flex items-center text-sm text-warning-600">
              <Clock className="w-4 h-4 mr-2" />
              <span>Invoice title is required</span>
            </div>
          )}
          
          {!formData.clientName && (
            <div className="flex items-center text-sm text-warning-600">
              <User className="w-4 h-4 mr-2" />
              <span>Client name is required</span>
            </div>
          )}
          
          {!formData.amount && (
            <div className="flex items-center text-sm text-warning-600">
              <DollarSign className="w-4 h-4 mr-2" />
              <span>Invoice amount is required</span>
            </div>
          )}
          
          {(!formData.networkId || !formData.tokenId) && (
            <div className="flex items-center text-sm text-warning-600">
              <Wallet className="w-4 h-4 mr-2" />
              <span>Payment method selection is required</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};