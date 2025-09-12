'use client';

import React, { useState, useEffect, ErrorInfo } from 'react';
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  Calendar,
  ArrowLeft,
  Settings,
  Plus,
  Eye,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  CreditCard,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useOrganization, useUserPermissions } from '@/contexts/OrganizationContext';
import { Organization, ActivityLog } from '@/types/user';
import { cn } from '@/utils/helpers';
import { apiRequest, handleApiResponse, organizationApi } from '@/utils/api';

interface OrganizationStats {
  totalUsers: number;
  totalInvoices: number;
  totalRevenue: number;
  activeInvoices: number;
  draftInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  avgInvoiceValue: number;
  monthlyRevenue: number;
  recentActivity: ActivityLog[];
}

interface ChartDataPoint {
  name: string;
  value: number;
  color: string;
}

export default function OrganizationDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { organizations } = state;

  useEffect(() => {
    loadOrganizationData();
  }, [orgId, organizations]);

  const loadOrganizationData = async () => {
    if (!orgId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Find organization from context
      const org = organizations.find(o => o.id === orgId);
      if (!org) {
        setError('Organization not found');
        return;
      }
      
      setOrganization(org);
      
      // Enter organization context when viewing its dashboard
      actions.enterOrganization(org);
      
      // Load detailed stats for the organization
      await loadOrganizationStats(org);
      
    } catch (err: any) {
      console.error('Failed to load organization data:', err);
      setError(err.message || 'Failed to load organization data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizationStats = async (org: Organization) => {
    try {
      // Set organization as active to get proper context
      actions.setActiveOrganization(org);
      
      // Load activity logs using the API (with fallback to mock data)
      let activityLogs: ActivityLog[] = [];
      try {
        const activityResponse = await organizationApi.getActivity(org.id, { limit: 10 });
        // The API now returns a consistent format with normalization built-in
        if (activityResponse?.success && activityResponse.data?.activities) {
          activityLogs = Array.isArray(activityResponse.data.activities) 
            ? activityResponse.data.activities 
            : [];
        } else {
          activityLogs = [];
        }
      } catch (error) {
        console.error('Failed to load activity logs:', error);
        // Fallback to empty array if API fails
        activityLogs = [];
      }

      // Calculate enhanced stats from org stats
      const orgStats = org.stats;
      const enhancedStats: OrganizationStats = {
        totalUsers: orgStats.user_count,
        totalInvoices: orgStats.invoice_count,
        totalRevenue: orgStats.total_revenue,
        activeInvoices: orgStats.active_invoices,
        draftInvoices: Math.floor(orgStats.invoice_count * 0.1), // 10% drafts
        paidInvoices: Math.floor(orgStats.invoice_count * 0.7), // 70% paid
        overdueInvoices: Math.floor(orgStats.invoice_count * 0.2), // 20% overdue
        avgInvoiceValue: orgStats.invoice_count > 0 ? Math.floor(orgStats.total_revenue / orgStats.invoice_count) : 0,
        monthlyRevenue: Math.floor(orgStats.total_revenue * 0.15), // Approximate current month
        recentActivity: activityLogs,
      };
      
      setStats(enhancedStats);
      
    } catch (err: any) {
      console.error('Failed to load organization stats:', err);
      throw err;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return 'Unknown time';
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'Unknown time';
    }
  };

  const getActivityIcon = (activity: ActivityLog) => {
    switch (activity.type) {
      case 'invoice_created':
        return <Plus className="w-4 h-4 text-blue-600" />;
      case 'payment_received':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'user_invited':
      case 'user_joined':
        return <Users className="w-4 h-4 text-purple-600" />;
      case 'profile_updated':
        return <Settings className="w-4 h-4 text-gray-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Error Loading Organization</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <div className="mt-6">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!organization || !stats) {
    return null;
  }

  // Invoice status chart data
  const invoiceStatusData: ChartDataPoint[] = stats ? [
    { name: 'Paid', value: stats.paidInvoices, color: 'bg-green-500' },
    { name: 'Active', value: stats.activeInvoices, color: 'bg-blue-500' },
    { name: 'Overdue', value: stats.overdueInvoices, color: 'bg-red-500' },
    { name: 'Draft', value: stats.draftInvoices, color: 'bg-gray-500' },
  ] : [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        {/* Breadcrumbs */}
        <div className="mb-4">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <button
                  onClick={() => {
                    actions.exitOrganization();
                    router.push('/dashboard');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  Dashboard
                </button>
              </li>
              <li>
                <span className="text-gray-400">/</span>
              </li>
              <li>
                <span className="text-gray-900 text-sm font-medium">
                  {organization?.name || 'Unknown Organization'}
                </span>
              </li>
            </ol>
          </nav>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={() => {
                actions.exitOrganization();
                router.push('/dashboard');
              }}
              className="mr-4 p-2 rounded-md hover:bg-gray-100 transition-colors group"
              title="Exit Organization"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-primary-600" />
            </button>
          
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
              {organization?.logo_url ? (
                <img 
                  src={organization.logo_url} 
                  alt={organization.name || 'Organization'}
                  className="w-10 h-10 rounded object-cover"
                  onError={(e) => {
                    // Fallback to initial if image fails to load
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'block';
                    }
                  }}
                />
              ) : null}
              <span 
                className="text-primary-600 font-bold text-lg" 
                style={{ display: organization?.logo_url ? 'none' : 'block' }}
              >
                {(organization?.name || 'Org').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                {organization?.name || 'Unknown Organization'}
              </h1>
              {organization?.description && (
                <p className="mt-1 text-gray-600">{organization.description}</p>
              )}
            </div>
          </div>
        </div>

          {/* Exit Organization Button */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                actions.exitOrganization();
                router.push('/dashboard');
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              title="Return to organization selection"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit Organization
            </button>
          </div>
        </div>

        {/* Organization Navigation Tabs */}
        <div className="mt-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <Link
                href={`/dashboard/organizations/${orgId}`}
                className="border-primary-500 text-primary-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                <BarChart3 className="w-4 h-4 mr-2 inline" />
                Overview
              </Link>
              <Link
                href="/dashboard/invoices"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                <FileText className="w-4 h-4 mr-2 inline" />
                Invoices
              </Link>
              {permissions?.canManageUsers && (
                <Link
                  href="/dashboard/users"
                  className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                >
                  <Users className="w-4 h-4 mr-2 inline" />
                  Team
                </Link>
              )}
              {permissions?.canViewActivity && (
                <Link
                  href="/dashboard/activity"
                  className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                >
                  <Activity className="w-4 h-4 mr-2 inline" />
                  Activity
                </Link>
              )}
              <Link
                href="/dashboard/templates"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                <Settings className="w-4 h-4 mr-2 inline" />
                Templates
              </Link>
            </nav>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="mt-6 flex items-center space-x-4">
          <Link
            href="/dashboard/invoices/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Link>
          
          {permissions?.canManageUsers && (
            <Link
              href="/dashboard/users"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Link>
          )}
          
          <Link
            href="/dashboard/templates"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-blue-500"
          change="+2 this month"
        />
        
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          color="bg-green-500"
          change={`${formatCurrency(stats.monthlyRevenue)} this month`}
          isString
        />
        
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices}
          icon={FileText}
          color="bg-purple-500"
          change={`${stats.activeInvoices} active`}
        />
        
        <StatCard
          title="Avg Invoice Value"
          value={formatCurrency(stats.avgInvoiceValue)}
          icon={TrendingUp}
          color="bg-yellow-500"
          change={stats.overdueInvoices > 0 ? `${stats.overdueInvoices} overdue` : 'All current'}
          isString
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Status Chart */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
              Invoice Status
            </h3>
            
            <div className="space-y-4">
              {invoiceStatusData.length === 0 ? (
                /* Empty state for no invoice data */
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-8 w-8 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No invoice data</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Invoice statistics will appear here once invoices are created.
                  </p>
                </div>
              ) : (
                invoiceStatusData.map((item, index) => {
                  // Calculate max value for percentage, avoid division by zero
                  const maxValue = Math.max(...invoiceStatusData.map(d => d.value));
                  const percentage = maxValue > 0 ? Math.min(100, (item.value / maxValue) * 100) : 0;
                  
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={cn('w-3 h-3 rounded-full mr-3', item.color)}></div>
                        <span className="text-sm text-gray-600">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{item.value}</span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={cn('h-2 rounded-full', item.color)}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Link
                href="/dashboard/invoices"
                className="text-sm text-primary-600 hover:text-primary-500 font-medium"
              >
                View all invoices →
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <ActivityErrorBoundary>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-primary-600" />
              Recent Activity
            </h3>
            
            <div className="space-y-4">
              {stats?.recentActivity?.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      {getActivityIcon(activity)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs text-gray-500">
                        by {activity.actor.display_name || activity.actor.email || 'System'}
                      </p>
                      <span className="text-xs text-gray-400">•</span>
                      <p className="text-xs text-gray-500">
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                    {activity.metadata && (
                      <div className="mt-1">
                        {activity.metadata.amount && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                            {activity.metadata.amount}
                          </span>
                        )}
                        {activity.metadata.email && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            {activity.metadata.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {permissions?.canViewActivity && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Link
                  href="/dashboard/activity"
                  className="text-sm text-primary-600 hover:text-primary-500 font-medium"
                >
                  View all activity →
                </Link>
              </div>
            )}
          </div>
          </ActivityErrorBoundary>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-primary-600" />
            Payment Methods
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Crypto Payments</span>
              <span className="text-sm font-medium text-green-600">85%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Bank Transfer</span>
              <span className="text-sm font-medium text-blue-600">12%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Other</span>
              <span className="text-sm font-medium text-gray-600">3%</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
            Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Payment Time</span>
              <span className="text-sm font-medium text-gray-900">5.2 days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Collection Rate</span>
              <span className="text-sm font-medium text-green-600">94%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Client Satisfaction</span>
              <span className="text-sm font-medium text-blue-600">4.8/5</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-primary-600" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link
              href="/dashboard/invoices/create"
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50"
            >
              Create New Invoice
            </Link>
            {permissions?.canManageUsers && (
              <Link
                href="/dashboard/users"
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50"
              >
                Invite User
              </Link>
            )}
            <Link
              href="/dashboard/templates"
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50"
            >
              Manage Templates
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Stat Card Component
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  change?: string;
  isString?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, change, isString = false }) => {
  return (
    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={cn('p-3 rounded-md', color)}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-2xl font-bold text-gray-900">
                {isString ? value : typeof value === 'number' ? value.toLocaleString() : value}
              </dd>
              {change && (
                <dd className="text-xs text-gray-600 mt-1">{change}</dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

// Error boundary component for activity logs section
class ActivityErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ActivityErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary-600" />
            Recent Activity
          </h3>
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              There was an error loading the activity log. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}