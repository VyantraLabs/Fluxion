'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  Menu,
  X,
  Plus,
  Zap,
  Home,
  Bell,
  Layout,
  Users,
  Activity,
  Building2,
} from 'lucide-react';
import { WalletConnectButton } from '@/components/web3/WalletConnectButton';
import { CompactOrganizationSwitcher } from '@/components/common/OrganizationSwitcher';
import { useWalletAuth } from '@/contexts/AuthContext';
import { useUserPermissions, useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/utils/helpers';
import { canUserManageUsers } from '@/utils/permissions';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
  requiresPermission?: (user: any) => boolean;
  badge?: number;
  isMultiOrg?: boolean;
  requiresOrganization?: boolean; // New property for organization-dependent items
}

const getNavigation = (permissions: any): NavigationItem[] => [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { 
    name: 'Organizations', 
    href: '/dashboard/organizations', 
    icon: Building2,
    requiresPermission: (user: any) => permissions?.canViewAllOrganizations || false
  },
  { name: 'Invoices', href: '/dashboard/invoices', icon: FileText, requiresOrganization: true },
  { name: 'Templates', href: '/dashboard/templates', icon: Layout, requiresOrganization: true },
  { name: 'Reminders', href: '/dashboard/reminders', icon: Bell, requiresOrganization: true },
  { name: 'Payments', href: '/dashboard/payments', icon: CreditCard, requiresOrganization: true },
  { 
    name: 'Users', 
    href: '/dashboard/users', 
    icon: Users, 
    requiresPermission: canUserManageUsers,
    requiresOrganization: true,
    isMultiOrg: true,
  },
  {
    name: 'Activity',
    href: '/dashboard/activity',
    icon: Activity,
    requiresPermission: (user: any) => permissions?.canViewActivity || false,
    requiresOrganization: true,
    isMultiOrg: true,
  },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, requiresOrganization: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, requiresOrganization: true },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAuthenticated } = useWalletAuth();
  const permissions = useUserPermissions();
  const { state: orgState } = useOrganization();

  // If not authenticated, redirect to landing page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-secondary-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-secondary-900 mb-4">
              Please connect your wallet
            </h2>
            <p className="text-secondary-600 mb-8">
              You need to connect your wallet to access the dashboard.
            </p>
            <div className="flex justify-center">
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get navigation items with permissions check
  const navigation = getNavigation(permissions);
  
  // Filter navigation items based on user permissions and organization selection
  const navigationWithCurrent = navigation
    .filter((item) => {
      // Check if item requires organization selection
      if (item.requiresOrganization && !orgState.activeOrganization) {
        return false;
      }
      
      // Check permissions
      if (item.requiresPermission) {
        const hasPermission = item.requiresPermission(user);
        // Single role system permission check completed
        return hasPermission;
      }
      return true;
    })
    .map((item) => ({
      ...item,
      current: pathname === item.href || pathname.startsWith(`${item.href}/`),
    }));

  // Navigation items filtered based on user permissions

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-0 z-50 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-secondary-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col">
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="flex h-16 flex-shrink-0 items-center justify-between bg-white px-4 border-b border-secondary-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-secondary-900">Fluxion</span>
              </div>
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Current view indicator for mobile */}
            <div className="px-4 py-2 bg-secondary-50 border-b border-secondary-200">
              <div className="text-xs text-secondary-500 text-center">
                {orgState.isGlobalView ? 'Global View' : orgState.activeOrganization?.name + ' View'}
              </div>
            </div>
            
            <div className="flex flex-1 flex-col overflow-y-auto">
              {/* Organization Switcher */}
              {permissions && (
                <div className="px-4 py-4 border-b border-secondary-200">
                  <CompactOrganizationSwitcher 
                    showAllOption={permissions?.canViewAllOrganizations || false}
                    className="w-full"
                  />
                </div>
              )}
              
              <nav className="flex-1 space-y-1 px-2 py-4">
                {navigationWithCurrent.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                      item.current
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={cn(
                        'mr-3 h-6 w-6',
                        item.current ? 'text-primary-500' : 'text-secondary-400 group-hover:text-secondary-500'
                      )}
                    />
                    <span className="flex-1">{item.name}</span>
                    {item.isMultiOrg && permissions?.canViewAllOrganizations && (
                      <Building2 className="w-3 h-3 text-gray-400" />
                    )}
                    {item.badge && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-900">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-secondary-200">
          <div className="flex h-16 flex-shrink-0 items-center px-4 border-b border-secondary-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-secondary-900">Fluxion</span>
            </div>
            
            {/* Current view indicator */}
            <div className="mt-2 text-xs text-secondary-500 text-center">
              {orgState.isGlobalView ? 'Global View' : orgState.activeOrganization?.name + ' View'}
            </div>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Organization Switcher */}
            {permissions && (
              <div className="px-4 py-4 border-b border-secondary-200">
                <CompactOrganizationSwitcher 
                  showAllOption={permissions?.canViewAllOrganizations || false}
                  className="w-full"
                />
              </div>
            )}
            
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigationWithCurrent.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                    item.current
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-6 w-6',
                      item.current ? 'text-primary-500' : 'text-secondary-400 group-hover:text-secondary-500'
                    )}
                  />
                  <span className="flex-1">{item.name}</span>
                  {item.isMultiOrg && permissions?.canViewAllOrganizations && (
                    <Building2 className="w-3 h-3 text-gray-400" />
                  )}
                  {item.badge && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-900">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            
            {/* Quick action button */}
            <div className="p-4 border-t border-secondary-200">
              <Link
                href="/dashboard/invoices/new"
                className="w-full btn-primary flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white border-b border-secondary-200">
          <button
            type="button"
            className="border-r border-secondary-200 px-4 text-secondary-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex flex-1 justify-between px-4">
            <div className="flex flex-1 items-center">
              {/* Organization Context Indicator */}
              {orgState.activeOrganization ? (
                <div className="flex items-center px-3 py-1.5 bg-primary-50 rounded-md border border-primary-200">
                  <Building2 className="w-4 h-4 text-primary-600 mr-2" />
                  <span className="text-sm font-medium text-primary-900">
                    {orgState.activeOrganization.name}
                  </span>
                  <span className="ml-2 text-xs text-primary-600">Organization</span>
                </div>
              ) : (
                <div className="flex items-center px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                  <Home className="w-4 h-4 text-gray-600 mr-2" />
                  <span className="text-sm font-medium text-gray-900">
                    Global Dashboard
                  </span>
                </div>
              )}
            </div>
            <div className="ml-4 flex items-center space-x-4 md:ml-6">
              {/* Desktop Organization Switcher */}
              <div className="hidden sm:block">
                {permissions && (
                  <CompactOrganizationSwitcher 
                    showAllOption={permissions?.canViewAllOrganizations || false}
                  />
                )}
              </div>
              
              <WalletConnectButton showAddress />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};