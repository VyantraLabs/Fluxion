'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { OrganizationSelector } from '@/components/admin/OrganizationSelector'
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers'
import { useUserOrganizations } from '@/hooks/useUserOrganizations'
import { AdminUser, FilterParams } from '@/types/admin'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'

export default function OrganizationUsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  
  // Get organization ID from URL params
  const orgFromUrl = searchParams.get('org')
  
  // User organizations management
  const {
    organizations,
    selectedOrganizationId,
    isLoading: orgsLoading,
    error: orgsError,
    refresh: refreshOrgs,
    selectOrganization,
  } = useUserOrganizations(orgFromUrl || undefined)
  
  // Organization users management
  const {
    users,
    pagination,
    isLoading: usersLoading,
    error: usersError,
    page,
    limit,
    filters,
    refresh: refreshUsers,
    changePage,
    changeLimit,
    updateFilters,
    clearFilters,
  } = useOrganizationUsers(selectedOrganizationId || undefined, 1, 20, {})

  // Handle organization change
  const handleOrganizationChange = (organizationId: string) => {
    selectOrganization(organizationId)
    
    // Update URL
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set('org', organizationId)
    router.push(`/users?${newSearchParams.toString()}`)
  }

  // Update URL when organization is auto-selected
  useEffect(() => {
    if (selectedOrganizationId && selectedOrganizationId !== orgFromUrl) {
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.set('org', selectedOrganizationId)
      router.replace(`/users?${newSearchParams.toString()}`)
    }
  }, [selectedOrganizationId, orgFromUrl, searchParams, router])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const newFilters: FilterParams = {
      ...filters,
      search: searchTerm || undefined,
    }
    updateFilters(newFilters)
  }

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role)
    const newFilters: FilterParams = {
      ...filters,
      role: role || undefined,
    }
    updateFilters(newFilters)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setRoleFilter('')
    clearFilters()
  }

  const handleRefresh = () => {
    refreshOrgs()
    refreshUsers()
  }

  const getRoleBadge = (user: AdminUser) => {
    // Check for system roles first (highest priority)
    if (user.system_roles?.includes('super_admin')) {
      return (
        <div className="flex items-center space-x-1">
          <ShieldExclamationIcon className="w-3 h-3 text-red-500" />
          <span className="admin-badge-error">Super Admin</span>
        </div>
      )
    }
    
    if (user.system_roles?.includes('admin')) {
      return (
        <div className="flex items-center space-x-1">
          <ShieldCheckIcon className="w-3 h-3 text-blue-500" />
          <span className="admin-badge-info">System Admin</span>
        </div>
      )
    }

    // Check for organization roles
    const primaryOrgRole = user.organization_roles?.[0]
    if (primaryOrgRole) {
      switch (primaryOrgRole) {
        case 'owner':
          return (
            <div className="flex items-center space-x-1">
              <ShieldCheckIcon className="w-3 h-3 text-purple-500" />
              <span className="admin-badge-warning">Owner</span>
            </div>
          )
        case 'admin':
          return (
            <div className="flex items-center space-x-1">
              <ShieldCheckIcon className="w-3 h-3 text-blue-500" />
              <span className="admin-badge-info">Admin</span>
            </div>
          )
        case 'member':
          return (
            <div className="flex items-center space-x-1">
              <UserIcon className="w-3 h-3 text-gray-500" />
              <span className="admin-badge-neutral">Member</span>
            </div>
          )
        case 'viewer':
          return (
            <div className="flex items-center space-x-1">
              <UserIcon className="w-3 h-3 text-gray-400" />
              <span className="admin-badge-neutral">Viewer</span>
            </div>
          )
      }
    }
    
    return (
      <div className="flex items-center space-x-1">
        <UserIcon className="w-3 h-3 text-gray-500" />
        <span className="admin-badge-neutral">User</span>
      </div>
    )
  }

  const formatWalletAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'displayName',
      title: 'User',
      sortable: true,
      render: (value, user) => (
        <div>
          <div className="font-medium text-gray-900">
            {user.display_name || (user.first_name && user.last_name)
              ? user.display_name || `${user.first_name} ${user.last_name}` 
              : formatWalletAddress(user.wallet_address)}
          </div>
          {user.email && (
            <div className="text-sm text-gray-500">{user.email}</div>
          )}
          <div className="text-xs text-gray-400">
            Wallet: {formatWalletAddress(user.wallet_address)}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      title: 'Role',
      render: (_, user) => getRoleBadge(user),
      width: '32',
    },
    {
      key: 'created_at',
      title: 'Joined',
      render: (value) => (
        <span className="text-sm text-gray-500">
          {value && !isNaN(new Date(value).getTime()) 
            ? formatDistanceToNow(new Date(value), { addSuffix: true })
            : 'N/A'
          }
        </span>
      ),
      width: '32',
    },
    {
      key: 'last_login_at',
      title: 'Last Login',
      render: (value) => (
        <span className="text-sm text-gray-500">
          {value && !isNaN(new Date(value).getTime())
            ? formatDistanceToNow(new Date(value), { addSuffix: true })
            : 'Never'
          }
        </span>
      ),
      width: '32',
    },
  ]

  const hasActiveFilters = searchTerm || roleFilter
  const isLoading = orgsLoading || usersLoading
  const error = orgsError || usersError

  // Get selected organization name for title
  const selectedOrganization = organizations.find(org => org.id === selectedOrganizationId)
  const pageTitle = selectedOrganization 
    ? `Users in ${selectedOrganization.name}` 
    : 'Organization Users'

  // Don't render anything if we're still loading organizations initially
  if (orgsLoading && organizations.length === 0) {
    return (
      <ErrorBoundary>
        <AdminLayout
          title="Loading Organizations..."
          subtitle="Please wait while we load your organizations"
        >
          <div className="admin-card p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading your organizations...</p>
          </div>
        </AdminLayout>
      </ErrorBoundary>
    )
  }

  // Handle case where user has no organizations
  if (!orgsLoading && organizations.length === 0 && !orgsError) {
    return (
      <ErrorBoundary>
        <AdminLayout
          title="No Organizations Available"
          subtitle="You do not have access to manage users in any organizations"
        >
          <div className="admin-card p-8 text-center">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Organizations Found</h3>
            <p className="text-gray-600 mb-4">
              You do not have permission to manage users in any organizations.
            </p>
            <p className="text-sm text-gray-500">
              Contact your administrator to get access to organization user management.
            </p>
          </div>
        </AdminLayout>
      </ErrorBoundary>
    )
  }

  // Handle organization loading error
  if (orgsError && organizations.length === 0) {
    return (
      <ErrorBoundary>
        <AdminLayout
          title="Error Loading Organizations"
          subtitle="Unable to load your organizations"
        >
          <div className="admin-card p-8 text-center">
            <ShieldExclamationIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Organizations</h3>
            <p className="text-red-600 mb-4">{orgsError}</p>
            <button
              onClick={handleRefresh}
              className="admin-button-primary"
            >
              Try Again
            </button>
          </div>
        </AdminLayout>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <AdminLayout
        title={pageTitle}
        subtitle="View and manage team members across your organizations"
      >
      {/* Organization Selector */}
      <div className="admin-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Select Organization</h3>
          {organizations.length > 1 && (
            <span className="text-sm text-gray-500">
              You have access to {organizations.length} organizations
            </span>
          )}
        </div>
        
        <OrganizationSelector
          organizations={organizations}
          selectedOrganizationId={selectedOrganizationId}
          onOrganizationChange={handleOrganizationChange}
          loading={orgsLoading}
          error={orgsError}
        />
        
        {/* Show organization context info */}
        {selectedOrganization && (
          <div className="mt-3 text-sm text-gray-600">
            <span className="font-medium">Selected:</span> {selectedOrganization.name} •{' '}
            <span className="capitalize">{selectedOrganization.role}</span> access •{' '}
            {selectedOrganization.userCount} users
          </div>
        )}
      </div>
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
                  placeholder="Search users by wallet address or email..."
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
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          {/* Actions */}
          <div className="sm:col-span-3 flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="admin-button-secondary flex items-center"
            >
              <ArrowPathIcon className={clsx('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
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
            {roleFilter && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Role: {roleFilter.replace('_', ' ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {usersError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-start">
            <ShieldExclamationIcon className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-red-800 mb-1">Unable to Load Users</div>
              <div className="text-sm text-red-700">{usersError}</div>
              {!usersError.includes('No organization selected') && (
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No organization selected state */}
      {!selectedOrganizationId && !orgsLoading && organizations.length > 0 && (
        <div className="admin-card p-8 text-center">
          <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Organization</h3>
          <p className="text-gray-600">
            Please select an organization from the dropdown above to view its users.
          </p>
        </div>
      )}

      {/* Users Table - Only show when organization is selected */}
      {selectedOrganizationId && (
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(user) => user.id}
          loading={usersLoading}
          emptyMessage={selectedOrganization 
            ? `No team members found in ${selectedOrganization.name}` 
            : "No team members found"
          }
          className="mb-6"
        />
      )}

      {/* Pagination - Only show when organization is selected and there's pagination data */}
      {selectedOrganizationId && pagination && pagination.pages > 1 && (
        <div className="admin-card p-4">
          <Pagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            pages={pagination.pages}
            hasNext={pagination.has_next}
            hasPrev={pagination.has_prev}
            onPageChange={changePage}
            onLimitChange={changeLimit}
          />
        </div>
      )}
      </AdminLayout>
    </ErrorBoundary>
  )
}