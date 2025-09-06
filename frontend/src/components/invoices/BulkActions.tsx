'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  Send,
  Trash2,
  Download,
  Copy,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  Archive,
} from 'lucide-react';
import { Invoice } from '@/types/invoice';
import { invoiceApi, handleApiResponse } from '@/utils/api';

interface BulkActionsProps {
  selectedInvoices: Invoice[];
  onSelectionClear: () => void;
  onActionComplete: (action: string, count: number) => void;
  onError: (error: string) => void;
}

interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  variant: 'primary' | 'secondary' | 'danger';
  requiresConfirmation: boolean;
  allowedStatuses?: string[];
}

const BULK_ACTIONS: BulkAction[] = [
  {
    id: 'send',
    label: 'Send Invoices',
    icon: <Send className="w-4 h-4" />,
    description: 'Send email notifications to clients',
    variant: 'primary',
    requiresConfirmation: false,
    allowedStatuses: ['draft'],
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: <Copy className="w-4 h-4" />,
    description: 'Create copies of selected invoices',
    variant: 'secondary',
    requiresConfirmation: false,
  },
  {
    id: 'export',
    label: 'Export',
    icon: <Download className="w-4 h-4" />,
    description: 'Download invoice data as CSV',
    variant: 'secondary',
    requiresConfirmation: false,
  },
  {
    id: 'cancel',
    label: 'Cancel',
    icon: <X className="w-4 h-4" />,
    description: 'Cancel selected invoices',
    variant: 'danger',
    requiresConfirmation: true,
    allowedStatuses: ['draft', 'sent'],
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="w-4 h-4" />,
    description: 'Permanently delete selected invoices',
    variant: 'danger',
    requiresConfirmation: true,
    allowedStatuses: ['draft', 'cancelled'],
  },
];

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedInvoices,
  onSelectionClear,
  onActionComplete,
  onError,
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);

  const selectedCount = selectedInvoices.length;
  const selectedIds = selectedInvoices.map(inv => inv.id);

  // Filter actions based on invoice statuses
  const getAvailableActions = (): BulkAction[] => {
    return BULK_ACTIONS.filter(action => {
      if (!action.allowedStatuses) return true;
      
      // Check if at least one selected invoice has an allowed status
      return selectedInvoices.some(invoice => 
        action.allowedStatuses!.includes(invoice.status)
      );
    });
  };

  const handleAction = async (actionId: string) => {
    const action = BULK_ACTIONS.find(a => a.id === actionId);
    if (!action) return;

    if (action.requiresConfirmation) {
      setShowConfirmation(actionId);
      return;
    }

    await executeAction(actionId);
  };

  const executeAction = async (actionId: string) => {
    try {
      setIsProcessing(true);
      setActiveAction(actionId);
      setShowConfirmation(null);

      let successCount = 0;

      switch (actionId) {
        case 'send':
          await invoiceApi.bulkSend(selectedIds);
          successCount = selectedIds.length;
          break;

        case 'cancel':
          await invoiceApi.bulkCancel(selectedIds);
          successCount = selectedIds.length;
          break;

        case 'delete':
          // Delete one by one to handle individual failures
          for (const id of selectedIds) {
            try {
              await invoiceApi.delete(id);
              successCount++;
            } catch (error) {
              console.error(`Failed to delete invoice ${id}:`, error);
            }
          }
          break;

        case 'duplicate':
          // Duplicate one by one
          for (const invoice of selectedInvoices) {
            try {
              await invoiceApi.duplicate(invoice.id);
              successCount++;
            } catch (error) {
              console.error(`Failed to duplicate invoice ${invoice.id}:`, error);
            }
          }
          break;

        case 'export':
          // Handle export (simplified - in production would generate actual CSV)
          const csvData = generateCSV(selectedInvoices);
          downloadCSV(csvData, `invoices-${new Date().toISOString().split('T')[0]}.csv`);
          successCount = selectedIds.length;
          break;

        default:
          throw new Error(`Unknown action: ${actionId}`);
      }

      if (successCount > 0) {
        onActionComplete(actionId, successCount);
        onSelectionClear();
      } else {
        onError(`Failed to execute ${actionId} on any invoices`);
      }
    } catch (error: any) {
      console.error('Bulk action failed:', error);
      onError(error.message || `Failed to execute ${actionId}`);
    } finally {
      setIsProcessing(false);
      setActiveAction(null);
    }
  };

  const generateCSV = (invoices: Invoice[]): string => {
    const headers = [
      'Invoice Number',
      'Title',
      'Client Name',
      'Amount',
      'Status',
      'Created Date',
      'Due Date',
      'Paid Date',
    ];

    const rows = invoices.map(invoice => [
      invoice.invoiceNumber,
      invoice.title,
      invoice.clientName || '',
      invoice.amount,
      invoice.status,
      invoice.createdAt.toISOString().split('T')[0],
      invoice.dueDate?.toISOString().split('T')[0] || '',
      invoice.paidAt?.toISOString().split('T')[0] || '',
    ]);

    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const availableActions = getAvailableActions();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-primary-600 mr-2" />
              <span className="font-medium text-primary-900">
                {selectedCount} invoice{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Action Buttons */}
            {availableActions.map((action) => {
              const isActive = activeAction === action.id;
              const buttonClassName = `inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                action.variant === 'primary'
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : action.variant === 'danger'
                  ? 'bg-danger-600 text-white hover:bg-danger-700'
                  : 'bg-white border border-secondary-300 text-secondary-700 hover:bg-secondary-50'
              }`;

              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  disabled={isProcessing}
                  className={buttonClassName}
                  title={action.description}
                >
                  {isActive && isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <span className="mr-2">{action.icon}</span>
                  )}
                  {action.label}
                </button>
              );
            })}

            {/* Clear Selection */}
            <button
              onClick={onSelectionClear}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-secondary-600 hover:text-secondary-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Invoice Summary */}
        <div className="mt-3 pt-3 border-t border-primary-200">
          <div className="flex items-center justify-between text-sm">
            <div className="space-x-4">
              <span className="text-primary-700">
                Status breakdown:
              </span>
              {Object.entries(
                selectedInvoices.reduce((acc, inv) => {
                  acc[inv.status] = (acc[inv.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count]) => (
                <span key={status} className="text-primary-600">
                  {count} {status}
                </span>
              ))}
            </div>
            <div className="text-primary-700">
              Total amount: ${selectedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-warning-100 rounded-full flex items-center justify-center mr-3">
                <AlertTriangle className="w-5 h-5 text-warning-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-secondary-900">
                  Confirm Action
                </h3>
                <p className="text-sm text-secondary-600">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-secondary-700">
                Are you sure you want to{' '}
                <strong>
                  {BULK_ACTIONS.find(a => a.id === showConfirmation)?.label.toLowerCase()}
                </strong>{' '}
                <strong>{selectedCount}</strong> selected invoice{selectedCount !== 1 ? 's' : ''}?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmation(null)}
                className="btn-secondary"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction(showConfirmation)}
                disabled={isProcessing}
                className="btn-danger"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  BULK_ACTIONS.find(a => a.id === showConfirmation)?.icon
                )}
                {isProcessing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};