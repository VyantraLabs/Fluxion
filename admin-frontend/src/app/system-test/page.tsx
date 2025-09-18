'use client'

import React from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { useSystemRole } from '@/hooks/useSystemRole'
import { 
  getSystemRoleDisplayName, 
  getSystemRoleBadgeColor, 
  getUserSystemPermissions,
  hasSystemAccess 
} from '@/utils/systemRoles'
import { SystemRole, SystemPermission } from '@/types/admin'
import clsx from 'clsx'

export default function SystemTestPage() {
  const { user } = useAdminAuth()
  const {
    isSystemSuperAdmin,
    isSystemAdmin,
    isSystemSupport,
    isSystemModerator,
    systemRoles,
    allPermissions,
    checkSystemPermission,
    checkRole,
    hasAccess,
  } = useSystemRole()

  const testPermissions: SystemPermission[] = [
    'system:stats:read',
    'system:health:read',
    'system:maintenance:toggle',
    'system:settings:read',
    'system:settings:write',
    'organizations:list',
    'organizations:suspend',
    'users:admin_status:update',
    'content:moderate',
    'support:tickets:respond',
  ]

  const testRoles: string[] = [
    'super_admin',
    'admin',
    'support',
    'moderator',
  ]

  return (
    <AdminLayout title="System Role Test" subtitle="Verify role-based access control">
      <div className="space-y-8">
        {/* User Info Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current User Information</h3>
          
          {user && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Wallet Address</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{user.wallet_address}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">System Access</label>
                  <p className="mt-1">
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      hasAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    )}>
                      {hasAccess ? '✓ Granted' : '✗ Denied'}
                    </span>
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Organization Roles</label>
                  <div className="mt-1">
                    {(user as any).organization_roles && (user as any).organization_roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(user as any).organization_roles.map((role: string, index: number) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No organization roles</span>
                    )}
                  </div>
                </div>
              </div>

              {/* System Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">System Roles</label>
                {systemRoles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {systemRoles.map((role: string) => (
                      <span
                        key={role}
                        className={clsx(
                          'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
                          getSystemRoleBadgeColor(role)
                        )}
                      >
                        {getSystemRoleDisplayName(role)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No system roles assigned</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role Checks Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Role Checks</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {testRoles.map((role) => {
              const hasRole = checkRole(role as any)
              return (
                <div key={role} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      {getSystemRoleDisplayName(role)}
                    </h4>
                    <span className={clsx(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      hasRole ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    )}>
                      {hasRole ? '✓' : '✗'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {hasRole ? 'Access granted' : 'No access'}
                  </p>
                </div>
              )
            })}
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
              <div className="text-sm font-medium text-blue-900 mb-1">Super Admin</div>
              <div className={clsx(
                'text-lg font-bold',
                isSystemSuperAdmin ? 'text-green-600' : 'text-gray-400'
              )}>
                {isSystemSuperAdmin ? '✓ YES' : '✗ NO'}
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 bg-purple-50">
              <div className="text-sm font-medium text-purple-900 mb-1">System Admin</div>
              <div className={clsx(
                'text-lg font-bold',
                isSystemAdmin ? 'text-green-600' : 'text-gray-400'
              )}>
                {isSystemAdmin ? '✓ YES' : '✗ NO'}
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
              <div className="text-sm font-medium text-blue-900 mb-1">Support</div>
              <div className={clsx(
                'text-lg font-bold',
                isSystemSupport ? 'text-green-600' : 'text-gray-400'
              )}>
                {isSystemSupport ? '✓ YES' : '✗ NO'}
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
              <div className="text-sm font-medium text-green-900 mb-1">Moderator</div>
              <div className={clsx(
                'text-lg font-bold',
                isSystemModerator ? 'text-green-600' : 'text-gray-400'
              )}>
                {isSystemModerator ? '✓ YES' : '✗ NO'}
              </div>
            </div>
          </div>
        </div>

        {/* Permission Checks Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Permission Checks
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({allPermissions.length} total permissions)
            </span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testPermissions.map((permission) => {
              const hasPermission = checkSystemPermission(permission)
              return (
                <div 
                  key={permission} 
                  className={clsx(
                    'border rounded-lg p-4',
                    hasPermission 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 font-mono">
                      {permission}
                    </h4>
                    <span className={clsx(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      hasPermission 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    )}>
                      {hasPermission ? '✓ Allowed' : '✗ Denied'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* All User Permissions */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">All User Permissions</h3>
          
          {allPermissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {allPermissions.map((permission) => (
                <div
                  key={permission}
                  className="inline-flex items-center px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <span className="text-xs font-mono text-blue-800">{permission}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No permissions available</p>
          )}
        </div>

        {/* Debug Information */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Debug Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Raw User Data</label>
              <pre className="bg-gray-800 text-green-300 text-xs p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">System Role Hook State</label>
              <pre className="bg-gray-800 text-green-300 text-xs p-4 rounded-lg overflow-x-auto">
                {JSON.stringify({
                  hasAccess,
                  isSystemSuperAdmin,
                  isSystemAdmin, 
                  isSystemSupport,
                  isSystemModerator,
                  systemRoles,
                  totalPermissions: allPermissions.length,
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}