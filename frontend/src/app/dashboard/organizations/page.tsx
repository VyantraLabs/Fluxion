'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  Search,
  Filter,
  Grid,
  List,
  ArrowRight,
  TrendingUp,
  Activity,
  Plus,
  Settings,
  Eye,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOrganization, useUserPermissions } from '@/contexts/OrganizationContext';
import { Organization } from '@/types/user';
import { cn } from '@/utils/helpers';
import { GlobalStatistics } from '@/components/dashboard/GlobalStatistics';

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'users' | 'invoices' | 'revenue' | 'created';
type SortOrder = 'asc' | 'desc';

interface OrganizationFilters {
  search: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  minUsers?: number;
  maxUsers?: number;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<OrganizationFilters>({
    search: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { organizations, globalStats, globalStatsLoading, isLoading } = state;

  // Filter and sort organizations
  const filteredOrganizations = useMemo(() => {
    let filtered = [...organizations];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(org => 
        org.name.toLowerCase().includes(searchLower) ||
        org.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply user count filters
    if (filters.minUsers !== undefined) {
      filtered = filtered.filter(org => org.stats.user_count >= filters.minUsers!);
    }
    if (filters.maxUsers !== undefined) {
      filtered = filtered.filter(org => org.stats.user_count <= filters.maxUsers!);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (filters.sortBy) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'users':
          valueA = a.stats.user_count;
          valueB = b.stats.user_count;
          break;
        case 'invoices':
          valueA = a.stats.invoice_count;
          valueB = b.stats.invoice_count;
          break;
        case 'revenue':
          valueA = a.stats.total_revenue;
          valueB = b.stats.total_revenue;
          break;
        case 'created':
          valueA = new Date(a.created_at).getTime();
          valueB = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return filters.sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [organizations, filters]);

  const handleSelectOrganization = (organization: Organization) => {
    actions.setActiveOrganization(organization);
    router.push('/dashboard');
  };

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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Show global statistics for system admins
  const showGlobalStats = permissions?.canViewAllOrganizations && globalStats;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Building2 className="w-8 h-8 mr-3 text-primary-600" />
              Organizations
            </h1>
            <p className="mt-2 text-gray-600">
              {permissions?.canViewAllOrganizations 
                ? `Managing ${organizations.length} organizations across the platform`
                : `Browse your ${organizations.length} organizations`
              }
            </p>
          </div>

          {/* Global View Toggle */}
          {permissions?.canViewAllOrganizations && (
            <div className="flex items-center space-x-4">
              <button
                onClick={() => actions.setGlobalView(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Activity className="w-4 h-4 mr-2" />
                Global View
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Statistics (for admins) */}
      {showGlobalStats && (
        <div className="mb-8">
          <GlobalStatistics stats={globalStats} isLoading={globalStatsLoading} />
        </div>
      )}

      {/* Filters and Controls */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 w-64"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium',
                showFilters ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>

          {/* View Mode and Sort */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Sort by:</span>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as SortBy }))}
                className="text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="name">Name</option>
                <option value="users">Users</option>
                <option value="invoices">Invoices</option>
                <option value="revenue">Revenue</option>
                <option value="created">Created Date</option>
              </select>
              
              <button
                onClick={() => setFilters(prev => ({ 
                  ...prev, 
                  sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
                }))}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {filters.sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            <div className="flex border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 text-sm font-medium',
                  viewMode === 'grid' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 text-sm font-medium border-l border-gray-300',
                  viewMode === 'list' 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Users</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={filters.minUsers || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    minUsers: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                <input
                  type="number"
                  min="0"
                  placeholder="∞"
                  value={filters.maxUsers || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    maxUsers: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({
                    search: '',
                    sortBy: 'name',
                    sortOrder: 'asc',
                  })}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      )}

      {/* Organizations List */}
      {!isLoading && (
        <>
          {filteredOrganizations.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filters.search ? 'Try adjusting your search criteria.' : 'You haven\'t been added to any organizations yet.'}
              </p>
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid' 
                ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'
                : 'space-y-4'
            )}>
              {filteredOrganizations.map((organization) => (
                viewMode === 'grid' ? (
                  <OrganizationCard 
                    key={organization.id} 
                    organization={organization} 
                    onSelect={handleSelectOrganization}
                  />
                ) : (
                  <OrganizationListItem 
                    key={organization.id} 
                    organization={organization} 
                    onSelect={handleSelectOrganization}
                  />
                )
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Organization Card Component (Grid View)
interface OrganizationCardProps {
  organization: Organization;
  onSelect: (organization: Organization) => void;
}

const OrganizationCard: React.FC<OrganizationCardProps> = ({ organization, onSelect }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
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
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {organization.name}
            </h3>
            {organization.description && (
              <p className="text-sm text-gray-500 truncate">
                {organization.description}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Users</span>
            <span className="text-sm font-medium text-gray-900">{organization.stats.user_count}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Invoices</span>
            <span className="text-sm font-medium text-gray-900">{organization.stats.invoice_count}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Revenue</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(organization.stats.total_revenue)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Active Invoices</span>
            <span className="text-sm font-medium text-primary-600">{organization.stats.active_invoices}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button 
            onClick={() => onSelect(organization)}
            className="w-full text-center text-sm text-primary-600 hover:text-primary-500 font-medium flex items-center justify-center group"
          >
            Select Organization
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Organization List Item Component (List View)
interface OrganizationListItemProps {
  organization: Organization;
  onSelect: (organization: Organization) => void;
}

const OrganizationListItem: React.FC<OrganizationListItemProps> = ({ organization, onSelect }) => {
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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
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
            
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {organization.name}
              </h3>
              {organization.description && (
                <p className="text-sm text-gray-500">
                  {organization.description}
                </p>
              )}
              <p className="text-xs text-gray-400">
                Created {formatDate(organization.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-8">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">{organization.stats.user_count}</p>
              <p className="text-xs text-gray-500">Users</p>
            </div>
            
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">{organization.stats.invoice_count}</p>
              <p className="text-xs text-gray-500">Invoices</p>
            </div>
            
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                {formatCurrency(organization.stats.total_revenue)}
              </p>
              <p className="text-xs text-gray-500">Revenue</p>
            </div>
            
            <div className="text-center">
              <p className="text-sm font-medium text-primary-600">{organization.stats.active_invoices}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>

            <button 
              onClick={() => onSelect(organization)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Select
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};