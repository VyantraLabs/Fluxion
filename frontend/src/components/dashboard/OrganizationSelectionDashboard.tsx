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
  Clock,
} from 'lucide-react';
import { useOrganization, useUserPermissions, useMultiOrganizationData } from '@/contexts/OrganizationContext';
import { Organization } from '@/types/user';
import { cn } from '@/utils/helpers';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  totalInvoices: number;
  totalRevenue: number;
  activeInvoices: number;
  recentActivity: number;
}

export const OrganizationSelectionDashboard: React.FC = () => {
  const router = useRouter();
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  
  const { organizations, globalStats, globalStatsLoading, isLoading } = state;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSelectOrganization = (organization: Organization) => {
    // Navigate directly to organization dashboard
    router.push(`/dashboard/organizations/${organization.id}`);
  };

  if (isLoading || globalStatsLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="text-center">
            <div className="h-12 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto"></div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center mb-4">
            <Building2 className="w-10 h-10 mr-4 text-primary-600" />
            Select Organization
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose an organization to access its dashboard, manage invoices, users, and view analytics.
            {organizations.length > 0 && ` You have access to ${organizations.length} organization${organizations.length === 1 ? '' : 's'}.`}
          </p>
        </div>
      </div>

      {/* Global Stats Cards (for system admins) */}
      {permissions?.canViewAllOrganizations && globalStats && (
        <div className="mb-8">
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
              Platform Overview
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{globalStats.totalOrganizations}</div>
                <div className="text-sm text-gray-600">Organizations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{globalStats.totalUsers}</div>
                <div className="text-sm text-gray-600">Total Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{globalStats.totalInvoices}</div>
                <div className="text-sm text-gray-600">Total Invoices</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{formatCurrency(globalStats.totalRevenue)}</div>
                <div className="text-sm text-gray-600">Total Revenue</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Organization Selection Cards */}
      <div className="mb-8">
        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Organizations Found</h3>
            <p className="mt-2 text-sm text-gray-500">
              You haven't been added to any organizations yet. Contact your administrator to get access.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Your Organizations</h2>
              <div className="flex items-center space-x-4">
                {permissions?.canViewAllOrganizations && (
                  <Link
                    href="/dashboard/organizations"
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Browse All
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <EnhancedOrganizationCard 
                  key={org.id} 
                  organization={org} 
                  onSelect={handleSelectOrganization}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Getting Started Guide (for new users) */}
      {organizations.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-primary-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-primary-600" />
            What you can do next
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Plus className="w-6 h-6 text-primary-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Create Invoices</h4>
              <p className="text-sm text-gray-600">Generate professional invoices with crypto payment options</p>
            </div>
            
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Manage Teams</h4>
              <p className="text-sm text-gray-600">Invite team members and manage organization access</p>
            </div>
            
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-6 h-6 text-yellow-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Track Analytics</h4>
              <p className="text-sm text-gray-600">Monitor revenue, payments, and business performance</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Organization Card Component for selection
interface EnhancedOrganizationCardProps {
  organization: Organization;
  onSelect: (organization: Organization) => void;
}

const EnhancedOrganizationCard: React.FC<EnhancedOrganizationCardProps> = ({ organization, onSelect }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer group"
      onClick={() => onSelect(organization)}
    >
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-primary-200 transition-colors">
            {organization.logo_url ? (
              <img 
                src={organization.logo_url} 
                alt={organization.name}
                className="w-10 h-10 rounded object-cover"
              />
            ) : (
              <span className="text-primary-600 font-bold text-lg">
                {organization.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">
              {organization.name}
            </h3>
            {organization.description && (
              <p className="text-sm text-gray-500 truncate mt-1">
                {organization.description}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Users className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">Team Members</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{organization.stats.user_count}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FileText className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">Invoices</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{organization.stats.invoice_count}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">Revenue</span>
            </div>
            <span className="text-sm font-semibold text-green-600">
              {formatCurrency(organization.stats.total_revenue)}
            </span>
          </div>
          {organization.stats.active_invoices > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">Active Invoices</span>
              </div>
              <span className="text-sm font-semibold text-primary-600">{organization.stats.active_invoices}</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center text-primary-600 group-hover:text-primary-700 font-medium transition-colors">
            <span className="mr-2">Enter Organization</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};