'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Pagination } from '@/components/tables/Pagination'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { RoleBadge } from '@/components/admin/RoleBadge'
import { adminApi } from '@/services/adminApi'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  EyeIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'

interface AuditLog {
  id: string
  action: string
  tableName?: string
  recordId?: string
  userId?: string
  organizationId?: string
  userEmail?: string
  userName?: string
  organizationName?: string
  ipAddress?: string
  userAgent?: string
  severityLevel: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, any>
  created_at: string
  changesSummary?: string
}

export default function AuditLogsPage() {
  const router = useRouter()
  
  // State management
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false)
  const [highRiskOnlyFilter, setHighRiskOnlyFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showLogDetails, setShowLogDetails] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
    has_next: false,
    has_prev: false
  })

  const fetchData = async (page = 1, limit = 50) => {
    setLoading(true)
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
        ...(searchTerm && { search: searchTerm }),
        ...(actionFilter && { action: actionFilter }),
        ...(severityFilter && { severityLevel: severityFilter }),
        ...(adminOnlyFilter && { adminOnly: true }),
        ...(highRiskOnlyFilter && { highRiskOnly: true }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      }

      const response = await adminApi.getActivityLogs(params)
      
      if (response.success) {
        setLogs(response.data.logs || [])
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
        throw new Error(response.error?.message || 'Failed to fetch audit logs')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch audit logs'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchData(pagination.page, pagination.limit)
      }, 30000) // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, pagination.page, pagination.limit])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(1, pagination.limit)
  }

  const handleActionFilter = (action: string) => {
    setActionFilter(action)
    fetchData(1, pagination.limit)
  }

  const handleSeverityFilter = (severity: string) => {
    setSeverityFilter(severity)
    fetchData(1, pagination.limit)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setActionFilter('')
    setSeverityFilter('')
    setAdminOnlyFilter(false)
    setHighRiskOnlyFilter(false)
    setStartDate('')
    setEndDate('')
    fetchData(1, pagination.limit)
  }

  const handleViewLogDetails = (log: AuditLog) => {
    setSelectedLog(log)
    setShowLogDetails(true)
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="admin-badge-error">Critical</span>
      case 'high':
        return <span className="admin-badge-warning">High</span>
      case 'medium':
        return <span className="admin-badge-info">Medium</span>
      case 'low':
        return <span className="admin-badge-success">Low</span>
      default:
        return <span className="admin-badge-neutral">{severity}</span>
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes('delete') || action.includes('remove')) {
      return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
    }
    if (action.includes('admin') || action.includes('role')) {
      return <ShieldExclamationIcon className="h-4 w-4 text-yellow-500" />
    }
    if (action.includes('create') || action.includes('add')) {
      return <UserIcon className="h-4 w-4 text-green-500" />
    }
    return <ClockIcon className="h-4 w-4 text-gray-400" />
  }

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      title: 'Time',
      render: (value) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900">
            {formatDistanceToNow(new Date(value), { addSuffix: true })}
          </div>
          <div className="text-gray-500">
            {new Date(value).toLocaleString()}
          </div>
        </div>
      ),
      width: '32'
    },
    {
      key: 'action',
      title: 'Action',
      render: (value, log) => (
        <div className="flex items-center space-x-2">
          {getActionIcon(value)}
          <div>
            <div className="font-medium text-gray-900">{value}</div>
            {log.tableName && (
              <div className="text-sm text-gray-500">Table: {log.tableName}</div>
            )}
          </div>
        </div>
      ),
      width: '40'
    },
    {
      key: 'userEmail',
      title: 'User',
      render: (value, log) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900">
            {log.userName || value || 'System'}
          </div>
          {value && (
            <div className="text-gray-500">{value}</div>
          )}
          {log.userId && (
            <div className="text-gray-400 text-xs">ID: {log.userId.slice(0, 8)}...</div>
          )}
        </div>
      ),
      width: '32'
    },
    {
      key: 'organizationName',
      title: 'Organization',
      render: (value, log) => (
        <div className="text-sm">
          {value ? (
            <>
              <div className="font-medium text-gray-900">{value}</div>
              {log.organizationId && (
                <div className="text-gray-400 text-xs">ID: {log.organizationId.slice(0, 8)}...</div>
              )}
            </>
          ) : (
            <span className="text-gray-500">System Wide</span>
          )}
        </div>
      ),
      width: '32'
    },
    {
      key: 'severityLevel',
      title: 'Severity',
      render: (value) => getSeverityBadge(value),
      width: '24'
    },
    {
      key: 'changesSummary',
      title: 'Changes',
      render: (value, log) => (
        <div className="text-sm max-w-48">
          <div className="text-gray-900 truncate">
            {value || 'No summary available'}
          </div>
          {log.ipAddress && (
            <div className="text-gray-500 text-xs">IP: {log.ipAddress}</div>
          )}
        </div>
      ),
      width: '48'
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (value, log) => (
        <button
          onClick={() => handleViewLogDetails(log)}
          className="text-blue-600 hover:text-blue-800"
          title="View Details"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      ),
      width: '16'
    }
  ]

  const hasActiveFilters = searchTerm || actionFilter || severityFilter || adminOnlyFilter || highRiskOnlyFilter || startDate || endDate

  return (
    <ErrorBoundary>
      <AdminLayout
        title="Audit Logs"
        subtitle="Monitor system activity and security events across the platform"
        requiredPermissions={["audit:read"]}
      >
      {/* Controls */}
      <div className="admin-card p-6 mb-6">
        {/* Search and Date Range */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 mb-4">
          {/* Search */}
          <div className="sm:col-span-4">
            <form onSubmit={handleSearch} className="flex space-x-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user, action, or organization..."
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

          {/* Date Range */}
          <div className="sm:col-span-4">
            <div className="flex space-x-2">
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="admin-input flex-1"
                placeholder="Start Date"
              />
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="admin-input flex-1"
                placeholder="End Date"
              />
            </div>
          </div>

          {/* Auto Refresh Toggle */}
          <div className="sm:col-span-4 flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Auto Refresh (30s)</span>
            </label>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* Action Filter */}
          <div className="sm:col-span-3">
            <select
              value={actionFilter}
              onChange={(e) => handleActionFilter(e.target.value)}
              className="admin-input"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="admin">Admin Actions</option>
              <option value="role">Role Changes</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="sm:col-span-2">
            <select
              value={severityFilter}
              onChange={(e) => handleSeverityFilter(e.target.value)}
              className="admin-input"
            >
              <option value="">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Filter Checkboxes */}
          <div className="sm:col-span-4 flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={adminOnlyFilter}
                onChange={(e) => setAdminOnlyFilter(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Admin Only</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={highRiskOnlyFilter}
                onChange={(e) => setHighRiskOnlyFilter(e.target.checked)}
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">High Risk</span>
            </label>
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
            {actionFilter && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Action: {actionFilter}
              </span>
            )}
            {severityFilter && (
              <span className="admin-badge bg-primary-100 text-primary-800">
                Severity: {severityFilter}
              </span>
            )}
            {adminOnlyFilter && (
              <span className="admin-badge bg-blue-100 text-blue-800">
                Admin Only
              </span>
            )}
            {highRiskOnlyFilter && (
              <span className="admin-badge bg-red-100 text-red-800">
                High Risk Only
              </span>
            )}
            {startDate && (
              <span className="admin-badge bg-gray-100 text-gray-800">
                From: {new Date(startDate).toLocaleDateString()}
              </span>
            )}
            {endDate && (
              <span className="admin-badge bg-gray-100 text-gray-800">
                To: {new Date(endDate).toLocaleDateString()}
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

      {/* Audit Logs Table */}
      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={(log) => log.id}
        loading={loading}
        emptyMessage="No audit logs found"
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

      {/* Log Details Modal */}
      {showLogDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Audit Log Details
              </h3>
              <button
                onClick={() => {
                  setShowLogDetails(false)
                  setSelectedLog(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Action Details</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getActionIcon(selectedLog.action)}
                      <span className="font-medium">{selectedLog.action}</span>
                      {getSeverityBadge(selectedLog.severityLevel)}
                    </div>
                    {selectedLog.tableName && (
                      <p className="text-sm text-gray-600">Table: {selectedLog.tableName}</p>
                    )}
                    {selectedLog.recordId && (
                      <p className="text-sm text-gray-600">Record ID: {selectedLog.recordId}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Timestamp</h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-900">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(selectedLog.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>

              {/* User & Organization Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">User Information</h4>
                  <div className="space-y-1">
                    {selectedLog.userName && (
                      <p className="text-sm text-gray-900">Name: {selectedLog.userName}</p>
                    )}
                    {selectedLog.userEmail && (
                      <p className="text-sm text-gray-900">Email: {selectedLog.userEmail}</p>
                    )}
                    {selectedLog.userId && (
                      <p className="text-sm text-gray-600">ID: {selectedLog.userId}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Organization</h4>
                  <div className="space-y-1">
                    {selectedLog.organizationName ? (
                      <>
                        <p className="text-sm text-gray-900">{selectedLog.organizationName}</p>
                        <p className="text-sm text-gray-600">ID: {selectedLog.organizationId}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">System Wide</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Technical Details */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Technical Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.ipAddress && (
                    <p className="text-sm text-gray-600">IP Address: {selectedLog.ipAddress}</p>
                  )}
                  {selectedLog.userAgent && (
                    <p className="text-sm text-gray-600">User Agent: {selectedLog.userAgent}</p>
                  )}
                </div>
              </div>

              {/* Changes Summary */}
              {selectedLog.changesSummary && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Changes Summary</h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                    {selectedLog.changesSummary}
                  </p>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Metadata</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </AdminLayout>
    </ErrorBoundary>
  )
}