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
} from 'lucide-react';
import { WalletConnectButton } from '@/components/web3/WalletConnectButton';
import { useWalletAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
  { name: 'Templates', href: '/dashboard/templates', icon: Layout },
  { name: 'Reminders', href: '/dashboard/reminders', icon: Bell },
  { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAuthenticated } = useWalletAuth();

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

  // Add current property to navigation items
  const navigationWithCurrent = navigation.map((item) => ({
    ...item,
    current: pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

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
            <div className="flex flex-1 flex-col overflow-y-auto">
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
                    {item.name}
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
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">
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
                  {item.name}
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
            <div className="flex flex-1">
              {/* Search could go here */}
            </div>
            <div className="ml-4 flex items-center md:ml-6">
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