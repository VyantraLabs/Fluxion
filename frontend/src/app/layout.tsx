import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Import mock wallet and debug utilities for development testing
if (process.env.NODE_ENV === 'development') {
  import('@/utils/mockWallet');
  import('@/utils/debug-auth');
}

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Fluxion - Crypto-Native Invoicing',
    template: '%s | Fluxion',
  },
  description: 'Professional invoicing for the crypto economy. Request and receive USDC payments with ease.',
  keywords: ['crypto invoicing', 'USDC payments', 'Web3 billing', 'cryptocurrency invoices', 'freelancer tools'],
  authors: [{ name: 'Fluxion Team' }],
  creator: 'Fluxion',
  publisher: 'Fluxion',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://fluxion.pay'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Fluxion - Crypto-Native Invoicing',
    description: 'Professional invoicing for the crypto economy. Request and receive USDC payments with ease.',
    siteName: 'Fluxion',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Fluxion - Crypto-Native Invoicing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fluxion - Crypto-Native Invoicing',
    description: 'Professional invoicing for the crypto economy. Request and receive USDC payments with ease.',
    images: ['/og-image.png'],
    creator: '@fluxionpay',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#3b82f6' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} h-full antialiased`} suppressHydrationWarning={true}>
        <Providers>
          <div className="min-h-full bg-secondary-50">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}