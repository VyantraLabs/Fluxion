'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { Web3Provider } from '@/contexts/Web3Context';
import { AuthProvider } from '@/contexts/AuthContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { OnboardingManager } from '@/components/common/OnboardingManager';
import { config } from '@/utils/config';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <Web3Provider>
            <AuthProvider>
              <OrganizationProvider>
                {children}
            
            {/* Onboarding Manager */}
            <OnboardingManager />
            
            {/* Toast Notifications */}
            <Toaster
              position="top-right"
              gutter={8}
              containerClassName=""
              containerStyle={{}}
              toastOptions={{
                // Default options
                duration: config.ui.toastDuration,
                style: {
                  background: '#ffffff',
                  color: '#1f2937',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                },
                
                // Success toast style
                success: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#ffffff',
                  },
                },
                
                // Error toast style
                error: {
                  duration: 6000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#ffffff',
                  },
                },
                
                // Loading toast style
                loading: {
                  duration: Infinity,
                  iconTheme: {
                    primary: '#3b82f6',
                    secondary: '#ffffff',
                  },
                },
              }}
            />

            {/* React Query Devtools (only in development) */}
            {config.isDevelopment && (
              <ReactQueryDevtools 
                initialIsOpen={false}
                position={"bottom-right" as any}
              />
            )}
              </OrganizationProvider>
            </AuthProvider>
          </Web3Provider>
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}