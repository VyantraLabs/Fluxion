'use client';

import React from 'react';
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { InvoiceAnalytics } from '@/types/invoice';

interface DashboardStatsProps {
  analytics: InvoiceAnalytics | null;
  isLoading: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  color: 'primary' | 'success' | 'warning' | 'danger';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, change, color }) => {
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    danger: 'bg-danger-100 text-danger-600',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-secondary-500">{title}</p>
            <p className="text-2xl font-semibold text-secondary-900">
              {typeof value === 'number' && title.toLowerCase().includes('amount') 
                ? formatCurrency(value) 
                : value}
            </p>
          </div>
        </div>
        {change && (
          <div className="flex items-center text-sm">
            {change.type === 'increase' ? (
              <TrendingUp className="w-4 h-4 text-success-600 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-danger-600 mr-1" />
            )}
            <span className={change.type === 'increase' ? 'text-success-600' : 'text-danger-600'}>
              {Math.abs(change.value)}%
            </span>
            <span className="text-secondary-500 ml-1">{change.period}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingStat: React.FC = () => (
  <div className="card">
    <div className="flex items-center">
      <div className="w-8 h-8 bg-secondary-200 rounded-lg animate-pulse"></div>
      <div className="ml-3 flex-1">
        <div className="h-4 bg-secondary-200 rounded animate-pulse mb-2"></div>
        <div className="h-6 bg-secondary-200 rounded animate-pulse w-16"></div>
      </div>
    </div>
  </div>
);

export const DashboardStats: React.FC<DashboardStatsProps> = ({ analytics, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <LoadingStat />
        <LoadingStat />
        <LoadingStat />
        <LoadingStat />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <AlertCircle className="w-8 h-8 text-secondary-400 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-secondary-900">Unable to load statistics</h3>
            <p className="text-sm text-secondary-500">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  const conversionRate = analytics.total_count > 0 
    ? (analytics.paid_count / analytics.total_count) * 100 
    : 0;

  const stats = [
    {
      title: 'Total Invoices',
      value: analytics.total_count,
      icon: <FileText className="w-5 h-5" />,
      color: 'primary' as const,
    },
    {
      title: 'Total Amount',
      value: analytics.total_amount,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'success' as const,
    },
    {
      title: 'Paid',
      value: analytics.paid_amount,
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'success' as const,
    },
    {
      title: 'Pending',
      value: analytics.pending_amount,
      icon: <Clock className="w-5 h-5" />,
      color: 'warning' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Payment Success Rate */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-secondary-900">Payment Success Rate</h3>
            <div className="text-3xl font-bold text-success-600">
              {conversionRate.toFixed(1)}%
            </div>
          </div>
          <div className="bg-secondary-200 rounded-full h-2">
            <div 
              className="bg-success-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${conversionRate}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm text-secondary-500">
            <span>{analytics.paid_count} paid</span>
            <span>{analytics.total_count} total</span>
          </div>
        </div>

        {/* Average Invoice Amount */}
        <div className="card">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-secondary-500">Average Amount</p>
              <p className="text-2xl font-semibold text-secondary-900">
                {formatCurrency(analytics.average_amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Overdue Invoices */}
        {analytics.overdue_count > 0 && (
          <div className="card border-l-4 border-danger-500">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-danger-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-secondary-500">Overdue</p>
                <p className="text-2xl font-semibold text-danger-600">
                  {analytics.overdue_count}
                </p>
                <p className="text-sm text-secondary-500">
                  {formatCurrency(analytics.overdue_amount)} total
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key Insights */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Key Insights</h3>
        </div>
        
        <div className="space-y-4">
          {/* Conversion Rate Insight */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {conversionRate >= 75 ? (
                <TrendingUp className="w-5 h-5 text-success-600" />
              ) : conversionRate >= 50 ? (
                <Clock className="w-5 h-5 text-warning-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-danger-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-secondary-700">
                {conversionRate >= 75 
                  ? 'Excellent payment rate! Your invoices are getting paid efficiently.'
                  : conversionRate >= 50
                  ? 'Good payment rate. Consider sending reminders for pending invoices.'
                  : 'Low payment rate. Review your payment terms and follow up strategies.'
                }
              </p>
            </div>
          </div>

          {/* Overdue Warning */}
          {analytics.overdue_count > 0 && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-danger-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-700">
                  You have {analytics.overdue_count} overdue invoice{analytics.overdue_count !== 1 ? 's' : ''} worth {formatCurrency(analytics.overdue_amount)}. 
                  Consider sending payment reminders.
                </p>
              </div>
            </div>
          )}

          {/* Growth Opportunity */}
          {analytics.total_count < 5 && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-700">
                  You're just getting started! Create more invoices to grow your business and unlock insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};