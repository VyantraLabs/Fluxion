'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  Plus,
  Eye,
  Settings,
  UserPlus,
  BarChart3,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { OrganizationSwitcher } from '@/components/common/OrganizationSwitcher';
import { useOrganization, useUserPermissions, useMultiOrganizationData } from '@/contexts/OrganizationContext';
import { Organization, OrganizationUser, GlobalStats } from '@/types/user';
import { cn } from '@/utils/helpers';
import Link from 'next/link';

interface DashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  totalInvoices: number;
  totalRevenue: number;
  activeInvoices: number;
  recentActivity: number;
}

interface OrganizationCard {
  id: string;
  name: string;
  userCount: number;
  invoiceCount: number;
  revenue: number;
  activeInvoices: number;
  logo_url?: string;
}

export const MultiOrgDashboard: React.FC = () => {
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  const { getOrganizationSummary } = useMultiOrganizationData();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalOrganizations: 0,
    totalUsers: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    activeInvoices: 0,
    recentActivity: 0,
  });
  
  const [organizationCards, setOrganizationCards] = useState<OrganizationCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { organizations, activeOrganization, isGlobalView, globalStats, globalStatsLoading } = state;

  useEffect(() => {
    if (isGlobalView) {
      // Global stats are loaded automatically by the context
      loadDashboardData();
    } else if (activeOrganization) {
      loadDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [organizations, activeOrganization, isGlobalView, globalStats]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    
    try {
      if (isGlobalView && globalStats) {
        // Use global stats from context
        const aggregateStats: DashboardStats = {
          totalOrganizations: globalStats.totalOrganizations,
          totalUsers: globalStats.totalUsers,
          totalInvoices: globalStats.totalInvoices,
          totalRevenue: globalStats.totalRevenue,
          activeInvoices: globalStats.totalInvoices, // Approximate - could be enhanced
          recentActivity: globalStats.recentActivity?.length || 0,
        };

        // Create organization cards from breakdown
        const cards: OrganizationCard[] = globalStats.organizationBreakdown.map(org => ({
          id: org.id,
          name: org.name,
          userCount: org.userCount,
          invoiceCount: org.invoiceCount,
          revenue: org.revenue,
          activeInvoices: Math.floor(org.invoiceCount * 0.7), // Approximate active invoices
          logo_url: undefined,
        }));

        setStats(aggregateStats);
        setOrganizationCards(cards);
      } else if (activeOrganization) {
        // Single organization stats
        const orgStats: DashboardStats = {
          totalOrganizations: 1,
          totalUsers: activeOrganization.stats.user_count,
          totalInvoices: activeOrganization.stats.invoice_count,
          totalRevenue: activeOrganization.stats.total_revenue,
          activeInvoices: activeOrganization.stats.active_invoices,
          recentActivity: 5, // Mock recent activity count
        };

        setStats(orgStats);
        setOrganizationCards([]);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
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

  if (isLoading || globalStatsLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show organization selection prompt when no organization is selected
  if (!isGlobalView && !activeOrganization) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No organization selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            Select an organization to view your dashboard, or browse all organizations if you have permission.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/organizations"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Browse Organizations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showGlobalView = isGlobalView && permissions?.canViewAllOrganizations;
  const showOrgView = !isGlobalView && activeOrganization;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Building2 className="w-8 h-8 mr-3 text-primary-600" />
              {showGlobalView
                ? 'Global Dashboard'
                : activeOrganization
                ? `${activeOrganization.name} Dashboard`
                : 'Organization Dashboard'
              }
            </h1>
            <p className="mt-2 text-gray-600">
              {showGlobalView
                ? `Managing ${stats.totalOrganizations} organizations with ${stats.totalUsers} total users`
                : activeOrganization
                ? `Managing ${activeOrganization.stats.user_count} users and ${activeOrganization.stats.invoice_count} invoices`
                : 'Select an organization to view dashboard'
              }
            </p>
          </div>

          {/* Organization Switcher */}
          <div className="flex items-center space-x-4">
            <OrganizationSwitcher 
              showAllOption={permissions?.canViewAllOrganizations}
              className="w-80"
            />
            {permissions?.canManageUsers && (
              <Link
                href="/dashboard/users"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Manage Users
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Organizations"
          value={showGlobalView ? stats.totalOrganizations : 1}
          icon={Building2}
          color="bg-blue-500"
          show={showGlobalView}
        />
        
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-green-500"
        />
        
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices}
          icon={FileText}
          color="bg-purple-500"
        />
        
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          color="bg-yellow-500"
          isString
        />
      </div>

      {/* Organization Cards (for global view) */}
      {showGlobalView && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Organizations Overview</h2>
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              <BarChart3 className="w-4 h-4 mr-2" />
              View Analytics
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {organizationCards.map((org) => (
              <OrganizationCard 
                key={org.id} 
                organization={org} 
                onSelect={(orgId) => {
                  const fullOrg = organizations.find(o => o.id === orgId);
                  if (fullOrg) {
                    actions.setActiveOrganization(fullOrg);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Actions Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary-600" />
            Quick Actions
          </h3>
          
          <div className="space-y-3">
            {permissions?.canManageUsers && (
              <QuickActionButton
                href="/dashboard/users"
                icon={Users}
                title="Manage Users"
                description="Invite, edit, or remove users from organizations"
              />
            )}
            
            <QuickActionButton
              href="/dashboard/invoices/create"
              icon={Plus}
              title="Create Invoice"
              description="Create a new invoice for clients"
            />
            
            {permissions?.canViewActivity && (
              <QuickActionButton
                href="/dashboard/activity"
                icon={Calendar}
                title="View Activity"
                description="See recent activity across organizations"
              />
            )}

            {permissions?.canManageSettings && (
              <QuickActionButton
                href="/dashboard/settings"
                icon={Settings}
                title="Organization Settings"
                description="Configure organization preferences"
              />
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
            Recent Activity
          </h3>
          
          <div className="space-y-4">
            <ActivityItem
              type="user_invited"
              description="John Doe was invited to Acme Corp"
              time="2 minutes ago"
              icon={UserPlus}
            />
            <ActivityItem
              type="invoice_created"
              description="Invoice #INV-001 created"
              time="1 hour ago"
              icon={FileText}
            />
            <ActivityItem
              type="user_joined"
              description="Jane Smith joined Tech Startup"
              time="3 hours ago"
              icon={Users}
            />
          </div>

          {permissions?.canViewActivity && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/dashboard/activity"
                className="text-sm text-primary-600 hover:text-primary-500 font-medium"
              >
                View all activity →
              </Link>
            </div>
          )}
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
  show?: boolean;
  isString?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, show = true, isString = false }) => {
  if (!show) return null;

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
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

// Organization Card Component
interface OrganizationCardProps {
  organization: OrganizationCard;
  onSelect: (orgId: string) => void;
}

const OrganizationCard: React.FC<OrganizationCardProps> = ({ organization, onSelect }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
            {organization.logo_url ? (
              <img 
                src={organization.logo_url} 
                alt={organization.name}
                className="w-8 h-8 rounded object-cover"
              />
            ) : (
              <span className="text-primary-600 font-semibold">
                {organization.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {organization.name}
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Users</span>
            <span className="text-sm font-medium text-gray-900">{organization.userCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Invoices</span>
            <span className="text-sm font-medium text-gray-900">{organization.invoiceCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Revenue</span>
            <span className="text-sm font-medium text-gray-900">
              ${organization.revenue.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Active Invoices</span>
            <span className="text-sm font-medium text-primary-600">{organization.activeInvoices}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button 
            onClick={() => onSelect(organization.id)}
            className="w-full text-center text-sm text-primary-600 hover:text-primary-500 font-medium flex items-center justify-center"
          >
            Select Organization
            <ArrowRight className="w-3 h-3 ml-1" />
          </button>
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
            <p className="text-sm text-gray-500 group-hover:text-primary-700">
              {description}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

// Activity Item Component
interface ActivityItemProps {
  type: string;
  description: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ description, time, icon: Icon }) => {
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900">{description}</p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
};