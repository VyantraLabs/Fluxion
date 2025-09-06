'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  DollarSign,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  ArrowUpRight,
  Calendar,
  User,
} from 'lucide-react';
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/format';
import { Invoice, InvoiceStatus } from '@/types/invoice';

export interface ActivityItem {
  id: string;
  type: 'invoice_created' | 'invoice_sent' | 'invoice_paid' | 'invoice_viewed' | 'payment_received' | 'invoice_overdue';
  title: string;
  description: string;
  timestamp: Date;
  metadata: {
    invoiceId?: string;
    amount?: number;
    clientName?: string;
    status?: InvoiceStatus;
    paymentHash?: string;
    ipAddress?: string;
  };
}

interface RecentActivityProps {
  activities: ActivityItem[];
  isLoading: boolean;
  showViewAll?: boolean;
  limit?: number;
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'invoice_created':
      return <FileText className="w-4 h-4" />;
    case 'invoice_sent':
      return <Send className="w-4 h-4" />;
    case 'invoice_paid':
      return <CheckCircle className="w-4 h-4" />;
    case 'invoice_viewed':
      return <Eye className="w-4 h-4" />;
    case 'payment_received':
      return <DollarSign className="w-4 h-4" />;
    case 'invoice_overdue':
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

const getActivityColor = (type: ActivityItem['type']) => {
  switch (type) {
    case 'invoice_created':
      return 'bg-blue-100 text-blue-600';
    case 'invoice_sent':
      return 'bg-purple-100 text-purple-600';
    case 'invoice_paid':
    case 'payment_received':
      return 'bg-success-100 text-success-600';
    case 'invoice_viewed':
      return 'bg-indigo-100 text-indigo-600';
    case 'invoice_overdue':
      return 'bg-danger-100 text-danger-600';
    default:
      return 'bg-secondary-100 text-secondary-600';
  }
};

const ActivityItemComponent: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
  const iconColorClass = getActivityColor(activity.type);
  const isClickable = activity.metadata.invoiceId;

  const content = (
    <div className={`flex items-start space-x-3 p-4 rounded-lg transition-colors duration-200 ${
      isClickable ? 'hover:bg-secondary-50 cursor-pointer' : ''
    }`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconColorClass}`}>
        {getActivityIcon(activity.type)}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-secondary-900 truncate">
            {activity.title}
          </p>
          <p className="text-xs text-secondary-500 flex-shrink-0 ml-2">
            {formatRelativeTime(activity.timestamp)}
          </p>
        </div>
        
        <p className="text-sm text-secondary-600 mt-1">
          {activity.description}
        </p>
        
        {/* Additional metadata */}
        <div className="flex items-center space-x-4 mt-2 text-xs text-secondary-500">
          {activity.metadata.clientName && (
            <div className="flex items-center">
              <User className="w-3 h-3 mr-1" />
              {activity.metadata.clientName}
            </div>
          )}
          
          {activity.metadata.amount && (
            <div className="flex items-center">
              <DollarSign className="w-3 h-3 mr-1" />
              {formatCurrency(activity.metadata.amount)}
            </div>
          )}
          
          <div className="flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            {formatDate(activity.timestamp)}
          </div>
        </div>
      </div>
      
      {isClickable && (
        <div className="flex-shrink-0">
          <ArrowUpRight className="w-4 h-4 text-secondary-400" />
        </div>
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/dashboard/invoices/${activity.metadata.invoiceId}`}>
        {content}
      </Link>
    );
  }

  return content;
};

const LoadingActivity: React.FC = () => (
  <div className="flex items-start space-x-3 p-4">
    <div className="w-8 h-8 bg-secondary-200 rounded-full animate-pulse"></div>
    <div className="flex-1">
      <div className="h-4 bg-secondary-200 rounded animate-pulse mb-2"></div>
      <div className="h-3 bg-secondary-200 rounded animate-pulse w-3/4"></div>
    </div>
  </div>
);

export const RecentActivity: React.FC<RecentActivityProps> = ({ 
  activities, 
  isLoading, 
  showViewAll = true, 
  limit = 10 
}) => {
  const displayedActivities = activities.slice(0, limit);

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-secondary-900">Recent Activity</h3>
          {showViewAll && activities.length > 0 && (
            <Link
              href="/dashboard/activity"
              className="text-sm text-primary-600 hover:text-primary-500 flex items-center"
            >
              View all
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <LoadingActivity />
          <LoadingActivity />
          <LoadingActivity />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">No recent activity</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Activity from your invoices and payments will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {displayedActivities.map((activity, index) => (
            <div key={activity.id}>
              <ActivityItemComponent activity={activity} />
              {index < displayedActivities.length - 1 && (
                <div className="h-px bg-secondary-200 mx-4" />
              )}
            </div>
          ))}
          
          {activities.length > limit && (
            <div className="pt-4 border-t border-secondary-200">
              <Link
                href="/dashboard/activity"
                className="w-full btn-secondary flex items-center justify-center"
              >
                View {activities.length - limit} more activities
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to generate activity from invoices (can be used in parent components)
export const generateActivitiesFromInvoices = (invoices: Invoice[]): ActivityItem[] => {
  const activities: ActivityItem[] = [];

  invoices.forEach(invoice => {
    // Invoice creation activity
    activities.push({
      id: `created-${invoice.id}`,
      type: 'invoice_created',
      title: 'Invoice created',
      description: `Created invoice ${invoice.invoiceNumber} for ${invoice.clientName || 'Unknown client'}`,
      timestamp: invoice.createdAt,
      metadata: {
        invoiceId: invoice.id,
        amount: parseFloat(invoice.amount),
        clientName: invoice.clientName || undefined,
        status: invoice.status,
      },
    });

    // Invoice sent activity
    if (invoice.sentAt) {
      activities.push({
        id: `sent-${invoice.id}`,
        type: 'invoice_sent',
        title: 'Invoice sent',
        description: `Sent invoice ${invoice.invoiceNumber} to ${invoice.clientEmail || invoice.clientName}`,
        timestamp: invoice.sentAt,
        metadata: {
          invoiceId: invoice.id,
          amount: parseFloat(invoice.amount),
          clientName: invoice.clientName || undefined,
          status: invoice.status,
        },
      });
    }

    // Invoice paid activity
    if (invoice.paidAt && invoice.status === 'paid') {
      activities.push({
        id: `paid-${invoice.id}`,
        type: 'invoice_paid',
        title: 'Invoice paid',
        description: `Received payment for invoice ${invoice.invoiceNumber}`,
        timestamp: invoice.paidAt,
        metadata: {
          invoiceId: invoice.id,
          amount: parseFloat(invoice.amount),
          clientName: invoice.clientName || undefined,
          status: invoice.status,
        },
      });
    }

    // Overdue activity
    if (invoice.status === 'overdue') {
      const overdueDate = invoice.dueDate || new Date();
      activities.push({
        id: `overdue-${invoice.id}`,
        type: 'invoice_overdue',
        title: 'Invoice overdue',
        description: `Invoice ${invoice.invoiceNumber} is past due`,
        timestamp: overdueDate,
        metadata: {
          invoiceId: invoice.id,
          amount: parseFloat(invoice.amount),
          clientName: invoice.clientName || undefined,
          status: invoice.status,
        },
      });
    }

    // Payment activities from payments array
    if (invoice.payments) {
      invoice.payments.forEach(payment => {
        activities.push({
          id: `payment-${payment.id}`,
          type: 'payment_received',
          title: 'Payment received',
          description: `Received ${formatCurrency(parseFloat(payment.amount))} payment`,
          timestamp: payment.createdAt,
          metadata: {
            invoiceId: invoice.id,
            amount: parseFloat(payment.amount),
            clientName: invoice.clientName || undefined,
            paymentHash: payment.transactionHash,
          },
        });
      });
    }
  });

  // Sort by timestamp (newest first)
  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};