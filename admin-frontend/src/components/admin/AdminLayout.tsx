'use client'

import React, { useState } from 'react'
import { SystemRoleGuard } from '../guards/SystemRoleGuard'
import { AdminSidebar } from './AdminNavigation'
import { ErrorBoundary } from '../errors/ErrorBoundary'
import { SystemRole, SystemPermission } from '@/types/admin'
import {
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface AdminLayoutProps {
  children: React.ReactNode
  requiredRoles?: SystemRole[]
  requiredPermissions?: SystemPermission[]
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function AdminLayout({
  children,
  requiredRoles,
  requiredPermissions,
  title,
  subtitle,
  actions,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SystemRoleGuard 
      roles={requiredRoles}
      permissions={requiredPermissions}
    >
      <div className="h-screen flex overflow-hidden bg-gray-100">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 flex z-40 lg:hidden">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
              <ErrorBoundary>
                <AdminSidebar onClose={() => setSidebarOpen(false)} />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64">
            <ErrorBoundary>
              <AdminSidebar />
            </ErrorBoundary>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          {/* Top nav */}
          <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Bars3Icon className="h-6 w-6" />
                </button>
                
                {(title || subtitle) && (
                  <div>
                    {title && (
                      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    )}
                    {subtitle && (
                      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
                    )}
                  </div>
                )}
              </div>

              {actions && (
                <div className="flex items-center space-x-3">
                  {actions}
                </div>
              )}
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SystemRoleGuard>
  )
}