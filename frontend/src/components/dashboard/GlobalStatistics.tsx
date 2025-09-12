'use client';

import React from 'react';
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowRight,
  Calendar,
  BarChart3,
  UserCheck,
} from 'lucide-react';
import { GlobalStats, ActivityLog } from '@/types/user';
import { cn } from '@/utils/helpers';
import Link from 'next/link';

interface GlobalStatisticsProps {
  stats: GlobalStats;
  isLoading?: boolean;
  className?: string;
}

export const GlobalStatistics: React.FC<GlobalStatisticsProps> = ({
  stats,
  isLoading = false,
  className,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="animate-pulse">
          {/* Stats cards skeleton */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          
          {/* Organization breakdown skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-8', className)}>
      {/* Global Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Organizations"
          value={stats.totalOrganizations}
          icon={Building2}
          color="bg-blue-500"
          trend="+12% from last month"
        />
        
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-green-500"
          trend="+8% from last month"
        />
        
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices}
          icon={FileText}
          color="bg-purple-500"
          trend="+23% from last month"
        />
        
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          color="bg-yellow-500"
          trend="+15% from last month"
          isString
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Organization Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-primary-600" />
                Top Organizations
              </h3>
              <Link
                href="/dashboard/organizations"
                className="text-sm text-primary-600 hover:text-primary-500 font-medium flex items-center"
              >
                View All
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="space-y-4">
              {stats.organizationBreakdown.slice(0, 5).map((org, index) => (
                <div key={org.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                      <span className="text-primary-600 font-semibold text-sm">
                        {org.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-500">
                        {org.userCount} users • {org.invoiceCount} invoices
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(org.revenue)}
                    </p>
                    <p className="text-xs text-gray-500">
                      #{index + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {stats.organizationBreakdown.length === 0 && (
              <div className="text-center py-8">
                <Building2 className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No organizations found</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-primary-600" />
                Recent Activity
              </h3>
              <Link
                href="/dashboard/activity"
                className="text-sm text-primary-600 hover:text-primary-500 font-medium flex items-center"
              >
                View All
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="space-y-4">
              {stats.recentActivity.slice(0, 6).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>

            {stats.recentActivity.length === 0 && (
              <div className="text-center py-8">
                <Activity className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions for Global View */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
          Global Actions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionButton
            href="/dashboard/organizations"
            icon={Building2}
            title="Manage Organizations"
            description="View and manage all organizations"
          />
          
          <QuickActionButton
            href="/dashboard/activity"
            icon={Activity}
            title="System Activity"
            description="View global activity across all orgs"
          />
          
          <QuickActionButton
            href="/dashboard/analytics"
            icon={BarChart3}
            title="Global Analytics"
            description="View system-wide analytics"
          />
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: string;
  isString?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend, isString = false }) => {
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
              {trend && (
                <dd className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {trend}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Item Component
interface ActivityItemProps {
  activity: ActivityLog;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_invited':
      case 'user_joined':
        return UserCheck;
      case 'invoice_created':
        return FileText;
      case 'payment_received':
        return DollarSign;
      case 'login':
        return Users;
      default:
        return Activity;
    }
  };

  const Icon = getActivityIcon(activity.type);

  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900">{activity.description}</p>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span>{activity.organization_name}</span>
          <span>•</span>
          <span>{formatDate(activity.created_at)}</span>
        </div>
      </div>
    </div>
  );
};

// Quick Action Button Component
interface QuickActionButtonProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ href, icon: Icon, title, description }) => {
  return (
    <Link href={href} className="block">
      <div className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Icon className="w-5 h-5 text-gray-600 group-hover:text-primary-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 group-hover:text-primary-900">
              {title}
            </p>
            <p className="text-xs text-gray-500 group-hover:text-primary-700">
              {description}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};