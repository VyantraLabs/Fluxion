'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { RoleBadge } from '@/components/admin/RoleBadge'
import { RoleManager } from '@/components/admin/RoleManager'
import { PermissionIndicator } from '@/components/admin/PermissionIndicator'
import { ConfirmationModal } from '@/components/admin/ConfirmationModal'
import { LoadingState } from '@/components/admin/LoadingSpinner'
import { adminApi } from '@/services/adminApi'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  EyeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

interface OrganizationUser {
  id: string
  name?: string
  email?: string
  wallet_address: string
  created_at: string
  last_login_at?: string
  roles: Array<{
    id: string
    name: string
    type: 'system' | 'organization'
    description?: string
  }>
  stats: {
    invoice_count: number
    payment_count: number
    total_revenue: string
    last_activity_at?: string
  }
}

interface Organization {
  id: string
  name: string
  slug: string
  status: string
}

export default function OrganizationUsersPage() {
  const params = useParams()
  const router = useRouter()
  const organizationId = params.id as string

  // State management
  const [users, setUsers] = useState<OrganizationUser[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<OrganizationUser | null>(null)
  const [showRoleManager, setShowRoleManager] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [removeReason, setRemoveReason] = useState('')

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
      // Fetch organization details
      const orgResponse = await adminApi.getOrganization(organizationId)
      if (orgResponse.success) {
        setOrganization(orgResponse.data)
      }

      // Fetch organization users
      const params = {
        limit,
        offset: (page - 1) * limit,
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter && { role: roleFilter })
      }

      const usersResponse = await adminApi.getOrganizationUsers(organizationId, params)
      
      if (usersResponse.success) {
        setUsers(usersResponse.data.users || [])
        setPagination(prev => ({
          ...prev,
          page,
          limit,
          total: usersResponse.data.pagination?.total || 0,
          pages: Math.ceil((usersResponse.data.pagination?.total || 0) / limit),
          has_next: page * limit < (usersResponse.data.pagination?.total || 0),
          has_prev: page > 1
        }))
        setError(null)
      } else {
        throw new Error(usersResponse.error?.message || 'Failed to fetch users')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) {
      fetchData()
    }
  }, [organizationId])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(1, pagination.limit)
  }

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role)
    fetchData(1, pagination.limit)
  }

  const handleRemoveUser = (user: OrganizationUser) => {
    setSelectedUser(user)
    setShowRemoveConfirm(true)
  }

  const confirmRemoveUser = async (reason?: string) => {
    if (!selectedUser) return

    try {
      const response = await adminApi.removeUserFromOrganization(
        selectedUser.id,
        organizationId,
        reason || 'Removed by admin'
      )

      if (response.success) {
        toast.success('User removed from organization successfully')
        fetchData(pagination.page, pagination.limit)
      } else {
        throw new Error(response.error?.message || 'Failed to remove user')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove user'
      toast.error(message)
      throw err
    }
  }

  const handleRoleChange = (user: OrganizationUser, newRoles: any[]) => {
    // Update user in local state
    setUsers(prev => 
      prev.map(u => 
        u.id === user.id 
          ? { ...u, roles: newRoles }
          : u
      )
    )
    toast.success('User roles updated successfully')
  }

  const handleViewUser = (user: OrganizationUser) => {
    router.push(`/users/${user.id}`)
  }

  const handleUserActivity = (user: OrganizationUser) => {
    router.push(`/users/${user.id}/activity`)
  }

  const columns: Column<OrganizationUser>[] = [
    {
      key: 'name',
      title: 'User',
      render: (value, user) => (
        <div>
          <div className="font-medium text-gray-900">
            {value || 'Unnamed User'}
          </div>
          <div className="text-sm text-gray-500">
            {user.wallet_address?.slice(0, 8)}...{user.wallet_address?.slice(-6)}
          </div>
          {user.email && (
            <div className="text-sm text-gray-500">{user.email}</div>
          )}
        </div>
      ),
    },
    {
      key: 'roles',
      title: 'Roles',
      render: (value, user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles?.map((role) => (
            <RoleBadge
              key={role.id}
              role={role.name}
              type={role.type}
              showPrefix={false}
            />
          )) || <span className="text-sm text-gray-500">No roles</span>}
        </div>
      ),
      width: '32'
    },
    {
      key: 'stats',
      title: 'Activity',
      render: (value, user) => (
        <div className="text-sm">
          <div className="text-gray-900">{user.stats.invoice_count} invoices</div>
          <div className="text-gray-500">{user.stats.total_revenue}</div>
          {user.stats.last_activity_at && (
            <div className="text-gray-400">
              Active {formatDistanceToNow(new Date(user.stats.last_activity_at), { addSuffix: true })}
            </div>
          )}
        </div>
      ),
      width: '32'
    },
    {
      key: 'created_at',
      title: 'Joined',
      render: (value) => (
        <span className="text-sm text-gray-500">
          {formatDistanceToNow(new Date(value), { addSuffix: true })}
        </span>
      ),
      width: '24'
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
            onClick={() => {
              setSelectedUser(user)
              setShowRoleManager(true)
            }}
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
            onClick={() => handleRemoveUser(user)}
            className="text-red-600 hover:text-red-800"
            title="Remove from Organization"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      width: '24'
    }
  ]

  const hasActiveFilters = searchTerm || roleFilter

  return (
    <ErrorBoundary>
      <AdminLayout
        title={`${organization?.name || 'Organization'} Users`}
        subtitle={`Manage users and roles for ${organization?.name || 'this organization'}`}
        requiredPermissions={["organizations:read"]}
      >
        {/* Organization Header */}
        {organization && (
          <div className="admin-card p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{organization.name}</h2>
                <p className="text-gray-500">Organization ID: {organization.id}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.push(`/organizations/${organizationId}/activity`)}
                  className="admin-button-secondary flex items-center"
                >
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  View Activity
                </button>
                <button
                  onClick={() => router.push('/organizations')}
                  className="admin-button-primary"
                >
                  Back to Organizations
                </button>
              </div>
            </div>
          </div>
        )}

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
                    placeholder="Search users by name, email, or wallet..."
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
            <div className="sm:col-span-3">
              <select
                value={roleFilter}
                onChange={(e) => handleRoleFilter(e.target.value)}
                className="admin-input"
              >
                <option value="">All Roles</option>
                <option value="owner">Owner</option>
                <option value="organization_admin">Admin</option>
                <option value="organization_support">Support</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {/* Actions */}
            <div className="sm:col-span-3 flex items-center space-x-2">
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
                  onClick={() => {
                    setSearchTerm('')
                    setRoleFilter('')
                    fetchData(1, pagination.limit)
                  }}
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
              {roleFilter && (
                <span className="admin-badge bg-primary-100 text-primary-800">
                  Role: {roleFilter}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content with Loading State */}
        <LoadingState
          loading={loading}
          error={error}
          errorAction={() => fetchData(pagination.page, pagination.limit)}
        >

        {/* Users Table */}
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(user) => user.id}
          loading={loading}
          emptyMessage="No users found in this organization"
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
                organizationId={organizationId}
                currentRoles={selectedUser.roles}
                canModify={true}
                onRoleChange={(newRoles) => handleRoleChange(selectedUser, newRoles)}
              />
            </div>
          </div>
        )}

        {/* Remove User Confirmation Modal */}
        <ConfirmationModal
          isOpen={showRemoveConfirm}
          onClose={() => {
            setShowRemoveConfirm(false)
            setSelectedUser(null)
          }}
          onConfirm={confirmRemoveUser}
          title="Remove User from Organization"
          message={`Are you sure you want to remove ${selectedUser?.name || selectedUser?.wallet_address} from this organization? This action cannot be undone.`}
          confirmText="Remove User"
          variant="danger"
          requireReason={true}
        />
        </LoadingState>
      </AdminLayout>
    </ErrorBoundary>
  )
}