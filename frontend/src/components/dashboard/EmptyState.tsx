'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Zap,
  Users,
  ArrowRight,
  Star,
  Layout,
  Sparkles,
  Receipt,
} from 'lucide-react';

interface EmptyStateProps {
  type: 'invoices' | 'templates' | 'payments' | 'general';
  title?: string;
  subtitle?: string;
}

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  primary?: boolean;
  badge?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({ 
  icon, 
  title, 
  description, 
  href, 
  primary = false,
  badge 
}) => (
  <Link
    href={href}
    className={`group relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg ${
      primary
        ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
        : 'bg-white border border-secondary-200 hover:border-primary-300'
    }`}
  >
    {badge && (
      <div className="absolute top-3 right-3">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
          {badge}
        </span>
      </div>
    )}
    
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
      primary 
        ? 'bg-white/20' 
        : 'bg-primary-100 group-hover:bg-primary-200'
    }`}>
      <div className={primary ? 'text-white' : 'text-primary-600'}>
        {icon}
      </div>
    </div>
    
    <h3 className={`text-lg font-semibold mb-2 ${
      primary ? 'text-white' : 'text-secondary-900'
    }`}>
      {title}
    </h3>
    
    <p className={`text-sm mb-4 ${
      primary ? 'text-white/90' : 'text-secondary-600'
    }`}>
      {description}
    </p>
    
    <div className={`flex items-center text-sm font-medium ${
      primary ? 'text-white' : 'text-primary-600 group-hover:text-primary-700'
    }`}>
      <span>Get started</span>
      <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
    </div>
  </Link>
);

const QuickTip: React.FC<{ tip: string; highlight?: string }> = ({ tip, highlight }) => (
  <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
    <div className="flex-shrink-0">
      <Sparkles className="w-5 h-5 text-blue-600" />
    </div>
    <div>
      <p className="text-sm text-blue-800">
        <span className="font-medium">{highlight || 'Pro tip:'}</span> {tip}
      </p>
    </div>
  </div>
);

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  type, 
  title: customTitle, 
  subtitle: customSubtitle 
}) => {
  const getEmptyStateContent = () => {
    switch (type) {
      case 'invoices':
        return {
          title: customTitle || 'Ready to send your first invoice?',
          subtitle: customSubtitle || 'Create professional invoices and get paid faster with crypto payments',
          actions: [
            {
              icon: <Plus className="w-6 h-6" />,
              title: 'Create Invoice',
              description: 'Start from scratch with a blank invoice',
              href: '/dashboard/invoices/create',
              primary: true,
            },
            {
              icon: <Layout className="w-6 h-6" />,
              title: 'Use Template',
              description: 'Choose from pre-built invoice templates',
              href: '/dashboard/templates',
              badge: 'Popular',
            },
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Quick Invoice',
              description: 'Simple one-page invoice for fast payments',
              href: '/dashboard/invoices/create?template=quick',
            },
          ],
          tips: [
            'Invoices with clear payment terms get paid 23% faster on average.',
            'Add your logo and branding to build trust with clients.',
          ],
        };
      
      case 'templates':
        return {
          title: customTitle || 'Build your template library',
          subtitle: customSubtitle || 'Save time by creating reusable invoice templates',
          actions: [
            {
              icon: <Plus className="w-6 h-6" />,
              title: 'Create Template',
              description: 'Build a custom template from scratch',
              href: '/dashboard/templates/create',
              primary: true,
            },
            {
              icon: <Star className="w-6 h-6" />,
              title: 'Browse Public Templates',
              description: 'Discover templates shared by the community',
              href: '/dashboard/templates/public',
              badge: 'Free',
            },
            {
              icon: <Receipt className="w-6 h-6" />,
              title: 'Import from Invoice',
              description: 'Turn an existing invoice into a template',
              href: '/dashboard/invoices?action=template',
            },
          ],
          tips: [
            'Templates can save you 80% of the time when creating similar invoices.',
            'Add custom fields to capture specific information for your business.',
          ],
        };
      
      case 'payments':
        return {
          title: customTitle || 'No payments yet',
          subtitle: customSubtitle || 'Once clients pay your invoices, payment details will appear here',
          actions: [
            {
              icon: <Plus className="w-6 h-6" />,
              title: 'Create Invoice',
              description: 'Send an invoice to start receiving payments',
              href: '/dashboard/invoices/create',
              primary: true,
            },
            {
              icon: <Users className="w-6 h-6" />,
              title: 'Share Invoice',
              description: 'Send existing invoices to clients',
              href: '/dashboard/invoices',
            },
          ],
          tips: [
            'Crypto payments are typically confirmed within 15 minutes.',
            'Set up payment notifications to know instantly when you get paid.',
          ],
        };
      
      default:
        return {
          title: customTitle || 'Welcome to Fluxion!',
          subtitle: customSubtitle || 'Your crypto-native invoicing platform',
          actions: [
            {
              icon: <FileText className="w-6 h-6" />,
              title: 'Create First Invoice',
              description: 'Get started with your first crypto invoice',
              href: '/dashboard/invoices/create',
              primary: true,
            },
            {
              icon: <Layout className="w-6 h-6" />,
              title: 'Explore Templates',
              description: 'Browse professional invoice templates',
              href: '/dashboard/templates',
            },
          ],
          tips: [
            'Fluxion supports payments on Ethereum, Polygon, Arbitrum, and Base networks.',
          ],
        };
    }
  };

  const content = getEmptyStateContent();

  return (
    <div className="text-center py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-secondary-900 mb-2">
          {content.title}
        </h2>
        <p className="text-lg text-secondary-600 max-w-md mx-auto">
          {content.subtitle}
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
        {content.actions.map((action, index) => (
          <ActionCard
            key={index}
            icon={action.icon}
            title={action.title}
            description={action.description}
            href={action.href}
            primary={action.primary}
            badge={action.badge}
          />
        ))}
      </div>

      {/* Tips Section */}
      {content.tips && content.tips.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-3">
          {content.tips.map((tip, index) => (
            <QuickTip 
              key={index}
              tip={tip}
              highlight={index === 0 ? '💡 Pro tip:' : '✨ Did you know?'}
            />
          ))}
        </div>
      )}

      {/* Feature Highlights (only for general empty state) */}
      {type === 'general' && (
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-secondary-900 mb-6">
              Why choose Fluxion?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-success-600" />
                </div>
                <h4 className="font-semibold text-secondary-900 mb-2">Fast Payments</h4>
                <p className="text-sm text-secondary-600">
                  Get paid instantly with cryptocurrency payments
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-secondary-900 mb-2">Global Reach</h4>
                <p className="text-sm text-secondary-600">
                  Work with clients anywhere in the world
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Star className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-secondary-900 mb-2">Professional</h4>
                <p className="text-sm text-secondary-600">
                  Beautiful templates and branding options
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};