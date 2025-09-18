'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Organization, FilterParams } from '@/types/admin'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

export default function OrganizationsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  const {
    organizations,
    pagination,
    isLoading,
    error,
    page,
    limit,
    filters,
    refresh,
    changePage,
    changeLimit,
    updateFilters,
    clearFilters,
  } = useOrganizations()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const newFilters: FilterParams = {
      ...filters,
      search: searchTerm || undefined,
    }
    updateFilters(newFilters)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    const newFilters: FilterParams = {
      ...filters,
      status: status || undefined,
    }
    updateFilters(newFilters)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    clearFilters()
  }

  const handleRowClick = (organization: Organization) => {
    router.push(`/organizations/${organization.id}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="admin-badge-success">Active</span>
      case 'suspended':
        return <span className="admin-badge-warning">Suspended</span>
      case 'inactive':
        return <span className="admin-badge-error">Inactive</span>
      default:
        return <span className="admin-badge-info">{status}</span>
    }
  }

  const columns: Column<Organization>[] = [
    {
      key: 'name',
      title: 'Organization Name',
      sortable: true,
      render: (value, org) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">ID: {org.id}</div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (value) => getStatusBadge(value),
      width: '32',
    },
    {
      key: 'user_count',
      title: 'Users',
      render: (value) => (
        <span className="text-sm font-medium">{value?.toLocaleString() || 0}</span>
      ),
      width: '24',
    },
    {
      key: 'invoice_count',
      title: 'Invoices',
      render: (value) => (
        <span className="text-sm font-medium">{value?.toLocaleString() || 0}</span>
      ),
      width: '24',
    },
    {
      key: 'total_revenue',
      title: 'Revenue',
      render: (value) => (
        <span className="text-sm font-medium">{value || '$0.00'}</span>
      ),
      width: '32',
    },
    {
      key: 'created_at',
      title: 'Created',
      render: (value) => (
        <span className="text-sm text-gray-500">
          {formatDistanceToNow(new Date(value), { addSuffix: true })}
        </span>
      ),
      width: '32',
    },
  ]

  const hasActiveFilters = searchTerm || statusFilter

  return (
    <ErrorBoundary>
      <AdminLayout
        title="Organizations"
        subtitle="Manage organizations and view their statistics"
        requiredPermissions={["organizations:read"]}
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
                  placeholder="Search organizations..."
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

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="admin-input"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Actions */}
          <div className="sm:col-span-3 flex items-center space-x-2">
            <button
              onClick={refresh}
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
            {statusFilter && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Status: {statusFilter}
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
            onClick={refresh}
            className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Organizations Table */}
      <DataTable
        columns={columns}
        data={organizations}
        keyExtractor={(org) => org.id}
        loading={isLoading}
        emptyMessage="No organizations found"
        onRowClick={handleRowClick}
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
            onPageChange={changePage}
            onLimitChange={changeLimit}
          />
        </div>
      )}
      </AdminLayout>
    </ErrorBoundary>
  )
}