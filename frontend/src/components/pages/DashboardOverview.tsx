'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  CreditCard,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useWalletAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/utils/format';
import { invoiceApi, InvoiceStatsResponse } from '@/utils/api/invoices';
import { Invoice } from '@/types/invoice';
import { OnboardingOverlay } from '@/components/common/OnboardingOverlay';

export const DashboardOverview: React.FC = () => {
  const { user, isAuthenticated, isOnboarding } = useWalletAuth();
  const [stats, setStats] = useState<InvoiceStatsResponse | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load dashboard data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const loadDashboardData = async () => {
    try {
      setError(null);
      
      // Load stats and recent invoices in parallel
      setIsLoadingStats(true);
      setIsLoadingInvoices(true);
      
      const [statsData, invoicesData] = await Promise.allSettled([
        invoiceApi.getDashboardStats(),
        invoiceApi.getUserInvoices({ limit: 3 })
      ]);

      // Handle stats
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      } else {
        console.error('Failed to load stats:', statsData.reason);
      }

      // Handle recent invoices
      if (invoicesData.status === 'fulfilled') {
        setRecentInvoices(invoicesData.value.invoices);
      } else {
        console.error('Failed to load recent invoices:', invoicesData.reason);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoadingStats(false);
      setIsLoadingInvoices(false);
    }
  };

  // Calculate derived stats
  const derivedStats = stats ? {
    totalInvoices: stats.total,
    totalAmount: parseFloat(stats.totalAmount),
    paidAmount: parseFloat(stats.totalPaidAmount),
    pendingAmount: parseFloat(stats.totalAmount) - parseFloat(stats.totalPaidAmount),
    conversionRate: stats.total > 0 ? ((stats.byStatus.paid || 0) / stats.total * 100) : 0,
  } : null;

  return (
    <>
      {/* Onboarding Overlay */}
      <OnboardingOverlay 
        isVisible={isOnboarding}
        currentStep="welcome"
        userName={user?.display_name}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-secondary-900 sm:truncate sm:text-3xl">
            Welcome back{user?.display_name ? ', ' + user.display_name : ''}!
          </h2>
          <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
            <div className="mt-2 flex items-center text-sm text-secondary-500">
              <p>Here's what's happening with your invoices today.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            href="/dashboard/invoices/create"
            className="btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mt-8 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
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
                  onClick={loadDashboardData}
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Invoices */}
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-secondary-500">Total Invoices</p>
              <p className="text-2xl font-semibold text-secondary-900">
                {isLoadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  derivedStats?.totalInvoices || 0
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Total Amount */}
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-success-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-secondary-500">Total Amount</p>
              <p className="text-2xl font-semibold text-secondary-900">
                {isLoadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatCurrency(derivedStats?.totalAmount || 0)
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Paid Amount */}
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-secondary-500">Paid</p>
              <p className="text-2xl font-semibold text-secondary-900">
                {isLoadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatCurrency(derivedStats?.paidAmount || 0)
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Pending Amount */}
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-secondary-500">Pending</p>
              <p className="text-2xl font-semibold text-secondary-900">
                {isLoadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatCurrency(derivedStats?.pendingAmount || 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Invoices */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-secondary-900">Recent Invoices</h3>
                <Link
                  href="/dashboard/invoices"
                  className="text-sm text-primary-600 hover:text-primary-500 flex items-center"
                >
                  View all
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
            
            {isLoadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                <span className="ml-2 text-secondary-600">Loading recent invoices...</span>
              </div>
            ) : (
              <div className="flow-root">
                <ul role="list" className="-my-5 divide-y divide-secondary-200">
                  {recentInvoices.map((invoice) => (
                    <li key={invoice.id} className="py-4">
                      <Link href={`/invoice/view/${invoice.id}`} className="block hover:bg-secondary-50 rounded-lg p-2 -m-2 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              invoice.status === 'paid' ? 'bg-success-100' : 
                              invoice.status === 'overdue' ? 'bg-red-100' : 'bg-warning-100'
                            }`}>
                              {invoice.status === 'paid' ? (
                                <CheckCircle className="w-4 h-4 text-success-600" />
                              ) : invoice.status === 'overdue' ? (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              ) : (
                                <Clock className="w-4 h-4 text-warning-600" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-secondary-900 truncate">
                              {invoice.client_name}
                            </p>
                            <p className="text-sm text-secondary-500">
                              Due {formatDate(invoice.due_date)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-secondary-900">
                              {formatCurrency(parseFloat(invoice.amount))}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              invoice.status === 'paid' ? 'status-paid' : 
                              invoice.status === 'overdue' ? 'status-error' : 'status-pending'
                            }`}>
                              {invoice.status === 'paid' ? 'Paid' : 
                               invoice.status === 'overdue' ? 'Overdue' : 
                               invoice.status === 'pending' ? 'Pending' : 
                               invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {!isLoadingInvoices && recentInvoices.length === 0 && (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-secondary-400" />
                <h3 className="mt-2 text-sm font-medium text-secondary-900">No invoices</h3>
                <p className="mt-1 text-sm text-secondary-500">Get started by creating your first invoice.</p>
                <div className="mt-6">
                  <Link
                    href="/dashboard/invoices/create"
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Invoice
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Stats */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Quick Actions</h3>
            </div>
            
            <div className="space-y-3">
              <Link
                href="/dashboard/invoices/create"
                className="w-full btn-primary flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Link>
              
              <Link
                href="/dashboard/invoices"
                className="w-full btn-secondary flex items-center justify-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                View All Invoices
              </Link>
              
              <Link
                href="/dashboard/payments"
                className="w-full btn-secondary flex items-center justify-center"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Payment History
              </Link>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Payment Success</h3>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-success-600 mb-2">
                {isLoadingStats ? (
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                ) : (
                  `${derivedStats?.conversionRate.toFixed(1) || '0.0'}%`
                )}
              </div>
              <p className="text-sm text-secondary-500">
                Of your invoices get paid on time
              </p>
              <div className="mt-4">
                <div className="bg-secondary-200 rounded-full h-2">
                  <div 
                    className="bg-success-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${derivedStats?.conversionRate || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Pro Tip</h3>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-700">
                  Invoices with detailed line items get paid 23% faster on average.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};