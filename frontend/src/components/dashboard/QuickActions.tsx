'use client';

import React from 'react';
import Link from 'next/link';
import {
  Plus,
  FileText,
  Template,
  Send,
  Eye,
  Settings,
  BarChart3,
  Zap,
  CreditCard,
  Users,
  ArrowUpRight,
} from 'lucide-react';

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  badge?: string;
}

const QuickActionButton: React.FC<QuickActionProps> = ({ 
  icon, 
  title, 
  description, 
  href, 
  variant = 'secondary',
  disabled = false,
  badge 
}) => {
  const baseClasses = "relative w-full flex items-center p-4 rounded-lg transition-all duration-200 hover:transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2";
  
  const variantClasses = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-lg",
    secondary: "bg-white border border-secondary-200 text-secondary-900 hover:bg-secondary-50 hover:border-primary-300 shadow-sm",
    outline: "border-2 border-dashed border-secondary-300 text-secondary-600 hover:border-primary-400 hover:bg-primary-50",
  };

  const disabledClasses = "opacity-50 cursor-not-allowed hover:transform-none hover:scale-100";

  const className = `${baseClasses} ${variantClasses[variant]} ${disabled ? disabledClasses : ''}`;

  const content = (
    <>
      {badge && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
            {badge}
          </span>
        </div>
      )}
      
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
        variant === 'primary' ? 'bg-white/20' : 'bg-primary-100'
      }`}>
        <div className={variant === 'primary' ? 'text-white' : 'text-primary-600'}>
          {icon}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{title}</p>
        <p className={`text-xs mt-1 ${
          variant === 'primary' ? 'text-white/80' : 'text-secondary-500'
        }`}>
          {description}
        </p>
      </div>
      
      {!disabled && (
        <div className="flex-shrink-0 ml-2">
          <ArrowUpRight className={`w-4 h-4 ${
            variant === 'primary' ? 'text-white/80' : 'text-secondary-400'
          }`} />
        </div>
      )}
    </>
  );

  if (disabled) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
};

interface QuickActionsProps {
  recentInvoicesCount?: number;
  pendingPayments?: number;
  showAdvanced?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ 
  recentInvoicesCount = 0, 
  pendingPayments = 0,
  showAdvanced = true 
}) => {
  const primaryActions = [
    {
      icon: <Plus className="w-5 h-5" />,
      title: 'Create Invoice',
      description: 'Start a new invoice from scratch',
      href: '/dashboard/invoices/create',
      variant: 'primary' as const,
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Quick Invoice',
      description: 'Fast single-item invoice',
      href: '/dashboard/invoices/create?template=quick',
      variant: 'secondary' as const,
      badge: 'Fast',
    },
  ];

  const secondaryActions = [
    {
      icon: <Template className="w-5 h-5" />,
      title: 'Use Template',
      description: 'Create from saved template',
      href: '/dashboard/templates',
      variant: 'secondary' as const,
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: 'View Invoices',
      description: `${recentInvoicesCount} total invoices`,
      href: '/dashboard/invoices',
      variant: 'secondary' as const,
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      title: 'Payment History',
      description: 'Track payments & transactions',
      href: '/dashboard/payments',
      variant: 'secondary' as const,
    },
    {
      icon: <Send className="w-5 h-5" />,
      title: 'Send Reminders',
      description: 'Follow up on pending invoices',
      href: '/dashboard/invoices?status=pending',
      variant: 'secondary' as const,
      disabled: pendingPayments === 0,
    },
  ];

  const advancedActions = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: 'Analytics',
      description: 'View detailed insights',
      href: '/dashboard/analytics',
      variant: 'outline' as const,
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: 'Clients',
      description: 'Manage client relationships',
      href: '/dashboard/clients',
      variant: 'outline' as const,
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: 'Settings',
      description: 'Configure preferences',
      href: '/dashboard/settings',
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Primary Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Quick Actions</h3>
        </div>
        
        <div className="space-y-3">
          {primaryActions.map((action, index) => (
            <QuickActionButton
              key={index}
              icon={action.icon}
              title={action.title}
              description={action.description}
              href={action.href}
              variant={action.variant}
              badge={action.badge}
            />
          ))}
        </div>
      </div>

      {/* Secondary Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Manage</h3>
        </div>
        
        <div className="space-y-3">
          {secondaryActions.map((action, index) => (
            <QuickActionButton
              key={index}
              icon={action.icon}
              title={action.title}
              description={action.description}
              href={action.href}
              variant={action.variant}
              disabled={action.disabled}
            />
          ))}
        </div>
      </div>

      {/* Advanced Actions */}
      {showAdvanced && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Advanced</h3>
          </div>
          
          <div className="space-y-3">
            {advancedActions.map((action, index) => (
              <QuickActionButton
                key={index}
                icon={action.icon}
                title={action.title}
                description={action.description}
                href={action.href}
                variant={action.variant}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pro Tips */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Eye className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-900">Pro Tip</h4>
            <p className="text-sm text-blue-800 mt-1">
              Use templates to create consistent invoices 10x faster. Save frequently used invoice structures as templates for instant reuse.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};