'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  FileText, 
  Zap, 
  Shield, 
  ArrowRight,
  CheckCircle,
  Coins,
  Clock,
  Globe,
  Users
} from 'lucide-react';
import { WalletConnectButton } from '@/components/web3/WalletConnectButton';
import { useWalletAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/utils/format';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useWalletAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="relative bg-white border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-secondary-900">Fluxion</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="btn-primary flex items-center space-x-2"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <WalletConnectButton />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-secondary-900 mb-6">
              Professional Invoicing for the{' '}
              <span className="gradient-crypto bg-clip-text text-transparent">
                Crypto Economy
              </span>
            </h1>
            <p className="text-xl text-secondary-600 mb-8 max-w-3xl mx-auto">
              Create professional invoices, request USDC payments, and get paid faster. 
              Built for freelancers, contractors, and businesses operating in Web3.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary text-lg px-8 py-3">
                  Go to Dashboard
                </Link>
              ) : (
                <WalletConnectButton size="lg" />
              )}
              
              <Link 
                href="#features" 
                className="btn-secondary text-lg px-8 py-3"
              >
                Learn More
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">$50K+</div>
                <div className="text-secondary-600">Total Payments Processed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">500+</div>
                <div className="text-secondary-600">Invoices Created</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">98%</div>
                <div className="text-secondary-600">Payment Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-4">
              Everything you need to get paid in crypto
            </h2>
            <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
              Streamline your invoicing process with tools designed for the modern crypto economy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 ml-4">
                  Professional Invoices
                </h3>
              </div>
              <p className="text-secondary-600">
                Create beautiful, professional invoices with line items, due dates, and your branding. 
                Generate PDFs instantly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                  <Coins className="w-6 h-6 text-success-600" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 ml-4">
                  USDC Payments
                </h3>
              </div>
              <p className="text-secondary-600">
                Accept USDC payments on Polygon with low fees. Automatic payment verification and 
                instant notifications.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-warning-600" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 ml-4">
                  Instant Payments
                </h3>
              </div>
              <p className="text-secondary-600">
                Get paid in seconds, not days. Direct wallet-to-wallet transfers with real-time 
                payment tracking.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 ml-4">
                  Wallet Integration
                </h3>
              </div>
              <p className="text-secondary-600">
                Connect with MetaMask for secure authentication. No passwords or complex setups required.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="card">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 ml-4">
                  Secure & Transparent
                </h3>
              </div>
              <p className="text-secondary-600">
                All payments are on-chain and verifiable. Your funds go directly to your wallet - we never hold them.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="card">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 ml-4">
                  Payment Tracking
                </h3>
              </div>
              <p className="text-secondary-600">
                Track invoice status, payment confirmations, and view detailed analytics. 
                Never lose track of your payments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-secondary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-4">
              How it works
            </h2>
            <p className="text-xl text-secondary-600">
              Get started in 3 simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-4">
                Connect Your Wallet
              </h3>
              <p className="text-secondary-600">
                Connect your MetaMask wallet to authenticate securely. No email or password required.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-4">
                Create Your Invoice
              </h3>
              <p className="text-secondary-600">
                Add client details, line items, and due date. Generate a professional PDF automatically.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-4">
                Get Paid Instantly
              </h3>
              <p className="text-secondary-600">
                Share the payment link with your client. They pay with USDC directly to your wallet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to revolutionize your invoicing?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join hundreds of crypto-native freelancers and businesses already using Fluxion.
          </p>
          
          {isAuthenticated ? (
            <Link 
              href="/dashboard/invoices/new" 
              className="inline-flex items-center px-8 py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-primary-50 transition-colors"
            >
              Create Your First Invoice
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          ) : (
            <WalletConnectButton 
              variant="secondary"
              size="lg"
              className="bg-white text-primary-600 hover:bg-primary-50"
            />
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Fluxion</span>
              </div>
              <p className="text-secondary-300 mb-4">
                Professional invoicing for the crypto economy. Built for Web3 freelancers and businesses.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-secondary-400 hover:text-white">
                  Twitter
                </a>
                <a href="#" className="text-secondary-400 hover:text-white">
                  Discord
                </a>
                <a href="#" className="text-secondary-400 hover:text-white">
                  GitHub
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-secondary-300 hover:text-white">Features</a></li>
                <li><a href="#" className="text-secondary-300 hover:text-white">Pricing</a></li>
                <li><a href="#" className="text-secondary-300 hover:text-white">FAQ</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-secondary-300 hover:text-white">Help Center</a></li>
                <li><a href="mailto:support@fluxion.pay" className="text-secondary-300 hover:text-white">Contact</a></li>
                <li><a href="#" className="text-secondary-300 hover:text-white">Status</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-secondary-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-secondary-400">
              © 2025 Fluxion. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-secondary-400 hover:text-white text-sm">
                Privacy Policy
              </a>
              <a href="#" className="text-secondary-400 hover:text-white text-sm">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};