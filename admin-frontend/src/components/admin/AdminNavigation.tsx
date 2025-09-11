'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { useSystemRole } from '@/hooks/useSystemRole'
import { SystemRole, SystemPermission } from '@/types/admin'
import { getSystemRoleDisplayName, getSystemRoleBadgeColor } from '@/utils/systemRoles'
import clsx from 'clsx'
import {
  HomeIcon,
  BuildingOfficeIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    permission: 'system:stats:read' as SystemPermission,
  },
  {
    name: 'Organizations',
    href: '/organizations',
    icon: BuildingOfficeIcon,
    permission: 'organizations:list' as SystemPermission,
    roles: ['system_super_admin', 'system_admin'] as SystemRole[],
  },
  {
    name: 'Users',
    href: '/users',
    icon: UsersIcon,
    permission: 'users:list' as SystemPermission,
    roles: ['system_super_admin', 'system_admin', 'system_support'] as SystemRole[],
  },
  {
    name: 'Templates',
    href: '/templates',
    icon: DocumentTextIcon,
    permission: 'templates:list' as SystemPermission,
    roles: ['system_super_admin', 'system_admin'] as SystemRole[],
  },
  {
    name: 'Activity Logs',
    href: '/activity',
    icon: ClipboardDocumentListIcon,
    permission: 'activity_logs:read' as SystemPermission,
  },
  {
    name: 'System Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    permission: 'system:settings:read' as SystemPermission,
    roles: ['system_super_admin'] as SystemRole[],
  },
]

interface AdminNavigationProps {
  className?: string
  mobile?: boolean
  onNavigate?: () => void
}

export function AdminNavigation({ className, mobile = false, onNavigate }: AdminNavigationProps) {
  const pathname = usePathname()
  const { user, logout, isLoading } = useAdminAuth()
  const { checkSystemPermission, hasAnySystemRole } = useSystemRole()

  // Show nothing while loading
  if (isLoading) {
    return (
      <nav className={clsx('space-y-1', className)}>
        <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
      </nav>
    )
  }

  // Show nothing if no user
  if (!user) {
    return (
      <nav className={clsx('space-y-1', className)}>
        <div className="px-3 py-2 text-sm text-gray-500">Not authenticated</div>
      </nav>
    )
  }

  const handleLogout = () => {
    logout()
    if (onNavigate) onNavigate()
  }

  return (
    <nav className={clsx('space-y-1', className)}>
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        
        // Check permission and role access with null safety
        const hasPermission = checkSystemPermission ? checkSystemPermission(item.permission) : false
        const hasRole = !item.roles || (hasAnySystemRole ? hasAnySystemRole(item.roles) : false)
        const canAccess = hasPermission && hasRole
        
        if (!canAccess) return null
        
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={clsx(
              isActive
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              'group flex items-center px-3 py-2 text-sm font-medium border-l-4 transition-colors',
              mobile && 'border-l-0 border-b-2 px-4'
            )}
          >
            <item.icon
              className={clsx(
                isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500',
                'flex-shrink-0 mr-3 h-5 w-5'
              )}
              aria-hidden="true"
            />
            {item.name}
          </Link>
        )
      })}
      
      {/* Maintenance Mode Indicator - Only for Super Admins */}
      {checkSystemPermission && checkSystemPermission('system:maintenance:toggle') && (
        <div className="pt-4 border-t border-gray-200">
          <div className="px-3 py-2">
            <div className="flex items-center space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs font-medium text-gray-700">System Status</p>
                <p className="text-xs text-green-600">Normal Operation</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

interface AdminSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const { user, logout } = useAdminAuth()

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <span className="text-lg font-bold text-white">F</span>
        </div>
        <span className="ml-3 text-xl font-bold text-gray-900">System Admin</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-6 overflow-y-auto">
        <AdminNavigation onNavigate={onClose} />
      </div>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 px-3 py-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {user?.wallet_address ? user.wallet_address.slice(2, 4).toUpperCase() : 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.wallet_address ? 
                `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 
                'Unknown Address'
              }
            </p>
            <div className="flex flex-col space-y-1">
              {(() => {
                // Handle both system_roles and systemRoles properties
                const systemRoles = user?.system_roles || user?.systemRoles || []
                return systemRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {systemRoles.slice(0, 1).map((role) => (
                      <span
                        key={role}
                        className={clsx(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                          getSystemRoleBadgeColor(role)
                        )}
                      >
                        {getSystemRoleDisplayName(role)}
                      </span>
                    ))}
                    {systemRoles.length > 1 && (
                      <span className="text-xs text-gray-500">+{systemRoles.length - 1}</span>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
        
        <button
          onClick={logout}
          className="w-full mt-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}