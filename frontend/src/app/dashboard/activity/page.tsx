'use client';

import React, { useState, useEffect } from 'react';
import { useWalletAuth } from '@/contexts/AuthContext';
import { useOrganization, useUserPermissions } from '@/contexts/OrganizationContext';
import { OrganizationSwitcher } from '@/components/common/OrganizationSwitcher';
import { ActivityLog } from '@/types/user';
import {
  Activity,
  Filter,
  Calendar,
  User,
  FileText,
  UserPlus,
  UserMinus,
  Settings,
  DollarSign,
  Eye,
  Search,
  Download,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/utils/helpers';

interface ActivityFilters {
  type: string;
  actor_id: string;
  date_range: string;
  search: string;
}

interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

const ACTIVITY_TYPES = [
  { id: 'user_invited', name: 'User Invited', icon: UserPlus, color: 'text-blue-600' },
  { id: 'user_joined', name: 'User Joined', icon: User, color: 'text-green-600' },
  { id: 'user_removed', name: 'User Removed', icon: UserMinus, color: 'text-red-600' },
  { id: 'role_changed', name: 'Role Changed', icon: Settings, color: 'text-indigo-600' },
  { id: 'invoice_created', name: 'Invoice Created', icon: FileText, color: 'text-purple-600' },
  { id: 'payment_received', name: 'Payment Received', icon: DollarSign, color: 'text-green-600' },
  { id: 'login', name: 'User Login', icon: User, color: 'text-gray-600' },
  { id: 'profile_updated', name: 'Profile Updated', icon: Settings, color: 'text-blue-600' },
];

const DATE_RANGES = [
  { id: 'today', name: 'Today' },
  { id: 'week', name: 'This Week' },
  { id: 'month', name: 'This Month' },
  { id: 'quarter', name: 'This Quarter' },
  { id: 'year', name: 'This Year' },
  { id: 'all', name: 'All Time' },
];

export default function ActivityPage() {
  const { user, isAuthenticated } = useWalletAuth();
  const { state: orgState, actions: orgActions } = useOrganization();
  const permissions = useUserPermissions();
  
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<ActivityPagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<ActivityFilters>({
    type: '',
    actor_id: '',
    date_range: 'month',
    search: '',
  });

  const { organizations, activeOrganization } = orgState;

  // Check permissions
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Required</h2>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  if (!permissions?.canViewActivity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Insufficient Permissions</h2>
          <p className="text-gray-600">You don't have permission to view organization activity.</p>
          <p className="text-sm text-gray-500 mt-2">Contact your organization administrator for access.</p>
        </div>
      </div>
    );
  }

  const fetchActivities = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const targetOrgId = permissions?.canViewAllOrganizations && !activeOrganization 
        ? undefined 
        : activeOrganization?.id;

      if (!targetOrgId && !permissions?.canViewAllOrganizations) {
        throw new Error('No organization selected');
      }

      const filterParams = {
        limit: 20,
        offset: (page - 1) * 20,
        type: filters.type || undefined,
        actor_id: filters.actor_id || undefined,
        date_range: filters.date_range || undefined,
        search: filters.search || undefined,
      };

      const fetchedActivities = await orgActions.getActivityLogs(targetOrgId, filterParams);

      // Client-side pagination simulation (replace with real API pagination)
      const startIndex = (page - 1) * 20;
      const endIndex = startIndex + 20;
      const paginatedActivities = fetchedActivities.slice(startIndex, endIndex);
      
      setActivities(paginatedActivities);
      setPagination({
        page,
        limit: 20,
        total: fetchedActivities.length,
        pages: Math.ceil(fetchedActivities.length / 20),
        has_next: endIndex < fetchedActivities.length,
        has_prev: page > 1,
      });
      
    } catch (err: any) {
      console.error('Error fetching activities:', err);
      setError(err.message || 'Failed to fetch activity logs');
      setActivities([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organizations.length > 0) {
      fetchActivities();
    }
  }, [organizations, activeOrganization, filters]);

  const handleFilterChange = (key: keyof ActivityFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      type: '',
      actor_id: '',
      date_range: 'month',
      search: '',
    });
  };

  const getActivityIcon = (type: string) => {
    const activityType = ACTIVITY_TYPES.find(t => t.id === type);
    if (!activityType) return <Activity className="w-5 h-5 text-gray-500" />;
    
    const Icon = activityType.icon;
    return <Icon className={cn('w-5 h-5', activityType.color)} />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const exportActivities = async () => {
    try {
      // Create CSV content
      const csvHeaders = ['Date', 'Type', 'Actor', 'Description', 'Organization'].join(',');
      const csvRows = activities.map(activity => [
        new Date(activity.created_at).toISOString(),
        activity.type,
        activity.actor.display_name || activity.actor.email || 'Unknown',
        `"${activity.description.replace(/"/g, '""')}"`, // Escape quotes
        activity.organization_name,
      ].join(',')).join('\n');
      
      const csvContent = [csvHeaders, csvRows].join('\n');
      
      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `activity-log-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export activities:', error);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Activity className="w-6 h-6 mr-2" />
            {permissions?.canViewAllOrganizations && !activeOrganization
              ? 'Multi-Organization Activity'
              : `${activeOrganization?.name || 'Organization'} Activity`
            }
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            {permissions?.canViewAllOrganizations && !activeOrganization
              ? `Monitor activity across ${organizations.length} organizations.`
              : `Track user actions and system events in ${activeOrganization?.name || 'this organization'}.`
            }
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex items-center space-x-4">
          {/* Organization Switcher */}
          <OrganizationSwitcher 
            showAllOption={permissions?.canViewAllOrganizations}
            className="w-64"
          />
          
          {/* Export Button */}
          {activities.length > 0 && (
            <button
              onClick={exportActivities}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* Search */}
          <div className="sm:col-span-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activity..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Activity Type Filter */}
          <div className="sm:col-span-3">
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Activities</option>
              {ACTIVITY_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="sm:col-span-3">
            <select
              value={filters.date_range}
              onChange={(e) => handleFilterChange('date_range', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {DATE_RANGES.map(range => (
                <option key={range.id} value={range.id}>{range.name}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="sm:col-span-2">
            {(filters.search || filters.type || filters.actor_id || filters.date_range !== 'month') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
              <div className="mt-4">
                <button
                  onClick={() => fetchActivities()}
                  className="bg-red-100 px-3 py-1 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="mt-6 bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading activity logs...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No activity found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.search || filters.type || filters.actor_id
                ? 'Try adjusting your search filters.'
                : 'No recent activity to display.'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Activity List */}
            <div className="divide-y divide-gray-200">
              {activities.map((activity) => (
                <div key={activity.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    {/* Activity Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        {getActivityIcon(activity.type)}
                      </div>
                    </div>

                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 font-medium">
                            {activity.description}
                          </p>
                          <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              {activity.actor.display_name || activity.actor.email || 'Unknown User'}
                            </div>
                            {permissions?.canViewAllOrganizations && (
                              <div className="flex items-center">
                                <Activity className="w-3 h-3 mr-1" />
                                {activity.organization_name}
                              </div>
                            )}
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDate(activity.created_at)}
                            </div>
                          </div>
                        </div>

                        {/* Activity Type Badge */}
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {ACTIVITY_TYPES.find(t => t.id === activity.type)?.name || activity.type}
                          </span>
                        </div>
                      </div>

                      {/* Additional Metadata */}
                      {activity.target && (
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">Target:</span> {activity.target.type} - {activity.target.name || activity.target.id}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} results
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => fetchActivities(pagination.page - 1)}
                      disabled={!pagination.has_prev}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchActivities(pagination.page + 1)}
                      disabled={!pagination.has_next}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}