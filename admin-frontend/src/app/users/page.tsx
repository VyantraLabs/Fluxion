'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { RoleBadge } from '@/components/admin/RoleBadge'
import { RoleManager } from '@/components/admin/RoleManager'
import { PermissionIndicator } from '@/components/admin/PermissionIndicator'
import { adminApi } from '@/services/adminApi'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  EyeIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'

interface SystemUser {
  id: string
  displayName?: string
  email?: string
  wallet_address?: string
  created_at?: string
  last_login_at?: string
  organizationName?: string
  invoiceCount?: number
  totalPayments?: string
  roles: Array<{
    key: string
    type: 'system' | 'organization'
    organizationId?: string
  }>
}

export default function UsersPage() {
  const router = useRouter()
  
  // State management
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [organizationFilter, setOrganizationFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)
  const [showRoleManager, setShowRoleManager] = useState(false)
  const [showAdminStatus, setShowAdminStatus] = useState(false)

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
    has_next: false,
    has_prev: false
  })

  const fetchData = async (page = 1, limit = 25) => {
    setLoading(true)
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
        ...(searchTerm && { search: searchTerm }),
        ...(organizationFilter && { organizationId: organizationFilter }),
        ...(roleFilter && { role: roleFilter }),
        ...(adminOnlyFilter && { adminOnly: true })
      }

      const response = await adminApi.getUsers(params)
      
      if (response.success) {
        setUsers(response.data.users || [])
        setPagination(prev => ({
          ...prev,
          page,
          limit,
          total: response.data.pagination?.total || 0,
          pages: Math.ceil((response.data.pagination?.total || 0) / limit),
          has_next: page * limit < (response.data.pagination?.total || 0),
          has_prev: page > 1
        }))
        setError(null)
      } else {
        throw new Error(response.error?.message || 'Failed to fetch users')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(1, pagination.limit)
  }

  const handleOrganizationFilter = (organizationId: string) => {
    setOrganizationFilter(organizationId)
    fetchData(1, pagination.limit)
  }

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role)
    fetchData(1, pagination.limit)
  }

  const handleAdminFilter = (adminOnly: boolean) => {
    setAdminOnlyFilter(adminOnly)
    fetchData(1, pagination.limit)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setOrganizationFilter('')
    setRoleFilter('')
    setAdminOnlyFilter(false)
    fetchData(1, pagination.limit)
  }

  const handleViewUser = (user: SystemUser) => {
    router.push(`/users/${user.id}`)
  }

  const handleUserActivity = (user: SystemUser) => {
    router.push(`/users/${user.id}/activity`)
  }

  const handleManageRoles = (user: SystemUser) => {
    setSelectedUser(user)
    setShowRoleManager(true)
  }

  const handleManageAdminStatus = (user: SystemUser) => {
    setSelectedUser(user)
    setShowAdminStatus(true)
  }

  const handleRoleChange = (user: SystemUser, newRoles: any[]) => {
    setUsers(prev => 
      prev.map(u => 
        u.id === user.id 
          ? { ...u, roles: newRoles }
          : u
      )
    )
    toast.success('User roles updated successfully')
  }

  const handleAdminStatusUpdate = async (isAdmin: boolean, isSuperAdmin: boolean = false, reason?: string) => {
    if (!selectedUser) return

    try {
      const response = await adminApi.updateUserAdminStatus(selectedUser.id, {
        isAdmin,
        isSuperAdmin,
        reason
      })

      if (response.success) {
        setUsers(prev => 
          prev.map(u => 
            u.id === selectedUser.id 
              ? { ...u, isAdmin, isSuperAdmin }
              : u
          )
        )
        setShowAdminStatus(false)
        setSelectedUser(null)
        toast.success('Admin status updated successfully')
      } else {
        throw new Error(response.error?.message || 'Failed to update admin status')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update admin status'
      toast.error(message)
    }
  }

  const getStatusBadge = (user: SystemUser) => {
    // Check roles array for system roles
    const systemRoles = user.roles?.filter(role => role.type === 'system') || []
    
    if (systemRoles.some(role => role.key === 'super_admin')) {
      return <RoleBadge role="super_admin" type="system" />
    }
    if (systemRoles.some(role => role.key === 'admin')) {
      return <RoleBadge role="admin" type="system" />
    }
    if (systemRoles.some(role => role.key === 'support')) {
      return <RoleBadge role="support" type="system" />
    }
    return <span className="text-sm text-gray-500">Regular User</span>
  }

  const columns: Column<SystemUser>[] = [
    {
      key: 'displayName',
      title: 'User Details',
      sortable: true,
      render: (value, user) => (
        <div>
          <div className="font-medium text-gray-900">{value || user.email || 'Unnamed User'}</div>
          <div className="text-sm text-gray-500">
            {user.wallet_address?.slice(0, 8)}...{user.wallet_address?.slice(-6)}
          </div>
          {user.email && value !== user.email && (
            <div className="text-sm text-gray-500">{user.email}</div>
          )}
        </div>
      ),
    },
    {
      key: 'isAdmin',
      title: 'System Status',
      render: (value, user) => getStatusBadge(user),
      width: '32',
    },
    {
      key: 'roles',
      title: 'Roles',
      render: (value, user) => (
        <div className="flex flex-wrap gap-1 max-w-48">
          {user.roles?.slice(0, 3).map((role, index) => (
            <RoleBadge
              key={`${role.key}-${role.type}-${index}`}
              role={role.key}
              type={role.type}
              showPrefix={true}
            />
          )) || <span className="text-sm text-gray-500">No roles</span>}
          {user.roles && user.roles.length > 3 && (
            <span className="text-xs text-gray-500">+{user.roles.length - 3} more</span>
          )}
        </div>
      ),
      width: '40'
    },
    {
      key: 'organizations',
      title: 'Organization',
      render: (value, user) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 truncate max-w-32">
            {user.organizationName || 'No Organization'}
          </div>
          <div className="text-gray-500">
            {user.roles?.filter(role => role.type === 'organization').map(role => (
              <div key={role.key} className="text-xs">
                {role.key}
              </div>
            ))}
          </div>
        </div>
      ),
      width: '40'
    },
    {
      key: 'stats',
      title: 'Activity',
      render: (value, user) => (
        <div className="text-sm">
          <div className="text-gray-900">{user.invoiceCount || 0} invoices</div>
          <div className="text-gray-500">${user.totalPayments || '0'} payments</div>
          {user.last_login_at && (
            <div className="text-gray-400 text-xs">
              Login {formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })}
            </div>
          )}
        </div>
      ),
      width: '40'
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (value, user) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleViewUser(user)}
            className="text-blue-600 hover:text-blue-800"
            title="View User Details"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleManageRoles(user)}
            className="text-green-600 hover:text-green-800"
            title="Manage Roles"
          >
            <ShieldCheckIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleUserActivity(user)}
            className="text-purple-600 hover:text-purple-800"
            title="View Activity"
          >
            <ChartBarIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleManageAdminStatus(user)}
            className="text-orange-600 hover:text-orange-800"
            title="Manage Admin Status"
          >
            <UserGroupIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      width: '32'
    }
  ]

  const hasActiveFilters = searchTerm || organizationFilter || roleFilter || adminOnlyFilter

  return (
    <ErrorBoundary>
      <AdminLayout
        title="System Users"
        subtitle="Manage all users across the platform with their roles and organizations"
        requiredPermission="users:read"
      >
      {/* Filters */}
      <div className="admin-card p-6 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* Search */}
          <div className="sm:col-span-6">
            <form onSubmit={handleSearch} className="flex space-x-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or wallet address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="admin-input pl-10"
                />
              </div>
              <button type="submit" className="admin-button-primary">
                Search
              </button>
            </form>
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-2">
            <select
              value={roleFilter}
              onChange={(e) => handleRoleFilter(e.target.value)}
              className="admin-input"
            >
              <option value="">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="support">Support</option>
              <option value="moderator">Moderator</option>
              <option value="owner">Organization Owner</option>
              <option value="member">Member</option>
            </select>
          </div>

          {/* Admin Filter */}
          <div className="sm:col-span-2">
            <label className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white">
              <input
                type="checkbox"
                checked={adminOnlyFilter}
                onChange={(e) => handleAdminFilter(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Admin Users Only</span>
            </label>
          </div>

          {/* Actions */}
          <div className="sm:col-span-2 flex items-center space-x-2">
            <button
              onClick={() => fetchData(pagination.page, pagination.limit)}
              disabled={loading}
              className="admin-button-secondary flex items-center"
            >
              <ArrowPathIcon className={clsx('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </button>
            
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="admin-button-secondary flex items-center"
              >
                <FunnelIcon className="w-4 h-4 mr-2" />
                Clear
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center space-x-2 text-sm text-gray-600">
            <FunnelIcon className="w-4 h-4" />
            <span>Active filters:</span>
            {searchTerm && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Search: "{searchTerm}"
              </span>
            )}
            {organizationFilter && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Org: {organizationFilter}
              </span>
            )}
            {roleFilter && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Role: {roleFilter}
              </span>
            )}
            {adminOnlyFilter && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Admin Users Only
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-800">{error}</div>
          <button
            onClick={() => fetchData(pagination.page, pagination.limit)}
            className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={users}
        keyExtractor={(user) => user.id}
        loading={loading}
        emptyMessage="No users found"
        className="mb-6"
      />

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="admin-card p-4">
          <Pagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            pages={pagination.pages}
            hasNext={pagination.has_next}
            hasPrev={pagination.has_prev}
            onPageChange={(page) => fetchData(page, pagination.limit)}
            onLimitChange={(limit) => fetchData(1, limit)}
          />
        </div>
      )}

      {/* Role Manager Modal */}
      {showRoleManager && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Manage Roles - {selectedUser.name || selectedUser.wallet_address}
              </h3>
              <button
                onClick={() => {
                  setShowRoleManager(false)
                  setSelectedUser(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <RoleManager
              userId={selectedUser.id}
              currentRoles={selectedUser.roles}
              canModify={true}
              onRoleChange={(newRoles) => handleRoleChange(selectedUser, newRoles)}
            />
          </div>
        </div>
      )}

      {/* Admin Status Manager Modal */}
      {showAdminStatus && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Manage Admin Status
              </h3>
              <button
                onClick={() => {
                  setShowAdminStatus(false)
                  setSelectedUser(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  User: {selectedUser.name || selectedUser.wallet_address}
                </p>
                <p className="text-sm text-gray-500">
                  Current Status: {getStatusBadge(selectedUser)}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleAdminStatusUpdate(false, false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Regular User
                </button>
                <button
                  onClick={() => handleAdminStatusUpdate(true, false)}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                  Admin
                </button>
                <button
                  onClick={() => handleAdminStatusUpdate(true, true)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Super Admin
                </button>
              </div>

              <div className="text-xs text-gray-500">
                <p>⚠️ Super Admin: Full system access</p>
                <p>⚠️ Admin: System administration access</p>
                <p>ℹ️ Regular User: Standard user access</p>
              </div>
            </div>
          </div>
        </div>
      )}
      </AdminLayout>
    </ErrorBoundary>
  )
}