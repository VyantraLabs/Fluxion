'use client';

import React, { useState, useEffect } from 'react';
import { useWalletAuth } from '@/contexts/AuthContext';
import { useOrganization, useUserPermissions, useMultiOrganizationData } from '@/contexts/OrganizationContext';
import { canUserManageUsers } from '@/utils/permissions';
import { apiRequest } from '@/utils/api';
import { OrganizationSwitcher } from '@/components/common/OrganizationSwitcher';
import { UserDetailsModal } from '@/components/users/UserDetailsModal';
import { UserInviteModal } from '@/components/users/UserInviteModal';
import { OrganizationUser } from '@/types/user';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  UserPlus,
  Shield,
  ShieldCheck,
  Mail,
  Calendar,
  AlertCircle,
  Building2,
  Settings,
  Trash2,
  Edit,
  Eye
} from 'lucide-react';
import { cn } from '@/utils/helpers';

interface UsersData {
  users: OrganizationUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

interface UserFilters {
  search: string;
  role: string;
  organization: string;
  status: string;
}

interface UserActionModalState {
  isOpen: boolean;
  type: 'view' | 'invite' | null;
  user: OrganizationUser | null;
}

export default function UsersPage() {
  const { user, isAuthenticated } = useWalletAuth();
  const { state: orgState, actions: orgActions } = useOrganization();
  const permissions = useUserPermissions();
  const { getAllOrganizationUsers } = useMultiOrganizationData();
  
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [pagination, setPagination] = useState<UsersData['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '',
    organization: '',
    status: 'all',
  });
  
  const [actionModal, setActionModal] = useState<UserActionModalState>({
    isOpen: false,
    type: null,
    user: null,
  });
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  
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

  if (!permissions?.canManageUsers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Insufficient Permissions</h2>
          <p className="text-gray-600">You don't have permission to manage organization users.</p>
          <p className="text-sm text-gray-500 mt-2">Contact your organization administrator for access.</p>
        </div>
      </div>
    );
  }

  // Fetch users based on active organization and permissions
  const fetchUsers = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      let fetchedUsers: OrganizationUser[] = [];
      
      if (permissions?.canViewAllOrganizations && !activeOrganization) {
        // Fetch users from all organizations for owners/system admins
        fetchedUsers = await getAllOrganizationUsers();
      } else if (activeOrganization) {
        // Fetch users from specific organization
        fetchedUsers = await orgActions.getOrganizationUsers(activeOrganization.id);
      } else {
        throw new Error('No organization selected');
      }

      // Apply client-side filtering
      let filteredUsers = fetchedUsers;

      // Filter by search term
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.display_name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.first_name?.toLowerCase().includes(searchLower) ||
          user.last_name?.toLowerCase().includes(searchLower) ||
          user.wallet_address?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by role (handle both single role and legacy role arrays)
      if (filters.role) {
        filteredUsers = filteredUsers.filter(user => {
          // Check new single role field
          if (user.role === filters.role) {
            return true;
          }
          // Backwards compatibility: check legacy role arrays
          const orgRoles = user.organization_roles || [];
          const sysRoles = user.system_roles || [];
          return orgRoles.includes(filters.role) || sysRoles.includes(filters.role);
        });
      }

      // Filter by organization (for multi-org view)
      if (filters.organization && permissions?.canViewAllOrganizations) {
        filteredUsers = filteredUsers.filter(user => 
          user.organization_id === filters.organization
        );
      }

      // Filter by status
      if (filters.status !== 'all') {
        filteredUsers = filteredUsers.filter(user => 
          filters.status === 'active' ? user.is_active : !user.is_active
        );
      }

      // Simple pagination (client-side for now)
      const limit = 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
      
      setUsers(paginatedUsers);
      setPagination({
        page,
        limit,
        total: filteredUsers.length,
        pages: Math.ceil(filteredUsers.length / limit),
        has_next: endIndex < filteredUsers.length,
        has_prev: page > 1,
      });
      
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
      setUsers([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organizations.length > 0) {
      fetchUsers();
    }
  }, [organizations, activeOrganization]);
  
  useEffect(() => {
    fetchUsers(1);
  }, [filters]);

  const handleFilterChange = (key: keyof UserFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      role: '',
      organization: '',
      status: 'all',
    });
  };
  
  const handleUserAction = (type: 'view', user: OrganizationUser) => {
    setActionModal({ isOpen: true, type, user });
  };
  
  const handleInviteUser = () => {
    setShowInviteModal(true);
  };
  
  const handleRemoveUser = async (user: OrganizationUser) => {
    if (!confirm(`Are you sure you want to remove ${user.display_name || user.email} from the organization?`)) {
      return;
    }
    
    try {
      await orgActions.removeUser({
        user_id: user.id,
        organization_id: user.organization_id,
      });
      
      // Refresh users list
      await fetchUsers();
      
      setActionModal({ isOpen: false, type: null, user: null });
    } catch (error) {
      console.error('Failed to remove user:', error);
    }
  };

  const getRoleBadge = (user: OrganizationUser) => {
    // Check system roles first
    if (user.system_roles?.includes('super_admin')) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <ShieldCheck className="w-3 h-3 mr-1" />
        Super Admin
      </span>;
    }
    
    if (user.system_roles?.includes('admin')) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Shield className="w-3 h-3 mr-1" />
        System Admin
      </span>;
    }

    // Handle organization roles
    const primaryRole = user.organization_roles?.[0] || 'member';
    const roleColors: Record<string, string> = {
      owner: 'bg-green-100 text-green-800',
      org_admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-indigo-100 text-indigo-800',
      member: 'bg-gray-100 text-gray-800',
      viewer: 'bg-yellow-100 text-yellow-800',
      client: 'bg-pink-100 text-pink-800',
    };

    return (
      <span className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        roleColors[primaryRole] || 'bg-gray-100 text-gray-800'
      )}>
        {primaryRole.replace('_', ' ').charAt(0).toUpperCase() + primaryRole.replace('_', ' ').slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Users className="w-6 h-6 mr-2" />
            {permissions?.canViewAllOrganizations && !activeOrganization
              ? 'Multi-Organization Users'
              : `${activeOrganization?.name || 'Organization'} Users`
            }
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            {permissions?.canViewAllOrganizations && !activeOrganization
              ? `Manage users across ${organizations.length} organizations.`
              : `Manage users and their roles in ${activeOrganization?.name || 'this organization'}.`
            }
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex items-center space-x-4">
          {/* Organization Switcher */}
          <OrganizationSwitcher 
            showAllOption={permissions?.canViewAllOrganizations}
            className="w-64"
          />
          
          {/* Invite User Button */}
          {permissions?.canInviteUsers && (
            <button
              type="button"
              onClick={handleInviteUser}
              className="block rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <UserPlus className="w-4 h-4 mr-2 inline" />
              Invite User
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
                placeholder="Search users by name or email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-2">
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Roles</option>
              <option value="owner">Owner</option>
              <option value="org_admin">Org Admin</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="client">Client</option>
            </select>
          </div>
          
          {/* Organization Filter (for multi-org view) */}
          {permissions?.canViewAllOrganizations && (
            <div className="sm:col-span-3">
              <select
                value={filters.organization}
                onChange={(e) => handleFilterChange('organization', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Organizations</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="sm:col-span-1">
            {(filters.search || filters.role || filters.organization || filters.status !== 'all') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Clear
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
                  onClick={() => fetchUsers()}
                  className="bg-red-100 px-3 py-1 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="mt-6 bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.search || filters.role || filters.organization || filters.status !== 'all'
                ? 'Try adjusting your search filters.' 
                : 'Get started by inviting a user to your organization.'
              }
            </p>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  {permissions?.canViewAllOrganizations && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {user.display_name?.[0] || user.first_name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.display_name || 
                             (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : null) ||
                             user.email ||
                             'Unknown User'
                            }
                          </div>
                          {user.email && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {user.email}
                              {user.email_verified === false && (
                                <span className="ml-2 text-xs text-orange-600">(unverified)</span>
                              )}
                            </div>
                          )}
                          {user.wallet_address && (
                            <div className="text-xs text-gray-400 font-mono">
                              {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Organization Column (for multi-org view) */}
                    {permissions?.canViewAllOrganizations && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{user.organization_name}</span>
                        </div>
                      </td>
                    )}
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        user.is_active 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      )}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login_at ? (
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(user.last_login_at)}
                        </span>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => handleUserAction('view', user)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="View user details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {permissions?.canRemoveUsers && user.id !== permissions.user.id && (
                          <button 
                            onClick={() => handleRemoveUser(user)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Remove user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
                      onClick={() => fetchUsers(pagination.page - 1)}
                      disabled={!pagination.has_prev}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchUsers(pagination.page + 1)}
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

      {/* User Details Modal */}
      <UserDetailsModal
        user={actionModal.user}
        organization={activeOrganization || undefined}
        isOpen={actionModal.isOpen && actionModal.type === 'view'}
        onClose={() => setActionModal({ isOpen: false, type: null, user: null })}
        onRemove={handleRemoveUser}
      />

      {/* User Invite Modal */}
      <UserInviteModal
        organization={activeOrganization || undefined}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={async (data) => {
          await orgActions.inviteUser(data);
          await fetchUsers(); // Refresh the users list
          setShowInviteModal(false);
        }}
      />
    </div>
  );
}