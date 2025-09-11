import React from 'react'
import { AdminAuthProvider } from '@/contexts/AdminAuthContext'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata = {
  title: 'Fluxion System Admin',
  description: 'System administrator panel for Fluxion Web3 payment platform',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className="h-full">
        <AdminAuthProvider>
          {children}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AdminAuthProvider>
      </body>
    </html>
  )
}