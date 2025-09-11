'use client'

import React from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatisticsCard } from '@/components/admin/StatisticsCard'
import { SystemHealthWidget } from '@/components/admin/SystemHealthWidget'
import { useSystemStats } from '@/hooks/useSystemStats'
import { useSystemRole } from '@/hooks/useSystemRole'
import adminApi from '@/services/adminApi'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  UsersIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ServerIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

export default function AdminDashboard() {
  const { stats, health, isLoading, error, refresh } = useSystemStats()
  const { 
    canToggleMaintenance, 
    canViewSystemStats, 
    canViewSystemHealth,
    canViewUsers,
    canViewOrganizations,
    canListTemplates,
    canViewActivityLogs,
    isSystemSuperAdmin
  } = useSystemRole()
  const [maintenanceToggling, setMaintenanceToggling] = React.useState(false)

  const handleMaintenanceToggle = async () => {
    try {
      setMaintenanceToggling(true)
      // TODO: Add maintenance mode support to backend
      const newMode = false // !stats?.system.maintenance_mode
      
      const response = await adminApi.toggleMaintenanceMode(newMode)
      
      if (response.success) {
        toast.success(
          newMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
        )
        refresh() // Refresh stats to get updated maintenance mode
      }
    } catch (error: any) {
      console.error('Error toggling maintenance mode:', error)
      toast.error('Failed to toggle maintenance mode')
    } finally {
      setMaintenanceToggling(false)
    }
  }

  const refreshButton = (
    <button
      onClick={refresh}
      disabled={isLoading}
      className="admin-button-secondary"
    >
      {isLoading ? 'Refreshing...' : 'Refresh'}
    </button>
  )

  const maintenanceButton = canToggleMaintenance() ? (
    <button
      onClick={handleMaintenanceToggle}
      disabled={maintenanceToggling}
      className={clsx(
        'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        false // TODO: Add maintenance mode support
          ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
          : 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500'
      )}
    >
      {maintenanceToggling 
        ? 'Updating...' 
        : false // TODO: Add maintenance mode support 
          ? 'Disable Maintenance'
          : 'Enable Maintenance'
      }
    </button>
  ) : null

  return (
    <AdminLayout
      title="System Dashboard"
      subtitle="Platform overview and system statistics"
      requiredPermissions={['system:stats:read']}
      actions={
        <div className="flex items-center space-x-3">
          {maintenanceButton}
          {refreshButton}
        </div>
      }
    >
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading dashboard data
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
              <div className="mt-3">
                <button
                  onClick={refresh}
                  className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Mode Alert */}
      {false && ( // TODO: Add maintenance mode support
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Maintenance Mode Active
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                The system is currently in maintenance mode. New user registrations and certain operations may be disabled.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Users Statistics */}
        <StatisticsCard
          title="Total Users"
          value={stats?.users.total || 0}
          subtitle={`${stats?.users.active || 0} active • ${stats?.users.adminUsers || 0} admins`}
          icon={UsersIcon}
          loading={isLoading}
        />

        {/* Organizations Statistics */}
        <StatisticsCard
          title="Organizations"
          value={stats?.organizations.total || 0}
          subtitle={`${stats?.organizations.active || 0} active • ${stats?.organizations.thisMonth || 0} this month`}
          icon={BuildingOfficeIcon}
          loading={isLoading}
        />

        {/* Invoices Statistics */}
        <StatisticsCard
          title="Total Invoices"
          value={stats?.invoices.total || 0}
          subtitle={`${stats?.invoices.totalValue || '$0'} total • ${stats?.invoices.thisMonth || 0} this month`}
          icon={DocumentTextIcon}
          loading={isLoading}
        />

        {/* Payments Statistics */}
        <StatisticsCard
          title="Payment Volume"
          value={stats?.payments.totalValue || '$0'}
          subtitle={`${stats?.payments.total || 0} transactions • ${Math.round(stats?.payments.successRate || 0)}% success rate`}
          icon={CurrencyDollarIcon}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Health */}
        <SystemHealthWidget health={health} loading={isLoading} />

        {/* System Information */}
        <div className="admin-card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">System Status</span>
              <span className={clsx(
                'admin-badge',
                health?.status === 'healthy' ? 'admin-badge-success' :
                health?.status === 'degraded' ? 'admin-badge-warning' :
                health?.status === 'down' ? 'admin-badge-error' :
                'admin-badge-error'
              )}>
                {health?.status || 'Unknown'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Maintenance Mode</span>
              <span className={clsx(
                'admin-badge',
                false ? 'admin-badge-warning' : 'admin-badge-success' // TODO: Add maintenance mode support
              )}>
                {'Disabled'} {/* TODO: Add maintenance mode support */}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">System Uptime</span>
              <span className="text-sm text-gray-900">
                {stats?.systemHealth.uptime ? `${Math.floor(stats.systemHealth.uptime / 3600)}h ${Math.floor((stats.systemHealth.uptime % 3600) / 60)}m` : 'Unknown'}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              {canViewUsers() && (
                <button 
                  onClick={() => window.location.href = '/users'}
                  className="admin-button-secondary text-center"
                >
                  Manage Users
                </button>
              )}
              
              {canViewOrganizations() && (
                <button 
                  onClick={() => window.location.href = '/organizations'}
                  className="admin-button-secondary text-center"
                >
                  View Organizations
                </button>
              )}
              
              {canListTemplates() && (
                <button 
                  onClick={() => window.location.href = '/templates'}
                  className="admin-button-secondary text-center"
                >
                  System Templates
                </button>
              )}
              
              {canViewActivityLogs() && (
                <button 
                  onClick={() => window.location.href = '/activity'}
                  className="admin-button-secondary text-center"
                >
                  Activity Logs
                </button>
              )}
              
              {/* System Test Link - Only for System Super Admins */}
              {isSystemSuperAdmin && (
                <button 
                  onClick={() => window.location.href = '/system-test'}
                  className="admin-button-primary text-center"
                >
                  System Test
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}